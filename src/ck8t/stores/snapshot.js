/**
 * Workspace snapshot sync for the VS Code extension webview.
 *
 * On every meaningful change in workspace-store or tabs-store, debounces a
 * postMessage to the extension host, which persists it to SQLite.
 * On panel reopen, the extension host sends back the saved snapshot and
 * hydrateSnapshot() restores the full UI state.
 *
 * No-op in browser / standalone mode (no VS Code API available).
 */
import { useWorkspaceStore } from './workspace-store'
import { useTabsStore } from './tabs-store'
import { useUiStateStore } from './ui-state-store'
import { useWorkflowStore } from './workflow-store'

const DEBOUNCE_MS = 200

let _debounceTimer = null
let _unsubWorkspace = null
let _unsubTabs = null
let _unsubUi = null
let _unsubWorkflow = null

function getVsCodeApi() {
  return typeof window !== 'undefined' ? window.__CK8T_VSCODE_API__ : null
}

function _buildSnapshotPayload() {
  const ws = useWorkspaceStore.getState()
  const tb = useTabsStore.getState()
  const ui = useUiStateStore.getState()
  return {
    workspace: {
      activeWorkspaceId: ws.activeWorkspaceId,
      activeWorkflowId:  ws.activeWorkflowId,
      workspaces:        ws.workspaces,
      teams:             ws.teams,
      agentPools:        ws.agentPools,
      agents:            ws.agents,
      skills:            ws.skills,
      workflows:         ws.workflows,
    },
    tabs: {
      tabs:               tb.tabs,
      activeId:           tb.activeId,
      pinnedWorkflowTabId: tb.pinnedWorkflowTabId,
    },
    ui: ui.getSnapshot(),
  }
}

export function scheduleSnapshotSave() {
  const vsApi = getVsCodeApi()
  if (!vsApi) return
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    vsApi.postMessage({ type: 'saveWorkspaceSnapshot', payload: _buildSnapshotPayload() })
  }, DEBOUNCE_MS)
}

/** Immediately flush the snapshot — use for critical actions (import, delete). */
export function flushSnapshot() {
  const vsApi = getVsCodeApi()
  if (!vsApi) return
  clearTimeout(_debounceTimer)
  _debounceTimer = null
  vsApi.postMessage({ type: 'saveWorkspaceSnapshot', payload: _buildSnapshotPayload() })
}

/**
 * Restore workspace + tabs from a saved snapshot.
 * Called when the extension host sends `workspaceSnapshot` on panel open.
 */
export function hydrateSnapshot(snapshot) {
  if (!snapshot) return
  if (snapshot.workspace) {
    useWorkspaceStore.setState(snapshot.workspace)

    // CRITICAL: also update workflow-store directly with the saved canvas nodes.
    // AgentBuilderPage has a ref-guard ("already loaded — skip") keyed on
    // activeWorkflowId. If the ID didn't change between initial render and
    // hydration, the guard blocks a reload and workflow-store keeps the seed
    // nodes. The nodes useEffect then calls saveWorkflow() and OVERWRITES the
    // user's saved nodes with the seed nodes before the next snapshot fires.
    // Updating workflow-store here bypasses the guard entirely.
    const { activeWorkflowId, workflows } = snapshot.workspace
    if (activeWorkflowId && Array.isArray(workflows)) {
      const wf = workflows.find((w) => w.id === activeWorkflowId)
      if (wf) {
        useWorkflowStore.getState().loadWorkflow({
          nodes:          wf.nodes          || [],
          edges:          wf.edges          || [],
          subBlockValues: wf.subBlockValues || {},
        })
      }
    }
  }
  if (snapshot.tabs?.tabs?.length > 0) {
    useTabsStore.setState({
      tabs:               snapshot.tabs.tabs,
      activeId:           snapshot.tabs.activeId   || null,
      pinnedWorkflowTabId: snapshot.tabs.pinnedWorkflowTabId || null,
    })
  }
  if (snapshot.ui) {
    useUiStateStore.getState().setPanelState(snapshot.ui)
  }
}

/**
 * Subscribe to store changes and start auto-saving snapshots.
 * Call once after app bootstrap (VS Code extension only).
 */
export function initSnapshotSync() {
  if (!getVsCodeApi()) return
  if (_unsubWorkspace) _unsubWorkspace()
  if (_unsubTabs) _unsubTabs()
  if (_unsubUi) _unsubUi()
  if (_unsubWorkflow) _unsubWorkflow()
  _unsubWorkspace = useWorkspaceStore.subscribe(() => scheduleSnapshotSave())
  _unsubTabs      = useTabsStore.subscribe(() => scheduleSnapshotSave())
  _unsubUi        = useUiStateStore.subscribe(() => scheduleSnapshotSave())
  // Eagerly commit canvas nodes/edges into workspace-store whenever they change
  // so the snapshot always has the latest canvas state — even if VS Code is killed
  // before the AgentBuilderPage 400ms debounce fires.
  _unsubWorkflow = useWorkflowStore.subscribe((state, prev) => {
    if (
      state.nodes === prev.nodes &&
      state.edges === prev.edges &&
      state.subBlockValues === prev.subBlockValues
    ) return
    const { activeWorkflowId, saveWorkflow } = useWorkspaceStore.getState()
    if (activeWorkflowId) {
      saveWorkflow(activeWorkflowId, {
        nodes: state.nodes,
        edges: state.edges,
        subBlockValues: state.subBlockValues,
      })
    }
  })

  // Flush immediately when the webview is about to be torn down.
  function _emergencyFlush() {
    const { nodes, edges, subBlockValues } = useWorkflowStore.getState()
    const { activeWorkflowId, saveWorkflow } = useWorkspaceStore.getState()
    if (activeWorkflowId) saveWorkflow(activeWorkflowId, { nodes, edges, subBlockValues })
    flushSnapshot()
  }
  // beforeunload — fires on VS Code "Reload Window" and some VS Code closes
  window.addEventListener('beforeunload', _emergencyFlush, { once: true })
  // visibilitychange — fires when VS Code hides/suspends the webview panel
  // (panel switched, window loses focus before close, etc.)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _emergencyFlush()
  })
  // pagehide — additional safety net for non-beforeunload teardowns
  window.addEventListener('pagehide', _emergencyFlush, { once: true })
}
