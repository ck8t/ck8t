# CK8T — Test Checklist

> Legend: ✅ Pass | ❌ Fail | ⏭ Skip (needs credentials)
> Workflows 01-45 = core blocks. Workflows 46-65 = community blocks + debugger.
> Run from: canvas Run button (unless noted). All W01-W65 are in the **Getting Started** folder.

---

## How to Run

1. Open CK8T in VS Code (`npm run vscode` → reload extension)
2. Sidebar → **Getting Started** folder → open a workflow
3. Press the **Run** button on the canvas
4. Check the output in the **Preview** or **Run** panel

---

## W01 · Hello World — Text Template

| Step | What to do | Expected |
|---|---|---|
| 1 | Open workflow, press Run | "Hello, Alice! 👋" greeting renders in Preview |
| 2 | Change user_input default to "Bob", run again | Preview shows "Hello, Bob!" |
| 3 | Check text_template node | `{{name}}` resolved from function output |

---

## W02 · Fetch JSON API — api + json_path

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Fetches `jsonplaceholder.typicode.com/todos/1`, Preview shows todo title string |
| 2 | Verify json_path `$.title` extracted only the title field, not the full object | Preview is a plain string, not JSON |

---

## W03 · Ask an Agent — user_input + agent

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run with default question | Agent returns 2-3 sentence answer about quantum computing |
| 2 | Change question to "What is recursion?", run again | Different concise answer |
| **Prereq** | AI provider configured with valid key | — |

---

## W04 · Run JavaScript — function block

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ sequence: [0,1,1,2,3,5,8,13,21,34], sum: 88, description: "First 10 Fibonacci numbers" }` |

---

## W05 · Save to File — save_to_files

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Agent writes haiku, file saved to `./output/haiku.txt` |
| 2 | Check `./output/haiku.txt` exists | Contains a 3-line haiku |
| **Prereq** | AI provider configured | — |

---

## W06 · Template Builder — multi-field template

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows formatted Employee Profile with Alice's data |
| 2 | Verify `{{name}}`, `{{role}}`, `{{company}}`, `{{years}}`, `{{skills}}` all resolved | No raw `{{}}` placeholders remain |

---

## W07 · Add a Delay — delay block

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Run takes ~1.5 seconds; Preview shows `{ message: "Resumed after delay!", elapsed_ms: ~1500 }` |

---

## W08 · Workflow Variables — variables block

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows the hardcoded message about variables |
| 2 | Verify 3 variables defined in variables node: API_BASE_URL, MAX_RETRIES, DEBUG_MODE | All visible in node inspector |

---

## W09 · Sentiment Analysis — agent JSON output

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ sentiment: "positive", score: 0.9+, confidence: ..., key_phrases: [...] }` |
| 2 | Change input to a negative sentence, run again | sentiment flips to "negative" |
| **Prereq** | AI provider configured | — |

---

## W10 · URL Summarizer — api + agent pipeline

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Fetches TypeScript GitHub repo, agent returns 3-bullet summary |
| **Prereq** | AI provider configured | — |

---

## W11 · Code Reviewer — agent specialized prompt

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Agent identifies SQL injection in the default code, returns refactored version |
| **Prereq** | AI provider configured | — |

---

## W12 · Chain of Thought — step-by-step reasoning

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `conclusion` output (train problem: 2h 30m answer) |
| 2 | Check chain_of_thought node has `reasoning_steps` output too | Steps visible in Run panel |
| **Prereq** | AI provider configured | — |

---

## W13 · AI JSON Extractor — structured output

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ name: "Alice Johnson", age: 29, email: "alice@techcorp.com", ... }` |
| **Prereq** | AI provider configured | — |

---

## W14 · Translate Text — multi-language

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows JSON with `french`, `spanish`, `japanese` translations |
| **Prereq** | AI provider configured | — |

---

## W15 · If / Else — boolean branch

| Step | What to do | Expected |
|---|---|---|
| 1 | Default age 20, press Run | "Adult" preview node shows output; Minor preview node is empty |
| 2 | Change age to 16, run again | Minor path fires; Adult path empty |

---

## W16 · Switch — route by category

| Step | What to do | Expected |
|---|---|---|
| 1 | Default "bug", press Run | Bug template fires, Engineering team routing message shows |
| 2 | Change dropdown to "feature", run again | Feature template fires |
| 3 | Change to "billing", run again | Billing template fires |

---

## W17 · AI Classifier — category + confidence

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Category output = "billing"; confidence = high |
| 2 | Change input to a tech question, run again | Category shifts to "technical_support" |
| **Prereq** | AI provider configured | — |

---

## W18 · Error Handler — graceful fallback

| Step | What to do | Expected |
|---|---|---|
| 1 | Default valid URL, press Run | Normal API data returned, no fallback triggered |
| 2 | Change URL to `https://this-does-not-exist.invalid`, run again | Fallback JSON `{ "error": "Request failed", "recovered": true }` returned |

---

## W19 · If-Elseif-Else — multi-branch

| Step | What to do | Expected |
|---|---|---|
| 1 | Default score 85, press Run | "Grade B" preview fires |
| 2 | Score = 95 | Grade A fires |
| 3 | Score = 72 | Grade C fires |
| 4 | Score = 50 | Grade F (else branch) fires |

---

## W20 · Filter Array — keep matching items

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows 3 products (Widget A 4.5, Widget C 4.8, Widget E 4.2); Widget B (2.1) and D (3.9) excluded |

---

## W21 · Sort Array — order by field

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows employees sorted: Carol (135k), Alice (120k), Eve (110k), Bob (95k), David (85k) |

---

## W22 · Aggregate Data — sum / avg / count

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows total = 1409.95 (sum of 5 orders) |

---

## W23 · For Each Loop — iterate array

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows 4 iterations (Alice, Bob, Carol, David) |

---

## W24 · For Loop — count N iterations

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows array of 5 iteration results |

---

## W25 · JSON Path Query — nested values

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows a large integer (React's GitHub star count) |

---

## W26 · JSON Map — reshape data

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ full_name, contact_email, handle, phone_number }` — remapped from the raw API response |

---

## W27 · Mapper — convert between types

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows the original JSON object back — round-trip stringify → parse |

---

## W28 · Merge — combine two sources

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows merged object with both user and post fields |

---

## W29 · Crypto — SHA-256 hash

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run with default "Hello CK8T!" | Preview shows hex SHA-256 hash string |
| 2 | Change input text, run again | Different hash |

---

## W30 · REST GET — fetch any URL

| Step | What to do | Expected |
|---|---|---|
| 1 | Default URL (open-meteo weather), press Run | Preview shows `{ current_weather: { temperature, windspeed, ... } }` |
| 2 | Change URL to `https://jsonplaceholder.typicode.com/posts/1` | Returns post JSON |

---

## W31 · REST POST — send JSON payload

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | httpbin.org echoes back the JSON body; Preview shows `{ json: { message, timestamp, version } }` |

---

## W32 · Webhook Trigger — receive and respond

| Step | What to do | Expected |
|---|---|---|
| 1 | Open workflow (no Run button — starts from webhook) | webhook_request node shows the listen URL |
| 2 | POST to that URL via curl/Postman | http_response returns 200 with processed JSON |
| **Note** | VS Code extension must be active for the webhook port to be open | — |

---

## W33 · Image URL Preview — display from URL

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Random dog image URL fetched, image displayed inline in the image_url_preview block |

---

## W34 · Image to Base64 — convert URL to data URI

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows a long `data:image/jpeg;base64,...` string |

---

## W35 · Wait — pause for a fixed duration

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Takes ~2 seconds; Preview shows `{ message: "Waited 2000ms and resumed.", timestamp: ... }` |

---

## W36 · Schedule — cron trigger

| Step | What to do | Expected |
|---|---|---|
| 1 | Inspect schedule node | Shows `cron: 0 9 * * *` (daily 9 AM ET) |
| 2 | Do NOT press Run (schedule only fires on cron) | — |
| **Note** | Manual trigger not available for schedule-started workflows | — |

---

## W37 · Slack — send message ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Update token to a real Slack bot token + channel | — |
| 2 | Press Run | Message appears in the Slack channel |
| **Skip** | No Slack credentials | — |

---

## W38 · SMTP — send email ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Update SMTP credentials and to/from addresses | — |
| 2 | Press Run | Email delivered to inbox |
| **Skip** | No SMTP credentials | — |

---

## W39 · Redis — cache a value ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Ensure Redis running at `localhost:6379` | — |
| 2 | Press Run | SET succeeds, GET returns the same value, Preview shows it |
| **Skip** | No Redis | — |

---

## W40 · PostgreSQL — query database ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Update host/database/username/password | — |
| 2 | Press Run | Preview shows rows from the users table |
| **Skip** | No PostgreSQL | — |

---

## W41 · MongoDB — find documents ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Update connectionUrl and collection name | — |
| 2 | Press Run | Preview shows array of matching documents |
| **Skip** | No MongoDB | — |

---

## W42 · Table — read structured data ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Create a table in your workspace | — |
| 2 | Update `table` subBlock to your table name, press Run | Preview shows table rows |
| **Skip** | No workspace table created | — |

---

## W43 · Master-Slave Agents — orchestrated multi-agent

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run with default goal | Master coordinates two slaves; Preview shows synthesized TypeScript report |
| **Prereq** | AI provider configured | — |

---

## W44 · Parallel — run branches concurrently

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Both API calls fire simultaneously; Preview shows merged weather + number fact |
| 2 | Observe run panel — both api nodes show overlapping execution | Confirms parallel execution |

---

## W45 · MCP Tool Call ⏭

| Step | What to do | Expected |
|---|---|---|
| 1 | Add an MCP server in Settings → MCP | — |
| 2 | Update `server` and `tool` in the mcp node | — |
| 3 | Press Run | Tool result appears in Preview |
| **Skip** | No MCP server configured | — |

---

---

## Community Block Workflows (W46-W65)

> **Prereq for all story_splitter workflows:** ideogram4-storybook block installed at `~/.salilvnair/ck8t/blocks/ideogram4-storybook/`.
> **Prereq for storybook_pdf workflows:** VS Code extension active (bridge server running).

---

## W46 · Story Splitter — Chapter Mode

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | story_splitter splits the 4-chapter sample into 4 scene objects |
| 2 | Preview shows array with `{ index, title, content }` per scene | ✅ |
| 3 | Verify titles: "The Storm", "The Stranger", "The Letter", "The Truth" | ✅ |

---

## W47 · Story Splitter — Paragraph Mode

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ paragraph_count: N, paragraphs: [...] }` |
| 2 | Count > 4 (paragraphs are more granular than chapters) | ✅ |

---

## W48 · Story Splitter — Extract First Scene

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | text_template renders only Scene 1: "The Storm" chapter |
| 2 | Verify `{{title}}` and `{{content}}` resolved in output | ✅ |

---

## W49 · Story Splitter — Scene Stats

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows `{ scene_count: 4, total_words: N, avg_words_per_scene: N, titles: [...] }` |
| 2 | Total words > 0 | ✅ |

---

## W50 · Story Splitter — Max Scenes Limit

| Step | What to do | Expected |
|---|---|---|
| 1 | Default limit = 2, press Run | Preview shows array of 2 scenes (not 4) |
| 2 | Change limit to 1, run again | Only first scene returned |
| 3 | Change limit to 0, run again | All 4 scenes returned (0 = no cap) |

---

## W51 · Story Pipeline — Summarize Each Scene

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | for_each iterates 4 scenes; Preview shows all 4 iteration outputs |
| 2 | Verify `maxConcurrency: 2` — iterations 1+2 run in parallel, then 3+4 | ✅ |

---

## W52 · Story Pipeline — Filter Short Scenes

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows only scenes with ≥50 words (likely all 4 in the sample) |
| 2 | Change filter value to `200`, run again | Fewer scenes pass |

---

## W53 · Story Pipeline — Sort Scenes by Length

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows 4 scenes sorted by `word_count` descending |
| 2 | Scene with most content appears first | ✅ |

---

## W54 · Story Pipeline — AI Scene Title Generator

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Agent returns 4 suggested alternative titles, one per scene |
| **Prereq** | AI provider configured | — |

---

## W55 · Story Pipeline — Total Word Count

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run | Preview shows sum of all scenes' word counts (a single integer) |

---

## W56 · Storybook PDF — Generate PDF (extension.js path)

| Step | What to do | Expected |
|---|---|---|
| 1 | Ensure VS Code extension is active | — |
| 2 | Press Run | storybook_pdf calls `/ck8t/run-block` → extension.js generates PDF |
| 3 | Preview shows PDF output object | ✅ |
| 4 | Stop extension, press Run again | Error: "No server runner for block type: storybook_pdf" or bridge unreachable |

---

## W57 · Full Story Pipeline — Split → PDF

| Step | What to do | Expected |
|---|---|---|
| 1 | Ensure VS Code extension is active | — |
| 2 | Press Run | story_splitter runs in browser (fast), output feeds storybook_pdf which runs in extension host |
| 3 | Preview shows PDF | ✅ |
| 4 | Check run panel — story_splitter completes first, then storybook_pdf starts | ✅ |

---

## W58 · Story Pipeline — Split → PDF → Save to Disk

| Step | What to do | Expected |
|---|---|---|
| 1 | Ensure VS Code extension active, `./output/` directory writable | — |
| 2 | Press Run | PDF generated and saved to `./output/story.pdf` |
| 3 | Open `./output/story.pdf` in a PDF viewer | 4-chapter story renders correctly |

---

## W59 · Story Splitter — User Input → Scene Count

| Step | What to do | Expected |
|---|---|---|
| 1 | Press Run with default story | Preview shows `{ count: 4, titles: [...], first_100_chars: [...] }` |
| 2 | Replace user_input with your own story using `## Scene` headings | Correct scene count |

---

## W60 · Story Pipeline — Parallel Split + PDF

| Step | What to do | Expected |
|---|---|---|
| 1 | Ensure VS Code extension active | — |
| 2 | Press Run | story_splitter (browser) and storybook_pdf (extension.js) start concurrently |
| 3 | merge combines both; Preview shows `{ scene_count: 4, titles: [...], ...pdf_result }` | ✅ |

---

---

## Debugger Workflows (W61-W65 + manual tests)

> **Prereq:** VS Code extension active. Open workflow, right-click a block → **Debug**.

---

## W61 · Debugger Walkthrough — Function Block Breakpoint

| Step | What to do | Expected |
|---|---|---|
| 1 | Right-click "Compute" → Debug | Debugger tab opens; `function.js` shown in editor |
| 2 | Click line 4 (`const step1 = ...`) | Red dot breakpoint appears |
| 3 | Press canvas Run (not in Debugger) | Execution pauses at line 4; HUD appears |
| 4 | Check Variables panel | Shows `base: 100`, `multiplier: 3` |
| 5 | Click Continue | Advances to next breakpoint or completes |
| 6 | Click Stop | Status resets to idle |

---

## W62 · Debugger Walkthrough — Conditional Breakpoint

| Step | What to do | Expected |
|---|---|---|
| 1 | Right-click "Loop" → Debug; right-click line 5 (`result.push(item)`) → Add Conditional Breakpoint | Dialog appears |
| 2 | Enter condition: `result.length > 2` | Orange dot (conditional) appears |
| 3 | Press canvas Run | Pauses only when result has 3+ items (iteration 3, not 1 or 2) |
| 4 | Variables panel shows `i: 3`, `result.length: 3` | ✅ |

---

## W63 · Debugger Walkthrough — Step Over / Step Into

| Step | What to do | Expected |
|---|---|---|
| 1 | Right-click "Steps" → Debug; set breakpoint line 2 (`const raw = ...`) | ✅ |
| 2 | Press canvas Run; pauses at line 2 | Variables: nothing yet |
| 3 | Click Step Over (F10) | Advances to line 3; Variables: `raw` visible |
| 4 | Step Over again | Line 4; `words` appears as array |
| 5 | Continue stepping | Each variable appears as its line executes |

---

## W64 · Debugger Walkthrough — extension.js Path

| Step | What to do | Expected |
|---|---|---|
| 1 | Right-click "PDF" (storybook_pdf) → Debug | Debugger opens; shows `client.js` + `extension.js` file tabs |
| 2 | Click `extension.js` tab | Real Node code for `runStorybookPdf` visible |
| 3 | Set breakpoint on any line inside `runStorybookPdf()` | Red dot on that line |
| 4 | Press canvas Run | client.js runs first (fast); WS session opens; pauses at the breakpoint in extension.js |
| 5 | Variables panel shows real Node variables (`scenes`, `pdfDoc`, etc.) | ✅ |
| 6 | Click Continue | Run completes; PDF returned to canvas |
| 7 | Verify: set breakpoint only on `client.js` line instead | Should pause in-browser, NOT trigger WS session |

---

## W65 · Debugger Walkthrough — Watch Expressions

| Step | What to do | Expected |
|---|---|---|
| 1 | Right-click "Data" → Debug; set breakpoint line 10 (`const total = ...`) | ✅ |
| 2 | In Watch panel (right side), click `+` and add `data.length` | Entry appears |
| 3 | Add `data[0].price` | Second entry |
| 4 | Press canvas Run; pauses at line 10 | Watch shows `data.length: 3`, `data[0].price: 1.49` |
| 5 | Step Over; add watch `total` | Shows computed total value |

---

---

## Debugger — Node-side Tests (manual, not in GS folder)

> Uses the `debug-test-block` installed at `~/.salilvnair/ck8t/blocks/debug-test-block/`.
> Requires `npm run server` running.

### Test on Server: basic pause/resume

| Step | What to do | Expected |
|---|---|---|
| 1 | Add a `debug_test` node to any workflow | Block appears in palette under Custom |
| 2 | Right-click → Debug | Debugger opens with `client.js` and `server.js` tabs |
| 3 | Click `server.js` tab | Shows `const step1`, `const step2`, `const result` code |
| 4 | Set breakpoint on `const step2 = ...` | Red dot |
| 5 | Start `npm run server` | ck8t-server running on :3001 |
| 6 | Click **Test on Server** button in Run and Debug panel | Connects to WS; pauses at `const step2` |
| 7 | Variables panel shows `step1: "received: null"` | ✅ |
| 8 | Click Continue | Completes; Output shows `{ step1, step2, done: true }` |

### Test on Server: unreachable state

| Step | What to do | Expected |
|---|---|---|
| 1 | Stop `ck8t-server` | — |
| 2 | Click **Test on Server** | Button label shows "Connecting…" briefly then label "ck8t-server not running" appears |
| 3 | Start server again, click button | Normal debug session starts |

### Test on Server: Stop mid-session

| Step | What to do | Expected |
|---|---|---|
| 1 | Start session (hit breakpoint) | Paused at line |
| 2 | Click Stop in HUD | Session ends; status resets to idle; serverTestStatus resets |
| 3 | Press Test on Server again | Fresh session starts cleanly |

### Regression: canvas Run unaffected by Test on Server

| Step | What to do | Expected |
|---|---|---|
| 1 | Run any GS workflow (W01-W45) while Debugger tab has debug_test open with breakpoints | Canvas run completes normally — breakpoints on a different nodeId don't intercept |

### Regression: no extDebug when breakpoints only on client.js

| Step | What to do | Expected |
|---|---|---|
| 1 | Open storybook_pdf in Debugger; set breakpoints ONLY on `client.js` | ✅ |
| 2 | Press canvas Run | In-browser engine runs (no WS opened); pauses in client.js's simple fetch call |

### Regression: re-export blocks unchanged

| Step | What to do | Expected |
|---|---|---|
| 1 | Open master_agent in Debugger; check `client.js` | Shows `export { default } from './extension.js'` |
| 2 | Set breakpoint on extension.js (shows re-exported code) | Red dot |
| 3 | Press canvas Run | In-browser engine runs extension.js content as before (NOT WS session — it's a re-export, not a delegate) |

---

## Quick Smoke Test (5-minute check)

Run these 5 workflows in sequence to confirm nothing is broken after a build:

| # | Workflow | Pass condition |
|---|---|---|
| 1 | W01 Hello World | "Hello, Alice!" in Preview |
| 2 | W04 Function | Fibonacci sequence in Preview |
| 3 | W15 If/Else | Adult path fires for age 20 |
| 4 | W29 Crypto | SHA-256 hash string in Preview |
| 5 | W46 Story Splitter | 4 scenes with titles in Preview |
