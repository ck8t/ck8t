/**
 * Debug WebSocket route — ws://{host}:{port}/api/v1/ck8t/debug-ws
 *
 * Backs the Debugger panel's "Test on Server" button — the only interactive trigger
 * for server.js execution that exists (unlike client.js/canvas-Run and extension.js/
 * fetch('/ck8t/run-block'), nothing else calls server.js outside of headless cron/
 * webhook runs). No HTTP correlation needed here: the WS connection is the entire
 * lifecycle for one debug run — `start` kicks off BlockDebugEngineNode directly in this
 * handler, `resume`/`stepOver`/`stepInto`/`stepOut`/`stop` control it, and `completed`/
 * `error` end it. Protocol matches the extension host's debug-ws.ts so the browser-side
 * pause/resume/variable-rendering code is shared between both paths.
 */
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { BlockDebugEngineNode, type NodeDebugRunOpts } from '../services/block-debug-engine-node.js';
import { resolveServerRunnerSource } from '../services/block-manager.js';
import { callAgent } from '../services/llm.js';
import { callTool } from '../services/mcp.js';

interface StartMsg {
  type: 'start';
  sessionId: string;
  blockType: string;
  breakpoints: number[];
  ctxValues?: Record<string, unknown>;
  ctxInput?: unknown;
  ctxInputsByHandle?: Record<string, unknown>;
}
interface ControlMsg {
  type: 'resume' | 'stepOver' | 'stepInto' | 'stepOut' | 'stop';
  sessionId: string;
}
type ClientMsg = StartMsg | ControlMsg;

function safeSend(socket: WebSocket, payload: Record<string, unknown>): void {
  try { socket.send(JSON.stringify(payload)); } catch { /* socket may already be closed */ }
}

export default async function (app: FastifyInstance) {
  app.get('/ck8t/debug-ws', { websocket: true }, (socket: WebSocket) => {
    let engine: BlockDebugEngineNode | null = null;

    socket.on('message', (raw: Buffer) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'start') {
        const { sessionId, blockType, breakpoints, ctxValues, ctxInput, ctxInputsByHandle } = msg;
        const resolved = resolveServerRunnerSource(blockType);
        if (!resolved) {
          safeSend(socket, { type: 'error', sessionId, message: `No server.js source found for block type "${blockType}"` });
          socket.close();
          return;
        }

        engine = new BlockDebugEngineNode();
        const ctx: NodeDebugRunOpts['ctx'] = {
          values: ctxValues ?? {},
          input: ctxInput ?? null,
          inputsByHandle: ctxInputsByHandle ?? {},
          outputs: {},
          node: { id: blockType },
          allNodes: [],
          subBlockValues: {},
          callAgent,
          callTool,
        };

        engine
          .run({
            blockType,
            source: resolved.source,
            filePath: resolved.filePath,
            ctx,
            breakpoints: breakpoints ?? [],
            file: 'server.js',
            onPaused: (file, line, variables, callStack) => safeSend(socket, { type: 'paused', sessionId, file, line, variables, callStack }),
            onResumed: () => safeSend(socket, { type: 'resumed', sessionId }),
            onCompleted: (output) => safeSend(socket, { type: 'completed', sessionId, output }),
            onError: (message) => safeSend(socket, { type: 'error', sessionId, message }),
            onLog: (entry) => safeSend(socket, { type: 'log', sessionId, ...entry }),
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            safeSend(socket, { type: 'error', sessionId, message });
          });
        return;
      }

      if (!engine) return;
      switch (msg.type) {
        case 'resume': engine.resume(); break;
        case 'stepOver': engine.stepOver(); break;
        case 'stepInto': engine.stepInto(); break;
        case 'stepOut': engine.stepOut(); break;
        case 'stop': engine.stop(); break;
      }
    });

    socket.on('close', () => {
      engine?.stop();
      engine = null;
    });
  });
}
