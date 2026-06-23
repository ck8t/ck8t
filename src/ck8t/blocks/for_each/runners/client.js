export default [
  {
    type: 'for_each',
    run({ input }) {
      const arr = Array.isArray(input) ? input : (input != null ? [input] : [])
      return { iterations: arr, last: arr.length > 0 ? arr[arr.length - 1] : null }
    },
  },
]
