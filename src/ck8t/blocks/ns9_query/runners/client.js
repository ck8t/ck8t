export default [
  {
    type: 'ns9_query',
    async run({ values, input, callTool }) {
      const server = String(values.server || 'ns9')
      const bag = _toBag(input)
      const question = _interp(String(values.question || '{{input}}'), bag)
      if (!question.trim()) return { error: 'ns9_query: question is empty.', context_text: '', confidence: 0 }
      try {
        const result = await callTool(server, 'ns9_query', { question, top_k: Number(values.top_k ?? 10), include_live_data: values.include_live !== false, include_past_qa: values.include_qa !== false })
        const r = result ?? {}
        return { ...r, value: r.context_text ?? '' }
      } catch (err) { return { error: `ns9_query failed: ${err?.message ?? err}`, context_text: '', confidence: 0 } }
    },
  },
]

function _toBag(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string') { try { return JSON.parse(input) } catch { return { input } } }
  return { input: String(input ?? '') }
}
function _interp(t, bag) {
  return t.replace(/\{\{([^}]+)\}\}/g, (_, k) => { const v = bag[k.trim()]; return v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v) })
}
