/**
 * MCP Servers management panel (embedded in the Settings tab).
 */
import { useEffect, useRef, useState } from 'react'
import { useMcpStore } from '../mcp/mcp-store'
import { McpIcon, PlusIcon, TrashIcon } from '../components/icons'
import StyledSelect from '../components/StyledSelect'

const EMPTY = {
  id: '',
  name: '',
  transport: 'STDIO',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: '',
}

export default function McpServersPanel() {
  const servers = useMcpStore((s) => s.servers)
  const loading = useMcpStore((s) => s.loading)
  const error = useMcpStore((s) => s.error)
  const refresh = useMcpStore((s) => s.refreshServers)
  const upsert = useMcpStore((s) => s.upsertServer)
  const remove = useMcpStore((s) => s.deleteServer)
  const loadTools = useMcpStore((s) => s.loadTools)
  const toolsByServer = useMcpStore((s) => s.toolsByServer)

  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toolsFor, setToolsFor] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const _autoProbedRef = useRef(false)

  const isWarn = typeof error === 'string' && (
    /MCP warning:/i.test(error) ||
    /not reachable/i.test(error) ||
    /server not reachable/i.test(error)
  )

  useEffect(() => { refresh() }, [refresh])

  // Auto-probe all servers once after the list loads so dots turn green on reopen
  useEffect(() => {
    if (servers.length > 0 && !_autoProbedRef.current) {
      _autoProbedRef.current = true
      servers.forEach(s => loadTools(s.id, { refresh: false }))
    }
  }, [servers, loadTools])

  async function handleSave() {
    setBusy(true)
    try {
      await upsert(formToConfig(editing))
      setEditing(null)
    } catch (e) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleShowTools(id) {
    if (toolsFor === id) { setToolsFor(null); return }
    setToolsFor(id)
    await loadTools(id, { refresh: true })
  }

  return (
    <div className="bs-mcp-panel">
      {/* Header */}
      <div className="bs-mcp-panel-head">
        <McpIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">MCP Servers</h3>
        <div className="bs-mcp-panel-actions">
          <button
            className="bs-icon-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
          >
            <span className={`bs-refresh-glyph ${loading ? 'is-spinning' : ''}`}>⟳</span>
          </button>
          <button className="bs-mcp-add-btn" onClick={() => setEditing({ ...EMPTY })}>
            <PlusIcon className="bs-ico-xs" />
            <span>Add server</span>
          </button>
        </div>
      </div>

      {error && <div className={isWarn ? 'bs-mcp-warn' : 'bs-mcp-error'}>{error}</div>}

      {/* Server list */}
      <div className="bs-mcp-list">
        {servers.length === 0 && !loading && !editing && (
          <div className="bs-mcp-empty">
            No MCP servers configured yet. Click <b>Add server</b> to connect one.
          </div>
        )}

        {servers.map((s) => {
          const tools = toolsByServer[s.id]
          const toolsOpen = toolsFor === s.id
          const hasTools = Array.isArray(tools) && tools.length > 0
          const endpoint = s.transport === 'STDIO'
            ? [s.command, ...(s.args || [])].filter(Boolean).join(' ')
            : s.url || ''

          return (
            <div key={s.id} className="bs-mcp-row">
              {/* Main row */}
              <div className="bs-mcp-row-head">
                {/* Status dot — green if tools loaded, muted otherwise */}
                <span
                  className="bs-mcp-dot"
                  style={{ background: hasTools ? '#22c55e' : toolsOpen ? '#f59e0b' : '#4b5563' }}
                  title={hasTools ? `${tools.length} tools loaded` : 'Not probed'}
                />

                {/* Name */}
                <span className="bs-mcp-row-name">{s.name || s.id}</span>

                {/* Transport badge */}
                <span className="bs-mcp-badge">{(s.transport || 'stdio').toLowerCase()}</span>

                {/* Command/URL (truncated) */}
                <code className="bs-mcp-row-endpoint">{endpoint}</code>

                {/* Tool count */}
                {hasTools && (
                  <span className="bs-mcp-tool-count">{tools.length} tools</span>
                )}

                {/* Actions */}
                <div className="bs-mcp-row-actions">
                  <button
                    className="bs-mcp-ghost-btn"
                    onClick={() => handleShowTools(s.id)}
                  >
                    {toolsOpen ? 'Hide tools' : 'Tools'}
                  </button>
                  <button
                    className="bs-mcp-ghost-btn"
                    onClick={() => setEditing(configToForm(s))}
                  >
                    Edit
                  </button>
                  {confirmDeleteId === s.id ? (
                    <div className="bs-mcp-confirm-del" onClick={(e) => e.stopPropagation()}>
                      <span>Delete?</span>
                      <button
                        className="bs-mcp-confirm-yes"
                        onClick={async () => {
                          setConfirmDeleteId(null)
                          try { await remove(s.id) } catch (e) { alert(e.message) }
                        }}
                      >Yes</button>
                      <button
                        className="bs-mcp-confirm-no"
                        onClick={() => setConfirmDeleteId(null)}
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      className="bs-mcp-ghost-btn bs-mcp-del-btn"
                      onClick={() => setConfirmDeleteId(s.id)}
                      title="Remove server"
                    >
                      <TrashIcon className="bs-ico-xs" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tool list */}
              {toolsOpen && (
                <div className="bs-mcp-tools">
                  {tools == null ? (
                    <div className="bs-mcp-tools-loading">Loading tools…</div>
                  ) : tools.length === 0 ? (
                    <div className="bs-mcp-tools-loading">No tools advertised (or server not reachable).</div>
                  ) : (
                    <ul className="bs-mcp-tools-list">
                      {tools.map((t) => (
                        <li key={t.name} className="bs-mcp-tool-row">
                          <code className="bs-mcp-tool-name">{t.name}</code>
                          {t.description && (
                            <span className="bs-mcp-tool-desc" title={t.description}>
                              {t.description}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add / Edit form */}
      {editing && (
        <McpServerForm
          form={editing}
          setForm={setEditing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          busy={busy}
        />
      )}
    </div>
  )
}

function McpServerForm({ form, setForm, onSave, onCancel, busy }) {
  const up = (k, v) => setForm({ ...form, [k]: v })
  return (
    <div className="bs-mcp-form">
      <div className="bs-mcp-form-title">{form.id ? 'Edit MCP server' : 'New MCP server'}</div>

      <div className="bs-field">
        <label className="bs-label">Name</label>
        <input className="bs-input" value={form.name} onChange={(e) => up('name', e.target.value)} placeholder="e.g. ideogram4" />
      </div>

      <div className="bs-field">
        <label className="bs-label">Transport</label>
        <StyledSelect
          value={form.transport}
          onChange={(id) => up('transport', id)}
          options={[
            { id: 'STDIO', label: 'stdio (spawn subprocess)' },
            { id: 'HTTP',  label: 'http (JSON-RPC POST)' },
            { id: 'SSE',   label: 'sse (server-sent events)' },
          ]}
        />
      </div>

      {form.transport === 'STDIO' ? (
        <>
          <div className="bs-field">
            <label className="bs-label">Command</label>
            <input className="bs-input" value={form.command} onChange={(e) => up('command', e.target.value)} placeholder="npx" />
          </div>
          <div className="bs-field">
            <label className="bs-label">Arguments (one per line)</label>
            <textarea
              className="bs-textarea"
              rows={4}
              value={form.args}
              onChange={(e) => up('args', e.target.value)}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/tmp'}
            />
          </div>
          <div className="bs-field">
            <label className="bs-label">Environment (KEY=value per line)</label>
            <textarea
              className="bs-textarea"
              rows={3}
              value={form.env}
              onChange={(e) => up('env', e.target.value)}
              placeholder={'ANTHROPIC_API_KEY=sk-ant-xxx'}
            />
          </div>
        </>
      ) : (
        <>
          <div className="bs-field">
            <label className="bs-label">URL</label>
            <input className="bs-input" value={form.url} onChange={(e) => up('url', e.target.value)} placeholder="https://example.com/mcp" />
          </div>
          <div className="bs-field">
            <label className="bs-label">Headers (KEY: value per line)</label>
            <textarea
              className="bs-textarea"
              rows={3}
              value={form.headers}
              onChange={(e) => up('headers', e.target.value)}
              placeholder={'Authorization: Bearer xxx'}
            />
          </div>
        </>
      )}

      <div className="bs-mcp-form-actions">
        <button className="bs-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="bs-btn-primary" onClick={onSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function configToForm(cfg) {
  return {
    id: cfg.id || '',
    name: cfg.name || '',
    transport: cfg.transport || 'STDIO',
    command: cfg.command || '',
    args: Array.isArray(cfg.args) ? cfg.args.join('\n') : '',
    env: cfg.env ? Object.entries(cfg.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
    url: cfg.url || '',
    headers: cfg.headers ? Object.entries(cfg.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
  }
}

function formToConfig(form) {
  const cfg = {
    id: form.id || undefined,
    name: form.name?.trim(),
    transport: form.transport,
  }
  if (form.transport === 'STDIO') {
    cfg.command = form.command?.trim()
    cfg.args = (form.args || '').split('\n').map((s) => s.trim()).filter(Boolean)
    const env = {}
    for (const line of (form.env || '').split('\n')) {
      const i = line.indexOf('=')
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    if (Object.keys(env).length) cfg.env = env
  } else {
    cfg.url = form.url?.trim()
    const headers = {}
    for (const line of (form.headers || '').split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    if (Object.keys(headers).length) cfg.headers = headers
  }
  return cfg
}
