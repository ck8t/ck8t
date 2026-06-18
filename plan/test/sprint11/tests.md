# Sprint 11 — AI-Powered Canvas Intelligence Tests

---

## Test 11.1 — LLM Block Generator ❌

**Do this:**
1. Open Block Manager → "Generate New Block".
2. Type: "A block that takes a URL and returns the page title and word count".
3. Click "Generate".

**Should happen:**
- CK8T generates a valid `defineCk8tBlock()` JS file using an LLM.
- A code preview is shown in a modal with syntax highlighting.
- Clicking "Add to palette" registers it as a runnable block immediately.
- The generated block has correct `inputs`, `outputs`, and a working `run()` function.
- Generated code is sandboxed — does not have access to Node.js `require()`.

---

## Test 11.2 — Auto-wire by Type ❌

**Do this:**
1. Place a `cuda_id4_generate` block and a `show_preview` block on the canvas with no edges.
2. Right-click the Generate block → "Auto-connect".

**Should happen:**
- CK8T analyzes output types: `image_b64: string` can connect to `show_preview`'s `input`.
- A suggested edge is drawn (highlighted yellow before confirmation).
- Hovering the suggested edge shows the match rationale: "image_b64 (string) → input (any)".
- Clicking "Accept" confirms the edge; "Reject" removes the suggestion.
- Multiple blocks on canvas → multiple suggestions shown simultaneously.

---

## Test 11.3 — Workflow Chat ❌

**Do this:**
1. Open the chat input at the bottom of the canvas (or via `Cmd+/`).
2. Type: "Add a 2-second delay between Load Model and Generate Image".
3. Press Enter.

**Should happen:**
- A `delay` block is added between the two blocks.
- Edges are automatically rewired: `Load Model → delay → Generate Image`.
- The delay sub-block value is set to `2000` (ms).
- The canvas change is shown as a preview (yellow highlights) before you confirm.
- Typing "Undo that" reverts the change.

---

## Test 11.4 — Block Suggestion Sidebar ❌

**Do this:**
1. Build a workflow that ends with a `cuda_id4_generate` block (no downstream blocks).
2. Look at the Block Palette or a dedicated "Suggestions" sidebar.

**Should happen:**
- Suggestions appear: "save_to_files", "show_preview", "image_url_preview".
- Each suggestion shows a confidence level: "High — image_b64 → save_to_files matches".
- Clicking a suggestion drops the block onto the canvas already wired to the Generate block.
- Suggestions update as you build (if you add `show_preview`, it disappears from suggestions and `save_to_files` stays).

---

## Test 11.5 — Explain This Workflow ❌

**Do this:**
1. Open any multi-block workflow.
2. Click "Explain" in the toolbar (or context menu on canvas background).

**Should happen:**
- The WikiGuide tab opens with a generated plain-English explanation of the workflow:
  - Step 1: Start → User provides a text prompt
  - Step 2: Load Model loads Ideogram 4 on RunPod...
  - etc.
- The explanation matches the actual topology — not a generic template.
- A "Regenerate" button re-explains with a different phrasing.

---

## Test 11.6 — Smart Prompt Template ❌

**Do this:**
1. In an `agent` block's System Prompt field, type a simple prompt: `You are a helper.`
2. Click the "Enhance" button next to the field.

**Should happen:**
- The LLM expands the prompt to a more structured version:
  `You are a helpful assistant. Respond clearly and concisely. Always return valid JSON...`
- The enhanced prompt is shown in a diff view (before/after).
- Clicking "Apply" replaces the original; "Discard" keeps the original.

---

## Test 11.7 — Workflow from Description ❌

**Do this:**
1. In the sidenav Workflows panel, click "New from description".
2. Type: "Fetch a webpage, summarize it with AI, and save the summary to a file".
3. Click "Create".

**Should happen:**
- A new workflow tab opens with blocks already on canvas:
  `Start → user_input (URL) → api (fetch) → agent (summarize) → save_to_files`
- Edges are wired correctly between blocks.
- Sub-block values have sensible defaults (e.g. agent has a summarization system prompt).
- The generated workflow runs successfully (may need API key).
