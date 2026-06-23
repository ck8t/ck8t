export default [
  {
    type: 'parallel',
    run({ input }) {
      const results = input != null ? [input] : []
      return { results, winner: input ?? null }
    },
  },
]
