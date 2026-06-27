/**
 * Builder Studio WebView panel — hosts the React canvas inside VS Code.
 *
 * The React app is built using `npm run build:webview`
 * (vite.extension.config.js). The built assets live in webview/dist/.
 *
 * At load time the extension:
 *  1. Reads webview/dist/index.html
 *  2. Rewrites all asset src/href to vscode-webview:// URIs
 *  3. Injects window.__CK8T_BRIDGE_BASE__ pointing to the bridge server
 *  4. Replaces the BRIDGE_BASE_PLACEHOLDER sentinel in JS bundles
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { upsert, findById, findAll, remove } from '../storage/db';
import { setMcpProgressHandler } from '../services/mcp';
import { setBlockProgressHandler } from '../services/block-loader';
import { syncToCustomProviders } from '../bridge/routes/ai-providers';
import { deleteCustomProvider } from '../services/custom-providers';
import { storeApiKey, retrieveApiKey, deleteApiKey } from '../services/secret-store';

export class Ck8tPanel {
  public static currentPanel: Ck8tPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, bridgePort: number) {
    this._panel       = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtml(bridgePort);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview (future: postMessage bridge)
    this._panel.webview.onDidReceiveMessage(
      (msg) => this._handleMessage(msg),
      undefined,
      this._disposables,
    );

    // Proactively push block defs 800ms after panel creation.
    // By then the webview's window.addEventListener('message',...) is live,
    // so this guaranteed delivery supplements the inline-script injection.
    // This fires regardless of whether the webview sends 'ready'.
    setTimeout(() => {
      try {
        const script = this._buildBlockDefsScript();
        this._panel.webview.postMessage({ type: 'block-defs-updated', script });
      } catch (_) {}
    }, 800);

    // Forward MCP progress events (tqdm steps from Python subprocess) to the webview
    setMcpProgressHandler((event) => {
      try { this._panel.webview.postMessage({ type: 'mcpProgress', payload: event }); } catch { /* panel may be disposed */ }
    });

    // Forward community block progress events to the webview
    setBlockProgressHandler((nodeId, data) => {
      try { this._panel.webview.postMessage({ type: 'mcpProgress', payload: data ? { nodeId, ...data } : null }); } catch { /* panel may be disposed */ }
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, bridgePort: number) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (Ck8tPanel.currentPanel) {
      Ck8tPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ck8t',
      '⚡ CK8T',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
          vscode.Uri.file(path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks')),
        ],
        retainContextWhenHidden: true, // keep React state when panel is hidden
      },
    );

    Ck8tPanel.currentPanel = new Ck8tPanel(panel, extensionUri, bridgePort);
  }

  /** Update the bridge port (e.g. if the server restarts) */
  public updateBridgePort(bridgePort: number) {
    this._panel.webview.html = this._getHtml(bridgePort);
  }

  private _getHtml(bridgePort: number): string {
    const distPath   = path.join(this._extensionUri.fsPath, 'webview', 'dist');
    // Vite preserves the input directory structure: webview-entry/index.html → dist/webview-entry/index.html.
    // htmlDir must point at the HTML file's containing directory so that relative
    // paths like "../assets/index-HASH.js" resolve to dist/assets/ correctly.
    const htmlDir    = path.join(distPath, 'webview-entry');
    const indexPath  = path.join(htmlDir, 'index.html');

    if (!fs.existsSync(indexPath)) {
      // Wrong build detected: npm run vscode uses vite.extension.config.js which
      // outputs webview-entry/index.html here.  npm run ui (wrong!) outputs
      // dist/index.html which then gets copied to webview/dist/index.html — that
      // path is never checked by this panel.
      const wrongPath = path.join(distPath, 'index.html');
      const wrongBuild = fs.existsSync(wrongPath);
      return this._placeholderHtml(bridgePort, wrongBuild);
    }

    const webview        = this._panel.webview;
    const bridgeBase     = `http://127.0.0.1:${bridgePort}/api/v1`;
    let html             = fs.readFileSync(indexPath, 'utf8');

    // Rewrite relative (./  ../  /assets/) asset paths to vscode-resource:// URIs.
    // Assets are at dist/assets/ but the HTML lives in dist/webview-entry/, so
    // Vite emits  ../assets/  paths.  path.resolve handles all three prefixes.
    html = html.replace(/(src|href)="((?:\.\.\/|\.\/|\/)[^"]+)"/g, (_match, attr: string, assetPath: string) => {
      let filePath: string;
      if (assetPath.startsWith('/')) {
        filePath = path.join(distPath, assetPath.slice(1));
      } else {
        filePath = path.resolve(htmlDir, assetPath);
      }
      const resourceUri = webview.asWebviewUri(vscode.Uri.file(filePath));
      return `${attr}="${resourceUri}"`;
    });

    // Remove 'crossorigin' attribute — vscode-resource:// URIs don't need CORS
    html = html.replace(/\s+crossorigin/g, '');

    // Read installed community block UI files on the Node.js side and inject
    // their object literals as an inline script — no dynamic import() needed,
    // which avoids cross-origin restrictions in the webview sandbox.
    const blockDefsScript = this._buildBlockDefsScript();

    // Inject runtime config BEFORE the module script tag so that
    // window.__CK8T_BLOCK_DEFS__ is populated when loadInstalledBlocks()
    // runs inside the deferred module bundle.
    const injectScript = `<script>
  globalThis.__CK8T_BRIDGE_BASE__ = '${bridgeBase}';
  window.__CK8T_MODE__ = 'vscode-extension';
  try { window.__CK8T_VSCODE_API__ = acquireVsCodeApi(); } catch(e) {}
</script>
<script>${blockDefsScript}</script>`;
    // Prefer injecting right before the <script type="module"> tag so the
    // inline scripts execute synchronously before any deferred module executes.
    // Fall back to before </head> if the pattern is not found.
    if (/<script\s[^>]*type="module"/.test(html)) {
      html = html.replace(/(<script\s[^>]*type="module")/, `${injectScript}\n$1`);
    } else {
      html = html.replace('</head>', `${injectScript}\n</head>`);
    }

    // CSP — allow the bridge server origin and external https for skill fetch() calls
    const csp = [
      `default-src 'none'`,
      `script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'`,
      `style-src  ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src   ${webview.cspSource} data: https://fonts.gstatic.com`,
      `img-src    ${webview.cspSource} data: https: blob:`,
      // Allow bridge server AND external URLs (needed for skill blocks that call fetch())
      `connect-src http://127.0.0.1:${bridgePort} ws://127.0.0.1:${bridgePort} https: http:`,
    ].join('; ');

    html = html.replace(
      /<meta http-equiv="Content-Security-Policy"[^>]*>/,
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    );
    // If no CSP meta tag exists, insert one
    if (!html.includes('Content-Security-Policy')) {
      html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    }

    return html;
  }

  private _buildBlockDefsScript(): string {
    const dir = path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks');
    const defs: Record<string, string> = {};

    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(dir, entry.name, 'ck8t-block.json');
        if (!fs.existsSync(manifestPath)) continue;

        let manifest: { blocks?: { type: string; ui: string }[] };
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { continue; }

        for (const blk of manifest.blocks ?? []) {
          if (!blk.ui || !blk.type) continue;
          const filePath = path.join(dir, entry.name, blk.ui);
          if (!fs.existsSync(filePath)) continue;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const objSrc = content
              .replace(/^[\s\S]*?export\s+default\s+/, '')
              .trimEnd()
              .replace(/;?\s*$/, '');
            defs[blk.type] = Buffer.from(objSrc, 'utf-8').toString('base64');
          } catch { /* skip unreadable */ }
        }
      }
    }

    // JSON.stringify guarantees no </script> injection; atob + new Function
    // evaluates each block with full syntax error isolation per block.
    return `(function(){
var _d=${JSON.stringify(defs)};
window.__CK8T_BLOCK_DEFS__={};
for(var k in _d){try{window.__CK8T_BLOCK_DEFS__[k]=new Function('return('+atob(_d[k])+')')();console.log('[ck8t] block def loaded:',k,'run:',typeof window.__CK8T_BLOCK_DEFS__[k].run);}catch(e){console.error('[ck8t] block load failed:',k,e);}}
console.log('[ck8t] __CK8T_BLOCK_DEFS__ ready:',Object.keys(window.__CK8T_BLOCK_DEFS__));
})();`;
  }

  private _placeholderHtml(bridgePort: number, wrongBuild = false): string {
    const heading = wrongBuild ? '⚠️ Wrong build used' : '⚡ Webview not built yet';
    const detail  = wrongBuild
      ? `<p style="color:#f97316;margin-top:8px"><strong>npm run ui</strong> was used — it outputs to the wrong path.<br>This panel requires <strong>npm run vscode</strong>.</p>`
      : `<p style="margin-top:8px">No webview build found.</p>`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CK8T</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, sans-serif);
      color: var(--vscode-foreground, #ccc);
      background: var(--vscode-editor-background, #1e1e1e);
      display: flex; align-items: center; justify-content: center;
      height: 100vh; flex-direction: column; gap: 16px; text-align: center;
    }
    h2 { font-size: 1.4rem; font-weight: 600; margin-top: 12px; }
    p  { opacity: 0.75; font-size: 0.9rem; }
    code {
      background: var(--vscode-textBlockQuote-background, #2d2d2d);
      border: 1px solid var(--vscode-panel-border, #444);
      padding: 6px 14px; border-radius: 6px; font-size: 0.9rem;
      display: block; margin-top: 6px; font-family: monospace;
    }
  </style>
</head>
<body>
  <div>
    <h2>${heading}</h2>
    ${detail}
    <p style="margin-top:16px">Run the correct build command:</p>
    <code>cd ck8t &amp;&amp; npm run vscode</code>
    <p style="margin-top:12px">Then reload: <em>Cmd+Shift+P → Developer: Reload Window</em></p>
    <p style="margin-top:24px;font-size:0.75rem;opacity:0.4">Bridge port ${bridgePort} · expects webview/dist/webview-entry/index.html</p>
  </div>
</body>
</html>`;
  }

  private _handleMessage(msg: { type: string; payload?: unknown }) {
    switch (msg.type) {
      case 'ping':
        this._panel.webview.postMessage({ type: 'pong' });
        break;
      case 'reloadWindow':
        vscode.commands.executeCommand('workbench.action.reloadWindow');
        break;
      case 'ready': {
        // Webview is ready — send back the persisted snapshot so the UI can restore itself
        const snapshot = findById<object>('workspace_snapshot', 'main');
        if (snapshot) {
          this._panel.webview.postMessage({ type: 'workspaceSnapshot', payload: snapshot });
        }
        // Belt-and-suspenders: push block defs again now that the webview JS is
        // fully booted. This guarantees community block runners are registered
        // even if the initial inline <script> evaluation failed silently.
        const script = this._buildBlockDefsScript();
        this._panel.webview.postMessage({ type: 'block-defs-updated', script });
        // Push initial key status so the AI Providers panel shows correct state immediately
        this._refreshKeyStatus();
        break;
      }
      case 'saveWorkspaceSnapshot': {
        if (msg.payload) {
          upsert('workspace_snapshot', 'main', msg.payload as object);
          try {
            this._panel.webview.postMessage({ type: 'snapshotSaved', savedAt: new Date().toISOString() });
          } catch { /* panel may be disposed */ }
        }
        break;
      }
      case 'blocks-changed': {
        // After install/uninstall, push updated block defs so the palette refreshes
        // without needing a full window reload.
        const script = this._buildBlockDefsScript();
        this._panel.webview.postMessage({ type: 'block-defs-updated', script });
        break;
      }
      case 'aiKeys:save': {
        const { providerId, token, name, baseUrl } = msg as { type: string; providerId: string; token: string; name?: string; baseUrl?: string };
        if (providerId && token) {
          const trimmed = token.trim();
          (async () => {
            try {
              await storeApiKey(providerId, trimmed);
              const CONFIG_COL = 'ai_provider_configs';
              const KEYS_COL   = 'ai_provider_keys';
              upsert(KEYS_COL, providerId, { id: providerId }); // presence marker only — no key material
              const cfg = findById<{ name?: string; baseUrl?: string; models?: { id: string; name?: string; enabled?: boolean }[] }>(CONFIG_COL, providerId);
              const resolvedName    = name ?? cfg?.name ?? providerId;
              const resolvedBaseUrl = baseUrl ?? cfg?.baseUrl ?? '';
              await syncToCustomProviders(providerId, resolvedName, resolvedBaseUrl, trimmed, cfg?.models);
            } catch { /* routing sync is best-effort */ }
            this._refreshKeyStatus();
          })();
        }
        break;
      }
      case 'aiKeys:delete': {
        const { providerId: delId } = msg as { type: string; providerId: string };
        if (delId) {
          (async () => {
            try {
              await deleteApiKey(delId);
              const KEYS_COL = 'ai_provider_keys';
              remove(KEYS_COL, delId);
              try { await deleteCustomProvider(delId); } catch { /* ok */ }
            } catch { /* best-effort */ }
            this._refreshKeyStatus();
          })();
        }
        break;
      }
      case 'aiKeys:load': {
        this._refreshKeyStatus();
        break;
      }

      // ─── Block Debugger ─────────────────────────────────────────────────────
      case 'blockDebug:getFiles': {
        const { blockType, nodeId } = msg as { type: string; blockType: string; nodeId: string };
        this._sendBlockDebugFiles(blockType, nodeId);
        break;
      }
      case 'saveFile': {
        const { filename, content, format, filePath: srcFilePath, destPath: rawDestPath } = msg.payload as {
          filename?: string; content?: string; format?: string; filePath?: string; destPath?: string | null;
        };

        // Resolve ~ in destPath to the real home directory
        const destPath = rawDestPath
          ? rawDestPath.replace(/^~(?=[\\/])/, os.homedir())
          : null;

        // Helper: auto-save to destPath without a dialog
        const autoSave = (writeFn: (resolved: string) => void) => {
          try {
            fs.mkdirSync(path.dirname(destPath!), { recursive: true });
            writeFn(destPath!);
          } catch (err: unknown) {
            vscode.window.showErrorMessage(`Auto-save failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        };

        // Sentinel path — copy temp file to destPath or show dialog
        if (srcFilePath) {
          if (destPath) {
            autoSave((dest) => {
              fs.copyFile(srcFilePath, dest, (err) => {
                if (err) vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
                else vscode.window.showInformationMessage(`Saved to ${dest}`);
              });
            });
          } else {
            const ext = (filename || srcFilePath).split('.').pop()?.toLowerCase() || 'bin';
            const filters: Record<string, string[]> = { [ext.toUpperCase()]: [ext], 'All Files': ['*'] };
            vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(filename || path.basename(srcFilePath)),
              filters,
            }).then((uri) => {
              if (!uri) return;
              fs.copyFile(srcFilePath, uri.fsPath, (err) => {
                if (err) vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
                else vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
              });
            });
          }
          break;
        }

        const ext = (filename || 'output.json').split('.').pop()?.toLowerCase() || 'json';
        const isBinary = format === 'pdf' || format === 'binary' || ['pdf', 'png', 'jpg', 'jpeg', 'bin'].includes(ext);

        const doWrite = (dest: string) => {
          if (isBinary) {
            const buf = Buffer.from(content ?? '', 'base64');
            fs.writeFile(dest, buf, (err) => {
              if (err) vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
              else vscode.window.showInformationMessage(`Saved to ${dest}`);
            });
          } else {
            fs.writeFile(dest, content ?? '', 'utf8', (err) => {
              if (err) vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
              else vscode.window.showInformationMessage(`Saved to ${dest}`);
            });
          }
        };

        if (destPath) {
          autoSave(doWrite);
        } else {
          const filterMap: Record<string, string[]> = {
            json: ['json'], txt: ['txt'], pdf: ['pdf'], csv: ['csv'], xlsx: ['xlsx'], xls: ['xls'],
            png: ['png'], jpg: ['jpg', 'jpeg'], bin: ['bin'],
          };
          const filters: Record<string, string[]> = { [ext.toUpperCase()]: filterMap[ext] || [ext], 'All Files': ['*'] };
          vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(filename || 'output.json'),
            filters,
          }).then((uri) => {
            if (!uri) return;
            doWrite(uri.fsPath);
          });
        }
        break;
      }
    }
  }

  // ─── Block Debugger helpers ──────────────────────────────────────────────

  private _sendBlockDebugFiles(blockType: string, nodeId: string): void {
    const files: { name: string; path: string; content: string; runnerType: string }[] = [];

    try {
      // ── 1. Check if it's a CORE block (in the ck8t source tree) ─────────────
      // Extension lives at: <workspace>/extension/vscode/ck8t
      // Core blocks live at: <workspace>/src/ck8t/blocks/<blockType>
      const extensionRoot = this._extensionUri.fsPath; // e.g. /.../ck8t/extension/vscode/ck8t
      const workspaceRoot = path.resolve(extensionRoot, '..', '..', '..'); // /.../ck8t
      const coreBlockDir = path.join(workspaceRoot, 'src', 'ck8t', 'blocks', blockType);
      const coreManifestPath = path.join(coreBlockDir, 'ck8t-block.json');

      if (fs.existsSync(coreManifestPath)) {
        // It's a core block
        const manifest = JSON.parse(fs.readFileSync(coreManifestPath, 'utf-8'));
        const runners: Record<string, string> = manifest.runners ?? {};
        const runnerMap: Record<string, string> = { client: 'client', extension: 'extension', server: 'server' };
        for (const [key, label] of Object.entries(runnerMap)) {
          const relPath: string = runners[key];
          if (!relPath) continue;
          const filePath = path.join(coreBlockDir, relPath);
          if (!fs.existsSync(filePath)) continue;
          files.push({ name: path.basename(filePath), path: filePath, content: fs.readFileSync(filePath, 'utf-8'), runnerType: label });
        }
        // Also include UI file(s) so the user can see the full block definition
        const blockDefs: { ui?: string }[] = manifest.blocks ?? [];
        for (const bd of blockDefs) {
          if (!bd.ui) continue;
          const filePath = path.join(coreBlockDir, bd.ui);
          if (!fs.existsSync(filePath)) continue;
          const fileName = path.basename(filePath);
          if (!files.some(f => f.name === fileName)) {
            files.push({ name: fileName, path: filePath, content: fs.readFileSync(filePath, 'utf-8'), runnerType: 'ui' });
          }
        }
        this._panel.webview.postMessage({ type: 'blockDebug:files', blockType, nodeId, files });
        return;
      }

      // ── 2. Community block — scan installed blocks directory ─────────────────
      const communityBlocksDir = path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks');
      let blockDir: string | null = null;

      if (fs.existsSync(communityBlocksDir)) {
        const entries = fs.readdirSync(communityBlocksDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const manifestPath = path.join(communityBlocksDir, entry.name, 'ck8t-block.json');
          if (!fs.existsSync(manifestPath)) continue;
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const blockDefs: { type?: string }[] = manifest.blocks ?? [];
            if (blockDefs.some(b => b.type === blockType)) {
              blockDir = path.join(communityBlocksDir, entry.name);
              break;
            }
          } catch { /* skip malformed manifests */ }
        }
      }

      if (!blockDir) {
        this._panel.webview.postMessage({ type: 'blockDebug:files', blockType, nodeId, files: [] });
        return;
      }

      const manifestPath = path.join(blockDir, 'ck8t-block.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const runners: Record<string, string> = manifest.runners ?? {};
      const runnerMap: Record<string, string> = { server: 'server', extension: 'extension', client: 'client' };
      for (const [key, label] of Object.entries(runnerMap)) {
        const filename: string = runners[key];
        if (!filename) continue;
        const filePath = path.join(blockDir, filename);
        if (!fs.existsSync(filePath)) continue;
        files.push({ name: filename, path: filePath, content: fs.readFileSync(filePath, 'utf-8'), runnerType: label });
      }

      // Include UI files referenced in block defs
      const blockDefs: { ui?: string }[] = manifest.blocks ?? [];
      for (const bd of blockDefs) {
        if (!bd.ui) continue;
        const filePath = path.join(blockDir, bd.ui);
        if (!fs.existsSync(filePath)) continue;
        if (!files.some(f => f.name === bd.ui)) {
          files.push({ name: bd.ui!, path: filePath, content: fs.readFileSync(filePath, 'utf-8'), runnerType: 'ui' });
        }
      }
    } catch (err) {
      console.error('[Ck8tPanel] blockDebug:getFiles error', err);
    }

    this._panel.webview.postMessage({ type: 'blockDebug:files', blockType, nodeId, files });
  }

  private async _refreshKeyStatus(): Promise<void> {
    try {
      const KEYS_COL = 'ai_provider_keys';
      const records = findAll<{ id: string; key?: string }>(KEYS_COL);
      const status: Record<string, boolean> = {};
      for (const record of records) {
        let secretVal = await retrieveApiKey(record.id);
        if (!secretVal && record.key) {
          // Legacy record still carrying the plaintext key — migrate it into
          // SecretStorage and scrub the SQLite copy so it never lingers.
          await storeApiKey(record.id, record.key).catch(() => {});
          upsert(KEYS_COL, record.id, { id: record.id });
          secretVal = record.key;
        }
        status[record.id] = !!secretVal;
      }
      try { this._panel.webview.postMessage({ type: 'aiKeys:status', status }); } catch { /* panel may be disposed */ }
    } catch {
      try { this._panel.webview.postMessage({ type: 'aiKeys:status', status: {} }); } catch { /* ok */ }
    }
  }

  public dispose() {
    setMcpProgressHandler(null);
    setBlockProgressHandler(null);
    Ck8tPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
