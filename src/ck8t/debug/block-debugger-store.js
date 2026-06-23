import { create } from 'zustand'
import { useTabsStore } from '../stores/tabs-store'

/**
 * Store for the interactive block debugger popup.
 * Matches Daakia's debug-store shape: variables, callStack,
 * disabled/conditional breakpoints, mute toggle.
 */
export const useBlockDebuggerStore = create((set, get) => ({
  // ─── Popup state ────────────────────────────────────────────────────────────
  isOpen: false,
  nodeId: null,
  blockType: null,
  blockTitle: null,
  blockIcon: null,      // React component ref
  blockBgColor: null,   // css color string

  // ─── Files (tabs) ───────────────────────────────────────────────────────────
  files: [],          // [{ name, path, content, runnerType }]
  activeFile: null,
  filesStatus: 'loading', // 'loading' | 'loaded'

  // ─── Breakpoints ────────────────────────────────────────────────────────────
  breakpoints: {},            // { 'client.js': [5, 12] }
  disabledBreakpoints: {},    // { 'client.js': [5] }
  conditions: {},             // { 'client.js': { 5: 'x > 3' } }
  breakpointsMuted: false,

  // ─── Execution state ────────────────────────────────────────────────────────
  status: 'idle',     // 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  pausedLine: null,
  pausedFile: null,

  // ─── Variables / call stack (Daakia-style) ───────────────────────────────────
  variables: [],      // [{ name, value, type }]
  callStack: [],      // [{ fn, file, line, col, isUser }]

  // ─── Output ─────────────────────────────────────────────────────────────────
  lastOutput: null,
  lastError: null,

  // ─── Live engine (set by graph-runner.js when a debug-driven run starts) ────
  engine: null,
  // Replay info for the last canvas-triggered debug run, used by Restart
  lastDebugRun: null, // { mode, source, blockType, ctx, input, values, file }

  // ─── Remote (WS-driven) debug session ───────────────────────────────────────
  // Set when extension.js or server.js debug path is active. Handle exposes
  // resume/stepOver/stepInto/stepOut/stop/close.
  remoteSession: null, // { sessionId, handle } | null

  // ─── "Test on Server" status — separate from main status so a server-test
  // run's "connecting" state doesn't clobber idle/paused for the browser path ─
  serverTestStatus: 'idle', // 'idle' | 'connecting' | 'running' | 'unreachable'

  // ─── Console ────────────────────────────────────────────────────────────────
  consoleLogs: [],

  // ─── Navigate (click breakpoint row → jump to line) ─────────────────────────
  navigateLine: null,
  navigateFile: null,

  // ─── Actions ────────────────────────────────────────────────────────────────

  openDebugger(nodeId, blockType, blockTitle, blockIcon, blockBgColor) {
    set({
      isOpen: true,
      nodeId,
      blockType,
      blockTitle: blockTitle || blockType,
      blockIcon: blockIcon || null,
      blockBgColor: blockBgColor || null,
      files: [],
      activeFile: null,
      filesStatus: 'loading',
      status: 'idle',
      pausedLine: null,
      pausedFile: null,
      variables: [],
      callStack: [],
      consoleLogs: [],
      lastOutput: null,
      lastError: null,
    })
    // Open the Debugger tab in the center pane
    useTabsStore.getState().openDebugger()
  },

  closeDebugger() {
    set({ isOpen: false, nodeId: null, blockType: null, status: 'idle', pausedLine: null, variables: [], callStack: [] })
    useTabsStore.getState().closeDebuggerTab()
  },

  setFiles(files) {
    set({ files, activeFile: files[0]?.name || null, filesStatus: 'loaded' })
  },

  setActiveFile(name) {
    set({ activeFile: name })
  },

  // ─── Breakpoint actions ──────────────────────────────────────────────────────

  toggleBreakpoint(filename, line) {
    const bp = get().breakpoints
    const curr = bp[filename] || []
    const next = curr.includes(line) ? curr.filter(l => l !== line) : [...curr, line].sort((a, b) => a - b)
    set({ breakpoints: { ...bp, [filename]: next } })
  },

  addConditionalBreakpoint(filename, line, condition) {
    const { breakpoints, conditions } = get()
    const curr = breakpoints[filename] || []
    const updated = curr.includes(line) ? curr : [...curr, line].sort((a, b) => a - b)
    const fileConds = { ...(conditions[filename] || {}), [line]: condition }
    set({ breakpoints: { ...breakpoints, [filename]: updated }, conditions: { ...conditions, [filename]: fileConds } })
  },

  toggleDisableBreakpoint(filename, line) {
    const { disabledBreakpoints } = get()
    const curr = disabledBreakpoints[filename] || []
    const next = curr.includes(line) ? curr.filter(l => l !== line) : [...curr, line]
    set({ disabledBreakpoints: { ...disabledBreakpoints, [filename]: next } })
  },

  removeBreakpoint(filename, line) {
    const { breakpoints, conditions, disabledBreakpoints } = get()
    const updatedBp = { ...breakpoints, [filename]: (breakpoints[filename] || []).filter(l => l !== line) }
    const updatedCond = { ...(conditions[filename] || {}) }
    delete updatedCond[line]
    const updatedDisabled = { ...disabledBreakpoints, [filename]: (disabledBreakpoints[filename] || []).filter(l => l !== line) }
    set({ breakpoints: updatedBp, conditions: { ...conditions, [filename]: updatedCond }, disabledBreakpoints: updatedDisabled })
  },

  clearAllBreakpoints() {
    set({ breakpoints: {}, conditions: {}, disabledBreakpoints: {} })
  },

  toggleMuteBreakpoints() {
    set(s => ({ breakpointsMuted: !s.breakpointsMuted }))
  },

  setBreakpoints(filename, lines) {
    set({ breakpoints: { ...get().breakpoints, [filename]: lines } })
  },

  // ─── Execution state actions ──────────────────────────────────────────────────

  setEngine(engine) { set({ engine }) },

  setLastDebugRun(info) { set({ lastDebugRun: info }) },

  // ─── Remote session control ───────────────────────────────────────────────

  startRemoteSession(sessionId, handle) {
    set({ remoteSession: { sessionId, handle } })
  },

  clearRemoteSession() {
    get().remoteSession?.handle?.close?.()
    set({ remoteSession: null })
  },

  remoteResume()   { get().remoteSession?.handle?.resume?.() },
  remoteStepOver() { get().remoteSession?.handle?.stepOver?.() },
  remoteStepInto() { get().remoteSession?.handle?.stepInto?.() },
  remoteStepOut()  { get().remoteSession?.handle?.stepOut?.() },
  remoteStop() {
    get().remoteSession?.handle?.stop?.()
    set({ remoteSession: null, serverTestStatus: 'idle' })
    useBlockDebuggerStore.getState().setStopped()
  },

  setServerTestStatus(s) { set({ serverTestStatus: s }) },

  setRunning() {
    set({ status: 'running', pausedLine: null, pausedFile: null, variables: [], callStack: [], consoleLogs: [], lastOutput: null, lastError: null })
  },

  setPaused(file, line, variables, callStack) {
    // Merge variables IntelliJ-style: update existing, add new, never remove
    const merged = [...get().variables]
    for (const v of (variables || [])) {
      const idx = merged.findIndex(m => m.name === v.name)
      if (idx >= 0) merged[idx] = v
      else merged.push(v)
    }
    set({
      status: 'paused',
      pausedFile: file,
      pausedLine: line,
      activeFile: file,
      variables: merged,
      callStack: callStack || [],
    })
    // Auto-navigate: switch to Debugger tab when breakpoint is hit
    useTabsStore.getState().openDebugger()
  },

  setResumed() {
    set({ status: 'running', pausedLine: null, pausedFile: null, callStack: [] })
  },

  setCompleted(output) {
    set({ status: 'completed', pausedLine: null, pausedFile: null, lastOutput: output, callStack: [] })
  },

  setError(msg) {
    set({ status: 'error', lastError: msg, pausedLine: null, pausedFile: null, callStack: [] })
  },

  setStopped() {
    set({ status: 'idle', pausedLine: null, pausedFile: null, variables: [], callStack: [] })
  },

  addLog(entry) {
    set(s => ({ consoleLogs: [...s.consoleLogs, entry] }))
  },

  clearLogs() {
    set({ consoleLogs: [] })
  },

  setNavigateLine(file, line) {
    set({ navigateFile: file, navigateLine: line, activeFile: file })
  },

  clearNavigate() {
    set({ navigateLine: null, navigateFile: null })
  },
}))
