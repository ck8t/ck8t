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
import { JsonTreeView, BugIcon } from '@salilvnair/dui'

const LOG_COLORS = { log: '#94a3b8', info: '#60a5fa', warn: '#fbbf24', error: '#f87171', debug: '#a78bfa' }

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  function copy(e) {
    e.stopPropagation()
    navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) })
  }
  return (
    <button className={`bs-copy-btn${done ? ' is-done' : ''}`} title="Copy" onClick={copy} type="button">
      {done
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  )
}

function safeJson(v) { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }

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
  const cardText = safeJson({ error: snap.error, input: snap.input, output: snap.output })

  return (
    <div className={`bs-dbg-card ${snap.error ? 'is-error' : 'is-ok'}`}>
      <div className="bs-dbg-card-head" onClick={() => setOpen((v) => !v)} role="button">
        <BugIcon size={13} style={{ marginRight: 6, opacity: 0.7 }} />
        <span className="bs-dbg-card-title">{nodeTitle}</span>
        {snap.error
          ? <span className="bs-dbg-card-badge is-error">ERROR</span>
          : <span className="bs-dbg-card-badge is-ok">OK</span>
        }
        <span className="bs-dbg-card-ms">{snap.durationMs}ms</span>
        <span className="bs-dbg-card-time">{snap.executedAt ? new Date(snap.executedAt).toLocaleTimeString() : ''}</span>
        <span className="bs-dbg-card-caret">{open ? '▼' : '▶'}</span>
        <CopyBtn text={cardText} />
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
              <div className="bs-dbg-section-label bs-dbg-section-label-row" style={{ color: '#f87171' }}>
                Error
                <CopyBtn text={snap.error} />
              </div>
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
        <BugIcon size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
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
          <BugIcon size={12} style={{ marginRight: 5 }} />
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
