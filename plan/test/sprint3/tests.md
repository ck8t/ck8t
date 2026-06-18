# Sprint 3 — Block Library Enhancements Tests

---

## Test 3.1 — show_preview Renders Images ❌

**Do this:**
1. Build a workflow: `Start → user_input → show_preview`.
2. In `user_input`, set the default value to a data URI: `data:image/png;base64,iVBORw0KGgo...` (any small PNG).
3. Run the workflow.

**Should happen:**
- The Preview block output in the Run panel shows a rendered image, not raw base64 text.
- Also test with `data:image/jpeg;base64,...` — should also render.
- Text strings that are NOT data URIs render as plain text (no broken image icon).

---

## Test 3.2 — save_to_files Decodes Base64 Binary ❌

**Do this:**
1. Build: `Start → user_input (data URI PNG) → save_to_files (format: binary)`.
2. Set filename to `test_{{timestamp}}.png`.
3. Run the workflow.

**Should happen:**
- A valid PNG file is saved to disk (not a text file containing base64 characters).
- Opening the file in Preview shows the image correctly.
- The `data:image/png;base64,` header is stripped before writing.
- If `format` is set to `text`, the raw data URI string is saved as-is.

---

## Test 3.3 — user_input Multiline Resize ❌

**Do this:**
1. Add a `user_input` block with `kind: longtext`.
2. Look at the textarea in the block on canvas.

**Should happen:**
- A resize handle appears at the bottom-right of the textarea.
- Dragging it vertically makes the textarea taller.
- The minimum height is respected (textarea doesn't collapse to 0px).
- The resized height is preserved when you click away and back.

---

## Test 3.4 — condition Block Visual Branch Feedback ❌

**Do this:**
1. Build: `Start → user_input → condition → [true branch: response] + [false branch: response]`.
2. Set the condition to check if the input equals "yes".
3. Run with input "yes". Then run again with input "no".

**Should happen:**
- After the "yes" run, the `true` output edge is highlighted green; `false` edge is dimmed.
- After the "no" run, the `false` edge is highlighted; `true` is dimmed.
- The highlight resets when you start a new run.

---

## Test 3.5 — for_each Progress Counter ❌

**Do this:**
1. Build: `Start → user_input (array JSON) → for_each → response`.
2. Set user_input default to `["a","b","c","d","e"]`.
3. Run the workflow.

**Should happen:**
- The `for_each` block shows "item 1 of 5", "item 2 of 5", etc. during execution.
- Progress counter is visible in the Run panel's node output area or as a badge on the block.
- Counter disappears (or shows "5 of 5 done") when the loop finishes.

---

## Test 3.6 — http_response Block Outputs ❌

**Do this:**
1. Build: `Start → webhook_request → http_response`.
2. Trigger the webhook with a POST request that has JSON body + custom headers.
3. Run the workflow.

**Should happen:**
- `http_response` outputs `status_code`, `headers`, and `body` as separate named ports.
- Each output is accessible via named wires to downstream blocks.
- `body` is parsed as JSON if Content-Type is application/json; otherwise raw string.

---

## Test 3.7 — mcp Block Tool Picker ❌

**Do this:**
1. Ensure at least one MCP server is connected (Settings → MCP Servers).
2. Drag an `mcp` block onto the canvas.
3. Open the block's inspector.

**Should happen:**
- A dropdown appears listing all tools from connected MCP servers.
- Selecting a tool auto-fills the tool name field.
- The dropdown groups tools by server name.
- Typing in the field filters the list.

---

## Test 3.8 — agent Block Monaco System Prompt ❌

**Do this:**
1. Click an `agent` block on the canvas to open its inspector.
2. Find the "System Prompt" field.

**Should happen:**
- A "Expand Editor" button opens a fullscreen/modal Monaco editor for the system prompt.
- The editor has syntax highlighting (markdown or plaintext).
- Changes saved in the modal editor are reflected back in the block's inspector.
- The modal can be closed with Escape.

---

## Test 3.9 — webhook_request Retry Policy ❌

**Do this:**
1. Add a `webhook_request` block to the canvas.
2. Open its inspector/sub-block configuration.

**Should happen:**
- `max_retries` field (number, default 0) is visible.
- `retry_delay_ms` field (number, default 1000) is visible.
- Setting `max_retries: 2` causes the block to retry 2 times on non-2xx response before failing.
- Each retry attempt is logged in the Trace panel.

---

## Test 3.10 — variables Block Scoped Lifetime ❌

**Do this:**
1. Build: `Start → variables (name: "counter", value: 0, scope: session) → for_each → [increment counter] → response`.
2. Run the workflow twice without reloading.

**Should happen:**
- `scope: run` — variable resets to 0 at the start of every execution.
- `scope: session` — variable retains its value between runs (counter increments across runs).
- The scope selector is a dropdown in the block's sub-block configuration.
