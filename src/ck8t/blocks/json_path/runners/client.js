import { jsonPath, safeJson } from '../../block-utils.js'

export default [
  {
    type: 'json_path',
    run({ values, input }) {
      let obj = typeof input === 'string' ? safeJson(input) : input
      if (obj == null) obj = {}
      const path = values.path || '$'
      const result = path === '$' ? obj : jsonPath(obj, path)
      if (result === undefined && values.fallback != null && values.fallback !== '') return values.fallback
      return result !== undefined ? result : null
    },
  },
]
