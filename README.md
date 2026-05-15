# CK8T Agent Builder Studio

CK8T Agent Builder Studio is a visual, node-based workflow builder for agentic automations.
You can design workflows on a canvas, run them interactively, and execute the same graph logic in:

- the browser app
- a VS Code extension
- a standalone Node server

The project is built to be highly customizable, including custom block definitions and pluggable execution behavior.

## What You Get

- Visual workflow canvas with typed ports and validation
- Agent blocks backed by model providers
- Trigger blocks (manual, webhook, schedule, media input)
- Tooling blocks (MCP, API, DB, transform, control-flow)
- Run trace and debugging panels
- Persisted workspaces and deployable workflows
- First-class VS Code integration (activity view, webview panel, chat participant)

## Monorepo Structure

This folder is the UI builder workspace root.

- src/
  - React app and canvas runtime
  - Browser graph runner logic
  - Block definitions and registry
  - Inspector, run panels, docs UI
- ck8t-server/
  - Fastify server runtime
  - Server graph runner logic
  - API endpoints for run, deploy, workspace, provider, MCP
- extension/vscode/ck8t/
  - VS Code extension host code
  - Extension bridge server and scheduler
  - Extension graph runner logic
  - Webview host for the React UI
- webview-entry/
  - Dedicated webview HTML entry for extension builds

## Runtime Modes

### 1) Browser App Mode

Use this for local canvas development and interactive runs.

- UI runs from Vite dev server
- Requests proxy to ck8t-server
- Graph executes in browser runner for interactive use

### 2) VS Code Extension Mode

Use this for extension development and in-editor workflow authoring.

- React app is built to extension webview/dist
- Extension starts an internal bridge server on localhost random port
- Graph executes via extension runner and services
- LLM requests route through VS Code Copilot APIs in extension context

### 3) Standalone Server Mode

Use this for API-based execution and backend scheduling/webhooks.

- Fastify app exposes API under /api/v1
- Server graph runner executes workflows in Node
- Can be used by UI, automation, or deploy endpoints

## Core Execution Contract

All three runners operate on the same workflow data shape:

- nodes
- edges
- subBlockValues

A block type must be implemented consistently where needed:

- Browser runner for interactive app behavior
- Extension runner for VS Code behavior
- Server runner for backend execution behavior

If a block is only implemented in one runner, behavior will diverge by runtime mode.

## Quick Start

## Prerequisites

- Node.js 20+
- npm
- VS Code (for extension mode)

## Install dependencies

From this folder:

```bash
npm install
cd ck8t-server && npm install && cd ..
cd extension/vscode/ck8t && npm install && cd ../../..
```

## Run Browser App + Server locally

Terminal 1:

```bash
cd ck8t-server
npm run dev
```

Terminal 2:

```bash
npm run dev
```

Open the app at http://localhost:5173.

## Run VS Code Extension locally

Terminal 1 (webview asset watch):

```bash
npm run watch:extension
```

Terminal 2 (extension TypeScript watch):

```bash
cd extension/vscode/ck8t
npm run watch
```

Then:

1. Open this repository in VS Code.
2. Open the extension project at extension/vscode/ck8t.
3. Press F5 to start an Extension Development Host.
4. Run the command CK8T: Open Canvas.

## Build Targets

## UI build

```bash
npm run build
```

## Webview build for extension

```bash
npm run build:extension
```

## Standalone server build

```bash
cd ck8t-server
npm run build
```

## Extension host build

```bash
cd extension/vscode/ck8t
npm run compile
```

---

# Developer Guide (Internal)

This section is for contributors who are extending CK8T.

## Local Development Workflow

Recommended setup for active feature development:

1. Run ck8t-server in watch mode.
2. Run root Vite app in dev mode for fast UI iteration.
3. If changing extension behavior, also run:
   - webview watcher (root watch:extension)
   - extension TypeScript watcher (extension watch)
4. Validate feature in both browser app and VS Code extension.

## How to Add a New Block (Fully Customizable Framework)

This is the minimum end-to-end checklist to keep all runtimes aligned.

### Step 1: Define block schema and metadata

Create a block definition in src/ck8t/blocks/blocks.

Your block should define:

- type (stable identifier)
- name, description, category, color, icon
- subBlocks (editor config fields)
- inputs and outputs (typed ports)

Then export it in src/ck8t/blocks/blocks/index.js and register it in src/ck8t/blocks/registry.js.

If it should appear in a specific subgroup instead of Other, add it to CATEGORY_CONFIG in src/ck8t/blocks/registry.js.

### Step 2: Wire card port behavior

If default auto ports are not enough, add or override ports in:

- src/ck8t/panel/io-registry.js

This controls inspector/card port visibility, port typing, and compatibility behavior.

### Step 3: Implement browser runtime behavior

Add block behavior in:

- src/ck8t/run/graph-runner.js

At minimum, add a switch case for your block type and return the correct output contract.

### Step 4: Implement VS Code extension runtime behavior

Add corresponding behavior in:

- extension/vscode/ck8t/src/engine/graph-runner.ts

If your block can be a root trigger, update seed trigger logic there as well.
If your block needs typed pass-through/disabled behavior, ensure card port defaults are updated in that runner.

### Step 5: Implement standalone server runtime behavior

Add matching behavior in:

- ck8t-server/src/engine/graph-runner.ts

Keep output shape compatible with app and extension runners.

### Step 6: Optional extension-style block plugin

For lightweight custom blocks, you can add a file under:

- src/ck8t/extensions/

The registry auto-discovers extension modules via import glob. This is useful for rapid block prototyping.

### Step 7: Validate all three execution paths

Test these explicitly:

- Browser app run
- VS Code extension run
- Server API run

A block is considered complete only after parity validation across all enabled runtimes.

## Development Rules for Runner Parity

- Keep the same type value everywhere.
- Keep subBlockValues key names aligned with block subBlocks ids.
- Keep outputs structurally consistent across runtimes.
- If block acts as trigger, include it in reachability seed logic where applicable.
- Update error and validation messages if execution model changes.

## Typical Files Touched for a New Block

- src/ck8t/blocks/blocks/<new-block>.js
- src/ck8t/blocks/blocks/index.js
- src/ck8t/blocks/registry.js
- src/ck8t/panel/io-registry.js (optional/usually needed)
- src/ck8t/run/graph-runner.js
- extension/vscode/ck8t/src/engine/graph-runner.ts
- ck8t-server/src/engine/graph-runner.ts

## Common Pitfalls

- Added to registry but missing runner case
- Works in browser but fails in extension/server
- Port types not aligned, causing runtime type errors
- Trigger block added but not included in seed/reachability logic
- Block appears under Other due to missing category subgroup mapping

## Suggested Contribution Checklist

Before opening a PR:

- Block renders in palette and inspector correctly
- Block executes in browser app runner
- Block executes in extension runner
- Block executes in server runner
- Port typing and compatibility validated
- No TypeScript/ESLint errors in modified packages

## Useful Package Scripts Reference

Root (this folder):

- npm run dev
- npm run build
- npm run build:extension
- npm run watch:extension

ck8t-server:

- npm run dev
- npm run build
- npm run start

extension/vscode/ck8t:

- npm run watch
- npm run compile
- npm run build
- npm run package
