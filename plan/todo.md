# CK8T — Master TODO

> Last Modified: June 19, 2026 (graph analysis: 989 nodes · 2,010 edges · 59 communities)
> Legend: ✅ Done | ❌ Pending | 🔄 Partial | 🐛 Bug

---

## ⚠️ Mandatory Rules (read before touching anything)

- **Build**: ALWAYS use `npm run vscode` to rebuild the extension. NEVER use `npm run ui` for extension builds.
- **Blocks**: Edit in `/workspace/git/ck8t/<block-name>/`. NEVER edit `~/.salilvnair/ck8t/blocks/` — it is overwritten on install.
- **Node IDs**: Every workflow import must remap all node IDs to fresh UUIDs (handled by `import-workflow.js`). Hard-coded IDs in sample JSONs must never leak into the runtime canvas across tabs.
- **Auto-save guard**: The auto-save effect in `AgentBuilderPage.jsx` must check `loadedWorkflowIdRef.current === activeWorkflowId` before saving. Removing this guard causes tab-collision corruption.
- **Version bump**: Bump `version` in `ck8t-block.json` after every block change.
- **Long routes**: Any extension bridge route > a few seconds MUST use the heartbeat pattern (30s interval write) or Chromium kills it at 300s.

---

## Sprint 0 — Folder Hierarchy & Multi-team Revamp ✅ DONE

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 0.1 | `workflowFolders[]` data model | ✅ | Store | Add `workflowFolders[]` to workspace-store with "Getting Started" seed; migrate `teamId → teamIds[]`; add `folderId` to workflows; folder CRUD actions | `stores/workspace-store.js` |
| 0.2 | Folder tree UI — WorkflowsPanel | ✅ | SideNav | Rewrite WorkflowsPanel as folder tree: expand/collapse, inline rename, context menus, "+ New Folder", "+ New Workflow", Getting Started folder default | `sidenav/SideNav.jsx` |
| 0.3 | Team → Agents tree — TeamsPanel | ✅ | SideNav | Rewrite TeamsPanel to show Team → Agents collapsible tree; hide pool abstraction; "Add agent" inline per team | `sidenav/SideNav.jsx` |
| 0.4 | Multi-team Create modal | ✅ | Modal | Replace single team dropdown with checkboxes + folder picker in CreateWorkflowModal | `components/CreateWorkflowModal.jsx` |
| 0.5 | Multi-team Import modal | ✅ | Modal | Same multi-team + folder picker in ImportWorkflowModal | `components/ImportWorkflowModal.jsx` |
| 0.6 | Update all `teamId` callers | ✅ | Callers | Update AgentBuilderPage, Canvas, WorkflowInspector, TeamEditor to use `teamIds[]` | multiple |
| 0.7 | WorkflowInspector multi-team picker | ✅ | Inspector | Replace single-team StyledSelect with checkbox list in workflow basic settings | `panel/WorkflowInspector.jsx` |

---

## Sprint 0.5 — Getting Started Workflow Library ✅ DONE

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 0.5.1 | `getting-started-workflows.js` — 45 demo workflows | ✅ | Store | 45 real working workflows, one per block type. Real public APIs (jsonplaceholder, GitHub, dog.ceo, httpbin, open-meteo), structured agent prompts, correct node/edge format | `stores/getting-started-workflows.js` |
| 0.5.2 | Seed Getting Started on fresh install | ✅ | Store | `initialState.workflows` now includes all 45 GS workflows so they appear on first launch | `stores/workspace-store.js` |
| 0.5.3 | `restoreGettingStarted()` store action | ✅ | Store | Removes all GS workflow IDs and re-seeds from canonical list; preserves user workflows in other folders | `stores/workspace-store.js` |
| 0.5.4 | Settings → Getting Started tab | ✅ | Settings | New tab in Settings with live count, block coverage grid, and "Restore" button with confirmation | `tabs/SettingsTab.jsx` |
| 0.5.5 | CSS for Getting Started section | ✅ | CSS | `.bs-gs-stat-row`, `.bs-gs-stat`, `.bs-gs-confirm`, `.bs-gs-success`, `.bs-gs-coverage`, `.bs-gs-tag`, `.bs-btn-danger` | `ck8t.css` |

---

## Sprint 1 — Core Stability (Bug Fixes)

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 1.1 | Workflow tab collision fix | ✅ | Canvas | Auto-save effect was writing stale canvas state to newly-activated workflow ID, making all tabs identical | `AgentBuilderPage.jsx:276` |
| 1.2 | Node ID UUID remapping on import | ✅ | Import | Imported JSON had hard-coded node IDs colliding across tabs; now remapped to fresh UUIDs at parse time | `utils/import-workflow.js` |
| 1.3 | `autoPorts()` collapse fix | ✅ | IO Registry | All typed inputs were collapsing to a single `• input` port; each named port now renders individually | `panel/io-registry.js` |
| 1.4 | Loader block D-shape connector fix | ✅ | Block UI | Empty `inputs: {}` triggered fallback D-shape handle; fixed by adding named typed input | `cuda-id4/ui/cuda-id4-loader.js` |
| 1.5 | Image preview base64 prefix | ✅ | Block UI | `extractMediaUri()` requires `data:image/png;base64,` prefix; generate block now returns full data URI | `cuda-id4/ui/cuda-id4-generate.js` |
| 1.6 | CORS middleware for api_server | ✅ | Server | VS Code webview origin rejected by RunPod server; added `CORSMiddleware(allow_origins=["*"])` | `cuda-id4/api_server.py` |
| 1.7 | Em-dash encoding in block names | ✅ | Block UI | UTF-8 `—` rendered as `â€"` in block headers; replaced with ASCII ` - ` across all UI files | multiple `ui/*.js` |
| 1.8 | `save_to_files` node in sample workflow | ✅ | Sample | Added `n_save` node to `animal-story-cuda.json` fan-out from `image_b64` | `cuda-id4/sample/animal-story-cuda.json` |

---

## Sprint 2 — Canvas & Workflow UX

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 2.1 | Workflow export includes metadata | ❌ | Export | Exported JSON should include `name`, `createdAt`, `version` so reimport preserves workflow name | `utils/export-workflow.js` |
| 2.2 | Duplicate workflow tab | ❌ | Tabs | Right-click a workflow tab → "Duplicate" → clones nodes/edges/subBlockValues with fresh UUIDs | `tabs/WorkflowTabs.jsx`, `workspace-store.js` |
| 2.3 | Rename workflow tab inline | ❌ | Tabs | Double-click tab label to rename in place | `tabs/WorkflowTabs.jsx` |
| 2.4 | Undo/redo on canvas | ❌ | Canvas | Ctrl+Z / Ctrl+Shift+Z to undo node add/delete/move and edge changes | `stores/workflow-store.js`, `canvas/` |
| 2.5 | Multi-select nodes | ❌ | Canvas | Shift-click or drag-select to move/delete a group of nodes together | `canvas/` |
| 2.6 | Node search palette | ❌ | Canvas | Cmd+K or `/` opens fuzzy-search palette to add any block by name | `AgentBuilderPage.jsx`, `blocks/registry.js` |
| 2.7 | Canvas zoom memory | ❌ | Canvas | Restore viewport (zoom + pan) per workflow when switching tabs | `workflow-store.js`, `canvas/` |
| 2.8 | Mini-map toggle | ❌ | Canvas | Button to show/hide ReactFlow mini-map in bottom-right | `AgentBuilderPage.jsx` |
| 2.9 | Fit-to-view button | ❌ | Canvas | One-click "fit all nodes in viewport" | `AgentBuilderPage.jsx` |
| 2.10 | Edge label / annotation | ❌ | Canvas | Click an edge to add an inline label (useful for named ports) | `canvas/` |
| 2.11 | Collapse/expand node | ❌ | Canvas | Toggle to hide a node's body, showing only its title and port dots | `canvas/BuilderBlock.jsx` |

---

## Sprint 3 — Block Library Enhancements

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 3.1 | `show_preview` image support | ❌ | Core Block | `show_preview` already calls `extractMediaUri()` — verify it renders `data:image/*;base64,...` correctly and add test image wiring | `blocks/blocks/show_preview.js` |
| 3.2 | `save_to_files` base64 binary decode | ❌ | Core Block | When `format: "binary"` and input is a `data:image/...;base64,...` URI, strip the header and write raw bytes | `blocks/blocks/save_to_files.js` |
| 3.3 | `user_input` multiline resize handle | ❌ | Core Block | `longtext` sub-type textarea has no drag-resize; add CSS `resize: vertical` and min-height | `blocks/blocks/user_input.js` |
| 3.4 | `condition` block visual feedback | ❌ | Core Block | Show which branch (true/false) was taken in the last run via colored edge highlight | `blocks/blocks/condition.js` |
| 3.5 | `for_each` progress counter | ❌ | Core Block | Display "item N of M" in the block during execution | `blocks/blocks/for_each.js` |
| 3.6 | `http_response` block | ❌ | Core Block | Audit: confirm status code, headers, body are all surfaced correctly as outputs | `blocks/blocks/http_response.js` |
| 3.7 | `mcp` block tool picker | ❌ | Core Block | Dropdown to pick tool from connected MCP server instead of free-text | `blocks/blocks/mcp.js`, `mcp/` |
| 3.8 | `agent` block system prompt editor | ❌ | Core Block | Dedicated Monaco-backed modal for the system prompt subBlock (currently a plain textarea) | `blocks/blocks/agent.js` |
| 3.9 | `webhook_request` retry policy | ❌ | Core Block | Add `max_retries` and `retry_delay_ms` subBlocks | `blocks/blocks/webhook_request.js` |
| 3.10 | `variables` scoped lifetime | ❌ | Core Block | Support `run` scope (reset each execution) vs `session` scope (persist across runs) | `blocks/blocks/variables.js` |

---

## Sprint 4 — Community Blocks (CUDA ID4)

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 4.1 | `cuda_id4_loader` SSE heartbeat | ❌ | CUDA Block | Extension bridge route for long SSE must use heartbeat pattern to survive Chromium 300s kill | `cuda-id4/runners/extension.js` |
| 4.2 | Loader `skip_if_loaded` UI toggle | ❌ | CUDA Block | `skip_if_loaded` subBlock switch not wired to the actual load-skip logic at runtime | `cuda-id4/ui/cuda-id4-loader.js` |
| 4.3 | Generate block error retry | ❌ | CUDA Block | On 5xx response from RunPod, show retry button in progress overlay instead of hard error | `cuda-id4/ui/cuda-id4-generate.js` |
| 4.4 | Server health badge | ❌ | CUDA Block | Loader block shows green/red dot for server health before loading starts | `cuda-id4/ui/cuda-id4-loader.js` |
| 4.5 | Multiple prompt seeds workflow | ❌ | CUDA Sample | Sample workflow: run Generate N times with different seeds, fan-in all images to a compare grid | `cuda-id4/sample/` |
| 4.6 | Aspect ratio preview label | ❌ | CUDA Block | Show selected aspect ratio as a badge below the Generate block during run | `cuda-id4/ui/cuda-id4-generate.js` |

---

## Sprint 5 — MCP & AI Provider Integration

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 5.1 | MCP server connection status badge | ❌ | MCP | Show connected / disconnected status on each MCP server entry | `mcp/` |
| 5.2 | MCP tool output inspector | ❌ | MCP | Click a tool in the MCP panel to see its schema and last call output | `mcp/` |
| 5.3 | AI provider key validation | ❌ | AI | On save of an API key, validate it with a lightweight test call | `ai/`, `stores/ai-providers-store.js` |
| 5.4 | Model picker grouping | ❌ | AI | Group models by provider in the dropdown (OpenAI, Anthropic, Ollama) | `stores/llm-config-store.js` |
| 5.5 | Ollama local model discovery | ❌ | AI | Auto-detect running Ollama models via `/api/tags` and surface them in the picker | `stores/ai-providers-store.js` |
| 5.6 | LLM call cost estimator | ❌ | AI | After an agent block runs, show estimated token cost in the inspect panel | `blocks/blocks/agent.js` |

---

## Sprint 6 — Workflow Execution & Run Panel

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 6.1 | Run panel docked output per node | ❌ | Run | Clicking a node in the run panel scrolls to its output section | `run/` |
| 6.2 | Block debugger — tab panel (Daakia-style) | ✅ | Debug | Debugger redesigned as center-pane tab (not popup). Bug icon in sidenav rail with red dot when breakpoints active. Right-click block → Debug opens Debugger tab with file tabs, Monaco editor, Variables/Watch/Call Stack/Breakpoints/Console. No Run button anywhere — breakpoints are executed by pressing the normal canvas **Run** button, which auto-routes through `BlockDebugEngine` when the Debugger tab has live breakpoints for that node (`getActiveDebugRun`/`runThroughDebugger` in `graph-runner.js`), same as Daakia's pre/post-script routing. HUD floats (`.bdp-float-hud`, Daakia-style) instead of sitting in a sticky header; only Continue/Step Over/Step In/Step Out/Restart/Stop/Mute. Restart replays the last canvas-triggered run via `lastDebugRun`. Debug engine supports `module` mode (locates the matching block's `run()` body via brace-depth tracking so breakpoints outside it, e.g. on a `type:` line, no-op instead of crashing) and `script` mode (function block's raw code). | `debug/BlockDebuggerPanel.jsx`, `debug/block-debugger-store.js`, `debug/block-debug-engine.js`, `run/graph-runner.js`, `stores/tabs-store.js`, `tabs/CenterPane.jsx`, `sidenav/SideNav.jsx` |
| 6.7 | Core block runner refactor | ✅ | Arch | All core blocks isolated into `runners/client.js` files with unified contract `export default [{ type, run(ctx) }]` — same as community blocks. `core-block-runners.js` aggregator. `graph-runner.js` switch replaced with registry lookup + `buildRunCtx()`. Extension graph-runner.ts updated for new extension.js format. | `blocks/*/runners/client.js`, `blocks/core-block-runners.js`, `blocks/registry.js`, `run/graph-runner.js` |
| 6.8 | Block debugger — extension.js WS path | ✅ | Debug | extension.js breakpoints now route to a WS debug session against the extension bridge. `BlockDebugEngineNode` (vm.Script + createRequire + CJS preprocessor) runs in extension host. `debug-ws.ts` bridge route; `ext-debug-client.js`; `startExtDebugSession()` ordering contract (open+register before HTTP POST); `runNode()` extDebug branch in graph-runner.js; storybook_pdf `client.js` rewritten to delegate pattern with `ctx.__ck8tExtDebug` forwarding. | `extension/.../bridge/routes/debug-ws.ts`, `extension/.../services/block-debug-engine-node.ts`, `src/ck8t/debug/ext-debug-client.js`, `src/ck8t/run/graph-runner.js`, `ideogram4-storybook/runners/client.js` |
| 6.9 | Block debugger — server.js WS path (Test on Server) | ✅ | Debug | "Test on Server" button in Debugger panel triggers a WS debug session against ck8t-server. `BlockDebugEngineNode` copy in ck8t-server. Fastify `@fastify/websocket` + `debug-ws` route. `server-debug-client.js` with `detectServerEngine()` (2.5s probe) + `startServerDebugSession()`. `serverTestStatus` field in store. URL separation: bridge uses `__CK8T_BRIDGE_BASE__`, server uses `VITE_CONVENGINE_BASE`/:3001. | `ck8t-server/src/routes/debug-ws.ts`, `ck8t-server/src/services/block-debug-engine-node.ts`, `src/ck8t/debug/server-debug-client.js`, `src/ck8t/debug/BlockDebuggerPanel.jsx` |
| 6.10 | GS Workflows W46-W65 — community blocks + debugger | ✅ | Store | 20 new Getting Started workflows: W46-W55 (story_splitter pipeline), W56-W60 (storybook_pdf paths), W61-W65 (debugger walkthroughs). STORY_SAMPLE constant. | `src/ck8t/stores/getting-started-workflows.js` |
| 6.11 | Test checklist W01-W65 | ✅ | Test | Full manual test checklist for all 65 GS workflows + node-side debugger tests (Test on Server, regression tests). Filed at `plan/test/sprint6/tests_getting_started.md`. | `plan/test/sprint6/tests_getting_started.md` |
| 6.3 | Execution timeline visualiser | ❌ | Run | Gantt-style bar chart showing each block's start/duration in the last run | `run/` |
| 6.4 | Re-run from node | ❌ | Run | Right-click a completed node → "Re-run from here" using cached upstream outputs | `run/`, `canvas/` |
| 6.5 | Run history per workflow | ❌ | Run | Keep last N run results in SQLite, viewable from a "History" tab in the run panel | `stores/snapshot.js`, `ck8t-server/` |
| 6.6 | Scheduled run (cron) | ❌ | Run | Add a cron-style schedule to a workflow — runs in the background even when panel is not open | `extension/vscode/ck8t/src/` |

---

## Sprint 7 — Developer Experience

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 7.1 | Hot-reload community blocks | ❌ | DX | Watch block source folder; reload the block UI in the extension without full rebuild | `extension/vscode/ck8t/src/` |
| 7.2 | Block scaffolding CLI | ❌ | DX | `ck8t new-block <name>` generates boilerplate `ck8t-block.json` + `ui/*.js` + `runners/*.js` | `scripts/` |
| 7.3 | Block version diff on upgrade | ❌ | DX | When a community block has a newer version, show a diff modal before overwriting | `panel/`, `workspace-store.js` |
| 7.4 | Keyboard shortcuts panel | ❌ | DX | `?` key opens modal listing all canvas keyboard shortcuts | `AgentBuilderPage.jsx` |
| 7.5 | Block documentation popup | ❌ | DX | `?` icon on each block header opens its description + input/output schema in a sidebar | `canvas/BuilderBlock.jsx` |
| 7.6 | CHANGELOG auto-generation | ❌ | DX | Script to append to `changes/CHANGELOG.md` from git log on each block version bump | `scripts/` |

---

## Sprint 8 — Infrastructure & Quality

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 8.1 | Unit tests for `import-workflow.js` | ❌ | Test | Test UUID remapping, all three JSON shapes, edge cases (no nodes, no blockType) | `src/ck8t/utils/import-workflow.test.js` |
| 8.2 | Unit tests for `io-registry.js` | ❌ | Test | Test `autoPorts()` with empty, single, multi-input/output defs; test `getCardPorts()` | `panel/io-registry.test.js` |
| 8.3 | Snapshot integrity check on hydrate | ❌ | State | On `hydrateSnapshot()`, validate each workflow's nodes array against registered block types; remove unknown block types before loading | `stores/snapshot.js` |
| 8.4 | Workspace SQLite migration versioning | ❌ | DB | Add a `schema_version` table; run migrations in sequence on panel open | `ck8t-server/src/`, `extension/vscode/ck8t/src/` |
| 8.5 | Error boundary per block | ❌ | Canvas | Wrap each `BuilderBlock` in a React error boundary so one bad block doesn't crash the canvas | `canvas/BuilderBlock.jsx` |
| 8.6 | Bundle size analysis | ❌ | Build | Add `rollup-plugin-visualizer` to `vite.extension.config.js`; target < 1 MB gzip | `vite.extension.config.js` |
| 8.7 | CSP audit for webview | ❌ | Security | Audit `Ck8tPanel._getHtml()` CSP header — tighten `connect-src` to known hosts, remove blanket `https:` | `extension/vscode/ck8t/src/` |

---

## Sprint 9 — Canvas Power Features (n8n/ComfyUI parity)

> These features close the gap between CK8T and n8n/ComfyUI. The graph analysis confirms `runNode()` (38 edges) and `defineCk8tBlock()` (49 edges) are the right extension points for all of these.

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 9.1 | Expression editor `{{ }}` | ❌ | Canvas | Reference any upstream node's output in any sub-block text field using `{{ $node["Generate Image"].image_b64 }}` syntax (n8n style). Parse and resolve at `runNode()` time before the block's `run()` is called. | `run/graph-runner.js`, `panel/SubBlockRenderer.jsx` |
| 9.2 | Sticky note / annotation block | ❌ | Canvas | Non-executing yellow note block that renders markdown text on the canvas. Drag-resize. Sits visually behind other nodes (z-index). | `blocks/blocks/note.js`, `canvas/WorkflowNode.jsx` |
| 9.3 | Node group / frame | ❌ | Canvas | Drag a "Group" frame onto the canvas to visually cluster related blocks (ComfyUI Groups). Frame resizes to contain children. Label shown in header. Color-configurable. | `canvas/`, `blocks/blocks/group.js` |
| 9.4 | Reroute pass-through node | ❌ | Canvas | Tiny dot-sized node that passes its single input through unchanged — purely for routing edges around other nodes cleanly. Double-click an edge to insert one. | `canvas/`, `blocks/blocks/reroute.js` |
| 9.5 | Inline output preview on node | ❌ | Canvas | After a run, show last output value directly on the block body (ComfyUI-style): image thumbnail, truncated JSON, number value. Click to expand. | `canvas/WorkflowNode.jsx`, `run/graph-runner.js` |
| 9.6 | Workflow global variables | ❌ | Runtime | A `$workflow.vars` namespace accessible from expression editor in any block. Set via a new "Workflow Variables" panel or the `variables` block with `scope: workflow`. | `stores/workflow-store.js`, `run/graph-runner.js` |
| 9.7 | Run queue manager | ❌ | Run | Queue multiple runs (n8n/ComfyUI queue). Show pending, running, completed entries. Cancel individual queued runs. | `run/`, `stores/workflow-store.js` |
| 9.8 | Canvas bookmark / viewport save | ❌ | Canvas | Right-click canvas → "Save View Here". Named bookmarks in canvas toolbar — click to jump to saved zoom+pan. Stored in `subBlockValues` of the workflow. | `canvas/Canvas.jsx` |
| 9.9 | Seed pin / value lock | ❌ | Canvas | Right-click any block output → "Lock value" — pins the last run's output as a frozen input for downstream blocks (ComfyUI seed lock). Unlock to re-generate. | `canvas/WorkflowNode.jsx`, `stores/workflow-store.js` |
| 9.10 | Bypass node visual (ComfyUI style) | ❌ | Canvas | When a block is disabled (`Cmd+B`), cross-hatch its body with a pattern and show a yellow "BYPASS" badge. Currently disabled nodes just dim slightly. | `canvas/WorkflowNode.jsx` |

---

## Sprint 10 — Workflow Power Features

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 10.1 | Error / fallback workflow | ❌ | Execution | Attach an "on-error" workflow to any workflow — it fires automatically when the main run throws and receives the error as input. | `stores/workspace-store.js`, `run/graph-runner.js` |
| 10.2 | Wait-for-webhook / resume node | ❌ | Execution | A `wait` block that suspends execution and emits a resume URL. Hitting that URL (or a matching incoming webhook) resumes the workflow from that node with the webhook payload. | `blocks/blocks/wait.js`, `extension/vscode/ck8t/src/` |
| 10.3 | Workflow versioning / snapshots | ❌ | State | Per-workflow version history: save a named snapshot before major changes. Diff and restore from any previous snapshot. Stored in SQLite alongside normal snapshot data. | `stores/snapshot.js`, `ck8t-server/` |
| 10.4 | Multi-run compare | ❌ | Run | Run the same workflow N times with different inputs or seeds. Results shown side-by-side in a comparison grid. Export comparison as JSON. | `run/`, `AgentBuilderPage.jsx` |
| 10.5 | Live variable watch panel | ❌ | Run | Pin any block's output as a "watch" — appears in a persistent floating panel showing live-updating values during a run. Useful for debugging LLM chains. | `run/`, `stores/workflow-store.js` |
| 10.6 | Workflow test runner | ❌ | Test | Attach expected outputs to a workflow. Run via `npm test:workflow` or a "Run Tests" button. Asserts each output matches expected (exact, regex, JSON path). Fails loudly on mismatch. | `run/`, `scripts/` |
| 10.7 | Sub-workflow typed parameters | ❌ | Execution | Enhance the `sub_workflow` block with a typed parameter schema — caller specifies named inputs, sub-workflow exposes named outputs. Editor validates types at wire-time. | `blocks/blocks/sub_workflow.js`, `panel/io-registry.js` |
| 10.8 | Conditional edge (branch guard) | ❌ | Canvas | Right-click an edge → "Add condition". The edge only passes data if the JS expression evaluates truthy. Shows a small lock icon when condition is set. | `run/graph-runner.js`, `canvas/GradientEdge.jsx` |
| 10.9 | Workflow secrets vault | ❌ | Security | Encrypted key/value store per workspace — like `.env`. Reference secrets in any input with `{{ $secret.MY_KEY }}`. Keys encrypted at rest in SQLite (already has encrypt/decrypt in browser-providers-store). | `stores/workspace-store.js`, `extension/vscode/ck8t/src/` |
| 10.10 | Batch input from CSV/JSON array | ❌ | Execution | A `batch_input` block that reads a CSV or JSON array file and fans out one run per row. Progress shown as "row 3 of 50". | `blocks/blocks/batch_input.js` |

---

## Sprint 11 — AI-Powered Canvas Intelligence

> The graph confirms `defineCk8tBlock()` and `runNode()` are the two god nodes everything depends on — AI features layer on top of these without modifying them.

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 11.1 | LLM block generator | ❌ | AI | Describe a block in plain English in a text field → CK8T generates the block JS using an LLM, shows a preview, one-click adds it to the palette. Built on top of `defineCk8tBlock()`. | `tabs/`, `blocks/registry.js` |
| 11.2 | Auto-wire by type | ❌ | AI | Right-click any block → "Auto-connect". CK8T analyzes output port types against all unconnected input ports in the workflow and suggests + draws the most compatible edges. | `canvas/Canvas.jsx`, `panel/io-registry.js` |
| 11.3 | Workflow chat | ❌ | AI | A chat input at the bottom of the canvas: "Add a delay of 2 seconds between Load Model and Generate". CK8T translates the instruction into a canvas mutation (add node, rewire edges). | `AgentBuilderPage.jsx`, `run/graph-runner.js` |
| 11.4 | Block suggestion sidebar | ❌ | AI | As you build a workflow, a sidebar suggests "You might want to add: save_to_files, show_preview" based on what your current last node outputs. Confidence-ranked. | `sidenav/BlockPalette.jsx` |
| 11.5 | Explain this workflow | ❌ | AI | Button in toolbar: CK8T reads the current canvas topology and generates a plain-English description of what the workflow does, step by step. Shown in WikiGuide tab. | `tabs/WikiGuide.jsx`, `run/graph-runner.js` |
| 11.6 | Smart prompt template | ❌ | AI | In `agent` blocks, a "Enhance prompt" button sends the current system/user prompt to an LLM and returns a more structured, detailed version. | `blocks/blocks/agent.js`, `panel/SubBlockRenderer.jsx` |
| 11.7 | Workflow from description | ❌ | AI | A "New from description" entry in the workflow list: type "Build an image generation pipeline with 3 style variations" → CK8T creates the full workflow on the canvas. | `sidenav/SideNav.jsx`, `stores/workspace-store.js` |

---

## Sprint 12 — Integrations & Protocol Blocks

> The graph shows `API & MCP Blocks` (community 17) and `AI Provider Config` (community 3) as distinct clusters — new protocol blocks slot in without touching core.

| # | Task | Status | Area | Description | File |
|---|------|--------|------|-------------|------|
| 12.1 | GraphQL request block | ❌ | Blocks | Like `api` block but with schema introspection, operation picker, variables editor. | `blocks/blocks/graphql.js` |
| 12.2 | WebSocket block | ❌ | Blocks | Connect to a WS server, send messages, receive streamed responses as outputs. | `blocks/blocks/websocket.js` |
| 12.3 | gRPC block | ❌ | Blocks | Connect to gRPC service, call methods, handle proto-encoded responses. | `blocks/blocks/grpc.js` |
| 12.4 | Browser automation block | ❌ | Blocks | Playwright-backed block: navigate, click, screenshot, extract text from web pages. | `blocks/blocks/browser.js`, `runners/extension.js` |
| 12.5 | File watcher trigger block | ❌ | Blocks | Starter block that watches a folder path and triggers the workflow when a file changes/appears. | `blocks/blocks/file_watcher.js` |
| 12.6 | Git commit trigger | ❌ | Blocks | Starter block triggered on git commits in a local repo path. Passes commit metadata as output. | `blocks/blocks/git_trigger.js` |
| 12.7 | S3 / object storage block | ❌ | Blocks | Upload/download/list files from S3, R2, MinIO, or any S3-compatible store. | `blocks/blocks/s3.js` |
| 12.8 | Notification block (VS Code) | ❌ | Blocks | Show a VS Code `window.showInformationMessage()` / `showErrorMessage()` at workflow completion. | `blocks/blocks/vscode_notify.js` |

---

## Backlog (no sprint yet)

| # | Task | Status | Area | Description |
|---|------|--------|------|-------------|
| B.1 | Multi-team workspace | ❌ | Workspace | Support multiple team IDs in workspace-store; switch active team from sidebar |
| B.2 | Workflow sharing via export URL | ❌ | Share | Generate a shareable link that encodes the workflow JSON (gzip + base64 in URL fragment) |
| B.3 | Block marketplace UI | ❌ | Marketplace | Browse, install, and update community blocks from inside the extension panel |
| B.4 | Real-time collaborative canvas | ❌ | Collab | CRDT-backed multi-cursor canvas editing (long-term) |
| B.5 | Mobile companion view | ❌ | Mobile | Read-only workflow viewer for phone (show run status, trigger manual runs) |
| B.6 | Figma → workflow importer | ❌ | Import | Parse a Figma node tree and map it to a CK8T workflow skeleton |
