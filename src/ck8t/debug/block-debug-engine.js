/**
 * BlockDebugEngine — client-side step-through debugger for JS block code.
 *
 * Works for:
 *   - Function blocks (values.code)
 *   - Community block client.js runners (pure JS, no Node APIs)
 *
 * Approach:
 *   1. Transform code: inject `await __ck8tBp__(lineNo)` before each breakpointed line
 *   2. Run wrapped in `new AsyncFunction` so `await` works at top level
 *   3. `__ck8tBp__` returns a Promise that only resolves when `resume()` is called
 *   4. `stop()` causes the next `__ck8tBp__` to throw, unwinding the callstack
 */

const STOP_SIGNAL = '__ck8t_stopped__'

export class BlockDebugEngine {
  constructor() {
    this._resumeResolve = null
    this._stopped = false
    this._stepResolve = null
  }

  /**
   * @param {string} code - JS source to execute
   * @param {{
   *   input: unknown,
   *   values: object,
   *   breakpoints: number[],
   *   onPaused: (file: string, line: number) => void,
   *   onResumed: () => void,
   *   onCompleted: (output: unknown) => void,
   *   onError: (msg: string) => void,
   *   onLog: (entry: {level:string, msg:string}) => void,
   *   file: string,
   * }} opts
   */
  async run(code, opts) {
    const { input, values, breakpoints = [], onPaused, onResumed, onCompleted, onError, onLog, file = 'code' } = opts
    this._stopped = false
    this._resumeResolve = null

    const bpSet = new Set(breakpoints)
    const transformed = transformForDebug(code, bpSet)

    const capture = {
      log:   (...a) => onLog({ level: 'log',   msg: a.map(serialize).join(' ') }),
      info:  (...a) => onLog({ level: 'info',  msg: a.map(serialize).join(' ') }),
      warn:  (...a) => onLog({ level: 'warn',  msg: a.map(serialize).join(' ') }),
      error: (...a) => onLog({ level: 'error', msg: a.map(serialize).join(' ') }),
      debug: (...a) => onLog({ level: 'debug', msg: a.map(serialize).join(' ') }),
    }

    const __ck8tBp__ = async (lineNo) => {
      if (this._stopped) throw new Error(STOP_SIGNAL)
      onPaused(file, lineNo)
      await new Promise(resolve => { this._resumeResolve = resolve })
      this._resumeResolve = null
      if (this._stopped) throw new Error(STOP_SIGNAL)
      onResumed()
    }

    try {
      // Wrap in async IIFE so top-level await works even if user code doesn't use it
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor
      const fn = new AsyncFn('input', 'values', 'console', '__ck8tBp__', `
        "use strict";
        return (async function __ck8t_runner__() {
          ${transformed}
        })()
      `)
      const output = await fn(input, values, capture, __ck8tBp__)
      onCompleted(output)
    } catch (e) {
      if (e?.message !== STOP_SIGNAL) {
        onError(e?.message || String(e))
      }
    }
  }

  resume() {
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  stop() {
    this._stopped = true
    const r = this._resumeResolve
    this._resumeResolve = null
    r?.()
  }

  // Step-over: same as resume for now (we pause at the NEXT breakpoint)
  stepOver() {
    this.resume()
  }
}

/**
 * Transform JS source to inject `await __ck8tBp__(lineNo)` BEFORE each breakpointed line.
 * Simple line-based approach — doesn't require an AST parser.
 */
function transformForDebug(code, breakpoints) {
  if (breakpoints.size === 0) return code
  const lines = code.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    if (breakpoints.has(lineNo) && isExecutableLine(lines[i])) {
      out.push(`await __ck8tBp__(${lineNo});`)
    }
    out.push(lines[i])
  }
  return out.join('\n')
}

/** Skip blank lines and comment-only lines — don't inject pause points there */
function isExecutableLine(line) {
  const t = line.trim()
  return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && t !== '*/'
}

function serialize(v) {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}
