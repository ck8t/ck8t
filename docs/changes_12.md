# Changes — Task 12: Monaco Editor

## Summary
Replaced CodeMirror with Monaco Editor for all `code` type subBlock fields in the inspector panel. Monaco provides VS Code-quality editing: bracket matching, autocomplete, format-on-type, multi-language syntax highlighting, and (with debug mode) a breakpoint gutter.

## New Files

| File | Purpose |
|---|---|
| `src/ck8t/components/monaco-setup.js` | Configures Monaco workers inline (CSP-safe for VS Code webview). Must be imported before any `<Editor>` renders — done in `webview-entry/main.jsx`. |
| `src/ck8t/components/BlockMonacoEditor.jsx` | Monaco wrapper with ck8t-tuned options. Same API as old `CodeEditor` plus debug props (`debugMode`, `breakpoints`, `onBreakpointsChange`). |

## Modified Files

| File | Change |
|---|---|
| `webview-entry/main.jsx` | Added `import '../src/ck8t/components/monaco-setup.js'` at top |
| `vite.extension.config.js` | Added `manualChunks` to split `monaco-editor` and `@monaco-editor/react` into their own chunks; raised `chunkSizeWarningLimit` |
| `src/ck8t/panel/SubBlockRenderer.jsx` | Replaced `CodeEditor` import with `BlockMonacoEditor`; added `useBlockDebugStore` subscription for `debugMode`/`breakpoints`; updated `case 'code'` render to use `BlockMonacoEditor` |
| `package.json` | Added `@monaco-editor/react`, `monaco-editor` dependencies |

## Languages Supported
`javascript`, `typescript`, `python`, `json`, `jsonschema` (auto-normalized)

## Bundle Size Note
Monaco adds ~1MB gzipped (`monaco-editor` chunk). Workers are bundled inline (`?worker&inline`) for VS Code webview CSP compatibility (same pattern as daakia). Optimization to use split workers is tracked in `todo.md`.

## DUI Relationship
This `BlockMonacoEditor` follows the same API as daakia's `dui/components/input/EditorView.tsx`. Both wrap `@monaco-editor/react` with identical options. When a shared DUI package is set up (tracked in todo.md), `BlockMonacoEditor` can be replaced with a direct import from DUI.
