# Sprint 9 — Canvas Power Features Tests

---

## Test 9.1 — Expression Editor `{{ }}` ❌

**Do this:**
1. Build: `Start → user_input (value: "Hello") → text_template → response`.
2. In `text_template`'s body field, type: `The user said: {{ $node["user_input"].value }}`.
3. Run the workflow.

**Should happen:**
- The template output is: `"The user said: Hello"` — the expression was resolved.
- Try: `{{ $node["user_input"].value.toUpperCase() }}` — JS expressions work too.
- Try a missing node: `{{ $node["nonexistent"].value }}` → renders as empty string, not crash.
- Expressions inside sub-block fields (not just templates) also resolve.

---

## Test 9.2 — Sticky Note Block ❌

**Do this:**
1. Drag a "Note" block from the palette onto the canvas.
2. Type some markdown text: `## Setup\nSet RUNPOD_URL in the Loader block`.
3. Drag-resize it.
4. Run the workflow.

**Should happen:**
- The note renders markdown with proper formatting.
- Note sits behind other blocks (lower z-index).
- Running the workflow skips the note — it appears "done" immediately.
- Yellow background distinguishes it from regular blocks.
- Its text is preserved across tab switches and reloads.

---

## Test 9.3 — Node Group / Frame ❌

**Do this:**
1. Draw a selection rectangle around 3 blocks.
2. Right-click selection → "Group".
3. Give the group a name: "Image Generation".
4. Collapse the group.

**Should happen:**
- A colored frame surrounds the 3 blocks with the group label.
- Dragging the frame moves all blocks inside together.
- Collapsing hides all block bodies, showing only a compact group badge.
- Expanding restores full view.
- Group color can be changed (right-click → Set color).

---

## Test 9.4 — Reroute Node ❌

**Do this:**
1. Double-click anywhere on an existing edge between two blocks.

**Should happen:**
- A small dot (reroute node) is inserted on the edge at the click point.
- The edge now routes through the dot — you can drag the dot to reshape the path.
- Right-click the reroute dot → "Remove reroute" — edge returns to direct.
- Reroute nodes are saved in the workflow JSON.

---

## Test 9.5 — Inline Output Preview on Node ❌

**Do this:**
1. Run any workflow.
2. After completion, look at the block bodies on the canvas.

**Should happen:**
- Each executed block shows a preview of its last output inline:
  - Image output → thumbnail (max 60px height).
  - String → first 80 characters truncated.
  - Number → the number.
  - JSON → `{ ... }` collapsed indicator.
- Clicking the preview expands it in the inspect panel.
- Previews clear on the next run start.

---

## Test 9.6 — Workflow Global Variables ❌

**Do this:**
1. In any sub-block text field, type: `{{ $workflow.vars.api_key }}`.
2. Open Workflow Settings → Variables.
3. Add: `api_key = "my-secret-abc123"`.
4. Run the workflow.

**Should happen:**
- The field resolves to `"my-secret-abc123"`.
- Variables panel shows all defined `$workflow.vars` entries.
- Variables persist across runs but NOT across workflow tabs (each workflow has its own).

---

## Test 9.7 — Run Queue Manager ❌

**Do this:**
1. Click Run 5 times rapidly before the first run finishes.

**Should happen:**
- A queue counter shows "4 queued" in the run toolbar.
- Runs execute sequentially (not in parallel), consuming the queue.
- A "Clear queue" button cancels all pending runs.
- Each completed run is listed in the queue history with duration.

---

## Test 9.8 — Canvas Bookmark ❌

**Do this:**
1. Zoom in to a specific part of a large workflow.
2. Right-click on canvas empty space → "Save View → Name this view: 'Image Gen Zone'".
3. Zoom out and pan far away.
4. Click the bookmark "Image Gen Zone" in the toolbar.

**Should happen:**
- Canvas instantly jumps to the saved zoom + pan position.
- Multiple bookmarks can coexist per workflow.
- Bookmarks survive tab switch and panel reload.

---

## Test 9.9 — Seed Pin / Value Lock ❌

**Do this:**
1. Run a CUDA ID4 generate workflow. Note the seed value in the output.
2. Right-click the `seed` output port on the Generate block → "Lock value".
3. Run the workflow again.

**Should happen:**
- The locked seed is used on the second run (same image generated).
- A lock icon appears on the `seed` output port.
- Right-click the locked port → "Unlock" → resumes random seed generation.

---

## Test 9.10 — Bypass Node Visual ❌

**Do this:**
1. Select a block on the canvas.
2. Press `Cmd+B` (Mac) or `Ctrl+B` (Win) to disable it.

**Should happen:**
- The block body shows a diagonal crosshatch pattern.
- A yellow "BYPASS" badge appears at the top of the block.
- The block passes its input through as output when run (unchanged).
- Previously: disabled blocks just became slightly transparent — this is now clearly distinct.
