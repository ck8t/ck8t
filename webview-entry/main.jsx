/**
 * Dedicated entry point for the VS Code extension webview.
 *
 * Mounts ONLY AgentBuilderPage — no routing, no chat panel, no other pages.
 * Vite tree-shakes everything else in convengine-ui so the bundle is lean.
 *
 * CSS load order:
 *  1. src/index.css  — Tailwind + global CSS vars (light/dark tokens)
 *  2. ck8t.css — bs-* prefixed component styles
 */
import '@salilvnair/dui/monaco-setup';
import '@salilvnair/dui/style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import AgentBuilderPage from '../src/ck8t/AgentBuilderPage';
import { loadInstalledBlocks } from '../src/ck8t/blocks/registry';
import { initSnapshotSync, hydrateSnapshot } from '../src/ck8t/stores/snapshot';
import { useMcpProgressStore } from '../src/ck8t/stores/mcp-progress-store';
import { useWorkflowStore } from '../src/ck8t/stores/workflow-store';
import { useWorkspaceStore } from '../src/ck8t/stores/workspace-store';
import { logUiEvent } from '../src/ck8t/audit/ui-audit-store';
import { useAiProvidersStore } from '../src/ck8t/stores/ai-providers-store';

// Apply saved theme before first paint to avoid flash
const savedTheme = localStorage.getItem('convengine_ui_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Load community blocks injected by the extension host (window.__CK8T_BLOCK_DEFS__)
loadInstalledBlocks();

// Handle all messages from the extension host
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'block-defs-updated' && typeof msg.script === 'string') {
    try {
      // eslint-disable-next-line no-new-func
      new Function(msg.script)();
    } catch (e) {
      console.warn('[ck8t] Failed to apply block defs update:', e);
    }
    loadInstalledBlocks();
    return;
  }

  if (msg.type === 'workspaceSnapshot') {
    hydrateSnapshot(msg.payload);
    return;
  }

  if (msg.type === 'snapshotSaved') {
    const ws = useWorkspaceStore.getState();
    const wf = useWorkflowStore.getState();
    const activeWf = ws.workflows?.find(w => w.id === ws.activeWorkflowId);
    logUiEvent('db.save', {
      savedAt:        msg.savedAt,
      workflow:       activeWf?.name || ws.activeWorkflowId || '—',
      workflowId:     ws.activeWorkflowId || null,
      nodeCount:      wf.nodes?.length ?? 0,
      edgeCount:      wf.edges?.length ?? 0,
      workflowCount:  ws.workflows?.length ?? 0,
      skillCount:     ws.skills?.length ?? 0,
      agentCount:     ws.agents?.length ?? 0,
      // Full snapshot data
      nodes:          wf.nodes ?? [],
      edges:          wf.edges ?? [],
      subBlockValues: wf.subBlockValues ?? {},
      workflows:      ws.workflows ?? [],
      skills:         ws.skills ?? [],
      agents:         ws.agents ?? [],
    });
    return;
  }

  if (msg.type === 'mcpProgress') {
    const { setProgress, clearProgress } = useMcpProgressStore.getState();
    if (msg.payload) {
      const nodeId = useWorkflowStore.getState().activeNodeId;
      setProgress({ ...msg.payload, nodeId });
    } else {
      clearProgress();
    }
    return;
  }

  if (msg.type === 'aiKeys:status') {
    useAiProvidersStore.getState().setKeyStatus(msg.status ?? {});
    return;
  }
});

// Signal extension host that webview is ready → triggers snapshot restore
const _vsApi = typeof window !== 'undefined' ? window.__CK8T_VSCODE_API__ : null;
if (_vsApi) {
  _vsApi.postMessage({ type: 'ready' });
}

// Subscribe stores to auto-save snapshots on every change (VS Code only, no-op in browser)
initSnapshotSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgentBuilderPage />
  </React.StrictMode>
);
