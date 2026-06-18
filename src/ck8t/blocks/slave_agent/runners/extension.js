// Extension-side runner for the Slave Agent block.
export async function run({ node, values, input, callAgent }) {
  const task = String(values.task || (typeof input === 'string' ? input : JSON.stringify(input ?? '')))
  const contextStr = values.context ? (typeof values.context === 'string' ? values.context : JSON.stringify(values.context)) : ''
  const rawModel = values.model ? String(values.model) : null
  if (!rawModel) throw new Error(`No model configured for Slave Agent "${node?.data?.title || node?.id}". Open Settings → LLM Provider Configuration.`)

  const capabilityLabel = String(values.capabilityLabel || 'specialist')
  const systemPrompt = String(values.systemPrompt ||
    `You are a specialist agent (${capabilityLabel}). Answer the given task concisely. ` +
    `Respond with JSON: {"answer":"...","cited_nodes":[],"confidence":0.8,"needs_clarification":false}`)
  const userPrompt = contextStr ? `Context:\n${contextStr}\n\nTask:\n${task}` : task
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '')

  try {
    const res = await callAgent({ agent: { id: node?.id || 'slave', model: rawModel, temperature: 0.3, systemPrompt, userPrompt }, input: inputStr })
    const raw = res.output.trim()
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
    return {
      answer: String(parsed.answer ?? raw),
      cited_nodes: Array.isArray(parsed.cited_nodes) ? parsed.cited_nodes : [],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.7))),
      needs_clarification: Boolean(parsed.needs_clarification ?? false),
    }
  } catch {
    return { answer: task, cited_nodes: [], confidence: 0.5, needs_clarification: false }
  }
}
