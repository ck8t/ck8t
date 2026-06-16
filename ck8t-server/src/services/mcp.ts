/**
 * MCP (Model Context Protocol) service — native client, no external dependency.
 *
 * Supports three transports:
 *   stdio — spawns a subprocess and speaks MCP JSON-RPC over stdin/stdout
 *   sse   — MCP SSE protocol over a streaming HTTP endpoint
 *   http  — plain JSON-RPC POST
 *
 * Server configs are persisted to ~/.salilvnair/ck8t/mcp-servers.json so they
 * survive server restarts without needing a database.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/* ── Types ── */

export interface McpServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  transport?: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpRpcResponse {
  id?: number;
  result?: unknown;
  error?: { message: string };
  [k: string]: unknown;
}

/* ── Config persistence (~/.salilvnair/ck8t/mcp-servers.json) ── */

function configFilePath(): string {
  return path.join(os.homedir(), '.salilvnair', 'ck8t', 'mcp-servers.json');
}

function loadConfigs(): Record<string, McpServerConfig> {
  try {
    const raw = fs.readFileSync(configFilePath(), 'utf-8');
    return JSON.parse(raw) as Record<string, McpServerConfig>;
  } catch {
    return {};
  }
}

function saveConfigs(store: Record<string, McpServerConfig>): void {
  const p = configFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2));
}

/* ── File logger ──────────────────────────────────────────────────────────────
   Writes every MCP event to ~/.salilvnair/ck8t/logs/mcp-server.log
   as well as stdout.  Rotates at 5 MB (renames to .1). */

const _LOG_DIR  = path.join(os.homedir(), '.salilvnair', 'ck8t', 'logs');
const _LOG_FILE = path.join(_LOG_DIR, 'mcp-server.log');
const _LOG_MAX  = 5 * 1024 * 1024; // 5 MB

function mcpLog(level: 'INFO' | 'WARN' | 'ERROR', ...parts: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${parts.join(' ')}`;
  // Use process streams directly so replace_all on console.* is safe
  (level === 'ERROR' ? process.stderr : process.stdout).write(line + '\n');
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

/* ── Tool cache ── */

const _toolCache = new Map<string, McpTool[]>();

/* ── Transport helpers ── */

function uiTransportToType(transport: string | undefined): McpServerConfig['type'] {
  switch ((transport || '').toUpperCase()) {
    case 'STDIO': return 'stdio';
    case 'SSE':   return 'sse';
    default:      return 'http';
  }
}

function withTransport(s: McpServerConfig): McpServerConfig {
  const map: Record<string, string> = { stdio: 'STDIO', sse: 'SSE', http: 'HTTP' };
  return { ...s, transport: map[s.type] ?? 'HTTP' };
}

/* ── CRUD ── */

export function listServers(): McpServerConfig[] {
  return Object.values(loadConfigs()).map(withTransport);
}

export function upsertServer(cfg: Partial<McpServerConfig> & { transport?: string }): McpServerConfig {
  const store = loadConfigs();
  const id = cfg.id || `mcp_${Date.now()}`;
  const now = new Date().toISOString();
  const existing = store[id];
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
  store[id] = server;
  saveConfigs(store);
  _toolCache.delete(id);
  killStdioProcess(id);
  return withTransport(server);
}

export function deleteServer(id: string): { ok: boolean } {
  const store = loadConfigs();
  delete store[id];
  saveConfigs(store);
  _toolCache.delete(id);
  killStdioProcess(id);
  return { ok: true };
}

/* ── Tool discovery ── */

export async function listTools(serverId: string, refresh = false): Promise<McpTool[]> {
  if (!refresh && _toolCache.has(serverId)) return _toolCache.get(serverId)!;
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

function getServerOrThrow(serverId: string): McpServerConfig {
  const store = loadConfigs();
  const server = store[serverId];
  if (!server) throw new Error(`MCP server "${serverId}" not found`);
  return server;
}

/* ════════════════════════════════════════════════════════════════
   HTTP JSON-RPC transport
   ════════════════════════════════════════════════════════════════ */

let _rpcId = 1;

async function httpRpc(
  server: McpServerConfig,
  method: string,
  params: Record<string, unknown>,
): Promise<McpRpcResponse> {
  const id = _rpcId++;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(server.headers ?? {}),
  };
  const res = await fetch(server.url!, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP server "${server.name}" HTTP ${res.status}: ${text}`);
  }
  const data = await res.json() as McpRpcResponse;
  if (data.error) throw new Error(`MCP error from "${server.name}": ${data.error.message}`);
  return data;
}

/* ════════════════════════════════════════════════════════════════
   STDIO transport
   ════════════════════════════════════════════════════════════════ */

interface StdioSession {
  proc:    ChildProcess;
  pending: Map<number, { resolve(v: McpRpcResponse): void; reject(e: Error): void }>;
  buf:     string;
}

const _stdioSessions = new Map<string, StdioSession>();

function killStdioProcess(serverId: string): void {
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

  // Disable Metal GPU watchdog on macOS — prevents kIOGPUCommandBufferCallbackErrorImpactingInteractivity
  // from killing long MLX / mflux inference runs mid-step.
  const metalEnv = process.platform === 'darwin'
    ? { MTL_MAX_COMMAND_BUFFER_EXEC_TIMEOUT: '0' }
    : {};
  const env = { ...process.env, ...metalEnv, ...(server.env ?? {}) };
  mcpLog('INFO',`[mcp] spawn "${server.name}"  cmd: ${server.command} ${(server.args ?? []).join(' ')}`);
  const proc = spawn(server.command, server.args ?? [], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const session: StdioSession = { proc, pending: new Map(), buf: '' };
  _stdioSessions.set(server.id, session);

  proc.stdout!.on('data', (chunk: Buffer) => {
    session.buf += chunk.toString();
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
    // Python MCP server writes progress logs here — surface them as info
    chunk.toString().split('\n').filter(Boolean).forEach((line) =>
      mcpLog('INFO',`[mcp-stderr] "${server.name}":`, line.trim()),
    );
  });

  proc.on('exit', (code) => {
    mcpLog('INFO',`[mcp-stdio] "${server.name}" exited (code ${code})`);
    for (const p of session.pending.values()) p.reject(new Error(`MCP process "${server.name}" exited`));
    session.pending.clear();
    _stdioSessions.delete(server.id);
  });

  mcpLog('INFO',`[mcp] initialize "${server.name}"`);
  await stdioRpc(session, server, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ck8t-server', version: '1.0.0' },
  });
  proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  mcpLog('INFO',`[mcp] "${server.name}" ready`);

  return session;
}

/** tools/call can take minutes (local MLX inference). All other RPC calls stay at 30s. */
const TOOL_CALL_TIMEOUT_MS = 3_600_000; // 1 hour

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

  const heartbeat = setInterval(() => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    mcpLog('INFO',`[mcp] ⏳ "${server.name}" ${label} still running … ${elapsed}s`);
  }, 30_000);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(heartbeat);
      session.pending.delete(id);
      mcpLog('ERROR',`[mcp] ✗ TIMEOUT "${server.name}" ${label} after ${timeoutMs / 1000}s`);
      reject(new Error(`MCP STDIO timeout for "${method}" on "${server.name}"`));
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
    session.proc.stdin!.write(msg);
  });
}

/* ════════════════════════════════════════════════════════════════
   SSE transport
   ════════════════════════════════════════════════════════════════ */

interface SseSession {
  messageUrl: string | null;
  pending:    Map<number, { resolve(v: McpRpcResponse): void; reject(e: Error): void }>;
  cleanup:    () => void;
}

const _sseSessions = new Map<string, SseSession>();

function killSseSession(serverId: string): void {
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
  if (existing) killSseSession(server.id);

  const sseUrl = /\/sse\/?$/.test(server.url ?? '')
    ? server.url!
    : (server.url ?? '').replace(/\/?$/, '/sse');

  const session: SseSession = { messageUrl: null, pending: new Map(), cleanup: () => {} };
  _sseSessions.set(server.id, session);

  return new Promise<SseSession>((resolve, reject) => {
    let endpointReceived = false;

    fetch(sseUrl, { headers: { Accept: 'text/event-stream', ...(server.headers ?? {}) } })
      .then((res) => {
        if (!res.ok || !res.body) {
          _sseSessions.delete(server.id);
          reject(new Error(`SSE connect failed for "${server.name}": HTTP ${res.status}`));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        session.cleanup = () => { try { reader.cancel(); } catch { /* ignore */ } };

        const epTimer = setTimeout(() => {
          if (!endpointReceived) {
            session.cleanup();
            _sseSessions.delete(server.id);
            reject(new Error(`SSE endpoint event timeout for "${server.name}"`));
          }
        }, 10_000);

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
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
                  try { session.messageUrl = new URL(eventData, server.url).toString(); }
                  catch { session.messageUrl = eventData; }
                  if (!endpointReceived) { endpointReceived = true; resolve(session); }
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
          } catch { /* stream closed */ }
          finally {
            for (const p of session.pending.values()) p.reject(new Error(`SSE stream closed for "${server.name}"`));
            session.pending.clear();
            _sseSessions.delete(server.id);
          }
        })();
      })
      .catch((err: unknown) => { _sseSessions.delete(server.id); reject(err); });
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
  const id    = _rpcId++;
  const body  = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(server.headers ?? {}) };
  const t0    = Date.now();
  const label = method === 'tools/call'
    ? `tools/call[${(params as { name?: string }).name ?? '?'}]`
    : method;

  mcpLog('INFO',`[mcp] → "${server.name}" ${label} (SSE, timeout ${timeoutMs / 1000}s)`);

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
   Unified dispatch
   ════════════════════════════════════════════════════════════════ */

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
    const res = await mcpRpc(server, 'tools/list', {});
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

/* ── Cleanup ── */
export function disposeMcpService(): void {
  for (const id of [..._stdioSessions.keys()]) killStdioProcess(id);
  for (const id of [..._sseSessions.keys()])   killSseSession(id);
}
