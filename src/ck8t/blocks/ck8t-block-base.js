/**
 * CK8tBlock — base definition for all CK8T blocks (built-in and community).
 *
 * Community block publishers: call `defineCk8tBlock(yourDef)` instead of
 * exporting a plain object literal. This ensures your block always inherits
 * any new fields added to the base without requiring a publish update.
 *
 * The `hasProgress` flag opts your block into the inline progress footer on
 * the node card. When `true`, the graph-runner injects a `progress` callback
 * into your `run({ values, input, progress })` call. Call it at key stages:
 *
 *   progress({ pct: 0,  step: 1, total: 3, label: 'Starting…' })
 *   progress({ pct: 50, step: 2, total: 3, label: 'Processing…' })
 *   progress({ pct: 100, step: 3, total: 3, label: 'Done' })
 *
 * pct    — 0-100, drives the progress bar fill
 * step   — current step number (shown as "step N / total")
 * total  — total step count
 * label  — short status string shown next to the spinner
 *
 * Progress is automatically cleared by the graph-runner after your `run()`
 * resolves or rejects — you don't need to clear it yourself.
 */
export const CK8tBlockBase = {
  // ── Identity ───────────────────────────────────────────────────────────────
  type:            '',
  name:            '',
  description:     '',
  longDescription: '',
  category:        'custom',
  group:           '',

  // ── Visual ─────────────────────────────────────────────────────────────────
  bgColor:  '#334155',
  icon:     null,
  iconSvg:  null,

  // ── Schema ─────────────────────────────────────────────────────────────────
  subBlocks: [],
  inputs:    {},
  outputs:   {},

  // ── Capabilities ───────────────────────────────────────────────────────────
  hasProgress: false,
  singleton:   false,

  // ── Execution ──────────────────────────────────────────────────────────────
  // run({ values, input, inputsByHandle, progress }) → output object
  run: null,
}

/**
 * Merge a partial block definition with CK8tBlockBase.
 * Your definition takes precedence on every field.
 *
 * @param {Partial<typeof CK8tBlockBase> & { run?: Function }} def
 * @returns {typeof CK8tBlockBase}
 */
export function defineCk8tBlock(def) {
  return Object.assign({}, CK8tBlockBase, def)
}
