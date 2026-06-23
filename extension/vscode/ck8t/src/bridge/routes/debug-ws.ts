/**
 * Debug WebSocket route — ws://127.0.0.1:{bridgePort}/ck8t/debug-ws
 *
 * Side-channel for streaming pause/resume/step/log events while a single community
 * block's extension.js runs debug-instrumented in this process. The actual engine run
 * happens inside the HTTP /ck8t/run-block handler (routes/run.ts) — that handler is still
 * the sole source of truth for the final { output } / { error } response, so the documented
 * client.js → fetch('/ck8t/run-block') delegate contract never changes shape for callers
 * that don't request a debug session. This WS only ever (a) receives a `register` message
 * up front so the HTTP handler has a socket to push pause/log events to, and (b) relays
 * resume/step/stop control commands back into the engine instance that handler created.
 *
 * Client-side ordering contract: open the WS, wait for onopen, send `register`, THEN issue
 * the /ck8t/run-block POST with the same sessionId — this keeps `registeredSockets` populated
 * before runDebugBlock() ever looks it up, so the bounded retry below is a safety net, not
 * the steady-state path.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { BlockDebugEngineNode, type NodeDebugRunOpts } from '../../services/block-debug-engine-node';
import { resolveRunnerSource } from '../../services/block-loader';
import { callAgent } from '../../services/llm';
import { callTool } from '../../services/mcp';

/** sessionId → socket, populated by the client's `register` message. */
const registeredSockets = new Map<string, WebSocket>();
/** sessionId → live engine instance, populated by runDebugBlock() for the duration of one run. */
const activeEngines = new Map<string, BlockDebugEngineNode>();

interface RegisterMsg { type: 'register'; sessionId: string }
interface ControlMsg { type: 'resume' | 'stepOver' | 'stepInto' | 'stepOut' | 'stop'; sessionId: string }
type ClientMsg = RegisterMsg | ControlMsg;

export function attachDebugWs(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ck8t/debug-ws' });

  wss.on('connection', (ws: WebSocket) => {
    let sessionId: string | null = null;

    ws.on('message', (raw: Buffer) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'register') {
        sessionId = msg.sessionId;
        registeredSockets.set(sessionId, ws);
        return;
      }

      if (!msg.sessionId) return;
      const engine = activeEngines.get(msg.sessionId);
      if (!engine) return;
      switch (msg.type) {
        case 'resume': engine.resume(); break;
        case 'stepOver': engine.stepOver(); break;
        case 'stepInto': engine.stepInto(); break;
        case 'stepOut': engine.stepOut(); break;
        case 'stop': engine.stop(); break;
      }
    });

    ws.on('close', () => {
      if (!sessionId) return;
      activeEngines.get(sessionId)?.stop();
      activeEngines.delete(sessionId);
      registeredSockets.delete(sessionId);
    });
  });
}

function waitForRegisteredSocket(sessionId: string, timeoutMs = 2000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const ws = registeredSockets.get(sessionId);
      if (ws) return resolve(ws);
      if (Date.now() > deadline) return reject(new Error('Debug WebSocket did not register in time — is the Debugger tab still open?'));
      setTimeout(poll, 25);
    };
    poll();
  });
}

function safeSend(ws: WebSocket, payload: Record<string, unknown>): void {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket may already be closed */ }
}

/**
 * Run a community block's extension.js debug-instrumented, called from the
 * /ck8t/run-block HTTP handler when the request body carries __ck8tDebug. Resolves/rejects
 * with the same shape a normal (non-debug) runner call would, so the caller's try/catch
 * doesn't need to know debugging happened at all.
 */
export async function runDebugBlock(
  sessionId: string,
  blockType: string,
  breakpoints: number[],
  ctxBase: { values: Record<string, unknown>; input: unknown; inputsByHandle: Record<string, unknown> },
): Promise<unknown> {
  const resolved = resolveRunnerSource(blockType);
  if (!resolved) throw new Error(`No extension.js source found for block type "${blockType}"`);

  const ws = await waitForRegisteredSocket(sessionId);
  const engine = new BlockDebugEngineNode();
  activeEngines.set(sessionId, engine);

  const ctx: NodeDebugRunOpts['ctx'] = {
    ...ctxBase,
    outputs: {},
    node: { id: blockType },
    allNodes: [],
    subBlockValues: {},
    callAgent,
    callTool,
  };

  try {
    return await engine.run({
      blockType,
      source: resolved.source,
      filePath: resolved.filePath,
      ctx,
      breakpoints,
      file: 'extension.js',
      onPaused: (file, line, variables, callStack) => safeSend(ws, { type: 'paused', sessionId, file, line, variables, callStack }),
      onResumed: () => safeSend(ws, { type: 'resumed', sessionId }),
      onCompleted: (output) => safeSend(ws, { type: 'completed', sessionId, output }),
      onError: (message) => safeSend(ws, { type: 'error', sessionId, message }),
      onLog: (entry) => safeSend(ws, { type: 'log', sessionId, ...entry }),
    });
  } finally {
    activeEngines.delete(sessionId);
    registeredSockets.delete(sessionId);
  }
}
