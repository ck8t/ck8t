# Sprint 13 — Getting Started Workflows + Settings Restore

> Open CK8T: VS Code → Command Palette (`Cmd+Shift+P`) → "CK8T: Open Panel"

---

## Test 13.1 — Getting Started folder seeded on fresh install

**Setup:** Clear the extension's SQLite snapshot (rename/delete the `.db` file) so the app starts completely fresh.

**Do this:**
1. Reload the VS Code extension panel.
2. Look at the Workflows sidebar (left panel).

**Should happen:**
- A **Getting Started** folder is present at the top of the Workflows list.
- Expanding the folder shows **45 demo workflows** named `01 · Hello World — Text Template` through `45 · MCP Tool Call`.
- The "Demo Workflow" (original seed) is also present, either inside the folder or at root level.

---

## Test 13.2 — Demo workflows open on canvas

**Setup:** Getting Started folder is visible.

**Do this:**
1. Click `02 · Fetch JSON API — api + json_path` to open it on the canvas.
2. Verify the canvas shows 4 nodes: `Start → GET Todo → Extract → Preview`.
3. Click `15 · If / Else — boolean branch`.
4. Verify the canvas shows 6 nodes with two branches coming out of `Is Adult?`.

**Should happen:**
- All nodes render with the correct block type colors and titles.
- Edges are visible connecting the nodes in the described pattern.
- No errors in the browser console about missing block types.

---

## Test 13.3 — Run a no-credential demo end-to-end

**Setup:** Open `02 · Fetch JSON API — api + json_path`.

**Do this:**
1. Press `Cmd+1` (or click the Run button) to run the workflow.
2. Wait for execution to complete (up to 10 seconds).

**Should happen:**
- The `GET Todo` API node fetches `https://jsonplaceholder.typicode.com/todos/1`.
- The `Extract` JSON Path node extracts the `$.title` field.
- The `Preview` node shows the todo title (e.g. "delectus aut autem").
- No runtime errors in the trace panel.

---

## Test 13.4 — Run the agent demo (requires LLM)

**Setup:** Open `03 · Ask an Agent — user_input + agent`. Ensure an LLM provider is configured in Settings → LLM.

**Do this:**
1. In the `Question` node inspector, verify the default value is set to `"Explain quantum computing in 2 sentences."`.
2. Run the workflow (`Cmd+1`).

**Should happen:**
- The agent block sends the question to the configured LLM.
- A 2-3 sentence response appears in the `Preview` node output.
- The entire run completes without timeout.

---

## Test 13.5 — If/Else branching works

**Setup:** Open `15 · If / Else — boolean branch`.

**Do this:**
1. Set the `Age` user_input default value to `20`.
2. Run the workflow.
3. Check which preview node lights up — should be "Adult path".
4. Change the age to `15` and run again.

**Should happen:**
- Age `20` → only the "Adult path" show_preview node fires.
- Age `15` → only the "Minor path" show_preview node fires.
- The other branch node shows no output.

---

## Test 13.6 — Deleting a demo workflow removes it from sidebar

**Setup:** Getting Started folder is visible with 45 workflows.

**Do this:**
1. Right-click `01 · Hello World — Text Template` in the sidebar.
2. Click "Delete workflow" in the context menu.
3. Confirm the deletion in the modal.

**Should happen:**
- `01 · Hello World` disappears from the Getting Started folder.
- The folder still shows 44 remaining workflows.
- No other workflows are affected.

---

## Test 13.7 — Settings → Getting Started tab appears

**Do this:**
1. Press `Cmd+,` (or `Alt+,` in extension) to open Settings.
2. Look at the left sidebar.

**Should happen:**
- A **Getting Started** tab is present in the sidebar (between Audit and App Config).
- Clicking it shows the Getting Started settings pane.
- The pane shows a stat card: current count of workflows in the Getting Started folder.
- The "45 total demos available" stat card is present.
- A block coverage grid shows all block type tags.

---

## Test 13.8 — Restore Getting Started re-adds deleted demos

**Setup:** Delete 5-10 workflows from the Getting Started folder (as in Test 13.6). Note how many remain.

**Do this:**
1. Open Settings → Getting Started tab.
2. Verify the "workflows in folder" count reflects the reduced count.
3. Click **Restore Getting Started Workflows**.
4. A confirmation panel appears — read it, then click **Yes, restore all 45 demos**.

**Should happen:**
- A green success message "45 Getting Started workflows restored successfully." appears for ~3 seconds.
- The "workflows in folder" stat card updates to 45.
- The Workflows sidebar Getting Started folder now contains all 45 demos again.
- Any user-created workflows in OTHER folders are untouched.

---

## Test 13.9 — Restore does not duplicate already-present demos

**Setup:** All 45 Getting Started demos are present (no deletions). Do NOT delete anything.

**Do this:**
1. Open Settings → Getting Started tab.
2. Click **Restore Getting Started Workflows** → confirm.

**Should happen:**
- The Getting Started folder still shows exactly 45 workflows — not 90.
- No duplicate entries appear.
- The existing demos are replaced with the canonical versions (same content, same IDs).

---

## Test 13.10 — Cancel restore does nothing

**Setup:** Delete 3 workflows from Getting Started.

**Do this:**
1. Open Settings → Getting Started tab.
2. Click **Restore Getting Started Workflows**.
3. Click **Cancel** in the confirmation dialog.

**Should happen:**
- No workflows are restored.
- The "workflows in folder" count remains at 42 (or whatever it was after deletions).
- The confirmation panel disappears and the button returns to its normal state.

---

## Test 13.11 — Schedule trigger demo (no run needed, just structure)

**Setup:** Open `36 · Schedule — trigger on a cron schedule`.

**Do this:**
1. Inspect the canvas.
2. Open the `schedule` node inspector.

**Should happen:**
- The schedule node shows `cron: 0 9 * * *` and `timezone: America/New_York` in its sub-block values.
- The node is wired: `Schedule → API (Quote) → JSON Path → Agent (Inspire) → Preview`.
- No errors rendering the node.

---

## Test 13.12 — Webhook demo shows correct structure

**Setup:** Open `32 · Webhook Trigger — receive and respond`.

**Do this:**
1. Inspect the canvas.

**Should happen:**
- 3 nodes visible: `Receive (webhook_request) → Process (agent) → Respond (http_response)`.
- The `Receive` node has no input handles (it is the trigger).
- The `Respond` node has no output handles (it is the terminal).
- Edges flow: `body → in_input → data → in_body`.
