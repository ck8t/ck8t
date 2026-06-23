export default [
  {
    type: 'response',
    run({ values, input, inputsByHandle, outputs }) {
      const data = inputsByHandle?.data ?? (values.data ? _interpolate(values.data, outputs, input) : input)
      const status = inputsByHandle?.status ?? (values.status ? Number(values.status) : 200)
      const headers = inputsByHandle?.headers ?? _parseJsonSafe(values.headers)
      return { data, status, headers }
    },
  },
]

function _interpolate(template, outputs, input) {
  if (!template) return ''
  return String(template)
    .replace(/\{\{\s*input\s*\}\}/g, typeof input === 'string' ? input : JSON.stringify(input ?? ''))
    .replace(/<([a-zA-Z0-9_]+)\.output>/g, (_, id) => {
      const v = outputs?.[id]
      return typeof v === 'string' ? v : JSON.stringify(v ?? '')
    })
}
function _parseJsonSafe(v) {
  if (v == null || v === '') return null
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return v }
}
