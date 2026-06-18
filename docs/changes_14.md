# Changes — Task 14: Block Debug Mode

## Summary
Added an on-canvas "Debug Mode" per block. When enabled:
- The Monaco editor for that block shows a **breakpoint gutter** (click line numbers to set breakpoints)
- The block gets a green **DBG badge** on the canvas
- When the block runs, all `console.log/info/warn/error` calls are **captured** (not just printed to browser console)
- A **Block Debug panel** in the bottom toolbar shows the captured snapshot: input, output, console logs, breakpoints set, duration, errors

## New Files

| File | Purpose |
|---|---|
| `src/ck8t/stores/block-debug-store.js` | Zustand store: tracks `debugEnabled` (Set of nodeIds), `breakpoints` (Map), `snapshots` (Map of last-run debug data) |
| `src/ck8t/run-extensions/block-debug-panel.jsx` | Auto-registered bottom panel. Shows snapshot cards for all blocks in debug mode. |

## Modified Files

| File | Change |
|---|---|
| `src/ck8t/canvas/WorkflowNode.jsx` | Added `useBlockDebugStore` import; `isDebugMode` + `toggleDebug` reactive state; **DBG badge** overlay; **"Enable/Disable Debug Mode"** context menu item with bug icon |
| `src/ck8t/panel/SubBlockRenderer.jsx` | Subscribes to `debugEnabled` + `breakpoints` from debug store; passes `debugMode`, `breakpoints`, `onBreakpointsChange` to `BlockMonacoEditor` |
| `src/ck8t/run/graph-runner.js` | `runFunctionNode` now accepts `nodeId`; creates a `console` capture object; when debug mode enabled for this node, stores a snapshot via `useBlockDebugStore.getState().setSnapshot()`. The function's code still receives `console` so `console.log(...)` in user code is captured. |
| `src/ck8t/run/panels/problems-panel.jsx` | Exempts `slave_agent` from "no incoming connection" warning (separate fix, included in same session) |
| `src/ck8t/ck8t.css` | Added styles: `.bs-node-debug-badge`, `.ck8t-bp-glyph`, `.ck8t-bp-line`, `.bs-dbg-*` panel styles |

## How it works — Runtime Flow

```
User toggles debug mode (right-click → Enable Debug Mode)
  → useBlockDebugStore.toggleDebug(nodeId)
  → WorkflowNode re-renders with DBG badge
  → BlockMonacoEditor shows gutter, user can click lines to set breakpoints

User runs workflow
  → graph-runner.js → runFunctionNode({ values, input, nodeId })
  → Creates capture = { log, info, warn, error, debug }
  → Calls user's function with (input, values, capture) as console
  → After run: checks useBlockDebugStore.getState().isDebugEnabled(nodeId)
  → If true: setSnapshot(nodeId, { input, output, consoleLogs, error, durationMs, breakpoints })

Block Debug panel (bottom toolbar "Block Debug" tab)
  → Reads snapshots from useBlockDebugStore
  → Shows expandable card per debugged block
  → Console section: color-coded log/info/warn/error lines
  → Breakpoints section: which lines were set
  → Input/Output: JSON tree views
```

## Breakpoints (current behavior)
Breakpoints are **stored and displayed** but do NOT pause execution (true step-through requires a debug adapter protocol). They are captured in the snapshot so you can see which lines were marked when the run happened. Full step-through debugging is planned in a future sprint (see todo.md).
