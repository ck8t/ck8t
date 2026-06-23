/**
 * BlockDebugEngine — step-through debugger for JS block code.
 *
 * Two execution modes:
 *   - 'module': community/core block runner files — `export default [{ type, run(ctx) {...} }]`.
 *     Locates the `run()` method body for the matching block type and injects breakpoints
 *     only inside that function, then calls `entry.run(ctx)` with the real production ctx
 *     (the same ctx graph-runner.js builds via buildRunCtx()).
 *   - 'script': flat code (a `function` block's `values.code`) — injects breakpoints at the
 *     top level of the script itself, same as a Daakia pre/post-request script.
 *
 * Pause/resume: `__ck8tBp__` returns a Promise that only resolves when `resume()` is called.
 * `stop()` causes the next `__ck8tBp__` to throw, unwinding the callstack.
 */
import * as blockUtils from '../blocks/block-utils.js'

function makeStopError() {
  const e = new Error('Execution stopped by user')
  e.isDebugStop = true
  return e
}

// Note: every whitespace class below is [ \t], never \s — \s matches \n, and
// a trailing \s* before $ can swallow the line's own newline (when followed
// by a blank line), silently shifting every later line number by one and
// breaking breakpoint↔source-line alignment.
function preprocessCode(code) {
  return code
    .replace(/^[ \t]*import[ \t]+\{[^}]*\}[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import[ \t]+\*[ \t]+as[ \t]+\w+[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import[ \t]+\w+[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^export[ \t]+default[ \t]+/gm, 'const __ck8tRunners = ')
    .replace(/^export[ \t]+(function|class|const|let|var)[ \t]+/gm, '$1 ')
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find the line range of the `run(...) { ... }` method body for the array entry
 * whose `type:` matches blockType. Returns 0-indexed { headerLine, openLine, closeLine }
 * or null if not found. Brace matching is a simple char scan (no string/comment awareness),
 * which is fine for the hand-written, consistently-formatted runner files this targets.
 */
function findRunBodyRange(lines, blockType) {
  const typeRe = new RegExp(`type\\s*:\\s*['"\`]${escapeRegExp(blockType)}['"\`]`)
  let typeLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (typeRe.test(lines[i])) { typeLine = i; break }
  }
  if (typeLine === -1) return null

  const runHeaderRe = /(^|[\s,{])(async\s+)?run\s*\(/
  let headerLine = -1
  for (let i = typeLine; i < lines.length; i++) {
    if (runHeaderRe.test(lines[i])) { headerLine = i; break }
  }
  if (headerLine === -1) return null

  let openLine = -1, openCol = -1, parenDepth = 0, sawParenOpen = false
  outer:
  for (let i = headerLine; i < lines.length; i++) {
    const line = lines[i]
    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      if (ch === '(') { parenDepth++; sawParenOpen = true }
      else if (ch === ')') { parenDepth-- }
      else if (ch === '{' && sawParenOpen && parenDepth === 0) { openLine = i; openCol = c; break outer }
    }
  }
  if (openLine === -1) return null

  let depth = 0, closeLine = -1
  for (let i = openLine; i < lines.length; i++) {
    const line = lines[i]
    const start = i === openLine ? openCol : 0
    for (let c = start; c < line.length; c++) {
      const ch = line[c]
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth === 0) { closeLine = i; break } }
    }
    if (closeLine !== -1) break
  }
  if (closeLine === -1) return null

  return { headerLine, openLine, closeLine }
}

function extractParamNames(sigText) {
  const m = sigText.match(/run\s*\(([^)]*)\)/s)
  if (!m) return []
  const paramText = m[1].trim()
  if (!paramText) return []
  if (paramText.startsWith('{')) {
    return paramText.replace(/^\{|\}$/g, '').split(',').map(p => p.split(':')[0].trim()).filter(Boolean)
  }
  return [paramText.split(/[=:]/)[0].trim()].filter(Boolean)
}

// Lines starting with these characters continue a previous expression and must not get a
// breakpoint injected before them.
// `^\}` catches all lines starting with `}` — closing braces of object literals, else/catch/finally
// clauses, etc. `await` before a `}` inside an object literal body causes SyntaxError because
// `await` is parsed as a property name there.
const CONTINUATION_RE = /^[.?:&|,)\]]|^\}/

/**
 * Inject `await __ck8tBp__(lineNo, vars)` before each breakpointed statement, but only
 * for lines that sit at the top level of the matched run() method body (mirrors Daakia's
 * brace-depth-0 statement detection, scoped to the function instead of the whole file).
 */
function injectModuleBreakpoints(lines, range) {
  const { headerLine, openLine, closeLine } = range
  const out = [...lines]

  if (!/(^|[\s,{])async\s+run\s*\(/.test(out[headerLine])) {
    out[headerLine] = out[headerLine].replace(/(^|[\s,{])(run\s*\()/, (m, p1, p2) => `${p1}async ${p2}`)
  }

  const sigText = out.slice(headerLine, openLine + 1).join('\n')
  const declaredVars = new Set(extractParamNames(sigText))

  const result = []
  for (let i = 0; i < out.length; i++) {
    const line = out[i]

    if (i <= openLine || i >= closeLine) {
      result.push(line)
      continue
    }

    const lineNo = i + 1
    const trimmed = line.trim()

    // Inject before every executable statement — __ck8tBp__ decides at runtime
    // whether to actually pause (breakpoint hit or step mode active).
    // Capture vars as declared by lines *before* this one — a const/let
    // declared on this same line is still in the TDZ until it runs, so
    // referencing it in the pause snapshot would throw.
    if (trimmed.length > 0 && !CONTINUATION_RE.test(trimmed) && isExecutableLine(line)) {
      const indent = line.match(/^\s*/)[0]
      result.push(`${indent}await __ck8tBp__(${lineNo}, ${buildVarObj(declaredVars)});`)
    }
    result.push(line)

    const declMatch = line.match(/(?:var|let|const)\s+(\w+)/g)
    if (declMatch) for (const d of declMatch) declaredVars.add(d.replace(/(?:var|let|const)\s+/, ''))
  }
  return result
}

function injectFlatBreakpoints(lines) {
  const declaredVars = new Set()
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.length > 0 && !CONTINUATION_RE.test(trimmed) && isExecutableLine(line)) {
      out.push(`await __ck8tBp__(${lineNo}, ${buildVarObj(declaredVars)});`)
    }
    out.push(line)
    const declMatch = line.match(/(?:var|let|const)\s+(\w+)/g)
    if (declMatch) for (const d of declMatch) declaredVars.add(d.replace(/(?:var|let|const)\s+/, ''))
  }
  return out
}

function buildVarObj(declaredVars) {
  const varList = [...declaredVars].filter(v => !['input', 'values', 'console', '__ck8tBp__', '__utils', 'ctx'].includes(v))
  if (varList.length === 0) return '{}'
  return `{ ${varList.map(v => `${v}: (typeof ${v} !== 'undefined' ? ${v} : undefined)`).join(', ')} }`
}

function isExecutableLine(line) {
  const t = line.trim()
  if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t === '*/') return false
  // Skip object-property lines — injecting `await` before these causes SyntaxError because
  // inside an object literal `await` is parsed as a property name.
  // `key: value` pattern (excludes `::` namespace, `case x:`, and labeled statements with values)
  if (/^[a-zA-Z_$][\w$]*\s*:(?!:)/.test(t) && !/^(?:case|default)\s/.test(t)) return false
  // `shorthand,` pattern — bare identifier with trailing comma (shorthand object property)
  if (/^[a-zA-Z_$][\w$]*\s*,\s*$/.test(t)) return false
  return true
}

function serialize(v) {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

export class BlockDebugEngine {
  constructor() {
    this._resumeResolve = null
    this._stopped = false
    this._stepMode = false
  }

  /**
   * @param {{
   *   mode: 'module' | 'script',
   *   source: string,
   *   blockType?: string,        // required for mode: 'module'
   *   ctx?: object,               // required for mode: 'module' — passed to entry.run(ctx)
   *   input?: unknown,            // used for mode: 'script'
   *   values?: object,            // used for mode: 'script'
   *   breakpoints: number[],
   *   file: string,
   *   onPaused: (file, line, variables, callStack) => void,
   *   onResumed: () => void,
   *   onCompleted: (output) => void,
   *   onError: (msg) => void,
   *   onLog: (entry) => void,
   * }} opts
   */
  async run(opts) {
    const { mode, source, blockType, ctx, input, values, breakpoints = [], onPaused, onResumed, onCompleted, onError, onLog, file = 'code' } = opts
    this._stopped = false
    this._resumeResolve = null

    const bpSet = new Set(breakpoints)
    const processed = preprocessCode(source)
    const lines = processed.split('\n')

    const capture = {
      log:   (...a) => onLog({ level: 'log',   msg: a.map(serialize).join(' ') }),
      info:  (...a) => onLog({ level: 'info',  msg: a.map(serialize).join(' ') }),
      warn:  (...a) => onLog({ level: 'warn',  msg: a.map(serialize).join(' ') }),
      error: (...a) => onLog({ level: 'error', msg: a.map(serialize).join(' ') }),
      debug: (...a) => onLog({ level: 'debug', msg: a.map(serialize).join(' ') }),
    }

    const __ck8tBp__ = async (lineNo, capturedVars) => {
      if (this._stopped) throw makeStopError()
      if (!this._stepMode && !bpSet.has(lineNo)) return

      const baseVars = mode === 'module'
        ? [
            { name: 'input', value: ctx?.input, type: typeof ctx?.input },
            ...Object.entries(ctx?.values || {}).map(([k, v]) => ({ name: k, value: v, type: typeof v })),
          ]
        : [
            { name: 'input', value: input, type: typeof input },
            ...Object.entries(values || {}).map(([k, v]) => ({ name: k, value: v, type: typeof v })),
          ]

      const variables = [
        ...baseVars,
        ...Object.entries(capturedVars || {}).map(([k, v]) => ({ name: k, value: v, type: typeof v })),
      ]
      const callStack = [
        { fn: mode === 'module' ? `${blockType}.run` : '<anonymous>', file, line: lineNo, col: 1, isUser: true },
      ]

      onPaused(file, lineNo, variables, callStack)
      await new Promise(resolve => { this._resumeResolve = resolve })
      this._resumeResolve = null
      if (this._stopped) throw makeStopError()
      onResumed()
    }

    try {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor
      let output

      if (mode === 'module') {
        const range = findRunBodyRange(lines, blockType)
        if (!range) {
          throw new Error(`Could not locate run() for block type "${blockType}" — debugging is unavailable for this file.`)
        }
        const body = injectModuleBreakpoints(lines, range).join('\n')
        const fn = new AsyncFn('__utils', '__ck8tBp__', '__ck8tCtx', 'console', `
          "use strict";
          const { ${Object.keys(blockUtils).join(', ')} } = __utils;
          ${body}
          const __ck8tEntry = __ck8tRunners.find(r => r.type === ${JSON.stringify(blockType)});
          if (!__ck8tEntry) throw new Error(${JSON.stringify(`No runner found for block type "${blockType}"`)});
          return __ck8tEntry.run(__ck8tCtx);
        `)
        output = await fn(blockUtils, __ck8tBp__, ctx, capture)
      } else {
        const body = injectFlatBreakpoints(lines).join('\n')
        const fn = new AsyncFn('input', 'values', 'console', '__ck8tBp__', '__utils', `
          "use strict";
          const { ${Object.keys(blockUtils).join(', ')} } = __utils;
          return (async function __ck8t_runner__() {
            ${body}
          })()
        `)
        output = await fn(input, values, capture, __ck8tBp__, blockUtils)
      }

      onCompleted(output)
      return output
    } catch (e) {
      if (!e?.isDebugStop) onError(e?.message || String(e))
      throw e
    }
  }

  resume() {
    this._stepMode = false
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  stop() {
    this._stopped = true
    this._stepMode = false
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  stepOver() {
    this._stepMode = true
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  stepInto() {
    this._stepMode = true
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  stepOut() {
    this._stepMode = false
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }
}
