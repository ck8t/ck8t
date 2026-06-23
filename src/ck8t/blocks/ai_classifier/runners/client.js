export default [
  {
    type: 'ai_classifier',
    async run({ values, input, callLlm, resolveModel, nodeId, nodeTitle }) {
      const categories = String(values.categories || '').split(',').map(c => c.trim()).filter(Boolean)
      const text = String(values.text || (typeof input === 'string' ? input : JSON.stringify(input)))
      const instructions = String(values.instructions || '')
      const { model } = resolveModel(values.model, values.provider)
      if (!model) throw new Error(`No model configured for "${nodeTitle}"`)
      const systemPrompt =
        'You are a text classifier. Classify the given text into exactly one of these categories: ' +
        categories.join(', ') + '. ' +
        (instructions ? 'Additional instructions: ' + instructions + '. ' : '') +
        'Respond with ONLY a JSON object in the format: {"category":"<chosen>","confidence":<0_to_1>}'
      const agent = { id: nodeId, model, temperature: 0, systemPrompt, userPrompt: text }
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
      try {
        const { response: res } = await callLlm(agent, inputStr, nodeTitle)
        const parsed = JSON.parse(String(res?.output ?? res))
        const allScores = {}
        for (const c of categories) allScores[c] = c === parsed.category ? (parsed.confidence ?? 1) : 0
        return { category: parsed.category ?? categories[0] ?? '', confidence: parsed.confidence ?? 0, allScores }
      } catch {
        return { category: categories[0] ?? 'unknown', confidence: 0, allScores: {} }
      }
    },
  },
]
