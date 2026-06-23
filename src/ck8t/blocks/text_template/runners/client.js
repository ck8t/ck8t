import { interpolateBag, safeJson } from '../../block-utils.js'

export default [
  {
    type: 'text_template',
    run({ values, input }) {
      const template = values.template || '{{input}}'
      const bag = { input: typeof input === 'string' ? input : JSON.stringify(input ?? '') }
      const obj = typeof input === 'string' ? safeJson(input) : input
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) bag[k] = v
      }
      return interpolateBag(template, bag)
    },
  },
]
