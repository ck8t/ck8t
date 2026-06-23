export default [
  {
    type: 'function',
    run({ values, input, nodeId }) {
      const src = values.code || 'return input'
      const logs = []
      const capture = {
        log:   (...a) => logs.push({ level: 'log',   msg: a.map(_ser).join(' ') }),
        info:  (...a) => logs.push({ level: 'info',  msg: a.map(_ser).join(' ') }),
        warn:  (...a) => logs.push({ level: 'warn',  msg: a.map(_ser).join(' ') }),
        error: (...a) => logs.push({ level: 'error', msg: a.map(_ser).join(' ') }),
        debug: (...a) => logs.push({ level: 'debug', msg: a.map(_ser).join(' ') }),
      }
      const fn = new Function('input', 'values', 'console', src)
      let output, err
      try { output = fn(input, values, capture) } catch (e) { err = e }
      if (err) throw err
      return output
    },
  },
]

function _ser(a) { return typeof a === 'string' ? a : (function() { try { return JSON.stringify(a) } catch { return String(a) } })() }
