# Sprint 4 — Community Blocks (CUDA ID4) Tests

---

## Test 4.1 — cuda_id4_loader SSE Heartbeat Survives 300s ❌

**Context:** Chromium kills fetch connections after exactly 300 seconds if no data is received. The extension bridge route for the loader must send heartbeat whitespace every 30s.

**Do this:**
1. Start the CUDA workflow but with a very slow model load (or simulate by setting a delay).
2. Watch the loader block progress for > 5 minutes.
3. Open browser DevTools → Network tab → find the `/run-block` request.

**Should happen:**
- The request stays alive for > 5 minutes with no "Failed to fetch" error.
- Progress updates continue arriving beyond the 300-second mark.
- The Trace panel shows the loader completed (not timed out).

---

## Test 4.2 — Loader skip_if_loaded Toggle ❌

**Do this:**
1. On the `cuda_id4_loader` block, toggle `skip_if_loaded` ON.
2. Run the workflow once (model loads).
3. Run the workflow again.

**Should happen:**
- Second run: the loader block skips immediately, showing "Model already loaded — skipping".
- The `server_url` output is still populated on the second run so the generate block can use it.
- Toggle `skip_if_loaded` OFF → third run reloads the model from scratch.

---

## Test 4.3 — Generate Block Error Retry ❌

**Do this:**
1. Deliberately break the RunPod server URL (add a typo).
2. Run the workflow — the generate block should fail.

**Should happen:**
- Instead of a hard error message, a **Retry** button appears in the Run panel for the generate block.
- Clicking Retry re-attempts the generation without re-running the entire workflow.
- After fixing the URL, retry succeeds.

---

## Test 4.4 — Loader Server Health Badge ❌

**Do this:**
1. Place a `cuda_id4_loader` block on the canvas with a valid RunPod URL configured.
2. Look at the block header/footer before running.

**Should happen:**
- A green dot (or red dot) appears on the block indicating server health.
- Green = `/health` returns 200, Red = unreachable.
- Badge updates automatically without requiring a manual run.

---

## Test 4.5 — Multiple Prompt Seeds Sample Workflow ❌

**Setup:** Requires `cuda-id4/sample/multi-seed-cuda.json` to be created.

**Do this:**
1. Import the multi-seed sample workflow.
2. Run it.

**Should happen:**
- The workflow runs Generate N times with different seed values.
- All N images are collected and shown in a comparison grid in the Preview block.
- Each image is individually saved with its seed in the filename.

---

## Test 4.6 — Generate Block Aspect Ratio Badge ❌

**Do this:**
1. In the `cuda_id4_generate` block, select aspect ratio `16:9`.
2. Run the workflow.
3. Watch the block during execution.

**Should happen:**
- A `16:9` badge appears below the Generate block title during the run.
- The badge shows the selected ratio (not a generic "generating..." label).
- Badge disappears (or stays) after run completes — shows the ratio used.
