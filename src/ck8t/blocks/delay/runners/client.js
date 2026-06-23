export default [
  {
    type: 'delay',
    async run({ values, input }) {
      const duration = Number(values.duration ?? values.ms ?? 0)
      const unit = String(values.unit || 'ms')
      let ms = duration
      if (unit === 's') ms = duration * 1000
      else if (unit === 'm') ms = duration * 60_000
      else if (unit === 'h') ms = duration * 3_600_000
      const t0 = Date.now()
      if (ms > 0) await new Promise(r => setTimeout(r, ms))
      return { output: input ?? null, elapsed: Date.now() - t0 }
    },
  },
]
