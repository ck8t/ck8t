/**
 * Block Debug Panel — auto-registers in the bottom run dock.
 *
 * Shows real-time debug snapshots for any block that has debug mode enabled
 * and has completed at least one run. Each entry shows:
 *   - Console output (log/info/warn/error captured from the function)
 *   - Input / Output objects
 *   - Duration and breakpoints set
 *   - Error if the block threw
 *
 * The panel appears as "Block Debug" tab in the bottom toolbar next to
 * Trace / Debug / Problems.
 */
import { useState } from 'react'
import { useBlockDebugStore } from '../stores/block-debug-store'
import { JsonTreeView } from '@salilvnair/dui'

const BugIcon = (p) => (
  <svg {...p} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="6" height="8" rx="3" />
    <path d="M8 1v4" /><path d="M3 7h2" /><path d="M11 7h2" /><path d="M3 11h2" /><path d="M11 11h2" />
  </svg>
)

const LOG_COLORS = { log: '#94a3b8', info: '#60a5fa', warn: '#fbbf24', error: '#f87171', debug: '#a78bfa' }

function ConsoleLine({ entry }) {
  return (
    <div className="bs-dbg-console-line" style={{ color: LOG_COLORS[entry.level] || '#94a3b8' }}>
      <span className="bs-dbg-console-level">[{entry.level}]</span>
      <span className="bs-dbg-console-msg">{entry.msg}</span>
    </div>
  )
}

function SnapshotCard({ nodeId, snap, nodes }) {
  const [open, setOpen] = useState(true)
  const nodeTitle = nodes?.find((n) => n.id === nodeId)?.data?.title || nodeId

  return (
    <div className={`bs-dbg-card ${snap.error ? 'is-error' : 'is-ok'}`}>
      <div className="bs-dbg-card-head" onClick={() => setOpen((v) => !v)} role="button">
        <BugIcon width="13" height="13" style={{ marginRight: 6, opacity: 0.7 }} />
        <span className="bs-dbg-card-title">{nodeTitle}</span>
        {snap.error
          ? <span className="bs-dbg-card-badge is-error">ERROR</span>
          : <span className="bs-dbg-card-badge is-ok">OK</span>
        }
        <span className="bs-dbg-card-ms">{snap.durationMs}ms</span>
        <span className="bs-dbg-card-time">{snap.executedAt ? new Date(snap.executedAt).toLocaleTimeString() : ''}</span>
        <span className="bs-dbg-card-caret">{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="bs-dbg-card-body">
          {/* Console */}
          {snap.consoleLogs?.length > 0 && (
            <section className="bs-dbg-section">
              <div className="bs-dbg-section-label">Console ({snap.consoleLogs.length})</div>
              <div className="bs-dbg-console">
                {snap.consoleLogs.map((l, i) => <ConsoleLine key={i} entry={l} />)}
              </div>
            </section>
          )}
          {/* Breakpoints */}
          {snap.breakpoints?.length > 0 && (
            <section className="bs-dbg-section">
              <div className="bs-dbg-section-label">Breakpoints set</div>
              <div className="bs-dbg-bp-list">
                {snap.breakpoints.map((ln) => (
                  <span key={ln} className="bs-dbg-bp-chip">Line {ln}</span>
                ))}
              </div>
            </section>
          )}
          {/* Error */}
          {snap.error && (
            <section className="bs-dbg-section">
              <div className="bs-dbg-section-label" style={{ color: '#f87171' }}>Error</div>
              <pre className="bs-dbg-pre bs-dbg-pre-error">{snap.error}</pre>
            </section>
          )}
          {/* Input */}
          {snap.input != null && (
            <section className="bs-dbg-section">
              <div className="bs-dbg-section-label">Input</div>
              <div className="bs-dbg-json"><JsonTreeView data={snap.input} defaultExpandDepth={2} /></div>
            </section>
          )}
          {/* Output */}
          {snap.output != null && (
            <section className="bs-dbg-section">
              <div className="bs-dbg-section-label">Output</div>
              <div className="bs-dbg-json"><JsonTreeView data={snap.output} defaultExpandDepth={2} /></div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function BlockDebugPanelRender({ ctx }) {
  const snapshots = useBlockDebugStore((s) => s.snapshots)
  const debugEnabled = useBlockDebugStore((s) => s.debugEnabled)
  const clearAll = useBlockDebugStore((s) => s.clearAll)
  const nodes = ctx.workflow?.nodes || []

  const debuggedNodes = [...debugEnabled].filter((id) => snapshots[id])
  const enabledButNoRun = [...debugEnabled].filter((id) => !snapshots[id])

  if (debugEnabled.size === 0) {
    return (
      <div className="bs-run-empty">
        <BugIcon width="28" height="28" style={{ marginBottom: 8, opacity: 0.4 }} />
        <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '12.5px' }}>
          No blocks in debug mode. Right-click any block → Enable Debug Mode.
        </div>
      </div>
    )
  }

  return (
    <div className="bs-run-tab">
      {debuggedNodes.length > 0 && (
        <div className="bs-run-tab-toolbar">
          <button className="bs-btn-ghost bs-btn-sm" onClick={clearAll} title="Clear all debug snapshots">
            Clear snapshots
          </button>
        </div>
      )}

      {enabledButNoRun.length > 0 && (
        <div className="bs-dbg-waiting">
          <BugIcon width="12" height="12" style={{ marginRight: 5 }} />
          {enabledButNoRun.map((id) => {
            const t = nodes.find((n) => n.id === id)?.data?.title || id
            return <span key={id} className="bs-dbg-waiting-chip">{t}</span>
          })}
          <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 11 }}>— run the workflow to capture debug data</span>
        </div>
      )}

      {debuggedNodes.map((id) => (
        <SnapshotCard key={id} nodeId={id} snap={snapshots[id]} nodes={nodes} />
      ))}
    </div>
  )
}

const BlockDebugPanel = {
  id: 'block-debug',
  label: 'Block Debug',
  order: 15,
  badge: (ctx) => {
    const count = Object.keys(useBlockDebugStore.getState().snapshots).length
    return count || null
  },
  render(ctx) {
    return <BlockDebugPanelRender ctx={ctx} />
  },
}

export default BlockDebugPanel
