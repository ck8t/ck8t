/**
 * Browser-side WebSocket client for the Debugger panel's "Test on Server" button.
 *
 * server.js's engine (customServerBlockRunners) only ever loads inside the real
 * ck8t-server process — never inside the VS Code extension bridge, which exposes an
 * overlapping /api/v1 REST shape but has no concept of server.js at all. So unlike every
 * other API client in this codebase, this one deliberately does NOT check
 * `globalThis.__CK8T_BRIDGE_BASE__` — doing so would silently point "Test on Server" at
 * the wrong process inside the VS Code extension and always report success/failure for
 * the wrong engine. Base URL always comes from `VITE_CONVENGINE_BASE` or the :3001 default.
 *
 * Protocol mirrors the extension host's debug-ws.ts, with one deliberate difference: the
 * server path has no existing interactive caller to stay backward-compatible with, so the
 * WS connection owns the whole lifecycle itself — `start` kicks off the run directly
 * (no separate `register` + HTTP correlation step like the extension.js path needs).
 */

const SERVER_BASE = (
  import.meta.env?.VITE_CONVENGINE_BASE ||
  'http://localhost:3001/api/v1'
).replace(/\/$/, '')

function wsBase() {
  return SERVER_BASE.replace(/^http/, 'ws')
}

/** Reachability probe against ck8t-server specifically — not __CK8T_BRIDGE_BASE__. */
export async function detectServerEngine() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${SERVER_BASE}/ck8t/llm/providers`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Opens a debug session against ck8t-server's /ck8t/debug-ws route and drives one
 * debug-instrumented run of blockType's server.js. Callback shape mirrors
 * BlockDebugEngine's onPaused/onResumed/onCompleted/onError/onLog so the same store
 * actions (setPaused/setResumed/setCompleted/setError/addLog) can feed off either path.
 *
 * Returns a handle with resume/stepOver/stepInto/stepOut/stop/close — the caller drives
 * control flow through these rather than touching the WebSocket directly.
 */
export function startServerDebugSession({
  blockType,
  breakpoints,
  ctxValues,
  ctxInput,
  ctxInputsByHandle,
  onOpen,
  onPaused,
  onResumed,
  onCompleted,
  onError,
  onLog,
}) {
  const sessionId = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const ws = new WebSocket(`${wsBase()}/ck8t/debug-ws`)

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'start',
      sessionId,
      blockType,
      breakpoints: breakpoints ?? [],
      ctxValues: ctxValues ?? {},
      ctxInput: ctxInput ?? null,
      ctxInputsByHandle: ctxInputsByHandle ?? {},
    }))
    onOpen?.()
  }

  ws.onmessage = (evt) => {
    let msg
    try {
      msg = JSON.parse(evt.data)
    } catch {
      return
    }
    if (msg.sessionId && msg.sessionId !== sessionId) return
    switch (msg.type) {
      case 'paused': onPaused?.(msg.file, msg.line, msg.variables, msg.callStack); break
      case 'resumed': onResumed?.(); break
      case 'completed': onCompleted?.(msg.output); ws.close(); break
      case 'error': onError?.(msg.message); ws.close(); break
      case 'log': onLog?.({ level: msg.level, msg: msg.msg }); break
      default: break
    }
  }

  ws.onerror = () => { onError?.('Debug WebSocket connection error — is ck8t-server running?') }

  const send = (type) => { try { ws.send(JSON.stringify({ type, sessionId })) } catch { /* socket may be closed */ } }

  return {
    sessionId,
    resume: () => send('resume'),
    stepOver: () => send('stepOver'),
    stepInto: () => send('stepInto'),
    stepOut: () => send('stepOut'),
    stop: () => send('stop'),
    close: () => ws.close(),
  }
}
