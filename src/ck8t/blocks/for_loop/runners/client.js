export default [
  {
    type: 'for_loop',
    run({ values }) {
      const count = Math.max(0, Math.min(10000, Number(values.count ?? 10)))
      const iterations = Array.from({ length: count }, (_, i) => ({ i, index: i }))
      return { iterations, last: count > 0 ? iterations[count - 1] : null }
    },
  },
]
