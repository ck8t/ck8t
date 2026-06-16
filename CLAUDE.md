# CK8T — Mandatory Rules for Claude

## Build Commands (3 only — no others exist)

| Command | Vite Config | Entry Point | Output |
|---|---|---|---|
| `npm run ui` | `vite.config.js` | `index.html` → `src/main.jsx` | `dist/` |
| `npm run vscode` | `vite.extension.config.js` | `webview-entry/index.html` → `webview-entry/main.jsx` | `extension/vscode/ck8t/webview/dist/` |
| `npm run server` | — | `ck8t-server/src/server.ts` | — |

### CRITICAL — Never mix these up:
- `npm run ui` is for the **web dev server only**. It outputs to `dist/`. Do NOT use it to build the extension.
- `npm run vscode` is the **only** correct way to build the VS Code extension webview. It MUST use `vite.extension.config.js`.
- `Ck8tPanel._getHtml()` expects `webview/dist/webview-entry/index.html`. Only `vite.extension.config.js` produces this.
- After ANY change to `src/`, `webview-entry/`, or `extension/vscode/ck8t/src/`, run `npm run vscode` to rebuild.

## Entry Points — Two Separate Files, Never Swap

| File | Used By | Purpose |
|---|---|---|
| `src/main.jsx` | `npm run ui` (web only) | Standalone web dev server |
| `webview-entry/main.jsx` | `npm run vscode` (extension) | VS Code extension webview — has MCP progress, snapshot sync, vsApi |

Changes to **extension-only behavior** (MCP progress, snapshot hydration, vsApi messaging) go in `webview-entry/main.jsx`.
Changes to **shared UI** (components, stores, blocks) go in `src/ck8t/...` (both entry points import from here).

## Community Block Rule (CRITICAL)

ALWAYS edit blocks in the SOURCE repo:
- `/Users/salilvnair/workspace/git/ck8t/<block-name>/`

NEVER edit the installed copy:
- `~/.salilvnair/ck8t/blocks/<block-name>/`  ← read-only, gets overwritten on install

Always bump the `version` field in `ck8t-block.json` after any block change.

## Extension Bridge Route Rule

Any route that runs for more than a few seconds MUST use the heartbeat pattern or Chromium kills it at exactly 300s ("Failed to fetch"):

```typescript
res.setHeader('Content-Type', 'application/json');
res.flushHeaders();
const heartbeat = setInterval(() => { try { res.write(' '); } catch (_) {} }, 30_000);
try {
  const result = await longRunningOperation();
  clearInterval(heartbeat);
  res.end(JSON.stringify({ result }));
} catch (err) {
  clearInterval(heartbeat);
  res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
}
```

This applies to BOTH `/ck8t/run-block` AND `/mcp/servers/:id/tools/:tool/call`.

## Snapshot / State Persistence

Canvas state lives in two stores:
- `workflow-store` — runtime canvas (nodes, edges, subBlockValues). NOT persisted directly.
- `workspace-store` — workflows array contains saved canvas. Persisted via SQLite snapshot.

The bridge: `snapshot.js` → `initSnapshotSync()` subscribes to `workflow-store` and calls `saveWorkflow()` on every nodes/edges change → `workspace-store` → debounced postMessage → SQLite.

Never bypass this chain. If blocks are disappearing on reload, check:
1. Is `initSnapshotSync()` called in `webview-entry/main.jsx`? ✓
2. Is `workflow-store` subscribed in `initSnapshotSync()`? ✓
3. Is `Ck8tPanel._handleMessage('saveWorkspaceSnapshot')` writing to SQLite? ✓

## MCP Stdio Timeout

Heavy ML servers (MLX, ideogram4) can take 2–3 min to start under `taskpolicy -b`.
The `initialize` RPC timeout in `mcp.ts` is 180s (not 30s) — do NOT reduce it.
`tools/call` timeout is 1 hour — do NOT reduce it.
