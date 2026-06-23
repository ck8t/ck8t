# Test Plan — Block Debugger Tab Panel (Sprint 6.2)

## Setup
- Build: `npm run vscode`
- Open CK8T extension in VS Code
- Create a workflow with a **Text Template** (or any core) block, and a **Function** block

---

## Test Cases

### 1. Open Debugger
- [ ] Right-click a block → context menu shows "Debug"
- [ ] Clicking "Debug" opens the **Debugger tab** in the center pane (not a modal/popup)
- [ ] Bug icon in the sidenav rail is highlighted/active while the Debugger tab is focused
- [ ] Header shows: bug icon, "Debugger — {block title}", status chip — no HUD here (HUD floats separately, see §5)
- [ ] File tabs show the block's debuggable source (`client.js` for core/community blocks, `function.js` for Function blocks)
- [ ] No "Run block" button or Test Input textarea anywhere in the panel

### 2. Monaco Editor
- [ ] Code renders in Monaco with JS syntax highlighting
- [ ] Click gutter → red dot breakpoint appears at that line
- [ ] Click gutter again → breakpoint removed
- [ ] Breakpoint count badge updates in file tab

### 3. Glyph Context Menu
- [ ] Right-click gutter at a line without breakpoint → shows "Add Breakpoint", "Add Conditional Breakpoint…"
- [ ] Right-click gutter at a line with breakpoint → shows "Remove Breakpoint", "Disable Breakpoint", separator, "Edit Condition…"
- [ ] "Add Conditional Breakpoint…" → inline condition input appears at the line
- [ ] Type an expression and press Enter → breakpoint dot turns orange (conditional)
- [ ] Conditional breakpoint shows in BREAKPOINTS section with orange dot

### 4. Execute via canvas Run (no separate debug-run trigger)
- [ ] Set a breakpoint on a real statement *inside* the block's `run()` body
- [ ] Go back to the canvas and press the normal **Run** button for the workflow
- [ ] Execution reaches the breakpointed node, pauses, and the Debugger tab **auto-opens** showing the paused line
- [ ] Status chip shows "⏸ Paused · line N"; Monaco highlights the paused line
- [ ] VARIABLES section shows `input`, block values, and any declared locals captured at that point
- [ ] CALL STACK shows the current frame (`{blockType}.run` for module mode, `<anonymous>` for function-block script mode)
- [ ] Set a breakpoint on the block's `type:` line (outside `run()`) → Run → block executes normally, no pause, **no crash** ("Unexpected token" must not reappear)
- [ ] Set a breakpoint on the same line as a `const`/`let` declaration → Run → pauses cleanly, no "Cannot access before initialization" error
- [ ] If the Debugger tab is *not* open for a node, or its breakpoints are muted/disabled, Run executes that node normally — no debug detour
- [ ] **Master Agent / Slave Agent / Chain of Thought block**: open Debugger, set a breakpoint inside the `extension.js` tab (the only tab with a real `run()` body — its `client.js` is a 1-line re-export) → canvas Run → pauses correctly on that line
- [ ] **API / MongoDB / PostgreSQL / Redis / SMTP / Slack block**: set a breakpoint in the `extension.js` tab → canvas Run → block runs normally with **no pause** (this `extension.js` belongs to the separate extension-host engine, never executed by canvas Run in-browser) — confirm this is expected, not a bug

### 5. Floating HUD while Paused/Running
- [ ] HUD appears as a floating pill centered near the top of the panel — not a sticky full-width bar
- [ ] HUD is hidden entirely while idle (no active run)
- [ ] Continue (F5) → resumes to next breakpoint or completion; canvas execution continues downstream afterward
- [ ] Step Over (F10) / Step Into (F11) / Step Out (Shift+F11) → advances past the current pause
- [ ] Stop → throws a clean "Execution stopped by user" outcome, status resets, paused highlight cleared
- [ ] Restart → re-plays the last canvas-triggered run for this node from the top (does not require re-pressing canvas Run)
- [ ] Mute Breakpoints toggle → red tint when active; next canvas Run ignores all breakpoints for this node

### 6. Variables Panel
- [ ] Variables show in "Local" and "Block Inputs" scope groups
- [ ] `input` and block `values` appear under "Block Inputs"
- [ ] Declared variables appear under "Local"
- [ ] Object/array values show preview: `(3) [1, 2, 3]` or `{key: val}`
- [ ] Click expand arrow → nested tree opens
- [ ] Variable values update on each breakpoint pause (IntelliJ merge: no flicker on unchanged values)

### 7. Watch Section
- [ ] Click + to add expression
- [ ] Type `input` → shows current input value
- [ ] Type a declared local variable name → shows its value
- [ ] Type `nonexistent` → shows `<not available>`
- [ ] Click × to remove a watch expression

### 8. Breakpoints Section
- [ ] All set breakpoints listed with file name + line number
- [ ] Checkbox unchecked → breakpoint faded (disabled), excluded from the next canvas-triggered debug run
- [ ] Click breakpoint row → editor navigates to that file/line
- [ ] × button removes individual breakpoint
- [ ] × button in section header clears all breakpoints

### 9. Console Section
- [ ] `console.log('hello')` inside the block's code → appears in Console section as `[log] hello`
- [ ] `console.warn` → yellow; `console.error` → red

### 10. Completion
- [ ] After last breakpoint resumes and the block finishes → status shows "✓ Completed", Output section shows the return value
- [ ] On a real error in the block code (not a debug-engine bug) → status shows "✕ Error" with the error message in red, and the same error surfaces in the canvas's normal error/trace UI

### 11. Multi-block / tab switching
- [ ] Open Debugger for one node, switch to another tab, switch back → breakpoints and paused state persist
- [ ] Right-click a different block → Debug → Debugger tab switches context to the new node's files

---

## Edge Cases
- [ ] Block with no debuggable file → "No debuggable files for this block type." message, no crash
- [ ] Breakpoint on a comment-only or `}`/`{`-only line → no-op, never pauses there
- [ ] Function block: breakpoint set against the live `values.code` (not a stale snapshot) — editing the code after opening the Debugger tab and re-running picks up the change
- [ ] Multiple blocks debugged across separate workflow runs → each has its own debugger state (nodeId-isolated via `useBlockDebuggerStore`)
