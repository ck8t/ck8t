# Test Plan — Task 12: Monaco Editor

## Pre-conditions
- VS Code extension rebuilt (`npm run vscode`)
- Reload the extension in VS Code (Ctrl+Shift+P → "Developer: Reload Window")

## TC-12-1: Monaco renders in Function block inspector
1. Add a **Function** block to the canvas
2. Click it to open the Inspector panel
3. **Expected**: The `Code` field renders as a Monaco editor (VS Code style, dark theme, line numbers on left, bracket highlighting)
4. **Not expected**: A flat gray CodeMirror textarea

## TC-12-2: Syntax highlighting
1. In the Function block code field, type:
   ```js
   const x = { a: 1, b: [1, 2, 3] }
   return x.a
   ```
2. **Expected**: keywords (`const`, `return`) highlighted, string/number colors, bracket pair coloring

## TC-12-3: Autocomplete
1. In the Function block code field, type `con` then wait 300ms
2. **Expected**: Monaco autocomplete dropdown suggests `console`, `const`, etc.

## TC-12-4: Format on Shift+Alt+F
1. Paste messy code: `const x={a:1,b:2};return x`
2. Press **Shift+Alt+F**
3. **Expected**: Code is auto-formatted with proper spacing

## TC-12-5: Copy/Paste works in webview
1. Select some code in the Monaco editor
2. Press **⌘C** (macOS) or **Ctrl+C** (Windows)
3. Click elsewhere, press **⌘V** / **Ctrl+V**
4. **Expected**: Text pastes correctly (uses Clipboard API, not Monaco's internal clipboard)

## TC-12-6: JSON editor in JSON blocks
1. Add a **Variables** block or any block that has a `json` type code field
2. Open inspector
3. **Expected**: Editor uses JSON mode (no `return` keyword highlighting, valid JSON coloring)

## TC-12-7: Python blocks
1. Add a **Function** block, set language to Python (if sub.language = 'python')
2. **Expected**: Python syntax highlighting (keywords: `def`, `import`, etc.)

## TC-12-8: Resize works
1. Resize the inspector panel vertically
2. **Expected**: Monaco editor resizes with the panel — no blank space, no scrollbar issues

## TC-12-9: CodeMirror still available
- The old `CodeEditor.jsx` (CodeMirror) is NOT deleted — it's still available for blocks that explicitly opt into it. Verify no import errors in console.
