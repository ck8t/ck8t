/**
 * Browser-side WebSocket client for the extension.js debug path.
 *
 * Ordering contract (from debug-ws.ts): open the WS, wait for onopen, send
 * `register`, THEN issue the /ck8t/run-block POST with the matching sessionId.
 * startExtDebugSession() resolves only after the socket is open and `register`
 * has been sent, so callers can safely set ctx.__ck8tExtDebug and call runner()
 * immediately after awaiting it.
 *
 * Base URL from __CK8T_BRIDGE_BASE__ — the same global used by mcp-client.js
 * and block-manager-client.js. In the VS Code extension webview this is injected
 * by Ck8tPanel._getHtml(); in a standalone dev server it falls back to :3000.
 */

function bridgeWsBase() {
  const base = globalThis.__CK8T_BRIDGE_BASE__ || 'http://127.0.0.1:3000'
  return base.replace(/^http/, 'ws')
}

/**
 * Opens a WS session against the extension bridge's /ck8t/debug-ws route,
 * registers the sessionId, and resolves with a control handle.
 *
 * Resolves: { sessionId, resume, stepOver, stepInto, stepOut, stop, close }
 * Rejects: if the socket cannot connect (extension not running).
 *
 * Callback shape mirrors BlockDebugEngine — the same store actions
 * (setPaused/setResumed/setCompleted/setError/addLog) work for both paths.
 */
export function startExtDebugSession({ sessionId, onPaused, onResumed, onCompleted, onError, onLog }) {
  return new Promise((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(`${bridgeWsBase()}/ck8t/debug-ws`)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', sessionId }))

      ws.onmessage = (evt) => {
        let msg
        try { msg = JSON.parse(evt.data) } catch { return }
        if (msg.sessionId && msg.sessionId !== sessionId) return
        switch (msg.type) {
          case 'paused':    onPaused?.(msg.file, msg.line, msg.variables, msg.callStack); break
          case 'resumed':   onResumed?.(); break
          case 'completed': onCompleted?.(msg.output); ws.close(); break
          case 'error':     onError?.(msg.message); ws.close(); break
          case 'log':       onLog?.({ level: msg.level, msg: msg.msg }); break
        }
      }

      ws.onerror = () => onError?.('Extension debug WebSocket error — is the VS Code extension active?')
      ws.onclose = () => {}

      const send = (type) => { try { ws.send(JSON.stringify({ type, sessionId })) } catch { /* socket may be closed */ } }

      if (!settled) {
        settled = true
        resolve({
          sessionId,
          resume:   () => send('resume'),
          stepOver: () => send('stepOver'),
          stepInto: () => send('stepInto'),
          stepOut:  () => send('stepOut'),
          stop:     () => send('stop'),
          close:    () => ws.close(),
        })
      }
    }

    ws.onerror = () => {
      if (!settled) {
        settled = true
        reject(new Error('Could not connect to extension debug WebSocket — is the VS Code extension active?'))
      }
    }
  })
}
