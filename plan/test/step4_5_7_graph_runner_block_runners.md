# Test Plan — Steps 4, 5, 7: Graph Runner Block Runner Delegation

## Summary
Verifies that orchestration blocks (chain_of_thought, slave_agent, master_agent) now run via the
canonical block runner files instead of duplicated inline logic, and that ck8t-block.json manifests
can self-register a client browser runner.

---

## Step 4 — extension/vscode/ck8t/src/engine/graph-runner.ts

### T4.1 — Build passes
**Steps:** `npm run vscode`
**Expected:** Exits 0, no TypeScript or esbuild errors. esbuild bundles
`src/ck8t/blocks/chain_of_thought/runners/extension.js` etc. into `out/extension.js`.

### T4.2 — chain_of_thought runs in extension mode
**Steps:**
1. Open CK8T extension in VS Code.
2. Create a workflow: Text → chain_of_thought → Show Preview.
3. Set model in chain_of_thought (e.g. `gpt-4o-mini`), set Question = "Why is the sky blue?".
4. Run workflow.
**Expected:** chain_of_thought output contains `reasoning_steps` array, `conclusion` string,
`confidence` number. Show Preview renders the conclusion.

### T4.3 — slave_agent / master_agent run in extension mode
**Steps:**
1. Create: Text → master_agent with 2 slave_agent nodes registered (drag onto master).
2. Set each slave's capability_label and model.
3. Set master's question.
4. Run.
**Expected:** master_agent outputs `final_answer`, `slave_outputs` (2 entries), `cot_plan`.
Each slave's answer appears in `slave_outputs`. No "not a function" errors.

### T4.4 — Inline functions gone (no regression)
**Steps:** `grep -n "runChainOfThoughtNode\|runSlaveAgentNode\|runMasterAgentNode" extension/vscode/ck8t/src/engine/graph-runner.ts`
**Expected:** No matches (functions deleted).

---

## Step 5 — src/ck8t/run/graph-runner.js (client/web mode)

### T5.1 — Imports present
**Steps:** `grep -n "_runCot\|_runSlave\|_runMaster\|_makeCallAgent" src/ck8t/run/graph-runner.js | head -10`
**Expected:** Import lines at top of file, `_makeCallAgent` function definition, and usage in switch cases.

### T5.2 — Inline functions deleted
**Steps:** `grep -n "runChainOfThoughtNode\|runSlaveAgentNode\|runMasterAgentNode\|_topoSortSteps" src/ck8t/run/graph-runner.js`
**Expected:** No matches.

### T5.3 — chain_of_thought runs in web UI mode
**Steps:**
1. `npm run ui` → open http://localhost:5173.
2. Create workflow: Text → chain_of_thought → Show Preview.
3. Configure model (must be set in LLM Config settings).
4. Run.
**Expected:** chain_of_thought produces `reasoning_steps` array and `conclusion`. No console errors.

### T5.4 — model fallback: value from store when not in subBlockValues
**Steps:** Create chain_of_thought block, leave model picker blank, set a default model in
Settings → LLM Config. Run.
**Expected:** Block resolves model from `useLlmConfigStore.getState().getDefaultModel()` and runs
without "No model configured" error.

### T5.5 — _makeCallAgent adapter bridges correctly
**Steps:** Check console during chain_of_thought run.
**Expected:** callLlmWithFallback is called (look for `[ck8t][llm-fallback][...]` debug log).
No `res.output` undefined error.

---

## Step 7 — loadInstalledBlocks client runner self-registration

### T7.1 — ck8t-block.json with clientRunner field
**Steps:**
1. Create a test community block with `clientRunner: "runners/browser.js"` in its `blocks` entry
   in `ck8t-block.json`.
2. Serve it via the ck8t-server.
3. Open the web UI.
4. Call `loadInstalledBlocks()` (happens automatically on mount).
5. Inspect `customBrowserBlockRunners` in browser console:
   `window.__DEBUG_RUNNERS = [...customBrowserBlockRunners.entries()]`
**Expected:** The block's type appears in `customBrowserBlockRunners` with its `run` function.

### T7.2 — manifest.runners.client fallback
**Steps:** Same as T7.1 but set `runners: { client: "runners/browser.js" }` at manifest top level
instead of per-block `clientRunner`. Remove `clientRunner` from the block entry.
**Expected:** Same result — `customBrowserBlockRunners` has the block type registered.

### T7.3 — Missing clientRunner field → no error
**Steps:** Install a block with no `clientRunner` field and no `manifest.runners.client`.
**Expected:** `loadInstalledBlocks()` completes without error. Block is registered in `registry` via
its UI file. No entry in `customBrowserBlockRunners` (block falls back to server-side execution).

### T7.4 — Bad runner URL → warning, no crash
**Steps:** Set `clientRunner: "runners/nonexistent.js"` in a block's manifest entry.
**Expected:** `console.warn('[ck8t] Failed to load client runner...')` is logged. The block's UI
still loads normally. `loadInstalledBlocks()` does not throw.

---

## Regression Tests

### R1 — Build clean after all changes
`npm run vscode` → must exit 0.

### R2 — Other orchestration blocks unaffected
Verify `agent`, `chain_of_thought` (basic), and other core blocks (text, api, condition) still run
in both extension and web modes.

### R3 — customBrowserBlockRunners not double-registered
Open app twice (hot reload). Verify `customBrowserBlockRunners.size` doesn't grow on each reload
(the `!has()` guard prevents duplicate registration).
