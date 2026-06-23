# Test Plan — Sprint 6.7: Core Block Runner Refactor

## Goal
Verify all core blocks execute correctly via the new registry-based runner contract.

## Build Verification
- [ ] `npm run vscode` completes without errors
- [ ] `npm run ui` completes without errors (web dev mode)

## Registry Smoke Test
Open browser console on the running UI and verify:
```js
import { coreBlockRunners } from './src/ck8t/blocks/core-block-runners.js'
console.log([...coreBlockRunners.keys()]) // should list all ~50 block types
```

## Per-block tests (run each as a single-block workflow via Run Panel)

### Data/Transform blocks
- [ ] `json_path` — wire `{"a": {"b": 42}}` starter, path `a.b` → expect `42`
- [ ] `json_map` — wire object, map one key → verify mapped output
- [ ] `text_template` — `Hello {{input}}!` with string input → `Hello world!`
- [ ] `filter` — array input `[1,2,3,4]`, expression `item > 2` → `[3,4]`
- [ ] `sort` — array `[3,1,2]` → `[1,2,3]`
- [ ] `aggregate` — `sum` mode, array `[1,2,3]` → `6`
- [ ] `merge` — two upstream arrays, `append` mode → concatenated array

### Logic/Flow blocks
- [ ] `condition` — expression evaluates correctly, returns `{ branch, value }`
- [ ] `if_else` — true/false branches route correctly
- [ ] `switch` (switch_case) — matching case routes to correct branch
- [ ] `variables` — sets and returns named variables

### Loop blocks
- [ ] `for_loop` — `count=3` → `{ iterations: [0,1,2], last: {i:2, index:2} }`
- [ ] `for_each` — array input `[a,b,c]` → `{ iterations: [a,b,c], last: c }`
- [ ] `parallel` — passes through with `{ results, winner }`

### Timing blocks
- [ ] `delay` — unit=ms, value=100 → completes in ~100ms, returns input
- [ ] `wait` — mode=duration, value=1, unit=s → waits ~1s

### Crypto block
- [ ] `crypto` — op=sha256, string input → hex hash string

### HTTP blocks
- [ ] `api` — GET `https://httpbin.org/get` → `{ data, status: 200, headers }`
- [ ] `http_response` — status=200, data wired → `{ data, status, headers }`

### Utility blocks
- [ ] `show_preview` — input passes through unchanged
- [ ] `image_url_preview` — image URL input → `{ url, ... }`
- [ ] `function` — JS `return input * 2` with number `21` → `42`
- [ ] `mapper` — mode=json_parse, JSON string → parsed object
- [ ] `error_handler` — wraps error, returns `{ error, input }`

### NS9 blocks
- [ ] `ns9_query` — returns `{ context_text, confidence }` (or error if server down)
- [ ] `ns9_rlhf` — returns `{ saved }` or error
- [ ] `ns9_ingest` — returns `{ triggered }` or error

### Multi-agent blocks (extension only)
- [ ] `chain_of_thought` — needs model configured, returns `{ reasoning_steps, conclusion, confidence }`
- [ ] `slave_agent` — needs model configured, executes single agent task
- [ ] `master_agent` — needs model configured + slave_agent nodes in canvas

### Stub blocks (should throw helpful errors)
- [ ] `loop` — throws "not supported in browser mode"
- [ ] `sub_workflow` — throws "requires convengine backend"
- [ ] `table` — throws "not supported in standalone mode"
- [ ] `slack` — throws "requires the ck8t-server"
- [ ] `smtp` — throws "requires the ck8t-server"
- [ ] `postgresql` — throws "ck8t-server bridge"
- [ ] `redis` — throws "direct Redis requires the ck8t-server"
- [ ] `mongodb` — throws "direct MongoDB requires the ck8t-server"

## Regression checks
- [ ] Community blocks still load and run (loadInstalledBlocks still works)
- [ ] `customBrowserBlockRunners` populated after install
- [ ] Block debugger right-click still works (no regression from previous sprint)
- [ ] Workflow snapshot still saves/restores correctly after execution

## Extension build
- [ ] `npm run vscode` builds without TypeScript errors in graph-runner.ts
- [ ] Extension loads in VS Code without console errors
- [ ] Run a workflow in the extension panel end-to-end
