# Sprint 6 — Workflow Execution & Run Panel Tests

---

## Test 6.1 — Run Panel Per-Node Navigation ❌

**Do this:**
1. Run a workflow with 5+ blocks.
2. In the Run panel, click on the output row for the 3rd block.

**Should happen:**
- The canvas scrolls and zooms to center on that block.
- The block is highlighted briefly to indicate it's the one being inspected.
- Clicking another block entry in the run panel re-focuses the canvas on that block.

---

## Test 6.2 — Step-by-step Debug Mode ❌

**Do this:**
1. Click the "Debug" button (next to Run) in the toolbar.
2. Start a run.

**Should happen:**
- Execution pauses after the first block completes, showing its output.
- A "Step →" button and "Continue ▶" button appear.
- "Step →" advances one block at a time.
- "Continue ▶" runs the rest without pausing.
- Intermediate block outputs are visible in the Run panel at each pause.
- Pressing Escape cancels the debug run.

---

## Test 6.3 — Execution Timeline Visualizer ❌

**Do this:**
1. Run a workflow.
2. After completion, look for a "Timeline" tab in the Run panel.

**Should happen:**
- A horizontal Gantt-style bar chart shows each block as a bar.
- Bar width represents duration (in ms or seconds).
- Bars are ordered top-to-bottom by execution start time.
- Hovering a bar shows: block name, start time, duration, status.
- Parallel blocks (fan-out) show overlapping bars at the same vertical position.

---

## Test 6.4 — Re-run from Node ❌

**Do this:**
1. Run a complete workflow successfully.
2. Right-click the 3rd block in the workflow.
3. Select "Re-run from here".

**Should happen:**
- The workflow re-runs starting from the 3rd block, using cached outputs from blocks 1 and 2.
- The 3rd block and all downstream blocks are re-executed with fresh results.
- Cached outputs from upstream blocks are shown in the Run panel as "cached".
- If cached outputs are stale (e.g. user changed an upstream block), a warning is shown.

---

## Test 6.5 — Run History per Workflow ❌

**Do this:**
1. Run a workflow three times with different inputs.
2. Look for a "History" tab in the Run panel.

**Should happen:**
- Last N runs are listed with timestamps and run status (success/error).
- Clicking a past run shows its inputs and outputs.
- A "Replay" button re-runs with the same inputs as that historical run.
- History persists after reloading the VS Code panel.

---

## Test 6.6 — Scheduled Run (Cron) ❌

**Do this:**
1. Add a `schedule` block to a workflow as the starter node.
2. Configure it with a cron expression: `*/5 * * * *` (every 5 minutes).
3. Enable the schedule and close the panel.

**Should happen:**
- The workflow runs automatically every 5 minutes even when the panel is not open.
- A notification appears in VS Code when a scheduled run completes or fails.
- The Run History (Test 6.5) shows each scheduled run with a "scheduled" badge.
- Disabling the schedule stops future runs immediately.
