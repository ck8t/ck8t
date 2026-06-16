import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AgentBuilderPage from './ck8t/AgentBuilderPage';
import { loadInstalledBlocks } from './ck8t/blocks/registry';
import { initSnapshotSync, hydrateSnapshot } from './ck8t/stores/snapshot';

// Apply saved theme before first paint
const savedTheme = localStorage.getItem('convengine_ui_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Load community blocks from ~/.salilvnair/ck8t/blocks/ on startup
loadInstalledBlocks();

// Extension-host message dispatcher
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  // Block defs pushed after install/uninstall — eval then re-register runners.
  if (msg.type === 'block-defs-updated' && typeof msg.script === 'string') {
    try {
      // eslint-disable-next-line no-new-func
      new Function(msg.script)();
    } catch (e) {
      console.warn('[ck8t] Failed to apply block defs update:', e);
    }
    loadInstalledBlocks();
  }

  // Workspace snapshot sent by the extension host on panel open.
  // Restores the full canvas/tabs/UI state from SQLite.
  if (msg.type === 'workspaceSnapshot' && msg.payload) {
    hydrateSnapshot(msg.payload);
  }
});

if (typeof window !== 'undefined' && window.__CK8T_VSCODE_API__) {
  // Wire up auto-save subscriptions (workspace-store → SQLite via postMessage).
  // Must be called before posting 'ready' so subscriptions are live before any
  // state mutation can fire (avoids a missed-first-save race).
  initSnapshotSync();

  // Tell the extension host the webview JS is fully booted.
  // The extension responds with 'workspaceSnapshot' (handled above) and
  // 'block-defs-updated' to guarantee community runners are registered.
  try { window.__CK8T_VSCODE_API__.postMessage({ type: 'ready' }); } catch (_e) {}
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AgentBuilderPage />
  </React.StrictMode>
);
