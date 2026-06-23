/**
 * BlockDebuggerPanel — Daakia-style debugger rendered as a center-pane tab.
 *
 * Layout (fills the tab body):
 *   ┌─ block tile ────────────────────────────────────────────────────┐
 *   ├─ HUD: Continue · Step Over · Step In · Step Out | Restart · Stop │
 *   ├─ file tabs ─────────────────────────────────────────────────────┤
 *   │  left: Monaco editor (with glyph breakpoints)                    │
 *   │  right: Variables · Watch · Call Stack · Breakpoints · Console   │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Opened automatically when:
 *   - Right-click block → "Debug" (sets nodeId in store + opens this tab)
 *   - A breakpoint is hit during a debug run (setPaused auto-switches)
 */
import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { EditorView, BugIcon } from '@salilvnair/dui'
export { BugIcon }
import { useBlockDebuggerStore } from './block-debugger-store'
import { BlockDebugEngine } from './block-debug-engine'
import { startServerDebugSession, detectServerEngine } from './server-debug-client'
import { useWorkflowStore } from '../stores/workflow-store'
import ContextMenu from '../sidenav/ContextMenu'
import './BlockDebuggerPopup.css'

// ─── Debug control icons ──────────────────────────────────────────────────────

const DbgContinueIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#89d185" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.578 7.149L7.578 2.186C7.397 2.058 7.198 2 7.003 2C6.484 2 6 2.411 6 3.002V13.003C6 13.594 6.485 14.005 7.004 14.005C7.201 14.005 7.403 13.946 7.585 13.815L14.585 8.777C15.142 8.376 15.139 7.546 14.579 7.15L14.578 7.149ZM7.5 12.027V3.969L13.14 7.968L7.5 12.027ZM3.5 2.75V13.25C3.5 13.664 3.164 14 2.75 14C2.336 14 2 13.664 2 13.25V2.75C2 2.336 2.336 2 2.75 2C3.164 2 3.5 2.336 3.5 2.75Z"/>
  </svg>
)

const DbgStepOverIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#75beff" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.99993 13C9.99993 14.103 9.10293 15 7.99993 15C6.89693 15 5.99993 14.103 5.99993 13C5.99993 11.897 6.89693 11 7.99993 11C9.10293 11 9.99993 11.897 9.99993 13ZM13.2499 2C12.8359 2 12.4999 2.336 12.4999 2.75V4.027C11.3829 2.759 9.75993 2 7.99993 2C5.03293 2 2.47993 4.211 2.06093 7.144C2.00193 7.554 2.28793 7.934 2.69793 7.993C2.73393 7.999 2.76993 8.001 2.80493 8.001C3.17193 8.001 3.49293 7.731 3.54693 7.357C3.86093 5.159 5.77593 3.501 8.00093 3.501C9.52993 3.501 10.9199 4.264 11.7439 5.501H9.75093C9.33693 5.501 9.00093 5.837 9.00093 6.251C9.00093 6.665 9.33693 7.001 9.75093 7.001H13.2509C13.6649 7.001 14.0009 6.665 14.0009 6.251V2.751C14.0009 2.337 13.6649 2.001 13.2509 2.001L13.2499 2Z"/>
  </svg>
)

const DbgStepIntoIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#75beff" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 13C10 14.103 9.10304 15 8.00004 15C6.89704 15 6.00004 14.103 6.00004 13C6.00004 11.897 6.89704 11 8.00004 11C9.10304 11 10 11.897 10 13ZM12.03 5.22C11.737 4.927 11.262 4.927 10.969 5.22L8.74904 7.44V1.75C8.74904 1.336 8.41304 1 7.99904 1C7.58504 1 7.24904 1.336 7.24904 1.75V7.439L5.02904 5.219C4.73604 4.926 4.26104 4.926 3.96804 5.219C3.67504 5.512 3.67504 5.987 3.96804 6.28L7.46804 9.78C7.61404 9.926 7.80604 10 7.99804 10C8.19004 10 8.38204 9.927 8.52804 9.78L12.028 6.28C12.321 5.987 12.321 5.512 12.028 5.219L12.03 5.22Z"/>
  </svg>
)

const DbgStepOutIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#75beff" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.99802 13C9.99802 14.103 9.10102 15 7.99802 15C6.89502 15 5.99802 14.103 5.99802 13C5.99802 11.897 6.89502 11 7.99802 11C9.10102 11 9.99802 11.897 9.99802 13ZM12.03 4.71999L8.53002 1.21999C8.23702 0.926994 7.76202 0.926994 7.46902 1.21999L3.96902 4.71999C3.67602 5.01299 3.67602 5.48799 3.96902 5.78099C4.26202 6.07399 4.73702 6.07399 5.03002 5.78099L7.25002 3.56099V9.24999C7.25002 9.66399 7.58602 9.99999 8.00002 9.99999C8.41402 9.99999 8.75002 9.66399 8.75002 9.24999V3.56099L10.97 5.78099C11.116 5.92699 11.308 6.00099 11.5 6.00099C11.692 6.00099 11.884 5.92799 12.03 5.78099C12.323 5.48799 12.323 5.01299 12.03 4.71999Z"/>
  </svg>
)

const DbgRestartIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#89d185" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 8C14 8.81 13.842 9.596 13.528 10.336C13.224 11.053 12.791 11.694 12.241 12.243C11.694 12.791 11.053 13.224 10.337 13.528C9.59602 13.841 8.81002 14 8.00002 14C7.19002 14 6.40402 13.842 5.66402 13.528C4.94702 13.224 4.30602 12.791 3.75702 12.242C3.20802 11.693 2.77602 11.053 2.47202 10.337C2.31002 9.956 2.48802 9.516 2.86902 9.354C3.25102 9.19 3.69002 9.37 3.85202 9.751C4.08102 10.288 4.40502 10.77 4.81802 11.181C5.23002 11.595 5.71202 11.919 6.24902 12.148C7.35602 12.615 8.64302 12.615 9.75202 12.148C10.288 11.919 10.77 11.595 11.181 11.183C11.595 10.77 11.919 10.288 12.148 9.751C12.381 9.197 12.501 8.608 12.501 8C12.501 7.392 12.382 6.803 12.148 6.248C11.919 5.712 11.595 5.23 11.182 4.819C10.77 4.405 10.288 4.081 9.75102 3.852C8.64402 3.385 7.35702 3.385 6.24802 3.852C5.71202 4.081 5.23002 4.405 4.81902 4.817C4.60802 5.027 4.42002 5.256 4.25702 5.5H6.24902C6.66302 5.5 6.99902 5.836 6.99902 6.25C6.99902 6.664 6.66302 7 6.24902 7H2.74902C2.33502 7 1.99902 6.664 1.99902 6.25V2.75C1.99902 2.336 2.33502 2 2.74902 2C3.16302 2 3.49902 2.336 3.49902 2.75V4.032C3.58202 3.938 3.66802 3.845 3.75802 3.757C4.30502 3.209 4.94602 2.776 5.66202 2.472C7.14402 1.845 8.85402 1.845 10.335 2.472C11.052 2.776 11.693 3.209 12.242 3.758C12.791 4.307 13.223 4.947 13.527 5.663C13.84 6.404 13.999 7.19 13.999 8H14Z"/>
  </svg>
)

const DbgStopIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#f48771" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 3.5V12.5H3.5V3.5H12.5ZM12.5 2H3.5C2.672 2 2 2.672 2 3.5V12.5C2 13.328 2.672 14 3.5 14H12.5C13.328 14 14 13.328 14 12.5V3.5C14 2.672 13.328 2 12.5 2Z"/>
  </svg>
)

const MuteIcon = ({ size = 14, muted }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="5.5" fill={muted ? 'var(--color-error, #ef4444)' : 'var(--color-text-muted, #94a3b8)'} />
    <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const RunDebugIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#89d185" d="M13 7.5L5 3v9l8-4.5z"/>
    <circle cx="4.5" cy="12" r="2.5" fill="#e06c75" />
  </svg>
)

const ChevronIcon = ({ size = 10, open }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease', display: 'inline-flex' }}>
    <path d="M3 2l4 3-4 3" />
  </svg>
)


const LOG_COLOR = { log: '#94a3b8', info: '#60a5fa', warn: '#fbbf24', error: '#f87171', debug: '#a78bfa' }

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({ title, accentColor, badge, headerRight, expanded, onToggle, children }) {
  return (
    <div className="bdp-collapse" style={accentColor ? { '--bdp-accent': accentColor } : {}}>
      <button type="button" className="bdp-collapse-head" onClick={onToggle}>
        <span className="bdp-collapse-chevron" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronIcon size={10} />
        </span>
        <span className="bdp-collapse-title">{title}</span>
        {badge !== undefined && badge > 0 && <span className="bdp-collapse-badge">{badge}</span>}
        {headerRight && (
          <span className="bdp-collapse-actions" onClick={e => e.stopPropagation()}>{headerRight}</span>
        )}
      </button>
      {expanded && <div className="bdp-collapse-body">{children}</div>}
    </div>
  )
}

// ─── Value tree ───────────────────────────────────────────────────────────────

function isObj(v) { return v !== null && typeof v === 'object' }

function getPreview(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') {
    if (v.startsWith('<') && v.endsWith('>')) return v
    return `'${v.length > 50 ? v.slice(0, 50) + '…' : v}'`
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    const inner = v.slice(0, 5).map(getShortPreview).join(', ')
    return `(${v.length}) [${inner}${v.length > 5 ? ', …' : ''}]`
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v)
    const inner = keys.slice(0, 3).map(k => `${k}: ${getShortPreview(v[k])}`).join(', ')
    return `{${inner}${keys.length > 3 ? ', …' : ''}}`
  }
  return String(v)
}

function getShortPreview(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return `'${v.length > 15 ? v.slice(0, 15) + '…' : v}'`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `Array(${v.length})`
  if (typeof v === 'object') return '{…}'
  return String(v)
}

function getValColor(v) {
  if (v === null || v === undefined) return '#808080'
  if (typeof v === 'string') return v.startsWith('<') ? '#808080' : '#ce9178'
  if (typeof v === 'number') return '#b5cea8'
  if (typeof v === 'boolean') return '#569cd6'
  if (Array.isArray(v)) return '#dcdcaa'
  if (typeof v === 'object') return '#9cdcfe'
  return '#d4d4d4'
}

function fullValueStr(v) {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function ValueNode({ name, value, depth = 1 }) {
  const [open, setOpen] = useState(false)
  const [tipPos, setTipPos] = useState(null)
  const expandable = isObj(value)
  return (
    <div>
      <div
        className="bdp-var-row"
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={expandable ? () => setOpen(o => !o) : undefined}
        onMouseEnter={e => setTipPos({ x: e.clientX + 14, y: e.clientY + 8 })}
        onMouseMove={e => setTipPos({ x: e.clientX + 14, y: e.clientY + 8 })}
        onMouseLeave={() => setTipPos(null)}
      >
        {expandable
          ? <span className="bdp-var-chevron" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}><ChevronIcon size={9} /></span>
          : <span style={{ width: 10, display: 'inline-block', flexShrink: 0 }} />}
        <span className="bdp-var-name">{name}</span>
        <span className="bdp-var-eq">=</span>
        <span className="bdp-var-val" style={{ color: getValColor(value) }}>{getPreview(value)}</span>
      </div>
      {tipPos && (
        <div className="bdp-var-tip" style={{ left: tipPos.x, top: tipPos.y }}>
          <pre className="bdp-var-tip-pre">{fullValueStr(value)}</pre>
        </div>
      )}
      {open && expandable && (
        Array.isArray(value)
          ? value.map((item, i) => <ValueNode key={i} name={String(i)} value={item} depth={depth + 1} />)
          : Object.entries(value).map(([k, v]) => <ValueNode key={k} name={k} value={v} depth={depth + 1} />)
      )}
    </div>
  )
}

// ─── Variables ────────────────────────────────────────────────────────────────

function ScopeGroup({ label, vars, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  if (vars.length === 0) return null
  return (
    <div>
      <button type="button" className="bdp-scope-head" onClick={() => setOpen(o => !o)}>
        <ChevronIcon size={9} open={open} />
        <span className="bdp-scope-label">{label}</span>
      </button>
      {open && <div style={{ paddingLeft: 4 }}>{vars.map(v => <ValueNode key={v.name} name={v.name} value={v.value} depth={1} />)}</div>}
    </div>
  )
}

function VariablesSection({ variables, active }) {
  const [open, setOpen] = useState(true)
  const localVars = variables.filter(v => !['input', 'values', 'console', '__ck8tBp__'].includes(v.name))
  const initialVars = variables.filter(v => ['input', 'values'].includes(v.name))
  return (
    <CollapsibleSection title="Variables" accentColor="var(--color-debug-key, #4fc3f7)" expanded={open} onToggle={() => setOpen(o => !o)}>
      {!active ? <div className="bdp-empty-msg">Not paused</div>
        : variables.length === 0 ? <div className="bdp-empty-msg">No variables captured</div>
        : <div>
            {localVars.length > 0 && <ScopeGroup label="Local" vars={localVars} defaultOpen />}
            {initialVars.length > 0 && <ScopeGroup label="Block Inputs" vars={initialVars} defaultOpen={false} />}
          </div>}
    </CollapsibleSection>
  )
}

// ─── Watch ────────────────────────────────────────────────────────────────────

function WatchSection({ variables }) {
  const [open, setOpen] = useState(true)
  const [exprs, setExprs] = useState([])
  const [adding, setAdding] = useState(false)
  const [inputVal, setInputVal] = useState('')

  function addExpr() {
    const t = inputVal.trim()
    if (t && !exprs.includes(t)) setExprs(p => [...p, t])
    setInputVal(''); setAdding(false)
  }

  function evaluate(expr) {
    const parts = expr.replace(/\[(\d+)\]/g, '.$1').split('.')
    const root = variables.find(v => v.name === parts[0])
    if (!root) return { value: undefined, found: false }
    let cur = root.value
    for (let i = 1; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return { value: undefined, found: false }
      cur = cur[parts[i]]
    }
    return { value: cur, found: true }
  }

  return (
    <CollapsibleSection title="Watch" accentColor="var(--color-warning, #ffa726)" badge={exprs.length || undefined} expanded={open} onToggle={() => setOpen(o => !o)}
      headerRight={<button className="bdp-icon-action" title="Add expression" onClick={e => { e.stopPropagation(); setAdding(true); setOpen(true) }}>+</button>}
    >
      <div className="bdp-watch-list">
        {exprs.map(expr => {
          const { value, found } = evaluate(expr)
          return (
            <div key={expr} className="bdp-watch-row">
              <span className="bdp-var-name">{expr}</span>
              <span className="bdp-var-eq">=</span>
              <span className="bdp-var-val" style={{ color: found ? getValColor(value) : '#808080' }}>{found ? getPreview(value) : '<not available>'}</span>
              <button className="bdp-watch-remove" onClick={() => setExprs(p => p.filter(e => e !== expr))}>×</button>
            </div>
          )
        })}
        {adding && (
          <div className="bdp-watch-input-wrap">
            <input autoFocus className="bdp-watch-input" placeholder="Expression to watch…" value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addExpr(); if (e.key === 'Escape') { setAdding(false); setInputVal('') } }}
              onBlur={addExpr}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// ─── Call Stack ───────────────────────────────────────────────────────────────

function CallStackSection({ callStack, active, status }) {
  const [open, setOpen] = useState(true)
  return (
    <CollapsibleSection title="Call Stack" accentColor="var(--color-debug-scope, #ab47bc)" expanded={open} onToggle={() => setOpen(o => !o)}>
      {!active ? <div className="bdp-empty-msg">Not debugging</div>
        : callStack.length === 0 ? <div className="bdp-empty-msg">No frames</div>
        : <div>
            {callStack.map((frame, i) => (
              <div key={i} className={`bdp-frame ${i === 0 ? 'bdp-frame-active' : ''}`}>
                {i === 0 ? <span className="bdp-frame-dot" /> : <span style={{ width: 6, display: 'inline-block' }} />}
                <span className={i === 0 ? 'bdp-frame-fn' : 'bdp-frame-fn-muted'}>{frame.fn || '<anonymous>'}</span>
                <span className="bdp-frame-loc">{frame.file}{frame.line ? `:${frame.line}` : ''}</span>
              </div>
            ))}
            {status === 'paused' && <div className="bdp-paused-badge">⏸ Paused on breakpoint</div>}
          </div>}
    </CollapsibleSection>
  )
}

// ─── Breakpoints ──────────────────────────────────────────────────────────────

function BreakpointsSection({ breakpoints, disabledBreakpoints, conditions, breakpointsMuted, onNavigate }) {
  const [open, setOpen] = useState(true)
  const entries = []
  for (const [file, lines] of Object.entries(breakpoints)) {
    const disabled = disabledBreakpoints[file] || []
    const conds = conditions[file] || {}
    for (const line of lines) {
      entries.push({ file, line, disabled: disabled.includes(line), condition: conds[line] })
    }
  }
  return (
    <CollapsibleSection title="Breakpoints" accentColor="var(--color-error, #ef5350)" badge={entries.length || undefined} expanded={open} onToggle={() => setOpen(o => !o)}
      headerRight={entries.length > 0 && (
        <button className="bdp-icon-action bdp-icon-action-red" title="Remove all breakpoints"
          onClick={e => { e.stopPropagation(); useBlockDebuggerStore.getState().clearAllBreakpoints() }}>×</button>
      )}
    >
      {entries.length === 0 ? <div className="bdp-empty-msg">No breakpoints set — click a line number in the editor</div>
        : <div>
            {entries.map((bp, i) => {
              const isFaded = breakpointsMuted || bp.disabled
              return (
                <div key={`${bp.file}-${bp.line}-${i}`} className={`bdp-bp-row ${isFaded ? 'is-faded' : ''}`}>
                  <input type="checkbox" className="bdp-bp-check" checked={!bp.disabled}
                    onChange={() => useBlockDebuggerStore.getState().toggleDisableBreakpoint(bp.file, bp.line)} />
                  <span className="bdp-bp-dot" style={{ background: bp.condition ? 'var(--color-warning, #ffa726)' : isFaded ? '#666' : 'var(--color-error, #ef5350)' }} />
                  <span className="bdp-bp-label" onClick={() => onNavigate(bp.file, bp.line)} title={`${bp.file} Line ${bp.line}`}>
                    <span className="bdp-bp-file">{bp.file}</span>
                    <span className="bdp-bp-line">Line {bp.line}</span>
                  </span>
                  <button className="bdp-bp-remove" onClick={() => useBlockDebuggerStore.getState().removeBreakpoint(bp.file, bp.line)} title="Remove">×</button>
                </div>
              )
            })}
          </div>}
    </CollapsibleSection>
  )
}

// ─── Console ──────────────────────────────────────────────────────────────────

function ConsoleSection({ consoleLogs }) {
  const [open, setOpen] = useState(true)
  return (
    <CollapsibleSection title="Console" accentColor="var(--color-text-secondary, #888)" badge={consoleLogs.length || undefined} expanded={open} onToggle={() => setOpen(o => !o)}>
      <div className="bdp-console">
        {consoleLogs.length === 0
          ? <span className="bdp-empty-msg">No output yet</span>
          : consoleLogs.map((l, i) => (
            <div key={i} className="bdp-console-line" style={{ color: LOG_COLOR[l.level] || '#94a3b8' }}>
              <span className="bdp-console-level">[{l.level}]</span>
              <span className="bdp-console-msg">{l.msg}</span>
            </div>
          ))}
      </div>
    </CollapsibleSection>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function BlockDebuggerPanel() {
  const {
    nodeId, blockType, blockTitle, blockIcon, blockBgColor,
    files, activeFile, filesStatus,
    breakpoints, disabledBreakpoints, conditions, breakpointsMuted,
    status, pausedLine, pausedFile,
    variables, callStack,
    lastOutput, lastError,
    consoleLogs,
    remoteSession, serverTestStatus,
    setActiveFile, toggleBreakpoint,
    setRunning, setStopped,
    toggleMuteBreakpoints,
    setNavigateLine, clearNavigate, navigateLine, navigateFile,
  } = useBlockDebuggerStore()

  const subBlockValues = useWorkflowStore(s => s.subBlockValues)

  const [ctxMenu, setCtxMenu] = useState(null)
  const [condInput, setCondInput] = useState(null)
  const [dbgHoverTip, setDbgHoverTip] = useState(null)
  const [hudLeft, setHudLeft] = useState(null)
  const editorHoverDisposablesRef = useRef([])
  const hudRef = useRef(null)

  const handleHudGripMouseDown = useCallback((e) => {
    e.preventDefault()
    const hud = hudRef.current
    if (!hud) return
    const parent = hud.offsetParent
    if (!parent) return
    const parentRect = parent.getBoundingClientRect()
    const hudRect = hud.getBoundingClientRect()
    const initialLeft = hudRect.left - parentRect.left
    const startX = e.clientX
    function onMove(ev) {
      const newLeft = initialLeft + (ev.clientX - startX)
      setHudLeft(Math.max(0, Math.min(newLeft, parentRect.width - hudRect.width)))
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ─── Load block files when nodeId is set ─────────────────────────────────
  useEffect(() => {
    if (!nodeId) return
    const store = useBlockDebuggerStore.getState()
    if (store.files.length > 0) return

    if (blockType === 'function') {
      const blockValues = subBlockValues[nodeId] || {}
      const code = blockValues.code || '// No code found\nreturn input'
      store.setFiles([{ name: 'function.js', path: 'function.js', content: code, runnerType: 'function' }])
    } else {
      const vsApi = window.__CK8T_VSCODE_API__
      if (vsApi) vsApi.postMessage({ type: 'blockDebug:getFiles', blockType, nodeId })
    }
  }, [nodeId, blockType, subBlockValues])

  // ─── Extension host messages (file source fetch only — execution always
  // happens here in the webview/browser, same as the canvas Run button) ────
  useEffect(() => {
    const handler = (event) => {
      const msg = event.data
      if (msg?.type === 'blockDebug:files') useBlockDebuggerStore.getState().setFiles(msg.files)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ─── Navigate to breakpoint line ──────────────────────────────────────────
  useEffect(() => {
    if (navigateLine && navigateFile) { setActiveFile(navigateFile); clearNavigate() }
  }, [navigateLine, navigateFile, setActiveFile, clearNavigate])

  const activeFileObj = files.find(f => f.name === activeFile)

  const isPaused = status === 'paused'
  const isRunning = status === 'running'
  const isIdle = !isRunning && !isPaused

  // ─── Debug controls — routes to live in-browser engine (browser path) or
  // to WS remote handle (extension.js / server.js paths) ──────────────────
  const handleContinue = useCallback(() => {
    if (status !== 'paused') return
    const store = useBlockDebuggerStore.getState()
    if (store.remoteSession) store.remoteResume()
    else store.engine?.resume()
  }, [status])

  const handleStepOver = useCallback(() => {
    if (status !== 'paused') return
    const store = useBlockDebuggerStore.getState()
    if (store.remoteSession) store.remoteStepOver()
    else store.engine?.stepOver()
  }, [status])

  const handleStepInto = useCallback(() => {
    if (status !== 'paused') return
    const store = useBlockDebuggerStore.getState()
    if (store.remoteSession) store.remoteStepInto()
    else store.engine?.stepInto()
  }, [status])

  const handleStepOut = useCallback(() => {
    if (status !== 'paused') return
    const store = useBlockDebuggerStore.getState()
    if (store.remoteSession) store.remoteStepOut()
    else store.engine?.stepOut()
  }, [status])

  const handleStop = useCallback(() => {
    const store = useBlockDebuggerStore.getState()
    if (store.remoteSession) {
      store.remoteStop()
    } else {
      store.engine?.stop()
      setStopped()
    }
  }, [setStopped])

  // Restart re-plays the last canvas-triggered debug run for this node from
  // the top (same source + ctx the workflow Run button last used), rather
  // than re-running the whole workflow.
  const handleRestart = useCallback(async () => {
    if (status === 'running' || status === 'paused') return
    const lastRun = useBlockDebuggerStore.getState().lastDebugRun
    if (!lastRun) return
    setRunning()
    const engine = new BlockDebugEngine()
    useBlockDebuggerStore.getState().setEngine(engine)
    try {
      await engine.run(lastRun)
    } catch { /* onError already reported via lastRun callbacks */ }
    finally {
      useBlockDebuggerStore.getState().setEngine(null)
    }
  }, [status, setRunning])

  // ─── "Test on Server" — starts a WS debug session against ck8t-server ───
  const hasServerFile = files.some(f => f.name === 'server.js' || f.runnerType === 'server')

  const handleTestOnServer = useCallback(async () => {
    if (status === 'running' || status === 'paused') return
    const store = useBlockDebuggerStore.getState()
    store.setServerTestStatus('connecting')

    const reachable = await detectServerEngine()
    if (!reachable) {
      store.setServerTestStatus('unreachable')
      return
    }

    const serverFile = files.find(f => f.name === 'server.js' || f.runnerType === 'server')
    const serverBps  = (store.breakpoints[serverFile?.name || 'server.js'] || [])
      .filter(l => !(store.disabledBreakpoints[serverFile?.name || 'server.js'] || []).includes(l))

    const lastRun = store.lastDebugRun
    const ctxInput         = lastRun?.input ?? null
    const ctxValues        = lastRun?.values ?? {}
    const ctxInputsByHandle = lastRun?.inputsByHandle ?? {}

    store.setRunning()
    store.setServerTestStatus('running')

    const handle = startServerDebugSession({
      blockType,
      breakpoints: serverBps,
      ctxValues,
      ctxInput,
      ctxInputsByHandle,
      onOpen:      () => {},
      onPaused:    (file, line, vars, cs) => useBlockDebuggerStore.getState().setPaused(file, line, vars, cs),
      onResumed:   ()       => useBlockDebuggerStore.getState().setResumed(),
      onCompleted: (output) => { useBlockDebuggerStore.getState().setCompleted(output); useBlockDebuggerStore.getState().clearRemoteSession(); useBlockDebuggerStore.getState().setServerTestStatus('idle') },
      onError:     (msg)    => { useBlockDebuggerStore.getState().setError(msg);        useBlockDebuggerStore.getState().clearRemoteSession(); useBlockDebuggerStore.getState().setServerTestStatus('idle') },
      onLog:       (entry)  => useBlockDebuggerStore.getState().addLog(entry),
    })

    store.startRemoteSession(handle.sessionId, handle)
  }, [status, files, blockType])

  // ─── Glyph margin context menu ────────────────────────────────────────────
  const handleGlyphContextMenu = useCallback((line, pos) => setCtxMenu({ line, pos }), [])

  const ctxItems = useMemo(() => {
    if (!ctxMenu) return []
    const file = activeFile
    const store = useBlockDebuggerStore.getState
    const bpList = breakpoints[file] || []
    const disabled = disabledBreakpoints[file] || []
    const hasBp = bpList.includes(ctxMenu.line)
    const isDisabled = disabled.includes(ctxMenu.line)
    const line = ctxMenu.line
    const dismiss = () => setCtxMenu(null)
    if (hasBp) return [
      { id: 'remove-bp', label: 'Remove Breakpoint', onSelect: () => { store().removeBreakpoint(file, line); dismiss() } },
      { id: isDisabled ? 'enable-bp' : 'disable-bp', label: isDisabled ? 'Enable Breakpoint' : 'Disable Breakpoint', onSelect: () => { store().toggleDisableBreakpoint(file, line); dismiss() } },
      { separator: true },
      { id: 'add-conditional', label: 'Edit Condition…', onSelect: () => { const existing = (store().conditions[file] || {})[line] || ''; setCondInput({ line, value: existing }); dismiss() } },
    ]
    return [
      { id: 'add-bp', label: 'Add Breakpoint', onSelect: () => { if (!(store().breakpoints[file] || []).includes(line)) store().toggleBreakpoint(file, line); dismiss() } },
      { id: 'add-conditional', label: 'Add Conditional Breakpoint…', onSelect: () => { setCondInput({ line, value: '' }); dismiss() } },
    ]
  }, [ctxMenu, activeFile, breakpoints, disabledBreakpoints])

  const handleConditionSubmit = useCallback(() => {
    if (!condInput) return
    const { line, value } = condInput
    if (value.trim()) useBlockDebuggerStore.getState().addConditionalBreakpoint(activeFile, line, value.trim())
    setCondInput(null)
  }, [condInput, activeFile])

  // Disable Monaco's built-in hover ("Loading..." from TS service) and replace
  // with our own tooltip that shows runtime variable values when paused.
  const handleEditorMount = useCallback((editor, monacoInstance) => {
    editor.updateOptions({ hover: { enabled: false } })
    const CONTENT_TEXT = monacoInstance.editor.MouseTargetType.CONTENT_TEXT
    const d1 = editor.onMouseMove((e) => {
      const store = useBlockDebuggerStore.getState()
      if (store.status !== 'paused') { setDbgHoverTip(null); return }
      if (!e.target || e.target.type !== CONTENT_TEXT) { setDbgHoverTip(null); return }
      const pos = e.target.position
      if (!pos) { setDbgHoverTip(null); return }
      const model = editor.getModel()
      if (!model) { setDbgHoverTip(null); return }
      const word = model.getWordAtPosition(pos)
      if (!word) { setDbgHoverTip(null); return }
      const variable = store.variables.find(v => v.name === word.word)
      if (!variable) { setDbgHoverTip(null); return }
      setDbgHoverTip({ name: word.word, value: variable.value, x: e.event.posx + 16, y: e.event.posy + 12 })
    })
    const d2 = editor.onMouseLeave(() => setDbgHoverTip(null))
    editorHoverDisposablesRef.current.forEach(d => d?.dispose?.())
    editorHoverDisposablesRef.current = [d1, d2]
  }, [])

  const activeBp = breakpoints[activeFile] || []
  const activeDisabledBp = disabledBreakpoints[activeFile] || []
  const activeCondLines = useMemo(() => {
    const conds = conditions[activeFile] || {}
    return Object.keys(conds).map(Number)
  }, [conditions, activeFile])
  const currentPausedLine = pausedFile === activeFile ? pausedLine : null
  const activeContent = activeFileObj?.content || ''

  // ─── Empty state: no debug session active ────────────────────────────────
  if (!nodeId) {
    return (
      <div className="bdp-panel">
        <div className="bdp-panel-empty">
          <BugIcon size={40} className="bdp-panel-empty-icon" />
          <div className="bdp-panel-empty-title">No debug session</div>
          <div className="bdp-panel-empty-sub">
            Right-click any block on the canvas and choose <strong>Debug</strong> to open its source files here, then set breakpoints by clicking line numbers.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bdp-panel">

      {/* ── Floating HUD — only while a debug session is live (Daakia-style) ── */}
      {!isIdle && (
        <div ref={hudRef} className="bdp-float-hud" style={hudLeft !== null ? { left: hudLeft, transform: 'none' } : undefined}>
          <div className="bdp-float-hud-grip" onMouseDown={handleHudGripMouseDown} />
          <button className="bdp-hud-btn" onClick={handleContinue} disabled={!isPaused} title="Continue (F5)"><DbgContinueIcon size={14} /></button>
          <button className="bdp-hud-btn" onClick={handleStepOver} disabled={!isPaused} title="Step Over (F10)"><DbgStepOverIcon size={14} /></button>
          <button className="bdp-hud-btn" onClick={handleStepInto} disabled={!isPaused} title="Step Into (F11)"><DbgStepIntoIcon size={14} /></button>
          <button className="bdp-hud-btn" onClick={handleStepOut} disabled={!isPaused} title="Step Out (Shift+F11)"><DbgStepOutIcon size={14} /></button>
          <div className="bdp-hud-sep" />
          <button className="bdp-hud-btn" onClick={handleRestart} title="Restart"><DbgRestartIcon size={14} /></button>
          <button className="bdp-hud-btn bdp-hud-btn-stop" onClick={handleStop} title="Stop"><DbgStopIcon size={14} /></button>
          <div className="bdp-hud-sep" />
          <button className={`bdp-hud-btn ${breakpointsMuted ? 'bdp-hud-btn-muted' : ''}`} onClick={toggleMuteBreakpoints} title={breakpointsMuted ? 'Unmute breakpoints' : 'Mute all breakpoints'}>
            <MuteIcon size={13} muted={breakpointsMuted} />
          </button>
        </div>
      )}

      {/* ── Block mini-tile ────────────────────────────────────────────────── */}
      <div className="bdp-block-tile">
        <div className="bdp-block-icon-well" style={{ background: blockBgColor || 'var(--color-surface-hover, #2a2d2e)' }}>
          {blockIcon && (() => { const Icon = blockIcon; return <Icon size={14} /> })()}
        </div>
        <span className="bdp-block-tile-title">{blockTitle || blockType}</span>
        <span className="bdp-block-type-chip">{blockType}</span>
      </div>

      {/* ── Header: title + status (HUD floats separately above) ───────────── */}
      <div className="bdp-header">
        <BugIcon size={13} style={{ color: 'var(--color-warning, #fbbf24)', flexShrink: 0 }} />
        <span className="bdp-title">Debugger — {blockTitle}</span>
        <span className="bdp-header-hint">Set breakpoints, then press Run on the canvas</span>

        <div className="bdp-status">
          {status === 'idle' && <span className="bdp-chip">Ready</span>}
          {status === 'running' && <span className="bdp-chip bdp-chip-run">● Running</span>}
          {status === 'paused' && <span className="bdp-chip bdp-chip-pause">⏸ Paused · line {pausedLine}</span>}
          {status === 'completed' && <span className="bdp-chip bdp-chip-done">✓ Completed</span>}
          {status === 'error' && <span className="bdp-chip bdp-chip-err">✕ Error</span>}
          {status === 'stopped' && <span className="bdp-chip">Stopped</span>}
        </div>
      </div>

      {/* ── File tabs ──────────────────────────────────────────────────────── */}
      <div className="bdp-tabs">
        {files.map(f => (
          <button key={f.name} className={`bdp-tab ${activeFile === f.name ? 'is-active' : ''} ${pausedFile === f.name ? 'is-paused' : ''}`} onClick={() => setActiveFile(f.name)}>
            {pausedFile === f.name && <span className="bdp-tab-arrow">→</span>}
            {f.name}
            {(breakpoints[f.name]?.length || 0) > 0 && <span className="bdp-tab-bp-count">{breakpoints[f.name].length}</span>}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="bdp-body">

        {/* Left: editor */}
        <div className="bdp-editor-col">
          {activeFileObj ? (
            <div style={{ position: 'relative', height: '100%' }}>
              <EditorView
                key={activeFile}
                value={activeContent}
                language={getLanguage(activeFile)}
                height="100%"
                readOnly={isPaused}
                debugSupported
                breakpoints={activeBp}
                disabledBreakpoints={activeDisabledBp}
                conditionalBreakpointLines={activeCondLines}
                pausedLine={currentPausedLine}
                onToggleBreakpoint={line => toggleBreakpoint(activeFile, line)}
                onGlyphContextMenu={handleGlyphContextMenu}
                onEditorMount={handleEditorMount}
                bordered={false}
              />
              {dbgHoverTip && (
                <div className="bdp-var-tip" style={{ left: dbgHoverTip.x, top: dbgHoverTip.y }}>
                  <span style={{ color: '#4fc3f7', fontSize: 10, display: 'block', marginBottom: 3, fontFamily: 'Menlo,Consolas,monospace' }}>{dbgHoverTip.name}</span>
                  <pre className="bdp-var-tip-pre">{fullValueStr(dbgHoverTip.value)}</pre>
                </div>
              )}
              {condInput && (
                <div className="bdp-cond-input-wrap" style={{ top: `${(condInput.line - 1) * 20 + 34}px` }}>
                  <span className="bdp-cond-label">Expression</span>
                  <input autoFocus className="bdp-cond-input" value={condInput.value}
                    onChange={e => setCondInput({ ...condInput, value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') handleConditionSubmit(); if (e.key === 'Escape') setCondInput(null) }}
                    onBlur={handleConditionSubmit}
                    placeholder="Break when expression is truthy, e.g. x > 5"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bdp-no-file">
              {filesStatus === 'loaded' ? 'No debuggable files for this block type.' : 'Loading files…'}
            </div>
          )}
        </div>

        {/* Right: Run and Debug panel */}
        <div className="bdp-debug-panel">
          <div className="bdp-debug-panel-head">
            <RunDebugIcon size={13} />
            <span className="bdp-debug-panel-title">Run and Debug</span>
            {status !== 'idle' && (
              <div className="bdp-debug-panel-actions">
                <button className="bdp-dbg-action" onClick={handleContinue} disabled={!isPaused} title="Continue"><DbgContinueIcon size={11} /></button>
                <button className="bdp-dbg-action" onClick={handleStepOver} disabled={!isPaused} title="Step Over"><DbgStepOverIcon size={11} /></button>
                <button className="bdp-dbg-action" onClick={handleStepInto} disabled={!isPaused} title="Step Into"><DbgStepIntoIcon size={11} /></button>
                <button className="bdp-dbg-action" onClick={handleStepOut} disabled={!isPaused} title="Step Out"><DbgStepOutIcon size={11} /></button>
                <button className="bdp-dbg-action" onClick={handleRestart} title="Restart"><DbgRestartIcon size={11} /></button>
                <button className="bdp-dbg-action" onClick={handleStop} title="Stop"><DbgStopIcon size={11} /></button>
              </div>
            )}
          </div>

          <div className="bdp-debug-panel-body">
            {hasServerFile && (
              <div className="bdp-server-test">
                <button
                  className="bdp-server-test-btn"
                  onClick={handleTestOnServer}
                  disabled={status === 'running' || status === 'paused' || serverTestStatus === 'connecting'}
                  title="Run server.js debug-instrumented against ck8t-server"
                >
                  {serverTestStatus === 'connecting' ? 'Connecting…' : 'Test on Server'}
                </button>
                {serverTestStatus === 'unreachable' && (
                  <span className="bdp-server-unreachable" title="Start ck8t-server (npm run server) and try again">
                    ck8t-server not running
                  </span>
                )}
              </div>
            )}
            <VariablesSection variables={variables} active={status !== 'idle'} />
            <WatchSection variables={variables} />
            <CallStackSection callStack={callStack} active={status !== 'idle'} status={status} />
            <BreakpointsSection breakpoints={breakpoints} disabledBreakpoints={disabledBreakpoints} conditions={conditions} breakpointsMuted={breakpointsMuted}
              onNavigate={(file, line) => useBlockDebuggerStore.getState().setNavigateLine(file, line)} />

            {(status === 'completed' || status === 'error') && (
              <div className="bdp-output-wrap">
                <div className={`bdp-panel-label ${status === 'error' ? 'is-error' : ''}`}>{status === 'error' ? 'Error' : 'Output'}</div>
                <pre className={`bdp-output-pre ${status === 'error' ? 'is-error' : ''}`}>
                  {status === 'error' ? lastError : serialize(lastOutput)}
                </pre>
              </div>
            )}

            <ConsoleSection consoleLogs={consoleLogs} />
          </div>
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.pos.x} y={ctxMenu.pos.y} items={ctxItems} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  )
}

function getLanguage(filename) {
  if (!filename) return 'javascript'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'ts') return 'typescript'
  if (ext === 'json') return 'json'
  return 'javascript'
}

function serialize(v) {
  if (v == null) return String(v)
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
