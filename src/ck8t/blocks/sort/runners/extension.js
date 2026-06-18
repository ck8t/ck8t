export function run({ values, input }) {
  const arr = Array.isArray(input) ? [...input] : []
  const key = String(values.key || values.field || '')
  const order = String(values.order || 'asc').toLowerCase()
  arr.sort((a, b) => {
    const av = key ? (a != null ? a[key] : a) : a
    const bv = key ? (b != null ? b[key] : b) : b
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return order === 'desc' ? -cmp : cmp
  })
  return arr
}
