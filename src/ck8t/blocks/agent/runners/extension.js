// Extension-side runner for the Agent block.
// Calls an LLM via the callAgent bridge (provided by the extension host).
function interpolateBag(template, bag) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = bag[k]
    return v === undefined ? `{{${k}}}` : (typeof v === 'string' ? v : JSON.stringify(v))
  })
}

export async function run({ node, values, input, callAgent }) {
  const bag = {}
  if (typeof input === 'string') {
    bag.input = input
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(bag, parsed)
    } catch {
      if (/^https?:\/\//.test(input)) bag.url = input
    }
  } else if (input && typeof input === 'object') {
    Object.assign(bag, input)
    bag.input = JSON.stringify(input)
  } else {
    bag.input = String(input ?? '')
  }

  const rawModel = values.model ? String(values.model) : null
  if (!rawModel) {
    const nodeTitle = String(node?.data?.title || node?.id || 'Agent')
    throw new Error(`No model provider configured for "${nodeTitle}". Open Settings → LLM Provider Configuration.`)
  }

  const provider = values.provider ? String(values.provider) : undefined
  const temperature = Number(values.temperature ?? 0.7)
  const systemPrompt = interpolateBag(String(values.systemPrompt || ''), bag)
  const userPrompt = interpolateBag(String(values.userPrompt || '{{input}}'), bag)
  const responseFormat = values.responseFormat ? String(values.responseFormat) : null
  const strictOutput = values.strictOutput === true

  const agent = { id: String(values.id || node?.id || 'agent'), provider, model: rawModel, temperature, systemPrompt, userPrompt, responseFormat, strictOutput }
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
  const res = await callAgent({ agent, input: inputStr })

  return {
    __meta: { provider, model: rawModel, temperature, systemPrompt, userPrompt, rawAgentResponse: res },
    value: {
      data: res.output,
      status: 200,
      headers: { 'x-model': rawModel, 'x-duration-ms': res.ms },
    },
  }
}
