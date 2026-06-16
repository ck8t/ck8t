/**
 * VS Code extension entry point for CK8T — Agentic UI Builder.
 *
 * On activate():
 *  1. Starts the Express bridge server on a random free port
 *  2. Initialises SQLite storage (workspace, MCP configs, deployments)
 *  3. Restores any persisted cron/webhook deployments
 *  4. Registers the `bs.start` command
 *  5. Registers the `@bs` chat participant
 */
import * as vscode from 'vscode';
import { startBridgeServer, stopBridgeServer } from './bridge/server';
import { Ck8tPanel } from './panel/Ck8tPanel';
import { WikiViewProvider } from './panel/WikiViewProvider';
import { registerChatParticipant } from './chat/participant';
import { initDb, closeDb } from './storage/db';
import { initSecretStore, migrateLegacyApiKeys } from './services/secret-store';
import { initWorkspaceService } from './services/workspace';
import { initMcpService, disposeMcpService } from './services/mcp';
import { initScheduler, disposeAll as disposeScheduler } from './engine/scheduler';
import { callAgentViaCopilot } from './services/llm';
import { loadActiveFamilyFromDb } from './bridge/routes/provider';
import { resyncAllCustomProviders } from './bridge/routes/ai-providers';
import { initConfigService } from './bridge/routes/config';
import { callTool } from './services/mcp';
import { initBlockLoader } from './services/block-loader';
import { initAuditPersistence } from './bridge/audit';

let _bridgePort: number | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const storagePath = context.globalStorageUri.fsPath;

  /* ── 1. Init file-based store ── */
  await initDb(storagePath, context.extensionUri.fsPath);
  initSecretStore(context.secrets); // API keys live in the OS keychain, never in SQLite
  await migrateLegacyApiKeys();     // one-time sweep: scrub any plaintext keys left by earlier builds
  await resyncAllCustomProviders(); // backfill cachedModels for providers configured before this existed
  loadActiveFamilyFromDb();   // restore persisted default model selection
  initWorkspaceService(storagePath);
  initMcpService(storagePath);
  initConfigService(storagePath);
  initAuditPersistence(200);  // load persisted audit entries from SQLite
  initBlockLoader(); // load community blocks from ~/.salilvnair/ck8t/blocks/

  /* ── 2. Init scheduler (restores cron/webhook deployments from DB) ── */
  initScheduler(
    storagePath,
    callAgentViaCopilot as (req: unknown) => Promise<unknown>,
    callTool,
  );

  /* ── 3. Start bridge server ── */
  try {
    _bridgePort = await startBridgeServer();
  } catch (err: unknown) {
    vscode.window.showErrorMessage(
      `CK8T: Failed to start bridge server — ${err instanceof Error ? err.message : String(err)}`,
      
    );
    return;
  }

  /* ── 4. Register commands ── */
  context.subscriptions.push(
    vscode.commands.registerCommand('bs.start', () => {
      Ck8tPanel.createOrShow(context.extensionUri, _bridgePort!);
    }),
  );

  /* ── Activity bar icon — opens the editor panel, sidebar stays open ── */
  const canvasTreeView = vscode.window.createTreeView('bs.canvasView', {
    treeDataProvider: { getTreeItem: (e) => e, getChildren: () => [] },
  });
  context.subscriptions.push(canvasTreeView);

  /* ── Wiki reference sidebar panel ── */
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WikiViewProvider.viewId, new WikiViewProvider()),
  );

  context.subscriptions.push(
    canvasTreeView.onDidChangeVisibility((e) => {
      if (!e.visible) return;
      // Open the panel (no-op if already open) then focus the editor area.
      // We intentionally do NOT close the sidebar — closing it causes the
      // open→close animation flicker and deselects the activity bar icon.
      Ck8tPanel.createOrShow(context.extensionUri, _bridgePort!);
      vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bs.stopBridge', () => {
      stopBridgeServer();
      vscode.window.showInformationMessage('CK8T: Bridge server stopped.');
    }),
  );

  /* ── 5. Register @bs chat participant ── */
  registerChatParticipant(context, _bridgePort);

  /* ── Status bar item ── */
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.text  = `$(zap) CK8T :${_bridgePort}`;
  statusItem.tooltip = 'Click to open CK8T canvas';
  statusItem.command = 'bs.start';
  statusItem.show();
  context.subscriptions.push(statusItem);

  console.log(`[ck8t] Extension activated. Bridge: http://127.0.0.1:${_bridgePort}`);
}

export function deactivate() {
  disposeMcpService(); // kill any running stdio subprocesses
  disposeScheduler();  // stop all in-process cron timers
  stopBridgeServer();
  closeDb();           // flush sql.js in-memory DB to disk before process exits
  console.log('[ck8t] Extension deactivated.');
}
