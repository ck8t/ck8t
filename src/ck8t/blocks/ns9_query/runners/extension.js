// Extension-side runner for the NS9 Query block.
// Calls the ns9_query MCP tool on the specified server.
function interpolate(template, bag) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, key) => {
    const val = bag[key.trim()]
    if (val === undefined) return ''
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  })
}

function toBag(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { /**/ }
    return { input }
  }
  return { input: String(input ?? '') }
}

export async function run({ values, input, callTool }) {
  const server = String(values.server || 'ns9')
  const bag = toBag(input)
  const question = interpolate(String(values.question || '{{input}}'), bag)

  if (!question.trim()) {
    return { error: 'ns9_query: question is empty.', context_text: '', confidence: 0 }
  }

  const args = {
    question,
    top_k: Number(values.top_k ?? 10),
    include_live_data: values.include_live !== false,
    include_past_qa: values.include_qa !== false,
  }

  try {
    const result = await callTool(server, 'ns9_query', args)
    const r = result || {}
    return { ...r, value: r.context_text ?? '' }
  } catch (err) {
    const msg = err?.message || String(err)
    return { error: `ns9_query MCP call failed: ${msg}`, context_text: '', confidence: 0 }
  }
}
