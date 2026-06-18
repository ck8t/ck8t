# Sprint 2 — Canvas & Workflow UX Tests

> These tests cover features planned in Sprint 2. Mark ❌ if the feature is not yet built.

---

## Test 2.1 — Workflow Export Includes Metadata ❌

**Do this:**
1. Create a workflow named "My Test Flow".
2. Right-click the workflow in the sidenav → Export JSON (or use canvas context menu).
3. Open the exported JSON in a text editor.

**Should happen:**
- JSON contains `"name": "My Test Flow"` at the top level.
- JSON contains `"createdAt"` ISO timestamp.
- JSON contains a `"version"` field.
- Re-importing the file preserves the workflow name (not "Imported Workflow").

---

## Test 2.2 — Duplicate Workflow Tab ❌

**Do this:**
1. Right-click any workflow tab in the tab bar.
2. Select "Duplicate".

**Should happen:**
- A new tab opens named "[Original Name] (copy)".
- The new tab's canvas has the same nodes/edges as the original.
- All node IDs in the duplicate are fresh UUIDs (check via DevTools — no IDs match the original).
- Editing the duplicate does not affect the original.

---

## Test 2.3 — Rename Workflow Tab Inline ❌

**Do this:**
1. Double-click the label of any workflow tab.

**Should happen:**
- The label becomes an editable input field, pre-filled with the current name.
- Pressing Enter or clicking elsewhere saves the new name.
- Pressing Escape cancels and restores the original name.
- The new name persists after switching tabs and back.

---

## Test 2.4 — Undo/Redo on Canvas ❌

**Do this:**
1. Drag a new block onto the canvas.
2. Press `Cmd+Z` (Mac) or `Ctrl+Z` (Windows/Linux).
3. Press `Cmd+Shift+Z` or `Ctrl+Y` to redo.

**Should happen:**
- Undo removes the newly added block from the canvas.
- Redo brings it back.
- Undo/redo works for: adding nodes, deleting nodes, moving nodes, adding edges, deleting edges.
- Undo does NOT trigger while typing inside a block's input fields.

---

## Test 2.5 — Multi-select Nodes ❌

**Do this:**
1. Shift-click three different nodes on the canvas.
   OR drag a selection rectangle over a group of nodes.
2. Drag the group to a new position.
3. Press Delete/Backspace.

**Should happen:**
- All selected nodes highlight simultaneously.
- Dragging moves the entire group.
- Delete removes all selected nodes and their connected edges.
- The selection box does not accidentally trigger block editing.

---

## Test 2.6 — Node Search Palette ❌

**Do this:**
1. Press `Cmd+K` or `/` while the canvas is focused (not typing in an input).

**Should happen:**
- A floating search palette appears centered on screen.
- Typing filters block names fuzzy-matched (e.g. "agent" shows "AI Agent", "Master Agent", "Slave Agent").
- Pressing Enter or clicking a result drops a new node of that type onto the canvas at the current viewport center.
- Pressing Escape closes the palette.

---

## Test 2.7 — Canvas Zoom Memory ❌

**Do this:**
1. On Workflow tab 1, zoom in to 150% and pan to the right side.
2. Switch to Workflow tab 2 (different zoom/position).
3. Switch back to tab 1.

**Should happen:**
- Tab 1 restores its 150% zoom and the same pan position.
- Tab 2 has its own remembered viewport.
- Viewport memory persists across the session (not reset on tab switch).

---

## Test 2.8 — Mini-map Toggle ❌

**Do this:**
1. Find the mini-map toggle button (bottom-right corner of canvas).
2. Click it.

**Should happen:**
- Mini-map hides.
- Clicking again shows it.
- The toggle state persists when switching workflow tabs.

---

## Test 2.9 — Fit-to-view Button ❌

**Do this:**
1. Zoom in very close so only 1 node is visible.
2. Click the "Fit to view" button (should be in the canvas toolbar or Controls panel).

**Should happen:**
- Canvas pans and zooms to show all nodes at once with padding.
- Works on both small workflows (2 nodes) and large ones (20+ nodes).

---

## Test 2.10 — Edge Labels ❌

**Do this:**
1. Click an edge between two blocks.
2. An "Add label" option appears (inline or in inspector).
3. Type a label like "image data".

**Should happen:**
- The label appears inline on the edge mid-point.
- Label persists after saving/reloading the workflow.
- Labels on named-port edges show the port name by default.

---

## Test 2.11 — Collapse/Expand Node ❌

**Do this:**
1. Click the collapse icon (or double-click header) on a block that has multiple sub-fields.

**Should happen:**
- The block body (sub-fields, input areas) collapses to just the title bar and port dots.
- Outgoing/incoming edges remain connected and visible.
- Clicking again expands the block back.
- Collapsed state is stored in `subBlockValues` and survives tab switch.
