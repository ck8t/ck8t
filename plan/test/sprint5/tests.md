# Sprint 5 — MCP & AI Provider Integration Tests

---

## Test 5.1 — MCP Server Connection Status Badge ❌

**Setup:** Have at least one MCP server configured in Settings → MCP Servers.

**Do this:**
1. Open Settings → MCP Servers.
2. Look at each server entry in the list.
3. Stop one of the MCP servers (or disconnect).

**Should happen:**
- Each server shows a colored status dot: green = connected, red = disconnected, yellow = connecting.
- The status updates in real-time when a server disconnects (no manual refresh needed).
- A timestamp shows "Last seen: X seconds ago" for disconnected servers.

---

## Test 5.2 — MCP Tool Output Inspector ❌

**Do this:**
1. In the MCP Servers panel, click on a connected server to expand it.
2. Click on a specific tool listed under that server.

**Should happen:**
- A side panel or modal shows the tool's JSON schema (input/output types).
- The panel also shows the output of the last call to that tool (if it has been called).
- A "Test Call" button lets you invoke the tool directly with a sample input.

---

## Test 5.3 — AI Provider Key Validation ❌

**Do this:**
1. Open Settings → AI Providers.
2. Enter a deliberately wrong API key for OpenAI (e.g. `sk-invalid123`).
3. Click Save.

**Should happen:**
- A validation spinner appears briefly.
- An error badge appears on the provider: "Invalid API key — test call failed".
- Entering a correct key removes the error badge and shows a green checkmark.
- Validation does NOT make any real LLM generation calls — uses a lightweight check endpoint.

---

## Test 5.4 — Model Picker Provider Grouping ❌

**Do this:**
1. Open any `agent` block and look at the model picker dropdown.

**Should happen:**
- Models are grouped by provider with a section header: `── OpenAI ──`, `── Anthropic ──`, `── Ollama ──`.
- Selecting from any provider works correctly.
- The provider name is shown next to the model name in smaller text.

---

## Test 5.5 — Ollama Local Model Discovery ❌

**Setup:** Ollama is running locally with at least one model pulled (e.g. `ollama run llama3`).

**Do this:**
1. Open Settings → AI Providers → Ollama section.

**Should happen:**
- Ollama models are auto-discovered from `http://localhost:11434/api/tags`.
- A "Refresh" button re-scans for new models.
- Discovered models appear in the agent block model picker under "── Ollama ──".
- If Ollama is not running, a "Not running" badge is shown (not an error crash).

---

## Test 5.6 — LLM Call Cost Estimator ❌

**Do this:**
1. Run a workflow containing an `agent` block.
2. After the run completes, click the agent block to open its inspector.
3. Look at the Run output section.

**Should happen:**
- Token counts are shown: "Input: 1,234 tokens | Output: 567 tokens".
- An estimated cost is shown: "~$0.0023" based on the model's pricing.
- Hovering the cost shows the per-1k-token rate used for calculation.
- Total run cost is aggregated in the Run panel footer.
