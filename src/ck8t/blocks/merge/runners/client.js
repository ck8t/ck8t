export default [
  {
    type: 'merge',
    run({ values, input }) {
      const mode = String(values.mode || 'append')
      const inputs = Array.isArray(input) ? input : [input]
      function deepMerge(target, source) {
        if (source == null || typeof source !== 'object' || Array.isArray(source)) return source ?? target
        if (target == null || typeof target !== 'object' || Array.isArray(target)) return source
        const out = { ...target }
        for (const k of Object.keys(source)) {
          out[k] = (typeof source[k] === 'object' && !Array.isArray(source[k]) &&
                    typeof target[k] === 'object' && !Array.isArray(target[k]))
            ? deepMerge(target[k], source[k])
            : source[k]
        }
        return out
      }
      switch (mode) {
        case 'append': {
          const merged = []
          for (const item of inputs) { if (Array.isArray(item)) merged.push(...item); else merged.push(item) }
          return { merged, count: merged.length }
        }
        case 'position': {
          const merged = []
          for (let i = 0; i < inputs.length; i++) merged[i] = inputs[i]
          return { merged, count: merged.length }
        }
        case 'key':
        case 'match': {
          const merged = {}
          for (const item of inputs) { if (item && typeof item === 'object' && !Array.isArray(item)) Object.assign(merged, item) }
          return { merged, count: Object.keys(merged).length }
        }
        case 'dedupe': {
          const merged = [], seen = new Set()
          for (const item of inputs) {
            const items = Array.isArray(item) ? item : [item]
            for (const i of items) {
              const key = JSON.stringify(i)
              if (!seen.has(key)) { seen.add(key); merged.push(i) }
            }
          }
          return { merged, count: merged.length }
        }
        case 'deep_merge': {
          const merged = inputs.reduce((acc, item) => deepMerge(acc, item), {})
          return { merged, count: Object.keys(merged).length }
        }
        default: {
          const merged = []
          for (const item of inputs) { if (Array.isArray(item)) merged.push(...item); else merged.push(item) }
          return { merged, count: merged.length }
        }
      }
    },
  },
]
