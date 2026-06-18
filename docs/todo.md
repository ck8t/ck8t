# CK8T — Master Todo

_Last updated: 2026-06-18 (Task 15: block structure refactor complete, NS9 blocks added, block debugger extension handlers wired)_

---

## Priority 1 — Debug & Developer Experience

### #1 · Block Debug Mode (step-through breakpoints)
**Status: Partial — console capture + snapshot done (Task 14)**
- [ ] True step-through execution — pause at breakpoint line, resume, step-over
  - Requires debug adapter protocol or custom generator-based runner
  - Inject `__bp__()` call at each breakpointed line, yield from async generator, resume on signal
- [ ] Watch expressions — let user pin `input.foo` or `output.bar` to a live watch panel
- [ ] Conditional breakpoints — "break only if `input.length > 5`"
- [ ] Block Debug panel: diff view (input → output side-by-side)
- [ ] Persist debug snapshots across workflow re-runs (ring buffer, last N runs)

### #2 · Monaco Editor improvements
**Status: Monaco integrated (Task 12)**
- [ ] Bundle size: switch `?worker&inline` to split-chunk workers to reduce main chunk from 9.5MB → ~6MB
  - Use `new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url)` pattern
- [ ] Add `monaco-editor` TypeScript type hints for `input`, `values`, `console` in function blocks
  - Inject `declare const input: any; declare const values: Record<string, any>; declare const console: ...` at top of model
- [ ] Code folding, sticky scroll for large function blocks
- [ ] Diff editor for comparing two block outputs

---

## Priority 2 — Canvas UX

### #3 · Workflow node IDs: UUIDs
**Status: Open**
- [ ] Replace sequential numeric IDs (1, 2, 3...) with `crypto.randomUUID()` or `nanoid()`
- [ ] Affects: `workflow-store`, `getting-started-workflows.js`, snapshot sync
- [ ] Verify saved workflows with old numeric IDs still load

### #4 · Edge connection bug — moving connection deletes other edges
**Status: Open**
- [ ] When user drags an existing edge to reconnect it, other edges on the source/target node get deleted
- [ ] Repro: Add 3 nodes in sequence A→B→C. Drag B→C edge to B→D. A→B edge disappears.
- [ ] Root cause: likely in `onConnect` or `onEdgesChange` in `workflow-store.js` — check for inadvertent `setEdges` overwrite

### #5 · Sidebar revamp
**Status: Open**
- [ ] Hover context menus on folder/workflow items (3-dot "more" button on hover)
- [ ] 3-dot menu actions: Rename, Duplicate, Move to folder, Delete
- [ ] Style: follow daakia sidebar — compact, monochromatic, hover accent
- [ ] Keyboard shortcut to toggle sidebar (⌘B)

### #6 · Folder deletion cascade
**Status: Open**
- [ ] When a folder is deleted, child workflows inside should also be deleted (or prompted)
- [ ] Currently: children become orphaned (still exist in workspace-store but folder is gone)
- [ ] Fix in `workspace-store.js` `deleteFolder()` — recurse children before deleting folder node

---

## Priority 3 — Block Improvements

### #7 · master_agent / slave_agent visual
**Status: Open**
- [ ] slave_agent appears as non-icon, no big card — needs a proper card + SVG icon
- [ ] master_agent: show connected slave count as badge
- [ ] Canvas: slave_agent should show its "role" label from config in the card subtext

### #8 · Chain of Thought block review
**Status: Open**
- [ ] Review card layout, SVG icon, and purpose description
- [ ] Chain of Thought should show intermediate reasoning steps in inspect panel
- [ ] Consider: streaming output from CoT steps into the trace panel

### #9 · if_else / switch — metadata on card
**Status: Partial (dot removal done)**
- [ ] Verify the config metadata (conditions, branch labels) shows correctly on the canvas card header
- [ ] switch: show current matched case in inspect overlay after run

### #10 · New block ideas
- [ ] **Rate Limiter** — throttle downstream calls (N per second / minute)
- [ ] **Retry** — wrap any block with exponential backoff (max retries, delay, jitter)

### #11 · NS9 Ingest — add MCP tool to NS9 server
**Status: DONE (2026-06-18)**
- [x] `ns9/mcp/tools/ns9_ingest.py` — `handle_ns9_ingest(db_conn, source, path)` handler
- [x] Registered in `server.py` as `@app.tool async def ns9_ingest`; runs via `run_in_executor`
- [x] Returns: `{ triggered, run_id, source, nodes_added, duration_s, message, error }`
- [x] ck8t `ns9_ingest` block runner simplified (removed graceful-fail hint)
- [ ] **Cache** — memoize block output by input hash, TTL
- [ ] **Schema Validator** — validate JSON against JSONSchema, output `{valid, errors}`
- [ ] **Diff** — compare two JSON objects, output added/removed/changed paths
- [ ] **Base64** — encode/decode (useful for file + API flows)
- [ ] **UUID Generator** — generate 1 or N UUIDs
- [ ] **Timer** — emit after N seconds (useful for polling loops)
- [ ] **Splitter** — split array into chunks of size N
- [ ] **Counter** — running count across runs (persisted in workflow state)

---

## Priority 4 — Integrations

### #11 · Slack integration
**Status: Open**
- [ ] Decision: use npm `@slack/bolt` vs direct Slack API (recommend direct API — no server needed for simple sends)
- [ ] Block: `slack_send` — send message to channel (token, channel, text, blocks)
- [ ] Block: `slack_read` — read recent messages from channel
- [ ] OAuth flow for user installs vs bot token
- [ ] Add to io-registry + getting-started workflow W37

### #12 · PostgreSQL `Select a Table Name` UX
**Status: Pending explanation to user**
- [ ] The "Select a Table Name" dropdown in the PostgreSQL block requires the extension to be connected to a running Postgres instance first
- [ ] Add a tooltip / helper text explaining this: "Connect your PostgreSQL server in Settings → Connections, then table names will populate here"
- [ ] Alternatively: allow free-text input as fallback when no connection is active

### #13 · Webhook testing guide
**Status: Open**
- [ ] Create `docs/test_webhook.md` with step-by-step local testing using `ngrok` or VS Code port forwarding
- [ ] Cover: W32 starter→webhook→process→respond flow

### #14 · Cron scheduler testing guide
**Status: Open**
- [ ] Create `docs/test_cron.md` for W36 cron scheduler testing

---

## Priority 0 — Block Structure Refactor (ACTIVE)

### #0 · Standardize ALL blocks to `ck8t-block.json` + `ui/` + `runners/` pattern

**Status: IN PROGRESS (2026-06-18)**

Community blocks (ideogram4-storybook, cuda-id4) already follow the pattern:
```
<block-dir>/
  ck8t-block.json
  ui/
    <component>.js
  runners/
    client.js       ← browser execution
    extension.js    ← VS Code extension host (Node.js)
    server.js       ← ck8t-server process
```

Core blocks currently do NOT follow this pattern:
- UI is flat: `src/ck8t/blocks/blocks/<name>.js`
- Runners are inline in `src/ck8t/run/graph-runner.js` (client) and `extension/.../engine/graph-runner.ts` (extension)
- No `ck8t-block.json` for any core block

**Target structure for ALL core blocks:**
```
src/ck8t/blocks/<name>/
  ck8t-block.json              ← manifest (type, runners, ui, version)
  ui/
    <name>.js                  ← defineCk8tBlock() definition (JSX, React icons)
  runners/
    client.js                  ← browser-safe execution logic
    extension.js               ← Node.js execution logic (can use npm packages)
    server.js                  ← ck8t-server execution (only if needed)
```

**Why this matters:**
- Block Debugger needs separate readable files to show per-block (currently impossible for core blocks)
- Consistent mental model across core and community blocks
- Easier per-block versioning, testing, and ownership
- Future: each block can declare its own npm deps in a per-block `package.json`

**Implementation steps:**

- [x] **Step 1 — Move UI files** (DONE 2026-06-18)
  - All 45 blocks moved to `src/ck8t/blocks/<name>/ui/<name>.js`
  - `blocks/blocks/index.js` updated to re-export from new paths (old `blocks/blocks/*.js` kept as source of truth via barrel)
  - Relative imports fixed (added one `../` level): `from '../x'` → `from '../../x'`, `from '../../x'` → `from '../../../x'`
  - Build verified: `npm run vscode` ✓

- [x] **Step 2 — Create `ck8t-block.json` for each core block** (DONE 2026-06-18)
  - All 45 blocks have `ck8t-block.json` in `src/ck8t/blocks/<name>/`
  - Correctly categorized: client+extension / extension-only / no-runners

- [x] **Step 3a — Extract runners (initial batch)** (DONE 2026-06-18)
  - Client runners done: function, if_else, if_elseif_else, switch_case/condition, json_map, json_path, text_template, filter, sort, aggregate, merge, variables, delay/wait, response, http_response, show_preview, error_handler, crypto (Web Crypto API)
  - Extension runners done: agent, mcp, api, ai_classifier, mapper, postgresql, redis, mongodb, smtp, slack, save_to_files, image_url_to_base64, crypto (Node.js crypto module)
  - Remaining blocks without runners yet (pass-through/UI): starter, user_input, webhook_request, schedule, table, loop, parallel, sub_workflow, image_url_preview, skill, router, for_loop, for_each, master_agent, slave_agent, chain_of_thought

- [ ] **Step 3b — Extract remaining runners** (TODO)
  - **Client runners** (browser-safe, extracted from `graph-runner.js`):
    - function, if_else, if_elseif_else, switch/condition, json_map, json_path, text_template
    - filter, sort, aggregate, merge, crypto, variables, delay/wait
    - response, http_response, show_preview, error_handler
  - **Extension runners** (Node.js, extracted from `graph-runner.ts`):
    - agent, mcp, api, ai_classifier, mapper
    - postgresql, redis, mongodb (currently throw — add real impl or clear error)
    - smtp, slack (currently throw — add real impl or clear error)
    - save_to_files, image_url_to_base64
    - master_agent, slave_agent, chain_of_thought
  - **Pass-through / no runner** (just UI — no execution logic):
    - starter, user_input, webhook_request, schedule, table, loop, parallel, sub_workflow, image_url_preview, skill

- [ ] **Step 4 — Update graph-runner.ts** to `import { run } from '../../../src/ck8t/blocks/<name>/runners/extension.js'`
  - Replace all `runXxxNode()` inline functions with imports from block runner files
  - Verify extension compiles with `esbuild.js`

- [ ] **Step 5 — Update graph-runner.js** (client-side)
  - Import client runners where available; fall back to inline logic for blocks without client runner
  - Or: always use runner files (requires Vite to bundle them)

- [x] **Step 6 — Update BlockDebuggerPopup + Ck8tPanel** for core blocks (DONE 2026-06-18)
  - `_sendBlockDebugFiles` now checks BOTH:
    1. `src/ck8t/blocks/<blockType>/` (core blocks — resolved from `this._extensionUri.fsPath`)
    2. `~/.salilvnair/ck8t/blocks/` (community blocks)
  - Function block: still shows user's code from `subBlockValues`
  - All other blocks (core + community): requests runner files from extension host

- [ ] **Step 7 — Update `loadInstalledBlocks`** in registry.js
  - Core blocks may self-register via their `ck8t-block.json`
  - Or keep static imports — whichever is simpler

**Blocks to refactor (43 total):**
agent, aggregate, ai_classifier, api, chain_of_thought, condition, crypto, delay, error_handler,
filter, for_each, for_loop, function, http_response, if_else, if_elseif_else, image_url_preview,
image_url_to_base64, json_map, json_path, loop, mapper, master_agent, mcp, merge, mongodb,
parallel, postgresql, redis, response, router, save_to_files, schedule, show_preview, skill,
slack, slave_agent, smtp, sort, starter, sub_workflow, switch_case, table, text_template,
user_input, variables, wait, webhook_request

---

## Priority 5 — Architecture / DX

### #15 · DUI library cross-project sharing
**Status: DONE**
- [x] Standalone npm package at `/workspace/git/salilvnair/dui`
- [x] `EditorView` — Monaco + debug gutter, clipboard, Shift+Alt+F format, `dui-dark`/`dui-light` themes
- [x] `JsonTreeView` — expandable JSON tree
- [x] `useBreakpointGutter`, `useAppTheme` (VS Code + generic theme detection), `monaco-setup`
- [x] ck8t uses it via `"@salilvnair/dui": "file:../../salilvnair/dui"` + `preserveSymlinks: true`
- [x] Deleted `BlockMonacoEditor.jsx` and `monaco-setup.js` from ck8t — no more duplicates
- Next: add `ButtonView`, `Badge`, `Chip`, `ContextMenuView` to DUI as ck8t needs them

### #16 · Monaco bundle size optimization
**Status: Open (noted from Task 12)**
- [ ] Current: main chunk 9.5MB (2.3MB gzip) — workers embedded as base64 via `?worker&inline`
- [ ] Target: split workers into separate files loaded by URL
- [ ] Constraint: VS Code webview CSP must allow `blob:` workers — verify before changing

### #17 · Workspace-store: persist debug state across sessions
**Status: Open**
- [ ] `debugEnabled` and `breakpoints` in `block-debug-store` reset on window reload
- [ ] Consider: persist per-workflow debug config in `workspace-store` alongside workflow nodes
- [ ] Snapshots should NOT be persisted (ephemeral run data)

---

## Completed

- [x] **Task 15**: Block structure refactor (all 51 blocks), NS9 blocks (ns9_query/ns9_rlhf/ns9_ingest), Block Debugger extension host handlers — see `changes_15.md` + `test_15.md`
- [x] Block structure refactor Steps 1, 2, 3a, 6 — all 51 core blocks (48 + 3 NS9) now have `<name>/ck8t-block.json`, `<name>/ui/<name>.js`, `<name>/runners/` layout; Block Debugger works for both core and community blocks
- [x] Block Debugger (step-through) — `BlockDebuggerPopup`, `BlockDebugEngine`, `block-debugger-store`, extension host handlers (`blockDebug:getFiles/runExtension/resume/stepOver/stop`)
- [x] NS9 blocks — `ns9_query`, `ns9_rlhf`, `ns9_ingest` UI + runners + registry + palette group (NS9 Tools subgroup); verified against NS9 MCP server (ns9_query ✓, ns9_rlhf_correct ✓, ns9_ingest ⚠️ tool pending in server)
- [x] DUI npm package created (`@salilvnair/dui`) — `EditorView`, `JsonTreeView`, `useBreakpointGutter`, `monaco-setup`
- [x] Task 12: Monaco editor via DUI `EditorView` (replaced `BlockMonacoEditor.jsx` + `monaco-setup.js`)
- [x] Task 14: Block Debug Mode — toggle, DBG badge, console capture, Block Debug panel
- [x] for_each / for_loop client-side execution (no longer requires convengine)
- [x] API headers fix — object-style JSON headers now work
- [x] deep_merge mode in Merge block
- [x] sort / filter / merge port types (`array` / `any`) — no more type mismatch errors
- [x] slave_agent reachability exemption (graph-runner + problems-panel)
- [x] W44 parallel example — native fan-out, no parallel block needed
- [x] W26 json_map mappings format fixed (`{key, path}`)
- [x] if_else / switch branch strip dot-over-line visual bug fixed
- [x] Convengine "connect to backend" wording removed from client-side blocks
