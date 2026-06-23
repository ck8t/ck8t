/**
 * UI Audit Store — universal event tracking for all CK8T UI actions.
 * Defines the event taxonomy, manages enable/disable config (localStorage),
 * and maintains an in-memory ring-buffer of fired events.
 */

// ─── Event definitions ────────────────────────────────────────────────────────

export const AUDIT_EVENT_DEFS = [
  // ── Workflow ────────────────────────────────────────────────────────────────
  { id: 'workflow.run',     module: 'Workflow', button: 'Run',     action: 'click',  description: 'Execute the active workflow',           color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.save',    module: 'Workflow', button: 'Save',    action: 'click',  description: 'Save the active workflow',              color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.export',  module: 'Workflow', button: 'Export',  action: 'click',  description: 'Export workflow JSON to file',          color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.import',  module: 'Workflow', button: 'Import',  action: 'create', description: 'Import workflow from JSON file',        color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.new',     module: 'Workflow', button: 'New',     action: 'create', description: 'Create new blank workflow',             color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.delete',  module: 'Workflow', button: 'Delete',  action: 'delete', description: 'Delete a workflow',                    color: '#818cf8', defaultEnabled: true  },
  { id: 'workflow.rename',  module: 'Workflow', button: 'Rename',  action: 'update', description: 'Rename a workflow',                    color: '#818cf8', defaultEnabled: false },
  { id: 'workflow.switch',  module: 'Workflow', button: 'Switch',  action: 'click',  description: 'Switch to a different workflow tab',   color: '#818cf8', defaultEnabled: false },

  // ── Canvas ──────────────────────────────────────────────────────────────────
  { id: 'canvas.block.add',       module: 'Canvas', button: 'Add Block',     action: 'create', description: 'Add block to canvas from palette',       color: '#60a5fa', defaultEnabled: true  },
  { id: 'canvas.block.delete',    module: 'Canvas', button: 'Delete Block',  action: 'delete', description: 'Delete selected block(s) from canvas',   color: '#60a5fa', defaultEnabled: true  },
  { id: 'canvas.block.duplicate', module: 'Canvas', button: 'Duplicate',     action: 'create', description: 'Duplicate a block on canvas',            color: '#60a5fa', defaultEnabled: false },
  { id: 'canvas.edge.connect',    module: 'Canvas', button: 'Connect',       action: 'create', description: 'Connect two blocks with an edge',        color: '#60a5fa', defaultEnabled: false },
  { id: 'canvas.edge.disconnect', module: 'Canvas', button: 'Disconnect',    action: 'delete', description: 'Remove an edge between blocks',          color: '#60a5fa', defaultEnabled: false },
  { id: 'canvas.zoom.fit',        module: 'Canvas', button: 'Fit View',      action: 'click',  description: 'Fit entire workflow to viewport',        color: '#60a5fa', defaultEnabled: false },
  { id: 'canvas.select.all',      module: 'Canvas', button: 'Select All',    action: 'click',  description: 'Select all blocks on canvas',            color: '#60a5fa', defaultEnabled: false },

  // ── Community Blocks ────────────────────────────────────────────────────────
  { id: 'blocks.install',   module: 'Community Blocks', button: 'Install',   action: 'create', description: 'Install a community block package',   color: '#a78bfa', defaultEnabled: true  },
  { id: 'blocks.uninstall', module: 'Community Blocks', button: 'Uninstall', action: 'delete', description: 'Uninstall a community block package', color: '#a78bfa', defaultEnabled: true  },
  { id: 'blocks.refresh',   module: 'Community Blocks', button: 'Refresh',   action: 'click',  description: 'Refresh community block palette',     color: '#a78bfa', defaultEnabled: false },

  // ── MCP ─────────────────────────────────────────────────────────────────────
  { id: 'mcp.server.add',        module: 'MCP', button: 'Add Server',    action: 'create', description: 'Add a new MCP server connection',  color: '#22d3ee', defaultEnabled: true  },
  { id: 'mcp.server.remove',     module: 'MCP', button: 'Remove Server', action: 'delete', description: 'Remove an MCP server',              color: '#22d3ee', defaultEnabled: true  },
  { id: 'mcp.server.connect',    module: 'MCP', button: 'Connect',       action: 'click',  description: 'Connect to an MCP server',          color: '#22d3ee', defaultEnabled: true  },
  { id: 'mcp.server.disconnect', module: 'MCP', button: 'Disconnect',    action: 'click',  description: 'Disconnect from an MCP server',     color: '#22d3ee', defaultEnabled: true  },

  // ── Skills ──────────────────────────────────────────────────────────────────
  { id: 'skill.save',   module: 'Skills', button: 'Save Skill',   action: 'click',  description: 'Save a skill to the library',    color: '#34d399', defaultEnabled: true  },
  { id: 'skill.delete', module: 'Skills', button: 'Delete Skill', action: 'delete', description: 'Delete a skill from the library', color: '#34d399', defaultEnabled: true  },
  { id: 'skill.run',    module: 'Skills', button: 'Test Skill',   action: 'click',  description: 'Run a skill test from editor',   color: '#34d399', defaultEnabled: false },

  // ── Inspector ───────────────────────────────────────────────────────────────
  { id: 'inspect.open', module: 'Inspector', button: 'Open Inspector', action: 'click', description: 'Open node run-trace inspector',    color: '#fb923c', defaultEnabled: false },
  { id: 'inspect.copy', module: 'Inspector', button: 'Copy Trace',    action: 'click', description: 'Copy node trace to clipboard',      color: '#fb923c', defaultEnabled: false },

  // ── Settings ─────────────────────────────────────────────────────────────────
  { id: 'settings.open',            module: 'Settings', button: 'Settings',        action: 'click',  description: 'Open the settings panel',          color: '#94a3b8', defaultEnabled: false },
  { id: 'settings.theme',           module: 'Settings', button: 'Toggle Theme',    action: 'toggle', description: 'Toggle dark / light theme',         color: '#94a3b8', defaultEnabled: false },
  { id: 'settings.provider.change', module: 'Settings', button: 'Provider',        action: 'update', description: 'Change active LLM provider',        color: '#94a3b8', defaultEnabled: true  },

  // ── DB ───────────────────────────────────────────────────────────────────────
  { id: 'db.save', module: 'DB', button: 'Auto-save', action: 'update', description: 'Canvas snapshot persisted to SQLite', color: '#34d399', defaultEnabled: false },
]

// ─── Module display order ─────────────────────────────────────────────────────

export const MODULE_ORDER = ['Workflow', 'Canvas', 'Community Blocks', 'MCP', 'Skills', 'Inspector', 'Settings', 'DB']

// ─── localStorage config ─────────────────────────────────────────────────────

const CONFIG_KEY      = 'ck8t_audit_config'
const RATE_CONFIG_KEY = 'ck8t_audit_rate'

const RATE_DEFAULTS = { maxCount: 5, windowMs: 60_000 }

export function getAuditConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') } catch { return {} }
}

export function setAuditEventEnabled(id, enabled) {
  const cfg = getAuditConfig()
  cfg[id] = enabled
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch {}
}

export function isAuditEventEnabled(id) {
  const cfg = getAuditConfig()
  if (id in cfg) return cfg[id]
  return AUDIT_EVENT_DEFS.find(d => d.id === id)?.defaultEnabled ?? false
}

export function resetAuditConfig() {
  try { localStorage.removeItem(CONFIG_KEY) } catch {}
}

export function getRateConfig() {
  try { return { ...RATE_DEFAULTS, ...JSON.parse(localStorage.getItem(RATE_CONFIG_KEY) || '{}') } } catch { return { ...RATE_DEFAULTS } }
}

export function setRateConfig(patch) {
  try { localStorage.setItem(RATE_CONFIG_KEY, JSON.stringify({ ...getRateConfig(), ...patch })) } catch {}
}

// ─── In-memory ring buffer ────────────────────────────────────────────────────

const MAX_LOG = 500
let _log = []
const _listeners = new Set()

function _notify() { _listeners.forEach(fn => fn()) }

export function logUiEvent(id, metadata) {
  if (!isAuditEventEnabled(id)) return
  const def = AUDIT_EVENT_DEFS.find(d => d.id === id)
  if (!def) return

  // Rate-limit: same event id max N times per time window
  const { maxCount, windowMs } = getRateConfig()
  const now = Date.now()
  const recentSame = _log.filter(e => e.eventId === id && now - e.timestamp <= windowMs)
  if (recentSame.length >= maxCount) return

  const entry = {
    id:        crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    eventId:   id,
    module:    def.module,
    button:    def.button,
    action:    def.action,
    color:     def.color,
    description: def.description,
    metadata:  metadata ?? null,
    timestamp: now,
  }
  _log = [entry, ..._log].slice(0, MAX_LOG)
  _notify()
}

export function getUiAuditLog() { return _log }

export function clearUiAuditLog() { _log = []; _notify() }

export function subscribeUiAudit(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
