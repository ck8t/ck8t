/**
 * CK8T Block Manager — ComfyUI-style community block installer.
 * Full-width tab with colorful marketplace UI + resizable split panels.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { listInstalledBlocks, installBlock, uninstallBlock, installBlockFromZip, checkBlockUpdate, updateBlock } from '../api/block-manager-client'
import { SplitPanelView } from './SplitPanelView'

/* ── Icons ── */
function PackageIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}
function TrashIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}
function GitHubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  )
}
function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function RefreshIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
function RestartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* circular arrow */}
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <polyline points="3 3 3 8 8 8"/>
      {/* power dot */}
      <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2.2"/>
    </svg>
  )
}
function CopyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}
function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}
function UpdateIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  )
}
function ZipIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="12" x2="12" y2="17"/><polyline points="9 15 12 18 15 15"/>
      <line x1="10" y1="11" x2="14" y2="11"/>
    </svg>
  )
}

/* ── Manager Icon: 4-block grid with top-right block sliding in ── */
export function ManagerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <rect x="2" y="13" width="8.5" height="8.5" rx="1.5" opacity="0.45" />
      <rect x="13.5" y="13" width="8.5" height="8.5" rx="1.5" opacity="0.45" />
      <rect x="2" y="2" width="8.5" height="8.5" rx="1.5" opacity="0.45" />
      <rect x="13.5" y="2" width="8.5" height="8.5" rx="1.5" />
      <path d="M23 0.75 L20.5 0.75 L20.5 3" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
      <path d="M18.5 1.5 L20.5 3.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  )
}

/* ── Color palette — one gradient per installed package, seeded from id ── */
const PALETTE = [
  { grad: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', dot: '#818cf8', chip: 'rgba(99,102,241,0.18)' },
  { grad: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)', dot: '#7dd3fc', chip: 'rgba(14,165,233,0.18)' },
  { grad: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', dot: '#6ee7b7', chip: 'rgba(16,185,129,0.18)' },
  { grad: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)', dot: '#fcd34d', chip: 'rgba(245,158,11,0.18)' },
  { grad: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', dot: '#f9a8d4', chip: 'rgba(236,72,153,0.18)' },
  { grad: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', dot: '#c4b5fd', chip: 'rgba(139,92,246,0.18)' },
  { grad: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)', dot: '#5eead4', chip: 'rgba(20,184,166,0.18)' },
  { grad: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', dot: '#fdba74', chip: 'rgba(249,115,22,0.18)' },
]
function getPalette(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return PALETTE[h % PALETTE.length]
}

/* ── Scaffold content ── */
const MANIFEST_SCAFFOLD = `{
  "id": "my-cool-block",
  "name": "My Cool Block",
  "version": "1.0.0",
  "author": "your-github-username",
  "description": "What this block does",
  "blocks": [
    { "type": "my_cool_block", "ui": "ui/my-cool-block.js" }
  ],
  "runners": {
    "server":    "runners/server.js",
    "extension": "runners/extension.js",
    "client":    "runners/client.js"
  }
}`

const UI_SCAFFOLD = `// ui/my-cool-block.js
//
// CK8tBlock base fields (inherited by all blocks):
//   type, name, description, category, bgColor, iconSvg,
//   subBlocks, inputs, outputs, hasProgress, singleton, run
//
// Set hasProgress: true to show a live progress bar
// inside the node card while the block is running.
// The graph-runner then injects a progress() callback
// into your run() — call it at each stage.

export default {
  type:        'my_cool_block',
  name:        'My Cool Block',
  description: 'What this block does',
  category:    'custom',     // 'blocks' | 'tools' | 'triggers' | 'custom'
  bgColor:     '#6366f1',
  iconSvg:     'M12 2L2 7l10 5 10-5-10-5|M2 17l10 5 10-5|M2 12l10 5 10-5',

  hasProgress: true,         // ← show inline progress footer on the node card

  subBlocks: [
    {
      id:          'prompt',
      title:       'Prompt',
      type:        'long-input',
      placeholder: 'Enter prompt…',
    },
    {
      id:          'mcp_server',
      title:       'MCP Server',
      type:        'mcp-server-selector',
      placeholder: 'Select MCP server',
    },
  ],

  inputs:  { input:  { type: 'any',    description: 'Upstream data' } },
  outputs: { result: { type: 'json',   description: 'Block output'  } },

  async run({ values, input, progress }) {
    // progress is injected when hasProgress: true.
    // Always use optional chaining — safe when hasProgress is false.
    progress?.({ pct: 0, step: 1, total: 3, label: 'Starting…' })

    // Do your work here
    const result = await doSomething(values, input)

    progress?.({ pct: 60, step: 2, total: 3, label: 'Processing…' })

    const output = transform(result)

    progress?.({ pct: 100, step: 3, total: 3, label: 'Done' })

    return { result: output }
  },
}`

const RUNNER_SCAFFOLD = `// runners/extension.js
// Runs inside the VS Code extension host (Node.js).
// Same module shape for server.js (ck8t-server) and
// client.js (browser).  Export an array of runners.
//
// callTool(serverName, toolName, args) — calls an MCP tool
// callAgent(prompt, model?, options?) — calls an LLM agent
// progress({ pct, step, total, label }) — updates the node card

module.exports = [
  {
    type: 'my_cool_block',
    async run({ values, input, callTool, callAgent, progress }) {
      progress?.({ pct: 0,  step: 1, total: 3, label: 'Calling MCP…' })

      const server = values.mcp_server || 'my-mcp-server'
      const result = await callTool(server, 'my_tool', {
        prompt: values.prompt || String(input ?? ''),
      })

      progress?.({ pct: 70, step: 2, total: 3, label: 'Processing result…' })

      const output = typeof result === 'string'
        ? JSON.parse(result)
        : result

      progress?.({ pct: 100, step: 3, total: 3, label: 'Done' })

      return { result: output }
    },
  },
]`

const FILE_SCAFFOLD = `my-cool-block/
├── ck8t-block.json        ← Step 1: manifest (id, name, version, runners)
├── ui/
│   └── my-cool-block.js   ← Step 2: block UI definition
│                              type, name, bgColor, subBlocks,
│                              inputs, outputs, hasProgress, run()
└── runners/
    ├── extension.js       ← Step 3: runs inside VS Code extension host
    ├── server.js          ←         runs inside ck8t-server (standalone)
    └── client.js          ←         runs in browser (client-side only)

Sharing:
  • ZIP it → install via Block Manager → Install tab
  • Push to GitHub → one-click install with the repo URL
  • After install, block appears in the Custom palette
    and reloads automatically on next CK8T restart`

const CREATE_STEPS = [
  {
    id: 'manifest', label: 'Manifest', sub: 'ck8t-block.json',
    desc: 'The package descriptor. CK8T reads this to discover your block\'s ID, name, version, and which files to load. One manifest per package — a single package can ship multiple block types.',
    content: MANIFEST_SCAFFOLD, color: '#6366f1',
  },
  {
    id: 'ui', label: 'Block UI', sub: 'ui/my-cool-block.js',
    desc: 'The client-side definition: palette icon, Inspector fields (subBlocks), port types, and the browser run() function. Set hasProgress: true to show a live indigo progress bar inside the node card. Use iconSvg instead of a React icon import — community blocks are loaded without ES module resolution.',
    content: UI_SCAFFOLD, color: '#0ea5e9',
  },
  {
    id: 'runner', label: 'Runner', sub: 'runners/extension.js',
    desc: 'Server-side execution logic. Same array shape for extension.js (VS Code), server.js (ck8t-server), and client.js (browser). callTool() and callAgent() are injected automatically. progress() updates the inline card progress bar when hasProgress is true.',
    content: RUNNER_SCAFFOLD, color: '#10b981',
  },
  {
    id: 'files', label: 'File Structure', sub: 'directory layout',
    desc: 'Your complete package layout. ZIP and install locally via the Install tab, or push to a public GitHub repo for one-click community installs. After install and restart, your block appears under Custom in the palette.',
    content: FILE_SCAFFOLD, color: '#f59e0b',
  },
]

/* ── Main component ── */
export default function BlockManager() {
  const [tab, setTab] = useState('installed')
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [installUrl, setInstallUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState(null)
  const [uninstalling, setUninstalling] = useState(null)
  const [confirmUninstallId, setConfirmUninstallId] = useState(null)
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [createStep, setCreateStep] = useState(0)
  const [zipInstalling, setZipInstalling] = useState(false)
  const zipInputRef = useRef(null)
  // update check state: { [id]: { checking, hasUpdate, latestVersion, currentVersion, updating, error, done } }
  const [updateState, setUpdateState] = useState({})

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listInstalledBlocks()
      setBlocks(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not reach ck8t-server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInstall() {
    if (!installUrl.trim()) return
    setInstalling(true)
    setInstallResult(null)
    try {
      const block = await installBlock(installUrl.trim())
      setInstallResult({ ok: true, name: block.name || block.id })
      setInstallUrl('')
      setRestartNeeded(true)
      notifyBlocksChanged()
      await load()
      setTab('installed')
    } catch (err) {
      setInstallResult({ error: err.message || 'Install failed' })
    } finally {
      setInstalling(false)
    }
  }

  async function handleZipInstall(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setZipInstalling(true)
    setInstallResult(null)
    try {
      const block = await installBlockFromZip(file)
      setInstallResult({ ok: true, name: block.name || block.id })
      setRestartNeeded(true)
      notifyBlocksChanged()
      await load()
      setTab('installed')
    } catch (err) {
      setInstallResult({ error: err.message || 'ZIP install failed' })
    } finally {
      setZipInstalling(false)
    }
  }

  async function handleUninstall(id) {
    setConfirmUninstallId(null)
    setUninstalling(id)
    try {
      await uninstallBlock(id)
      setRestartNeeded(true)
      notifyBlocksChanged()
      if (selectedId === id) setSelectedId(null)
      await load()
    } catch (err) {
      setError(`Uninstall failed: ${err.message}`)
    } finally {
      setUninstalling(null)
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1600)
  }

  function handleRestart() {
    try {
      const api = window.__CK8T_VSCODE_API__
      if (api?.postMessage) { api.postMessage({ type: 'reloadWindow' }); return }
    } catch { /* not in extension */ }
    window.location.reload()
  }

  function notifyBlocksChanged() {
    try { window.__CK8T_VSCODE_API__?.postMessage({ type: 'blocks-changed' }) } catch { /* not in extension */ }
  }

  async function handleCheckUpdate(id) {
    setUpdateState((s) => ({ ...s, [id]: { checking: true } }))
    try {
      const result = await checkBlockUpdate(id)
      setUpdateState((s) => ({ ...s, [id]: { ...result, checking: false } }))
    } catch (err) {
      setUpdateState((s) => ({ ...s, [id]: { checking: false, error: err.message || 'Check failed' } }))
    }
  }

  async function handleUpdate(id) {
    setUpdateState((s) => ({ ...s, [id]: { ...s[id], updating: true, error: null } }))
    try {
      await updateBlock(id)
      setUpdateState((s) => ({ ...s, [id]: { ...s[id], updating: false, done: true } }))
      setRestartNeeded(true)
      notifyBlocksChanged()
      await load()
    } catch (err) {
      setUpdateState((s) => ({ ...s, [id]: { ...s[id], updating: false, error: err.message || 'Update failed' } }))
    }
  }

  /* ─── Installed: left panel ─── */
  const installedLeft = (
    <div className="bm-list-col">
      {error && (
        <div className="bm-error-bar">
          <span>{error}</span>
          <button className="bm-error-retry" onClick={load}>Retry</button>
        </div>
      )}
      {!error && blocks.length === 0 && !loading && (
        <div className="bm-empty-state">
          <PackageIcon className="bm-empty-ico" />
          <p className="bm-empty-title">No blocks installed</p>
          <p className="bm-empty-sub">Install a community block to get started</p>
          <button className="bm-link-btn" onClick={() => setTab('install')}>
            Browse Install →
          </button>
        </div>
      )}
      {loading && blocks.length === 0 && (
        <div className="bm-empty-state">
          <span className="bm-spinner bm-spinner-lg" />
        </div>
      )}
      <ul className="bm-card-list">
        {blocks.map((b) => {
          const pal = getPalette(b.id)
          return (
            <li
              key={b.id}
              className={`bm-card ${selectedId === b.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedId(b.id)}
            >
              <div className="bm-card-stripe" style={{ background: pal.grad }} />
              <div className="bm-card-body">
                <div className="bm-card-row">
                  <span className="bm-card-name">{b.name || b.id}</span>
                  <span className="bm-card-ver" style={{ color: pal.dot }}>v{b.version}</span>
                </div>
                {b.author && <div className="bm-card-author">by {b.author}</div>}
                {b.description && <div className="bm-card-desc">{b.description}</div>}
                <div className="bm-card-foot">
                  <span className="bm-chip" style={{ background: pal.chip, color: pal.dot }}>
                    {b.blockCount ?? (b.blocks?.length ?? 0)} block{(b.blockCount ?? 1) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )

  /* ─── Installed: right panel ─── */
  const installedRight = selectedBlock ? (() => {
    const pal = getPalette(selectedBlock.id)
    return (
      <div className="bm-detail-col">
        <div className="bm-detail-banner" style={{ background: pal.grad }}>
          <PackageIcon className="bm-detail-banner-ico" />
          <div className="bm-detail-banner-text">
            <div className="bm-detail-banner-name">{selectedBlock.name || selectedBlock.id}</div>
            {selectedBlock.author && (
              <div className="bm-detail-banner-author">by {selectedBlock.author}</div>
            )}
          </div>
          <span className="bm-detail-banner-ver">v{selectedBlock.version}</span>
        </div>

        <div className="bm-detail-body">
          {selectedBlock.description && (
            <p className="bm-detail-desc">{selectedBlock.description}</p>
          )}

          <div className="bm-detail-section-label">Block types</div>
          <div className="bm-block-type-list">
            {(selectedBlock.blocks || []).map((blk) => (
              <span key={blk.type || blk} className="bm-block-type-pill" style={{ borderColor: pal.dot, color: pal.dot }}>
                {blk.type || blk}
              </span>
            ))}
            {(!selectedBlock.blocks || selectedBlock.blocks.length === 0) && (
              <span className="bm-block-type-pill" style={{ borderColor: pal.dot, color: pal.dot }}>
                {selectedBlock.blockCount ?? '?'} block{(selectedBlock.blockCount ?? 1) !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="bm-detail-meta-grid">
            <span className="bm-detail-meta-label">Version</span>
            <span className="bm-detail-meta-val">{selectedBlock.version}</span>
            {selectedBlock.author && <>
              <span className="bm-detail-meta-label">Author</span>
              <span className="bm-detail-meta-val">{selectedBlock.author}</span>
            </>}
            {selectedBlock.installedAt && <>
              <span className="bm-detail-meta-label">Installed</span>
              <span className="bm-detail-meta-val">
                {new Date(selectedBlock.installedAt).toLocaleDateString()}
              </span>
            </>}
          </div>

          {selectedBlock.repository && (
            <a className="bm-detail-repo-link" href={selectedBlock.repository}
               target="_blank" rel="noreferrer">
              <GitHubIcon className="bm-ico-sm" />
              View on GitHub
              <ExternalLinkIcon className="bm-ico-xs" />
            </a>
          )}

          {/* ── Update checker (only for GitHub-installed blocks) ── */}
          {selectedBlock.repository && (() => {
            const us = updateState[selectedBlock.id] || {}
            if (us.done) return (
              <div className="bm-result-ok" style={{ marginBottom: 12 }}>
                <CheckIcon className="bm-ico-sm" />
                <span>Updated to <strong>v{us.latestVersion || selectedBlock.version}</strong></span>
                <button className="bm-restart-btn" onClick={handleRestart}>
                  <RestartIcon className="bm-ico-xs" /> Restart now
                </button>
              </div>
            )
            if (us.hasUpdate) return (
              <div className="bm-update-row">
                <div className="bm-update-badge">
                  <UpdateIcon className="bm-ico-xs" />
                  v{us.currentVersion} → v{us.latestVersion}
                </div>
                <button
                  className="bm-update-btn"
                  onClick={() => handleUpdate(selectedBlock.id)}
                  disabled={us.updating}
                >
                  {us.updating
                    ? <><span className="bm-spinner" /> Updating…</>
                    : <><UpdateIcon className="bm-ico-sm" /> Update</>}
                </button>
                {us.error && <div className="bm-error-bar" style={{ marginTop: 6 }}>{us.error}</div>}
              </div>
            )
            if (us.hasUpdate === false) return (
              <div className="bm-update-uptodate">
                <CheckIcon className="bm-ico-xs" /> Up to date (v{us.currentVersion})
              </div>
            )
            return (
              <button
                className="bm-check-update-btn"
                onClick={() => handleCheckUpdate(selectedBlock.id)}
                disabled={us.checking}
              >
                {us.checking
                  ? <><span className="bm-spinner" /> Checking…</>
                  : <><UpdateIcon className="bm-ico-sm" /> Check for update</>}
                {us.error && <span className="bm-check-update-err">{us.error}</span>}
              </button>
            )
          })()}

          {confirmUninstallId === selectedBlock.id ? (
            <div className="bm-uninstall-confirm">
              <span className="bm-uninstall-confirm-text">Remove this package?</span>
              <button
                className="bm-uninstall-btn bm-uninstall-yes"
                onClick={() => handleUninstall(selectedBlock.id)}
              >
                Yes, uninstall
              </button>
              <button
                className="bm-uninstall-cancel"
                onClick={() => setConfirmUninstallId(null)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="bm-uninstall-btn"
              onClick={() => setConfirmUninstallId(selectedBlock.id)}
              disabled={uninstalling === selectedBlock.id}
            >
              {uninstalling === selectedBlock.id
                ? <><span className="bm-spinner" /> Removing…</>
                : <><TrashIcon className="bm-ico-sm" /> Uninstall</>}
            </button>
          )}
        </div>
      </div>
    )
  })() : (
    <div className="bm-detail-empty">
      <PackageIcon className="bm-empty-ico" />
      <p className="bm-empty-title">No package selected</p>
      <p className="bm-empty-sub">Click a block package to view details</p>
    </div>
  )

  /* ─── Install: left panel ─── */
  const installLeft = (
    <div className="bm-install-col">

      {/* — GitHub section — */}
      <div className="bm-install-section">
        <div className="bm-install-section-header">
          <div className="bm-install-method-badge" style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>
            <GitHubIcon className="bm-ico-xs" /> GitHub
          </div>
        </div>
        <input
          className="bm-input"
          placeholder="https://github.com/user/ck8t-my-block"
          value={installUrl}
          onChange={(e) => { setInstallUrl(e.target.value); setInstallResult(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleInstall() }}
          disabled={installing || zipInstalling}
        />
        <button
          className="bm-install-btn"
          onClick={handleInstall}
          disabled={installing || zipInstalling || !installUrl.trim()}
        >
          {installing
            ? <><span className="bm-spinner" /> Installing…</>
            : <><GitHubIcon className="bm-ico-sm" /> Install from GitHub</>}
        </button>
      </div>

      {/* — divider — */}
      <div className="bm-install-divider"><span>or</span></div>

      {/* — ZIP section — */}
      <div className="bm-install-section">
        <div className="bm-install-section-header">
          <div className="bm-install-method-badge" style={{ background: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.3)', color: '#2dd4bf' }}>
            <ZipIcon className="bm-ico-xs" /> Local ZIP
          </div>
        </div>
        <div className="bm-zip-drop-area" onClick={() => zipInputRef.current?.click()}>
          <ZipIcon className="bm-zip-drop-ico" />
          <div className="bm-zip-drop-label">
            {zipInstalling ? 'Importing…' : 'Click to select a .zip file'}
          </div>
          <div className="bm-zip-drop-sub">must contain a ck8t-block.json manifest</div>
          {zipInstalling && <span className="bm-spinner" style={{ position: 'absolute', top: 10, right: 12 }} />}
        </div>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleZipInstall}
        />
      </div>

      {/* — feedback — */}
      {installResult?.ok && (
        <div className="bm-result-ok">
          <CheckIcon className="bm-ico-sm" />
          <span>Installed <strong>{installResult.name}</strong></span>
          <button className="bm-restart-btn" onClick={handleRestart}>
            <RestartIcon className="bm-ico-xs" />
            Restart now
          </button>
        </div>
      )}
      {installResult?.error && (
        <div className="bm-error-bar">{installResult.error}</div>
      )}
    </div>
  )

  /* ─── Install: right panel ─── */
  const installRight = (
    <div className="bm-tips-col">
      <div className="bm-tips-heading">How it works</div>

      <div className="bm-tips-method-label">
        <div className="bm-tips-method-dot" style={{ background: '#818cf8' }} />
        From GitHub
      </div>
      {[
        { n: 1, color: '#6366f1', title: 'Paste a GitHub URL', body: 'Point to a public repo or subdirectory that contains a ck8t-block.json manifest' },
        { n: 2, color: '#8b5cf6', title: 'Files download locally', body: <>All runner and UI files are saved to <code>~/.salilvnair/ck8t/blocks/</code></> },
      ].map((step) => (
        <div key={step.n} className="bm-tip-card">
          <div className="bm-tip-num" style={{ background: step.color }}>{step.n}</div>
          <div>
            <div className="bm-tip-title">{step.title}</div>
            <div className="bm-tip-body">{step.body}</div>
          </div>
        </div>
      ))}
      <div className="bm-tip-examples">
        <div className="bm-tip-eg-heading">Supported URL formats</div>
        <code className="bm-tip-url">github.com/user/ck8t-my-block</code>
        <code className="bm-tip-url">github.com/user/repo/tree/main/my-block</code>
      </div>

      <div className="bm-tips-method-label" style={{ marginTop: 16 }}>
        <div className="bm-tips-method-dot" style={{ background: '#2dd4bf' }} />
        From ZIP
      </div>
      {[
        { n: 3, color: '#0ea5e9', title: 'Select a .zip file', body: 'ZIP must contain a ck8t-block.json — can be a folder at the root or flat at the top level' },
        { n: 4, color: '#10b981', title: 'Restart to activate', body: <>Block appears in the palette under <strong>Custom</strong> after reload</> },
      ].map((step) => (
        <div key={step.n} className="bm-tip-card">
          <div className="bm-tip-num" style={{ background: step.color }}>{step.n}</div>
          <div>
            <div className="bm-tip-title">{step.title}</div>
            <div className="bm-tip-body">{step.body}</div>
          </div>
        </div>
      ))}
    </div>
  )

  /* ─── Create: left panel ─── */
  const createLeft = (
    <div className="bm-steps-col">
      <div className="bm-steps-heading">Block Package</div>
      <div className="bm-steps-sub">4 files to build and share a block</div>
      <div className="bm-steps-list">
        {CREATE_STEPS.map((step, i) => (
          <button
            key={step.id}
            className={`bm-step-item ${createStep === i ? 'is-active' : ''}`}
            onClick={() => setCreateStep(i)}
            style={{ '--step-color': step.color }}
          >
            <div className="bm-step-num" style={{ background: step.color }}>{i + 1}</div>
            <div className="bm-step-text">
              <div className="bm-step-label">{step.label}</div>
              <div className="bm-step-file">{step.sub}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="bm-steps-location">
        <div className="bm-steps-loc-label">Storage root</div>
        <code className="bm-steps-loc-code">~/.salilvnair/ck8t/blocks/</code>
      </div>
    </div>
  )

  /* ─── Create: right panel ─── */
  const step = CREATE_STEPS[createStep]
  const stepLang = ['json', 'javascript', 'javascript', 'bash'][createStep] || 'javascript'
  const createRight = (
    <div className="bm-code-col">
      <div className="bm-code-header">
        <span className="bm-code-badge" style={{ background: step.color }}>
          Step {createStep + 1}
        </span>
        <span className="bm-code-title">{step.label}</span>
        <code className="bm-code-file">{step.sub}</code>
        <button
          className="bm-copy-btn"
          onClick={() => copy(step.content, createStep)}
          title="Copy to clipboard"
        >
          {copiedKey === createStep
            ? <CheckIcon className="bm-ico-xs" />
            : <CopyIcon className="bm-ico-xs" />}
        </button>
      </div>
      {step.desc && (
        <div className="bm-step-desc" style={{ borderLeftColor: step.color }}>
          {step.desc}
        </div>
      )}
      <div className="bm-code-pre">
        <Highlight code={step.content.trimStart()} language={stepLang} theme={themes.vsDark}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={className}
              style={{
                ...style,
                margin: 0,
                padding: '16px 20px',
                fontSize: '0.8rem',
                lineHeight: 1.7,
                overflowX: 'auto',
                background: 'transparent',
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              }}
            >
              {tokens.map((line, i) => {
                const { key: _k, ...lp } = getLineProps({ line })
                return (
                  <div key={i} {...lp}>
                    {line.map((token, j) => {
                      const { key: _tk, ...tp } = getTokenProps({ token })
                      return <span key={j} {...tp} />
                    })}
                  </div>
                )
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  )

  /* ─── Render ─── */
  return (
    <div className="bm-root">
      {/* Header */}
      <div className="bm-header">
        <div className="bm-header-left">
          <div className="bm-header-icon-wrap">
            <ManagerIcon className="bm-header-ico" />
          </div>
          <div>
            <div className="bm-header-title">Block Manager</div>
            <div className="bm-header-sub">
              {blocks.length} package{blocks.length !== 1 ? 's' : ''} installed
            </div>
          </div>
        </div>
        <div className="bm-header-right">
          {restartNeeded && (
            <div className="bm-restart-pill">
              <span className="bm-restart-dot" />
              <button className="bm-restart-pill-btn" onClick={handleRestart}>
                <RestartIcon className="bm-ico-xs" />
                Restart now
              </button>
              <button className="bm-restart-dismiss" onClick={() => setRestartNeeded(false)}>×</button>
            </div>
          )}
          <button className="bm-header-btn" onClick={load} disabled={loading} title="Refresh">
            <RefreshIcon className={`bm-ico-sm ${loading ? 'bm-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bm-tabbar">
        {[
          { id: 'installed', label: 'Installed', count: blocks.length },
          { id: 'install',   label: 'Install' },
          { id: 'create',    label: 'Create' },
        ].map((t) => (
          <button
            key={t.id}
            className={`bm-tab2 ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bm-tab2-count">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body — full-height split panels */}
      <div className="bm-body">
        {tab === 'installed' && (
          <SplitPanelView
            direction="horizontal"
            defaultSplit={35}
            minFirst={180}
            minSecond={240}
            accentColor="var(--bs-accent, #818cf8)"
            first={installedLeft}
            second={installedRight}
          />
        )}
        {tab === 'install' && (
          <SplitPanelView
            direction="horizontal"
            defaultSplit={48}
            minFirst={220}
            minSecond={200}
            accentColor="#0ea5e9"
            first={installLeft}
            second={installRight}
          />
        )}
        {tab === 'create' && (
          <SplitPanelView
            direction="horizontal"
            defaultSplit={28}
            minFirst={160}
            minSecond={280}
            accentColor="#10b981"
            first={createLeft}
            second={createRight}
          />
        )}
      </div>
    </div>
  )
}
