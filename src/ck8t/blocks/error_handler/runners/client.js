export default [
  {
    type: 'error_handler',
    run({ values, input }) {
      const strategy = String(values.strategy || 'fallback')
      if (strategy === 'fallback' && values.fallbackValue !== undefined) {
        return { result: values.fallbackValue, error: null, retryCount: 0 }
      }
      return { result: input, error: null, retryCount: 0 }
    },
  },
]
