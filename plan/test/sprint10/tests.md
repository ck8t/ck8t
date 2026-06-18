# Sprint 10 — Workflow Power Features Tests

---

## Test 10.1 — Error / Fallback Workflow ❌

**Do this:**
1. Create a "main" workflow and an "error handler" workflow.
2. In the main workflow settings, attach the error handler workflow as the on-error flow.
3. Deliberately break one block (invalid URL, bad API key).
4. Run the main workflow.

**Should happen:**
- When the main workflow errors, the error handler workflow triggers automatically.
- The error handler receives the error message and the failed block's name as inputs.
- The main workflow run shows "Failed → error handler triggered".
- If the error handler also fails, no infinite loop — it stops there.

---

## Test 10.2 — Wait-for-Webhook Resume Node ❌

**Do this:**
1. Build: `Start → agent (generate a task) → wait → agent (process result)`.
2. Run the workflow.
3. When the `wait` block is reached, copy the resume URL from the Run panel.
4. Use curl to POST to the resume URL: `curl -X POST <url> -d '{"approved": true}'`.

**Should happen:**
- Workflow pauses at `wait` and shows "Waiting for webhook..." with the resume URL.
- After the curl POST, the workflow resumes with `{ "approved": true }` as the wait block's output.
- The downstream `agent` block runs with the resumed data.
- The resume URL works exactly once (subsequent calls are rejected).

---

## Test 10.3 — Workflow Versioning / Snapshots ❌

**Do this:**
1. With a workflow open, click "Save Snapshot" in the workflow toolbar.
2. Name it "Before CUDA changes".
3. Make destructive changes to the canvas (delete 2 blocks).
4. Open version history → select "Before CUDA changes" → click Restore.

**Should happen:**
- The canvas restores to exactly the state at snapshot time.
- All node positions, edges, and sub-block values are restored.
- The current (post-change) state is auto-saved as "Auto-save before restore" so it's recoverable.
- Snapshots are listed with date, time, and name.

---

## Test 10.4 — Multi-run Compare ❌

**Do this:**
1. Open the "Multi-run" mode (button in toolbar).
2. Configure 3 runs with different seed values: 42, 123, 999.
3. Click "Run All".

**Should happen:**
- All 3 runs execute (sequentially or with configurable parallelism).
- Results appear in a side-by-side comparison grid: 3 columns, each showing node outputs.
- Image outputs in the grid are rendered as thumbnails.
- "Export comparison" saves all results to a JSON or CSV file.

---

## Test 10.5 — Live Variable Watch Panel ❌

**Do this:**
1. Right-click the `image_b64` output port on the Generate block → "Add to Watch".
2. Run the workflow.

**Should happen:**
- A floating "Watch" panel appears (or a tab in the run panel).
- During the run, as `image_b64` is produced, it shows the thumbnail live.
- Multiple watches can coexist (pin multiple outputs).
- Watches persist across runs and show the last value between runs.

---

## Test 10.6 — Workflow Test Runner ❌

**Do this:**
1. On any workflow, open "Tests" panel → "Add Test Case".
2. Set expected output for the final node: `{ "summary": "[some text]" }`.
3. Set assertion: `output.summary.length > 10`.
4. Run `npm run test:workflow -- "Demo Workflow"` in terminal.

**Should happen:**
- The test runner executes the workflow and checks assertions.
- Pass: green checkmark + "1/1 assertions passed".
- Fail: red ✗ + diff showing expected vs actual.
- Exit code 1 on failure (CI-friendly).
- Works in both VS Code panel AND headless terminal mode.

---

## Test 10.7 — Sub-workflow Typed Parameters ❌

**Do this:**
1. Create a sub-workflow called "Image Resizer" with a typed `input_url: string` parameter and `resized_url: string` output.
2. Place a `sub_workflow` block referencing "Image Resizer".
3. Wire a string output to `input_url` and a string input from `resized_url`.

**Should happen:**
- The sub-workflow block shows named input/output ports matching the parameter schema.
- Wiring a `number` to `input_url: string` shows a type mismatch warning.
- Running the workflow passes the typed values in/out correctly.

---

## Test 10.8 — Conditional Edge (Branch Guard) ❌

**Do this:**
1. Right-click an edge between two blocks → "Add condition".
2. Enter expression: `$value.length > 100`.
3. Run the workflow with short input (< 100 chars) and long input (> 100 chars).

**Should happen:**
- Short input: the edge does not pass data (downstream block doesn't run).
- Long input: the edge passes data normally.
- A small padlock icon on the edge indicates it has a guard condition.
- Clicking the icon shows/edits the condition expression.

---

## Test 10.9 — Workflow Secrets Vault ❌

**Do this:**
1. Open Workflow Settings → Secrets Vault.
2. Add secret: `RUNPOD_KEY = "pod_abc123xyz"`.
3. In the Loader block's `server_url` field, type `{{ $secret.RUNPOD_KEY }}`.
4. Export the workflow JSON.

**Should happen:**
- The exported JSON does NOT contain the secret value — only `{{ $secret.RUNPOD_KEY }}`.
- At runtime, the expression resolves to the actual key from the vault.
- Secrets are encrypted at rest in SQLite (verify: open SQLite file — value is not plaintext).
- Deleting a secret from the vault causes any block using it to show an "unresolved secret" warning.

---

## Test 10.10 — Batch Input from CSV ❌

**Do this:**
1. Add a `batch_input` block as the starter node.
2. Point it to a CSV file with 5 rows (e.g. column `prompt`).
3. Wire its `row` output to a Generate block's `prompt` input.
4. Run the workflow.

**Should happen:**
- The workflow runs 5 times, once per CSV row.
- Progress shows "Row 2 of 5" in the Run panel.
- Each run's output is collected and shown as a list in the final output.
- Failing rows are skipped with an error logged (other rows continue).
