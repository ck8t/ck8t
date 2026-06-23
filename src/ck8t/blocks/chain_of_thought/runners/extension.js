export default [
  {
    type: 'chain_of_thought',
    async run({ values, input, callAgent, node, nodeId, nodeTitle }) {
      const question = String(values.question || (typeof input === 'string' ? input : JSON.stringify(input ?? '')))
      const contextStr = values.context ? (typeof values.context === 'string' ? values.context : JSON.stringify(values.context)) : ''
      const effort = String(values.effort || 'medium')
      const stepCount = effort === 'low' ? '2–3' : effort === 'high' ? '6–8' : '4–5'
      const rawModel = values.model ? String(values.model) : null
      if (!rawModel) throw new Error(`No model configured for Chain of Thought "${nodeTitle}". Open Settings → LLM Provider Configuration.`)
      const systemPrompt =
        `You are a careful reasoning engine. When given a question you MUST:\n` +
        `1. Write ${stepCount} numbered reasoning steps (prefix each with "Step N: ...")\n` +
        `2. State a final conclusion\n3. Rate your confidence 0–1\n\n` +
        `Respond ONLY with valid JSON:\n{"reasoning_steps":["Step 1: ..."],"conclusion":"...","confidence":0.85}`
      const userPrompt = contextStr ? `Context:\n${contextStr}\n\nQuestion:\n${question}` : question
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '')
      let parsed = {}
      try {
        const res = await callAgent({ agent: { id: nodeId || node?.id || 'cot', model: rawModel, temperature: 0.2, systemPrompt, userPrompt }, input: inputStr })
        const raw = res.output.trim()
        parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
      } catch {
        return { reasoning_steps: [], conclusion: inputStr, confidence: 0.5, full_response: parsed }
      }
      return {
        reasoning_steps: Array.isArray(parsed.reasoning_steps) ? parsed.reasoning_steps : [],
        conclusion: String(parsed.conclusion ?? ''),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
        full_response: parsed,
      }
    },
  },
]
