# Sprint 1 — Core Stability Tests

> Open CK8T: VS Code → Command Palette (`Cmd+Shift+P`) → "CK8T: Open Panel"

---

## Test 1.1 — Workflow Tab Collision Fix

**Setup:** Have 3 different workflows already saved in the left sidebar (Workflows tab). Import the CUDA ID4 sample workflow (`cuda-id4/sample/animal-story-cuda.json`) as a 4th.

**Do this:**
1. Click Workflow tab 1 (e.g. "Demo"). Note its nodes.
2. Click Workflow tab 2 (e.g. a custom flow). Note its nodes.
3. Click Workflow tab 3 and Workflow tab 4 rapidly, then go back to tab 1.

**Should happen:**
- Each tab shows its own distinct nodes and edges — no tab becomes a copy of another.
- The canvas for tab 1 looks the same as it did before you started switching.
- No data-loss or silent overwrite occurs.

**Was broken before:** Auto-save was writing stale canvas state from the previous tab onto the newly-activated one. All tabs would end up identical after rapid switching.

---

## Test 1.2 — Node ID UUID Remapping on Import

**Setup:** Have at least one existing workflow open on a tab.

**Do this:**
1. Import `cuda-id4/sample/animal-story-cuda.json` (sidenav → Workflows → Import).
2. Open browser DevTools → Console. Run:
   ```js
   useWorkspaceStore.getState().workflows.forEach(w => w.nodes.forEach(n => console.log(w.name, n.id)))
   ```
3. Import the same file a second time to create a third copy.

**Should happen:**
- Every node ID across all three imports is unique — no two workflows share the same node IDs like `n_starter`, `n_loader`, etc.
- Both imported workflows run independently without interfering with each other.

**Was broken before:** Hard-coded IDs like `n_starter` were shared across tabs, causing `subBlockValues` lookups to return values from the wrong workflow.

---

## Test 1.3 — autoPorts Named Port Rendering

**Setup:** Import `cuda-id4/sample/animal-story-cuda.json`.

**Do this:**
1. On the canvas, click the **Load Model** block.
2. Check the left (input) side of the block.
3. Click the **Generate Image** block.
4. Check its left (input) side.

**Should happen:**
- **Load Model**: shows a small round dot labelled `trigger` (not a large blue D-shape connector).
- **Generate Image**: shows two small round dots labelled `prompt` and `server_url` (not a single `• input string` entry).
- Hovering a port dot shows its type label.

**Was broken before:** `autoPorts()` collapsed all typed inputs into one generic `• input` port, hiding named port structure.

---

## Test 1.4 — D-shape vs Round-dot Connector

**Do this:**
1. Look at the **Start** block on any workflow — its left side should show the large D-shape blue connector (that is correct and intentional).
2. Look at the **Load Model** block from the CUDA ID4 workflow.

**Should happen:**
- **Start** block: large D-shape blue handle on the right output side (no inputs).
- **Load Model** block: small round dot on the left for `trigger` input — NOT a D-shape.
- The visual distinction confirms named-input blocks use the port-strip dot style.

---

## Test 1.5 — Image Preview Renders Correctly

**Setup:** Running RunPod server with CUDA ID4 api_server.py loaded.

**Do this:**
1. Run the `Animal Story - CUDA Ideogram 4` workflow end-to-end.
2. When generation completes, look at the **Preview** block output in the Run panel.

**Should happen:**
- The Preview block shows an actual rendered image — not raw base64 text.
- The image displays inside the `show_preview` block output.

**Was broken before:** Generate block returned raw base64 string. `extractMediaUri()` requires `data:image/png;base64,` prefix — without it, the preview showed hundreds of lines of base64 characters.

---

## Test 1.6 — CORS and RunPod Connectivity

**Setup:** RunPod server running at your proxy URL. Confirm `/docs` endpoint works in browser.

**Do this:**
1. In the Load Model block's `server_url` field, enter your RunPod URL (e.g. `https://abc123-8080.proxy.runpod.net`).
2. Click Run.
3. Check the Run panel → Trace tab for the loader block output.

**Should happen:**
- No `Failed to fetch` / CORS error in the browser console.
- Loader block shows SSE progress (loading %, VRAM usage).
- `server_url` output is populated and passed to the Generate block.

**Was broken before:** The FastAPI server lacked `Access-Control-Allow-Origin` headers. VS Code webview origin was rejected.

---

## Test 1.7 — save_to_files Node in CUDA Sample

**Do this:**
1. Import `cuda-id4/sample/animal-story-cuda.json` fresh.
2. Count the nodes on canvas.

**Should happen:**
- 6 nodes are visible: Start → Animal Story → Load Model → Generate Image → Save Image + Preview (fan-out).
- **Save Image** block is at top-right, **Preview** is below it, both fed from `image_b64`.
- Running the workflow saves the PNG to disk AND shows preview simultaneously.
