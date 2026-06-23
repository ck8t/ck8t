export default [
  {
    type: 'wait',
    async run({ values, input }) {
      const mode = String(values.mode || 'duration')
      const t0 = Date.now()
      if (mode === 'until') {
        const until = new Date(String(values.until || new Date().toISOString())).getTime()
        await new Promise(r => setTimeout(r, Math.max(0, until - Date.now())))
      } else {
        await new Promise(r => setTimeout(r, Number(values.duration ?? values.ms ?? 0)))
      }
      return { output: input, elapsed: Date.now() - t0 }
    },
  },
]
