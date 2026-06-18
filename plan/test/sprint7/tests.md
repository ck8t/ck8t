# Sprint 7 — Developer Experience Tests

---

## Test 7.1 — Hot-reload Community Blocks ❌

**Setup:** Have the CUDA ID4 block installed.

**Do this:**
1. Edit `cuda-id4/ui/cuda-id4-loader.js` — change the block name to "Load Model v2".
2. Save the file.
3. Look at the CK8T panel (without reloading or re-running `npm run vscode`).

**Should happen:**
- The block name in the palette and on any existing canvas nodes updates to "Load Model v2" within a few seconds.
- No full extension reload required.
- Sub-block configuration for already-placed nodes is preserved.

---

## Test 7.2 — Block Scaffolding CLI ❌

**Do this:**
1. Open a terminal in the CK8T repo root.
2. Run: `npm run ck8t new-block my-new-block`

**Should happen:**
- A new directory `my-new-block/` is created with:
  - `ck8t-block.json` (with `id`, `name`, `version: "1.0.0"`, `author` from git config)
  - `ui/my-new-block.js` (block definition boilerplate with placeholder `run()`)
  - `runners/extension.js` (extension runner boilerplate)
  - `runners/server.js` (server runner boilerplate)
- The scaffolded block is immediately visible in the block palette.

---

## Test 7.3 — Block Version Diff on Upgrade ❌

**Setup:** Have CUDA ID4 at version 1.0.3 installed. Create an updated version 1.0.4 in source.

**Do this:**
1. Bump the version in `cuda-id4/ck8t-block.json` to `1.0.4` and make a small change.
2. In the CK8T panel, go to Block Manager.
3. Look at the CUDA ID4 entry.

**Should happen:**
- A "Update available: 1.0.3 → 1.0.4" badge appears on the block.
- Clicking "View Diff" opens a modal showing what changed (side-by-side or unified diff).
- "Update" button applies the new version.
- "Skip" dismisses the notification for this version.

---

## Test 7.4 — Keyboard Shortcuts Panel ❌

**Do this:**
1. Press `?` while the canvas is focused (not typing in an input).

**Should happen:**
- A modal or side panel appears listing all keyboard shortcuts.
- Shortcuts are grouped by category: Canvas, Node, Workflow, Debug.
- The modal closes on pressing `?` again, Escape, or clicking outside.
- Each shortcut shows the key combo for both Mac and Windows.

---

## Test 7.5 — Block Documentation Popup ❌

**Do this:**
1. On any block in the canvas, hover over or click the `?` icon on its header.

**Should happen:**
- A popup/drawer opens showing:
  - Block name and description
  - Input ports table: name, type, required, description
  - Output ports table: name, type, description
  - Example usage snippet
- The popup does not navigate away or open a URL.
- It uses the `BlockDocViewer` component and `block-docs-registry.js` data.

---

## Test 7.6 — CHANGELOG Auto-generation ❌

**Do this:**
1. Make a change to a community block and bump its version.
2. Run: `npm run changelog`

**Should happen:**
- A new `changes/change_MM_DD_YYYY_HH_MM_SS.md` file is created.
- The file is pre-filled with a summary from the most recent git commits.
- Files changed in those commits are listed under "Files Modified".
- The existing changelog files are not modified.
