# Test Plan — Task 15: Block Structure Refactor + Block Debugger + NS9 Blocks

## Pre-conditions
- VS Code extension rebuilt: `npm run vscode` in `ck8t/` directory
- Extension reloaded in VS Code (Reload Window)
- A workflow with at least one Function block and one API or Agent block

---

## Section A — Block Debugger (Core Blocks)

### TC-15-A1: Open Block Debugger for a core block
1. Right-click an **API** block → "Debug Block"
2. **Expected**: BlockDebuggerPopup opens
3. **Expected**: File tabs appear for `extension.js` (and `client.js` if present)
4. **Expected**: Monaco editor shows the runner code for that block type

### TC-15-A2: Function block shows user code (not runner)
1. Add a Function block with code: `return input + ' hello'`
2. Right-click → "Debug Block"
3. **Expected**: Single tab `function.js` shows the USER's code (`return input + ' hello'`), not the generic function runner wrapper

### TC-15-A3: Set a breakpoint and run
1. In the Block Debugger popup for an API block, click line 5 in the gutter
2. Click "Run" — provide test input
3. **Expected**: Execution pauses at line 5 with a yellow highlighted line
4. **Expected**: "Resume" and "Step Over" buttons become active

### TC-15-A4: Resume from breakpoint
1. After TC-15-A3, click "Resume"
2. **Expected**: Execution continues to the next breakpoint or completes
3. **Expected**: Output panel shows the block result

### TC-15-A5: Step Over
1. Pause at a breakpoint (TC-15-A3)
2. Click "Step Over"
3. **Expected**: Execution advances one line; highlights the next executable line

### TC-15-A6: Stop execution
1. Pause at a breakpoint
2. Click "Stop"
3. **Expected**: Execution halts; popup shows stopped state

### TC-15-A7: Community block shows its runner files
1. Install any community block (e.g. `ideogram4-storybook`)
2. Add it to a workflow, right-click → "Debug Block"
3. **Expected**: Tabs show the community block's runner files from `~/.salilvnair/ck8t/blocks/<name>/runners/`

---

## Section B — Block Structure (Registry + Palette)

### TC-15-B1: All core blocks appear in palette
1. Open the block palette (left sidebar → "Add Block")
2. **Expected**: All original blocks visible in their existing categories
3. **Expected**: New NS9 group appears under "Tools & Integrations" → "NS9"

### TC-15-B2: NS9 blocks appear in NS9 group
1. Open palette → Tools → NS9
2. **Expected**: Three blocks visible: **NS9 Query**, **NS9 RLHF**, **NS9 Ingest**

### TC-15-B3: Block icons render correctly
1. NS9 Query → should show Search icon (magnifying glass)
2. NS9 RLHF → should show Agent icon
3. NS9 Ingest → should show Extension icon

### TC-15-B4: Drag NS9 block onto canvas
1. Drag **NS9 Query** onto the canvas
2. **Expected**: Block card appears with correct name and subblock fields:
   - MCP Server selector
   - Question (long input)
   - Top K Results
   - Include Live Data (switch)
   - Include Past Q&A (switch)

### TC-15-B5: NS9 RLHF block fields
1. Add NS9 RLHF block to canvas
2. **Expected**: Fields: MCP Server, Question, Wrong Answer, Correct Answer, Corrector, Propagate Immediately

### TC-15-B6: NS9 Ingest block fields
1. Add NS9 Ingest block to canvas
2. **Expected**: Fields: MCP Server, Source (dropdown: All/Code/Database/Logs/Docs/API/Ops/Glossary), Path Override

---

## Section C — NS9 Block Execution

### TC-15-C1: NS9 Query runs against a live NS9 MCP server
**Requires**: NS9 MCP server running and configured in MCP settings

1. Build workflow: `UserInput → NS9 Query → Response`
2. NS9 Query config: server=`ns9`, question=`what is status 500?`, top_k=5
3. Run with any input
4. **Expected**: NS9 Query block outputs:
   - `value` = context_text string
   - `context_text` = same string
   - `confidence` = float 0-1
   - `sources` = array

### TC-15-C2: NS9 Query with template question
1. NS9 Query question: `what is the status of {{input}}?`
2. Run with input `order 12345`
3. **Expected**: Question interpolated to `what is the status of order 12345?`

### TC-15-C3: NS9 RLHF records a correction
**Requires**: NS9 MCP server running

1. Build workflow: `NS9 RLHF → Response`
2. Config: question=`what is status 700?`, wrong_answer=`pending`, correct_answer=`completed successfully`, corrector=`test-user`
3. Run
4. **Expected**: Output contains `saved: true`, `correction_id: <number>`

### TC-15-C4: NS9 Ingest graceful failure (tool not in server)
1. Add NS9 Ingest block, configure any source
2. Run (even if NS9 MCP server is connected)
3. **Expected**: Block fails gracefully with error message:
   - `triggered: false`
   - `hint` field mentioning CLI workaround
   - No crash, workflow continues

---

## Section D — Block Imports (build verification)

### TC-15-D1: Build succeeds with new block structure
```bash
cd /Users/salilvnair/workspace/git/ck8t/ck8t
npm run vscode
```
**Expected**: Build completes with no import errors. All 51 blocks resolve.

### TC-15-D2: Registry exports all NS9 blocks
Open browser DevTools console after loading extension:
```js
import { getAllBlocks } from '@/src/ck8t/blocks/registry.js'
getAllBlocks().filter(b => b.type.startsWith('ns9'))
```
**Expected**: Returns 3 blocks: `ns9_query`, `ns9_rlhf`, `ns9_ingest`

---

## Known Test Limitations
- TC-15-C1 through TC-15-C3 require a live NS9 MCP server connection — skip in CI
- TC-15-A3 through TC-15-A6 (step-through) require the extension runner file to be valid JS that can run via `AsyncFunction`
- TC-15-C4 will pass once NS9 server is running (tool-not-found from MCP = caught error)
