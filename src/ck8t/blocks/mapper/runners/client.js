export default [
  {
    type: 'mapper',
    async run({ values, input, getSkill, runSkill }) {
      const mode = values.mode || 'json_parse'
      switch (mode) {
        case 'json_parse': {
          if (typeof input === 'object' && input !== null) return input
          if (typeof input !== 'string') return input
          try { return JSON.parse(input) } catch { throw new Error('Mapper: input is not valid JSON') }
        }
        case 'json_stringify':
          return typeof input === 'string' ? input : JSON.stringify(input)
        case 'to_number': {
          const n = Number(input)
          if (Number.isNaN(n)) throw new Error(`Mapper: cannot convert "${String(input).slice(0, 50)}" to number`)
          return n
        }
        case 'to_boolean':
          if (typeof input === 'boolean') return input
          if (input === 'true' || input === '1') return true
          if (input === 'false' || input === '0' || input === '' || input == null) return false
          return Boolean(input)
        case 'to_string':
          if (typeof input === 'string') return input
          return input == null ? '' : (typeof input === 'object' ? JSON.stringify(input) : String(input))
        case 'merge_fields': {
          const obj = (input && typeof input === 'object' && !Array.isArray(input)) ? { ...input } : {}
          let fields = Array.isArray(values.fields) ? values.fields : []
          if (typeof values.fields === 'string') { try { fields = JSON.parse(values.fields) } catch { fields = [] } }
          for (const row of fields) {
            if (!Array.isArray(row) || row.length < 2) continue
            const key = String(row[0] || '').trim()
            if (!key) continue
            obj[key] = row[1]
          }
          return obj
        }
        case 'skill': {
          const skillId = values.skillId
          if (!skillId) throw new Error('Mapper: no skill selected. Choose a skill from the dropdown.')
          const skill = getSkill?.(skillId)
          if (!skill) throw new Error(`Mapper: skill "${skillId}" not found in workspace.`)
          const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? null)
          return await runSkill?.(skill, inputStr)
        }
        default:
          return input
      }
    },
  },
]
