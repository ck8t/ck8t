/**
 * Settings tab — keyboard shortcuts + LLM provider config.
 *
 * The table is grouped by context (canvas, rename, inspector, etc.) and
 * driven by `SHORTCUTS` so adding a new binding in Canvas.jsx /
 * AgentBuilderPage.jsx only needs a corresponding row here.
 */
import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Highlight, themes } from 'prism-react-renderer'
import { SettingsIcon, KeyboardIcon, McpIcon, SearchIcon, XIcon, TrashIcon } from '../components/icons'
import { changeRuntimeProvider, fetchAvailableProviders, fetchCustomProviders, saveCustomProvider, deleteCustomProvider, refreshCustomProviderModels } from '../api/llm-provider-client'
import McpServersPanel from './McpServersPanel'
import AiProvidersPanel from './AiProvidersPanel'
import { useLlmConfigStore } from '../stores/llm-config-store'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useUiStateStore } from '../stores/ui-state-store'
import { GETTING_STARTED_WORKFLOWS } from '../stores/getting-started-workflows'
import { useWorkflowStore } from '../stores/workflow-store'
import { useBrowserProvidersStore } from '../api/browser-providers-store'
import { detectServer } from '../api/server-status'
import StyledSelect from '../components/StyledSelect'
import { SplitPanelView, SearchInputView, DurationInputView, TextInputView } from '@salilvnair/dui'
import { useNavSignals } from '../stores/nav-signals'
import {
  AUDIT_EVENT_DEFS, MODULE_ORDER,
  getAuditConfig, setAuditEventEnabled, isAuditEventEnabled, resetAuditConfig,
  getRateConfig, setRateConfig,
  getUiAuditLog, clearUiAuditLog, subscribeUiAudit,
} from '../audit/ui-audit-store'

const MOD = /Mac|iPhone|iPad/.test(typeof navigator !== 'undefined' ? navigator.platform : '') ? '⌘' : 'Ctrl'

const RunShortcutIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polygon points="8,6 18,12 8,18" fill="currentColor" stroke="none" />
  </svg>
)

const SaveShortcutIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

const ExportShortcutIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const SHORTCUTS = [
  {
    group: 'Actions',
    items: [
      { keys: [MOD, '1'], desc: 'Run active workflow', icon: RunShortcutIcon, tone: 'run' },
      { keys: [MOD, '2'], desc: 'Save active workflow', icon: SaveShortcutIcon, tone: 'save' },
      { keys: [MOD, 'S'], desc: 'Save active workflow (alt)', icon: SaveShortcutIcon, tone: 'save' },
      { keys: [MOD, '3'], desc: 'Export active workflow as JSON', icon: ExportShortcutIcon, tone: 'export' },
    ],
  },
  {
    group: 'Canvas',
    items: [
      { keys: ['Delete'], or: ['Backspace'], desc: 'Delete selected node(s) — confirm dialog' },
      { keys: [MOD, 'D'], desc: 'Duplicate selected node(s)' },
      { keys: ['⌥', 'B'], desc: 'Toggle disable / enable selected node' },
      { keys: [MOD, 'I'], desc: 'Inspect the selected node (after run)' },
      { keys: [MOD, 'C'], desc: 'Copy selected node ID to clipboard' },
      { keys: [MOD, 'F'], desc: 'Fit all nodes into view' },
      { keys: [MOD, 'R'], desc: 'Reset zoom to 1:1' },
      { keys: [MOD, 'Z'], desc: 'Undo last canvas action' },
      { keys: [MOD, '⇧', 'Z'], or: [MOD, 'Y'], desc: 'Redo last undone action' },
      { keys: ['F2'], or: ['Enter'], desc: 'Rename the selected node' },
      { keys: ['Esc'], desc: 'Deselect / cancel rename' },
      { keys: ['↑', '↓', '←', '→'], desc: 'Nudge selected node(s) by 10px' },
      { keys: ['Shift', '+', 'Arrow'], desc: 'Nudge by 50px' },
      { keys: ['Double-click'], desc: 'Inline rename the node title' },
      { keys: ['Right-click'], desc: 'Open canvas / block context menu' },
      { keys: ['H'], desc: 'Switch to Pan mode — drag canvas to pan' },
      { keys: ['V'], desc: 'Switch to Select mode — drag to rubber-band select' },
      { keys: ['Left-drag'], desc: 'Rubber-band select multiple nodes (Select mode)' },
      { keys: [MOD, 'Click'], desc: 'Add / remove a node from selection' },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { keys: [MOD, '\\'], desc: 'Toggle left panel (block palette)', extensionKeys: ['⌥', '\\'] },
      { keys: [MOD, '/'], desc: 'Toggle inspector panel', extensionKeys: ['⌥', '/'] },
      { keys: [MOD, '.'], desc: 'Toggle bottom panel', extensionKeys: ['⌥', '.'] },
      { keys: [MOD, ','], desc: 'Open Settings', extensionKeys: ['⌥', ','] },
      { keys: ['?'], desc: 'Open Settings (shortcuts cheat-sheet)' },
    ],
  },
  {
    group: 'Edges',
    items: [
      { keys: ['Click'], desc: 'Select an edge' },
      { keys: ['Delete'], desc: 'Delete the selected edge' },
      { keys: ['Drag handle'], desc: 'Connect two blocks' },
    ],
  },
]

/* Extension-only shortcuts — shown only when running inside VS Code */
const EXTENSION_SHORTCUTS = [
  {
    group: 'VS Code Extension',
    items: [
      { keys: [MOD, 'M'], desc: 'Toggle light / dark theme' },
      { keys: ['⌥', '\\'], desc: 'Toggle left panel (replaces ⌘\\)' },
      { keys: ['⌥', '/'], desc: 'Toggle inspector panel (replaces ⌘/)' },
      { keys: ['⌥', '.'], desc: 'Toggle bottom panel (replaces ⌘.)' },
      { keys: ['⌥', ','], desc: 'Open Settings (replaces ⌘,)' },
    ],
  },
]

/* ── Sidebar tab definitions ─────────────────────────────────────────── */
const TipsIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const LlmIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="6" width="16" height="12" rx="3" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" />
    <path d="M12 3v3" />
  </svg>
)

const AppConfigIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)

const DatabaseIcon = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
)

const FolderOpenIcon = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const CopyPathIcon = (p) => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const CheckPathIcon = (p) => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const AuditIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const DevToolsIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
)

const GettingStartedIcon = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const SETTINGS_TABS = [
  { id: 'shortcuts', label: 'Keyboard Shortcuts', Icon: KeyboardIcon },
  { id: 'mcp', label: 'MCP Servers', Icon: McpIcon },
  { id: 'tips', label: 'Tips & Tricks', Icon: TipsIcon },
  { id: 'llm', label: 'LLM Provider Configuration', Icon: LlmIcon },
  { id: 'audit', label: 'AI Audit', Icon: AuditIcon },
  { id: 'getting_started', label: 'Getting Started', Icon: GettingStartedIcon },
  { id: 'appconfig', label: 'App Config', Icon: AppConfigIcon, extensionOnly: true },
  { id: 'devtools', label: 'Developer Tools', Icon: DevToolsIcon, extensionOnly: true },
]

export default function SettingsTab() {
  const [activeSection, setActiveSection] = useState('shortcuts')
  const isExtension = typeof window !== 'undefined' && window.__CK8T_MODE__ === 'vscode-extension'
  const visibleTabs = SETTINGS_TABS.filter(t => !t.extensionOnly || isExtension)

  // When sidebar "Read Docs" fires a gsSelectId, jump to Getting Started
  const gsSelectId   = useNavSignals((s) => s.gsSelectId)
  const clearGsTarget = useNavSignals((s) => s.clearGsTarget)
  useEffect(() => {
    if (gsSelectId) setActiveSection('getting_started')
  }, [gsSelectId])

  return (
    <div className="bs-settings-layout">
      {/* Left sidebar */}
      <nav className="bs-settings-sidebar">
        <div className="bs-settings-sidebar-head">
          <SettingsIcon className="bs-ico-sm" />
          <span>Settings</span>
        </div>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            className={`bs-settings-sidebar-item ${activeSection === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveSection(tab.id)}
          >
            <tab.Icon className="bs-ico-sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Right content area */}
      <div className="bs-settings-content">
        {activeSection === 'shortcuts' && <KeyboardShortcutsSection />}
        {activeSection === 'mcp' && <McpServersPanel />}
        {activeSection === 'tips' && <TipsAndTricksSection />}
        {activeSection === 'llm' && <AiProvidersPanel />}
        {activeSection === 'appconfig' && <AppConfigPanel />}
        {activeSection === 'audit' && <AiAuditSection />}
        {activeSection === 'devtools' && <DevToolsSection />}
        {activeSection === 'getting_started' && <GettingStartedSection pendingSelectId={gsSelectId} onPendingConsumed={clearGsTarget} />}
      </div>
    </div>
  )
}

/* ── Keyboard Shortcuts Section ──────────────────────────────────────── */
function KeyboardShortcutsSection() {
  const isExtension = typeof window !== 'undefined' && window.__CK8T_MODE__ === 'vscode-extension'
  const groups = isExtension ? [...SHORTCUTS, ...EXTENSION_SHORTCUTS] : SHORTCUTS
  return (
    <div className="bs-settings-pane">
      <div className="bs-settings-section-head">
        <KeyboardIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">Keyboard shortcuts</h3>
      </div>
      <div className="bs-settings-shortcuts">
        {groups.map((g) => (
          <div key={g.group} className="bs-settings-group">
            <div className="bs-settings-group-title">{g.group}</div>
            <table className="bs-kbd-table">
              <tbody>
                {g.items.map((it, i) => (
                  <tr key={i}>
                    <td className="bs-kbd-cell">
                      <KeyCombo keys={isExtension && it.extensionKeys ? it.extensionKeys : it.keys} />
                      {it.or && (
                        <>
                          <span className="bs-kbd-or">or</span>
                          <KeyCombo keys={it.or} />
                        </>
                      )}
                    </td>
                    <td className="bs-kbd-desc"><ShortcutDescription item={it} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Tips & Tricks Section ───────────────────────────────────────────── */
function TipsAndTricksSection() {
  return (
    <div className="bs-settings-pane">
      <div className="bs-settings-section-head">
        <TipsIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">Tips & tricks</h3>
      </div>
      <ul className="bs-tips">
        <li className="bs-tip">
          <span className="bs-tip-badge bs-tip-badge-input">Input</span>
          <span className="bs-tip-text">
            Drop a <b>User Input</b> block into the canvas and the Run dialog collects its value at runtime.
          </span>
        </li>
        <li className="bs-tip">
          <span className="bs-tip-badge bs-tip-badge-json">JSON</span>
          <span className="bs-tip-text">
            Toggle <b>Strict JSON output</b> on an agent to use structured-output mode
            (OpenAI <code>json_schema</code>).
          </span>
        </li>
        <li className="bs-tip">
          <span className="bs-tip-badge bs-tip-badge-menu">Menu</span>
          <span className="bs-tip-text">
            Right-click a block for <i>Open / Rename / Duplicate / Disconnect / Copy ID / Delete</i>.
          </span>
        </li>
        <li className="bs-tip">
          <span className="bs-tip-badge bs-tip-badge-ux">UX</span>
          <span className="bs-tip-text">
            Inline-edit <i>toggles</i> and <i>dropdowns</i> directly on the node card —
            no need to open the inspector.
          </span>
        </li>
        <li className="bs-tip">
          <span className="bs-tip-badge bs-tip-badge-mcp">MCP</span>
          <span className="bs-tip-text">
            With <b>ck8t-server running</b>, add an MCP server above, drop an <b>MCP Tool</b> block, and use <code>&#123;&#123;input&#125;&#125;</code>
            inside the arguments JSON to pipe upstream output into a tool call.
          </span>
        </li>
      </ul>
    </div>
  )
}

/* ── Provider SVG brand icons ─────────────────────────────────────── */

const GrokProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
  </svg>
)

const MistralProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="gold" />
    <path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00" />
    <path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205" />
    <path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F" />
    <path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500" />
  </svg>
)

const GeminiProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-0" x1="7" x2="11" y1="15.5" y2="12">
        <stop stopColor="#08B962" /><stop offset="1" stopColor="#08B962" stopOpacity="0" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-1" x1="8" x2="11.5" y1="5.5" y2="11">
        <stop stopColor="#F94543" /><stop offset="1" stopColor="#F94543" stopOpacity="0" />
      </linearGradient>
      <linearGradient gradientUnits="userSpaceOnUse" id="ck8t-gem-2" x1="3.5" x2="17.5" y1="13.5" y2="12">
        <stop stopColor="#FABC12" /><stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF" />
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ck8t-gem-0)" />
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ck8t-gem-1)" />
    <path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ck8t-gem-2)" />
  </svg>
)

const DeepSeekProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#f0f4ff" />
    <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE" />
  </svg>
)

const QwenProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#18181b" />
    <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0zM11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" />
  </svg>
)

const OpenAiProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#10a37f" />
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="white" />
  </svg>
)

const LmStudioProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="lms-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7c6af5" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="5.5" fill="url(#lms-bg)" />
    <path fillRule="evenodd" clipRule="evenodd" d="M2.84 2a1.273 1.273 0 100 2.547h14.107a1.273 1.273 0 100-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H22.04a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h14.106a1.274 1.274 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H15.38a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h14.106a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h9.698a1.273 1.273 0 100-2.547h-9.698z" fill="white" fillOpacity=".35" />
    <path fillRule="evenodd" clipRule="evenodd" d="M2.84 2a1.273 1.273 0 100 2.547h10.287a1.274 1.274 0 000-2.547H2.84zM7.935 5.33a1.273 1.273 0 000 2.548H18.22a1.274 1.274 0 000-2.547H7.935zM3.624 9.935c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 010 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM1.273 12.188a1.273 1.273 0 100 2.547H11.56a1.274 1.274 0 000-2.547H1.273zM3.624 16.792c0-.704.57-1.274 1.274-1.274h10.286a1.273 1.273 0 110 2.547H4.898c-.703 0-1.274-.57-1.274-1.273zM13.029 18.849a1.273 1.273 0 100 2.547h5.78a1.273 1.273 0 100-2.547h-5.78z" fill="white" />
  </svg>
)

const CopilotProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="white" />
    <path d="M19.245 5.364c1.322 1.36 1.877 3.216 2.11 5.817.622 0 1.2.135 1.592.654l.73.964c.21.278.323.61.323.955v2.62c0 .339-.173.669-.453.868C20.239 19.602 16.157 21.5 12 21.5c-4.6 0-9.205-2.583-11.547-4.258-.28-.2-.452-.53-.453-.868v-2.62c0-.345.113-.679.321-.956l.73-.963c.392-.517.974-.654 1.593-.654l.029-.297c.25-2.446.81-4.213 2.082-5.52 2.461-2.54 5.71-2.851 7.146-2.864h.198c1.436.013 4.685.323 7.146 2.864zm-7.244 4.328c-.284 0-.613.016-.962.05-.123.447-.305.85-.57 1.108-1.05 1.023-2.316 1.18-2.994 1.18-.638 0-1.306-.13-1.851-.464-.516.165-1.012.403-1.044.996a65.882 65.882 0 00-.063 2.884l-.002.48c-.002.563-.005 1.126-.013 1.69.002.326.204.63.51.765 2.482 1.102 4.83 1.657 6.99 1.657 2.156 0 4.504-.555 6.985-1.657a.854.854 0 00.51-.766c.03-1.682.006-3.372-.076-5.053-.031-.596-.528-.83-1.046-.996-.546.333-1.212.464-1.85.464-.677 0-1.942-.157-2.993-1.18-.266-.258-.447-.661-.57-1.108-.32-.032-.64-.049-.96-.05zm-2.525 4.013c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zm5 0c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zM7.635 5.087c-1.05.102-1.935.438-2.385.906-.975 1.037-.765 3.668-.21 4.224.405.394 1.17.657 1.995.657h.09c.649-.013 1.785-.176 2.73-1.11.435-.41.705-1.433.675-2.47-.03-.834-.27-1.52-.63-1.813-.39-.336-1.275-.482-2.265-.394zm6.465.394c-.36.292-.6.98-.63 1.813-.03 1.037.24 2.06.675 2.47.968.957 2.136 1.104 2.776 1.11h.044c.825 0 1.59-.263 1.995-.657.555-.556.765-3.187-.21-4.224-.45-.468-1.335-.804-2.385-.906-.99-.088-1.875.058-2.265.394zM12 7.615c-.24 0-.525.015-.84.044.03.16.045.336.06.526l-.001.159a2.94 2.94 0 01-.014.25c.225-.022.425-.027.612-.028h.366c.187 0 .387.006.612.028-.015-.146-.015-.277-.015-.409.015-.19.03-.365.06-.526a9.29 9.29 0 00-.84-.044z" fill="#18181b"></path>
  </svg>
)

const AnthropicProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="24" height="24" rx="5.5" fill="#d97706" />
    <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-3.654 0H6.57L0 20h3.603l1.378-3.454h6.875L13.234 20h3.603l-6.664-16.48zm-1.427 9.953 2.094-5.251 2.094 5.251H8.746z" fill="white" />
  </svg>
)

const OllamaProviderIcon = ({ size = 22, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="ollama-provider-icon" {...props}>
    <rect width="24" height="24" rx="5.5" fill="white" />
    <g transform="translate(2 2) scale(0.039)">
      <path fillRule="evenodd" clipRule="evenodd" d="M168.64 23.253c4.608 1.814 8.768 4.8 12.544 8.747 6.293 6.528 11.605 15.872 15.659 26.944 4.074 11.136 6.72 23.467 7.722 35.84a107.824 107.824 0 0143.712-13.568l1.088-.085c18.56-1.494 36.907 1.856 52.907 10.112a103.091 103.091 0 016.336 3.626c1.067-12.138 3.669-24.192 7.68-35.072 4.053-11.093 9.365-20.416 15.637-26.965a35.628 35.628 0 0112.566-8.747c5.482-2.133 11.306-2.517 16.981-.896 8.555 2.432 15.893 7.851 21.675 15.723 5.29 7.19 9.258 16.405 11.968 27.456 4.906 19.925 5.76 46.144 2.453 77.76l1.131.853.554.406c16.15 12.288 27.392 29.802 33.344 50.133 9.28 31.723 4.608 67.307-11.392 87.211l-.384.448.043.064c8.896 16.256 14.293 33.429 15.445 51.2l.043.64c1.365 22.72-4.267 45.589-17.365 68.053l-.15.213.214.512c10.069 24.683 13.226 49.536 9.344 74.368l-.128.832a13.888 13.888 0 01-15.936 11.435 13.83 13.83 0 01-11.31-10.43 13.828 13.828 0 01-.21-5.399c3.562-22.038.213-44.139-10.24-66.624a13.713 13.713 0 01.853-13.163l.085-.128c12.886-19.712 18.219-39.04 17.067-58.027-.981-16.618-6.933-32.938-17.067-48.49a13.737 13.737 0 013.84-18.902l.192-.128c5.184-3.392 9.963-12.053 12.374-23.893a90.218 90.218 0 00-2.027-42.112c-4.373-14.933-12.373-27.392-23.573-35.904-12.694-9.685-29.504-14.357-50.774-13.013a13.93 13.93 0 01-13.482-7.915c-6.699-14.187-16.47-24.341-28.651-30.635a70.145 70.145 0 00-37.803-7.082c-26.56 2.112-49.984 17.088-56.96 35.968a13.91 13.91 0 01-13.013 9.066c-22.763.043-40.384 5.376-53.269 14.998-11.136 8.32-18.731 19.946-22.742 33.877a86.824 86.824 0 00-1.45 40.235c2.389 11.904 7.061 21.76 12.416 27.072l.17.149c4.523 4.416 5.483 11.307 2.326 16.747-7.68 13.269-13.419 33.045-14.358 52.053-1.066 21.717 3.968 40.576 15.339 54.101l.341.406a13.711 13.711 0 012.027 14.72c-12.288 26.368-16.064 48.042-11.989 65.109a13.91 13.91 0 01-27.072 6.357c-5.184-21.717-1.664-46.592 10.09-74.624l.299-.746-.17-.256a92.574 92.574 0 01-12.758-27.926l-.107-.405a122.965 122.965 0 01-3.776-38.08c.939-19.413 5.931-39.296 13.27-55.253l.256-.555-.043-.043c-6.25-8.917-10.88-20.33-13.44-32.96l-.107-.512a114.176 114.176 0 011.984-53.12c5.59-19.52 16.576-36.288 32.768-48.405 1.28-.96 2.624-1.92 3.968-2.816-3.392-31.851-2.538-58.24 2.39-78.293 2.709-11.051 6.698-20.267 11.989-27.456 5.76-7.851 13.099-13.27 21.653-15.723 5.675-1.621 11.52-1.259 17.003.896v.021zm87.808 193.92c19.968 0 38.4 6.678 52.181 18.24 13.44 11.243 21.44 26.347 21.44 41.387 0 18.944-8.661 33.707-24.17 43.136-13.227 8-30.955 11.883-51.264 11.883-21.526 0-39.915-5.526-53.184-15.659-13.163-10.027-20.544-24.107-20.544-39.36 0-15.083 8.49-30.229 22.528-41.515 14.25-11.456 33.066-18.112 53.013-18.112zm0 19.115a65.498 65.498 0 00-40.875 13.867c-9.834 7.893-15.402 17.813-15.402 26.666 0 9.131 4.48 17.686 13.013 24.192 9.707 7.403 23.979 11.691 41.451 11.691 17.045 0 31.424-3.136 41.216-9.088 9.877-5.973 14.933-14.635 14.933-26.816 0-9.024-5.248-18.987-14.571-26.795-10.325-8.64-24.32-13.717-39.765-13.717zm14.123 25.813l.085.086a7.431 7.431 0 01-1.195 10.453l-6.229 4.907v9.514a7.999 7.999 0 01-8.021 7.958 8.004 8.004 0 01-8.022-7.958v-9.813l-5.781-4.651a7.4 7.4 0 01-1.109-10.453 7.53 7.53 0 0110.538-1.088l4.587 3.669 4.693-3.712a7.533 7.533 0 0110.454 1.088zm-107.52-40.938c10.197 0 18.496 8.32 18.496 18.581a18.564 18.564 0 01-18.518 18.581 18.559 18.559 0 01-18.496-18.56 18.565 18.565 0 015.399-13.129 18.609 18.609 0 0113.119-5.473zm185.728 0c10.24 0 18.517 8.32 18.517 18.581a18.559 18.559 0 01-18.517 18.581 18.56 18.56 0 01-18.496-18.56 18.56 18.56 0 0118.496-18.602zM158.72 49.067l-.064.042a14.06 14.06 0 00-6.08 5.078l-.107.128c-2.944 4.032-5.504 9.962-7.424 17.749-3.626 14.763-4.608 34.795-2.645 59.349 9.173-2.73 19.179-4.437 29.952-5.056l.213-.021.406-.725a69.41 69.41 0 013.157-5.099c2.624-16.448.469-36.096-5.397-52.139-2.859-7.765-6.336-13.866-9.664-17.344a13.403 13.403 0 00-2.283-1.92l-.064-.042zm195.712.853l-.043.021a13.396 13.396 0 00-2.282 1.92c-3.328 3.478-6.827 9.6-9.664 17.366-6.187 16.938-8.256 37.888-4.907 54.869l1.237 2.069.171.299h.64a110.599 110.599 0 0131.275 4.523c1.834-23.979.81-43.584-2.731-58.07-1.92-7.786-4.48-13.717-7.445-17.749l-.086-.128a14.054 14.054 0 00-6.08-5.099h-.085v-.021z" fill="#18181b" />
    </g>
  </svg>
)

/* ── Provider brand metadata (key → display info) ─────────────────── */
const PROVIDER_META = {
  openai:    { label: 'OpenAI',         Icon: OpenAiProviderIcon,    color: '#10a37f' },
  lmstudio:  { label: 'LM Studio',      Icon: LmStudioProviderIcon,  color: '#8b5cf6' },
  copilot:   { label: 'GitHub Copilot', Icon: CopilotProviderIcon,   color: '#6e7bf9' },
  anthropic: { label: 'Anthropic',      Icon: AnthropicProviderIcon, color: '#d97706' },
  ollama:    { label: 'Ollama',         Icon: OllamaProviderIcon,    color: '#64748b' },
  grok:      { label: 'Grok',           Icon: GrokProviderIcon,      color: '#a1a1aa' },
  mistral:   { label: 'Mistral',        Icon: MistralProviderIcon,   color: '#FF8205' },
  gemini:    { label: 'Gemini',         Icon: GeminiProviderIcon,    color: '#3186FF' },
  deepseek:  { label: 'DeepSeek',       Icon: DeepSeekProviderIcon,  color: '#4D6BFE' },
  qwen:      { label: 'Qwen',           Icon: QwenProviderIcon,      color: '#9333ea' },
}

/* ── LLM Provider Configuration Panel ────────────────────────────────── */

function LlmConfigPanel({ refreshKey = 0 }) {
  const models = useLlmConfigStore((s) => s.models)
  const consumerConfig = useLlmConfigStore((s) => s.consumerConfig)
  const defaultModel = useLlmConfigStore((s) => s.defaultModel)
  const activeProvider = useLlmConfigStore((s) => s.activeProvider)
  const setConfig = useLlmConfigStore((s) => s.setConfig)
  const applyDefaultModelToAll = useWorkspaceStore((s) => s.applyDefaultModelToAll)
  const syncToServer = useWorkspaceStore((s) => s.syncToServer)
  const reset = useWorkspaceStore((s) => s.reset)

  const [selectedProvider, setSelectedProvider] = useState(null)
  const [pending, setPending] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [serverMode, setServerMode] = useState(null) // null = probing, true = server, false = browser

  // Derive providers from both model entries and raw config keys.
  // This keeps providers visible even when their model list is currently empty.
  const providers = useMemo(() => {
    const seen = new Set()
    const list = []

    const reserved = new Set(['provider', 'temperature', 'maxTokens', 'timeout', 'defaults', 'source'])
    if (consumerConfig && typeof consumerConfig === 'object') {
      for (const [key, value] of Object.entries(consumerConfig)) {
        if (reserved.has(key)) continue
        if (!value || typeof value !== 'object') continue
        const looksLikeProvider = (
          value.model ||
          Array.isArray(value.models) ||
          value.type ||
          value.baseUrl || value['base-url'] ||
          value.chatUrl || value['chat-url']
        )
        if (!looksLikeProvider) continue
        if (seen.has(key)) continue
        seen.add(key)
        list.push({ key, label: value.group || value.label || key, providerType: value.type || undefined })
      }
    }

    for (const m of models) {
      const pk = m.provider || 'unknown'
      if (seen.has(pk)) continue
      seen.add(pk)
      list.push({ key: pk, label: m.group || pk, providerType: m.providerType })
    }
    return list
  }, [models, consumerConfig])

  // Sync selected provider when store loads
  useEffect(() => {
    if (activeProvider && !selectedProvider) setSelectedProvider(activeProvider)
    else if (!selectedProvider && providers.length > 0) setSelectedProvider(providers[0].key)
  }, [activeProvider, providers, selectedProvider])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const up = await detectServer()
      setServerMode(up)
      const config = await fetchAvailableProviders()
      setConfig(config)
    } catch (e) {
      setLoadError(e.message || 'Failed to load provider configuration')
    } finally {
      setLoading(false)
    }
  }, [setConfig])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  // Build provider options for StyledSelect (icon + label + active badge)
  const providerOptions = useMemo(() => providers.map((p) => {
    // Custom providers have a type (lmstudio, openai, etc.) — look up icon by type first,
    // then fall back to the key itself for built-in providers (copilot, etc.)
    const meta = PROVIDER_META[p.providerType || p.key] || PROVIDER_META[p.key] || {}
    const Icon = meta.Icon || null
    return {
      id: p.key,
      label: p.label,
      icon: Icon ? <Icon size={15} /> : null,
      badge: p.key === activeProvider
        ? <span className="bs-llm-provider-active-dot" style={{ display: 'block' }} />
        : null,
    }
  }), [providers, activeProvider])

  // Models visible in the current provider tab
  const providerModels = useMemo(
    () => models.filter((m) => m.provider === selectedProvider),
    [models, selectedProvider]
  )

  const hasChanges = useMemo(() => {
    if (selectedProvider && selectedProvider !== activeProvider) return true
    if (pending && pending !== defaultModel) return true
    return false
  }, [selectedProvider, activeProvider, pending, defaultModel])

  const saveDefault = useCallback(async () => {
    if (!hasChanges) return
    setSaving(true)
    setLoadError('')
    try {
      const modelToSave = pending || providerModels[0]?.id || null
      await changeRuntimeProvider({ provider: selectedProvider, family: modelToSave, model: modelToSave })
      await refresh()
      setPending(null)
    } catch (e) {
      setLoadError(e.message || 'Failed to save default model')
    } finally {
      setSaving(false)
    }
  }, [hasChanges, pending, providerModels, selectedProvider, refresh])

  const applyToAll = useCallback(async () => {
    const target = defaultModel
    if (!target) return
    setApplying(true)
    setApplyResult(null)
    try {
      const count = applyDefaultModelToAll(target, selectedProvider)
      await syncToServer()
      setApplyResult({ count })
      setTimeout(() => setApplyResult(null), 4000)
    } catch (e) {
      setLoadError(e.message || 'Failed to apply model to all nodes')
    } finally {
      setApplying(false)
    }
  }, [defaultModel, applyDefaultModelToAll, syncToServer])

  const doReset = useCallback(() => {
    try { localStorage.removeItem('ck8t/workspace') } catch { /* sandboxed */ }
    reset()
    if (defaultModel) applyDefaultModelToAll(defaultModel)
    useWorkflowStore.getState().reset()
    setConfirmReset(false)
  }, [reset, defaultModel, applyDefaultModelToAll])

  return (
    <div className="bs-llm-config">
      <div className="bs-settings-section-head">
        <LlmIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">LLM Provider Configuration</h3>
      </div>

      {loading && (
        <div className="bs-llm-config-loading">
          {serverMode === null ? 'Checking server…' : 'Loading provider configuration…'}
        </div>
      )}

      {!loading && loadError && (
        <div className="bs-llm-config-error">{loadError}</div>
      )}

      {!loading && serverMode === false && (
        <div className="bs-llm-server-info">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#60a5fa' }}>
            <circle cx="8" cy="8" r="6.5" />
            <line x1="8" y1="5" x2="8" y2="5.5" strokeWidth="2.2" />
            <line x1="8" y1="7.5" x2="8" y2="11.5" />
          </svg>
          <span>
            <strong>Browser mode</strong> — ck8t-server is not running.
            Add a custom provider below to make direct browser LLM calls.
            API keys are encrypted in localStorage and never sent to any backend.
          </span>
        </div>
      )}

      {!loading && !loadError && serverMode !== false && models.length === 0 && (
        <div className="bs-llm-config-error">
          No model provider found. Ensure the backend is running and{' '}
          <code>/ck8t/llm/providers</code> returns at least one model.
        </div>
      )}

      {!loading && providers.length > 0 && (
        <div className="bs-llm-config-status">

          {/* ── Available Providers dropdown ── */}
          <div className="bs-llm-config-status-row">
            <span className="bs-llm-status-label">Available Providers</span>
            <StyledSelect
              value={selectedProvider || ''}
              options={providerOptions}
              onChange={(id) => { setSelectedProvider(id); setPending(null) }}
              placeholder="Select provider…"
              className="bs-llm-provider-select"
              iconSize={15}
              menuMinWidth={200}
            />
          </div>

          {/* ── Default Model badge ── */}
          <div className="bs-llm-config-status-row">
            <span className="bs-llm-status-label">Default Model</span>
            <span className="bs-llm-status-badge bs-llm-status-model">
              {pending && pending !== defaultModel ? pending : (defaultModel || '—')}
            </span>
          </div>

          {/* ── Model chips for selected provider ── */}
          <div className="bs-llm-config-status-row bs-llm-models-row">
            <span className="bs-llm-status-label">
              Available Models
              {providerModels.length > 0 && (
                <span className="bs-llm-models-count">{providerModels.length}</span>
              )}
            </span>
            <div className="bs-llm-model-chips">
              {providerModels.length === 0 ? (
                <span className="bs-llm-no-models">No models available for this provider.</span>
              ) : (
                providerModels.map((m) => {
                  const isSaved = m.id === defaultModel
                  const isPending = m.id === pending && pending !== defaultModel
                  return (
                    <span
                      key={m.id}
                          className={`bs-llm-model-chip bs-llm-model-chip-btn${isSaved ? ' bs-llm-model-chip-active' : ''}${isPending ? ' bs-llm-model-chip-pending' : ''}`}
                          title={`${m.group} — ${m.id}`}
                          onClick={() => setPending(isSaved ? null : m.id)}
                        >
                          {m.label}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ── Save / cancel actions ── */}
              {hasChanges && (
                <div className="bs-llm-config-actions">
                  <button
                    className="bs-btn-sm bs-btn-success"
                    onClick={saveDefault}
                    disabled={saving}
                  >
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3.5 8.5 6.5 11.5 12.5 4.5"/></svg>
                    {saving ? 'Saving…' : 'Save as Default'}
                  </button>
                  <button
                    className="bs-btn-sm bs-btn-secondary"
                    onClick={() => { setSelectedProvider(activeProvider); setPending(null) }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}

          {/* ── Apply to all ── */}
          <div className="bs-llm-apply-row">
            <button
              className="bs-btn-sm bs-btn-apply-all"
              onClick={applyToAll}
              disabled={applying || !defaultModel}
              title={`Set model = "${defaultModel}" on every agent / AI node in every workflow`}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8h12M8 2l6 6-6 6"/>
              </svg>
              {applying ? 'Applying…' : `Apply "${defaultModel || '—'}" to all nodes`}
            </button>
            {applyResult && (
              <span className="bs-llm-apply-result">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 8.5 6 11.5 13 4.5"/></svg>
                Updated {applyResult.count} node{applyResult.count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Reset workspace ── */}
          <div className="bs-llm-reset-row">
            {!confirmReset ? (
              <button
                className="bs-btn-sm bs-btn-reset-workspace"
                onClick={() => setConfirmReset(true)}
                title="Clears all saved workflows and reloads from the built-in seed"
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1.5 4 4 1.5 6.5 4"/><path d="M4 1.5v7a5 5 0 0 0 10 0V7"/>
                </svg>
                Reset workspace to defaults
              </button>
            ) : (
              <div className="bs-reset-confirm">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2L14.5 13H1.5Z"/><line x1="8" y1="6.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r=".6" fill="#f87171"/>
                </svg>
                <span className="bs-reset-confirm-text">
                  Resets all workflows to the seed demo and sets every node's model to <strong>{defaultModel || 'the current default'}</strong>. Custom workflows will be lost.
                </span>
                <button className="bs-btn-sm bs-btn-danger" onClick={doReset}>Yes, reset</button>
                <button className="bs-btn-sm bs-btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

/* ── Custom Provider Panel (extension-only) ──────────────────────── */

const PROVIDER_TYPE_OPTIONS = [
  { id: 'openai',    label: 'OpenAI',    icon: <OpenAiProviderIcon size={15} /> },
  { id: 'anthropic', label: 'Anthropic', icon: <AnthropicProviderIcon size={15} /> },
  { id: 'gemini',    label: 'Gemini',    icon: <GeminiProviderIcon size={15} /> },
  { id: 'grok',      label: 'Grok',      icon: <GrokProviderIcon size={15} /> },
  { id: 'mistral',   label: 'Mistral',   icon: <MistralProviderIcon size={15} /> },
  { id: 'deepseek',  label: 'DeepSeek',  icon: <DeepSeekProviderIcon size={15} /> },
  { id: 'qwen',      label: 'Qwen',      icon: <QwenProviderIcon size={15} /> },
  { id: 'lmstudio',  label: 'LM Studio', icon: <LmStudioProviderIcon size={15} /> },
  { id: 'ollama',    label: 'Ollama',    icon: <OllamaProviderIcon size={15} /> },
]

const PROVIDER_PLACEHOLDERS = {
  openai: {
    name:      'My OpenAI Provider',
    chatUrl:   'https://api.openai.com/v1/chat/completions',
    modelsUrl: 'https://api.openai.com/v1/models',
    apiKey:    'sk-...',
  },
  anthropic: {
    name:      'My Anthropic Provider',
    chatUrl:   'https://api.anthropic.com/v1/messages',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    apiKey:    'sk-ant-...',
  },
  gemini: {
    name:      'My Gemini Provider',
    chatUrl:   'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    apiKey:    'AIza...',
  },
  grok: {
    name:      'My Grok Provider',
    chatUrl:   'https://api.x.ai/v1/chat/completions',
    modelsUrl: 'https://api.x.ai/v1/models',
    apiKey:    'xai-...',
  },
  mistral: {
    name:      'My Mistral Provider',
    chatUrl:   'https://api.mistral.ai/v1/chat/completions',
    modelsUrl: 'https://api.mistral.ai/v1/models',
    apiKey:    'sk-...',
  },
  deepseek: {
    name:      'My DeepSeek Provider',
    chatUrl:   'https://api.deepseek.com/v1/chat/completions',
    modelsUrl: 'https://api.deepseek.com/v1/models',
    apiKey:    'sk-...',
  },
  qwen: {
    name:      'My Qwen Provider',
    chatUrl:   'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    modelsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    apiKey:    'sk-...',
  },
  lmstudio: {
    name:      'My LM Studio Server',
    chatUrl:   'http://<your-host>/v1/chat/completions',
    modelsUrl: 'http://<your-host>/v1/models',
    apiKey:    'leave blank if not set',
  },
  ollama: {
    name:      'My Ollama Server',
    chatUrl:   'http://<your-host>/api/chat',
    modelsUrl: 'http://<your-host>/api/tags',
    apiKey:    'leave blank for local Ollama',
  },
}

const HOST_PATHS = {
  openai:    { chat: '/v1/chat/completions',                    models: '/v1/models' },
  anthropic: { chat: '/v1/messages',                            models: '/v1/models' },
  gemini:    { chat: '/v1beta/openai/chat/completions',         models: '/v1beta/openai/models' },
  grok:      { chat: '/v1/chat/completions',                    models: '/v1/models' },
  mistral:   { chat: '/v1/chat/completions',                    models: '/v1/models' },
  deepseek:  { chat: '/v1/chat/completions',                    models: '/v1/models' },
  qwen:      { chat: '/compatible-mode/v1/chat/completions',    models: '/compatible-mode/v1/models' },
  lmstudio:  { chat: '/v1/chat/completions',                    models: '/v1/models' },
  ollama:    { chat: '/api/chat',                               models: '/api/tags' },
}

function deriveUrlsFromHost(host, type) {
  const h = (host || '').replace(/\/$/, '')
  if (!h) return {}
  const paths = HOST_PATHS[type] || HOST_PATHS.openai
  return { chatUrl: h + paths.chat, modelsUrl: h + paths.models }
}

function extractHostFromUrl(url, type) {
  if (!url) return ''
  const paths = HOST_PATHS[type] || HOST_PATHS.openai
  for (const p of Object.values(paths)) {
    if (url.endsWith(p)) return url.slice(0, -p.length)
  }
  try { return new URL(url).origin } catch { return '' }
}

const PROVIDER_DEFAULT_HOSTS = {
  openai:    'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  gemini:    'https://generativelanguage.googleapis.com',
  grok:      'https://api.x.ai',
  mistral:   'https://api.mistral.ai',
  deepseek:  'https://api.deepseek.com',
  qwen:      'https://dashscope.aliyuncs.com',
  lmstudio:  'http://127.0.0.1:1234',
  ollama:    'http://localhost:11434',
}

function defaultsForType(type) {
  const host = PROVIDER_DEFAULT_HOSTS[type] || ''
  const derived = deriveUrlsFromHost(host, type)
  return { host, chatUrl: derived.chatUrl || '', modelsUrl: derived.modelsUrl || '' }
}

const BLANK_FORM = { name: '', type: 'openai', host: '', chatUrl: '', modelsUrl: '', apiKey: '', headers: '' }

function CustomProviderPanel({ onChanged } = {}) {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(BLANK_FORM)
  const [formError, setFormError] = useState('')
  const [refreshingKey, setRefreshingKey] = useState(null)
  const [deletingKey, setDeletingKey] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [serverMode, setServerMode] = useState(null) // null = probing

  // Subscribe to browser store so list stays in sync in browser mode
  const browserProviders = useBrowserProvidersStore((s) => s.providers)

  const openAdd = useCallback(() => {
    setEditingKey(null)
    setForm({ ...BLANK_FORM, ...defaultsForType('openai') })
    setFormError('')
    setShowForm(true)
  }, [])

  const openEdit = useCallback((p) => {
    setEditingKey(p.key)
    const type = p.type || 'openai'
    setForm({
      name: p.name,
      type,
      host: extractHostFromUrl(p.chatUrl || '', type),
      chatUrl: p.chatUrl || '',
      modelsUrl: p.modelsUrl || '',
      apiKey: '',
      headers: p.headers && Object.keys(p.headers).length ? JSON.stringify(p.headers, null, 2) : '',
    })
    setFormError('')
    setShowForm(true)
  }, [])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingKey(null)
    setForm(BLANK_FORM)
    setFormError('')
  }, [])

  const loadProviders = useCallback(async () => {
    try {
      const up = await detectServer()
      setServerMode(up)
      const data = await fetchCustomProviders()
      setProviders(data)
    } catch (e) {
      setError(e.message || 'Failed to load custom providers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

  // Keep local list in sync with the browser store (browser mode only)
  useEffect(() => {
    if (serverMode === false) setProviders(browserProviders)
  }, [browserProviders, serverMode])

  const handleSave = async () => {
    setFormError('')
    if (!form.name.trim()) return setFormError('Provider name is required')
    if (!form.chatUrl.trim()) return setFormError('Chat URL is required')
    if (!form.modelsUrl.trim()) return setFormError('Models URL is required')

    let parsedHeaders = {}
    if (form.headers.trim()) {
      try { parsedHeaders = JSON.parse(form.headers) } catch {
        return setFormError('Additional headers must be valid JSON')
      }
    }

    setSaving(true)
    try {
      await saveCustomProvider({
        ...(editingKey ? { key: editingKey } : {}),
        name: form.name.trim(),
        type: form.type,
        chatUrl: form.chatUrl.trim(),
        modelsUrl: form.modelsUrl.trim(),
        apiKey: form.apiKey.trim() || undefined,
        headers: parsedHeaders,
      })
      setForm(BLANK_FORM)
      setEditingKey(null)
      setShowForm(false)
      // For web mode: models were already auto-fetched inside saveCustomProvider.
      // For extension: trigger a refresh so newly added models appear immediately.
      const savedKey = editingKey || form.name.trim().toLowerCase().replace(/\s+/g, '_')
      try { await refreshCustomProviderModels(savedKey) } catch { /* ignore */ }
      await loadProviders()
      onChanged?.()
    } catch (e) {
      setFormError(e.message || 'Failed to save provider')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (key) => {
    setDeletingKey(key)
    try {
      await deleteCustomProvider(key)
      setProviders((prev) => prev.filter((p) => p.key !== key))
      onChanged?.()
    } catch (e) {
      setError(e.message || 'Failed to delete provider')
    } finally {
      setDeletingKey(null)
    }
  }

  const handleRefreshModels = async (key) => {
    setRefreshingKey(key)
    try {
      const models = await refreshCustomProviderModels(key)
      setProviders((prev) => prev.map((p) => p.key === key ? { ...p, cachedModels: models } : p))
      onChanged?.()
    } catch (e) {
      setError(e.message || 'Failed to refresh models')
    } finally {
      setRefreshingKey(null)
    }
  }

  return (
    <div className="bs-settings-pane bs-custom-provider-pane">
      <div className="bs-settings-section-head">
        <LlmIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">Custom LLM Providers</h3>
        {serverMode !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
            padding: '2px 8px', borderRadius: 6,
            background: serverMode ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.12)',
            color: serverMode ? '#22c55e' : '#60a5fa',
            border: `1px solid ${serverMode ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.3)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {serverMode ? 'Server' : 'Browser'}
          </span>
        )}
        <button
          className="bs-btn-sm bs-btn-secondary bs-custom-provider-add-btn"
          onClick={showForm ? handleCancel : openAdd}
        >
          {showForm ? '✕ Cancel' : '+ Add Provider'}
        </button>
      </div>

      {error && <div className="bs-llm-config-error">{error}</div>}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bs-custom-provider-form">
          <div className="bs-custom-provider-form-title">
            {editingKey ? 'Edit Provider' : 'Add New Provider'}
          </div>
          <div className="bs-custom-provider-form-grid">
            <label className="bs-custom-provider-label">
              Provider Name
              <input
                className="bs-custom-provider-input"
                placeholder={PROVIDER_PLACEHOLDERS[form.type]?.name || 'My Provider'}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="bs-custom-provider-label">
              Type
              <StyledSelect
                value={form.type}
                options={PROVIDER_TYPE_OPTIONS}
                onChange={(id) => setForm((f) => {
                  const oldD = defaultsForType(f.type)
                  const newD = defaultsForType(id)
                  // Only replace a field if it's empty or still sitting at the old type's default
                  // (i.e. user hasn't manually customised it). If the user cleared it, keep it cleared.
                  const wasDefault = (val, def) => !val || val === def
                  return {
                    ...f,
                    type:      id,
                    host:      wasDefault(f.host,      oldD.host)      ? newD.host      : f.host,
                    chatUrl:   wasDefault(f.chatUrl,   oldD.chatUrl)   ? newD.chatUrl   : f.chatUrl,
                    modelsUrl: wasDefault(f.modelsUrl, oldD.modelsUrl) ? newD.modelsUrl : f.modelsUrl,
                  }
                })}
              />
            </label>
            <label className="bs-custom-provider-label bs-span2">
              Host
              <input
                className="bs-custom-provider-input"
                placeholder={
                  form.type === 'ollama'    ? 'http://localhost:11434' :
                  form.type === 'lmstudio'  ? 'http://127.0.0.1:1234' :
                  form.type === 'gemini'    ? 'https://generativelanguage.googleapis.com' :
                  form.type === 'grok'      ? 'https://api.x.ai' :
                  form.type === 'mistral'   ? 'https://api.mistral.ai' :
                  form.type === 'deepseek'  ? 'https://api.deepseek.com' :
                  form.type === 'qwen'      ? 'https://dashscope.aliyuncs.com' :
                  form.type === 'anthropic' ? 'https://api.anthropic.com' :
                  'https://api.openai.com'
                }
                value={form.host}
                onChange={(e) => {
                  const host = e.target.value
                  setForm((f) => ({ ...f, host, ...deriveUrlsFromHost(host, f.type) }))
                }}
              />
            </label>
            <label className="bs-custom-provider-label bs-span2">
              Chat URL
              <input
                className="bs-custom-provider-input"
                placeholder={PROVIDER_PLACEHOLDERS[form.type]?.chatUrl}
                value={form.chatUrl}
                onChange={(e) => setForm((f) => ({ ...f, chatUrl: e.target.value }))}
              />
            </label>
            <label className="bs-custom-provider-label bs-span2">
              Models URL
              <input
                className="bs-custom-provider-input"
                placeholder={PROVIDER_PLACEHOLDERS[form.type]?.modelsUrl}
                value={form.modelsUrl}
                onChange={(e) => setForm((f) => ({ ...f, modelsUrl: e.target.value }))}
              />
            </label>
            <label className="bs-custom-provider-label bs-span2">
              API Key
              <input
                className="bs-custom-provider-input"
                type="password"
                placeholder={editingKey ? 'Leave blank to keep existing key' : PROVIDER_PLACEHOLDERS[form.type]?.apiKey}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="bs-custom-provider-label bs-span2">
              Additional Headers <span className="bs-optional-hint">(JSON, optional)</span>
              <textarea
                className="bs-custom-provider-textarea"
                placeholder='{ "X-Custom-Header": "value" }'
                rows={2}
                value={form.headers}
                onChange={(e) => setForm((f) => ({ ...f, headers: e.target.value }))}
              />
            </label>
          </div>
          {formError && <div className="bs-custom-provider-form-error">{formError}</div>}
          <div className="bs-custom-provider-form-actions">
            <button className="bs-btn-sm bs-btn-success" onClick={handleSave} disabled={saving}>
              {saving ? (editingKey ? 'Updating…' : 'Saving…') : (editingKey ? 'Update Provider' : 'Save Provider')}
            </button>
          </div>
        </div>
      )}

      {/* Provider list */}
      {loading ? (
        <div className="bs-llm-config-loading">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="bs-custom-provider-empty">No custom providers added yet.</div>
      ) : (
        <ul className="bs-custom-provider-list">
          {providers.map((p) => (
            <li key={p.key} className="bs-custom-provider-item">
              <div className="bs-custom-provider-item-info">
                <span className="bs-custom-provider-name">{p.name}</span>
                <span className="bs-custom-provider-type-badge">
                  {PROVIDER_TYPE_OPTIONS.find((o) => o.id === p.type)?.label ?? p.type}
                </span>
                <span className="bs-custom-provider-model-count">
                  {(p.cachedModels || []).length} model{(p.cachedModels || []).length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="bs-custom-provider-item-actions">
                <button
                  className="bs-btn-sm bs-btn-secondary"
                  onClick={() => handleRefreshModels(p.key)}
                  disabled={refreshingKey === p.key}
                  title="Fetch latest model list from provider"
                >
                  {refreshingKey === p.key ? 'Refreshing…' : '↻ Refresh Models'}
                </button>
                <button
                  className="bs-btn-sm bs-btn-secondary"
                  onClick={() => openEdit(p)}
                  disabled={!!refreshingKey || !!deletingKey}
                  title="Edit provider settings"
                >
                  ✎ Edit
                </button>
                <button
                  className="bs-btn-sm bs-btn-secondary bs-btn-secondary--danger"
                  onClick={() => handleDelete(p.key)}
                  disabled={deletingKey === p.key}
                >
                  {deletingKey === p.key ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KeyCombo({ keys }) {
  return (
    <span className="bs-kbd-combo">
      {keys.map((k, i) => (
        <span key={i} className="bs-kbd-part">
          {k === '+' || k === 'or' ? <span className="bs-kbd-plus">{k}</span> : <kbd className="bs-kbd">{k}</kbd>}
        </span>
      ))}
    </span>
  )
}

function ShortcutDescription({ item }) {
  if (!item.icon) return item.desc
  const Icon = item.icon
  return (
    <span className="bs-kbd-action-desc">
      <span className={`bs-kbd-action-icon is-${item.tone || 'default'}`}>
        <Icon className="bs-kbd-action-svg" />
      </span>
      <span>{item.desc}</span>
    </span>
  )
}

/* ── App Config Panel (extension-only) ──────────────────────────────── */
function AppConfigPanel() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [auditMax, setAuditMax] = useState('')
  const [auditSaving, setAuditSaving] = useState(false)
  const [auditSaved, setAuditSaved] = useState(false)

  const autoSaveInterval = useUiStateStore((s) => s.autoSaveInterval)
  const setPanelState = useUiStateStore((s) => s.setPanelState)
  const [autoSaveInput, setAutoSaveInput] = useState(String(autoSaveInterval))
  const [autoSaveSaved, setAutoSaveSaved] = useState(false)

  const BASE = (
    (typeof globalThis !== 'undefined' && globalThis.__CK8T_BRIDGE_BASE__) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVENGINE_BASE) ||
    ''
  ).replace(/\/$/, '')

  useEffect(() => {
    fetch(`${BASE}/ck8t/app-config`)
      .then(r => r.json())
      .then(d => { setConfig(d); setAuditMax(String(d.auditMaxEntries ?? 200)); setLoading(false) })
      .catch(e => { setError(e.message || 'Failed to load app config'); setLoading(false) })
  }, [BASE])

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const saveAutoSaveInterval = () => {
    const n = parseInt(autoSaveInput, 10)
    if (!n || n < 200) return
    setPanelState({ autoSaveInterval: n })
    setAutoSaveSaved(true)
    setTimeout(() => setAutoSaveSaved(false), 2000)
  }

  const saveAuditMax = async () => {
    const n = parseInt(auditMax, 10)
    if (!n || n < 10) return
    setAuditSaving(true)
    try {
      await fetch(`${BASE}/ck8t/app-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditMaxEntries: n }),
      })
      setConfig((c) => ({ ...c, auditMaxEntries: n }))
      setAuditSaved(true)
      setTimeout(() => setAuditSaved(false), 2000)
    } catch {}
    setAuditSaving(false)
  }

  return (
    <div className="bs-settings-pane">
      <div className="bs-settings-section-head">
        <AppConfigIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">App Config</h3>
        <span className="bs-appconfig-mode-badge">VS Code Extension</span>
      </div>

      {loading && <div className="bs-llm-config-loading">Loading…</div>}
      {!loading && error && <div className="bs-llm-config-error">{error}</div>}

      {!loading && !error && config && (
        <div className="bs-appconfig-cards">
          <div className="bs-appconfig-card">
            <div className="bs-appconfig-card-icon">
              <DatabaseIcon />
            </div>
            <div className="bs-appconfig-card-body">
              <div className="bs-appconfig-card-label">SQLite Database</div>
              <div className="bs-appconfig-path-row">
                <code className="bs-appconfig-path" title={config.dbPath}>{config.dbPath}</code>
                <button
                  className={`bs-appconfig-copy-btn${copied === 'db' ? ' is-copied' : ''}`}
                  title="Copy path"
                  onClick={() => copy(config.dbPath, 'db')}
                >
                  {copied === 'db' ? <CheckPathIcon /> : <CopyPathIcon />}
                </button>
              </div>
              <div className="bs-appconfig-card-hint">
                Stores workspaces, MCP server configs, audit log, and deployments.
              </div>
            </div>
          </div>

          <div className="bs-appconfig-card">
            <div className="bs-appconfig-card-icon">
              <FolderOpenIcon />
            </div>
            <div className="bs-appconfig-card-body">
              <div className="bs-appconfig-card-label">Storage Directory</div>
              <div className="bs-appconfig-path-row">
                <code className="bs-appconfig-path" title={config.storagePath}>{config.storagePath}</code>
                <button
                  className={`bs-appconfig-copy-btn${copied === 'dir' ? ' is-copied' : ''}`}
                  title="Copy path"
                  onClick={() => copy(config.storagePath, 'dir')}
                >
                  {copied === 'dir' ? <CheckPathIcon /> : <CopyPathIcon />}
                </button>
              </div>
              <div className="bs-appconfig-card-hint">
                VS Code global storage directory for this extension.
              </div>
            </div>
          </div>

          {/* Audit max entries */}
          <div className="bs-appconfig-card">
            <div className="bs-appconfig-card-icon">
              <AuditIcon style={{ width: 20, height: 20 }} />
            </div>
            <div className="bs-appconfig-card-body">
              <div className="bs-appconfig-card-label">AI Audit Max Entries</div>
              <div className="bs-appconfig-path-row" style={{ gap: 8 }}>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="50"
                  className="bs-custom-provider-input"
                  style={{ width: 100 }}
                  value={auditMax}
                  onChange={(e) => setAuditMax(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveAuditMax()}
                />
                <button
                  className="bs-btn-sm bs-btn-success"
                  onClick={saveAuditMax}
                  disabled={auditSaving}
                >
                  {auditSaved ? 'Saved!' : auditSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div className="bs-appconfig-card-hint">
                Maximum LLM audit entries to keep in SQLite (10–5000). Oldest entries are dropped when the limit is reached.
              </div>
            </div>
          </div>

          {/* Auto Save Interval */}
          <div className="bs-appconfig-card">
            <div className="bs-appconfig-card-icon">
              <SaveShortcutIcon style={{ width: 20, height: 20, opacity: 0.8 }} />
            </div>
            <div className="bs-appconfig-card-body">
              <div className="bs-appconfig-card-label">Auto Save Interval</div>
              <div className="bs-appconfig-path-row" style={{ gap: 8 }}>
                <input
                  type="number"
                  min="200"
                  max="10000"
                  step="100"
                  className="bs-custom-provider-input"
                  style={{ width: 100 }}
                  value={autoSaveInput}
                  onChange={(e) => setAutoSaveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveAutoSaveInterval()}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary, #94a3b8)' }}>ms</span>
                <button
                  className="bs-btn-sm bs-btn-success"
                  onClick={saveAutoSaveInterval}
                >
                  {autoSaveSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
              <div className="bs-appconfig-card-hint">
                Debounce delay before canvas changes are auto-saved (200–10000ms). Default 1000ms.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── AI Audit Section ─────────────────────────────────────────────────── */

const AUDIT_DETAIL_TABS = ['System Prompt', 'User Prompt', 'Request', 'Response', 'Full Entry']

// Stage → color mapping for AI audit badges
function stageColor(stage) {
  if (!stage) return '#818cf8'
  const s = stage.toLowerCase()
  if (s.includes('agent')) return '#818cf8'
  if (s.includes('llm'))   return '#a78bfa'
  if (s.includes('skill')) return '#34d399'
  return '#818cf8'
}

function AuditEntryDetail({ entry, onBack }) {
  const [detailTab, setDetailTab] = useState('System Prompt')
  const [copied, setCopied] = useState(false)

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(safeJsonStr(entry))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
      .catch(() => {})
  }, [entry])

  function renderContent() {
    switch (detailTab) {
      case 'System Prompt': return <AuditPre value={entry.systemPrompt || '(none)'} />
      case 'User Prompt':   return <AuditPre value={entry.userPrompt   || '(none)'} />
      case 'Request':       return <AuditPre value={safeJsonStr(entry.request)} isJson />
      case 'Response':      return <AuditPre value={safeJsonStr(entry.response)} isJson />
      case 'Full Entry':    return <AuditPre value={safeJsonStr(entry)} isJson />
      default: return null
    }
  }

  const color = stageColor(entry.stage)
  const hasError = !!entry.error

  return (
    <div className="bs-audit2-detail-panel">
      {/* Header */}
      <div className="bs-audit2-detail-header">
        <button className="bs-audit2-back-btn" onClick={onBack}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span className="bs-audit2-stage-badge" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
          {entry.stage?.replace('ck8t.', '')}
        </span>
        <span className="bs-audit2-model-text">{entry.model || '—'}</span>
        <span className="bs-audit2-ms-text" style={{ color: '#f59e0b' }}>{entry.durationMs != null ? `${entry.durationMs}ms` : '—'}</span>
        <span className="bs-audit2-ts-text">{new Date(entry.timestamp).toLocaleTimeString()}</span>
        <button className={`bs-audit2-copy-btn ${copied ? 'is-copied' : ''}`} onClick={copyAll}>
          {copied
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
          {copied ? 'Copied!' : 'Copy All'}
        </button>
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="bs-audit2-error-banner">{entry.error}</div>
      )}

      {/* Tab bar */}
      <div className="bs-audit2-tab-bar">
        {AUDIT_DETAIL_TABS.map(t => (
          <button key={t} className={`bs-audit2-tab ${detailTab === t ? 'is-active' : ''}`}
            style={detailTab === t ? { color, borderBottomColor: color } : {}}
            onClick={() => setDetailTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bs-audit2-detail-body">
        {renderContent()}
      </div>
    </div>
  )
}

function AuditPre({ value, isJson }) {
  const code = isJson ? value : value
  if (isJson) {
    return (
      <Highlight code={code} language="json" theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className="bs-audit2-pre bs-audit2-pre-hl" style={{ ...style, background: 'transparent' }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    )
  }
  return <pre className="bs-audit2-pre">{value}</pre>
}

function AiAuditSection() {
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)
  const base = typeof window !== 'undefined' ? (window.__CK8T_BRIDGE_BASE__ || '') : ''

  const load = useCallback(async () => {
    if (!base) return
    setLoading(true)
    try {
      const r = await fetch(`${base}/ck8t/audit`)
      if (r.ok) {
        const data = await r.json()
        setEntries(data.entries || [])
        setStats(data.stats || null)
      }
    } catch {}
    finally { setLoading(false) }
  }, [base])

  const clear = useCallback(async () => {
    if (!base) return
    try {
      await fetch(`${base}/ck8t/audit`, { method: 'DELETE' })
      setEntries([]); setStats(null); setSelected(null); setClearConfirm(false)
    } catch {}
  }, [base])

  useEffect(() => { load() }, [load])

  const filtered = filter
    ? entries.filter((e) => [e.model, e.stage, e.error, e.systemPrompt, e.userPrompt].join(' ').toLowerCase().includes(filter.toLowerCase()))
    : entries

  if (selected) {
    return (
      <div className="bs-settings-pane" style={{ padding: 0 }}>
        <AuditEntryDetail entry={selected} onBack={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className="bs-settings-pane bs-audit-pane">
      {/* Section head */}
      <div className="bs-settings-section-head">
        <AuditIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">AI Audit</h3>
        {stats && (
          <span className="bs-audit2-count-chip">{stats.total} calls</span>
        )}
        {stats?.errors > 0 && (
          <span className="bs-audit2-count-chip" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>{stats.errors} errors</span>
        )}
      </div>
      <p className="bs-settings-sub">Every LLM call through the bridge is recorded here. Data is session-scoped — cleared when the extension restarts.</p>

      {/* Toolbar */}
      <div className="bs-audit2-toolbar">
        <SearchInputView
          value={filter}
          onChange={setFilter}
          placeholder="Filter by model, stage, prompt…"
          prefix={<SearchIcon width={13} height={13} />}
          style={{ minWidth: 280, flex: 1, maxWidth: 440 }}
        />
        <button className="bs-audit2-btn" onClick={load} disabled={loading}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {entries.length > 0 && (
          <button className="bs-audit2-btn is-danger" onClick={() => setClearConfirm(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            Clear All
          </button>
        )}
      </div>

      {!base && <div className="bs-audit-empty">AI Audit is only available in the VS Code extension.</div>}
      {base && filtered.length === 0 && !loading && (
        <div className="bs-audit-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ opacity: 0.3, marginBottom: 8 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          <div>No LLM calls recorded yet.</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Run a workflow with an Agent block to start auditing.</div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bs-audit2-table-wrap">
          <table className="bs-audit2-table">
            <thead>
              <tr>
                {['Stage', 'Model', 'Duration', 'Status', 'Time', ''].map(h => (
                  <th key={h} className="bs-audit2-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const color = stageColor(e.stage)
                const hasError = !!e.error
                return (
                  <tr key={e.id || i} className="bs-audit2-tr" onClick={() => setSelected(e)}>
                    <td className="bs-audit2-td">
                      <span className="bs-audit2-stage-badge" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)` }}>
                        {e.stage?.replace('ck8t.', '') || 'agent'}
                      </span>
                    </td>
                    <td className="bs-audit2-td bs-audit2-model">{e.model || '—'}</td>
                    <td className="bs-audit2-td" style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 11 }}>
                      {e.durationMs != null ? `${e.durationMs}ms` : '—'}
                    </td>
                    <td className="bs-audit2-td">
                      <span className={`bs-audit2-status-chip ${hasError ? 'is-err' : 'is-ok'}`}>
                        {hasError ? 'Error' : 'OK'}
                      </span>
                    </td>
                    <td className="bs-audit2-td bs-audit2-ts">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="bs-audit2-td" onClick={ev => ev.stopPropagation()}>
                      <button className="bs-audit2-row-copy" title="Copy entry"
                        onClick={() => navigator.clipboard.writeText(safeJsonStr(e)).catch(() => {})}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Clear confirm */}
      {clearConfirm && (
        <div className="bs-confirm-overlay">
          <div className="bs-confirm-dialog" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <p style={{ color: '#f87171', fontWeight: 600, fontSize: 13 }}>Clear all {entries.length} audit records?</p>
            <p style={{ color: '#64748b', fontSize: 11.5, marginTop: 6 }}>This will permanently delete the entire AI audit log and cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="bs-confirm-cancel" onClick={() => setClearConfirm(false)}>Cancel</button>
              <button className="bs-confirm-danger" onClick={clear}>Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Developer Tools Section ──────────────────────────────────────────── */

const DEV_TABS = ['Memory Footprint', 'Debug Snapshot', 'Audit Log', 'Audit Config', 'DB Explorer']

function DevToolsSection() {
  const [activeTab, setActiveTab] = useState('Memory Footprint')
  return (
    <div className="bs-settings-pane bs-devtools-pane">
      <div className="bs-settings-section-head">
        <DevToolsIcon className="bs-ico-sm" />
        <h3 className="bs-settings-h3">Developer Tools</h3>
      </div>
      <div className="bs-devtools-tabs">
        {DEV_TABS.map((t) => (
          <button key={t} className={`bs-devtools-tab ${activeTab === t ? 'is-active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>
      <div className="bs-devtools-content">
        {activeTab === 'Memory Footprint' && <MemoryFootprintTab />}
        {activeTab === 'Debug Snapshot'   && <DebugSnapshotTab />}
        {activeTab === 'Audit Log'        && <UiAuditLogTab />}
        {activeTab === 'Audit Config'     && <UiAuditConfigTab />}
        {activeTab === 'DB Explorer'      && <DbExplorerTab />}
      </div>
    </div>
  )
}

function MemoryFootprintTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const base = typeof window !== 'undefined' ? (window.__CK8T_BRIDGE_BASE__ || '') : ''

  const load = useCallback(async () => {
    if (!base) return
    setLoading(true)
    try {
      const r = await fetch(`${base}/ck8t/devtools/memory`)
      if (r.ok) setData(await r.json())
    } catch {}
    finally { setLoading(false) }
  }, [base])

  useEffect(() => { load() }, [load])

  if (!base) return <div className="bs-devtools-empty">Memory Footprint is only available in the VS Code extension.</div>
  if (loading) return <div className="bs-devtools-empty">Loading…</div>
  if (!data) return <div className="bs-devtools-empty">Click Refresh to load memory stats.</div>

  const heapPct = data.heapTotal ? Math.round((data.heapUsed / data.heapTotal) * 100) : 0
  const fmtMb = (b) => b != null ? `${(b / 1024 / 1024).toFixed(1)} MB` : '—'
  const fmtUptime = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m` }

  return (
    <div className="bs-devtools-memory">
      <div className="bs-devtools-toolbar">
        <button className="bs-btn-ghost bs-btn-sm" onClick={load}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>
      <div className="bs-devtools-metric-grid">
        {[
          { label: 'Node.js Version', value: data.nodeVersion,              color: '#10b981' },
          { label: 'Process ID',      value: String(data.pid),              color: '#06b6d4' },
          { label: 'Uptime',          value: fmtUptime(data.uptimeSeconds), color: '#8b5cf6' },
          { label: 'Heap Used',       value: fmtMb(data.heapUsed),          color: '#f59e0b', bar: heapPct },
          { label: 'Heap Total',      value: fmtMb(data.heapTotal),         color: '#6366f1' },
          { label: 'RSS',             value: fmtMb(data.rss),               color: '#ec4899' },
          { label: 'External',        value: fmtMb(data.external),          color: '#14b8a6' },
        ].map(({ label, value, color, bar }) => (
          <div key={label} className="bs-devtools-metric-card" style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)`, background: `color-mix(in srgb, ${color} 4%, var(--bs-surface, #1e2026))` }}>
            <div className="bs-devtools-metric-label" style={{ color: `color-mix(in srgb, ${color} 70%, #94a3b8)` }}>{label}</div>
            {bar != null && (
              <div className="bs-devtools-bar-track">
                <div className="bs-devtools-bar-fill" style={{ width: `${Math.min(bar, 100)}%`, background: bar >= 80 ? '#ef4444' : bar >= 60 ? '#f59e0b' : color }} />
              </div>
            )}
            <div className="bs-devtools-metric-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DebugSnapshotTab() {
  const [snap, setSnap] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const base = typeof window !== 'undefined' ? (window.__CK8T_BRIDGE_BASE__ || '') : ''

  const generate = useCallback(async () => {
    if (!base) return
    setLoading(true)
    try {
      const r = await fetch(`${base}/ck8t/devtools/snapshot`)
      if (r.ok) setSnap(await r.json())
    } catch {}
    finally { setLoading(false) }
  }, [base])

  useEffect(() => { generate() }, [generate])

  const copySnap = useCallback(() => {
    if (!snap) return
    navigator.clipboard.writeText(JSON.stringify(snap, null, 2))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }, [snap])

  const download = useCallback(() => {
    if (!snap) return
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ck8t-snapshot-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }, [snap])

  if (!base) return <div className="bs-devtools-empty">Debug Snapshot is only available in the VS Code extension.</div>

  return (
    <div className="bs-devtools-snapshot">
      <div className="bs-devtools-toolbar">
        <button className="bs-btn-ghost bs-btn-sm" onClick={generate} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
        {snap && (
          <>
            <button className={`bs-btn-ghost bs-btn-sm ${copied ? 'is-copied' : ''}`} onClick={copySnap}>
              {copied
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              }
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button className="bs-btn-ghost bs-btn-sm" onClick={download}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          </>
        )}
      </div>
      {snap && (
        <div className="bs-devtools-snapshot-grid">
          {[
            { label: 'Generated',    value: new Date(snap.generatedAt).toLocaleString(),                                                              color: '#6366f1' },
            { label: 'Node.js',      value: snap.extension?.nodeVersion || '—',                                                                       color: '#10b981' },
            { label: 'PID',          value: String(snap.extension?.pid || '—'),                                                                       color: '#06b6d4' },
            { label: 'Heap Used',    value: snap.memory?.heapUsed != null ? `${(snap.memory.heapUsed / 1024 / 1024).toFixed(1)} MB` : '—',           color: '#f59e0b' },
            { label: 'Audit Entries',value: String(snap.audit?.total ?? '—'),                                                                         color: '#a855f7' },
            { label: 'Audit Errors', value: String(snap.audit?.errors ?? '—'), color: snap.audit?.errors > 0 ? '#ef4444' : '#94a3b8' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bs-devtools-snap-card" style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)`, background: `color-mix(in srgb, ${color} 4%, rgba(0,0,0,0.3))` }}>
              <div className="bs-devtools-snap-label">{label}</div>
              <div className="bs-devtools-snap-value" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {snap && (
        <Highlight code={JSON.stringify(snap, null, 2)} language="json" theme={themes.vsDark}>
          {({ style, tokens, getLineProps, getTokenProps }) => (
            <pre className="bs-devtools-snapshot-json-hl" style={{ ...style, background: 'rgba(15,17,26,0.85)', border: '1px solid rgba(99,102,241,0.15)' }}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  <span className="bs-snap-lineno">{i + 1}</span>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      )}
    </div>
  )
}

/* ── UI Audit Log Tab ─────────────────────────────────────────────────── */

function _auditActionColor(action) {
  switch (action) {
    case 'create': return '#4ade80'
    case 'delete': return '#f87171'
    case 'update': return '#fbbf24'
    case 'toggle': return '#60a5fa'
    case 'click':  return '#94a3b8'
    case 'close':  return '#fb923c'
    default:       return '#94a3b8'
  }
}

function _AuditPayloadBlock({ label, value, color }) {
  if (!value) return null
  let display = value
  const trimmed = typeof value === 'string' ? value.trim() : JSON.stringify(value, null, 2)
  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (isJson) { try { display = JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2) } catch { display = trimmed } }
  else { display = trimmed }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, alignSelf: 'flex-start', color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
        {label}
      </span>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid color-mix(in srgb, ${color} 15%, transparent)` }}>
        {isJson ? (
          <Highlight code={display.slice(0, 6000)} language="json" theme={themes.vsDark}>
            {({ style, tokens, getLineProps, getTokenProps }) => (
              <pre style={{ ...style, margin: 0, padding: '10px 12px', fontSize: 10.5, lineHeight: 1.6, overflowX: 'auto', background: 'rgba(10,12,20,0.7)' }}>
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        ) : (
          <pre style={{ margin: 0, padding: '10px 12px', fontSize: 10.5, lineHeight: 1.6, fontFamily: 'monospace', color: 'var(--bs-text-primary, #e2e8f0)', background: 'rgba(10,12,20,0.7)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {display.slice(0, 6000)}
          </pre>
        )}
      </div>
    </div>
  )
}

const _AUDIT_DETAIL_TABS = [
  { id: 'summary',  label: 'Summary'   },
  { id: 'metadata', label: 'Metadata'  },
  { id: 'full',     label: 'Full JSON' },
]

function _AuditEntryDetail({ entry, onBack }) {
  const [activeTab, setActiveTab] = useState('summary')
  const color = entry.color || '#818cf8'
  const actionColor = _auditActionColor(entry.action)

  const fullJson = JSON.stringify({
    id:          entry.id,
    eventId:     entry.eventId,
    module:      entry.module,
    button:      entry.button,
    action:      entry.action,
    description: entry.description,
    timestamp:   entry.timestamp,
    metadata:    entry.metadata,
  }, null, 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bs-surface, #1e2026)', flexShrink: 0 }}>
        <button type="button" onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: 'var(--bs-text-muted, #94a3b8)', fontSize: 11 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,6 9,12 15,18" /></svg>
          Back
        </button>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 10.5, padding: '2px 6px', borderRadius: 4, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{entry.module}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 10.5, padding: '2px 6px', borderRadius: 4, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{entry.button}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 6px', borderRadius: 4, color: actionColor, background: `color-mix(in srgb, ${actionColor} 10%, transparent)` }}>{entry.action}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--bs-text-muted, #94a3b8)' }}>{new Date(entry.timestamp).toLocaleString()}</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bs-surface, #1e2026)', flexShrink: 0, overflowX: 'auto' }}>
        {_AUDIT_DETAIL_TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            style={{ padding: '7px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? color : 'transparent'}`, color: activeTab === t.id ? color : 'var(--bs-text-muted, #94a3b8)', fontWeight: activeTab === t.id ? 600 : 400, transition: 'color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 11, alignItems: 'start' }}>
              {[
                ['Event ID',    <span style={{ fontFamily: 'monospace', fontSize: 10.5, padding: '2px 6px', borderRadius: 4, color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>{entry.eventId}</span>],
                ['Module',      <span style={{ color: 'var(--bs-text-primary, #e2e8f0)' }}>{entry.module}</span>],
                ['Button',      <span style={{ color: 'var(--bs-text-primary, #e2e8f0)' }}>{entry.button}</span>],
                ['Action',      <span style={{ color: actionColor }}>{entry.action}</span>],
                ['Description', <span style={{ color: 'var(--bs-text-primary, #e2e8f0)' }}>{entry.description}</span>],
                ['Timestamp',   <span style={{ fontFamily: 'monospace', color: 'var(--bs-text-primary, #e2e8f0)' }}>{new Date(entry.timestamp).toISOString()}</span>],
              ].map(([label, val], idx) => (
                <Fragment key={idx}>
                  <span style={{ color: 'var(--bs-text-muted, #94a3b8)', whiteSpace: 'nowrap', paddingTop: 2 }}>{label}</span>
                  <span>{val}</span>
                </Fragment>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'metadata' && (
          entry.metadata
            ? <_AuditPayloadBlock label="Metadata" value={typeof entry.metadata === 'string' ? entry.metadata : JSON.stringify(entry.metadata, null, 2)} color={color} />
            : <span style={{ fontSize: 11.5, color: 'var(--bs-text-muted, #94a3b8)', fontStyle: 'italic' }}>— no metadata —</span>
        )}
        {activeTab === 'full' && (
          <_AuditPayloadBlock label="Full Event" value={fullJson} color={color} />
        )}
      </div>
    </div>
  )
}

function UiAuditLogTab() {
  const [log, setLog] = useState(() => getUiAuditLog())
  const [filter, setFilter] = useState('')
  const [viewEntry, setViewEntry] = useState(null)

  useEffect(() => {
    setLog(getUiAuditLog())
    return subscribeUiAudit(() => setLog([...getUiAuditLog()]))
  }, [])

  const filtered = filter
    ? log.filter(e => [e.module, e.button, e.action, e.eventId, e.description].join(' ').toLowerCase().includes(filter.toLowerCase()))
    : log

  if (viewEntry) {
    return <_AuditEntryDetail entry={viewEntry} onBack={() => setViewEntry(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── Header (Daakia style) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bs-surface, #1e2026)', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bs-text-muted, #94a3b8)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bs-text-primary, #e2e8f0)', flex: 1 }}>UI Audit</span>
        <span style={{ fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>{log.length} records</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', width: 150 }}>
          <SearchIcon width={10} height={10} style={{ color: 'var(--bs-text-muted, #94a3b8)', flexShrink: 0 }} />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--bs-text-primary, #e2e8f0)' }} />
          {filter && (
            <button type="button" onClick={() => setFilter('')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: 3, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--bs-text-muted, #94a3b8)', padding: 0 }}>
              <XIcon width={9} height={9} />
            </button>
          )}
        </div>
        <button type="button" onClick={() => setLog([...getUiAuditLog()])} title="Refresh"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', background: 'transparent', color: 'var(--bs-text-muted, #94a3b8)', fontSize: 11 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
        {log.length > 0 && (
          <button type="button" onClick={() => { clearUiAuditLog(); setLog([]); setViewEntry(null) }} title="Clear all"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)', cursor: 'pointer', background: 'transparent', color: '#ef4444', fontSize: 11 }}>
            <TrashIcon width={10} height={10} />
            Clear All
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" style={{ opacity: 0.25 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            {log.length === 0 ? 'No events yet — enable events in Audit Config and interact with the canvas' : 'No matches'}
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bs-surface, #1e2026)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)', width: 28 }}>#</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)' }}>Module</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)' }}>Event</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)', width: 60 }}>Action</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500, color: 'var(--bs-text-muted, #94a3b8)', width: 75, whiteSpace: 'nowrap' }}>Time</th>
                <th style={{ width: 20 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const color = e.color || '#818cf8'
                const actionColor = _auditActionColor(e.action)
                return (
                  <tr
                    key={e.id}
                    onClick={() => setViewEntry(e)}
                    style={{ borderBottom: '1px solid color-mix(in srgb, rgba(255,255,255,0.06) 50%, transparent)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = '' }}
                  >
                    <td style={{ padding: '6px 8px', color: 'var(--bs-text-muted, #94a3b8)', fontFamily: 'monospace', fontSize: 10 }}>{filtered.length - i}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 10.5, padding: '2px 6px', borderRadius: 4, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                        {e.module}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 10.5, padding: '2px 6px', borderRadius: 4, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                        {e.button}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 10, color: actionColor }}>{e.action}</td>
                    <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--bs-text-primary, #e2e8f0)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 10, color: 'var(--bs-text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--bs-text-muted, #94a3b8)' }}><polyline points="9,6 15,12 9,18" /></svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ── UI Audit Config Tab ──────────────────────────────────────────────── */

function UiAuditConfigTab() {
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])
  const [collapsed, setCollapsed] = useState(new Set())

  // Rate-limit state — windowMs driven by DurationInputView (value in ms)
  const [maxCount,  setMaxCount]  = useState(() => String(getRateConfig().maxCount))
  const [windowMs,  setWindowMs]  = useState(() => getRateConfig().windowMs)

  useEffect(() => {
    const count = Math.max(1, parseInt(maxCount, 10) || 1)
    setRateConfig({ maxCount: count, windowMs })
  }, [maxCount, windowMs])

  const toggle = (id, enabled) => { setAuditEventEnabled(id, enabled); refresh() }
  const toggleModule = (module, enable) => {
    AUDIT_EVENT_DEFS.filter(d => d.module === module).forEach(d => setAuditEventEnabled(d.id, enable))
    refresh()
  }
  const toggleAll = (enable) => { AUDIT_EVENT_DEFS.forEach(d => setAuditEventEnabled(d.id, enable)); refresh() }
  const toggleCollapse = (module) => setCollapsed(prev => { const n = new Set(prev); n.has(module) ? n.delete(module) : n.add(module); return n })

  const grouped = MODULE_ORDER.map(module => ({
    module,
    defs: AUDIT_EVENT_DEFS.filter(d => d.module === module),
  })).filter(g => g.defs.length > 0)

  const totalEnabled = AUDIT_EVENT_DEFS.filter(d => isAuditEventEnabled(d.id)).length

  return (
    <div className="bs-devtools-uicfg">
      {/* Rate limit card */}
      <div className="bs-uicfg-rate-card">
        <div className="bs-uicfg-rate-label">Rate Limit <span className="bs-uicfg-rate-sublabel">— same event type only</span></div>
        <div className="bs-uicfg-rate-row">
          <span className="bs-uicfg-rate-hint">Max</span>
          <TextInputView
            type="number"
            min="1"
            value={maxCount}
            onChange={(e) => setMaxCount(e.target.value)}
            style={{ width: 64 }}
          />
          <span className="bs-uicfg-rate-hint">of the same event within</span>
          <DurationInputView
            value={windowMs}
            onChange={setWindowMs}
          />
        </div>
        <div className="bs-uicfg-rate-desc">
          Each event type is counted independently — e.g. <code className="bs-uicfg-code">workflow.run</code> and <code className="bs-uicfg-code">canvas.block.add</code> each have their own counter.
        </div>
      </div>

      {/* Toolbar */}
      <div className="bs-uicfg-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#e2e8f0' }}>Audit Config</span>
          <span className="bs-uicfg-count">{totalEnabled}/{AUDIT_EVENT_DEFS.length} active</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="bs-uicfg-action-btn" style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.06)' }} onClick={() => toggleAll(true)}>Enable All</button>
          <button className="bs-uicfg-action-btn" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)' }} onClick={() => toggleAll(false)}>Disable All</button>
          <button className="bs-uicfg-action-btn" onClick={resetAuditConfig}>Reset</button>
        </div>
      </div>

      <div className="bs-uicfg-desc">
        Control which UI events get recorded in the <strong>Audit Log</strong>. Events are structured as
        <code className="bs-uicfg-code">module · button · action</code> — disable noisy events to keep the log focused.
      </div>

      {/* Category groups */}
      <div className="bs-uicfg-groups">
        {grouped.map(({ module, defs }) => {
          const color = defs[0]?.color ?? '#94a3b8'
          const enabledCount = defs.filter(d => isAuditEventEnabled(d.id)).length
          const allEnabled = enabledCount === defs.length
          const isCollapsed = collapsed.has(module)

          return (
            <div key={module} className="bs-uicfg-group">
              {/* Group header */}
              <div className="bs-uicfg-group-header">
                <button className="bs-uicfg-collapse-btn" onClick={() => toggleCollapse(module)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ color, transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .2s', opacity: 0.7 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  <span className="bs-uicfg-module-chip" style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
                    {module}
                  </span>
                </button>
                <div className="bs-uicfg-divider" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{enabledCount}/{defs.length}</span>
                {/* Group toggle */}
                <button
                  className="bs-uicfg-group-toggle"
                  style={{ background: allEnabled ? color : 'rgba(255,255,255,0.1)' }}
                  onClick={() => toggleModule(module, !allEnabled)}
                  title={allEnabled ? `Disable all ${module}` : `Enable all ${module}`}
                >
                  <span className="bs-uicfg-toggle-thumb" style={{ left: allEnabled ? 14 : 2 }} />
                </button>
              </div>

              {/* Event rows */}
              {!isCollapsed && (
                <div className="bs-uicfg-rows" style={{ borderColor: `color-mix(in srgb, ${color} 12%, transparent)`, background: `color-mix(in srgb, ${color} 2%, transparent)` }}>
                  {defs.map((def, idx) => {
                    const enabled = isAuditEventEnabled(def.id)
                    return (
                      <div key={def.id} className="bs-uicfg-row" style={{ borderColor: idx < defs.length - 1 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: enabled ? '#e2e8f0' : '#64748b' }}>{def.description}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <code style={{ fontSize: 9, color, background: `color-mix(in srgb, ${color} 10%, transparent)`, borderRadius: 3, padding: '1px 4px' }}>{def.button}</code>
                            <span style={{ fontSize: 9, color: '#475569' }}>·</span>
                            <span style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>{def.action}</span>
                            <span style={{ fontSize: 9, color: '#475569' }}>·</span>
                            <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{def.id}</span>
                          </div>
                        </div>
                        <button
                          className="bs-uicfg-event-toggle"
                          style={{ background: enabled ? color : 'rgba(255,255,255,0.1)' }}
                          onClick={() => toggle(def.id, !enabled)}
                          title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                        >
                          <span className="bs-uicfg-toggle-thumb" style={{ left: enabled ? 17 : 3 }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── DB Explorer Tab ──────────────────────────────────────────────────────── */

const _DB_TABLE_COLORS = {
  bs_store:           '#818cf8',
  workspace_snapshot: '#10b981',
  ce_audit:           '#22d3ee',
  app_settings:       '#f59e0b',
  request_history:    '#06b6d4',
}
function _dbColor(name) { return _DB_TABLE_COLORS[name] ?? '#818cf8' }

function _DbJsonModal({ value, accentColor, onClose }) {
  let pretty
  if (typeof value === 'string') {
    pretty = value
    try { pretty = JSON.stringify(JSON.parse(value), null, 2) } catch {}
  } else {
    pretty = safeJsonStr(value)
  }
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          width: 'min(700px, 90vw)', height: 'min(520px, 80vh)',
          backgroundColor: 'var(--bs-surface, #1e2026)',
          border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', flexShrink: 0,
          borderBottom: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`,
          background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>JSON Viewer</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--bs-text-muted, #94a3b8)' }}>{pretty.length.toLocaleString()} chars</span>
            <button type="button" onClick={onClose} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--bs-text-muted, #94a3b8)' }}>
              <XIcon size={13} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
          <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--bs-text-primary, #e2e8f0)', lineHeight: 1.6 }}>
            {pretty.slice(0, 50000)}
          </pre>
        </div>
      </div>
    </div>,
    document.body
  )
}

function _DbJsonCell({ value, accentColor }) {
  const [open, setOpen] = useState(false)
  const isObj = value !== null && typeof value === 'object'
  const str = isObj ? safeJsonStr(value) : (value == null ? '' : String(value))
  const isJson = isObj || str.startsWith('{') || str.startsWith('[')
  if (!isJson || str.length < 20) {
    return (
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: str ? 'var(--bs-text-primary, #e2e8f0)' : 'var(--bs-text-muted, #94a3b8)' }}>
        {str || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>null</span>}
      </span>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', background: 'none', border: 'none', fontSize: 10, fontFamily: 'monospace', color: accentColor, padding: 0 }}
        title="Click to open JSON viewer"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,6 15,12 9,18" /></svg>
        <span style={{ opacity: 0.7 }}>{`{…} ${str.length} chars`}</span>
      </button>
      {open && <_DbJsonModal value={value} accentColor={accentColor} onClose={() => setOpen(false)} />}
    </>
  )
}

function DbExplorerTab() {
  const base = typeof window !== 'undefined' ? (window.__CK8T_BRIDGE_BASE__ || '') : ''
  const [tables, setTables] = useState([])
  const [activeTable, setActiveTable] = useState(null)
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)
  const [rowsLoading, setRowsLoading] = useState(false)

  const loadTables = useCallback(async () => {
    if (!base) return
    setLoading(true)
    try {
      const r = await fetch(`${base}/ck8t/devtools/db`)
      if (r.ok) { const d = await r.json(); setTables(d.tables ?? []) }
    } catch {}
    finally { setLoading(false) }
  }, [base])

  const loadRows = useCallback(async (tableName) => {
    if (!base || !tableName) return
    setRowsLoading(true); setRows([]); setColumns([])
    try {
      const r = await fetch(`${base}/ck8t/devtools/db/${encodeURIComponent(tableName)}/rows?limit=200`)
      if (r.ok) { const d = await r.json(); setRows(d); if (d.length > 0) setColumns(Object.keys(d[0])) }
    } catch {}
    finally { setRowsLoading(false) }
  }, [base])

  useEffect(() => { loadTables() }, [loadTables])
  useEffect(() => { if (activeTable) loadRows(activeTable) }, [activeTable, loadRows])

  if (!base) return <div className="bs-devtools-empty">DB Explorer is only available in the VS Code extension.</div>

  const activeColor = activeTable ? _dbColor(activeTable) : '#818cf8'

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Left: table list ── */}
      <div style={{ width: 190, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--bs-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Tables</span>
          <button type="button" onClick={loadTables} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bs-text-muted, #94a3b8)', padding: 0, display: 'flex' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading && <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>Loading…</div>}
          {tables.map(tbl => {
            const c = _dbColor(tbl.name)
            const isActive = activeTable === tbl.name
            return (
              <button
                key={tbl.name}
                type="button"
                onClick={() => setActiveTable(tbl.name)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: 'calc(100% - 8px)', margin: '0 4px 2px',
                  padding: '6px 8px', textAlign: 'left',
                  borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                  background: isActive ? `color-mix(in srgb, ${c} 12%, transparent)` : 'transparent',
                  color: isActive ? c : 'var(--bs-text-primary, #e2e8f0)',
                  borderLeft: `2px solid ${isActive ? c : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                  <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{tbl.name}</span>
                </div>
                <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, padding: '1px 6px', borderRadius: 9999, flexShrink: 0, marginLeft: 4, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>
                  {tbl.rowCount}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Right: rows ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeTable ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, color: 'var(--bs-text-muted, #94a3b8)' }}>
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>Select a table to browse rows</span>
          </div>
        ) : rowsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--bs-text-muted, #94a3b8)' }}>
            No rows in <code style={{ marginLeft: 4, fontFamily: 'monospace', color: activeColor }}>{activeTable}</code>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', flexShrink: 0, borderBottom: `1px solid color-mix(in srgb, ${activeColor} 15%, transparent)`, background: `color-mix(in srgb, ${activeColor} 4%, transparent)` }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: activeColor }}>{activeTable}</span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 9999, color: activeColor, background: `color-mix(in srgb, ${activeColor} 12%, transparent)` }}>{rows.length} rows</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bs-surface, #1e2026)' }}>
                  <tr>
                    {columns.map((col, i) => (
                      <th key={col} style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: `1px solid color-mix(in srgb, ${activeColor} 12%, transparent)`, color: i === 0 ? activeColor : 'var(--bs-text-muted, #94a3b8)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.1s' }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = `color-mix(in srgb, ${activeColor} 3%, transparent)` }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = '' }}
                    >
                      {columns.map((col, ci) => (
                        <td key={col} style={{ padding: '5px 12px', verticalAlign: 'top', maxWidth: 200 }}>
                          <_DbJsonCell value={row[col]} accentColor={ci === 0 ? activeColor : '#818cf8'} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Getting Started Section ─────────────────────────────────────────── */

const GS_PALETTE = ['#6366f1','#8b5cf6','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#a855f7']
function gsColor(id) {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i)
  return GS_PALETTE[Math.abs(h) % GS_PALETTE.length]
}
function parseGsName(name) {
  const dash = name.indexOf(' — ')
  if (dash === -1) return { label: name, chip: null, num: '' }
  const part1 = name.slice(0, dash)
  const chip = name.slice(dash + 3)
  const dot = part1.indexOf(' · ')
  const label = dot === -1 ? part1 : part1.slice(dot + 3)
  const num = dot === -1 ? '' : part1.slice(0, dot)
  return { num, label, chip }
}
function parseWfNum(name) {
  const m = name.match(/^(\d+)[\s·]/)
  return m ? parseInt(m[1], 10) : 0
}
function getWfCategory(name) {
  const n = parseWfNum(name)
  if (n >= 65) return 'Debugger'
  if (n >= 46) return 'Community'
  return 'Core'
}
function getWfCategoryColor(name) {
  const cat = getWfCategory(name)
  if (cat === 'Debugger') return '#f59e0b'
  if (cat === 'Community') return '#10b981'
  return '#818cf8'
}
function getBlockTypes(wf) {
  const seen = new Set()
  const types = []
  for (const node of (wf.nodes || [])) {
    const bt = node.data?.blockType
    if (bt && bt !== 'starter' && !seen.has(bt)) {
      seen.add(bt)
      types.push(bt)
    }
  }
  return types
}

const GS_CAT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core Blocks' },
  { id: 'community', label: 'Community' },
  { id: 'debugger', label: 'Debugger' },
]

function GettingStartedSection({ pendingSelectId = null, onPendingConsumed } = {}) {
  const total = GETTING_STARTED_WORKFLOWS.length
  const workflows = useWorkspaceStore((s) => s.workflows)
  const restoreGettingStarted = useWorkspaceStore((s) => s.restoreGettingStarted)
  const [confirming, setConfirming] = useState(false)
  const [restored, setRestored] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState(null)

  // Auto-select workflow when navigated via "Read Docs"
  useEffect(() => {
    if (!pendingSelectId) return
    const wf = GETTING_STARTED_WORKFLOWS.find((w) => w.id === pendingSelectId)
    if (wf) { setSelected(wf); setQuery(''); setCategory('all') }
    onPendingConsumed?.()
  }, [pendingSelectId, onPendingConsumed])

  const gsCount = workflows.filter((w) => w.folderId === 'folder_getting_started').length
  const missing = total - gsCount
  const missingColor = missing > 0 ? '#f87171' : missing === 0 ? '#94a3b8' : '#34d399'

  const visible = useMemo(() => {
    const q = query.toLowerCase()
    return GETTING_STARTED_WORKFLOWS.filter((w) => {
      const matchQ = !q || w.name.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q)
      if (!matchQ) return false
      if (category === 'all') return true
      const n = parseWfNum(w.name)
      if (category === 'core') return n >= 1 && n <= 45
      if (category === 'community') return n >= 46 && n <= 64
      if (category === 'debugger') return n >= 65
      return true
    })
  }, [query, category])

  const catCounts = useMemo(() => ({
    all: total,
    core: GETTING_STARTED_WORKFLOWS.filter(w => { const n = parseWfNum(w.name); return n >= 1 && n <= 45 }).length,
    community: GETTING_STARTED_WORKFLOWS.filter(w => { const n = parseWfNum(w.name); return n >= 46 && n <= 64 }).length,
    debugger: GETTING_STARTED_WORKFLOWS.filter(w => parseWfNum(w.name) >= 65).length,
  }), [total])

  function handleRestore() {
    restoreGettingStarted()
    setConfirming(false)
    setRestored(true)
    setSelected(null)
    setTimeout(() => setRestored(false), 3000)
  }

  return (
    <div className="bs-settings-pane bs-gs-pane">
      {/* Header */}
      <div className="bs-gs-hero">
        <div className="bs-gs-hero-icon">
          <GettingStartedIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="bs-gs-hero-title">Getting Started</div>
          <div className="bs-gs-hero-sub">{total} real working demos — open on canvas, run, see results.</div>
        </div>
      </div>

      {/* Stats + Restore row */}
      <div className="bs-gs-stats">
        <div className="bs-gs-stat2">
          <span className="bs-gs-stat2-n" style={{ color: '#818cf8' }}>{gsCount}</span>
          <span className="bs-gs-stat2-l">in folder</span>
        </div>
        <div className="bs-gs-stat2-div" />
        <div className="bs-gs-stat2">
          <span className="bs-gs-stat2-n">{total}</span>
          <span className="bs-gs-stat2-l">available</span>
        </div>
        <div className="bs-gs-stat2-div" />
        <div className="bs-gs-stat2">
          <span className="bs-gs-stat2-n" style={{ color: missingColor }}>{Math.abs(missing)}</span>
          <span className="bs-gs-stat2-l">{missing > 0 ? 'missing' : missing < 0 ? 'extra' : 'synced'}</span>
        </div>
        <div style={{ flex: 1 }} />
        {!confirming ? (
          <button className="bs-gs-restore-btn" onClick={() => { setConfirming(true); setRestored(false) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Restore all {total}
          </button>
        ) : (
          <div className="bs-gs-confirm-inline">
            <span className="bs-gs-confirm-q">Replace all {total} demos?</span>
            <button className="bs-gs-confirm-yes" onClick={handleRestore}>Yes</button>
            <button className="bs-gs-confirm-no" onClick={() => setConfirming(false)}>No</button>
          </div>
        )}
      </div>
      {restored && <div className="bs-gs-toast">All {total} Getting Started workflows restored.</div>}

      {/* Category filter tabs */}
      <div className="bs-gs-filters">
        {GS_CAT_FILTERS.map(f => (
          <button
            key={f.id}
            className={`bs-gs-filter-tab ${category === f.id ? 'is-active' : ''}`}
            onClick={() => { setCategory(f.id); setSelected(null) }}
          >
            {f.label}
            <span className="bs-gs-filter-count">{catCounts[f.id]}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Search inline */}
        <div className="bs-gs-search-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="bs-gs-search"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button className="bs-gs-search-clear" onClick={() => setQuery('')}>×</button>}
          <span className="bs-gs-search-count">{visible.length}</span>
        </div>
      </div>

      {/* Main content: grid + detail panel */}
      {(() => {
        const cardGrid = (
          <div className="bs-gs-grid">
            {visible.map((wf) => {
              const { num, label, chip } = parseGsName(wf.name)
              const color = gsColor(wf.id)
              const catColor = getWfCategoryColor(wf.name)
              const catLabel = getWfCategory(wf.name)
              const blockTypes = getBlockTypes(wf)
              const isSelected = selected?.id === wf.id
              return (
                <div
                  key={wf.id}
                  className={`bs-gs-card ${isSelected ? 'is-selected' : ''}`}
                  style={{ '--gc': color, '--cc': catColor }}
                  onClick={() => setSelected(isSelected ? null : wf)}
                >
                  <div className="bs-gs-card-accent" />
                  <div className="bs-gs-card-body">
                    <div className="bs-gs-card-header">
                      {num && <span className="bs-gs-card-num">{num}</span>}
                      <span className="bs-gs-card-cat">{catLabel}</span>
                    </div>
                    <div className="bs-gs-card-name">{label}</div>
                    {wf.description && <div className="bs-gs-card-desc">{wf.description}</div>}
                    {blockTypes.length > 0 && (
                      <div className="bs-gs-card-blocks">
                        {blockTypes.slice(0, 3).map(bt => (
                          <span key={bt} className="bs-gs-block-chip">{bt.replace(/_/g, ' ')}</span>
                        ))}
                        {blockTypes.length > 3 && (
                          <span className="bs-gs-block-chip bs-gs-block-more">+{blockTypes.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {visible.length === 0 && (
              <div className="bs-gs-empty">No demos match "{query}"</div>
            )}
          </div>
        )
        return selected ? (
          <div className="bs-gs-content">
            <SplitPanelView
              defaultSplit={55}
              minFirst={200}
              minSecond={220}
              style={{ flex: 1, minHeight: 0 }}
              first={cardGrid}
              second={<div style={{ overflowY: 'auto', height: '100%' }}><GsDetailPanel wf={selected} onClose={() => setSelected(null)} /></div>}
            />
          </div>
        ) : (
          <div className="bs-gs-content">{cardGrid}</div>
        )
      })()}
    </div>
  )
}

function GsDetailPanel({ wf, onClose }) {
  const { num, label, chip } = parseGsName(wf.name)
  const color = gsColor(wf.id)
  const catLabel = getWfCategory(wf.name)
  const catColor = getWfCategoryColor(wf.name)
  const blockTypes = getBlockTypes(wf)
  const nodeCount = (wf.nodes || []).length
  const edgeCount = (wf.edges || []).length

  return (
    <div className="bs-gs-detail">
      <div className="bs-gs-detail-head">
        <span className="bs-gs-detail-num" style={{ color }}>{num}</span>
        <span className="bs-gs-detail-cat-badge" style={{ background: `color-mix(in srgb, ${catColor} 15%, transparent)`, color: catColor }}>{catLabel}</span>
        <div style={{ flex: 1 }} />
        <button className="bs-gs-detail-close" onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="bs-gs-detail-title" style={{ color }}>{label}</div>
      {chip && <div className="bs-gs-detail-chip">{chip}</div>}

      {wf.description && (
        <div className="bs-gs-detail-desc">{wf.description}</div>
      )}

      <div className="bs-gs-detail-meta">
        <span className="bs-gs-detail-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/></svg>
          {nodeCount} nodes
        </span>
        <span className="bs-gs-detail-meta-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          {edgeCount} edges
        </span>
      </div>

      {blockTypes.length > 0 && (
        <div className="bs-gs-detail-section">
          <div className="bs-gs-detail-section-label">Block Types Used</div>
          <div className="bs-gs-detail-blocks">
            {blockTypes.map((bt, i) => (
              <span key={bt} className="bs-gs-detail-block-chip" style={{
                background: `color-mix(in srgb, ${GS_PALETTE[i % GS_PALETTE.length]} 12%, transparent)`,
                color: GS_PALETTE[i % GS_PALETTE.length],
                borderColor: `color-mix(in srgb, ${GS_PALETTE[i % GS_PALETTE.length]} 30%, transparent)`,
              }}>
                {bt.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bs-gs-detail-section">
        <div className="bs-gs-detail-section-label">How to Run</div>
        <div className="bs-gs-detail-steps">
          <div className="bs-gs-detail-step">
            <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>1</span>
            <span>Open from the <span className="bs-gs-detail-hl">Getting Started</span> folder in the sidebar</span>
          </div>
          <div className="bs-gs-detail-step">
            <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>2</span>
            <span>Press <span className="bs-gs-detail-hl">Run</span> on the canvas toolbar</span>
          </div>
          <div className="bs-gs-detail-step">
            <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>3</span>
            <span>Check the <span className="bs-gs-detail-hl">Preview</span> or <span className="bs-gs-detail-hl">Run</span> panel for output</span>
          </div>
          {catLabel === 'Community' && (
            <div className="bs-gs-detail-step">
              <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>4</span>
              <span>Requires the <span className="bs-gs-detail-hl">ideogram4-storybook</span> block installed</span>
            </div>
          )}
          {catLabel === 'Debugger' && !blockTypes.includes('agent') && (
            <div className="bs-gs-detail-step">
              <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>4</span>
              <span>Right-click a block → <span className="bs-gs-detail-hl">Debug</span> → set a breakpoint → press Run</span>
            </div>
          )}
          {catLabel === 'Debugger' && blockTypes.includes('agent') && (
            <div className="bs-gs-detail-step">
              <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>4</span>
              <span>Right-click Agent → <span className="bs-gs-detail-hl">Debug</span> → switch to the <span className="bs-gs-detail-hl">client.js</span> tab → set a breakpoint → press Run</span>
            </div>
          )}
          {chip && (
            <div className="bs-gs-detail-step">
              <span className="bs-gs-detail-step-n" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>✓</span>
              <span>Focuses the <span className="bs-gs-detail-hl" style={{ color: catColor }}>{chip}</span> block pattern</span>
            </div>
          )}
        </div>
      </div>

      {/* Setup & Debug Guide — always shown */}
      <GsSetupGuide />
    </div>
  )
}

function GsSetupGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bs-gs-setup">
      <button className="bs-gs-setup-toggle" onClick={() => setOpen(v => !v)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .18s', opacity: 0.7, flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span>Quick Setup &amp; Debug Guide</span>
      </button>
      {open && (
        <div className="bs-gs-setup-body">
          <div className="bs-gs-setup-section">
            <div className="bs-gs-setup-section-title">Start the VS Code Extension</div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">1</span><span>Open this project in VS Code</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">2</span><span>Press <code className="bs-gs-setup-code">F5</code> — the Extension Development Host window opens</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">3</span><span>In the new VS Code window click the <strong>CK8T icon</strong> in the Activity Bar</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">4</span><span>Click <strong>Connect</strong> — the embedded server starts on <code className="bs-gs-setup-code">localhost:3000</code></span></div>
          </div>

          <div className="bs-gs-setup-section">
            <div className="bs-gs-setup-section-title">Run a Workflow</div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">5</span><span>Open any workflow from the <strong>Getting Started</strong> folder in the sidebar</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">6</span><span>Press <code className="bs-gs-setup-code">▶ Run</code> in the canvas toolbar</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">7</span><span>Check the <strong>Preview</strong> block on canvas or the <strong>Run</strong> panel at the bottom</span></div>
          </div>

          <div className="bs-gs-setup-section">
            <div className="bs-gs-setup-section-title">Debug a Block</div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">8</span><span>Right-click any block → <strong>Debug</strong> to open the Block Debugger</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">9</span><span>For <strong>Agent / AI blocks</strong>: right-click → Debug → switch to the <strong>client.js</strong> tab → set a breakpoint → press Run (same as any other block)</span></div>
            <div className="bs-gs-setup-step"><span className="bs-gs-setup-n">10</span><span>For <strong>Function / JS blocks</strong>: add <code className="bs-gs-setup-code">debugger</code> statements in the code editor — VS Code pauses on them when the EDH is running</span></div>
          </div>

          <div className="bs-gs-setup-tip">
            <strong>Tip:</strong> The CK8T server runs inside the extension host — you don't need a separate terminal. If the server stops, click <strong>Reconnect</strong> in the CK8T panel.
          </div>
        </div>
      )}
    </div>
  )
}

function safeJsonStr(v) { try { return JSON.stringify(v, null, 2) } catch { return String(v) } }
