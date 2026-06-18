// Extension-side runner for the Function block.
// Executes user-supplied JS code via new Function() in the Node.js extension host.
export function run({ values, input }) {
  const src = String(values.code || 'return input')
  try {
    const fn = new Function('input', 'values', src)
    return fn(input, values)
  } catch (err) {
    throw new Error('Function node error: ' + err.message)
  }
}
