/**
 * BlockDebugEngineNode — Node-side port of src/ck8t/debug/block-debug-engine.js.
 *
 * Keep in sync with the other copy at ck8t-server/src/services/block-debug-engine-node.ts
 * (same pattern this project already uses for graph-runner.ts being duplicated across the
 * 3 execution engines — see that file's "Ported from" header comment).
 *
 * Differences from the browser engine:
 *   - preprocessCode() also rewrites CJS `module.exports = [...]` (community block runner
 *     files use CommonJS, not ESM) in addition to the existing ESM `export default` handling.
 *   - The constructed AsyncFunction is given a real `require`, shadowed in as a named
 *     parameter and bound via `createRequire(filePath)`, so a block's own
 *     `require('pdf-lib')` etc. resolves through real Node module resolution — something
 *     the browser engine can never offer.
 *   - block-utils.js's helpers are reimplemented inline (Node btoa is a stable global since
 *     Node 16+, confirmed present on the Node versions this extension targets) rather than
 *     importing the browser ESM file directly into this CJS-built extension.
 */
import { createRequire } from 'module';

function jsonPath(obj: unknown, path: string): unknown {
  if (!path || path === '$') return obj;
  const parts = String(path).replace(/^\$\.?/, '').split('.').filter(Boolean);
  return parts.reduce((a: any, k) => (a == null ? a : a[k]), obj);
}

function interpolateBag(template: string, bag: Record<string, unknown>): string {
  if (!template) return '';
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
    if (!(k in bag)) return m;
    const v = bag[k];
    if (v == null) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  });
}

function evalSafe(expr: string, input: unknown): unknown {
  try { return new Function('input', `return (${expr})`)(input); } catch { return undefined; }
}

function safeJson(s: unknown): unknown {
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return null; }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

function extractMediaUri(value: unknown): { dataUri: string; mimeType: string; isExternalUrl?: boolean } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const m = value.match(/data:(image\/[^;,]+|application\/pdf);base64,([A-Za-z0-9+/=\n]+)/);
    if (m) return { dataUri: m[0].replace(/\s/g, ''), mimeType: m[1] };
    const md = value.match(/!\[[^\]]*\]\((data:(?:image\/[^);]+|application\/pdf);base64,[A-Za-z0-9+/=\n]+)\)/);
    if (md) return extractMediaUri(md[1]);
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item?.type === 'image' && item.data) {
        return { dataUri: `data:${item.mimeType ?? 'image/png'};base64,${item.data}`, mimeType: item.mimeType ?? 'image/png' };
      }
      if (item?.type === 'text' && item.text) { const r = extractMediaUri(item.text); if (r) return r; }
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.__ck8t_image_url === 'string') {
      return { dataUri: obj.__ck8t_image_url as string, mimeType: 'image/png', isExternalUrl: true };
    }
    for (const k of ['image', 'image_data', 'imageData', 'base64', 'data', 'content', 'pdf', 'file']) {
      if (obj[k]) { const r = extractMediaUri(obj[k]); if (r) return r; }
    }
  }
  return null;
}

function extractImageUrl(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.trim() || null;
  if (typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;
  if (Array.isArray(obj.data) && obj.data.length > 0 && typeof obj.data[0]?.url === 'string') return obj.data[0].url;
  const nested = (obj.data as Record<string, unknown>)?.data;
  if (Array.isArray(nested) && typeof nested[0]?.url === 'string') return nested[0].url;
  for (const k of ['url', 'image_url', 'imageUrl', 'src', 'image']) {
    if (typeof obj[k] === 'string') return obj[k] as string;
  }
  return null;
}

const nodeBlockUtils = { jsonPath, interpolateBag, evalSafe, safeJson, arrayBufferToBase64, extractMediaUri, extractImageUrl };

function makeStopError(): Error & { isDebugStop: true } {
  const e = new Error('Execution stopped by user') as Error & { isDebugStop: true };
  e.isDebugStop = true;
  return e;
}

// Note: every whitespace class below is [ \t], never \s — \s matches \n, and a trailing \s*
// before $ can swallow the line's own newline (when followed by a blank line), silently
// shifting every later line number by one and breaking breakpoint↔source-line alignment.
function preprocessCode(code: string): string {
  return code
    .replace(/^[ \t]*import[ \t]+\{[^}]*\}[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import[ \t]+\*[ \t]+as[ \t]+\w+[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^[ \t]*import[ \t]+\w+[ \t]+from[ \t]+['"][^'"]+['"][ \t]*;?[ \t]*$/gm, '')
    .replace(/^export[ \t]+default[ \t]+/gm, 'const __ck8tRunners = ')
    .replace(/^export[ \t]+(function|class|const|let|var)[ \t]+/gm, '$1 ')
    .replace(/^['"]use strict['"];?[ \t]*$/gm, '')
    .replace(/^module\.exports[ \t]*=[ \t]*/gm, 'const __ck8tRunners = ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface RunBodyRange { headerLine: number; openLine: number; closeLine: number }

/**
 * Find the line range of the `run(...) { ... }` method body for the array entry
 * whose `type:` matches blockType. Returns 0-indexed { headerLine, openLine, closeLine }
 * or null if not found. Brace matching is a simple char scan (no string/comment awareness),
 * which is fine for the hand-written, consistently-formatted runner files this targets.
 */
function findRunBodyRange(lines: string[], blockType: string): RunBodyRange | null {
  const typeRe = new RegExp(`type\\s*:\\s*['"\`]${escapeRegExp(blockType)}['"\`]`);
  let typeLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (typeRe.test(lines[i])) { typeLine = i; break; }
  }
  if (typeLine === -1) return null;

  const runHeaderRe = /(^|[\s,{])(async\s+)?run\s*\(/;
  let headerLine = -1;
  for (let i = typeLine; i < lines.length; i++) {
    if (runHeaderRe.test(lines[i])) { headerLine = i; break; }
  }
  if (headerLine === -1) return null;

  let openLine = -1, openCol = -1, parenDepth = 0, sawParenOpen = false;
  outer:
  for (let i = headerLine; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '(') { parenDepth++; sawParenOpen = true; }
      else if (ch === ')') { parenDepth--; }
      else if (ch === '{' && sawParenOpen && parenDepth === 0) { openLine = i; openCol = c; break outer; }
    }
  }
  if (openLine === -1) return null;

  let depth = 0, closeLine = -1;
  for (let i = openLine; i < lines.length; i++) {
    const line = lines[i];
    const start = i === openLine ? openCol : 0;
    for (let c = start; c < line.length; c++) {
      const ch = line[c];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { closeLine = i; break; } }
    }
    if (closeLine !== -1) break;
  }
  if (closeLine === -1) return null;

  return { headerLine, openLine, closeLine };
}

function extractParamNames(sigText: string): string[] {
  const m = sigText.match(/run\s*\(([^)]*)\)/s);
  if (!m) return [];
  const paramText = m[1].trim();
  if (!paramText) return [];
  if (paramText.startsWith('{')) {
    return paramText.replace(/^\{|\}$/g, '').split(',').map(p => p.split(':')[0].trim()).filter(Boolean);
  }
  return [paramText.split(/[=:]/)[0].trim()].filter(Boolean);
}

const CONTINUATION_RE = /^[.?:&|,)\]]/;

function isExecutableLine(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && t !== '*/';
}

function buildVarObj(declaredVars: Set<string>): string {
  const varList = [...declaredVars].filter(v => !['input', 'values', 'console', '__ck8tBp__', '__utils', 'ctx', 'require'].includes(v));
  if (varList.length === 0) return '{}';
  return `{ ${varList.map(v => `${v}: (typeof ${v} !== 'undefined' ? ${v} : undefined)`).join(', ')} }`;
}

/**
 * Inject `await __ck8tBp__(lineNo, vars)` before each breakpointed statement, but only
 * for lines that sit at the top level of the matched run() method body.
 */
function injectModuleBreakpoints(lines: string[], range: RunBodyRange, breakpoints: Set<number>): string[] {
  const { headerLine, openLine, closeLine } = range;
  const out = [...lines];

  if (!/(^|[\s,{])async\s+run\s*\(/.test(out[headerLine])) {
    out[headerLine] = out[headerLine].replace(/(^|[\s,{])(run\s*\()/, (m, p1, p2) => `${p1}async ${p2}`);
  }

  if (breakpoints.size === 0) return out;

  const sigText = out.slice(headerLine, openLine + 1).join('\n');
  const declaredVars = new Set(extractParamNames(sigText));

  let depth = 0;
  const result: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const line = out[i];

    if (i <= openLine || i >= closeLine) {
      result.push(line);
      continue;
    }

    const lineNo = i + 1;
    const trimmed = line.trim();

    // Capture vars as declared by lines *before* this one — a const/let declared on
    // this same line is still in the TDZ until it runs, so referencing it in the
    // pause snapshot would throw.
    if (depth === 0 && breakpoints.has(lineNo) && trimmed.length > 0 && !CONTINUATION_RE.test(trimmed) && isExecutableLine(line)) {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      result.push(`${indent}await __ck8tBp__(${lineNo}, ${buildVarObj(declaredVars)});`);
    }
    result.push(line);

    const declMatch = line.match(/(?:var|let|const)\s+(\w+)/g);
    if (declMatch) for (const d of declMatch) declaredVars.add(d.replace(/(?:var|let|const)\s+/, ''));

    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return result;
}

function serialize(v: unknown): string {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export interface NodeDebugRunOpts {
  blockType: string;
  source: string;
  filePath: string;
  ctx: { values?: Record<string, unknown>; input?: unknown; [k: string]: unknown };
  breakpoints: number[];
  file: string;
  onPaused: (file: string, line: number, variables: unknown[], callStack: unknown[]) => void;
  onResumed: () => void;
  onCompleted: (output: unknown) => void;
  onError: (msg: string) => void;
  onLog: (entry: { level: string; msg: string }) => void;
}

export class BlockDebugEngineNode {
  private _resumeResolve: (() => void) | null = null;
  private _stopped = false;

  async run(opts: NodeDebugRunOpts): Promise<unknown> {
    const { blockType, source, filePath, ctx, breakpoints = [], file, onPaused, onResumed, onCompleted, onError, onLog } = opts;
    this._stopped = false;
    this._resumeResolve = null;

    const bpSet = new Set(breakpoints);
    const processed = preprocessCode(source);
    const lines = processed.split('\n');

    const capture = {
      log:   (...a: unknown[]) => onLog({ level: 'log',   msg: a.map(serialize).join(' ') }),
      info:  (...a: unknown[]) => onLog({ level: 'info',  msg: a.map(serialize).join(' ') }),
      warn:  (...a: unknown[]) => onLog({ level: 'warn',  msg: a.map(serialize).join(' ') }),
      error: (...a: unknown[]) => onLog({ level: 'error', msg: a.map(serialize).join(' ') }),
      debug: (...a: unknown[]) => onLog({ level: 'debug', msg: a.map(serialize).join(' ') }),
    };

    const __ck8tBp__ = async (lineNo: number, capturedVars: Record<string, unknown>) => {
      if (this._stopped) throw makeStopError();

      const baseVars = [
        { name: 'input', value: ctx?.input, type: typeof ctx?.input },
        ...Object.entries(ctx?.values || {}).map(([k, v]) => ({ name: k, value: v, type: typeof v })),
      ];
      const variables = [
        ...baseVars,
        ...Object.entries(capturedVars || {}).map(([k, v]) => ({ name: k, value: v, type: typeof v })),
      ];
      const callStack = [{ fn: `${blockType}.run`, file, line: lineNo, col: 1, isUser: true }];

      onPaused(file, lineNo, variables, callStack);
      await new Promise<void>(resolve => { this._resumeResolve = resolve; });
      this._resumeResolve = null;
      if (this._stopped) throw makeStopError();
      onResumed();
    };

    try {
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      const range = findRunBodyRange(lines, blockType);
      if (!range) {
        throw new Error(`Could not locate run() for block type "${blockType}" — debugging is unavailable for this file.`);
      }
      const body = injectModuleBreakpoints(lines, range, bpSet).join('\n');
      const nodeRequire = createRequire(filePath);
      const fn = new AsyncFn('__utils', '__ck8tBp__', '__ck8tCtx', 'console', 'require', `
        "use strict";
        const { ${Object.keys(nodeBlockUtils).join(', ')} } = __utils;
        ${body}
        const __ck8tEntry = __ck8tRunners.find((r) => r.type === ${JSON.stringify(blockType)});
        if (!__ck8tEntry) throw new Error(${JSON.stringify(`No runner found for block type "${blockType}"`)});
        return __ck8tEntry.run(__ck8tCtx);
      `);
      const output = await fn(nodeBlockUtils, __ck8tBp__, ctx, capture, nodeRequire);

      onCompleted(output);
      return output;
    } catch (e: any) {
      if (!e?.isDebugStop) onError(e?.message || String(e));
      throw e;
    }
  }

  resume(): void {
    const r = this._resumeResolve;
    this._resumeResolve = null;
    r?.();
  }

  stop(): void {
    this._stopped = true;
    const r = this._resumeResolve;
    this._resumeResolve = null;
    r?.();
  }

  stepOver(): void { this.resume(); }
  stepInto(): void { this.resume(); }
  stepOut(): void { this.resume(); }
}
