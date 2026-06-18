export function run({ values, input }) {
  const msg = String(values.message || 'Error: {{input}}')
  const text = msg.replace(/\{\{input\}\}/g, typeof input === 'string' ? input : JSON.stringify(input))
  return { error: text, handled: true, originalInput: input }
}
