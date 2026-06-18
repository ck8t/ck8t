# Sprint 12 — Integrations & Protocol Blocks Tests

---

## Test 12.1 — GraphQL Request Block ❌

**Do this:**
1. Add a `graphql` block to the canvas.
2. Enter endpoint: `https://countries.trevorblades.com/graphql`.
3. In the schema introspection panel, browse to `Query.countries`.
4. Build query: `{ countries { name code } }`.
5. Run the workflow.

**Should happen:**
- Schema introspection auto-loads available queries/types from the endpoint.
- The query runs and returns a JSON array of countries.
- Variables can be set and referenced in the query with `$variableName`.
- Output port `data` carries the `data` key of the GraphQL response.
- Output port `errors` carries any GraphQL errors separately.

---

## Test 12.2 — WebSocket Block ❌

**Do this:**
1. Add a `websocket` block as a starter node.
2. Configure: URL = `wss://echo.websocket.org`, message = `"hello"`.
3. Run the workflow.

**Should happen:**
- WebSocket connects, sends "hello", receives the echo back.
- Output port `message` carries each received message.
- `disconnect` trigger closes the connection.
- Streamed messages fan out to downstream blocks as they arrive.
- Connection error is surfaced in the Problems panel (not a hard crash).

---

## Test 12.3 — gRPC Block ❌

**Do this:**
1. Add a `grpc` block to the canvas.
2. Configure: server = `localhost:50051`, service = `Greeter`, method = `SayHello`.
3. Upload or paste the `.proto` file.
4. Set request body: `{ "name": "CK8T" }`.
5. Run the workflow.

**Should happen:**
- gRPC call is made, response `{ "message": "Hello CK8T" }` is returned.
- Output port `response` carries the decoded proto response.
- Proto schema is parsed to show available services and methods in a dropdown.
- TLS and metadata headers are configurable.

---

## Test 12.4 — Browser Automation Block ❌

**Do this:**
1. Add a `browser` block to the canvas.
2. Configure: action = `navigate`, URL = `https://example.com`.
3. Chain: → action = `screenshot`.
4. Run the workflow.

**Should happen:**
- Playwright launches a headless browser (Chromium).
- Screenshot is returned as a `data:image/png;base64,...` on the `screenshot` output port.
- Chain multiple actions: navigate → wait → click selector → extract text.
- `page_text` output carries the visible text of the final page state.
- Headless/headful mode configurable.

---

## Test 12.5 — File Watcher Trigger Block ❌

**Do this:**
1. Add a `file_watcher` block as a starter node.
2. Configure: watch path = `/tmp/ck8t-watch`, event = `added`.
3. Build: `file_watcher → agent (describe file) → save_to_files (write description)`.
4. Enable the watcher. Copy a file into `/tmp/ck8t-watch/`.

**Should happen:**
- Workflow triggers within 1-2 seconds of the file appearing.
- `file_path`, `file_name`, `file_size` are available as outputs.
- Run History (Sprint 6.5) records each triggered run.
- Multiple files added quickly → multiple runs queued (Sprint 9.7).

---

## Test 12.6 — Git Commit Trigger ❌

**Do this:**
1. Add a `git_trigger` block as a starter.
2. Configure: repo path = a local git repo, event = `commit`.
3. Build: `git_trigger → agent (write changelog entry) → save_to_files`.
4. Make a commit in the watched repo.

**Should happen:**
- Workflow triggers within seconds of the commit.
- Outputs: `commit_hash`, `author`, `message`, `files_changed[]`.
- Only triggers on the configured repo path, not all git repos.

---

## Test 12.7 — S3 / Object Storage Block ❌

**Do this:**
1. Add an `s3` block to the canvas.
2. Configure: endpoint, bucket, key, action = `upload`.
3. Wire a `save_to_files` output (or `image_b64`) into the `content` input.
4. Run the workflow.

**Should happen:**
- File is uploaded to the S3 bucket at the configured key.
- Output: `url` (public URL if bucket is public), `etag`, `size`.
- Works with AWS S3, Cloudflare R2 (custom endpoint), MinIO.
- `download` action retrieves the file and returns it as a base64 `content` output.

---

## Test 12.8 — VS Code Notification Block ❌

**Do this:**
1. Add a `vscode_notify` block at the end of a workflow.
2. Configure: level = `info`, message = `Workflow completed: {{ $node["agent"].output.summary }}`.
3. Run the workflow.

**Should happen:**
- A VS Code info notification pops up in the bottom-right with the message.
- The expression in the message is resolved before display.
- Level `error` shows a red notification.
- Level `warning` shows a yellow notification.
- A "View Output" button in the notification opens the Run panel.
