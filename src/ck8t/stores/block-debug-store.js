/**
 * Block-level debug mode store.
 *
 * Tracks:
 *  - which blocks have debug mode toggled on (debugEnabled set)
 *  - per-block breakpoint lines (breakpoints map)
 *  - per-block last-run debug snapshots (snapshots map)
 *
 * Used by:
 *  - SubBlockRenderer  → pass breakpoints + gutter to BlockMonacoEditor
 *  - WorkflowNode      → show DBG badge + context menu toggle
 *  - graph-runner      → capture console output + store snapshots
 *  - block-debug-panel → display snapshots in the bottom run panel
 */
import { create } from 'zustand'

export const useBlockDebugStore = create((set, get) => ({
  // Set of nodeIds that have debug mode on
  debugEnabled: new Set(),

  // Map<nodeId, number[]> — breakpoint line numbers per block
  breakpoints: {},

  // Map<nodeId, DebugSnapshot> — last run debug data per block
  // DebugSnapshot: { input, output, consoleLogs, error, executedAt, durationMs, values }
  snapshots: {},

  toggleDebug(nodeId) {
    set((s) => {
      const next = new Set(s.debugEnabled)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return { debugEnabled: next }
    })
  },

  isDebugEnabled(nodeId) {
    return get().debugEnabled.has(nodeId)
  },

  setBreakpoints(nodeId, lines) {
    set((s) => ({ breakpoints: { ...s.breakpoints, [nodeId]: lines } }))
  },

  setSnapshot(nodeId, snapshot) {
    set((s) => ({ snapshots: { ...s.snapshots, [nodeId]: snapshot } }))
  },

  getSnapshot(nodeId) {
    return get().snapshots[nodeId] ?? null
  },

  clearSnapshot(nodeId) {
    set((s) => { const next = { ...s.snapshots }; delete next[nodeId]; return { snapshots: next } })
  },

  clearAll() {
    set({ debugEnabled: new Set(), breakpoints: {}, snapshots: {} })
  },
}))
