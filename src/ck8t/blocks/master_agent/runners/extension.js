// Extension-side runner for the Master Agent block.
// Orchestrates multiple slave_agent nodes in topological dependency order.
function topoSortSteps(steps) {
  const layers = []
  const resolved = new Set()
  let remaining = [...steps]
  let guard = steps.length + 2
  while (remaining.length > 0 && guard-- > 0) {
    const ready = remaining.filter(s => s.depends_on.every(d => resolved.has(d)))
    if (ready.length === 0) { layers.push(remaining); break }
    layers.push(ready)
    ready.forEach(s => resolved.add(s.id))
    remaining = remaining.filter(s => !resolved.has(s.id))
  }
  return layers
}

export async function run({ node, values, input, allNodes, subBlockValues, callAgent }) {
  const question = String(values.question || (typeof input === 'string' ? input : JSON.stringify(input ?? '')))
  const rawModel = values.model ? String(values.model) : null
  if (!rawModel) throw new Error(`No model configured for Master Agent "${node?.data?.title || node?.id}". Open Settings → LLM Provider Configuration.`)

  const slaveNodes = (allNodes || []).filter(n => n.data?.blockType === 'slave_agent')
  const slaveDescriptions = slaveNodes.map(n => {
    const sv = subBlockValues?.[n.id] || {}
    return `- id: "${n.id}", capability: "${sv.capabilityLabel || 'specialist'}", description: "${n.data?.title || n.id}"`
  }).join('\n')

  // Step 1: Planning pass
  const planSystemPrompt = `You are an orchestration planner. Given a question and list of specialist agents, produce a step-by-step plan.\nAgents:\n${slaveDescriptions || '(none)'}\n\nRespond ONLY with valid JSON array:\n[{"id":"step1","sub_question":"...","capability":"...","depends_on":[]}]`
  const planRes = await callAgent({ agent: { id: (node?.id || 'master') + '_plan', model: rawModel, temperature: 0.3, systemPrompt: planSystemPrompt, userPrompt: question }, input: question })
  let steps = []
  try {
    const raw = planRes.output.trim()
    steps = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
  } catch { steps = [] }

  // Step 2: Execute steps in topological order
  const slaveOutputs = {}
  const layers = topoSortSteps(steps)
  for (const layer of layers) {
    await Promise.all(layer.map(async step => {
      const deps = step.depends_on.map(d => slaveOutputs[d]).filter(Boolean)
      const contextStr = deps.length ? 'Previous results:\n' + deps.map((d, i) => `[${step.depends_on[i]}]: ${JSON.stringify(d)}`).join('\n') : ''
      const slaveInput = contextStr ? `${contextStr}\n\nTask: ${step.sub_question}` : step.sub_question
      const res = await callAgent({ agent: { id: (node?.id || 'master') + '_' + step.id, model: rawModel, temperature: 0.3, systemPrompt: `You are a ${step.capability} specialist. Answer concisely.`, userPrompt: slaveInput }, input: slaveInput })
      slaveOutputs[step.id] = res.output
    }))
  }

  // Step 3: Synthesis
  const synthUserPrompt = `Original question: ${question}\n\nSpecialist results:\n${Object.entries(slaveOutputs).map(([k, v]) => `[${k}]: ${v}`).join('\n')}`
  const synthSystem = String(values.synthesisPrompt || `You are a synthesis agent. Produce a concise final answer. Respond with JSON: {"final_answer":"...","confidence":0.9}`)
  const synthRes = await callAgent({ agent: { id: (node?.id || 'master') + '_synthesis', model: rawModel, temperature: 0.2, systemPrompt: synthSystem, userPrompt: synthUserPrompt }, input: synthUserPrompt })
  let finalAnswer = synthRes.output
  let confidence = 0.8
  try {
    const parsed = JSON.parse(synthRes.output.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
    finalAnswer = String(parsed.final_answer ?? synthRes.output)
    confidence = Number(parsed.confidence ?? 0.8)
  } catch { /* keep raw output */ }

  return { final_answer: finalAnswer, slave_outputs: slaveOutputs, cot_plan: steps, confidence }
}
