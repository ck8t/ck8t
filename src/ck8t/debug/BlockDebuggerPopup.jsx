import { useEffect, useRef, useCallback } from 'react'
import { EditorView } from '@salilvnair/dui'
import { useBlockDebuggerStore } from './block-debugger-store'
import { BlockDebugEngine } from './block-debug-engine'
import { useWorkflowStore } from '../stores/workflow-store'
import './BlockDebuggerPopup.css'

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = ({ d, size = 14, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
)

const RunIcon     = (p) => <I {...p} d="M5 3l9 5-9 5V3z" />
const ResumeIcon  = (p) => <I {...p} d={['M4 3l5 5-5 5V3z', 'M12 3v10']} />
const StepIcon    = (p) => <I {...p} d={['M4 3l5 5-5 5V3z', 'M9 8h4', 'M11 6l2 2-2 2']} />
const StopIcon    = (p) => <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor" {...p}><rect x="3" y="3" width="10" height="10" rx="1" /></svg>
const BugIcon     = (p) => <I {...p} d={['M9 9a1 1 0 0 1-2 0V5a1 1 0 0 1 2 0v4z', 'M8 2v3', 'M4 6H2', 'M14 6h-2', 'M4 11H2', 'M14 11h-2']} />
const CloseIcon   = (p) => <I {...p} d={['M3 3l10 10', 'M13 3L3 13']} />

// ─── Log line colors ──────────────────────────────────────────────────────────

const LOG_COLOR = { log: '#94a3b8', info: '#60a5fa', warn: '#fbbf24', error: '#f87171', debug: '#a78bfa' }

// ─── Main Popup ───────────────────────────────────────────────────────────────

export function BlockDebuggerPopup() {
  const engineRef = useRef(null)
  const inputEditorRef = useRef(null)

  const {
    isOpen, nodeId, blockType, blockTitle,
    files, activeFile,
    breakpoints,
    status, pausedLine, pausedFile,
    testInput, lastOutput, lastError,
    consoleLogs,
    closeDebugger, setActiveFile, toggleBreakpoint,
    setTestInput, setRunning, setPaused, setResumed, setCompleted, setError, setStopped, addLog,
  } = useBlockDebuggerStore()

  const subBlockValues = useWorkflowStore(s => s.subBlockValues)

  // ─── Load block files when popup opens ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !nodeId) return
    const store = useBlockDebuggerStore.getState()
    if (store.files.length > 0) return

    if (blockType === 'function') {
      // Function block: show user's own code from subBlockValues
      const blockValues = subBlockValues[nodeId] || {}
      const code = blockValues.code || '// No code found\nreturn input'
      store.setFiles([{ name: 'function.js', path: 'function.js', content: code, runnerType: 'function' }])
      store.setTestInput(typeof blockValues.input === 'string' ? blockValues.input : JSON.stringify(blockValues.input ?? '', null, 2))
    } else {
      // Core block or community block: request runner files from extension host
      const vsApi = window.__CK8T_VSCODE_API__
      if (vsApi) {
        vsApi.postMessage({ type: 'blockDebug:getFiles', blockType, nodeId })
      }
    }
  }, [isOpen, nodeId, blockType])

  // ─── Extension host message handler ──────────────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'blockDebug:files') {
        useBlockDebuggerStore.getState().setFiles(msg.files)
      } else if (msg.type === 'blockDebug:paused') {
        setPaused(msg.file, msg.line)
      } else if (msg.type === 'blockDebug:resumed') {
        setResumed()
      } else if (msg.type === 'blockDebug:completed') {
        setCompleted(msg.output)
      } else if (msg.type === 'blockDebug:error') {
        setError(msg.message)
      } else if (msg.type === 'blockDebug:log') {
        addLog(msg.entry)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [setPaused, setResumed, setCompleted, setError, addLog])

  // ─── Run ──────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (status === 'running' || status === 'paused') return
    setRunning()

    const activeFileObj = files.find(f => f.name === activeFile)
    if (!activeFileObj) return

    const activeBp = breakpoints[activeFile] || []

    // Parse test input
    let parsedInput = testInput
    try { parsedInput = JSON.parse(testInput) } catch { /* keep as string */ }

    // Parse values from subBlockValues
    const blockValues = subBlockValues[nodeId] || {}
    const { code: _c, ...values } = blockValues

    const isExtensionRunner = activeFileObj.runnerType === 'extension' || activeFileObj.runnerType === 'server'

    if (isExtensionRunner) {
      // Route to extension host for Node.js execution
      const vsApi = window.__CK8T_VSCODE_API__
      if (!vsApi) {
        setError('Extension host not available for Node.js runner debugging')
        return
      }
      vsApi.postMessage({
        type: 'blockDebug:runExtension',
        nodeId, blockType,
        file: activeFileObj.name,
        code: activeFileObj.content,
        input: parsedInput,
        values,
        breakpoints: activeBp,
      })
    } else {
      // Client-side execution
      const engine = new BlockDebugEngine()
      engineRef.current = engine

      await engine.run(activeFileObj.content, {
        input: parsedInput,
        values,
        breakpoints: activeBp,
        file: activeFile,
        onPaused: (file, line) => setPaused(file, line),
        onResumed: () => setResumed(),
        onCompleted: (output) => setCompleted(output),
        onError: (msg) => setError(msg),
        onLog: (entry) => addLog(entry),
      })
    }
  }, [status, files, activeFile, breakpoints, testInput, subBlockValues, nodeId, blockType, setRunning, setPaused, setResumed, setCompleted, setError, addLog])

  // ─── Controls ─────────────────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    if (status !== 'paused') return
    const vsApi = window.__CK8T_VSCODE_API__
    const activeFileObj = files.find(f => f.name === activeFile)
    if (activeFileObj?.runnerType === 'extension' || activeFileObj?.runnerType === 'server') {
      vsApi?.postMessage({ type: 'blockDebug:resume', nodeId })
    } else {
      engineRef.current?.resume()
    }
  }, [status, activeFile, files, nodeId])

  const handleStepOver = useCallback(() => {
    if (status !== 'paused') return
    const vsApi = window.__CK8T_VSCODE_API__
    const activeFileObj = files.find(f => f.name === activeFile)
    if (activeFileObj?.runnerType === 'extension' || activeFileObj?.runnerType === 'server') {
      vsApi?.postMessage({ type: 'blockDebug:stepOver', nodeId })
    } else {
      engineRef.current?.stepOver()
    }
  }, [status, activeFile, files, nodeId])

  const handleStop = useCallback(() => {
    const vsApi = window.__CK8T_VSCODE_API__
    const activeFileObj = files.find(f => f.name === activeFile)
    if (activeFileObj?.runnerType === 'extension' || activeFileObj?.runnerType === 'server') {
      vsApi?.postMessage({ type: 'blockDebug:stop', nodeId })
    } else {
      engineRef.current?.stop()
    }
    setStopped()
  }, [activeFile, files, nodeId, setStopped])

  if (!isOpen) return null

  const activeFileObj = files.find(f => f.name === activeFile)
  const activeContent = activeFileObj?.content || ''
  const activeBp = breakpoints[activeFile] || []
  const isPaused = status === 'paused'
  const isRunning = status === 'running'
  const currentPausedLine = pausedFile === activeFile ? pausedLine : null

  return (
    <div className="bdp-overlay" onClick={(e) => e.target === e.currentTarget && closeDebugger()}>
      <div className="bdp-modal">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="bdp-header">
          <BugIcon size={14} style={{ opacity: 0.7 }} />
          <span className="bdp-title">Debugger — {blockTitle}</span>
          <div className="bdp-controls">
            <button
              className={`bdp-ctrl-btn ${status === 'idle' || status === 'completed' || status === 'error' || status === 'stopped' ? 'is-active' : ''}`}
              onClick={handleRun}
              disabled={isRunning || isPaused}
              title="Run"
            >
              <RunIcon size={13} />
              <span>Run</span>
            </button>
            <div className="bdp-ctrl-divider" />
            <button className="bdp-ctrl-btn" onClick={handleResume} disabled={!isPaused} title="Resume (F8)">
              <ResumeIcon size={13} />
            </button>
            <button className="bdp-ctrl-btn" onClick={handleStepOver} disabled={!isPaused} title="Step Over (F10)">
              <StepIcon size={13} />
            </button>
            <button className="bdp-ctrl-btn is-stop" onClick={handleStop} disabled={!isRunning && !isPaused} title="Stop">
              <StopIcon size={13} />
            </button>
          </div>
          <div className="bdp-status">
            {status === 'idle' && <span className="bdp-status-chip">Ready</span>}
            {status === 'running' && <span className="bdp-status-chip is-running">● Running</span>}
            {status === 'paused' && <span className="bdp-status-chip is-paused">⏸ Paused at line {pausedLine}</span>}
            {status === 'completed' && <span className="bdp-status-chip is-done">✓ Completed</span>}
            {status === 'error' && <span className="bdp-status-chip is-error">✕ Error</span>}
            {status === 'stopped' && <span className="bdp-status-chip">Stopped</span>}
          </div>
          <button className="bdp-close" onClick={closeDebugger} title="Close debugger">
            <CloseIcon size={12} />
          </button>
        </div>

        {/* ── File Tabs ─────────────────────────────────────────────────── */}
        <div className="bdp-tabs">
          {files.map(f => (
            <button
              key={f.name}
              className={`bdp-tab ${activeFile === f.name ? 'is-active' : ''} ${pausedFile === f.name ? 'is-paused' : ''}`}
              onClick={() => setActiveFile(f.name)}
            >
              {pausedFile === f.name && <span className="bdp-tab-arrow">→</span>}
              {f.name}
              {(breakpoints[f.name]?.length || 0) > 0 && (
                <span className="bdp-tab-bp-count">{breakpoints[f.name].length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="bdp-body">
          {/* Left: editor */}
          <div className="bdp-editor-col">
            {activeFileObj ? (
              <EditorView
                key={activeFile}
                value={activeContent}
                language={getLanguage(activeFile)}
                height="100%"
                readOnly={true}
                debugSupported={true}
                breakpoints={activeBp}
                pausedLine={currentPausedLine}
                onToggleBreakpoint={(line) => toggleBreakpoint(activeFile, line)}
                bordered={false}
              />
            ) : (
              <div className="bdp-no-file">Loading files…</div>
            )}
          </div>

          {/* Right: input + variables + console */}
          <div className="bdp-right-col">
            {/* Test Input */}
            <div className="bdp-section">
              <div className="bdp-section-label">Test Input</div>
              <textarea
                className="bdp-input-area"
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                placeholder='Enter test input (JSON or plain text)'
                spellCheck={false}
              />
            </div>

            {/* Output */}
            {(status === 'completed' || status === 'error') && (
              <div className="bdp-section">
                <div className={`bdp-section-label ${status === 'error' ? 'is-error' : ''}`}>
                  {status === 'error' ? 'Error' : 'Output'}
                </div>
                <pre className={`bdp-output-pre ${status === 'error' ? 'is-error' : ''}`}>
                  {status === 'error' ? lastError : serialize(lastOutput)}
                </pre>
              </div>
            )}

            {/* Breakpoints in active file */}
            {activeBp.length > 0 && (
              <div className="bdp-section">
                <div className="bdp-section-label">Breakpoints</div>
                <div className="bdp-bp-chips">
                  {activeBp.map(line => (
                    <span
                      key={line}
                      className={`bdp-bp-chip ${currentPausedLine === line ? 'is-active' : ''}`}
                      onClick={() => toggleBreakpoint(activeFile, line)}
                      title="Click to remove"
                    >
                      ● Line {line}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Console */}
            <div className="bdp-section bdp-section-grow">
              <div className="bdp-section-label">Console {consoleLogs.length > 0 && `(${consoleLogs.length})`}</div>
              <div className="bdp-console">
                {consoleLogs.length === 0
                  ? <span className="bdp-console-empty">No output yet</span>
                  : consoleLogs.map((l, i) => (
                    <div key={i} className="bdp-console-line" style={{ color: LOG_COLOR[l.level] || '#94a3b8' }}>
                      <span className="bdp-console-level">[{l.level}]</span>
                      <span className="bdp-console-msg">{l.msg}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── Hint bar ──────────────────────────────────────────────────── */}
        <div className="bdp-hint">
          Click line numbers in the editor to set/remove breakpoints · {
            isPaused
              ? 'Paused — click Resume or Step Over to continue'
              : 'Click Run to execute with debug breakpoints'
          }
        </div>
      </div>
    </div>
  )
}

function getLanguage(filename) {
  if (!filename) return 'javascript'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'javascript'
  if (ext === 'ts') return 'typescript'
  if (ext === 'json') return 'json'
  return 'javascript'
}

function serialize(v) {
  if (v == null) return String(v)
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
