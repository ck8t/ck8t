# Changes — Task 15: Block Structure Refactor + Block Debugger + NS9 Blocks

_Date: 2026-06-18_

## Summary

Three major areas completed in this session:

1. **Block Debugger (step-through)** — Full extension host wiring for `blockDebug:getFiles`, `blockDebug:runExtension`, `blockDebug:resume`, `blockDebug:stepOver`, `blockDebug:stop`. Core blocks now show their runner files in the debugger popup the same way community blocks do.
2. **Block Structure Refactor** — All 51 core blocks (48 original + 3 NS9) standardised to `<name>/ck8t-block.json` + `<name>/ui/<name>.js` + `<name>/runners/` layout.
3. **NS9 Blocks** — Three new blocks wired from scratch: `ns9_query`, `ns9_rlhf`, `ns9_ingest`.

---

## New Files

### Block Debugger

| File | Purpose |
|---|---|
| `extension/vscode/ck8t/src/panel/Ck8tPanel.ts` | Added `_blockDebugResumeResolve`, `_blockDebugStopped`; `blockDebug:getFiles/runExtension/resume/stepOver/stop` switch cases; `_sendBlockDebugFiles()`, `_runBlockDebugExtension()`, `_transformForDebug()`, `_isExecutableLine()` |

### Block Structure (per-block layout)

Each of the 51 core blocks now has:

```
src/ck8t/blocks/<name>/
  ck8t-block.json          — type, name, category, runners manifest
  ui/<name>.js             — block UI definition (moved from blocks/blocks/<name>.js)
  runners/client.js        — browser-side runner (where applicable)
  runners/extension.js     — Node.js/extension-side runner (where applicable)
  runners/server.js        — ck8t-server runner (currently placeholder for most)
```

`src/ck8t/blocks/blocks/index.js` — barrel re-export updated to point at `../<name>/ui/<name>.js` paths

### NS9 Blocks

| File | Purpose |
|---|---|
| `src/ck8t/blocks/ns9_query/ck8t-block.json` | Block manifest |
| `src/ck8t/blocks/ns9_query/ui/ns9_query.js` | Block UI: server selector, question, top_k, include_live, include_qa; outputs: value, context_text, confidence, sources |
| `src/ck8t/blocks/ns9_query/runners/extension.js` | Calls `ns9_query` MCP tool with template interpolation |
| `src/ck8t/blocks/ns9_rlhf/ck8t-block.json` | Block manifest |
| `src/ck8t/blocks/ns9_rlhf/ui/ns9_rlhf.js` | Block UI: question, wrong_answer, correct_answer, corrector, propagate_now |
| `src/ck8t/blocks/ns9_rlhf/runners/extension.js` | Calls `ns9_rlhf_correct` MCP tool |
| `src/ck8t/blocks/ns9_ingest/ck8t-block.json` | Block manifest |
| `src/ck8t/blocks/ns9_ingest/ui/ns9_ingest.js` | Block UI: server selector, source dropdown, path override |
| `src/ck8t/blocks/ns9_ingest/runners/extension.js` | Calls `ns9_ingest` MCP tool (⚠️ not yet in NS9 server — see Known Issues) |

---

## Modified Files

| File | Change |
|---|---|
| `src/ck8t/blocks/blocks/index.js` | Rewrote barrel: all 51 exports now point at `../<name>/ui/<name>.js` |
| `src/ck8t/blocks/registry.js` | Added `ns9_query`, `ns9_rlhf`, `ns9_ingest` entries; added NS9 sub-group under tools category |
| `src/ck8t/debug/BlockDebuggerPopup.jsx` | Merged useEffects; function block shows user code from subBlockValues; other blocks request files from extension host via `blockDebug:getFiles` |

---

## Block Runner Details

### Client runners (browser-safe)
`function`, `condition`, `if_else`, `if_elseif_else`, `switch_case`, `json_map`, `json_path`, `text_template`, `filter`, `sort`, `aggregate`, `merge`, `variables`, `delay`, `wait`, `response`, `http_response`, `show_preview`, `error_handler`, `crypto`

### Extension runners (Node.js)
`agent`, `api`, `mcp`, `ai_classifier`, `mapper`, `postgresql`, `redis`, `mongodb`, `smtp`, `slack`, `save_to_files`, `image_url_to_base64`, `chain_of_thought`, `master_agent`, `slave_agent`, `ns9_query`, `ns9_rlhf`, `ns9_ingest`

### Pass-through (no runner needed)
`starter`, `user_input`, `webhook_request`, `schedule`, `table`, `loop`, `parallel`, `sub_workflow`, `image_url_preview`, `skill`, `router`, `for_loop`, `for_each`

---

## Block Debugger — How Core Blocks Work

```
User opens BlockDebuggerPopup for a core block (e.g. "agent")
  → BlockDebuggerPopup sends blockDebug:getFiles { blockType: 'agent', nodeId: '...' }

Ck8tPanel._sendBlockDebugFiles(blockType, nodeId)
  → Resolves workspaceRoot from this._extensionUri.fsPath (3 levels up)
  → Reads src/ck8t/blocks/<blockType>/ck8t-block.json
  → Reads runners listed in manifest (client.js, extension.js)
  → Posts blockDebug:files { files: [{ name, path, content, runnerType }] }

Also checks ~/.salilvnair/ck8t/blocks/ for community blocks with matching type
  → Prefers core block if found first
```

---

## NS9 MCP Tool Verification

Verified against `/Users/salilvnair/workspace/git/ck8t/ns9/ns9/mcp/server.py`:

| Tool | Status | Notes |
|---|---|---|
| `ns9_query` | ✅ Matches | Params: `question`, `top_k`, `include_live_data`, `include_past_qa` — all correct |
| `ns9_rlhf_correct` | ✅ Matches | Params: `question`, `wrong_answer`, `correct_answer`, `corrector`, `propagate_now` — all correct |
| `ns9_ingest` | ❌ Not in server | No MCP tool registered. Runner handles gracefully with error + hint. CLI workaround: `ns9 ingest <source>` |

---

## Known Issues / Gaps

- **`ns9_ingest` MCP tool missing**: The NS9 MCP server (Sprints 24-32) does not expose an `ns9_ingest` tool. Ingestion is CLI-only. Need to add `@app.tool` wrapper in `ns9/mcp/server.py` that calls the Python ingesters. The ck8t block runner returns a friendly error with a CLI hint.
- **Steps 4 & 5 still pending**: `graph-runner.ts` (extension) and `graph-runner.js` (client) still contain inline runner logic — not yet importing from the block runner files. These are tracked in todo.md as Step 4 and Step 5.
