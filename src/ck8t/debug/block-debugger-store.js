import { create } from 'zustand'

/**
 * Store for the interactive block debugger popup.
 * Separate from block-debug-store (which handles lightweight post-run snapshots).
 * This store drives the full step-through debugger UI.
 */
export const useBlockDebuggerStore = create((set, get) => ({
  // ─── Popup state ────────────────────────────────────────────────────────────
  isOpen: false,
  nodeId: null,
  blockType: null,
  blockTitle: null,

  // ─── Files (tabs) ───────────────────────────────────────────────────────────
  files: [],          // [{ name, path, content, runnerType }]
  activeFile: null,   // name of the active tab

  // ─── Breakpoints ────────────────────────────────────────────────────────────
  breakpoints: {},    // { 'client.js': [5, 12], 'extension.js': [3] }

  // ─── Execution state ────────────────────────────────────────────────────────
  status: 'idle',     // 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  pausedLine: null,
  pausedFile: null,

  // ─── Test input / output ────────────────────────────────────────────────────
  testInput: '',
  lastOutput: null,
  lastError: null,

  // ─── Console ────────────────────────────────────────────────────────────────
  consoleLogs: [],

  // ─── Actions ────────────────────────────────────────────────────────────────

  openDebugger(nodeId, blockType, blockTitle) {
    set({
      isOpen: true,
      nodeId,
      blockType,
      blockTitle: blockTitle || blockType,
      files: [],
      activeFile: null,
      status: 'idle',
      pausedLine: null,
      pausedFile: null,
      consoleLogs: [],
      lastOutput: null,
      lastError: null,
    })
  },

  closeDebugger() {
    set({ isOpen: false, nodeId: null, blockType: null, status: 'idle', pausedLine: null })
  },

  setFiles(files) {
    set({ files, activeFile: files[0]?.name || null })
  },

  setActiveFile(name) {
    set({ activeFile: name })
  },

  toggleBreakpoint(filename, line) {
    const curr = get().breakpoints[filename] || []
    const next = curr.includes(line) ? curr.filter(l => l !== line) : [...curr, line].sort((a, b) => a - b)
    set({ breakpoints: { ...get().breakpoints, [filename]: next } })
  },

  setBreakpoints(filename, lines) {
    set({ breakpoints: { ...get().breakpoints, [filename]: lines } })
  },

  setTestInput(v) { set({ testInput: v }) },

  setRunning() {
    set({ status: 'running', pausedLine: null, pausedFile: null, consoleLogs: [], lastOutput: null, lastError: null })
  },

  setPaused(file, line) {
    set({ status: 'paused', pausedFile: file, pausedLine: line, activeFile: file })
  },

  setResumed() {
    set({ status: 'running', pausedLine: null, pausedFile: null })
  },

  setCompleted(output) {
    set({ status: 'completed', pausedLine: null, pausedFile: null, lastOutput: output })
  },

  setError(msg) {
    set({ status: 'error', lastError: msg, pausedLine: null, pausedFile: null })
  },

  setStopped() {
    set({ status: 'idle', pausedLine: null, pausedFile: null })
  },

  addLog(entry) {
    set(s => ({ consoleLogs: [...s.consoleLogs, entry] }))
  },

  clearLogs() {
    set({ consoleLogs: [] })
  },
}))
