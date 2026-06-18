# Test Plan — Task 14: Block Debug Mode

## Pre-conditions
- VS Code extension rebuilt (`npm run vscode`)
- Reload the extension in VS Code
- Have a workflow with at least one Function block

## TC-14-1: Enable Debug Mode via context menu
1. Right-click a **Function** block on the canvas
2. **Expected**: Context menu shows **"Enable Debug Mode"** with a green bug icon

## TC-14-2: DBG badge appears on block
1. After clicking "Enable Debug Mode"
2. **Expected**: A green **"DBG"** badge appears in the top-right corner of the block card

## TC-14-3: Monaco gutter shows in inspector
1. With debug mode enabled, click the Function block to open inspector
2. **Expected**: The code editor shows a **gutter margin** on the left (left of line numbers) for breakpoints

## TC-14-4: Set a breakpoint
1. In debug mode, open inspector for the Function block
2. Click on the gutter area next to any line number
3. **Expected**: A red dot appears in the gutter on that line

## TC-14-5: Remove a breakpoint
1. Click the same gutter dot again
2. **Expected**: The red dot disappears

## TC-14-6: Console capture works
1. Function block code:
   ```js
   console.log('hello', 42)
   console.warn('watch out')
   const result = input + ' processed'
   console.log('done', result)
   return result
   ```
2. Run the workflow with a User Input block providing some text
3. Open the **Block Debug** tab in the bottom toolbar
4. **Expected**:
   - Card for the Function block appears
   - Console section shows 3 entries:
     - `[log] hello 42`
     - `[warn] watch out`
     - `[log] done <value> processed`

## TC-14-7: Input and Output in snapshot
1. Same run as TC-14-6
2. **Expected**: Block Debug panel shows:
   - **Input** section: the value passed from the upstream block
   - **Output** section: the value returned by the function
   - **Duration**: time in ms

## TC-14-8: Breakpoints listed in snapshot
1. Set breakpoints on lines 2 and 4 before running
2. Run the workflow
3. **Expected**: Block Debug panel shows **"Breakpoints set"** section with "Line 2" and "Line 4" chips

## TC-14-9: Error capture
1. Function block code: `throw new Error('test error')`
2. Run workflow
3. **Expected**:
   - Block Debug panel shows a red **ERROR** badge on the card
   - "Error" section shows: `test error`
   - Problems panel also shows the error (existing behavior)

## TC-14-10: Disable Debug Mode
1. Right-click the block → "Disable Debug Mode"
2. **Expected**:
   - DBG badge disappears
   - Breakpoint gutter disappears in inspector
   - Block Debug panel no longer shows this block (existing snapshots are cleared on next `clearAll`)

## TC-14-11: Block Debug panel — empty state
1. With NO blocks in debug mode, click the "Block Debug" tab
2. **Expected**: "No blocks in debug mode. Right-click any block → Enable Debug Mode."

## TC-14-12: Multiple blocks in debug mode
1. Enable debug mode on two different Function blocks
2. Run the workflow
3. **Expected**: Block Debug panel shows two separate snapshot cards

## TC-14-13: Non-function blocks
1. Right-click a **Sort** block or **API** block
2. **Expected**: "Enable Debug Mode" still appears in menu (applies to all blocks)
3. Run the workflow — Sort/API blocks do NOT have console capture (only Function blocks do)
4. **Expected**: Block Debug panel shows the block as "debug enabled — run workflow to capture" but no console output section

## Known Limitations
- Breakpoints do NOT pause execution (no step-through yet — planned in next sprint)
- Console capture only works for **Function** blocks (uses `new Function` runner with injected `console`)
- Other block types (API, Agent, etc.) do not capture console but the debug badge and snapshot structure still applies to future extension
