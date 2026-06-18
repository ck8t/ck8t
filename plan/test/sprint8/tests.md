# Sprint 8 — Infrastructure & Quality Tests

---

## Test 8.1 — import-workflow.js Unit Tests ❌

**Run:**
```bash
npm test -- import-workflow
```

**Should pass:**
- `parseImportedWorkflowJSON()` with shape 1 (canvas export: `{ nodes, edges }`) → `ok: true`
- `parseImportedWorkflowJSON()` with shape 2 (full workspace: `{ id, name, nodes, edges }`) → `ok: true`
- `parseImportedWorkflowJSON()` with shape 3 (demo seed: `{ workflow: { nodes, edges } }`) → `ok: true`
- Empty nodes array → `ok: false`
- Missing `data.blockType` on all nodes → `ok: false`
- Invalid JSON string → `ok: false`, error "File is not valid JSON"
- UUID remapping: two imports of same JSON produce zero overlapping node IDs
- UUID remapping: edges `source`/`target` refs update correctly in remapped result
- UUID remapping: `subBlockValues` keys are remapped to new node IDs

---

## Test 8.2 — io-registry.js Unit Tests ❌

**Run:**
```bash
npm test -- io-registry
```

**Should pass:**
- `autoPorts({})` → returns `[]`
- `autoPorts({ prompt: { type: 'string' } })` → returns `[{ key: 'prompt', type: 'string' }]`
- `autoPorts({ a: { type: 'any' }, b: { type: 'number' } })` → returns 2 entries, not 1
- `getCardPorts(loaderBlock)` → includes `trigger` input port
- `getCardPorts(generateBlock)` → includes `prompt` and `server_url` input ports
- `isTypeCompatible('string', 'any')` → `true`
- `isTypeCompatible('number', 'string')` → `false`

---

## Test 8.3 — Snapshot Integrity Check on Hydrate ❌

**Setup:** Manually corrupt the SQLite snapshot by injecting a node with an unknown `blockType` like `"fake_block"`.

**Do this:**
1. Reload the CK8T panel.
2. Open the affected workflow tab.

**Should happen:**
- The panel loads without crashing.
- The unknown-blockType node is silently removed from the canvas.
- A warning appears in the Run panel's Problems tab: "1 node removed (unknown block type: fake_block)".
- All other nodes in the workflow load correctly.

---

## Test 8.4 — Workspace SQLite Migration Versioning ❌

**Do this:**
1. Check the SQLite database file for a `schema_version` table.
2. Downgrade the schema version manually in SQLite (or simulate an old schema).
3. Reload the CK8T panel.

**Should happen:**
- Migrations run automatically on panel open.
- The panel does not crash or show a blank screen on schema version mismatch.
- Console logs show "Running migration 1 → 2..." etc.
- Data from the old schema is preserved and correctly migrated.

---

## Test 8.5 — Error Boundary per Block ❌

**Setup:** Introduce a deliberate runtime error in a block's render logic (e.g. `throw new Error('test')` in a block's sub-block renderer).

**Do this:**
1. Add the broken block to the canvas.
2. Try to open the panel with the broken block loaded.

**Should happen:**
- Only the broken block shows an error state: a red border + "Block render error" message.
- All other blocks on the canvas render correctly.
- The canvas is still interactive — you can move other blocks, add edges, run the workflow.
- The error message includes the block type so it's easy to identify.

---

## Test 8.6 — Bundle Size Analysis ❌

**Run:**
```bash
npm run vscode -- --analyze
```

**Should happen:**
- A `stats.html` file is generated in `graphify-out/` or `dist/`.
- Opening the file in a browser shows the Rollup visualizer treemap.
- Total gzip size is under 1 MB (currently ~538 KB gzip for the JS bundle — target: keep under 550 KB).
- Identifies the largest modules (likely React, ReactFlow, Monaco).

---

## Test 8.7 — CSP Audit for Webview ❌

**Do this:**
1. Open the extension in VS Code.
2. Open VS Code Developer Tools: Help → Toggle Developer Tools.
3. Go to the Console tab and look for CSP violation warnings.

**Should happen:**
- No CSP violation warnings appear in normal use.
- `connect-src` is restricted to known hosts (not blanket `https:`).
- `script-src` does not include `unsafe-inline` or `unsafe-eval` (except for Monaco).
- The extension works correctly with the tightened CSP.
