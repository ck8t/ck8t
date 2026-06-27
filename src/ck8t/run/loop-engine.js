/**
 * Real cyclic loop execution for for_each / for_loop / loop.
 *
 * The canvas is otherwise a strict DAG (graph-runner.js's BFS scheduler runs every
 * node exactly once). Loop blocks are the one deliberate exception: wiring a loop's
 * `item` output forward to a body block, and that body block's output back to the
 * loop's `feedback` input, forms a closed cycle. graph-runner.js detects this shape
 * up front (computeLoopPlans), excludes the body nodes from its normal one-shot
 * scheduling entirely, and instead lets the loop node "own" them — runLoopBlock()
 * drives the body chain once per item/iteration directly via the injected `runNode`,
 * threading per-iteration values along the chain while still resolving any of the
 * body's OTHER inputs (e.g. a constant server URL wired from outside the loop) from
 * the outer graph's already-computed `outputs`.
 *
 * v1 scope: the body must be a single linear chain (each body node has exactly one
 * outgoing edge, which either continues the chain or closes the loop) — no branching
 * loop bodies yet. `parallel` is not handled here; it's still a stub (real fan-out
 * needs dynamic per-branch ports, a bigger UI change).
 */

export const LOOP_BLOCK_TYPES = new Set(['for_each', 'for_loop', 'loop'])

const MAX_CHAIN_HOPS = 50

function titleOf(node) {
  return node?.data?.title || node?.data?.blockType || node?.id || 'node'
}

/**
 * Trace the linear body chain from a loop node's `item` output forward until an
 * edge closes the loop back into that same node's `feedback` input.
 * Returns null if nothing is wired to `item` (not an error — the loop node just
 * behaves as a plain passthrough, handled by its own runners/client.js stub).
 * Throws GraphValidationError for any malformed shape (branching body, dangling
 * chain that never closes, wrong target handle on the closing edge).
 */
function traceChain(loopNode, outgoing, GraphValidationError) {
  const itemEdges = (outgoing[loopNode.id] || []).filter((e) => (e.sourceHandle || 'out') === 'item')
  if (itemEdges.length === 0) return null
  if (itemEdges.length > 1) {
    throw new GraphValidationError(
      `"${titleOf(loopNode)}" wires its "item" output to more than one block — a loop body must be a single linear chain.`,
      { nodeId: loopNode.id, nodeTitle: titleOf(loopNode), blockType: loopNode.data?.blockType }
    )
  }

  const bodyIds = []
  const chainEdgeIds = new Set([itemEdges[0].id])
  const chainEdgeByBodyId = new Map()
  let currentEdge = itemEdges[0]
  let hops = 0

  while (true) {
    if (++hops > MAX_CHAIN_HOPS) {
      throw new GraphValidationError(
        `"${titleOf(loopNode)}"'s loop body never connects back to its "feedback" input (checked ${MAX_CHAIN_HOPS} hops).`,
        { nodeId: loopNode.id, nodeTitle: titleOf(loopNode), blockType: loopNode.data?.blockType }
      )
    }
    const targetId = currentEdge.target
    if (targetId === loopNode.id) {
      if ((currentEdge.targetHandle || 'in') !== 'in_feedback') {
        throw new GraphValidationError(
          `"${titleOf(loopNode)}"'s loop body connects back to itself on the wrong input — wire it to "feedback".`,
          { nodeId: loopNode.id, nodeTitle: titleOf(loopNode), blockType: loopNode.data?.blockType }
        )
      }
      return { bodyIds, chainEdgeIds, chainEdgeByBodyId, feedbackEdge: currentEdge }
    }
    bodyIds.push(targetId)
    chainEdgeByBodyId.set(targetId, currentEdge)
    const outs = outgoing[targetId] || []
    if (outs.length === 0) {
      throw new GraphValidationError(
        `Loop body node "${targetId}" has no outgoing connection — wire its output back to "${titleOf(loopNode)}"'s "feedback" input to close the loop.`,
        { nodeId: targetId }
      )
    }
    if (outs.length > 1) {
      throw new GraphValidationError(
        `Loop body node "${targetId}" has more than one outgoing connection — a loop body must be a single linear chain (no branching) in this version.`,
        { nodeId: targetId }
      )
    }
    currentEdge = outs[0]
    chainEdgeIds.add(currentEdge.id)
  }
}

/**
 * Scan every for_each/for_loop/loop node in the graph and compute its body-chain
 * plan. Returns { plans: Map<loopNodeId, Plan>, bodyOwner: Map<bodyNodeId, loopNodeId> }.
 * Plan.gatingEdges is what the outer scheduler should wait on for *readiness* —
 * the loop's own real incoming edges (excluding the cyclic feedback edge) plus
 * every body node's external (non-chain) incoming edges, since those nodes never
 * go through the outer scheduler's own readiness gating.
 */
export function computeLoopPlans(nodes, edges, GraphValidationError) {
  const outgoing = {}
  const incoming = {}
  for (const e of edges) {
    ;(outgoing[e.source] ||= []).push(e)
    ;(incoming[e.target] ||= []).push(e)
  }

  const plans = new Map()
  const bodyOwner = new Map()

  for (const n of nodes) {
    if (!LOOP_BLOCK_TYPES.has(n.data?.blockType)) continue
    const chain = traceChain(n, outgoing, GraphValidationError)
    if (!chain) continue

    for (const bodyId of chain.bodyIds) {
      if (bodyOwner.has(bodyId)) {
        throw new GraphValidationError(`Node "${bodyId}" is claimed by more than one loop body.`, { nodeId: bodyId })
      }
      bodyOwner.set(bodyId, n.id)
    }

    const ownInputEdges = (incoming[n.id] || []).filter((e) => e.id !== chain.feedbackEdge.id)
    const bodyExternalGating = []
    for (const bodyId of chain.bodyIds) {
      for (const e of (incoming[bodyId] || [])) {
        if (!chain.chainEdgeIds.has(e.id)) bodyExternalGating.push(e)
      }
    }

    plans.set(n.id, {
      loopId: n.id,
      bodyIds: chain.bodyIds,
      chainEdgeByBodyId: chain.chainEdgeByBodyId,
      feedbackEdge: chain.feedbackEdge,
      ownInputEdges,
      gatingEdges: [...ownInputEdges, ...bodyExternalGating],
    })
  }

  return { plans, bodyOwner }
}

function resolveEdgeOutputFrom(outputsMap, edge) {
  const full = outputsMap[edge.source]
  const sh = edge.sourceHandle || 'out'
  if (sh === 'out' || full == null || typeof full !== 'object') return full
  const field = sh.startsWith('out_') ? sh.slice(4) : sh
  return field in full ? full[field] : full
}

function handleKey(targetHandle) {
  const th = targetHandle || 'in'
  return th === 'in' ? 'input' : (th.startsWith('in_') ? th.slice(3) : th)
}

function unwrapRunResult(ran) {
  let out = ran
  if (out && typeof out === 'object' && out.__meta) out = out.value
  if (out && typeof out === 'object' && typeof out.branch === 'string') out = out.value
  return out
}

/** Run the body chain once for a single item, threading values along the chain. */
async function runBodyChainOnce({ plan, currentItem, incoming, nodesById, subBlockValues, outerOutputs, allNodes, runNode }) {
  const iterOutputs = {} // bodyId -> full raw return value (not yet field-extracted)
  let isFirstHop = true
  let prevFullOutput = null

  for (const bodyId of plan.bodyIds) {
    const bodyNode = nodesById[bodyId]
    const chainEdge = plan.chainEdgeByBodyId.get(bodyId)
    const allIn = incoming[bodyId] || []

    // The chain edge's sourceHandle needs the same field-extraction every other
    // edge gets (e.g. cuda_id4_generate's full {image_b64, output_path, ...}
    // return must be narrowed to just `image_b64` before it becomes the next
    // hop's input) — except on the very first hop, where the "source" is the
    // loop's own per-iteration item, already the exact value to use as-is.
    const chainValue = isFirstHop
      ? currentItem
      : resolveEdgeOutputFrom({ [chainEdge.source]: prevFullOutput }, chainEdge)

    const upstream = []
    const inputsByHandle = {}
    for (const e of allIn) {
      const isChain = e.id === chainEdge.id
      const val = isChain ? chainValue : resolveEdgeOutputFrom(outerOutputs, e)
      upstream.push(val)
      const key = handleKey(e.targetHandle)
      if (!(key in inputsByHandle)) inputsByHandle[key] = val
    }
    const input = upstream.length <= 1 ? upstream[0] : upstream
    const mergedOutputsView = { ...outerOutputs, ...iterOutputs }

    const ran = await runNode({
      node: bodyNode,
      values: subBlockValues[bodyId] || {},
      input,
      outputs: mergedOutputsView,
      inputsByHandle,
      allNodes,
      subBlockValues,
    })
    const out = unwrapRunResult(ran)
    iterOutputs[bodyId] = out
    prevFullOutput = out
    isFirstHop = false
  }

  // Same field-extraction one more time for the edge that closes the loop
  // (e.g. a "Strip Data URI" body node's plain string return needs no
  // extraction, but a body chain that closes directly from a multi-field
  // block would).
  const lastBodyId = plan.bodyIds[plan.bodyIds.length - 1]
  const lastOutput = lastBodyId
    ? resolveEdgeOutputFrom({ [plan.feedbackEdge.source]: iterOutputs[lastBodyId] }, plan.feedbackEdge)
    : currentItem

  return { lastOutput, iterOutputs }
}

function parseCollectionFallback(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

/**
 * Execute a loop node's body chain to completion. Writes outputs[node.id] and a
 * representative outputs[bodyId] (last iteration's value) itself, mirroring how
 * every other node's result lands in the shared `outputs` map.
 */
export async function runLoopBlock({ node, plan, incoming, nodesById, subBlockValues, outputs, allNodes, runNode, progress }) {
  const blockType = node.data?.blockType
  const values = subBlockValues[node.id] || {}
  const continueOnError = values.continueOnError === true
  const concurrency = Math.max(1, Math.min(10, Number(values.maxConcurrency) || 1))

  const wiredUpstream = plan.ownInputEdges.map((e) => resolveEdgeOutputFrom(outputs, e))
  const wiredInput = wiredUpstream.length <= 1 ? wiredUpstream[0] : wiredUpstream

  let items = null
  let isWhile = false
  let whileCond = null
  let maxIterations = 1000

  if (blockType === 'for_each') {
    items = Array.isArray(wiredInput) ? wiredInput
      : wiredInput != null ? [wiredInput]
      : parseCollectionFallback(values.collection)
  } else if (blockType === 'for_loop') {
    const count = (wiredInput != null && wiredInput !== '' && Number.isFinite(Number(wiredInput)))
      ? Math.max(0, Math.min(10000, Number(wiredInput)))
      : Math.max(0, Math.min(10000, Number(values.count ?? 10)))
    items = Array.from({ length: count }, (_, i) => ({ i, index: i }))
  } else {
    // 'loop' — dispatch on loopType
    const loopType = values.loopType || 'for'
    if (loopType === 'forEach') {
      items = Array.isArray(wiredInput) ? wiredInput
        : wiredInput != null ? [wiredInput]
        : parseCollectionFallback(values.collection)
    } else if (loopType === 'while') {
      isWhile = true
      whileCond = values.whileCondition || 'false'
      maxIterations = Math.max(1, Math.min(100000, Number(values.maxIterations) || 1000))
    } else {
      const count = Math.max(0, Math.min(10000, Number(values.iterations ?? 10)))
      items = Array.from({ length: count }, (_, i) => ({ i, index: i }))
    }
  }

  const iterations = []
  const totalForProgress = isWhile ? maxIterations : (items?.length || 0)

  try {
    if (isWhile) {
      let prev = null
      let idx = 0
      while (idx < maxIterations) {
        let keepGoing
        try {
          // eslint-disable-next-line no-new-func
          keepGoing = !!new Function('prev', 'index', `return (${whileCond})`)(prev, idx)
        } catch {
          keepGoing = false
        }
        if (!keepGoing) break

        try {
          const { lastOutput } = await runBodyChainOnce({
            plan, currentItem: { index: idx, prev }, incoming, nodesById, subBlockValues, outerOutputs: outputs, allNodes, runNode,
          })
          iterations.push(lastOutput)
          prev = lastOutput
        } catch (err) {
          if (!continueOnError) throw err
          const errMsg = err.message || String(err)
          iterations.push({ __loopItemError: errMsg })
          prev = null
        }
        idx++
        progress?.({ pct: Math.min(95, Math.round((idx / totalForProgress) * 100)), label: `Iteration ${idx}` })
      }
    } else {
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency)
        const batchResults = await Promise.all(batch.map(async (item) => {
          try {
            const { lastOutput } = await runBodyChainOnce({
              plan, currentItem: item, incoming, nodesById, subBlockValues, outerOutputs: outputs, allNodes, runNode,
            })
            return lastOutput
          } catch (err) {
            if (!continueOnError) throw err
            return { __loopItemError: err.message || String(err) }
          }
        }))
        iterations.push(...batchResults)
        const done = Math.min(items.length, i + batch.length)
        progress?.({ pct: Math.min(95, Math.round((done / Math.max(1, items.length)) * 100)), label: `Iteration ${done} / ${items.length}` })
      }
    }

    const result = blockType === 'loop'
      ? { results: iterations, iterations: iterations.length }
      : { iterations, last: iterations.length > 0 ? iterations[iterations.length - 1] : null }

    outputs[node.id] = result
    for (const bodyId of plan.bodyIds) outputs[bodyId] = iterations[iterations.length - 1] ?? null

    progress?.({ pct: 100, label: `${iterations.length} iteration${iterations.length === 1 ? '' : 's'} done` })
    return result
  } catch (err) {
    progress?.({ pct: 100, label: `Failed: ${err.message || String(err)}` })
    throw err
  }
}
