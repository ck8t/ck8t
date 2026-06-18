export async function run({ node, values, input, callAgent }) {
  const categories = Array.isArray(values.categories) ? values.categories : []
  const catList = categories.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(', ')
  const prompt = `Classify the following input into exactly one of these categories: ${catList}.\n\nRespond with a JSON object: {"category":"<category>","confidence":<0-1>}\n\nInput: ${typeof input === 'string' ? input : JSON.stringify(input)}`
  const classifierModel = values.model ? String(values.model) : null
  if (!classifierModel) throw new Error(`No model configured for AI Classifier "${node?.id}".`)
  const res = await callAgent({
    agent: {
      id: node?.id || 'ai_classifier',
      model: classifierModel,
      systemPrompt: 'You are a precise classifier. Respond only with the JSON object requested.',
      userPrompt: prompt,
      responseFormat: '{"category":"string","confidence":"number"}',
      strictOutput: true,
    },
    input: typeof input === 'string' ? input : JSON.stringify(input),
  })
  try {
    const parsed = typeof res.output === 'string' ? JSON.parse(res.output) : res.output
    return { category: String(parsed.category || ''), confidence: Number(parsed.confidence ?? 0) }
  } catch {
    return { category: String(res.output || ''), confidence: 0 }
  }
}
