/**
 * MCP (Model Context Protocol) service.
 *
 * Stores server configs in SQLite. Supports two transports:
 *   • HTTP  — JSON-RPC POST to a remote/local endpoint
 *   • STDIO — spawns a subprocess (e.g. `npx -y @modelcontextprotocol/server-filesystem /tmp`)
 *             and speaks MCP JSON-RPC over stdin/stdout.
 *
 * The extension host is full Node.js, so child_process is available directly.
 * No vscode.postMessage bridge needed.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import { upsert, remove, findById, findAll } from '../storage/db';
import type { McpServerConfig, McpTool } from '../types';

/* ── File logger ──────────────────────────────────────────────────────────────
   Writes every MCP event to ~/.salilvnair/ck8t/logs/mcp-extension.log
   as well as the VS Code Output panel.  Rotates at 5 MB (renames to .1). */

const _LOG_DIR  = path.join(os.homedir(), '.salilvnair', 'ck8t', 'logs');
const _LOG_FILE = path.join(_LOG_DIR, 'mcp-extension.log');
const _LOG_MAX  = 5 * 1024 * 1024; // 5 MB

function mcpLog(level: 'INFO' | 'WARN' | 'ERROR', ...parts: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${parts.join(' ')}`;
  // VS Code Output panel — use process streams directly to avoid recursion
  (level === 'ERROR' ? process.stderr : process.stdout).write(line + '\n');
  // Log file
  try {
    fs.mkdirSync(_LOG_DIR, { recursive: true });
    try {
      if (fs.statSync(_LOG_FILE).size > _LOG_MAX) {
        fs.renameSync(_LOG_FILE, _LOG_FILE + '.1');
      }
    } catch { /* file may not exist yet */ }
    fs.appendFileSync(_LOG_FILE, line + '\n', 'utf8');
  } catch { /* never block on log I/O */ }
}

export function initMcpService(_storagePath: string) {
  // db is already initialised by initDb() in extension.ts activate()
  mcpLog('INFO', `MCP service init  log → ${_LOG_FILE}`);
}

/* ── Tool cache (per server, evicted on refresh) ── */
const _toolCache = new Map<string, McpTool[]>();

/* ── Progress reporting ───────────────────────────────────────────────────────
   Parses tqdm lines from the Python MCP server's stderr and forwards them to
   the webview via a handler registered by Ck8tPanel.
   tqdm format: "  5%|▌         | 1/20 [00:08<02:35,  8.18s/it]"             */

export interface McpProgressEvent {
  serverName: string;
  toolName:   string;
  step:       number;
  total:      number;
  pct:        number;
  raw:        string;
}

type ProgressHandler = (event: McpProgressEvent | null) => void;
let _progressHandler: ProgressHandler | null = null;

/** Register a callback that receives progress events (or null to clear). */
export function setMcpProgressHandler(h: ProgressHandler | null): void {
  _progressHandler = h;
}

/** Currently-running tool name per server (populated when tools/call starts). */
const _activeToolName = new Map<string, string>();

/** Parse a tqdm progress line → structured event, or null if not a progress line. */
function _parseTqdmLine(line: string): { step: number; total: number; pct: number } | null {
  // Strip ANSI escape codes first (tqdm may emit them even when piped)
  // eslint-disable-next-line no-control-regex
  const clean = line.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
  // tqdm: "  5%|▌         | 1/20 [00:08<02:35,  8.18s/it]"
  const m = clean.match(/^\s*(\d+)%\|[^|]*\|\s*(\d+)\/(\d+)/);
  if (!m) return null;
  const pct   = parseInt(m[1], 10);
  const step  = parseInt(m[2], 10);
  const total = parseInt(m[3], 10);
  if (total <= 0 || step > total) return null;
  return { pct, step, total };
}

/* ── Transport type helpers ── */

/** Normalise the UI field (`transport: 'STDIO'`) to the internal `type` field. */
function uiTransportToType(transport: string | undefined): McpServerConfig['type'] {
  if (!transport) return 'http';
  switch (transport.toUpperCase()) {
    case 'STDIO': return 'stdio';
    case 'SSE':   return 'sse';
    default:      return 'http';
  }
}

/** Expose both `type` and `transport` on outbound objects so the React UI works. */
function withTransport(server: McpServerConfig): McpServerConfig {
  const map: Record<string, McpServerConfig['transport']> = {
    stdio: 'STDIO', sse: 'SSE', http: 'HTTP',
  };
  return { ...server, transport: map[server.type] ?? 'HTTP' };
}

/* ── CRUD ── */

export function listServers(): McpServerConfig[] {
  return findAll<McpServerConfig>('bs_mcp_server').map(withTransport);
}

export function upsertServer(cfg: Partial<McpServerConfig> & { transport?: string }): McpServerConfig {
  const id  = cfg.id || `mcp_${Date.now()}`;
  const now = new Date().toISOString();
  const existing = findById<McpServerConfig>('bs_mcp_server', id);

  // Accept either `type` (internal) or `transport` (from React UI)
  const resolvedType = cfg.type ?? (cfg.transport ? uiTransportToType(cfg.transport) : existing?.type ?? 'http');

  const server: McpServerConfig = {
    id,
    name:      cfg.name    ?? existing?.name    ?? 'Unnamed',
    url:       cfg.url     ?? existing?.url     ?? '',
    type:      resolvedType,
    command:   cfg.command ?? existing?.command,
    args:      cfg.args    ?? existing?.args,
    env:       cfg.env     ?? existing?.env,
    headers:   cfg.headers ?? existing?.headers,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  upsert<McpServerConfig>('bs_mcp_server', id, server);
  _toolCache.delete(id);
  // Kill any running stdio process so next call re-spawns with new config
  killStdioProcess(id);
  return withTransport(server);
}

export function deleteServer(id: string): { ok: boolean } {
  remove('bs_mcp_server', id);
  _toolCache.delete(id);
  killStdioProcess(id);
  return { ok: true };
}

/* ── Tool discovery ── */

export async function listTools(serverId: string, refresh = false): Promise<McpTool[]> {
  if (!refresh && _toolCache.has(serverId)) {
    return _toolCache.get(serverId)!;
  }
  const server = getServerOrThrow(serverId);
  const tools = await mcpListTools(server);
  _toolCache.set(serverId, tools);
  return tools;
}

/* ── Tool invocation ── */

export async function callTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const server = getServerOrThrow(serverId);
  return mcpCallTool(server, toolName, args);
}

/* ── Helpers ── */

function getServerOrThrow(serverId: string): McpServerConfig {
  const server = findById<McpServerConfig>('bs_mcp_server', serverId);
  if (!server) throw new Error(`MCP server "${serverId}" not found`);
  return server;
}

/* ════════════════════════════════════════════════════════════════
   HTTP JSON-RPC transport
   ════════════════════════════════════════════════════════════════ */

let _rpcId = 1;

interface McpRpcResponse {
  id?: number;
  result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> };
  error?: { message: string };
  [k: string]: unknown;
}

async function httpRpc(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
): Promise<McpRpcResponse> {
  const id   = _rpcId++;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(server.headers ?? {}),
  };
  const res = await fetch(server.url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP server "${server.name}" HTTP ${res.status}: ${text}`);
  }
  const data = (await res.json()) as McpRpcResponse;
  if (data.error) throw new Error(`MCP error from "${server.name}": ${data.error.message}`);
  return data;
}

/* ════════════════════════════════════════════════════════════════
   STDIO transport  (child_process — available in the extension host)
   ════════════════════════════════════════════════════════════════ */

interface StdioSession {
  proc:     ChildProcess;
  pending:  Map<number, { resolve(v: McpRpcResponse): void; reject(e: Error): void }>;
  buf:      string;
  ready:    boolean;
}

const _stdioSessions = new Map<string, StdioSession>();

function killStdioProcess(serverId: string) {
  const s = _stdioSessions.get(serverId);
  if (!s) return;
  try { s.proc.kill(); } catch { /* ignore */ }
  for (const p of s.pending.values()) p.reject(new Error('MCP process killed'));
  s.pending.clear();
  _stdioSessions.delete(serverId);
}

async function getOrCreateStdioSession(server: McpServerConfig): Promise<StdioSession> {
  const existing = _stdioSessions.get(server.id);
  if (existing && existing.proc.exitCode === null) return existing;

  if (!server.command) throw new Error(`MCP server "${server.name}" has no command configured`);

  // On macOS, Metal's GPU watchdog terminates long-running command buffers with
  // kIOGPUCommandBufferCallbackErrorImpactingInteractivity when a subprocess runs
  // under foreground-interactive QoS (inherited from VS Code). MTL_MAX_COMMAND_-
  // BUFFER_EXEC_TIMEOUT=0 is ignored by the kernel-level watchdog on macOS 13+.
  // The only reliable fix is to spawn under background QoS via `taskpolicy -b`,
  // which tells the scheduler the process is not interactive and should not
  // trigger the interactivity watchdog.
  const metalEnv = process.platform === 'darwin'
    ? { MTL_MAX_COMMAND_BUFFER_EXEC_TIMEOUT: '0' }
    : {};
  const env  = { ...process.env, ...metalEnv, ...(server.env ?? {}) };

  let spawnCmd: string;
  let spawnArgs: string[];
  if (process.platform === 'darwin') {
    // taskpolicy -b: run with background QoS — bypasses the Metal interactivity watchdog
    spawnCmd  = '/usr/sbin/taskpolicy';
    spawnArgs = ['-b', server.command, ...(server.args ?? [])];
  } else {
    spawnCmd  = server.command;
    spawnArgs = server.args ?? [];
  }

  mcpLog('INFO',`[mcp] spawn "${server.name}"  cmd: ${server.command} ${(server.args ?? []).join(' ')}`);
  const proc = spawn(spawnCmd, spawnArgs, { env, stdio: ['pipe', 'pipe', 'pipe'] });

  const session: StdioSession = { proc, pending: new Map(), buf: '', ready: false };
  _stdioSessions.set(server.id, session);

  proc.stdout!.on('data', (chunk: Buffer) => {
    session.buf += chunk.toString();
    // MCP messages are newline-delimited JSON
    const lines = session.buf.split('\n');
    session.buf = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: McpRpcResponse;
      try { msg = JSON.parse(trimmed); } catch { continue; }
      if (msg.id != null) {
        const p = session.pending.get(msg.id as number);
        if (p) { session.pending.delete(msg.id as number); p.resolve(msg); }
      }
    }
  });

  proc.stderr!.on('data', (chunk: Buffer) => {
    // Normalise \r so tqdm overwrite-lines arrive as separate entries
    const raw = chunk.toString().replace(/\r/g, '\n');
    raw.split('\n').filter((l) => l.trim()).forEach((line) => {
      mcpLog('INFO',`[mcp-stderr] "${server.name}":`, line.trim());
      // Forward tqdm progress to the UI
      const p = _parseTqdmLine(line);
      if (p && _progressHandler) {
        _progressHandler({
          serverName: server.name,
          toolName:   _activeToolName.get(server.id) ?? '',
          raw:        line.trim(),
          ...p,
        });
      }
    });
  });

  proc.on('exit', (code) => {
    mcpLog('INFO',`[mcp-stdio] "${server.name}" exited (code ${code})`);
    for (const p of session.pending.values()) p.reject(new Error(`MCP process "${server.name}" exited`));
    session.pending.clear();
    _stdioSessions.delete(server.id);
  });

  // MCP handshake: initialize → initialized notification
  // Heavy ML servers (e.g. MLX/ideogram4) can take 2–3 min to import under
  // background QoS — use a 3-minute timeout so we don't give up too early.
  mcpLog('INFO',`[mcp] initialize "${server.name}"`);
  await stdioRpc(session, server, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ck8t', version: '1.0.0' },
  }, 180_000);
  // Send the required 'notifications/initialized' notification (no response expected)
  proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  mcpLog('INFO',`[mcp] "${server.name}" ready`);

  session.ready = true;
  return session;
}

/**
 * Send a JSON-RPC request over STDIO and wait for the response.
 * timeoutMs defaults to 30s for handshake/list calls.
 * Pass MCP_TOOL_TIMEOUT_MS (default 3 600 000 = 1 h) for tools/call.
 */
function stdioRpc(
  session: StdioSession,
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<McpRpcResponse> {
  const id    = _rpcId++;
  const msg   = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
  const t0    = Date.now();
  const label = method === 'tools/call'
    ? `tools/call[${(params as { name?: string }).name ?? '?'}]`
    : method;

  mcpLog('INFO',`[mcp] → "${server.name}" ${label}  (timeout ${timeoutMs / 1000}s)`);

  // Track tool name so the stderr progress handler can label it
  if (method === 'tools/call') {
    _activeToolName.set(server.id, (params as { name?: string }).name ?? '');
  }

  // Heartbeat so logs don't go silent during long generations
  const heartbeat = setInterval(() => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    mcpLog('INFO',`[mcp] ⏳ "${server.name}" ${label} still running … ${elapsed}s`);
  }, 30_000);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(heartbeat);
      session.pending.delete(id);
      if (method === 'tools/call') { _activeToolName.delete(server.id); _progressHandler?.(null); }
      mcpLog('ERROR',`[mcp] ✗ TIMEOUT "${server.name}" ${label} after ${timeoutMs / 1000}s`);
      reject(new Error(`MCP STDIO timeout for "${method}" on "${server.name}"`));
    }, timeoutMs);

    session.pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        if (method === 'tools/call') { _activeToolName.delete(server.id); _progressHandler?.(null); }
        mcpLog('INFO',`[mcp] ✓ "${server.name}" ${label}  ${Date.now() - t0}ms`);
        resolve(v);
      },
      reject:  (e) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        if (method === 'tools/call') { _activeToolName.delete(server.id); _progressHandler?.(null); }
        reject(e);
      },
    });
    session.proc.stdin!.write(msg);
  });
}

/* ════════════════════════════════════════════════════════════════
   SSE transport  (MCP SSE protocol over fetch streaming)
   ════════════════════════════════════════════════════════════════ */

interface SseSession {
  messageUrl: string | null;
  pending:    Map<number, { resolve(v: McpRpcResponse): void; reject(e: Error): void }>;
  cleanup:    () => void;
}

const _sseSessions = new Map<string, SseSession>();

function killSseSession(serverId: string) {
  const s = _sseSessions.get(serverId);
  if (!s) return;
  s.cleanup();
  for (const p of s.pending.values()) p.reject(new Error('SSE session closed'));
  s.pending.clear();
  _sseSessions.delete(serverId);
}

async function getOrCreateSseSession(server: McpServerConfig): Promise<SseSession> {
  const existing = _sseSessions.get(server.id);
  if (existing?.messageUrl) return existing;

  // Remove stale session if any
  if (existing) killSseSession(server.id);

  // Normalise SSE endpoint: append /sse unless already present
  const sseUrl = /\/sse\/?$/.test(server.url)
    ? server.url
    : server.url.replace(/\/?$/, '/sse');

  const session: SseSession = { messageUrl: null, pending: new Map(), cleanup: () => {} };
  _sseSessions.set(server.id, session);

  return new Promise<SseSession>((resolve, reject) => {
    let endpointReceived = false;

    fetch(sseUrl, {
      headers: { Accept: 'text/event-stream', ...(server.headers ?? {}) },
    })
      .then((res) => {
        if (!res.ok || !res.body) {
          _sseSessions.delete(server.id);
          reject(new Error(`SSE connect failed for "${server.name}": HTTP ${res.status}`));
          return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buf     = '';

        session.cleanup = () => { try { reader.cancel(); } catch { /* ignore */ } };

        // Resolve-endpoint timeout
        const epTimer = setTimeout(() => {
          if (!endpointReceived) {
            session.cleanup();
            _sseSessions.delete(server.id);
            reject(new Error(`SSE endpoint event timeout for "${server.name}"`));
          }
        }, 10_000);

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });

              // SSE events are separated by blank lines
              const events = buf.split('\n\n');
              buf = events.pop()!;

              for (const raw of events) {
                let eventType = 'message';
                let eventData = '';
                for (const line of raw.split('\n')) {
                  if (line.startsWith('event:')) eventType = line.slice(6).trim();
                  else if (line.startsWith('data:')) eventData = line.slice(5).trim();
                }

                if (eventType === 'endpoint' && eventData) {
                  clearTimeout(epTimer);
                  // eventData may be a path ("/messages?sessionId=…") or full URL
                  try {
                    session.messageUrl = new URL(eventData, server.url).toString();
                  } catch {
                    session.messageUrl = eventData;
                  }
                  if (!endpointReceived) {
                    endpointReceived = true;
                    resolve(session);
                  }
                } else if (eventType === 'message' && eventData) {
                  try {
                    const msg = JSON.parse(eventData) as McpRpcResponse;
                    if (msg.id != null) {
                      const p = session.pending.get(msg.id as number);
                      if (p) { session.pending.delete(msg.id as number); p.resolve(msg); }
                    }
                  } catch { /* skip invalid JSON */ }
                }
              }
            }
          } catch {
            /* stream closed — reject any outstanding requests */
          } finally {
            for (const p of session.pending.values()) p.reject(new Error(`SSE stream closed for "${server.name}"`));
            session.pending.clear();
            _sseSessions.delete(server.id);
          }
        };

        pump();
      })
      .catch((err: unknown) => {
        _sseSessions.delete(server.id);
        reject(err);
      });
  });
}

async function sseRpc(
  session: SseSession,
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<McpRpcResponse> {
  if (!session.messageUrl) throw new Error(`SSE session for "${server.name}" has no message URL`);
  const id      = _rpcId++;
  const body    = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(server.headers ?? {}),
  };
  const t0    = Date.now();
  const label = method === 'tools/call'
    ? `tools/call[${(params as { name?: string }).name ?? '?'}]`
    : method;

  mcpLog('INFO',`[mcp] → "${server.name}" ${label} (SSE, timeout ${timeoutMs / 1000}s)`);

  // POST the request; the response arrives asynchronously on the SSE stream
  const postRes = await fetch(session.messageUrl, { method: 'POST', headers, body });
  if (!postRes.ok) {
    const text = await postRes.text().catch(() => '');
    throw new Error(`MCP SSE POST "${method}" failed for "${server.name}": HTTP ${postRes.status} ${text}`);
  }

  const heartbeat = setInterval(() => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    mcpLog('INFO',`[mcp] ⏳ "${server.name}" ${label} still running … ${elapsed}s`);
  }, 30_000);

  return new Promise<McpRpcResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(heartbeat);
      session.pending.delete(id);
      mcpLog('ERROR',`[mcp] ✗ TIMEOUT "${server.name}" ${label} after ${timeoutMs / 1000}s`);
      reject(new Error(`MCP SSE timeout for "${method}" on "${server.name}"`));
    }, timeoutMs);
    session.pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        mcpLog('INFO',`[mcp] ✓ "${server.name}" ${label}  ${Date.now() - t0}ms`);
        resolve(v);
      },
      reject:  (e) => {
        clearTimeout(timer);
        clearInterval(heartbeat);
        reject(e);
      },
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   Unified dispatch — picks transport based on server.type
   ════════════════════════════════════════════════════════════════ */

/** tools/call can take minutes (local MLX inference). All other RPC calls stay at 30s. */
const TOOL_CALL_TIMEOUT_MS = 3_600_000; // 1 hour

async function mcpRpc(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
): Promise<McpRpcResponse> {
  const timeoutMs = method === 'tools/call' ? TOOL_CALL_TIMEOUT_MS : 30_000;
  if (server.type === 'stdio') {
    const session = await getOrCreateStdioSession(server);
    return stdioRpc(session, server, method, params, timeoutMs);
  }
  if (server.type === 'sse') {
    const session = await getOrCreateSseSession(server);
    return sseRpc(session, server, method, params, timeoutMs);
  }
  return httpRpc(server, method, params);
}

async function mcpListTools(server: McpServerConfig): Promise<McpTool[]> {
  try {
    mcpLog('INFO',`[mcp] listTools "${server.name}"`);
    const res   = await mcpRpc(server, 'tools/list', {});
    const tools = (res.result as { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> })?.tools ?? [];
    mcpLog('INFO',`[mcp] "${server.name}" tools: ${tools.map((t) => t.name).join(', ')}`);
    return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
  } catch (err: unknown) {
    mcpLog('WARN',`[mcp] listTools failed for "${server.name}":`, err);
    return [];
  }
}

async function mcpCallTool(
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const preview = JSON.stringify(args).slice(0, 200);
  mcpLog('INFO',`[mcp] callTool "${server.name}" → ${toolName}  args: ${preview}${preview.length >= 200 ? '…' : ''}`);
  const t0  = Date.now();
  const res = await mcpRpc(server, 'tools/call', { name: toolName, arguments: args });
  mcpLog('INFO',`[mcp] callTool "${server.name}" ← ${toolName}  ${Date.now() - t0}ms`);
  return res.result ?? res;
}

/* ── Cleanup (called from extension.ts deactivate) ── */
export function disposeMcpService() {
  for (const id of [..._stdioSessions.keys()]) killStdioProcess(id);
  for (const id of [..._sseSessions.keys()])   killSseSession(id);
}

