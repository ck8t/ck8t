/**
 * SwiftUI/Claude-Code-style side navigation.
 *
 *   ┌──┬────────────────────┬─┐
 *   │🗂│  Panel title       │║│  rail + resizable panel + splitter
 *   │👥│  scrollable body   │║│  - click splitter = toggle collapse
 *   │🤖│                    │║│  - drag splitter = resize pane
 *   │⭐│                    │║│  - all rows have right-click menus
 *   │🧩│                    │║│
 *   │⟨⟩│                    │ │
 *   └──┴────────────────────┴─┘
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspace-store'
import { useTabsStore, agentTabId, skillTabId, teamTabId, workflowTabId } from '../stores/tabs-store'
import BlockPalette from './BlockPalette'
import { ManagerIcon } from '../components/BlockManager'
import ContextMenu from './ContextMenu'
import ConfirmModal from '../components/ConfirmModal'
import CreateWorkflowModal, { entityColor } from '../components/CreateWorkflowModal'
import ImportWorkflowModal from '../components/ImportWorkflowModal'
import StyledSelect from '../components/StyledSelect'
import { pickAndParseWorkflowJSON } from '../utils/import-workflow'
import { flushSnapshot } from '../stores/snapshot'
import { useUiStateStore } from '../stores/ui-state-store'
import {
  WorkflowsIcon,
  TeamsIcon,
  AgentsIcon,
  SkillsIcon,
  BlocksIcon,
  PanelLeftIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  FolderIcon,
  LinkIcon,
  SettingsIcon,
} from '../components/icons'
import { BookIcon } from '../tabs/WikiGuide'

function ImportIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor"/>
      <polyline points="7 10 12 15 17 10" stroke="currentColor"/>
      <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor"/>
    </svg>
  )
}

const TABS = [
  { id: 'workflows', label: 'Workflows', Icon: WorkflowsIcon },
  { id: 'teams', label: 'Teams', Icon: TeamsIcon },
  { id: 'agents', label: 'Agents', Icon: AgentsIcon },
  { id: 'skills', label: 'Skills', Icon: SkillsIcon },
  { id: 'blocks', label: 'Blocks', Icon: BlocksIcon },
]

const MIN_W = 220
const MAX_W = 480
const DEFAULT_W = 288

export default function SideNav() {
  const activeTab  = useUiStateStore((s) => s.sideNavTab)
  const open       = useUiStateStore((s) => s.sideNavOpen)
  const width      = useUiStateStore((s) => s.sideNavWidth)
  const setPanelState = useUiStateStore((s) => s.setPanelState)
  const setActiveTab = (v) => setPanelState({ sideNavTab: v })
  const setOpen      = (v) => setPanelState({ sideNavOpen: typeof v === 'function' ? v(open) : v })
  const setWidth     = (v) => setPanelState({ sideNavWidth: typeof v === 'function' ? v(width) : v })
  const [dragging, setDragging] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [importPending, setImportPending] = useState(null) // parsed workflow waiting for team pick
  const [importError, setImportError]   = useState(null)
  const dragRef = useRef({ active: false, startX: 0, startW: width, moved: false })

  const panel = useMemo(() => TABS.find((t) => t.id === activeTab), [activeTab])
  const openWiki = useTabsStore((s) => s.openWiki)
  const openSettings = useTabsStore((s) => s.openSettings)
  const openManager = useTabsStore((s) => s.openManager)
  const openWorkflowTab = useTabsStore((s) => s.openWorkflowTab)
  const teams = useWorkspaceStore((s) => s.teams)
  const workflowFolders = useWorkspaceStore((s) => s.workflowFolders)
  const importWorkflow = useWorkspaceStore((s) => s.importWorkflow)

  async function handleImportClick() {
    setImportError(null)
    try {
      const wf = await pickAndParseWorkflowJSON()
      setImportPending(wf)
    } catch (err) {
      if (err.message !== 'cancelled') setImportError(err.message)
    }
  }

  function handleImportConfirm(name, teamIds, folderId) {
    if (!importPending) return
    const wf = importWorkflow(name, teamIds, {
      nodes: importPending.nodes,
      edges: importPending.edges,
      subBlockValues: importPending.subBlockValues,
      folderId,
    })
    openWorkflowTab(wf.id, wf.name)
    setImportPending(null)
    // Immediately persist — don't rely on 2 s debounce; panel close would lose the workflow
    flushSnapshot()
  }

  function onRailClick(id) {
    if (!open) { setOpen(true); setActiveTab(id); return }
    if (id === activeTab) { setOpen(false); return }
    setActiveTab(id)
  }

  // ----- Splitter: drag to resize, click (no movement) to toggle collapse ----
  const onSplitterPointerDown = useCallback((e) => {
    dragRef.current = { active: true, startX: e.clientX, startW: width, moved: false }
    setDragging(true)
    e.preventDefault()
  }, [width])

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      if (Math.abs(dx) > 3) dragRef.current.moved = true
      const next = Math.max(MIN_W, Math.min(MAX_W,
        _isExtension ? dragRef.current.startW - dx : dragRef.current.startW + dx
      ))
      setWidth(next)
    }
    function onUp() {
      if (!dragRef.current.active) return
      const moved = dragRef.current.moved
      dragRef.current.active = false
      setDragging(false)
      if (!moved) setOpen((o) => !o) // bare click = toggle
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  // Keyboard: Cmd/Ctrl+\ (browser) or Alt/Option+\ (extension) toggles left panel
  const _isExtension = typeof window !== 'undefined' && window.__CK8T_MODE__ === 'vscode-extension'
  useEffect(() => {
    function onKey(e) {
      const mod = _isExtension ? e.altKey : (e.metaKey || e.ctrlKey)
      // Use e.code for physical key — Alt changes e.key on macOS (produces «)
      if (mod && e.code === 'Backslash') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [_isExtension])

  return (
    <aside
      className={`bs-sidenav ${open ? 'is-open' : 'is-closed'} ${dragging ? 'is-dragging' : ''}`}
      style={{ '--bs-pane-w': `${open ? width : 0}px` }}
    >
      <nav className="bs-rail" aria-label="Workspace sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`bs-rail-btn ${open && activeTab === t.id ? 'is-active' : ''}`}
            onClick={() => onRailClick(t.id)}
            title={t.label}
            aria-pressed={open && activeTab === t.id}
          >
            <t.Icon className="bs-rail-ico" />
            <span className="bs-rail-label">{t.label}</span>
          </button>
        ))}
        <div className="bs-rail-spacer" />
        <button
          className="bs-rail-btn"
          onClick={handleImportClick}
          title="Import workflow JSON"
        >
          <ImportIcon className="bs-rail-ico" />
          <span className="bs-rail-label">Import</span>
        </button>
        <button
          className="bs-rail-btn"
          onClick={() => openManager()}
          title="Block Manager — install community blocks"
        >
          <ManagerIcon className="bs-rail-ico" />
          <span className="bs-rail-label">Manager</span>
        </button>
        <button
          className="bs-rail-btn"
          onClick={() => openWiki()}
          title="Wiki — CK8T — Agent Builder Studio Guide"
        >
          <BookIcon className="bs-rail-ico" />
          <span className="bs-rail-label">Wiki</span>
        </button>
        <button
          className="bs-rail-btn"
          onClick={() => openSettings()}
          title={_isExtension ? 'Settings & shortcuts (⌥,)' : 'Settings & shortcuts (⌘,)'}
        >
          <SettingsIcon className="bs-rail-ico" />
          <span className="bs-rail-label">Settings</span>
        </button>
        <div style={{ height: 8 }} />
        <button
          className="bs-rail-btn"
          onClick={() => setOpen((o) => !o)}
          title={open
            ? (_isExtension ? 'Collapse panel (⌥\\)' : 'Collapse panel (⌘\\)')
            : (_isExtension ? 'Expand panel (⌥\\)' : 'Expand panel (⌘\\)')}
        >
          <PanelLeftIcon className="bs-rail-ico" />
          <span className="bs-rail-label">{open ? 'Hide' : 'Show'}</span>
        </button>
      </nav>

      <section className="bs-pane" aria-hidden={!open}>
        <header className="bs-pane-head">
          <h2 className="bs-pane-title">{panel?.label}</h2>
        </header>
        <div className="bs-pane-body">
          {activeTab === 'workflows' && <WorkflowsPanel />}
          {activeTab === 'teams' && <TeamsPanel />}
          {activeTab === 'agents' && <AgentsPanel />}
          {activeTab === 'skills' && <SkillsPanel />}
          {activeTab === 'blocks' && <BlockPalette />}
        </div>
      </section>

      <div
        className="bs-splitter"
        onPointerDown={onSplitterPointerDown}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        title=""
        aria-label="Resize or collapse panel"
      >
        <div className="bs-splitter-grip" />
        {showTip && !dragging && (
          <div className="bs-splitter-tip">
            <div>Click to {open ? 'collapse' : 'expand'} <kbd>{_isExtension ? '⌥\\' : '⌘\\'}</kbd></div>
            <div>Drag to resize</div>
          </div>
        )}
      </div>

      {/* ── Import error toast ── */}
      {importError && (
        <div className="bs-import-error-toast" onClick={() => setImportError(null)}>
          <span>⚠ {importError}</span>
          <button className="bs-import-error-close">×</button>
        </div>
      )}

      {/* ── Import workflow modal ── */}
      {importPending && (
        <ImportWorkflowModal
          teams={teams}
          folders={workflowFolders}
          defaultName={importPending.name}
          defaultTeamIds={teams[0] ? [teams[0].id] : []}
          defaultFolderId={workflowFolders[0]?.id || null}
          onCancel={() => setImportPending(null)}
          onImport={handleImportConfirm}
        />
      )}
    </aside>
  )
}

/* =========================================================================
 * Sections
 * ====================================================================== */

function WorkflowsPanel() {
  const workflows = useWorkspaceStore((s) => s.workflows)
  const workflowFolders = useWorkspaceStore((s) => s.workflowFolders)
  const activeId = useWorkspaceStore((s) => s.activeWorkflowId)
  const teams = useWorkspaceStore((s) => s.teams)
  const createWorkflow = useWorkspaceStore((s) => s.createWorkflow)
  const deleteWorkflow = useWorkspaceStore((s) => s.deleteWorkflow)
  const renameWorkflow = useWorkspaceStore((s) => s.renameWorkflow)
  const duplicateWorkflow = useWorkspaceStore((s) => s.duplicateWorkflow)
  const createWorkflowFolder = useWorkspaceStore((s) => s.createWorkflowFolder)
  const renameWorkflowFolder = useWorkspaceStore((s) => s.renameWorkflowFolder)
  const deleteWorkflowFolder = useWorkspaceStore((s) => s.deleteWorkflowFolder)
  const openWorkflowTab = useTabsStore((s) => s.openWorkflowTab)
  const renameTab = useTabsStore((s) => s.renameTab)
  const closeTab = useTabsStore((s) => s.closeTab)
  const [menu, setMenu] = useCtxMenu()
  const [editing, setEditing] = useState(null) // { kind: 'workflow'|'folder', id }
  const [expanded, setExpanded] = useState(() => new Set(workflowFolders.map((f) => f.id)))
  const [newOpen, setNewOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { kind: 'workflow'|'folder', id, name }
  const [defaultFolderId, setDefaultFolderId] = useState(null)

  function toggleFolder(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function wfTeamNames(wf) {
    const ids = wf.teamIds || (wf.teamId ? [wf.teamId] : [])
    return ids.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean).join(', ') || '—'
  }

  // Group workflows by folderId
  const byFolder = {}
  const rootWorkflows = []
  for (const wf of workflows) {
    if (wf.folderId) {
      if (!byFolder[wf.folderId]) byFolder[wf.folderId] = []
      byFolder[wf.folderId].push(wf)
    } else {
      rootWorkflows.push(wf)
    }
  }

  // Color for a workflow: use stored color first, fall back to deterministic hash
  function wfColor(wf) { return wf.color || entityColor(wf.id) }

  // Parse GS workflow name: "01 · Hello World — text_template" → { display: "01 · Hello World", chip: "text_template" }
  function parseWfName(name) {
    const dashIdx = name.indexOf(' — ')
    if (dashIdx === -1) return { display: name, chip: null }
    return { display: name.slice(0, dashIdx), chip: name.slice(dashIdx + 3) }
  }

  function WorkflowRow({ wf }) {
    const color = wfColor(wf)
    const { display, chip } = parseWfName(wf.name)
    const teams = wfTeamNames(wf)
    return (
      <li
        className={`bs-wfcard ${wf.id === activeId ? 'is-active' : ''}`}
        style={{ '--wfc': color }}
        onClick={() => openWorkflowTab(wf.id, wf.name)}
        onDoubleClick={(e) => { e.stopPropagation(); setEditing({ kind: 'workflow', id: wf.id }) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({
            x: e.clientX, y: e.clientY,
            items: [
              { id: 'open', label: 'Open in Tab', icon: LinkIcon, onSelect: () => openWorkflowTab(wf.id, wf.name) },
              { id: 'rename', label: 'Rename', onSelect: () => setEditing({ kind: 'workflow', id: wf.id }) },
              { id: 'dup', label: 'Duplicate', onSelect: () => { const copy = duplicateWorkflow(wf.id); if (copy) openWorkflowTab(copy.id, copy.name) } },
              { separator: true },
              { id: 'del', label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'workflow', id: wf.id, name: wf.name }) },
            ],
          })
        }}
      >
        <div className="bs-wfcard-avatar">
          <WorkflowsIcon style={{ width: 11, height: 11, color: '#fff', opacity: 0.92 }} />
        </div>
        <div className="bs-wfcard-body">
          {editing?.kind === 'workflow' && editing.id === wf.id ? (
            <input
              autoFocus
              className="bs-inline-edit"
              defaultValue={wf.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { const v = e.target.value.trim() || wf.name; renameWorkflow(wf.id, v); renameTab(workflowTabId(wf.id), v); setEditing(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
            />
          ) : (
            <>
              <div className="bs-wfcard-name">{display}</div>
              <div className="bs-wfcard-meta">
                {chip && <span className="bs-wfcard-chip">{chip}</span>}
                {!chip && teams !== '—' && <span className="bs-wfcard-chip">{teams}</span>}
              </div>
            </>
          )}
        </div>
        <button
          className="bs-wfcard-del"
          onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'workflow', id: wf.id, name: wf.name }) }}
          title="Delete workflow"
        >
          <TrashIcon className="bs-ico-xs" />
        </button>
      </li>
    )
  }

  function FolderRow({ folder }) {
    const isOpen = expanded.has(folder.id)
    const folderWorkflows = byFolder[folder.id] || []
    const isGS = folder.id === 'folder_getting_started'
    return (
      <li className="bs-tree" key={folder.id}>
        <div
          className={`bs-folder-row ${isGS ? 'bs-folder-row-gs' : ''}`}
          onClick={() => toggleFolder(folder.id)}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing({ kind: 'folder', id: folder.id }) }}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({
              x: e.clientX, y: e.clientY,
              items: [
                { id: 'add', label: 'New workflow here', icon: PlusIcon, onSelect: () => { setDefaultFolderId(folder.id); setNewOpen(true) } },
                { id: 'rename', label: 'Rename folder', onSelect: () => setEditing({ kind: 'folder', id: folder.id }) },
                { separator: true },
                { id: 'del', label: 'Delete folder', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'folder', id: folder.id, name: folder.name }) },
              ],
            })
          }}
        >
          <ChevronRightIcon className={`bs-ico-xs bs-chevron ${isOpen ? 'is-open' : ''}`} />
          <div className={`bs-folder-icon ${isGS ? 'bs-folder-icon-gs' : ''}`}>
            <FolderIcon style={{ width: 11, height: 11 }} />
          </div>
          <div className="bs-folder-body">
            {editing?.kind === 'folder' && editing.id === folder.id ? (
              <input
                autoFocus
                className="bs-inline-edit"
                defaultValue={folder.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { const v = e.target.value.trim() || folder.name; renameWorkflowFolder(folder.id, v); setEditing(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
              />
            ) : (
              <span className="bs-folder-name">{folder.name}</span>
            )}
          </div>
          <span className={`bs-folder-badge ${isGS ? 'bs-folder-badge-gs' : ''}`}>{folderWorkflows.length}</span>
          <button
            className="bs-folder-del"
            onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'folder', id: folder.id, name: folder.name }) }}
            title="Delete folder"
          >
            <TrashIcon className="bs-ico-xs" />
          </button>
        </div>
        {isOpen && (
          <div className="bs-tree-children">
            <ul className="bs-rows bs-rows-nested bs-rows-wf">
              {folderWorkflows.map((wf) => <WorkflowRow key={wf.id} wf={wf} />)}
              {folderWorkflows.length === 0 && (
                <li className="bs-empty bs-empty-sm">
                  <button className="bs-link" onClick={(e) => { e.stopPropagation(); setDefaultFolderId(folder.id); setNewOpen(true) }}>
                    + Add workflow
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="bs-sec">
      <div className="bs-sec-actions">
        <button
          className="bs-add-btn bs-add-btn-sm"
          onClick={() => setNewFolderOpen(true)}
          title="New folder"
        >
          <FolderIcon className="bs-ico-sm" />
          <span>New folder</span>
        </button>
        <button
          className="bs-add-btn"
          onClick={() => { setDefaultFolderId(workflowFolders[0]?.id || null); setNewOpen(true) }}
        >
          <PlusIcon className="bs-ico-sm" />
          <span>New workflow</span>
        </button>
      </div>

      {newFolderOpen && (
        <div className="bs-inline-form bs-inline-form-sm">
          <input
            autoFocus
            className="bs-input"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                createWorkflowFolder(newFolderName.trim())
                setNewFolderName('')
                setNewFolderOpen(false)
              }
              if (e.key === 'Escape') { setNewFolderName(''); setNewFolderOpen(false) }
            }}
            onBlur={() => {
              if (newFolderName.trim()) createWorkflowFolder(newFolderName.trim())
              setNewFolderName('')
              setNewFolderOpen(false)
            }}
          />
        </div>
      )}

      <ul className="bs-rows bs-rows-wf">
        {workflowFolders.map((f) => <FolderRow key={f.id} folder={f} />)}
        {rootWorkflows.map((wf) => <WorkflowRow key={wf.id} wf={wf} />)}
        {workflows.length === 0 && <li className="bs-empty">No workflows yet.</li>}
      </ul>
      {menu}

      {newOpen && (
        <CreateWorkflowModal
          teams={teams}
          folders={workflowFolders}
          defaultFolderId={defaultFolderId}
          onCancel={() => setNewOpen(false)}
          onCreate={(name, teamIds, fId, color, description) => {
            const wf = createWorkflow(name, teamIds, { folderId: fId, color, description })
            openWorkflowTab(wf.id, wf.name)
            setNewOpen(false)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.kind === 'folder' ? 'Delete folder?' : 'Delete workflow?'}
          message={
            pendingDelete.kind === 'folder'
              ? `"${pendingDelete.name}" will be removed. Workflows inside will move to root (not deleted).`
              : `"${pendingDelete.name}" and all its blocks will be removed. This cannot be undone.`
          }
          confirmLabel={pendingDelete.kind === 'folder' ? 'Delete folder' : 'Delete workflow'}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.kind === 'folder') {
              deleteWorkflowFolder(pendingDelete.id)
            } else {
              closeTab(workflowTabId(pendingDelete.id))
              deleteWorkflow(pendingDelete.id)
            }
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function TeamsPanel() {
  const teams = useWorkspaceStore((s) => s.teams)
  const allPools = useWorkspaceStore((s) => s.agentPools)
  const allAgents = useWorkspaceStore((s) => s.agents)
  const createTeam = useWorkspaceStore((s) => s.createTeam)
  const deleteTeam = useWorkspaceStore((s) => s.deleteTeam)
  const renameTeam = useWorkspaceStore((s) => s.renameTeam)
  const duplicateTeam = useWorkspaceStore((s) => s.duplicateTeam)
  const createAgentPool = useWorkspaceStore((s) => s.createAgentPool)
  const createAgent = useWorkspaceStore((s) => s.createAgent)
  const deleteAgent = useWorkspaceStore((s) => s.deleteAgent)
  const duplicateAgent = useWorkspaceStore((s) => s.duplicateAgent)
  const openTab = useTabsStore((s) => s.openTab)
  const [name, setName] = useState('')
  const [menu, setMenu] = useCtxMenu()
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set(teams.map((t) => t.id)))
  const [pendingDelete, setPendingDelete] = useState(null)

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function getTeamAgents(teamId) {
    return allPools
      .filter((p) => p.teamId === teamId)
      .flatMap((p) => allAgents.filter((a) => a.poolId === p.id))
  }

  function ensurePoolAndCreateAgent(teamId) {
    let pool = allPools.find((p) => p.teamId === teamId)
    if (!pool) pool = createAgentPool(teamId, 'Default Pool')
    const agent = createAgent(pool.id, { name: 'New Agent' })
    openTab({ id: agentTabId(agent.id), kind: 'agent', entityId: agent.id, title: agent.name })
  }

  return (
    <div className="bs-sec">
      <div className="bs-inline-form">
        <input
          className="bs-input"
          placeholder="e.g. fullstack builders"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { createTeam(name.trim()); setName('') } }}
        />
        <button
          className="bs-icon-btn"
          onClick={() => { if (name.trim()) { createTeam(name.trim()); setName('') } }}
          title="Add team"
        >
          <PlusIcon className="bs-ico-sm" />
        </button>
      </div>

      <ul className="bs-tmcards">
        {teams.map((t) => {
          const teamAgents = getTeamAgents(t.id)
          const isOpen = expanded.has(t.id)
          const color = t.color || entityColor(t.id)
          return (
            <li key={t.id} className="bs-tmcard" style={{ '--tmc': color }}>
              <div
                className="bs-tmcard-header"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({
                    x: e.clientX, y: e.clientY,
                    items: [
                      { id: 'open', label: 'Open settings', icon: LinkIcon, onSelect: () => openTab({ id: teamTabId(t.id), kind: 'team', entityId: t.id, title: t.name }) },
                      { id: 'add-agent', label: 'New agent', icon: PlusIcon, onSelect: () => ensurePoolAndCreateAgent(t.id) },
                      { id: 'rename', label: 'Rename', onSelect: () => setEditing(t.id) },
                      { id: 'dup', label: 'Duplicate', onSelect: () => duplicateTeam(t.id) },
                      { separator: true },
                      { id: 'del', label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'team', id: t.id, name: t.name }) },
                    ],
                  })
                }}
              >
                {/* Avatar+name area → opens team tab */}
                <div
                  className="bs-tmcard-main"
                  onClick={() => openTab({ id: teamTabId(t.id), kind: 'team', entityId: t.id, title: t.name })}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditing(t.id) }}
                >
                  <div className="bs-tmcard-avatar">
                    <TeamsIcon style={{ width: 11, height: 11, color: '#fff', opacity: 0.92 }} />
                  </div>
                  <div className="bs-tmcard-body">
                    {editing === t.id ? (
                      <input
                        autoFocus className="bs-inline-edit" defaultValue={t.name}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onBlur={(e) => { renameTeam(t.id, e.target.value.trim() || t.name); setEditing(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(null) }}
                      />
                    ) : (
                      <>
                        <div className="bs-tmcard-name">{t.name}</div>
                        <div className="bs-tmcard-meta">
                          <span className="bs-tmcard-chip">{teamAgents.length} agent{teamAgents.length === 1 ? '' : 's'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Chevron → toggles expand/collapse */}
                <button
                  className="bs-tmcard-toggle"
                  onClick={(e) => { e.stopPropagation(); toggle(t.id) }}
                  title={isOpen ? 'Collapse' : 'Expand'}
                >
                  <ChevronRightIcon className={`bs-ico-xs bs-chevron ${isOpen ? 'is-open' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button
                  className="bs-tmcard-del"
                  onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'team', id: t.id, name: t.name }) }}
                  title="Delete team"
                >
                  <TrashIcon className="bs-ico-xs" />
                </button>
              </div>
              {isOpen && (
                <div className="bs-tmcard-agents">
                  {teamAgents.map((a) => {
                    const aColor = a.color || entityColor(a.id)
                    return (
                      <div
                        key={a.id}
                        className="bs-agrow"
                        style={{ '--agc': aColor }}
                        onClick={() => openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name })}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMenu({
                            x: e.clientX, y: e.clientY,
                            items: [
                              { id: 'open', label: 'Open', icon: LinkIcon, onSelect: () => openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name }) },
                              { id: 'dup', label: 'Duplicate', onSelect: () => duplicateAgent(a.id) },
                              { separator: true },
                              { id: 'del', label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'agent', id: a.id, name: a.name }) },
                            ],
                          })
                        }}
                      >
                        <div className="bs-agrow-avatar">
                          <AgentsIcon style={{ width: 10, height: 10, color: '#fff', opacity: 0.92 }} />
                        </div>
                        <div className="bs-agrow-body">
                          <div className="bs-agrow-name">{a.name}</div>
                          <div className="bs-agrow-meta">{a.model} · {a.attachedSkillIds?.length || 0} skill{(a.attachedSkillIds?.length || 0) === 1 ? '' : 's'}</div>
                        </div>
                        <button
                          className="bs-agrow-del"
                          onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'agent', id: a.id, name: a.name }) }}
                          title="Delete agent"
                        >
                          <TrashIcon className="bs-ico-xs" />
                        </button>
                      </div>
                    )
                  })}
                  {teamAgents.length === 0 && <div className="bs-empty bs-empty-sm">No agents yet.</div>}
                  <div className="bs-add-inline" onClick={() => ensurePoolAndCreateAgent(t.id)}>
                    <PlusIcon className="bs-ico-xs" />
                    <span>Add agent</span>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {teams.length === 0 && <li className="bs-empty">No teams yet.</li>}
      </ul>
      {menu}
      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.kind === 'team' ? 'Delete team?' : 'Delete agent?'}
          message={
            pendingDelete.kind === 'team'
              ? `"${pendingDelete.name}" will be removed. Agents and pools belonging to this team become orphaned.`
              : `"${pendingDelete.name}" will be removed from its pool.`
          }
          confirmLabel={pendingDelete.kind === 'team' ? 'Delete team' : 'Delete agent'}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.kind === 'team') deleteTeam(pendingDelete.id)
            else deleteAgent(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function AgentsPanel() {
  const agents = useWorkspaceStore((s) => s.agents)
  const pools = useWorkspaceStore((s) => s.agentPools)
  const teams = useWorkspaceStore((s) => s.teams)
  const createAgentPool = useWorkspaceStore((s) => s.createAgentPool)
  const createAgent = useWorkspaceStore((s) => s.createAgent)
  const deleteAgent = useWorkspaceStore((s) => s.deleteAgent)
  const deleteAgentPool = useWorkspaceStore((s) => s.deleteAgentPool)
  const duplicateAgent = useWorkspaceStore((s) => s.duplicateAgent)
  const openTab = useTabsStore((s) => s.openTab)

  const [expanded, setExpanded] = useState(() => new Set(pools.map((p) => p.id)))
  const [poolName, setPoolName] = useState('')
  const [poolTeam, setPoolTeam] = useState(teams[0]?.id || '')
  const [agentName, setAgentName] = useState('')
  const [menu, setMenu] = useCtxMenu()
  const [pendingDelete, setPendingDelete] = useState(null)

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="bs-sec">
      <Collapsible title="Create pool" defaultOpen>
        <div className="bs-create-pool-form">
          <input
            className="bs-input"
            placeholder="Pool name"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && poolName.trim()) {
                createAgentPool(poolTeam, poolName.trim())
                setPoolName('')
              }
            }}
          />
          <div className="bs-create-pool-row">
            <StyledSelect
              value={poolTeam}
              options={teams.map((t) => ({ id: t.id, label: t.name }))}
              onChange={(id) => setPoolTeam(id)}
              placeholder="Select team"
              className="bs-create-pool-team"
            />
            <button
              className="bs-icon-btn"
              onClick={() => { if (poolName.trim()) { createAgentPool(poolTeam, poolName.trim()); setPoolName('') } }}
              title="Create pool"
            >
              <PlusIcon className="bs-ico-sm" />
            </button>
          </div>
        </div>
      </Collapsible>

      <div className="bs-pool-groups">
        {pools.map((p) => {
          const poolAgents = agents.filter((a) => a.poolId === p.id)
          const open = expanded.has(p.id)
          const poolColor = entityColor(p.id)
          return (
            <div key={p.id} className="bs-pool-group">
              <div
                className={`bs-pool-head ${open ? 'is-open' : ''}`}
                style={{ '--pc': poolColor }}
                onClick={() => toggle(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({
                    x: e.clientX, y: e.clientY,
                    items: [
                      { id: 'add', label: 'New agent', icon: PlusIcon, onSelect: () => { const a = createAgent(p.id, { name: 'New Agent' }); openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name }) } },
                      { separator: true },
                      { id: 'del', label: 'Delete pool', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'pool', id: p.id, name: p.name }) },
                    ],
                  })
                }}
              >
                <ChevronRightIcon className={`bs-ico-xs bs-chevron ${open ? 'is-open' : ''}`} style={{ color: poolColor }} />
                <span className="bs-pool-name">{p.name}</span>
                <span className="bs-pool-badge">{poolAgents.length}</span>
                <button
                  className="bs-pool-del"
                  onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'pool', id: p.id, name: p.name }) }}
                  title="Delete pool"
                >
                  <TrashIcon className="bs-ico-xs" />
                </button>
              </div>

              {open && (
                <div className="bs-pool-body">
                  <div className="bs-inline-form bs-inline-form-sm">
                    <input
                      className="bs-input"
                      placeholder="New agent name"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && agentName.trim()) {
                          const a = createAgent(p.id, { name: agentName.trim() })
                          openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name })
                          setAgentName('')
                        }
                      }}
                    />
                    <button
                      className="bs-icon-btn"
                      onClick={() => {
                        if (agentName.trim()) {
                          const a = createAgent(p.id, { name: agentName.trim() })
                          openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name })
                          setAgentName('')
                        }
                      }}
                    >
                      <PlusIcon className="bs-ico-sm" />
                    </button>
                  </div>
                  <div className="bs-agcards">
                    {poolAgents.map((a) => {
                      const aColor = a.color || entityColor(a.id)
                      return (
                        <div
                          key={a.id}
                          className="bs-agcard"
                          style={{ '--agc': aColor }}
                          onClick={() => openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name })}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setMenu({
                              x: e.clientX, y: e.clientY,
                              items: [
                                { id: 'open', label: 'Open', icon: LinkIcon, onSelect: () => openTab({ id: agentTabId(a.id), kind: 'agent', entityId: a.id, title: a.name }) },
                                { id: 'dup', label: 'Duplicate', onSelect: () => duplicateAgent(a.id) },
                                { separator: true },
                                { id: 'del', label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ kind: 'agent', id: a.id, name: a.name }) },
                              ],
                            })
                          }}
                        >
                          <div className="bs-agcard-avatar">
                            <AgentsIcon style={{ width: 10, height: 10, color: '#fff', opacity: 0.92 }} />
                          </div>
                          <div className="bs-agcard-body">
                            <div className="bs-agcard-name">{a.name}</div>
                            <div className="bs-agcard-meta">{a.model} · {a.attachedSkillIds?.length || 0} skill{(a.attachedSkillIds?.length || 0) === 1 ? '' : 's'}</div>
                          </div>
                          <button
                            className="bs-agcard-del"
                            onClick={(e) => { e.stopPropagation(); setPendingDelete({ kind: 'agent', id: a.id, name: a.name }) }}
                            title="Delete agent"
                          >
                            <TrashIcon className="bs-ico-xs" />
                          </button>
                        </div>
                      )
                    })}
                    {poolAgents.length === 0 && <div className="bs-empty bs-empty-sm">No agents in this pool.</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {pools.length === 0 && <div className="bs-empty">No pools yet. Create one above.</div>}
      </div>
      {menu}
      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.kind === 'pool' ? 'Delete agent pool?' : 'Delete agent?'}
          message={
            pendingDelete.kind === 'pool'
              ? `"${pendingDelete.name}" will be removed. Agents inside the pool remain, but become orphaned until reassigned.`
              : `"${pendingDelete.name}" will be removed from its pool. Workflows referencing this agent will need to be re-wired.`
          }
          confirmLabel={pendingDelete.kind === 'pool' ? 'Delete pool' : 'Delete agent'}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete.kind === 'pool') deleteAgentPool(pendingDelete.id)
            else deleteAgent(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

function SkillsPanel() {
  const skills = useWorkspaceStore((s) => s.skills)
  const createSkill = useWorkspaceStore((s) => s.createSkill)
  const deleteSkill = useWorkspaceStore((s) => s.deleteSkill)
  const duplicateSkill = useWorkspaceStore((s) => s.duplicateSkill)
  const openTab = useTabsStore((s) => s.openTab)
  const [name, setName] = useState('')
  const [menu, setMenu] = useCtxMenu()
  const [pendingDelete, setPendingDelete] = useState(null) // { id, name }

  return (
    <div className="bs-sec">
      <div className="bs-inline-form">
        <input className="bs-input" placeholder="Skill name" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="bs-icon-btn"
          onClick={() => { if (name.trim()) { const s = createSkill({ name: name.trim() }); openTab({ id: skillTabId(s.id), kind: 'skill', entityId: s.id, title: name.trim() }); setName('') } }}
          title="Add skill"
        >
          <PlusIcon className="bs-ico-sm" />
        </button>
      </div>
      <ul className="bs-rows">
        {skills.map((k) => (
          <li
            key={k.id}
            className="bs-row"
            onClick={() => openTab({ id: skillTabId(k.id), kind: 'skill', entityId: k.id, title: k.name })}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({
                x: e.clientX, y: e.clientY,
                items: [
                  { id: 'edit', label: 'Open editor', icon: LinkIcon, onSelect: () => openTab({ id: skillTabId(k.id), kind: 'skill', entityId: k.id, title: k.name }) },
                  { id: 'dup', label: 'Duplicate', onSelect: () => duplicateSkill(k.id) },
                  { separator: true },
                  { id: 'del', label: 'Delete', icon: TrashIcon, danger: true, onSelect: () => setPendingDelete({ id: k.id, name: k.name }) },
                ],
              })
            }}
          >
            <SkillsIcon className="bs-ico-sm bs-row-lead" />
            <div className="bs-row-main">
              <div className="bs-row-title">{k.name}</div>
              <div className="bs-row-meta">{k.language}</div>
            </div>
            <button className="bs-row-action" onClick={(e) => { e.stopPropagation(); setPendingDelete({ id: k.id, name: k.name }) }} title="Delete"><TrashIcon className="bs-ico-xs" /></button>
          </li>
        ))}
        {skills.length === 0 && <li className="bs-empty">No skills yet.</li>}
      </ul>
      {menu}
      {pendingDelete && (
        <ConfirmModal
          title="Delete skill?"
          message={`"${pendingDelete.name}" will be removed. Agents or workflows that reference this skill will silently skip it on the next run.`}
          confirmLabel="Delete skill"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteSkill(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}

/* =========================================================================
 * Helpers
 * ====================================================================== */

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`bs-collap ${open ? 'is-open' : ''}`}>
      <button className="bs-collap-head" onClick={() => setOpen((o) => !o)}>
        <ChevronRightIcon className={`bs-ico-xs bs-chevron ${open ? 'is-open' : ''}`} />
        <span>{title}</span>
      </button>
      {open && <div className="bs-collap-body">{children}</div>}
    </div>
  )
}

/** Hook returning [rendered menu element, openMenu(state)] */
function useCtxMenu() {
  const [state, setState] = useState(null)
  const node = state ? (
    <ContextMenu x={state.x} y={state.y} items={state.items} onClose={() => setState(null)} />
  ) : null
  return [node, setState]
}
