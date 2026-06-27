/**
 * Client-side graph executor for the builder studio.
 *
 * Walks the canvas (nodes + edges) starting from `starter`, producing an
 * output per node. Control-flow and simple utility blocks run in JS here in
 * the browser; anything that needs server access (LLM, DB, HTTP-from-server)
 * hops to the convengine backend. The only block currently forwarded is
 * `agent` (→ `/api/v1/ck8t/agent`); add more cases below as needed.
 *
 * This deliberately does NOT go through the conversation/message endpoint —
 * we don't want intent detection, MCP routing, or semantic pipelines
 * interfering with a direct graph execution.
 *
 * Parallelism: sibling downstream branches (multiple outgoing edges from the
 * same node, or multiple nodes with all dependencies satisfied) are
 * dispatched concurrently via Promise.all. Execution order within a single
 * chain is still sequential because downstream nodes read from upstream
 * outputs.
 */
import { runAgent } from '../api/run-client'
import { detectServer } from '../api/server-status'
import { useBrowserProvidersStore } from '../api/browser-providers-store'
import { callTool as callMcpTool } from '../mcp/mcp-client'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useWorkflowStore } from '../stores/workflow-store'
import { useLlmConfigStore } from '../stores/llm-config-store'
import { useAiProvidersStore, getAiProviderModelOptions } from '../stores/ai-providers-store'
import { resolvePortType, isTypeCompatible, getCardPorts } from '../panel/io-registry'
import { getBlock, customBrowserBlockRunners, coreBlockRunners } from '../blocks/registry'
import { useMcpProgressStore } from '../stores/mcp-progress-store'
import { useBlockDebugStore } from '../stores/block-debug-store'
import { useBlockDebuggerStore } from '../debug/block-debugger-store'
import { BlockDebugEngine } from '../debug/block-debug-engine'
import { computeLoopPlans, runLoopBlock } from './loop-engine'
import { startExtDebugSession } from '../debug/ext-debug-client'

// Validate a runtime value against a declared port type.
// Returns an error string if mismatch, or null if OK.
function checkValueType(value, expectedType) {
  if (!expectedType || expectedType === 'any') return null
  if (value == null) return null // null/undefined pass through (may be optional)
  switch (expectedType) {
    case 'string':  return typeof value !== 'string'  ? `expected string, got ${typeof value}` : null
    case 'number':  return typeof value !== 'number'  ? `expected number, got ${typeof value}` : null
    case 'boolean': return typeof value !== 'boolean' ? `expected boolean, got ${typeof value}` : null
    case 'json':    return (typeof value !== 'object' || Array.isArray(value)) ? `expected json object, got ${Array.isArray(value) ? 'array' : typeof value}` : null
    case 'array':   return !Array.isArray(value) ? `expected array, got ${typeof value}` : null
    default:        return null
  }
}

export class GraphValidationError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'GraphValidationError'
    this.nodeId = details.nodeId || null
    this.nodeTitle = details.nodeTitle || null
    this.blockType = details.blockType || null
    this.severity = details.severity || 'error'
    this.hint = details.hint || null
    this.affectedNodes = details.affectedNodes || []
    // Build rich errorDetail for Problems panel
    this.errorDetail = {
      message,
      nodeId: this.nodeId,
      nodeTitle: this.nodeTitle,
      blockType: this.blockType,
      cause: details.cause || null,
      stack: this.stack,
      timestamp: new Date().toISOString(),
      ...details.extra,
    }
  }
}

export async function executeGraph({ workflow, inputs, onProgress }) {
  const { nodes: allNodes = [], edges: allEdges = [], subBlockValues = {} } = workflow

  // ── Identify disabled nodes (they will pass-through input as output) ──
  const disabledIds = new Set(allNodes.filter((n) => n.data?.disabled).map((n) => n.id))
  const nodes = allNodes
  const edges = allEdges

  // ── Compute reachable nodes from starter/user_input/schedule/webhook via edges ──
  const reachable = new Set()
  const outgoingAll = {}
  for (const e of edges) {
    if (!outgoingAll[e.source]) outgoingAll[e.source] = []
    outgoingAll[e.source].push(e)
  }
  // BFS from seed nodes (all root trigger types)
  const SEED_BLOCK_TYPES = new Set(['starter', 'user_input', 'schedule', 'webhook_request', 'audio_input'])
  const seedIds = nodes
    .filter((n) => SEED_BLOCK_TYPES.has(n.data?.blockType))
    .map((n) => n.id)
  const queue = [...seedIds]
  for (const id of queue) {
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const e of (outgoingAll[id] || [])) {
      if (!reachable.has(e.target)) queue.push(e.target)
    }
  }

  const nodesById = Object.fromEntries(nodes.map((n) => [n.id, n]))

  // ── Validate: non-seed nodes must be reachable from Start ────────────
  // slave_agent blocks are dispatched programmatically by master_agent — they have no
  // incoming edges by design and must be exempt from the reachability validation.
  const EXEMPT_BLOCK_TYPES = new Set(['slave_agent'])
  const seedTypes = SEED_BLOCK_TYPES
  for (const n of nodes) {
    if (seedTypes.has(n.data?.blockType)) continue
    if (EXEMPT_BLOCK_TYPES.has(n.data?.blockType)) continue
    if (disabledIds.has(n.id)) continue
    if (!reachable.has(n.id)) {
      const title = n.data?.title || n.data?.blockType || n.id
      // Collect all unconnected non-seed nodes for the error
      const allUnconnected = nodes
        .filter((nd) => !seedTypes.has(nd.data?.blockType) && !disabledIds.has(nd.id) && !reachable.has(nd.id))
        .map((nd) => ({ id: nd.id, title: nd.data?.title || nd.data?.blockType || nd.id, blockType: nd.data?.blockType }))
      throw new GraphValidationError(
        `"${title}" has no input connection — it is unreachable from any trigger node (Start, User Input, Schedule, Webhook, or Audio Input).`,
        {
          nodeId: n.id,
          nodeTitle: title,
          blockType: n.data?.blockType,
          cause: 'No incoming edges found. The graph executor can only run nodes that are connected downstream from a trigger node.',
          hint: 'Connect an edge from another block\'s output to this block\'s input, or disable it (⌥B / right-click → Disable).',
          affectedNodes: allUnconnected,
          extra: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            reachableCount: reachable.size,
            unreachableNodes: allUnconnected,
          },
        }
      )
    }
  }

  const outgoing = groupBy(edges, 'source')
  const incoming = groupBy(edges, 'target')

  // ── Real cyclic loop execution (for_each / for_loop / loop) ──────────────
  // Detects item->body-chain->feedback cycles and excludes the body nodes from
  // the normal one-shot BFS scheduling below — the loop node "owns" them and
  // drives the chain itself via runLoopBlock(). See loop-engine.js.
  const { plans: loopPlans, bodyOwner: loopBodyOwner } = computeLoopPlans(nodes, edges, GraphValidationError)

  // ── Validate: required subBlock fields must be set before execution starts ──
  // This catches blocks like MCP (server + tool required) or any block with
  // required: true fields that the user hasn't configured yet.
  for (const n of nodes) {
    if (disabledIds.has(n.id)) continue
    if (SEED_BLOCK_TYPES.has(n.data?.blockType)) continue
    if (!reachable.has(n.id)) continue
    const blockDef = getBlock(n.data?.blockType)
    if (!blockDef?.subBlocks?.length) continue
    const vals = subBlockValues[n.id] || {}
    for (const sub of blockDef.subBlocks) {
      if (!sub.required) continue
      // Handle conditional required: { field, value } — only required when dep matches
      if (typeof sub.required === 'object') {
        const dep = vals[sub.required.field]
        const reqValues = Array.isArray(sub.required.value) ? sub.required.value : [sub.required.value]
        if (!reqValues.includes(dep)) continue
      }
      const v = vals[sub.id]
      const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
      if (isEmpty) {
        // A required field can still resolve via the block's own defaultValue
        // getter (e.g. agent.model falling back to getDefaultModel() / the
        // user's "Set as Default" choice) — only flag it as missing if there's
        // truly no default either. Guard the getter call: it may throw if the
        // backing store hasn't hydrated yet.
        let resolvedDefault
        try { resolvedDefault = sub.defaultValue } catch { resolvedDefault = undefined }
        const defaultIsEmpty = resolvedDefault == null || resolvedDefault === '' || (Array.isArray(resolvedDefault) && resolvedDefault.length === 0)
        if (!defaultIsEmpty) continue
        const nodeTitle = n.data?.title || blockDef.name || n.data?.blockType || n.id
        const fieldLabel = sub.title || sub.id
        throw new GraphValidationError(
          `"${nodeTitle}" is missing required field: ${fieldLabel}`,
          {
            nodeId: n.id,
            nodeTitle,
            blockType: n.data?.blockType,
            cause: `The "${fieldLabel}" field is required but has not been configured.`,
            hint: `Select or enter a value for "${fieldLabel}" in the "${nodeTitle}" block before running.`,
            severity: 'error',
          }
        )
      }
    }
  }

  const outputs = {}     // nodeId -> output value
  const trace = []       // ordered
  const started = new Set()
  /**
   * Branching nodes record the chosen output-handle id here so that
   * downstream readiness can skip edges leaving non-matching handles.
   * Regular nodes (any single-output block) don't set this.
   */
  const chosenHandle = {} // nodeId -> string | null

  // Seed user_input + starter nodes and emit lifecycle events so the canvas
  // marks them green alongside the agent/response nodes. Previously these
  // two block types were seeded silently, which is why the URL and Start
  // cards never flipped to the "done" state after a run.
  for (const n of nodes) {
    const bt = n.data?.blockType
    if (!SEED_BLOCK_TYPES.has(bt)) continue

    // ── Disabled seed node: produce null output, mark started, skip core logic ──
    if (disabledIds.has(n.id)) {
      outputs[n.id] = null
      trace.push({
        nodeId: n.id, blockType: bt, title: n.data?.title,
        input: null, output: null, ms: 0,
        meta: { skipped: true, reason: 'Node is disabled' },
      })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: bt, title: n.data?.title })
      onProgress?.({ type: 'done', nodeId: n.id, blockType: bt, title: n.data?.title, output: null, meta: { skipped: true } })
      continue
    }

    if (bt === 'user_input') {
      outputs[n.id] = Object.prototype.hasOwnProperty.call(inputs || {}, n.id)
        ? inputs[n.id]
        : null
      trace.push({
        nodeId: n.id,
        blockType: 'user_input',
        title: n.data?.title,
        input: null,
        output: outputs[n.id],
        ms: 0,
        meta: { source: 'RunPanel input', value: outputs[n.id] },
      })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: 'user_input', title: n.data?.title })
      try { useWorkflowStore.getState().recordNodeOutput(n.id, outputs[n.id]) } catch { /* ignore */ }
      onProgress?.({ type: 'done', nodeId: n.id, blockType: 'user_input', title: n.data?.title, output: outputs[n.id] })
    } else if (bt === 'starter') {
      // In chat mode, inputs.__chat__ carries { message, history }.
      // Seed the starter with that payload so downstream blocks receive it.
      const chatPayload = inputs?.__chat__ ?? null
      outputs[n.id] = chatPayload
      trace.push({
        nodeId: n.id, blockType: 'starter', title: n.data?.title,
        input: null, output: chatPayload, ms: 0,
        meta: { source: chatPayload ? 'chat message' : 'graph root' },
      })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: 'starter', title: n.data?.title })
      onProgress?.({ type: 'done', nodeId: n.id, blockType: 'starter', title: n.data?.title, output: chatPayload })
    } else if (bt === 'schedule') {
      const firedAt = new Date().toISOString()
      outputs[n.id] = { firedAt }
      trace.push({ nodeId: n.id, blockType: 'schedule', title: n.data?.title, input: null, output: { firedAt }, ms: 0, meta: { source: 'simulated trigger' } })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: 'schedule', title: n.data?.title })
      onProgress?.({ type: 'done', nodeId: n.id, blockType: 'schedule', title: n.data?.title, output: { firedAt } })
    } else if (bt === 'webhook_request') {
      const webhookOut = { body: inputs?.webhook ?? null, headers: {}, query: {} }
      outputs[n.id] = webhookOut
      trace.push({ nodeId: n.id, blockType: 'webhook_request', title: n.data?.title, input: null, output: webhookOut, ms: 0, meta: { source: 'simulated webhook' } })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: 'webhook_request', title: n.data?.title })
      onProgress?.({ type: 'done', nodeId: n.id, blockType: 'webhook_request', title: n.data?.title, output: webhookOut })
    } else if (bt === 'audio_input') {
      const vals = subBlockValues[n.id] || {}
      const audioB64 = vals._audioB64 || ''
      const audioFormat = vals._audioFormat || 'webm'
      const audioDurationMs = vals._audioDurationMs || 0
      const audioOut = audioB64
        ? { audio_base64: audioB64, format: audioFormat, duration_ms: audioDurationMs }
        : null
      outputs[n.id] = audioOut
      trace.push({
        nodeId: n.id, blockType: 'audio_input', title: n.data?.title,
        input: null, output: audioOut, ms: 0,
        meta: { source: audioB64 ? 'inline recorder (card)' : 'no recording yet', hasAudio: !!audioB64 },
      })
      started.add(n.id)
      onProgress?.({ type: 'start', nodeId: n.id, blockType: 'audio_input', title: n.data?.title })
      try { useWorkflowStore.getState().recordNodeOutput(n.id, audioOut) } catch { /* ignore */ }
      onProgress?.({ type: 'done', nodeId: n.id, blockType: 'audio_input', title: n.data?.title, output: audioOut })
    }
  }

  // BFS with readiness gating. An incoming edge is "satisfied" when:
  //  (a) its source node has finished, AND
  //  (b) either the source was a single-output block (no chosenHandle),
  //      OR the edge's sourceHandle matches the chosen branch.
  // This is how if_else / if_elseif_else / switch_case suppress the losing
  // branches without a separate pruning pass.
  const edgeIsLive = (e) => {
    if (!started.has(e.source)) return false
    const chosen = chosenHandle[e.source]
    if (chosen == null) return true
    const sh = e.sourceHandle || 'out'
    return sh === chosen
  }
  while (true) {
    const ready = nodes.filter((n) => {
      if (started.has(n.id)) return false
      if (!reachable.has(n.id)) return false
      // Loop body nodes are owned by their loop node — they're driven directly by
      // runLoopBlock(), never scheduled independently by this BFS.
      if (loopBodyOwner.has(n.id)) return false
      const loopPlan = loopPlans.get(n.id)
      const ins = loopPlan ? loopPlan.gatingEdges : (incoming[n.id] || [])
      if (ins.length === 0) return false
      return ins.every(edgeIsLive)
    })
    if (ready.length === 0) break

    await Promise.all(ready.map(async (n) => {
      started.add(n.id)
      const t0 = performance.now()

      // ── Loop nodes (for_each / for_loop / loop) with a real body chain wired
      // bypass the generic single-shot path entirely — runLoopBlock() drives
      // the chain once per item, writing outputs[n.id] (and outputs[bodyId])
      // itself. See loop-engine.js for why this needs special-casing.
      const loopPlan = loopPlans.get(n.id)
      if (loopPlan) {
        const loopValues = subBlockValues[n.id] || {}
        onProgress?.({ type: 'start', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title, values: loopValues })
        const blkCfg = getBlock(n.data?.blockType)
        const progressFn = blkCfg?.hasProgress
          ? (data) => useMcpProgressStore.getState().setProgress({ nodeId: n.id, ...data })
          : undefined
        try {
          const result = await runLoopBlock({
            node: n, plan: loopPlan, incoming, nodesById, subBlockValues, outputs, allNodes, runNode, progress: progressFn,
          })
          const iterationCount = Array.isArray(result.iterations) ? result.iterations.length : (result.iterations ?? result.results?.length ?? 0)
          const ms = Math.round(performance.now() - t0)
          const traceEntry = {
            nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
            input: null, output: result, values: loopValues,
            meta: { loop: true, iterationCount }, ms,
          }
          trace.push(traceEntry)
          try { useWorkflowStore.getState().recordNodeOutput(n.id, result) } catch { /* ignore */ }
          try { useWorkflowStore.getState().recordNodeTrace(n.id, traceEntry) } catch { /* ignore */ }
          onProgress?.({ type: 'done', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title, output: result, ms })
        } catch (err) {
          const ms = Math.round(performance.now() - t0)
          const errTraceEntry = {
            nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
            input: null, values: loopValues, error: err.message || String(err), ms,
          }
          trace.push(errTraceEntry)
          try { useWorkflowStore.getState().recordNodeTrace(n.id, errTraceEntry) } catch { /* ignore */ }
          onProgress?.({ type: 'error', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title, error: err.message || String(err) })
          throw err
        } finally {
          if (progressFn) useMcpProgressStore.getState().clearProgress()
        }
        return
      }

      const inEdges = incoming[n.id] || []
      // Resolve per-edge output: if the edge's sourceHandle is a named
      // handle like "out_status", extract just that field from the source
      // node's output object. This ensures that connecting a single output
      // handle (e.g. only "status" from a response node) forwards only
      // that value, not the entire {data, status, headers} object.
      const resolveEdgeOutput = (e) => {
        const full = outputs[e.source]
        const sh = e.sourceHandle || 'out'
        if (sh === 'out' || full == null || typeof full !== 'object') return full
        const field = sh.startsWith('out_') ? sh.slice(4) : sh
        return field in full ? full[field] : full
      }
      const upstream = inEdges.map(resolveEdgeOutput)
      const input = upstream.length <= 1 ? upstream[0] : upstream
      // Build per-handle input map so blocks with multiple typed inputs
      // (e.g. response: data, status, headers) can read from each handle.
      // Edge targetHandle is like "in_data", "in_headers" etc.
      const inputsByHandle = {}
      for (const e of inEdges) {
        const th = e.targetHandle || 'in'
        // Normalize legacy "in" handle → "input" key (most blocks' first port)
        const key = th === 'in' ? 'input' : (th.startsWith('in_') ? th.slice(3) : th)
        // Skip duplicate: if a proper in_* edge already wrote this key, don't overwrite
        if (key in inputsByHandle) continue
        inputsByHandle[key] = resolveEdgeOutput(e)
      }
      const values = subBlockValues[n.id] || {}
      onProgress?.({ type: 'start', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title, values })
      try {
        // ── Runtime port type validation (skip for disabled pass-through) ──
        if (!disabledIds.has(n.id)) {
        for (const e of inEdges) {
          // If the upstream node is disabled it is a pass-through — trace
          // back to its actual predecessor and use that node's output type,
          // so the real type flowing through is validated correctly.
          let srcType
          if (disabledIds.has(e.source)) {
            const prevEdge = (incoming[e.source] || [])[0]
            srcType = prevEdge
              ? resolvePortType(prevEdge.source, prevEdge.sourceHandle || 'out', 'source', subBlockValues, nodes)
              : 'any'
          } else {
            srcType = resolvePortType(e.source, e.sourceHandle || 'out', 'source', subBlockValues, nodes)
          }
          const th = e.targetHandle || 'in'
          const tgtType = resolvePortType(n.id, th, 'target', subBlockValues, nodes)
          if (!isTypeCompatible(srcType, tgtType)) {
            const srcTitle = nodesById[e.source]?.data?.title || e.source
            const tgtTitle = n.data?.title || n.id
            throw new Error(
              `Type mismatch: "${srcTitle}" output (${srcType}) is not compatible with "${tgtTitle}" input (${tgtType})`
            )
          }
          // Also validate actual runtime value matches declared target type
          const val = resolveEdgeOutput(e)
          const rtErr = checkValueType(val, tgtType)
          if (rtErr) {
            const srcTitle = nodesById[e.source]?.data?.title || e.source
            const tgtTitle = n.data?.title || n.id
            throw new Error(
              `Runtime type error: "${srcTitle}" → "${tgtTitle}": ${rtErr}`
            )
          }
        }
        } // end type-validation guard

        // ── Disabled node: skip or pass-through based on port presence ──
        if (disabledIds.has(n.id)) {
          const blockDef = getBlock(n.data?.blockType)
          const cardPorts = getCardPorts(n.data?.blockType, blockDef?.inputs, blockDef?.outputs)
          const hasInputs = cardPorts.inputs.length > 0
          const hasOutputs = cardPorts.outputs.length > 0

          if (hasInputs && hasOutputs) {
            // Both ports → pass input straight through without running core logic.
            // If the upstream produced nothing (e.g. connected to Starter), output is null.
            const passValue = input ?? null
            outputs[n.id] = passValue
            const traceEntry = {
              nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
              input, inputsByHandle, output: passValue, values,
              meta: { passThrough: true, reason: 'Node is disabled' },
              ms: Math.round(performance.now() - t0),
            }
            trace.push(traceEntry)
            try { useWorkflowStore.getState().recordNodeTrace(n.id, traceEntry) } catch { /* ignore */ }
            onProgress?.({
              type: 'done', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
              output: passValue, meta: traceEntry.meta, values, ms: traceEntry.ms,
            })
          } else {
            // Only input, only output, or neither → skip entirely; produce no output.
            outputs[n.id] = null
            const traceEntry = {
              nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
              input: null, inputsByHandle, output: null, values,
              meta: { skipped: true, reason: 'Node is disabled (no pass-through — requires both input and output ports)' },
              ms: Math.round(performance.now() - t0),
            }
            trace.push(traceEntry)
            try { useWorkflowStore.getState().recordNodeTrace(n.id, traceEntry) } catch { /* ignore */ }
            onProgress?.({
              type: 'done', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
              output: null, meta: traceEntry.meta, values, ms: traceEntry.ms,
            })
          }
          return
        }

        const ran = await runNode({ node: n, values, input, outputs, inputsByHandle, allNodes, subBlockValues })
        // runNode may return either a raw value or `{ __meta, value }` so that
        // agent/mcp blocks can attach rich debugging info (systemPrompt,
        // userPrompt after interpolation, skill output, model, etc.). The meta
        // is carried through to both the trace and the onProgress `done`
        // event so the Debug panel can expand a row and show everything.
        let output = ran
        let meta
        if (ran && typeof ran === 'object' && ran.__meta) {
          meta = ran.__meta
          output = ran.value
        }
        if (output && typeof output === 'object' && typeof output.branch === 'string') {
          chosenHandle[n.id] = output.branch
          outputs[n.id] = output.value
        } else {
          outputs[n.id] = output
        }

        // ── Runtime output type validation ──────────────────────────
        // Validate that the actual output matches the declared output port type.
        const outEdges = outgoing[n.id] || []
        for (const e of outEdges) {
          const srcHandle = e.sourceHandle || 'out'
          const declaredType = resolvePortType(n.id, srcHandle, 'source', subBlockValues, nodes)
          const outVal = resolveEdgeOutput(e)
          const rtErr = checkValueType(outVal, declaredType)
          if (rtErr) {
            const srcTitle = n.data?.title || n.id
            throw new GraphValidationError(
              `Output type error on "${srcTitle}": ${rtErr}`,
              {
                nodeId: n.id,
                nodeTitle: srcTitle,
                blockType: n.data?.blockType,
                cause: `Port "${srcHandle}" produced a value that doesn't match its declared type "${declaredType}".`,
                hint: `Check the output of "${srcTitle}" — it returned a ${typeof outVal} but the port expects ${declaredType}.`,
              }
            )
          }
        }
        try { useWorkflowStore.getState().recordNodeOutput(n.id, outputs[n.id]) } catch { /* ignore */ }
        const traceEntry = {
          nodeId: n.id,
          blockType: n.data?.blockType,
          title: n.data?.title,
          input,
          inputsByHandle,    // per-handle connected inputs (e.g. { data: ..., headers: ... })
          output,            // raw value, no truncation (UI truncates for the collapsed preview)
          values: meta?.model ? { ...values, model: meta.model } : values,
          meta,              // per-block rich metadata (prompts after templating, etc.)
          ms: Math.round(performance.now() - t0),
        }
        trace.push(traceEntry)
        try { useWorkflowStore.getState().recordNodeTrace(n.id, traceEntry) } catch { /* ignore */ }
        onProgress?.({
          type: 'done', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
          output, meta, values, ms: Math.round(performance.now() - t0),
        })
      } catch (err) {
        const errorDetail = {
          message: err.message || String(err),
          ...(err.errorDetail && typeof err.errorDetail === 'object' ? err.errorDetail : {}),
          ...(err.llmFallback ? { llmFallback: err.llmFallback } : {}),
          ...(err.url && { url: err.url }),
          ...(err.resolvedUrl && { resolvedUrl: err.resolvedUrl }),
          ...(err.method && { method: err.method }),
          ...(err.status && { status: err.status }),
          ...(err.statusText && { statusText: err.statusText }),
          ...(err.responseBody && { responseBody: err.responseBody }),
          ...(err.responseHeaders && { responseHeaders: err.responseHeaders }),
          ...(err.requestHeaders && { requestHeaders: err.requestHeaders }),
          ...(err.requestPayload && { requestPayload: err.requestPayload }),
          ...(err.stack && { stack: err.stack }),
          ...(err.cause && { cause: err.cause.message || String(err.cause) }),
          timestamp: new Date().toISOString(),
          blockType: n.data?.blockType,
          nodeId: n.id,
          nodeTitle: n.data?.title,
        }
        const errTraceEntry = {
          nodeId: n.id,
          blockType: n.data?.blockType,
          title: n.data?.title,
          input,
          inputsByHandle,
          values,
          error: err.message || String(err),
          errorDetail,
          ms: Math.round(performance.now() - t0),
        }
        trace.push(errTraceEntry)
        try { useWorkflowStore.getState().recordNodeTrace(n.id, errTraceEntry) } catch { /* ignore */ }
        onProgress?.({
          type: 'error', nodeId: n.id, blockType: n.data?.blockType, title: n.data?.title,
          error: err.message || String(err), errorDetail,
        })
        throw err
      }
    }))
  }

  // Final output = the response node's output, or the last produced value.
  const responseNode = nodes.find((n) => n.data?.blockType === 'response')
  const finalOutput = responseNode ? outputs[responseNode.id] : trace[trace.length - 1]?.output
  return { output: finalOutput, trace }
}

/* ------------------------------------------------------------------------- */
/* Per-block execution                                                        */
/* ------------------------------------------------------------------------- */

/**
 * If the Debugger tab currently has this exact node/block open with live
 * (non-disabled, non-muted) breakpoints on its browser-executable file
 * ('client.js' for normal blocks — or 'extension.js' for the few blocks
 * where client.js is just a re-export of it — and the function block's own
 * code for 'function'), return what's needed to route this run through the
 * debug engine instead of the normal runner. Mirrors Daakia's "same Send
 * button, backend decides routing based on whether breakpoints exist"
 * pattern.
 */
function getActiveDebugRun(nodeId, blockType) {
  const dbg = useBlockDebuggerStore.getState()
  if (dbg.nodeId !== nodeId || dbg.blockType !== blockType) return null
  if (dbg.breakpointsMuted) return null
  if (dbg.status === 'running' || dbg.status === 'paused') return null

  if (blockType === 'function') {
    const file = dbg.files.find(f => f.runnerType === 'function')
    if (!file) return null
    const lines = (dbg.breakpoints[file.name] || []).filter(l => !(dbg.disabledBreakpoints[file.name] || []).includes(l))
    if (lines.length === 0) return null
    return { mode: 'script', file: file.name, breakpoints: lines }
  }

  let file = dbg.files.find(f => f.runnerType === 'client') || dbg.files.find(f => f.name === 'client.js')
  if (!file) return null

  // A few blocks (master_agent, slave_agent, chain_of_thought — ESM core blocks;
  // some CJS community blocks too) ship a client.js that's a pure re-export of
  // extension.js — that's still what executes in-browser via canvas Run, but
  // the real run() body (and thus the only place a breakpoint makes sense)
  // lives in the extension.js tab.
  const isReExport = /^export\s*\{\s*default\s*\}\s*from\s*['"]\.\/extension\.js['"]/m.test(file.content)
    || /module\.exports\s*=\s*require\(\s*['"]\.\/extension\.js['"]\s*\)/.test(file.content)
  if (isReExport) {
    const extFile = dbg.files.find(f => f.runnerType === 'extension')
    if (extFile) file = extFile
  }

  // Extension.js has its own breakpoints AND client.js is not a re-export —
  // the block delegates Node work via fetch('/ck8t/run-block') inside run().
  // Signal runNode() to attach __ck8tExtDebug to ctx rather than routing to
  // the in-browser engine (which can't load Node modules like pdf-lib).
  if (!isReExport) {
    const extFile = dbg.files.find(f => f.runnerType === 'extension' || f.name === 'extension.js')
    if (extFile) {
      const extLines = (dbg.breakpoints[extFile.name] || [])
        .filter(l => !(dbg.disabledBreakpoints[extFile.name] || []).includes(l))
      if (extLines.length > 0) {
        return { extDebug: true, file: extFile.name, breakpoints: extLines }
      }
    }
  }

  const lines = (dbg.breakpoints[file.name] || []).filter(l => !(dbg.disabledBreakpoints[file.name] || []).includes(l))
  if (lines.length === 0) return null
  return { mode: 'module', file: file.name, breakpoints: lines, source: file.content }
}

async function runThroughDebugger(dbgRun, { blockType, ctx }) {
  const store = useBlockDebuggerStore.getState()
  const engine = new BlockDebugEngine()
  store.setEngine(engine)
  store.setRunning()

  const runOpts = {
    mode: dbgRun.mode,
    breakpoints: dbgRun.breakpoints,
    file: dbgRun.file,
    onPaused: (file, line, vars, cs) => useBlockDebuggerStore.getState().setPaused(file, line, vars, cs),
    onResumed: () => useBlockDebuggerStore.getState().setResumed(),
    onCompleted: (output) => useBlockDebuggerStore.getState().setCompleted(output),
    onError: (msg) => useBlockDebuggerStore.getState().setError(msg),
    onLog: (entry) => useBlockDebuggerStore.getState().addLog(entry),
  }

  if (dbgRun.mode === 'module') {
    runOpts.source = dbgRun.source
    runOpts.blockType = blockType
    runOpts.ctx = ctx
  } else {
    runOpts.source = ctx.values?.code || 'return input'
    runOpts.input = ctx.input
    runOpts.values = ctx.values
  }

  store.setLastDebugRun({ ...runOpts, blockType })
  try {
    return await engine.run(runOpts)
  } catch (e) {
    if (e?.isDebugStop) useBlockDebuggerStore.getState().setStopped()
    throw e
  } finally {
    store.setEngine(null)
  }
}

async function runNode({ node, values, input, outputs, inputsByHandle, allNodes = [], subBlockValues = {} }) {
  const type = node.data?.blockType

  // Seed blocks are seeded before the BFS loop; defensive guard only
  if (type === 'starter' || type === 'user_input' || type === 'audio_input') return outputs[node.id]

  const runner = coreBlockRunners.get(type) ?? customBrowserBlockRunners.get(type)
  if (runner) {
    const blkCfg = getBlock(type)
    const progressFn = blkCfg?.hasProgress
      ? (data) => useMcpProgressStore.getState().setProgress({ nodeId: node.id, ...data })
      : undefined
    const ctx = buildRunCtx({ node, values, input, outputs, inputsByHandle, allNodes, subBlockValues })
    ctx.progress = progressFn ?? null
    try {
      const dbgRun = getActiveDebugRun(node.id, type)
      if (dbgRun) {
        if (dbgRun.extDebug) {
          // Extension.js path: register WS session BEFORE runner() fires the
          // /ck8t/run-block POST so the bridge has a socket ready to push events.
          const sessionId = (crypto.randomUUID?.() ?? `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
          const dbgStore = useBlockDebuggerStore.getState()
          dbgStore.setRunning()
          let handle
          try {
            handle = await startExtDebugSession({
              sessionId,
              onPaused:    (file, line, vars, cs) => useBlockDebuggerStore.getState().setPaused(file, line, vars, cs),
              onResumed:   ()       => useBlockDebuggerStore.getState().setResumed(),
              onCompleted: (output) => { useBlockDebuggerStore.getState().setCompleted(output); useBlockDebuggerStore.getState().clearRemoteSession() },
              onError:     (msg)    => { useBlockDebuggerStore.getState().setError(msg);        useBlockDebuggerStore.getState().clearRemoteSession() },
              onLog:       (entry)  => useBlockDebuggerStore.getState().addLog(entry),
            })
          } catch (e) {
            dbgStore.setError(e?.message || String(e))
            return input
          }
          dbgStore.startRemoteSession(sessionId, handle)
          ctx.__ck8tExtDebug = { breakpoints: dbgRun.breakpoints, file: dbgRun.file, sessionId }
          try {
            return await runner(ctx)
          } catch (e) {
            useBlockDebuggerStore.getState().setError(e?.message || String(e))
            useBlockDebuggerStore.getState().clearRemoteSession()
            throw e
          }
        }
        return await runThroughDebugger(dbgRun, { blockType: type, ctx })
      }
      return await runner(ctx)
    } finally {
      if (progressFn) useMcpProgressStore.getState().clearProgress()
    }
  }
  return input
}

/**
 * Response block: build structured output from per-handle connected inputs.
 * Each typed input (data, status, headers) can be connected individually.
 * Fallback: if no per-handle input, use subBlock values or flat input.
 */
function runResponseNode({ values, input, inputsByHandle, outputs }) {
  const data = inputsByHandle?.data ?? (values.data ? interpolate(values.data, outputs, input) : input)
  const status = inputsByHandle?.status ?? (values.status ? Number(values.status) : 200)
  const headers = inputsByHandle?.headers ?? parseJsonSafe(values.headers)
  return { data, status, headers }
}

function parseJsonSafe(v) {
  if (v == null || v === '') return null
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return v }
}

/**
 * Attempt a direct browser-side LLM call using the model entry's apiKey + baseUrl.
 * Returns { output, model, ms } on success, or null if direct call is not configured
 * (in which case the caller falls back to the ck8t-server proxy).
 *
 * Supports:
 *  - OpenAI-compatible (OpenAI, LM Studio, Ollama w/ OpenAI compat, Groq, etc.):
 *      POST {baseUrl}/v1/chat/completions   Authorization: Bearer {apiKey}
 *  - Anthropic (provider key = 'anthropic' or model starts with 'claude-'):
 *      POST https://api.anthropic.com/v1/messages   x-api-key: {apiKey}
 *  - Local no-auth (Ollama native, LM Studio w/o key): baseUrl present, apiKey absent
 *
 * The VS Code extension bridge always proxies through its local Express server, so
 * Copilot models never reach this function (no apiKey/baseUrl on their store entries).
 */

/**
 * Unified LLM call helper used by all agent-like nodes (agent, ai_classifier, router_v2).
 *
 * Flow:
 *   1. Look up modelEntry from llmState (may or may not have apiKey/baseUrl).
 *   2. Try a direct browser → LLM API call.
 *   3. If that fails (no credentials on model entry), look up the provider that
 *      owns this model directly from useBrowserProvidersStore — the authoritative
 *      source of apiKey/chatUrl — and try again with a synthetic model entry.
 *   4. If still no direct path AND ck8t-server is available → route through
 *      ck8t-server (→ Spring Boot). Never talk to Spring Boot directly.
 *   5. If ck8t-server also offline → throw a friendly browser-mode error.
 */
async function callLlmWithFallback(agent, inputStr, nodeTitle) {
  let directResult = null
  const debugScope = `[ck8t][llm-fallback][${nodeTitle || agent.id}]`
  const fallbackDebug = {
    nodeTitle: nodeTitle || agent.id,
    model: agent.model,
    requestedProvider: agent.provider || null,
    attempts: [],
  }
  const pushAttempt = (entry) => {
    fallbackDebug.attempts.push({ at: new Date().toISOString(), ...entry })
  }
  const withFallbackDebug = (err) => {
    if (err && typeof err === 'object') {
      err.errorDetail = { ...(err.errorDetail || {}), llmFallback: fallbackDebug }
      err.llmFallback = fallbackDebug
    }
    return err
  }
  const hasProviderKey = Boolean(agent.provider)
  console.info(debugScope, {
    step: 'start',
    model: agent.model,
    provider: agent.provider || null,
    hasProviderKey,
  })
  pushAttempt({
    step: 'start',
    model: agent.model,
    provider: agent.provider || null,
    hasProviderKey,
  })

  // ── Attempt 1: browser providers store (always authoritative for browser mode)
  try {
    const bps = useBrowserProvidersStore.getState()
    await bps.hydrate()
    // Prefer exact provider-key match first (agent.provider), then model membership.
    // This avoids false negatives when cachedModels is stale/empty but provider creds exist.
    const owningProvider =
      bps.providers.find((p) => p.key === agent.provider) ||
      bps.providers.find((p) => Array.isArray(p.cachedModels) && p.cachedModels.includes(agent.model))
    console.info(debugScope, {
      step: 'attempt1_browser_store_match',
      matchedProviderKey: owningProvider?.key || null,
      providerType: owningProvider?.type || null,
      hasApiKey: Boolean(owningProvider?.apiKey),
      hasChatUrl: Boolean(owningProvider?.chatUrl),
      providersCount: Array.isArray(bps.providers) ? bps.providers.length : 0,
    })
    pushAttempt({
      step: 'attempt1_browser_store_match',
      matchedProviderKey: owningProvider?.key || null,
      providerType: owningProvider?.type || null,
      hasApiKey: Boolean(owningProvider?.apiKey),
      hasChatUrl: Boolean(owningProvider?.chatUrl),
      providersCount: Array.isArray(bps.providers) ? bps.providers.length : 0,
    })
    if (owningProvider) {
      let baseUrl = ''
      if (owningProvider.chatUrl) {
        try { baseUrl = new URL(owningProvider.chatUrl).origin } catch { baseUrl = '' }
      }
      directResult = await tryDirectLlmCall(agent, {
        id:           agent.model,
        provider:     owningProvider.key,
        providerType: owningProvider.type || 'openai',
        apiKey:       owningProvider.apiKey  || undefined,
        baseUrl:      baseUrl               || undefined,
        chatUrl:      owningProvider.chatUrl || undefined,
      })
      console.info(debugScope, {
        step: 'attempt1_browser_store_result',
        directResult: directResult ? 'success' : 'null',
      })
      pushAttempt({
        step: 'attempt1_browser_store_result',
        directResult: directResult ? 'success' : 'null',
      })
    }
  } catch (e) {
    const msg = e?.message || String(e)
    // Provider returned a real HTTP error (e.g. 400 validation): do not mask it.
    if (/^(LLM|Anthropic)\s\d+:/.test(msg)) throw withFallbackDebug(e)
    console.warn(debugScope, {
      step: 'attempt1_browser_store_error',
      message: msg,
    })
    pushAttempt({ step: 'attempt1_browser_store_error', message: msg })
  }

  // ── Attempt 2: llm-config-store model entry (server mode fast path) ───────
  if (directResult === null) {
    const modelEntry = useLlmConfigStore.getState().models.find((m) => m.id === agent.model)
    console.info(debugScope, {
      step: 'attempt2_llm_store_match',
      matchedProviderKey: modelEntry?.provider || null,
      providerType: modelEntry?.providerType || null,
      hasApiKey: Boolean(modelEntry?.apiKey),
      hasBaseUrl: Boolean(modelEntry?.baseUrl),
      hasChatUrl: Boolean(modelEntry?.chatUrl),
    })
    pushAttempt({
      step: 'attempt2_llm_store_match',
      matchedProviderKey: modelEntry?.provider || null,
      providerType: modelEntry?.providerType || null,
      hasApiKey: Boolean(modelEntry?.apiKey),
      hasBaseUrl: Boolean(modelEntry?.baseUrl),
      hasChatUrl: Boolean(modelEntry?.chatUrl),
    })
    try {
      directResult = await tryDirectLlmCall(agent, modelEntry)
      console.info(debugScope, {
        step: 'attempt2_llm_store_result',
        directResult: directResult ? 'success' : 'null',
      })
      pushAttempt({
        step: 'attempt2_llm_store_result',
        directResult: directResult ? 'success' : 'null',
      })
    } catch (e) {
      const msg = e?.message || String(e)
      // Provider returned a real HTTP error (e.g. 400 validation): do not mask it.
      if (/^(LLM|Anthropic)\s\d+:/.test(msg)) throw withFallbackDebug(e)
      console.warn(debugScope, {
        step: 'attempt2_llm_store_error',
        message: msg,
      })
      pushAttempt({ step: 'attempt2_llm_store_error', message: msg })
    }
  }

  // ── Attempt 3: proxy through ck8t-server → Spring Boot ───────────────────
  if (directResult === null) {
    const serverUp = await detectServer()
    console.info(debugScope, {
      step: 'attempt3_server_proxy_gate',
      serverUp,
    })
    pushAttempt({ step: 'attempt3_server_proxy_gate', serverUp })
    if (!serverUp) {
      throw withFallbackDebug(new Error(
        `No API key or base URL configured for "${nodeTitle || agent.id}" (model: ${agent.model}).\n` +
        'In browser mode, open Settings → Custom LLM Providers and add a provider with an API key.'
      ))
    }
    const proxied = await runAgent({ agent, input: inputStr })
    pushAttempt({ step: 'attempt3_server_proxy_result', directResult: 'server' })
    return { response: proxied, debug: fallbackDebug }
  }
  return { response: directResult, debug: fallbackDebug }
}

// Adapter: turns callLlmWithFallback into the callAgent({ agent, input }) → { output } interface
// expected by canonical block runners.
function _makeCallAgent(nodeTitle) {
  return async ({ agent, input }) => {
    const { response: res } = await callLlmWithFallback(agent, String(input ?? ''), nodeTitle)
    return { output: String(res?.output ?? res) }
  }
}

function buildRunCtx({ node, values, input, outputs, inputsByHandle, allNodes, subBlockValues }) {
  const nodeId = node.id
  const nodeTitle = node.data?.title || nodeId
  return {
    values, input, inputsByHandle, outputs,
    node, nodeId, nodeTitle, subBlockValues, allNodes,
    callTool: callMcpTool,
    callAgent: _makeCallAgent(nodeTitle),
    callLlm: (agent, inputStr, title) => callLlmWithFallback(agent, inputStr, title ?? nodeTitle),
    resolveModel: (modelId, provider) => {
      const model = String(modelId || useLlmConfigStore.getState().getDefaultModel() || useLlmConfigStore.getState().models[0]?.id || '')
      return { model, provider: provider || '' }
    },
    getSkill: (id) => useWorkspaceStore.getState().skills?.find(s => s.id === id || s.name === id) ?? null,
    runSkill: (skill, inputStr) => runSkillSource(skill, inputStr),
    vsApi: (typeof window !== 'undefined' && window.__CK8T_VSCODE_API__) || null,
    progress: null,
  }
}

async function tryDirectLlmCall(agent, modelEntry) {
  if (!modelEntry) return null

  const { apiKey, baseUrl, provider, providerType } = modelEntry
  const effectiveType = providerType || provider || ''

  // No baseUrl and no apiKey → not configured for direct calls → use server
  if (!baseUrl && !apiKey) return null

  const t0 = Date.now()
  const model = agent.model

  // ── Anthropic ──────────────────────────────────────────────────────────
  if (effectiveType === 'anthropic' || model.startsWith('claude-')) {
    if (!apiKey) return null // Anthropic always needs a key
    const body = {
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: agent.userPrompt }],
    }
    if (agent.systemPrompt) body.system = agent.systemPrompt
    if (agent.temperature != null) body.temperature = agent.temperature

    const res = await fetch((baseUrl ? `${baseUrl.replace(/\/$/, '')}/v1/messages` : 'https://api.anthropic.com/v1/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return { output: data.content?.map((c) => c.text).join('') ?? '', model, ms: Date.now() - t0 }
  }

  // ── OpenAI-compatible (OpenAI, LM Studio, Ollama /v1, Grok, Mistral, DeepSeek, Gemini, Qwen …) ──
  // Use the stored chatUrl directly when present — needed for providers whose path
  // differs from /v1/chat/completions (e.g. Gemini: /v1beta/openai/chat/completions,
  // Qwen: /compatible-mode/v1/chat/completions).
  const chatUrl = modelEntry.chatUrl ||
    (baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions')

  const messages = []
  if (agent.systemPrompt) messages.push({ role: 'system', content: agent.systemPrompt })
  messages.push({ role: 'user', content: agent.userPrompt })

  const body = { model, messages }
  if (agent.temperature != null) body.temperature = agent.temperature
  if (agent.responseFormat && agent.strictOutput) {
    try {
      const schema = typeof agent.responseFormat === 'string' ? JSON.parse(agent.responseFormat) : agent.responseFormat
      body.response_format = { type: 'json_schema', json_schema: { name: 'response', strict: true, schema } }
    } catch { /* ignore */ }
  } else if (agent.responseFormat) {
    body.response_format = { type: 'json_object' }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(chatUrl, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const output = data.choices?.[0]?.message?.content ?? ''
  return { output, model, ms: Date.now() - t0 }
}

async function runAgentNode({ node, values, input }) {
  let inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '')
  const skillRuns = [] // each: { skillId, name, params, output, error }

  // ─── Client-side skill execution ────────────────────────────────────────
  // Skills in convengine are small JS functions stored in the workspace. The
  // backend currently doesn't wire them into LLM tool-calling, so we run any
  // attached skill here in the browser and feed the skill's output as the
  // agent's input. That's how the demo ("URL → extract → summarize") works
  // end-to-end without asking the LLM to hallucinate page content.
  //
  // `values.skills` (new field) or legacy `values.tools` — both are JSON
  // arrays of skill ids. The first skill whose id resolves gets run on the
  // current input.
  const skillIds = [
    ...(safeJsonArray(values.skills)),
    ...(safeJsonArray(values.tools)),
  ]
  /**
   * `bag` holds every field the userPrompt's `{{foo}}` templates can reference.
   * Seeded with the raw input, then each skill output (if object-shaped) is
   * merged in. The summarizer's prompt uses `{{title}}` and `{{text}}`; the
   * extractor's prompt uses `{{url}}` — none of which were previously
   * substituted, which is why the LLM saw literal `{{url}}` and replied
   * "No URL provided."
   */
  const bag = looksLikeUrl(inputStr) ? { url: inputStr, input: inputStr } : { input: inputStr }
  // When the upstream output is a JSON object string, merge its keys into
  // the bag so that templates like {{title}}, {{text}}, etc. resolve.
  // This is what lets the Summarizer's `{{title}}` and `{{text}}` pick up
  // fields from the Extractor's JSON output.
  try {
    const parsed = JSON.parse(inputStr)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) bag[k] = v
    }
  } catch { /* not JSON — that's fine, bag already has `input` */ }
  if (skillIds.length > 0) {
    const skills = useWorkspaceStore.getState().skills || []
    for (const sid of skillIds) {
      const skill = skills.find((s) => s.id === sid)
      if (!skill) continue
      const params = looksLikeUrl(inputStr) ? { url: inputStr, input: inputStr } : { input: inputStr }
      try {
        const out = await runSkillSource(skill, inputStr)
        inputStr = typeof out === 'string' ? out : JSON.stringify(out)
        if (out && typeof out === 'object' && !Array.isArray(out)) {
          for (const [k, v] of Object.entries(out)) bag[k] = v
        }
        bag.input = inputStr
        skillRuns.push({ skillId: sid, name: skill.name, params, output: out })
      } catch (e) {
        inputStr = JSON.stringify({ skillError: e.message || String(e), input: inputStr })
        bag.skillError = e.message || String(e)
        bag.input = inputStr
        skillRuns.push({
          skillId: sid,
          name: skill.name,
          params,
          error: e.message || String(e),
          errorDetail: e?.errorDetail || null,
        })
      }
    }
  }

  // Resolve model & provider — the node's own fields always win. But a stored
  // `values.model` can be stale (e.g. typed/left over from before the
  // provider was switched) — once the provider is known, validate the model
  // against THAT provider's own curated list (ai-providers-store) and replace
  // it with that provider's default/first model if it doesn't actually
  // belong there, instead of sending garbage straight to the chat API.
  const llmState = useLlmConfigStore.getState()
  const availableModelIds = llmState.models.map((m) => m.id)
  const resolvedProvider =
    values.provider ||
    llmState.getProviderForModel(values.model) ||
    llmState.getDefaultProvider() ||
    llmState.activeProvider ||
    undefined

  let resolvedModel = values.model || llmState.getDefaultModel() || (availableModelIds[0] ?? null)
  const providerModels = resolvedProvider ? getAiProviderModelOptions(resolvedProvider) : []
  if (providerModels.length > 0) {
    if (!providerModels.some((m) => m.id === resolvedModel)) {
      const aiState = useAiProvidersStore.getState()
      resolvedModel = (aiState.defaultProviderId === resolvedProvider && aiState.defaultModelId) || providerModels[0].id
    }
  } else if (!availableModelIds.includes(resolvedModel)) {
    resolvedModel = llmState.getDefaultModel() || resolvedModel
  }

  if (!resolvedModel) {
    const nodeTitle = node.data?.title || node.id
    throw new GraphValidationError(
      `No model provider configured for "${nodeTitle}"`,
      {
        nodeId: node.id,
        nodeTitle,
        blockType: 'agent',
        cause: 'The LLM config store has no models loaded. The /ck8t/llm/providers endpoint returned no models or did not respond.',
        hint: 'Open Settings → LLM Provider Configuration, ensure the backend is running and returning models, then select a default model.',
        severity: 'error',
      }
    )
  }

  // Build memory config — only included when memoryType is non-empty and not 'none'
  const memoryType = values.memoryType || 'none'
  const memoryConfig = memoryType !== 'none' ? (() => {
    const cfg = { type: memoryType }
    if (values.conversationId) cfg.conversationId = values.conversationId
    if (memoryType === 'sliding_window' && values.slidingWindowSize) {
      cfg.windowSize = parseInt(values.slidingWindowSize, 10) || undefined
    }
    if (memoryType === 'sliding_window_tokens' && values.slidingWindowTokens) {
      cfg.maxTokens = parseInt(values.slidingWindowTokens, 10) || undefined
    }
    return cfg
  })() : null

  const agent = {
    id: node.id,
    provider: resolvedProvider,
    model: resolvedModel,
    temperature: values.temperature,
    systemPrompt: interpolateBag(values.systemPrompt || '', bag),
    userPrompt: interpolateBag(values.userPrompt || '{{input}}', bag),
    responseFormat: values.responseFormat || null,
    strictOutput: values.strictOutput === true,
    skills: skillIds,
    ...(memoryConfig ? { memory: memoryConfig } : {}),
  }

  // When skills ran and produced output, the backend only sees systemPrompt +
  // userPrompt (it ignores the `input` field). Auto-append skill output to
  // userPrompt so the LLM actually receives the extracted data.
  if (skillRuns.length > 0 && skillRuns.some((sr) => sr.output != null)) {
    const resolvedPrompt = agent.userPrompt
    // Only append if the userPrompt doesn't already contain the skill output
    // (i.e. it wasn't referenced via {{input}}, {{text}}, etc.)
    const skillOutputStr = typeof inputStr === 'string' ? inputStr : JSON.stringify(inputStr)
    if (!resolvedPrompt.includes(skillOutputStr.slice(0, 40))) {
      agent.userPrompt = resolvedPrompt + '\n\n--- Skill Output ---\n' + skillOutputStr
    }
  }

  const llmRequest = { agent, input: inputStr }

  // ─── Direct browser-side LLM call ───────────────────────────────────────
  // When the active model entry in the store has apiKey + baseUrl (or is a
  // local no-auth provider like Ollama / LM Studio), call the LLM API directly
  // from the browser without going through ck8t-server / convengine-demo.
  // ─── Direct browser-side LLM call with ck8t-server fallback ─────────────
  // Uses callLlmWithFallback: tries direct API call first, then routes through
  // ck8t-server (→ Spring Boot) if available, throws friendly error if offline.
  const nodeTitle = node.data?.title || node.id
  const { response: res, debug: llmFallback } = await callLlmWithFallback(agent, inputStr, nodeTitle)
  return {
    __meta: {
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt,
      userPrompt: agent.userPrompt,
      memory: memoryConfig,
      skillIds,
      skillRuns,
      templateBag: bag,
      rawAgentResponse: res,
      llmRequest,
      llmResponse: res,
      llmFallback,
    },
    value: {
      data: res.output,
      status: 200,
      headers: { 'x-model': res.model, 'x-duration-ms': res.ms },
    },
  }
}

/**
 * Execute a workspace skill's JS source string with a single `params` arg.
 * The demo `sk_url_extract` expects `{ url }`, so we shape input into that
 * form when the upstream is a URL-like string. For anything else we pass
 * `{ input }` and let the skill destructure whatever it needs.
 */
/**
 * In the VSCode extension webview, `fetch()` is CSP-blocked for external
 * URLs. We inject a bridge-aware fetch that tunnels GET requests through
 * the Node.js bridge server proxy endpoint instead of going direct.
 *
 * Non-extension (Vite dev / browser) context: returns the native fetch so
 * skills work identically outside the extension.
 */
function buildSkillFetchError(url, opts, err, extra = {}) {
  const message = err?.message || String(err)
  const rich = new Error(`Failed to fetch ${url}`)
  rich.cause = err
  rich.url = url
  rich.method = (opts?.method || 'GET').toUpperCase()
  rich.errorDetail = {
    message: rich.message,
    cause: message,
    hint: extra.mode === 'browser-direct'
      ? 'Cross-origin fetch blocked in browser mode. Start ck8t-server to use the proxy for web scraping skills.'
      : 'Skill fetch failed before a response was received.',
    skillFetch: {
      mode: extra.mode || 'unknown',
      requestedUrl: url,
      method: rich.method,
      proxyUrl: extra.proxyUrl || null,
      proxyBase: extra.proxyBase || null,
      browserMode: extra.mode === 'browser-direct',
      failure: message,
    },
  }
  return rich
}

export function makeSkillFetch() {
  const base = typeof window !== 'undefined' && window.__CK8T_BRIDGE_BASE__
    ? window.__CK8T_BRIDGE_BASE__
    : null

  if (!base) {
    if (typeof fetch === 'undefined') return undefined
    return async function skillFetch(url, opts = {}) {
      try {
        return await fetch(url, opts)
      } catch (err) {
        throw buildSkillFetchError(url, opts, err, { mode: 'browser-direct' })
      }
    }
  }

  return async function skillFetch(url, opts = {}) {
    // Only proxy absolute http(s) URLs; relative paths or data: URIs pass through.
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      if ((opts.method || 'GET').toUpperCase() === 'GET') {
        // Simple GET — use the query-param proxy endpoint
        // base already contains /api/v1 (e.g. http://127.0.0.1:PORT/api/v1)
        const proxyUrl = `${base}/ck8t/proxy?url=${encodeURIComponent(url)}`
        let r
        try {
          r = await window.fetch(proxyUrl)
        } catch (err) {
          throw buildSkillFetchError(url, opts, err, { mode: 'proxy-get', proxyUrl, proxyBase: base })
        }
        return {
          ok: r.ok,
          status: r.status,
          headers: r.headers,
          text: () => r.text(),
          json: () => r.json(),
          arrayBuffer: () => r.arrayBuffer(),
        }
      } else {
        // POST / custom method — use the body-based proxy endpoint
        const proxyUrl = `${base}/ck8t/proxy`
        let r
        try {
          r = await window.fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              method: opts.method || 'POST',
              headers: opts.headers || {},
              body: opts.body,
            }),
          })
        } catch (err) {
          throw buildSkillFetchError(url, opts, err, { mode: 'proxy-post', proxyUrl, proxyBase: base })
        }
        return {
          ok: r.ok,
          status: r.status,
          headers: r.headers,
          text: () => r.text(),
          json: () => r.json(),
          arrayBuffer: () => r.arrayBuffer(),
        }
      }
    }
    try {
      return await window.fetch(url, opts)
    } catch (err) {
      throw buildSkillFetchError(url, opts, err, { mode: 'browser-direct' })
    }
  }
}

export async function runSkillSource(skill, inputStr, { debugLog } = {}) {
  let params
  if (looksLikeUrl(inputStr)) {
    params = { url: inputStr, input: inputStr }
  } else {
    // If inputStr is a JSON object, spread all its keys into params so skills
    // can access params.url, params.query, etc. directly (not just params.input).
    try {
      const parsed = JSON.parse(inputStr)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        params = { input: inputStr, ...parsed }
      } else {
        params = { input: inputStr }
      }
    } catch {
      params = { input: inputStr }
    }
  }
  const skillFetch = makeSkillFetch()
  // eslint-disable-next-line no-new-func
  const fn = new Function('params', 'fetch', 'console', skill.source)
  const result = await fn(params, skillFetch, debugLog || console)
  return result
}

/**
 * Skill block executor — finds the selected skill by ID and runs it directly.
 * The skill receives { input: <upstream value> } as its params argument.
 * Returns { result, __meta: { skillId, skillName } } so the card preview
 * and InspectModal show the raw skill output under the `result` key.
 */
async function runSkillNode({ values, input }) {
  const skillId = values.skillId
  if (!skillId) throw new Error('Skill block: no skill selected. Choose a skill from the dropdown.')
  const skills = useWorkspaceStore.getState().skills || []
  const skill = skills.find((s) => s.id === skillId)
  if (!skill) throw new Error(`Skill block: skill with id "${skillId}" not found in workspace.`)
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? null)
  const result = await runSkillSource(skill, inputStr)
  return {
    __meta: { skillId: skill.id, skillName: skill.name, input },
    value: result,
  }
}

/**
 * Substitute every `{{key}}` in `template` with `bag[key]`. Stringifies
 * object values so the LLM gets readable JSON. Leaves unresolved tokens
 * untouched so authors can spot template typos in the log.
 */
function interpolateBag(template, bag) {
  if (!template) return ''
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
    if (!(k in bag)) return m
    const v = bag[k]
    if (v == null) return ''
    return typeof v === 'string' ? v : JSON.stringify(v)
  })
}

function looksLikeUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

function safeJsonArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v !== 'string') return []
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
}

/**
 * Invoke an MCP tool via the convengine backend.
 *
 * The `mcp` block has three subBlock values:
 *   - `server`     — server id selected in the dropdown (from /api/v1/mcp/servers)
 *   - `tool`       — tool name on that server
 *   - `arguments`  — JSON-string (from the JsonEditor) matching the tool's
 *                    inputSchema; we also substitute `{{input}}` with the
 *                    upstream output so a preceding block's text can flow into
 *                    a tool call.
 *
 * Returns whatever the server returns under `result` (typically an MCP
 * content array like `[{ type: 'text', text: '...' }, ...]`).
 */
async function runMcpNode({ values, input }) {
  const serverId = values.server
  const tool = values.tool
  if (!serverId) throw new Error('MCP block: no server selected')
  if (!tool) throw new Error('MCP block: no tool selected')

  // `input` is whatever the upstream node produced — use it directly as tool args.
  let args = {}
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    args = input
  } else if (typeof input === 'string' && input.trim()) {
    try { args = JSON.parse(input) } catch { args = {} }
  }

  const resp = await callMcpTool(serverId, tool, args)
  return resp?.result
}

function runFunctionNode({ values, input, nodeId }) {
  const src = values.code || 'return input'
  const logs = []
  const capture = {
    log:   (...a) => logs.push({ level: 'log',   msg: a.map(serializeArg).join(' ') }),
    info:  (...a) => logs.push({ level: 'info',  msg: a.map(serializeArg).join(' ') }),
    warn:  (...a) => logs.push({ level: 'warn',  msg: a.map(serializeArg).join(' ') }),
    error: (...a) => logs.push({ level: 'error', msg: a.map(serializeArg).join(' ') }),
    debug: (...a) => logs.push({ level: 'debug', msg: a.map(serializeArg).join(' ') }),
  }
  const t0 = performance.now()
  // eslint-disable-next-line no-new-func
  const fn = new Function('input', 'values', 'console', src)
  let output, err
  try {
    output = fn(input, values, capture)
  } catch (e) {
    err = e
  }
  const durationMs = Math.round(performance.now() - t0)
  // Store debug snapshot when this block has debug mode enabled
  if (nodeId && useBlockDebugStore.getState().isDebugEnabled(nodeId)) {
    useBlockDebugStore.getState().setSnapshot(nodeId, {
      input, output: err ? undefined : output, consoleLogs: logs,
      error: err ? err.message : null, durationMs, values,
      executedAt: new Date().toISOString(),
      breakpoints: useBlockDebugStore.getState().breakpoints[nodeId] || [],
    })
  }
  if (err) throw err
  return output
}

function serializeArg(a) {
  if (typeof a === 'string') return a
  try { return JSON.stringify(a) } catch { return String(a) }
}

function runIfElseNode({ values, input }) {
  // `expression` is authored in the Inspector; legacy canvases used `condition`.
  const expr = values.expression || values.condition || 'true'
  const truthy = !!eval_safe(expr, input)
  return { branch: truthy ? 'true' : 'false', value: input }
}

/**
 * Walk the `conditions` table top-to-bottom; first truthy row picks the
 * corresponding `branch_<i>` handle. Falls through to `else` if nothing matches.
 * Row shape is either `{ label, expression }` (from the Inspector table) or
 * `[label, expression]` (raw tuple).
 */
function runIfElseIfElseNode({ values, input }) {
  const rows = Array.isArray(values.conditions) ? values.conditions : []
  const n = Math.max(1, Math.min(8, Number(values.branches) || rows.length || 2))
  for (let i = 0; i < n; i++) {
    const row = rows[i]
    if (!row) continue
    const expr = row.expression ?? row[1]
    if (!expr) continue
    if (eval_safe(expr, input)) {
      return { branch: `branch_${i + 1}`, value: input }
    }
  }
  return { branch: 'else', value: input }
}

function runSwitchNode({ values, input }) {
  const keyVal = values.keyExpr ? eval_safe(values.keyExpr, input) : input
  const key = String(keyVal)
  const cases = Array.isArray(values.cases) ? values.cases : []
  const n = Math.max(1, Math.min(12, Number(values.caseCount) || cases.length || 3))
  for (let i = 0; i < Math.min(n, cases.length); i++) {
    const c = cases[i]
    const match = c.value ?? c.match ?? c[0]
    if (match != null && String(match) === key) {
      return { branch: `case_${i + 1}`, value: input }
    }
  }
  return { branch: 'default', value: input }
}

/**
 * Sniff magic bytes of a raw (unprefixed) base64 string to detect PNG/JPEG/GIF/PDF.
 * Only decodes the first 16 chars — fast, no full decode.
 */
function detectBase64MimeBySignature(str) {
  if (typeof str !== 'string' || str.length < 16 || /\s/.test(str.slice(0, 24))) return null
  if (!/^[A-Za-z0-9+/]+=*$/.test(str.slice(0, 24))) return null
  let bytes
  try {
    const head = atob(str.slice(0, 16))
    bytes = Array.from(head, (c) => c.charCodeAt(0))
  } catch { return null }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf'
  return null
}

/**
 * Extract a data-URI (image or PDF) embedded anywhere in a block output.
 * Handles: direct data-URI string, raw unprefixed base64 (magic-byte sniffed),
 * markdown ![...](data:...), MCP content arrays, and objects with image fields.
 * Returns { dataUri, mimeType } or null.
 */
export function extractMediaUri(value) {
  if (!value) return null
  if (typeof value === 'string') {
    // Inline data URI
    const m = value.match(/data:(image\/[^;,]+|application\/pdf);base64,([A-Za-z0-9+/=\n]+)/)
    if (m) return { dataUri: m[0].replace(/\s/g, ''), mimeType: m[1] }
    // Markdown image embedding: ![alt](data:...)
    const md = value.match(/!\[[^\]]*\]\((data:(?:image\/[^);]+|application\/pdf);base64,[A-Za-z0-9+/=\n]+)\)/)
    if (md) return extractMediaUri(md[1])
    // Raw unprefixed base64 — sniff magic bytes (cuda_id4_generate, storybook_pdf, etc.)
    const sniffed = detectBase64MimeBySignature(value.trim())
    if (sniffed) return { dataUri: `data:${sniffed};base64,${value.trim()}`, mimeType: sniffed }
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      // MCP image content item: {type:'image', data:'...', mimeType:'image/png'}
      if (item?.type === 'image' && item.data)
        return { dataUri: `data:${item.mimeType ?? 'image/png'};base64,${item.data}`, mimeType: item.mimeType ?? 'image/png' }
      // MCP text item containing embedded data URI
      if (item?.type === 'text' && item.text) {
        const found = extractMediaUri(item.text)
        if (found) return found
      }
    }
    return null
  }
  if (typeof value === 'object') {
    // image_url_preview sentinel — renders external URL as <img> without download
    if (typeof value.__ck8t_image_url === 'string') {
      return { dataUri: value.__ck8t_image_url, mimeType: 'image/png', isExternalUrl: true }
    }
    // Objects with known image fields
    for (const k of ['image', 'image_data', 'imageData', 'base64', 'data', 'content', 'pdf', 'file']) {
      if (value[k]) { const r = extractMediaUri(value[k]); if (r) return r }
    }
  }
  return null
}

/**
 * base64 string → Uint8Array (handles whitespace-padded base64)
 */
function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0))
}

/**
 * Save-to-Files: optionally triggers a browser download with the upstream
 * payload, and always passes the payload through so downstream (or the
 * inline json-preview area on the card) can see it.
 * Supports JSON, raw text, PDF (base64 → binary), and binary (base64 → binary).
 */
function resolveFilenameTemplate(str) {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const date = now.toISOString().slice(0, 10)
  return str.replace(/\{\{timestamp\}\}/gi, ts).replace(/\{\{date\}\}/gi, date)
}

function runSaveToFiles({ values, input }) {
  const fmt = values.format || 'json'
  const defaultFilename = resolveFilenameTemplate((values.filename || '').trim() || 'output')
  const pathValue = resolveFilenameTemplate((values.path || '').trim())

  // Detect whether `path` is an output DIRECTORY (absolute/home path with no extension,
  // or ending with / or \). If so, combine with the filename sub-block for auto-save.
  const isOutputDir = pathValue && (
    pathValue.startsWith('~/') || pathValue.startsWith('/') ||
    /^[A-Za-z]:[/\\]/.test(pathValue) ||
    pathValue.endsWith('/') || pathValue.endsWith('\\')
  ) && !pathValue.split(/[/\\]/).pop().includes('.')

  // destPath: full auto-save path (no dialog). null = show dialog.
  const destPath = isOutputDir
    ? pathValue.replace(/[/\\]$/, '') + '/' + defaultFilename
    : null

  // filenameHint: what the save-dialog suggests when destPath is null
  const filenameHint = pathValue.replace(/^.*[\\/]/, '') || defaultFilename

  const result = { savedAt: null, bytes: 0, payload: input }

  const vsApi = typeof window !== 'undefined' && window.__CK8T_VSCODE_API__

  // Lightweight file-path sentinel — extension host copies from temp path,
  // avoiding any base64 encode/decode or large postMessage payloads.
  if (input && typeof input === 'object' && typeof input.__ck8t_file_path === 'string') {
    if (vsApi) vsApi.postMessage({ type: 'saveFile', payload: {
      filePath: input.__ck8t_file_path,
      filename: filenameHint,
      destPath,   // non-null → extension auto-saves without dialog
      format: fmt,
    }})
    return { ...result, savedAt: new Date().toISOString() }
  }

  // ── Determine blob / content ─────────────────────────────────────────────
  let blob = null
  let downloadName = filenameHint
  let b64ForVscode = null  // set when VS Code should write binary

  if (fmt === 'pdf' || fmt === 'binary') {
    // Try to extract a data URI from the input (MCP array, object, string)
    const media = extractMediaUri(input)
    if (media) {
      const ext = media.mimeType === 'application/pdf' ? '.pdf'
        : media.mimeType.replace('image/', '.')
      const b64 = media.dataUri.split(',')[1]
      const bytes = b64ToBytes(b64)
      blob = new Blob([bytes], { type: media.mimeType })
      result.bytes = bytes.length
      if (!downloadName.includes('.')) downloadName += ext
      b64ForVscode = b64
    } else if (typeof input === 'string' && /^[A-Za-z0-9+/]+=*$/.test(input.trim())) {
      // Raw base64 string — treat as the target format
      const mime = fmt === 'pdf' ? 'application/pdf' : 'application/octet-stream'
      const ext  = fmt === 'pdf' ? '.pdf' : '.bin'
      const bytes = b64ToBytes(input.trim())
      blob = new Blob([bytes], { type: mime })
      result.bytes = bytes.length
      if (!downloadName.includes('.')) downloadName += ext
      b64ForVscode = input.trim()
    }
  }

  if (!blob) {
    // Text / JSON fallback
    const body = fmt === 'raw' || typeof input === 'string'
      ? (typeof input === 'string' ? input : JSON.stringify(input))
      : JSON.stringify(input, null, 2)
    blob = new Blob([body], { type: fmt === 'raw' ? 'text/plain' : 'application/json' })
    result.bytes = body.length
    if (!downloadName.includes('.')) downloadName += fmt === 'raw' ? '.txt' : '.json'
  }

  // ── Trigger save ─────────────────────────────────────────────────────────
  if (pathValue || values.filename) {
    try {
      if (vsApi) {
        // VS Code extension: delegate to extension host (auto-save when destPath set)
        if (b64ForVscode) {
          vsApi.postMessage({ type: 'saveFile', payload: { filename: downloadName, content: b64ForVscode, format: fmt, destPath } })
        } else {
          blob.text().then((text) => {
            vsApi.postMessage({ type: 'saveFile', payload: { filename: downloadName, content: text, destPath } })
          })
        }
      } else {
        // Browser: <a download>
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadName
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
      }
      result.savedAt = path || downloadName
    } catch (e) {
      result.error = e.message || String(e)
    }
  }

  return input // pass-through so the preview area shows the actual payload
}

function runJsonValidator({ values, input }) {
  let parsed
  try { parsed = typeof input === 'string' ? JSON.parse(input) : input }
  catch { return { valid: false, errors: ['input is not valid JSON'] } }
  // Support rules as a JSON string (matches server behaviour)
  const rules = typeof values.rules === 'string'
    ? (() => { try { return JSON.parse(values.rules) } catch { return [] } })()
    : (Array.isArray(values.rules) ? values.rules : [])
  const errors = []
  for (const r of rules) {
    const path = r.path ?? r[0]
    const rule = r.rule ?? r[1]
    const expected = r.value ?? r[2]
    const got = jsonPath(parsed, path)
    if (rule === 'exists' && got === undefined) errors.push(`${path} missing`)
    if (rule === 'equals' && String(got) !== String(expected)) errors.push(`${path} !== ${expected}`)
    if (rule === 'type' && typeof got !== String(expected)) errors.push(`${path} not a ${expected}`)
  }
  return { valid: errors.length === 0, errors, value: parsed }
}

/* ------------------------------------------------------------------------- */
/* Server-parity block handlers (ported from graph-runner.ts)                */
/* ------------------------------------------------------------------------- */

const API_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Convert an ArrayBuffer to a base64 string without blowing the call stack on large images. */
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Full HTTP client block — url/method/headers/params/body/timeout/retries,
 * same templating the Agent block uses ({{input}} plus any flattened key
 * from the upstream JSON output), and binary-aware responses so an image API
 * (e.g. Ideogram) can feed straight into a preview node as a data URI.
 * Auth is just a header (Authorization / Api-Key / etc.) — exactly like
 * fetch/axios, no separate "auth" abstraction.
 */
async function runApiNode({ values, input, inputsByHandle }) {
  const method = String(values.method || 'GET').toUpperCase()

  // Same bag-based templating as runAgentNode's userPrompt: {{input}} plus
  // every top-level key when the upstream output is a JSON object, so e.g.
  // {{prompt}} from a magic-prompt API's JSON response can be referenced
  // directly in the next API call's url/body/headers.
  const inputStr = input !== undefined ? (typeof input === 'string' ? input : JSON.stringify(input ?? '')) : ''
  const bag = { input: inputStr }
  try {
    const parsed = JSON.parse(inputStr)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [k, v] of Object.entries(parsed)) bag[k] = v
    }
  } catch { /* not JSON — {{input}} is still available */ }
  const substitute = (s) => typeof s === 'string' ? interpolateBag(s, bag) : s

  let url = substitute(String(values.url || ''))
  // Allow a directly-wired node to supply the full URL
  if (inputsByHandle && inputsByHandle.url != null) {
    url = String(inputsByHandle.url)
  }

  let params = Array.isArray(values.params) ? values.params : []
  if (typeof values.params === 'string') { try { params = JSON.parse(values.params) } catch { params = [] } }
  if (params.length > 0) {
    const qs = params.filter((p) => p.Key).map((p) => encodeURIComponent(p.Key) + '=' + encodeURIComponent(substitute(String(p.Value ?? '')))).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  let headerEntries = Array.isArray(values.headers) ? values.headers : []
  if (typeof values.headers === 'string') {
    try {
      const parsed = JSON.parse(values.headers)
      if (Array.isArray(parsed)) {
        headerEntries = parsed
      } else if (parsed && typeof parsed === 'object') {
        // Plain object format {"Content-Type": "application/json"} → convert to row array
        headerEntries = Object.entries(parsed).map(([Key, Value]) => ({ Key, Value }))
      }
    } catch { headerEntries = [] }
  }
  const headers = {}
  for (const h of headerEntries) { if (h.Key) headers[h.Key] = substitute(String(h.Value ?? '')) }

  // ── Authorization ───────────────────────────────────────────────────────────
  const authType = String(values.authorization || 'none')
  if (authType === 'bearer' && values.authToken) {
    const token = substitute(String(values.authToken))
    if (token && !headers['Authorization'] && !headers['authorization'])
      headers['Authorization'] = `Bearer ${token}`
  } else if (authType === 'api_key' && values.authApiKeyName && values.authApiKeyValue) {
    const keyName = substitute(String(values.authApiKeyName))
    const keyValue = substitute(String(values.authApiKeyValue))
    const keyIn = String(values.authApiKeyIn || 'header')
    if (keyName && keyValue) {
      if (keyIn === 'query') {
        url += (url.includes('?') ? '&' : '?') + encodeURIComponent(keyName) + '=' + encodeURIComponent(keyValue)
      } else if (!headers[keyName]) {
        headers[keyName] = keyValue
      }
    }
  } else if (authType === 'basic' && values.authUsername) {
    const creds = btoa(`${substitute(String(values.authUsername))}:${substitute(String(values.authPassword || ''))}`)
    if (!headers['Authorization'] && !headers['authorization'])
      headers['Authorization'] = `Basic ${creds}`
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const contentTypeVal = String(values.contentType || 'application/json')
  let body
  if (method !== 'GET' && method !== 'HEAD' && contentTypeVal !== 'none') {
    if (contentTypeVal === 'multipart/form-data') {
      let formRows = Array.isArray(values.bodyFormData) ? values.bodyFormData : []
      if (typeof values.bodyFormData === 'string') { try { formRows = JSON.parse(values.bodyFormData) } catch { formRows = [] } }
      if (formRows.length > 0) {
        const fd = new FormData()
        for (const row of formRows) {
          if (row[0]) fd.append(substitute(String(row[0])), substitute(String(row[1] ?? '')))
        }
        body = fd
        // Let browser set Content-Type with the multipart boundary — remove any manual override
        delete headers['Content-Type']
        delete headers['content-type']
      }
    } else if (contentTypeVal === 'application/x-www-form-urlencoded') {
      let formRows = Array.isArray(values.bodyFormData) ? values.bodyFormData : []
      if (typeof values.bodyFormData === 'string') { try { formRows = JSON.parse(values.bodyFormData) } catch { formRows = [] } }
      const qp = new URLSearchParams()
      for (const row of formRows) {
        if (row[0]) qp.append(substitute(String(row[0])), substitute(String(row[1] ?? '')))
      }
      body = qp.toString()
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else if (contentTypeVal === 'text/plain') {
      const rawText = substitute(String(values.bodyText || ''))
      if (rawText.trim()) {
        body = rawText
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'text/plain'
      }
    } else {
      // application/json (default) — keep existing priority behaviour
      if (inputsByHandle && inputsByHandle.body != null) {
        const wb = inputsByHandle.body
        body = typeof wb === 'string' ? wb : JSON.stringify(wb)
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
      } else if (inputsByHandle && inputsByHandle.input != null) {
        const wi = inputsByHandle.input
        body = typeof wi === 'string' ? wi : JSON.stringify(wi)
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
      } else {
        const rawBody = substitute(values.body)
        if (typeof rawBody === 'string' && rawBody.trim()) {
          body = rawBody
          if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
        }
      }
    }
  }

  const timeoutMs = Number(values.timeout) > 0 ? Number(values.timeout) : 300_000
  const maxRetries = Math.max(0, Number(values.retries) || 0)
  const retryDelayMs = Number(values.retryDelayMs) > 0 ? Number(values.retryDelayMs) : 500
  const retryMaxDelayMs = Number(values.retryMaxDelayMs) > 0 ? Number(values.retryMaxDelayMs) : 30_000
  const canRetry = API_IDEMPOTENT_METHODS.has(method) || values.retryNonIdempotent === true

  const attemptFetch = async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const resp = await fetch(url, { method, headers, body, signal: controller.signal })
      const contentType = resp.headers.get('content-type') || ''
      let data
      if (contentType.includes('application/json')) {
        data = await resp.json()
      } else if (/^image\//.test(contentType) || contentType === 'application/octet-stream' || contentType === 'application/pdf') {
        // Binary response — surface it as a data URI so a preview node can
        // pick it straight up via extractMediaUri(), same as MCP image content.
        const buf = await resp.arrayBuffer()
        data = `data:${contentType};base64,${arrayBufferToBase64(buf)}`
      } else {
        data = await resp.text()
      }
      const respHeaders = {}
      resp.headers.forEach((v, k) => { respHeaders[k] = v })
      return { data, status: resp.status, headers: respHeaders, ok: resp.ok }
    } finally {
      clearTimeout(timer)
    }
  }

  let lastErr = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await attemptFetch()
      // Retry on server errors (5xx) just like a typical axios retry interceptor;
      // 4xx is a client error and won't be fixed by retrying.
      if (!result.ok && result.status >= 500 && attempt < maxRetries && canRetry) {
        lastErr = new Error(`HTTP ${result.status}`)
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      const { ok, ...rest } = result
      return rest
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries && canRetry) {
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      break
    }
  }
  const message = lastErr?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (lastErr?.message || 'Request failed')
  return { data: null, status: 0, headers: {}, error: message }
}

// ── Image URL utilities ────────────────────────────────────────────────────────

function _extractImageUrl(val) {
  if (!val) return null
  if (typeof val === 'string') return val.trim() || null
  if (typeof val !== 'object') return null
  // Ideogram response passed through api block's "data" handle:
  //   api output.data = { data: [{ url }], response_type: "url" }
  if (Array.isArray(val.data) && val.data.length > 0 && typeof val.data[0]?.url === 'string')
    return val.data[0].url
  // Full api block output (when "out" handle is used instead of "data"):
  //   { data: { data: [{ url }] }, status, headers }
  if (val.data && Array.isArray(val.data?.data) && typeof val.data.data[0]?.url === 'string')
    return val.data.data[0].url
  // Generic known URL fields
  for (const k of ['url', 'image_url', 'imageUrl', 'src', 'image']) {
    if (typeof val[k] === 'string') return val[k]
  }
  return null
}

function runImageUrlPreviewNode({ input }) {
  const url = _extractImageUrl(input)
  if (!url) return { url: null, error: 'No image URL found in input' }
  // __ck8t_image_url is the sentinel picked up by extractMediaUri → SmartPreview
  return { url, __ck8t_image_url: url }
}

async function runImageUrlToBase64Node({ input }) {
  const url = _extractImageUrl(input)
  if (!url) return { base64: null, mimeType: null, dataUri: null, error: 'No image URL found in input' }
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const contentType = resp.headers.get('content-type') || 'image/png'
    const mimeType = contentType.split(';')[0].trim()
    const buf = await resp.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    const dataUri = `data:${mimeType};base64,${base64}`
    return { base64, mimeType, dataUri, url }
  } catch (err) {
    return { base64: null, mimeType: null, dataUri: null, error: err.message }
  }
}

async function runDelayNode({ values, input }) {
  const duration = Number(values.duration ?? 0)
  const unit = String(values.unit || 'ms')
  let ms = duration
  if (unit === 's') ms = duration * 1000
  else if (unit === 'm') ms = duration * 60_000
  else if (unit === 'h') ms = duration * 3_600_000
  const t0 = Date.now()
  await new Promise((resolve) => setTimeout(resolve, ms))
  return { output: input ?? null, elapsed: Date.now() - t0 }
}

async function runWaitNode({ values, input }) {
  const mode = String(values.mode || 'duration')
  const t0 = Date.now()
  if (mode === 'until') {
    const until = new Date(String(values.until || new Date().toISOString())).getTime()
    const diff = Math.max(0, until - Date.now())
    await new Promise((resolve) => setTimeout(resolve, diff))
  } else {
    await new Promise((resolve) => setTimeout(resolve, Number(values.duration ?? 0)))
  }
  return { output: input, elapsed: Date.now() - t0 }
}

function runFilterNode({ values, input }) {
  const mode = String(values.mode || 'keep')
  let arr = Array.isArray(input) ? input : []
  if (!Array.isArray(input) && typeof input === 'string') {
    try { const p = JSON.parse(input); if (Array.isArray(p)) arr = p } catch { arr = [] }
  }
  const condSrc = String(values.conditions || 'return true')
  let filterFn
  try { filterFn = new Function('item', 'index', condSrc) } catch { return { kept: arr, rejected: [], count: arr.length } }
  const kept = [], rejected = []
  for (let i = 0; i < arr.length; i++) {
    const result = filterFn(arr[i], i)
    if ((mode === 'keep' && result) || (mode === 'remove' && !result)) kept.push(arr[i])
    else rejected.push(arr[i])
  }
  return { kept, rejected, count: kept.length }
}

function runSortNode({ values, input }) {
  const sortKey = String(values.sortKey || '')
  const order = String(values.order || 'asc')
  let arr = Array.isArray(input) ? [...input] : []
  if (!Array.isArray(input) && typeof input === 'string') {
    try { const p = JSON.parse(input); if (Array.isArray(p)) arr = [...p] } catch { arr = [] }
  }
  arr.sort((a, b) => {
    let va = a, vb = b
    if (sortKey && typeof a === 'object' && a !== null) va = a[sortKey]
    if (sortKey && typeof b === 'object' && b !== null) vb = b[sortKey]
    if (va === vb) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const cmp = String(va) < String(vb) ? -1 : 1
    return order === 'desc' ? -cmp : cmp
  })
  return { sorted: arr, count: arr.length }
}

function runAggregateNode({ values, input }) {
  const operation = String(values.operation || 'count')
  const field = String(values.field || '')
  let arr = Array.isArray(input) ? input : []
  if (!Array.isArray(input) && typeof input === 'string') {
    try { const p = JSON.parse(input); if (Array.isArray(p)) arr = p } catch { arr = [] }
  }
  const extract = (item) => field && item && typeof item === 'object' ? item[field] : item
  const nums = arr.map(extract).map(Number).filter((n) => !isNaN(n))
  switch (operation) {
    case 'sum': return { result: nums.reduce((a, b) => a + b, 0), count: arr.length }
    case 'count': return { result: arr.length, count: arr.length }
    case 'avg': return { result: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0, count: arr.length }
    case 'min': return { result: nums.length > 0 ? Math.min(...nums) : null, count: arr.length }
    case 'max': return { result: nums.length > 0 ? Math.max(...nums) : null, count: arr.length }
    case 'concat': return { result: arr.map(extract), count: arr.length }
    case 'group': {
      const groups = {}
      for (const item of arr) {
        const key = String(extract(item) ?? 'undefined')
        if (!groups[key]) groups[key] = []
        groups[key].push(item)
      }
      return { result: groups, count: arr.length }
    }
    case 'custom': {
      try {
        const fn = new Function('input', String(values.customFn || 'return input'))
        return { result: fn(arr), count: arr.length }
      } catch { return { result: null, count: arr.length } }
    }
    default: return { result: arr.length, count: arr.length }
  }
}

function runMergeNode({ values, input }) {
  const mode = String(values.mode || 'append')
  const inputs = Array.isArray(input) ? input : [input]
  switch (mode) {
    case 'append': {
      const merged = []
      for (const item of inputs) { if (Array.isArray(item)) merged.push(...item); else merged.push(item) }
      return { merged, count: merged.length }
    }
    case 'position': {
      const merged = []
      for (let i = 0; i < inputs.length; i++) merged[i] = inputs[i]
      return { merged, count: merged.length }
    }
    case 'key':
    case 'match': {
      const merged = {}
      for (const item of inputs) { if (item && typeof item === 'object' && !Array.isArray(item)) Object.assign(merged, item) }
      return { merged, count: Object.keys(merged).length }
    }
    case 'dedupe': {
      const merged = [], seen = new Set()
      for (const item of inputs) {
        const items = Array.isArray(item) ? item : [item]
        for (const i of items) {
          const key = JSON.stringify(i)
          if (!seen.has(key)) { seen.add(key); merged.push(i) }
        }
      }
      return { merged, count: merged.length }
    }
    case 'deep_merge': {
      function deepMerge(target, source) {
        if (source == null || typeof source !== 'object' || Array.isArray(source)) return source ?? target
        if (target == null || typeof target !== 'object' || Array.isArray(target)) return source
        const out = { ...target }
        for (const k of Object.keys(source)) {
          out[k] = (typeof source[k] === 'object' && !Array.isArray(source[k]) &&
                    typeof target[k] === 'object' && !Array.isArray(target[k]))
            ? deepMerge(target[k], source[k])
            : source[k]
        }
        return out
      }
      const merged = inputs.reduce((acc, item) => deepMerge(acc, item), {})
      return { merged, count: Object.keys(merged).length }
    }
    default: {
      const merged = []
      for (const item of inputs) { if (Array.isArray(item)) merged.push(...item); else merged.push(item) }
      return { merged, count: merged.length }
    }
  }
}

async function runCryptoNode({ values, input }) {
  const operation = String(values.operation || 'sha256')
  // A wired `data` port overrides the static subBlock value.
  const data = String(input != null ? (typeof input === 'string' ? input : JSON.stringify(input)) : (values.data ?? ''))
  const secret = String(values.secret ?? '')
  const encode = (s) => new TextEncoder().encode(s)
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  switch (operation) {
    case 'sha256': {
      const buf = await crypto.subtle.digest('SHA-256', encode(data))
      return { result: hex(buf) }
    }
    case 'md5':
      return { result: null, error: 'MD5 is not available in browser crypto' }
    case 'base64_encode':
      return { result: btoa(data) }
    case 'base64_decode':
      return { result: atob(data) }
    case 'url_encode':
      return { result: encodeURIComponent(data) }
    case 'url_decode':
      return { result: decodeURIComponent(data) }
    case 'uuid':
      return { result: crypto.randomUUID() }
    case 'hmac_sha256': {
      const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const sig = await crypto.subtle.sign('HMAC', key, encode(data))
      return { result: hex(sig) }
    }
    default:
      return { result: data }
  }
}

function runErrorHandlerNode({ values, input }) {
  const strategy = String(values.strategy || 'fallback')
  if (strategy === 'fallback' && values.fallbackValue !== undefined) {
    return { result: values.fallbackValue, error: null, retryCount: 0 }
  }
  return { result: input, error: null, retryCount: 0 }
}

function runHttpResponseNode({ values, input, inputsByHandle }) {
  const statusCode = Number((inputsByHandle?.statusCode ?? values.statusCode) ?? 200)
  const rawHeaders = inputsByHandle?.headers ?? values.headers
  // Priority for body: wired `body` port > wired `input` port > static field > upstream input
  const body = (inputsByHandle?.body !== undefined)
    ? inputsByHandle.body
    : ((values.body !== undefined && values.body !== '') ? values.body : input)
  return { sent: true, statusCode, body, headers: rawHeaders ?? {} }
}

async function runAiClassifierNode({ node, values, input }) {
  const categories = String(values.categories || '').split(',').map((c) => c.trim()).filter(Boolean)
  const text = String(values.text || (typeof input === 'string' ? input : JSON.stringify(input)))
  const instructions = String(values.instructions || '')
  const model = String(values.model || useLlmConfigStore.getState().getDefaultModel() || useLlmConfigStore.getState().models[0]?.id || '')
  if (!model) {
    const nodeTitle = node.data?.title || node.id
    throw new GraphValidationError(
      `No model provider configured for "${nodeTitle}"`,
      {
        nodeId: node.id, nodeTitle, blockType: 'ai_classifier',
        cause: 'The LLM config store has no models loaded. Check /ck8t/llm/providers.',
        hint: 'Open Settings → LLM Provider Configuration and select a default model.',
        severity: 'error',
      }
    )
  }
  const systemPrompt =
    'You are a text classifier. Classify the given text into exactly one of these categories: ' +
    categories.join(', ') + '. ' +
    (instructions ? 'Additional instructions: ' + instructions + '. ' : '') +
    'Respond with ONLY a JSON object in the format: {"category":"<chosen>","confidence":<0_to_1>}'
  const agent = { id: node.id, model, temperature: 0, systemPrompt, userPrompt: text }
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
  try {
    const nodeTitle = node.data?.title || node.id
    const { response: res } = await callLlmWithFallback(agent, inputStr, nodeTitle)
    const raw = String(res?.output ?? res)
    const parsed = JSON.parse(raw)
    const allScores = {}
    for (const c of categories) allScores[c] = c === parsed.category ? (parsed.confidence ?? 1) : 0
    return { category: parsed.category ?? categories[0] ?? '', confidence: parsed.confidence ?? 0, allScores }
  } catch {
    return { category: categories[0] ?? 'unknown', confidence: 0, allScores: {} }
  }
}

function runVariablesNode({ values }) {
  let vars = Array.isArray(values.variables) ? values.variables : []
  if (typeof values.variables === 'string') { try { vars = JSON.parse(values.variables) } catch { vars = [] } }
  const result = {}
  for (const v of vars) { if (v.variableName) result[v.variableName] = v.value }
  return result
}

function runConditionNode({ values, input }) {
  let conditions = Array.isArray(values.conditions) ? values.conditions : []
  if (typeof values.conditions === 'string') { try { conditions = JSON.parse(values.conditions) } catch { conditions = [] } }
  for (const cond of conditions) {
    if (eval_safe(cond.expression, input)) return { branch: cond.id, value: input }
  }
  return { branch: 'else', value: input }
}

async function runRouterV2Node({ node, values, input }) {
  const context = String(values.context || (typeof input === 'string' ? input : JSON.stringify(input)))
  const model = String(values.model || useLlmConfigStore.getState().getDefaultModel() || useLlmConfigStore.getState().models[0]?.id || '')
  if (!model) {
    const nodeTitle = node.data?.title || node.id
    throw new GraphValidationError(
      `No model provider configured for "${nodeTitle}"`,
      {
        nodeId: node.id, nodeTitle, blockType: 'router_v2',
        cause: 'The LLM config store has no models loaded. Check /ck8t/llm/providers.',
        hint: 'Open Settings → LLM Provider Configuration and select a default model.',
        severity: 'error',
      }
    )
  }
  let routes = Array.isArray(values.routes) ? values.routes : []
  if (typeof values.routes === 'string') { try { routes = JSON.parse(values.routes) } catch { routes = [] } }
  if (routes.length === 0) return { branch: 'default', value: input }
  const routeList = routes.map((r, i) => (i + 1) + '. id=' + r.id + ': ' + r.description).join('\n')
  const systemPrompt =
    'You are a router. Given the context below, choose the best matching route.\n' +
    'Available routes:\n' + routeList + '\n\nRespond with ONLY the route id (nothing else).'
  const agent = { id: node.id, model, temperature: 0, systemPrompt, userPrompt: context }
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
  try {
    const nodeTitle = node.data?.title || node.id
    const { response: res } = await callLlmWithFallback(agent, inputStr, nodeTitle)
    const raw = String(res?.output ?? res).trim()
    const matched = routes.find((r) => r.id === raw)
    return { branch: matched ? matched.id : routes[0].id, value: input }
  } catch {
    return { branch: routes[0]?.id ?? 'default', value: input }
  }
}

// ── NS9 blocks (Sprint 27) ───────────────────────────────────────────────

function _ns9Interpolate(template, bag) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => { const val = bag[key.trim()]; return val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val) })
}
function _ns9ToBag(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string') { try { return JSON.parse(input) } catch { return { input } } }
  return { input: String(input ?? '') }
}

async function runNs9QueryBlock({ values, input }) {
  const server = String(values.server || 'ns9')
  const bag    = _ns9ToBag(input)
  const question = _ns9Interpolate(String(values.question || '{{input}}'), bag)
  if (!question.trim()) return { error: 'ns9_query: question is empty.', context_text: '', confidence: 0 }
  try {
    const result = await callMcpTool(server, 'ns9_query', { question, top_k: Number(values.top_k ?? 10), include_live_data: values.include_live !== false, include_past_qa: values.include_qa !== false })
    const r = result ?? {}
    return { ...r, value: r.context_text ?? '' }
  } catch (err) { return { error: `ns9_query failed: ${err?.message ?? err}`, context_text: '', confidence: 0 } }
}

async function runNs9RlhfBlock({ values, input }) {
  const server = String(values.server || 'ns9')
  const bag    = _ns9ToBag(input)
  const question      = _ns9Interpolate(String(values.question       || '{{question}}'),       bag)
  const wrongAnswer   = _ns9Interpolate(String(values.wrong_answer   || '{{wrong_answer}}'),   bag)
  const correctAnswer = _ns9Interpolate(String(values.correct_answer || '{{correct_answer}}'), bag)
  if (!question.trim() || !correctAnswer.trim()) return { error: 'ns9_rlhf: question and correct_answer are required.', saved: false }
  try {
    return await callMcpTool(server, 'ns9_rlhf_correct', { question, wrong_answer: wrongAnswer, correct_answer: correctAnswer, corrector: String(values.corrector || 'user'), propagate_now: values.propagate_now !== false })
  } catch (err) { return { error: `ns9_rlhf failed: ${err?.message ?? err}`, saved: false } }
}

async function runNs9IngestBlock({ values }) {
  const server = String(values.server || 'ns9')
  const source = String(values.source || 'all')
  const args = { source }
  if (values.path) args.path = String(values.path)
  try {
    return await callMcpTool(server, 'ns9_ingest', args)
  } catch (err) { return { error: `ns9_ingest failed: ${err?.message ?? err}`, triggered: false } }
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function groupBy(arr, key) {
  const out = {}
  for (const item of arr) (out[item[key]] ||= []).push(item)
  return out
}

function interpolate(template, outputs, input) {
  if (!template) return ''
  return String(template)
    .replace(/\{\{\s*input\s*\}\}/g, typeof input === 'string' ? input : JSON.stringify(input ?? ''))
    .replace(/<([a-zA-Z0-9_]+)\.output>/g, (_, id) => {
      const v = outputs[id]
      return typeof v === 'string' ? v : JSON.stringify(v ?? '')
    })
}

function safeJson(s) { if (typeof s !== 'string') return s; try { return JSON.parse(s) } catch { return null } }
function preview(v) {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 280 ? s.slice(0, 280) + '…' : s
}
function jsonPath(obj, path) {
  if (!path) return undefined
  const parts = String(path).replace(/^\$\.?/, '').split('.').filter(Boolean)
  return parts.reduce((a, k) => (a == null ? a : a[k]), obj)
}
function eval_safe(expr, input) { try { return new Function('input', `return (${expr})`)(input) } catch { return undefined } }

/* ── JSON Map block ────────────────────────────────────────────────────────── */
function runJsonMapNode({ values, input }) {
  let obj = typeof input === 'string' ? safeJson(input) : input
  if (obj == null) obj = {}

  // Resolve mappings from table rows (mappingPairs) or raw JSON (mappings).
  let mappings = resolveMappings(values.mappingPairs, values.mappings)
  if (!Array.isArray(mappings) || mappings.length === 0) return obj

  const result = {}
  for (const m of mappings) {
    const key = m.key || m.k
    const path = m.path || m.p || m.jsonPath
    if (!key) continue
    const val = path === '$' ? obj : jsonPath(obj, path)
    result[key] = val !== undefined ? val : null
  }
  return result
}

/**
 * Resolve json_map mappings from either table rows or a raw JSON string/array.
 * Table rows are arrays of [key, path]. JSON can be a string or parsed array
 * of { key, path } objects.
 */
function resolveMappings(tableRows, rawMappings) {
  // Table rows take precedence when they have content.
  if (Array.isArray(tableRows) && tableRows.length > 0) {
    const fromTable = tableRows
      .map((row) => {
        if (!Array.isArray(row)) return null
        const key = String(row[0] ?? '').trim()
        const path = String(row[1] ?? '').trim()
        if (!key) return null
        return { key, path: path || '$' }
      })
      .filter(Boolean)
    if (fromTable.length > 0) return fromTable
  }

  // Fall back to raw JSON (advanced mode or legacy workflows).
  if (!rawMappings) return []
  if (typeof rawMappings === 'string') {
    try { return JSON.parse(rawMappings) } catch (e) {
      throw new Error(`JSON Map: mappings is not valid JSON — ${e.message}`)
    }
  }
  return rawMappings
}

/* ── Text Template block ───────────────────────────────────────────────────── */
function runTextTemplateNode({ values, input }) {
  const template = values.template || '{{input}}'
  const bag = { input: typeof input === 'string' ? input : JSON.stringify(input ?? '') }
  // If input is an object, merge its keys as template vars
  const obj = typeof input === 'string' ? safeJson(input) : input
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) bag[k] = v
  }
  return interpolateBag(template, bag)
}

/* ── JSON Path block ───────────────────────────────────────────────────────── */
function runJsonPathNode({ values, input }) {
  let obj = typeof input === 'string' ? safeJson(input) : input
  if (obj == null) obj = {}
  const path = values.path || '$'
  const result = path === '$' ? obj : jsonPath(obj, path)
  if (result === undefined && values.fallback != null && values.fallback !== '') {
    return values.fallback
  }
  return result !== undefined ? result : null
}

/* ── Mapper block — type conversion ────────────────────────────────────────── */
async function runMapperNode({ values, input }) {
  const mode = values.mode || 'json_parse'
  switch (mode) {
    case 'json_parse': {
      if (typeof input === 'object' && input !== null) return input
      if (typeof input !== 'string') return input
      try { return JSON.parse(input) } catch { throw new Error(`Mapper: input is not valid JSON`) }
    }
    case 'json_stringify':
      return typeof input === 'string' ? input : JSON.stringify(input)
    case 'to_number': {
      const n = Number(input)
      if (Number.isNaN(n)) throw new Error(`Mapper: cannot convert "${String(input).slice(0, 50)}" to number`)
      return n
    }
    case 'to_boolean':
      if (typeof input === 'boolean') return input
      if (input === 'true' || input === '1') return true
      if (input === 'false' || input === '0' || input === '' || input == null) return false
      return Boolean(input)
    case 'to_string':
      if (typeof input === 'string') return input
      return input == null ? '' : (typeof input === 'object' ? JSON.stringify(input) : String(input))
    case 'merge_fields': {
      // Merge key/value pairs from the `fields` table into the input object.
      // Input rows: [[key, value], ...].  Handy for adding `model: "base"`
      // before piping to whisper-mcp or other consumers.
      const obj = (input && typeof input === 'object' && !Array.isArray(input))
        ? { ...input }
        : {}
      let fields = Array.isArray(values.fields) ? values.fields : []
      if (typeof values.fields === 'string') { try { fields = JSON.parse(values.fields) } catch { fields = [] } }
      for (const row of fields) {
        if (!Array.isArray(row) || row.length < 2) continue
        const key = String(row[0] || '').trim()
        if (!key) continue
        obj[key] = row[1]
      }
      return obj
    }
    case 'skill': {
      const skillId = values.skillId
      if (!skillId) throw new Error('Mapper: no skill selected. Choose a skill from the dropdown.')
      const skills = useWorkspaceStore.getState().skills || []
      const skill = skills.find((s) => s.id === skillId)
      if (!skill) throw new Error(`Mapper: skill "${skillId}" not found in workspace.`)
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? null)
      return await runSkillSource(skill, inputStr)
    }
    default: {
      const communityRun = customBrowserBlockRunners.get(type)
      if (communityRun) {
        return await communityRun({ values, input, inputsByHandle, outputs, node, allNodes, subBlockValues })
      }
      return input
    }
  }
}
