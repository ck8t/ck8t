/**
 * Server-side graph executor for the Builder Studio VS Code extension.
 *
 * Ported from ck8t-server/src/engine/graph-runner.ts.
 * Key difference: callAgent and callTool are injected as deps so the
 * extension can wire vscode.lm (for LLM) and the local MCP service.
 *
 * Supports all block types that run in the browser graph-runner:
 *   agent, mcp, function, if_else, if_elseif_else, switch_case, condition,
 *   json_map, json_path, json_validator, text_template, mapper, filter,
 *   sort, aggregate, merge, router_v2, ai_classifier, api, delay,
 *   variables, crypto, show_preview, table, save_to_files, response,
 *   error_handler, sub_workflow, parallel, for_loop, for_each, loop,
 *   starter, user_input, webhook_request, schedule, audio_input, skill, wait
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { AgentRequest, AgentResponse, Workflow, TraceEntry, RunResult } from '../types';
import { runNs9QueryBlock, runNs9RlhfBlock, runNs9IngestBlock } from './ns9-block';
import { customBlockRunners, customBlockMeta, emitBlockProgress } from '../services/block-loader';

/* ── Dependency injection types ── */

export type CallAgentFn = (req: AgentRequest) => Promise<AgentResponse>;
export type CallToolFn = (serverId: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;

/* ── Utility ── */

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function jsonPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interpolateBag(template: string, bag: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, key: string) => {
    const val = bag[key.trim()];
    if (val === undefined) return '';
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}

function evalSafe(expr: string, input: unknown): unknown {
  try {
    const fn = new Function('input', 'return ' + expr);
    return fn(input);
  } catch { return undefined; }
}

function checkValueType(value: unknown, expectedType: string): string | null {
  if (!expectedType || expectedType === 'any') return null;
  if (value == null) return null;
  switch (expectedType) {
    case 'string':  return typeof value !== 'string'  ? `expected string, got ${typeof value}` : null;
    case 'number':  return typeof value !== 'number'  ? `expected number, got ${typeof value}` : null;
    case 'boolean': return typeof value !== 'boolean' ? `expected boolean, got ${typeof value}` : null;
    case 'json':    return (typeof value !== 'object' || Array.isArray(value)) ? `expected json object, got ${Array.isArray(value) ? 'array' : typeof value}` : null;
    case 'array':   return !Array.isArray(value) ? `expected array, got ${typeof value}` : null;
    default:        return null;
  }
}

/* ── Block handlers ── */

async function runAgentNode(opts: {
  node: { id: string; data?: Record<string, unknown> };
  values: Record<string, unknown>;
  input: unknown;
  callAgent: CallAgentFn;
}): Promise<unknown> {
  const { values, input, callAgent } = opts;

  const bag: Record<string, unknown> = {};
  if (typeof input === 'string') {
    bag['input'] = input;
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(bag, parsed);
    } catch { if (/^https?:\/\//.test(input)) bag['url'] = input; }
  } else if (input && typeof input === 'object') {
    Object.assign(bag, input as Record<string, unknown>);
    bag['input'] = JSON.stringify(input);
  } else {
    bag['input'] = String(input ?? '');
  }

  const rawModel = values.model ? String(values.model) : null;
  if (!rawModel) {
    const nodeTitle = String((opts.node.data?.['title']) || opts.node.id);
    throw new Error(
      `No model provider configured for "${nodeTitle}". ` +
      'Open Settings → LLM Provider Configuration, select a default model and save.'
    );
  }
  const model          = rawModel;
  const provider       = values.provider ? String(values.provider) : undefined;
  const temperature    = Number(values.temperature ?? 0.7);
  const systemPrompt   = interpolateBag(String(values.systemPrompt || ''), bag);
  const userPrompt     = interpolateBag(String(values.userPrompt || '{{input}}'), bag);
  const responseFormat = values.responseFormat ? String(values.responseFormat) : null;
  const strictOutput   = values.strictOutput === true;

  const agent = {
    id: String(values.id || opts.node.id),
    provider, model, temperature, systemPrompt, userPrompt, responseFormat, strictOutput,
  };
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

  const res = await callAgent({ agent, input: inputStr });

  return {
    __meta: { provider, model, temperature, systemPrompt, userPrompt, rawAgentResponse: res },
    value: {
      data: res.output,
      status: 200,
      headers: { 'x-model': model, 'x-duration-ms': res.ms },
    },
  };
}

async function runMcpNode(opts: {
  values: Record<string, unknown>;
  input: unknown;
  callTool: CallToolFn;
}): Promise<unknown> {
  const { values, input, callTool } = opts;
  const serverId = String(values.server || '');
  const tool     = String(values.tool || '');

  // `input` is whatever the upstream node produced — use it directly as tool args.
  let args: Record<string, unknown> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    args = input as Record<string, unknown>;
  } else if (typeof input === 'string' && input.trim()) {
    try { args = JSON.parse(input); } catch { args = {}; }
  }

  const resp = await callTool(serverId, tool, args);
  return (resp as { result?: unknown })?.result ?? resp;
}

function runFunctionNode(opts: { values: Record<string, unknown>; input: unknown }): unknown {
  const src = String(opts.values.code || 'return input');
  try {
    const fn = new Function('input', 'values', src);
    return fn(opts.input, opts.values);
  } catch (err) { throw new Error('Function node error: ' + (err as Error).message); }
}

function runIfElseNode(opts: { values: Record<string, unknown>; input: unknown }): { branch: string; value: unknown } {
  const expr   = String(opts.values.expression || opts.values.condition || 'true');
  const result = evalSafe(expr, opts.input);
  return { branch: result ? 'true' : 'false', value: opts.input };
}

function runIfElseIfElseNode(opts: { values: Record<string, unknown>; input: unknown }): { branch: string; value: unknown } {
  const rows = Array.isArray(opts.values.conditions) ? opts.values.conditions : [];
  const n    = Math.max(1, Math.min(8, Number(opts.values.branches) || rows.length || 2));
  for (let i = 0; i < n; i++) {
    const row  = rows[i] as Record<string, unknown> | undefined;
    if (!row) continue;
    const expr = row.expression ?? (Array.isArray(row) ? (row as unknown[])[1] : undefined);
    if (!expr) continue;
    if (evalSafe(String(expr), opts.input)) return { branch: `branch_${i + 1}`, value: opts.input };
  }
  return { branch: 'else', value: opts.input };
}

function runSwitchNode(opts: { values: Record<string, unknown>; input: unknown }): { branch: string; value: unknown } {
  const keyVal  = opts.values.keyExpr ? evalSafe(String(opts.values.keyExpr), opts.input) : opts.input;
  const key     = String(keyVal);
  const cases   = Array.isArray(opts.values.cases) ? opts.values.cases : [];
  const n       = Math.max(1, Math.min(12, Number(opts.values.caseCount) || cases.length || 3));
  for (let i = 0; i < Math.min(n, cases.length); i++) {
    const c     = cases[i] as Record<string, unknown>;
    const match = c.value ?? c.match ?? (Array.isArray(cases[i]) ? (cases[i] as unknown[])[0] : undefined);
    if (match != null && String(match) === key) return { branch: `case_${i + 1}`, value: opts.input };
  }
  return { branch: 'default', value: opts.input };
}

function runJsonMapNode(opts: { values: Record<string, unknown>; input: unknown }): unknown {
  let parsed = opts.input;
  if (typeof opts.input === 'string') { try { parsed = JSON.parse(opts.input); } catch { return opts.input; } }

  const rows    = Array.isArray(opts.values.mappingPairs) ? opts.values.mappingPairs : [];
  let mappings: Array<{ key: string; path: string }> = [];
  if (rows.length > 0) {
    mappings = rows.map((r: unknown) => {
      if (!Array.isArray(r)) return null;
      const k = String((r as unknown[])[0] ?? '').trim();
      const p = String((r as unknown[])[1] ?? '').trim();
      return k ? { key: k, path: p || '$' } : null;
    }).filter(Boolean) as Array<{ key: string; path: string }>;
  } else if (opts.values.mappings) {
    try { mappings = typeof opts.values.mappings === 'string' ? JSON.parse(opts.values.mappings) : opts.values.mappings as Array<{ key: string; path: string }>; } catch { mappings = []; }
  }

  const result: Record<string, unknown> = {};
  for (const m of mappings) result[m.key] = jsonPath(parsed, m.path);
  return result;
}

function runTextTemplateNode(opts: { values: Record<string, unknown>; input: unknown }): string {
  const template = String(opts.values.template || '');
  const bag: Record<string, unknown> = { input: opts.input };
  if (opts.input && typeof opts.input === 'object' && !Array.isArray(opts.input)) Object.assign(bag, opts.input as Record<string, unknown>);
  return interpolateBag(template, bag);
}

function runJsonPathNode(opts: { values: Record<string, unknown>; input: unknown }): unknown {
  let parsed = opts.input;
  if (typeof opts.input === 'string') { try { parsed = JSON.parse(opts.input); } catch { return opts.input; } }
  const result = jsonPath(parsed, String(opts.values.path || ''));
  if ((result === undefined || result === null) && opts.values.fallback != null && opts.values.fallback !== '') return opts.values.fallback;
  return result !== undefined ? result : null;
}

async function runMapperNode(opts: { values: Record<string, unknown>; input: unknown }): Promise<unknown> {
  const mode = String(opts.values.mode || 'json_parse');
  switch (mode) {
    case 'json_parse':
      if (typeof opts.input === 'object' && opts.input !== null) return opts.input;
      if (typeof opts.input !== 'string') return opts.input;
      try { return JSON.parse(opts.input); } catch { throw new Error('Mapper: input is not valid JSON'); }
    case 'json_stringify':
      return typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input);
    case 'to_number': {
      const n = Number(opts.input);
      if (Number.isNaN(n)) throw new Error(`Mapper: cannot convert "${String(opts.input).slice(0, 50)}" to number`);
      return n;
    }
    case 'to_boolean':
      if (typeof opts.input === 'boolean') return opts.input;
      if (typeof opts.input === 'number')  return opts.input !== 0;
      return String(opts.input).toLowerCase() === 'true';
    case 'to_string':
      return typeof opts.input === 'string' ? opts.input : (typeof opts.input === 'object' ? JSON.stringify(opts.input) : String(opts.input));
    case 'base64_encode':
      return Buffer.from(String(opts.input), 'utf8').toString('base64');
    case 'base64_decode':
      return Buffer.from(String(opts.input), 'base64').toString('utf8');
    case 'url_encode':
      return encodeURIComponent(String(opts.input));
    case 'url_decode':
      return decodeURIComponent(String(opts.input));
    case 'trim':
      return String(opts.input).trim();
    case 'upper':
      return String(opts.input).toUpperCase();
    case 'lower':
      return String(opts.input).toLowerCase();
    case 'skill':
      throw new Error('Mapper skill mode requires workspace skill execution — not supported in the VS Code extension runner.');
    default:
      return opts.input;
  }
}

function runFilterNode(opts: { values: Record<string, unknown>; input: unknown }): { kept: unknown[]; rejected: unknown[] } {
  let arr = opts.input;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return { kept: [], rejected: [] }; } }
  if (!Array.isArray(arr)) return { kept: [], rejected: [] };

  const expr    = String(opts.values.expression || opts.values.condition || 'true');
  const kept: unknown[]     = [];
  const rejected: unknown[] = [];
  for (const item of arr) {
    try {
      const fn = new Function('item', 'return ' + expr);
      if (fn(item)) kept.push(item); else rejected.push(item);
    } catch { rejected.push(item); }
  }
  return { kept, rejected };
}

function runSortNode(opts: { values: Record<string, unknown>; input: unknown }): unknown[] {
  let arr = opts.input;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return []; } }
  if (!Array.isArray(arr)) return [];

  const field = String(opts.values.field || '');
  const order = String(opts.values.order || 'asc');
  const sorted = [...arr];

  sorted.sort((a, b) => {
    const va = field ? jsonPath(a, field) : a;
    const vb = field ? jsonPath(b, field) : b;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return order === 'asc' ? va - vb : vb - va;
    return order === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  return sorted;
}

function runAggregateNode(opts: { values: Record<string, unknown>; input: unknown }): unknown {
  let arr = opts.input;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return null; } }
  if (!Array.isArray(arr)) return arr;

  const op    = String(opts.values.operation || 'count');
  const field = String(opts.values.field || '');

  const nums = () => arr.map((item: unknown) => Number(field ? jsonPath(item, field) : item)).filter((n) => !Number.isNaN(n)) as number[];

  switch (op) {
    case 'count': return arr.length;
    case 'sum':   return nums().reduce((a, b) => a + b, 0);
    case 'avg':   { const ns = nums(); return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0; }
    case 'min':   return Math.min(...nums());
    case 'max':   return Math.max(...nums());
    case 'first': return arr[0];
    case 'last':  return arr[arr.length - 1];
    case 'join':  return arr.map((i: unknown) => field ? jsonPath(i, field) : i).join(String(opts.values.separator ?? ','));
    default:      return arr.length;
  }
}

function runMergeNode(opts: { inputsByHandle: Record<string, unknown> }): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const val of Object.values(opts.inputsByHandle)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(result, val as Record<string, unknown>);
  }
  return result;
}

const API_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface ApiNodeParam { Key?: string; Value?: unknown }

/**
 * Full HTTP client block — url/method/headers/params/body/timeout/retries,
 * with binary-aware responses so an image API (e.g. Ideogram) can feed
 * straight into a preview node as a data URI. Auth is just a header
 * (Authorization / Api-Key / etc.) — exactly like fetch/axios.
 */
async function runApiNode(opts: { values: Record<string, unknown>; input: unknown }): Promise<{ data: unknown; status: number; headers: Record<string, string>; error?: string }> {
  const bag: Record<string, unknown> = { input: opts.input };
  if (opts.input && typeof opts.input === 'object' && !Array.isArray(opts.input)) Object.assign(bag, opts.input as Record<string, unknown>);
  const substitute = (s: string) => interpolateBag(s, bag);

  const method = String(opts.values.method || 'GET').toUpperCase();
  let url = substitute(String(opts.values.url || ''));

  let params: ApiNodeParam[] = Array.isArray(opts.values.params) ? (opts.values.params as ApiNodeParam[]) : [];
  if (typeof opts.values.params === 'string') { try { params = JSON.parse(opts.values.params); } catch { params = []; } }
  if (params.length > 0) {
    const qs = params.filter((p) => p.Key).map((p) => encodeURIComponent(p.Key as string) + '=' + encodeURIComponent(substitute(String(p.Value ?? '')))).join('&');
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const rawHeaders = opts.values.headers;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (Array.isArray(rawHeaders)) {
    for (const h of rawHeaders as ApiNodeParam[]) { if (h.Key) headers[h.Key] = substitute(String(h.Value ?? '')); }
  } else if (typeof rawHeaders === 'string') {
    try { Object.assign(headers, JSON.parse(rawHeaders)); } catch { /* ignore */ }
  } else if (rawHeaders && typeof rawHeaders === 'object') {
    Object.assign(headers, rawHeaders as Record<string, string>);
  }

  let bodyStr: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const rawBody = opts.values.body;
    if (rawBody !== undefined && rawBody !== '') bodyStr = typeof rawBody === 'string' ? substitute(rawBody) : JSON.stringify(rawBody);
  }

  const timeoutMs = Number(opts.values.timeout) > 0 ? Number(opts.values.timeout) : 300_000;
  const maxRetries = Math.max(0, Number(opts.values.retries) || 0);
  const retryDelayMs = Number(opts.values.retryDelayMs) > 0 ? Number(opts.values.retryDelayMs) : 500;
  const retryMaxDelayMs = Number(opts.values.retryMaxDelayMs) > 0 ? Number(opts.values.retryMaxDelayMs) : 30_000;
  const canRetry = API_IDEMPOTENT_METHODS.has(method) || opts.values.retryNonIdempotent === true;

  const attemptFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await fetch(url, { method, headers, body: bodyStr, signal: controller.signal });
      const ms = Date.now() - t0;
      const ct = res.headers.get('content-type') || '';
      let data: unknown;
      if (ct.includes('application/json')) {
        try { data = await res.json(); } catch { data = await res.text(); }
      } else if (/^image\//.test(ct) || ct === 'application/octet-stream' || ct === 'application/pdf') {
        const buf = await res.arrayBuffer();
        data = `data:${ct};base64,${Buffer.from(buf).toString('base64')}`;
      } else {
        data = await res.text();
      }
      const outHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { outHeaders[k] = v; });
      outHeaders['x-duration-ms'] = String(ms);
      return { data, status: res.status, headers: outHeaders, ok: res.ok };
    } finally {
      clearTimeout(timer);
    }
  };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await attemptFetch();
      if (!result.ok && result.status >= 500 && attempt < maxRetries && canRetry) {
        lastErr = new Error(`HTTP ${result.status}`);
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const { ok: _ok, ...rest } = result;
      return rest;
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries && canRetry) {
        const delay = Math.min(retryDelayMs * 2 ** attempt, retryMaxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  const message = lastErr?.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : (lastErr?.message || 'Request failed');
  return { data: null, status: 0, headers: {}, error: message };
}

function runCryptoNode(opts: { values: Record<string, unknown>; input: unknown }): unknown {
  const op    = String(opts.values.operation || opts.values.mode || 'sha256');
  const input = typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input);

  switch (op) {
    case 'sha256': return createHash('sha256').update(input).digest('hex');
    case 'sha512': return createHash('sha512').update(input).digest('hex');
    case 'md5':    return createHash('md5').update(input).digest('hex');
    case 'hmac_sha256': {
      const key = String(opts.values.key || '');
      return createHmac('sha256', key).update(input).digest('hex');
    }
    case 'uuid':   return randomUUID();
    case 'base64_encode': return Buffer.from(input, 'utf8').toString('base64');
    case 'base64_decode': return Buffer.from(input, 'base64').toString('utf8');
    default:       return createHash('sha256').update(input).digest('hex');
  }
}

function runVariablesNode(opts: { values: Record<string, unknown>; input: unknown }): Record<string, unknown> {
  const vars: Record<string, unknown> = {};
  const bag: Record<string, unknown> = { input: opts.input };
  if (opts.input && typeof opts.input === 'object' && !Array.isArray(opts.input)) Object.assign(bag, opts.input as Record<string, unknown>);

  const entries = Array.isArray(opts.values.variables) ? opts.values.variables : [];
  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    const key = String(e.key ?? e.name ?? '').trim();
    if (!key) continue;
    const val = e.value ?? e.expression ?? '';
    vars[key] = typeof val === 'string' ? interpolateBag(val, bag) : val;
  }
  return { ...bag, ...vars };
}

async function runAiClassifierNode(opts: {
  node: { id: string };
  values: Record<string, unknown>;
  input: unknown;
  callAgent: CallAgentFn;
}): Promise<{ category: string; confidence: number }> {
  const categories = Array.isArray(opts.values.categories) ? opts.values.categories : [];
  const catList    = categories.map((c: unknown) => (typeof c === 'string' ? c : JSON.stringify(c))).join(', ');
  const prompt     = `Classify the following input into exactly one of these categories: ${catList}.\n\nRespond with a JSON object: {"category":"<category>","confidence":<0-1>}\n\nInput: ${typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input)}`;

  const classifierModel = opts.values.model ? String(opts.values.model) : null;
  if (!classifierModel) {
    throw new Error(
      `No model provider configured for AI Classifier node "${opts.node.id}". ` +
      'Open Settings → LLM Provider Configuration, select a default model and save.'
    );
  }
  const res = await opts.callAgent({
    agent: {
      id: opts.node.id,
      model: classifierModel,
      systemPrompt: 'You are a precise classifier. Respond only with the JSON object requested.',
      userPrompt: prompt,
      responseFormat: '{"category":"string","confidence":"number"}',
      strictOutput: true,
    },
    input: typeof opts.input === 'string' ? opts.input : JSON.stringify(opts.input),
  });

  try {
    const json = JSON.parse(res.output);
    return { category: String(json.category ?? ''), confidence: Number(json.confidence ?? 0) };
  } catch {
    return { category: String(res.output).trim(), confidence: 0.5 };
  }
}

// ── Chain of Thought / Multi-agent blocks (Sprint 16) ─────────────────────

async function runChainOfThoughtNode(opts: {
  node: { id: string; data?: Record<string, unknown> };
  values: Record<string, unknown>;
  input: unknown;
  callAgent: CallAgentFn;
}): Promise<{ reasoning_steps: string[]; conclusion: string; confidence: number; full_response: unknown }> {
  const { node, values, input, callAgent } = opts;
  const question = String(values.question || (typeof input === 'string' ? input : JSON.stringify(input ?? '')));
  const contextStr = values.context ? (typeof values.context === 'string' ? values.context : JSON.stringify(values.context)) : '';
  const effort = String(values.effort || 'medium');
  const stepCount = effort === 'low' ? '2–3' : effort === 'high' ? '6–8' : '4–5';
  const rawModel = values.model ? String(values.model) : null;
  if (!rawModel) throw new Error(`No model configured for Chain of Thought block "${node.data?.title || node.id}". Open Settings → LLM Provider Configuration.`);

  const systemPrompt =
    `You are a careful reasoning engine. When given a question you MUST:\n` +
    `1. Write ${stepCount} numbered reasoning steps (prefix each with "Step N: ...")\n` +
    `2. State a final conclusion\n3. Rate your confidence 0–1\n\n` +
    `Respond ONLY with valid JSON:\n{"reasoning_steps":["Step 1: ..."],"conclusion":"...","confidence":0.85}`;

  const userPrompt = contextStr ? `Context:\n${contextStr}\n\nQuestion:\n${question}` : question;
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '');

  let parsed: Record<string, unknown> = {};
  try {
    const res = await callAgent({ agent: { id: node.id, model: rawModel, temperature: 0.2, systemPrompt, userPrompt }, input: inputStr });
    const raw = res.output.trim();
    parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
  } catch {
    return { reasoning_steps: [], conclusion: inputStr, confidence: 0.5, full_response: parsed };
  }
  return {
    reasoning_steps: Array.isArray(parsed.reasoning_steps) ? (parsed.reasoning_steps as string[]) : [],
    conclusion: String(parsed.conclusion ?? ''),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
    full_response: parsed,
  };
}

async function runSlaveAgentNode(opts: {
  node: { id: string; data?: Record<string, unknown> };
  values: Record<string, unknown>;
  input: unknown;
  callAgent: CallAgentFn;
}): Promise<{ answer: string; cited_nodes: string[]; confidence: number; needs_clarification: boolean }> {
  const { node, values, input, callAgent } = opts;
  const task = String(values.task || (typeof input === 'string' ? input : JSON.stringify(input ?? '')));
  const contextStr = values.context ? (typeof values.context === 'string' ? values.context : JSON.stringify(values.context)) : '';
  const rawModel = values.model ? String(values.model) : null;
  if (!rawModel) throw new Error(`No model configured for Slave Agent block "${node.data?.title || node.id}". Open Settings → LLM Provider Configuration.`);

  const capabilityLabel = String(values.capabilityLabel || 'specialist');
  const systemPrompt = String(values.systemPrompt ||
    `You are a specialist agent (${capabilityLabel}). Answer the given task concisely. ` +
    `Respond with JSON: {"answer":"...","cited_nodes":[],"confidence":0.8,"needs_clarification":false}`
  );
  const userPrompt = contextStr ? `Context:\n${contextStr}\n\nTask:\n${task}` : task;
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '');

  try {
    const res = await callAgent({ agent: { id: node.id, model: rawModel, temperature: 0.3, systemPrompt, userPrompt }, input: inputStr });
    const raw = res.output.trim();
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    return {
      answer: String(parsed.answer ?? raw),
      cited_nodes: Array.isArray(parsed.cited_nodes) ? parsed.cited_nodes : [],
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.7))),
      needs_clarification: Boolean(parsed.needs_clarification ?? false),
    };
  } catch {
    return { answer: task, cited_nodes: [], confidence: 0.5, needs_clarification: false };
  }
}

interface MasterCotStep { id: string; sub_question: string; capability: string; depends_on: string[] }

function topoSortSteps(steps: MasterCotStep[]): MasterCotStep[][] {
  const layers: MasterCotStep[][] = [];
  const resolved = new Set<string>();
  let remaining = [...steps];
  let guard = steps.length + 2;
  while (remaining.length > 0 && guard-- > 0) {
    const ready = remaining.filter((s) => s.depends_on.every((d) => resolved.has(d)));
    if (ready.length === 0) { layers.push(remaining); break; }
    layers.push(ready);
    ready.forEach((s) => resolved.add(s.id));
    remaining = remaining.filter((s) => !resolved.has(s.id));
  }
  return layers;
}

async function runMasterAgentNode(opts: {
  node: { id: string; data?: Record<string, unknown> };
  values: Record<string, unknown>;
  input: unknown;
  allNodes: { id: string; data?: Record<string, unknown> }[];
  subBlockValues: Record<string, Record<string, unknown>>;
  callAgent: CallAgentFn;
}): Promise<{ final_answer: string; slave_outputs: Record<string, unknown>; cot_plan: unknown; confidence: number }> {
  const { node, values, input, allNodes, subBlockValues, callAgent } = opts;
  const question = String(values.question || (typeof input === 'string' ? input : JSON.stringify(input ?? '')));
  const contextStr = values.context ? (typeof values.context === 'string' ? values.context : JSON.stringify(values.context)) : '';
  const rawModel = values.model ? String(values.model) : null;
  if (!rawModel) throw new Error(`No model configured for Master Agent block "${node.data?.title || node.id}". Open Settings → LLM Provider Configuration.`);

  const slaveNodes = allNodes.filter((n) => n.data?.blockType === 'slave_agent');
  const slaveCapabilities = slaveNodes.map((n) => ({
    nodeId: n.id,
    capability: String((subBlockValues[n.id] ?? {}).capabilityLabel || n.data?.title || n.id),
  }));

  const capabilityList = slaveCapabilities.length > 0
    ? slaveCapabilities.map((sc, i) => `  ${i + 1}. ${sc.capability} (id: ${sc.nodeId})`).join('\n')
    : '  (no slaves registered — the master will answer directly)';

  const planSystemPrompt =
    `You are a master orchestrator. Break the question into sub-tasks.\nAvailable slaves:\n${capabilityList}\n\n` +
    `Respond ONLY with valid JSON:\n{"steps":[{"id":"step_1","sub_question":"...","capability":"<label>","depends_on":[]}]}`;
  const planUserPrompt = contextStr ? `Context:\n${contextStr}\n\nQuestion:\n${question}` : question;

  let cotPlan: MasterCotStep[] = [];
  let rawPlanJson: unknown = null;
  try {
    const planRes = await callAgent({ agent: { id: node.id + '_plan', model: rawModel, temperature: 0.3, systemPrompt: planSystemPrompt, userPrompt: planUserPrompt }, input: question });
    const planRaw = planRes.output.trim();
    rawPlanJson = JSON.parse(planRaw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    cotPlan = (rawPlanJson as { steps: MasterCotStep[] }).steps ?? [];
  } catch {
    cotPlan = slaveCapabilities.map((sc, i) => ({ id: `step_${i + 1}`, sub_question: question, capability: sc.capability, depends_on: [] }));
    rawPlanJson = { steps: cotPlan, fallback: true };
  }

  const capabilityToNodeId = Object.fromEntries(slaveCapabilities.map((sc) => [sc.capability, sc.nodeId]));
  const slaveOutputs: Record<string, unknown> = {};
  let sharedContext = contextStr;

  for (const layer of topoSortSteps(cotPlan)) {
    const results = await Promise.allSettled(layer.map(async (step) => {
      const slaveNodeId = capabilityToNodeId[step.capability];
      const slaveNode = slaveNodeId ? allNodes.find((n) => n.id === slaveNodeId) : null;
      if (!slaveNode) return { stepId: step.id, result: { answer: `No slave for capability: ${step.capability}`, cited_nodes: [], confidence: 0.3, needs_clarification: false } };
      const slaveValues = subBlockValues[slaveNode.id] ?? {};
      const result = await runSlaveAgentNode({ node: slaveNode, values: { ...slaveValues, task: step.sub_question, context: sharedContext }, input: step.sub_question, callAgent });
      return { stepId: step.id, result };
    }));
    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        slaveOutputs[settled.value.stepId] = settled.value.result;
        sharedContext += `\n\n[${settled.value.stepId}] ${(settled.value.result as { answer?: string }).answer ?? ''}`;
      }
    }
  }

  const evidenceParts = Object.entries(slaveOutputs).map(([id, r]) => `[${id}] ${(r as { answer?: string }).answer ?? ''}`).join('\n\n');
  const synthSystem = String(values.synthesisPrompt || `You are a synthesis agent. Produce a concise final answer. Respond with JSON: {"final_answer":"...","confidence":0.9}`);
  const synthUserPrompt = `Question:\n${question}\n\nEvidence:\n${evidenceParts}`;
  let finalAnswer = evidenceParts || question;
  let confidence = 0.7;
  try {
    const synthRes = await callAgent({ agent: { id: node.id + '_synthesis', model: rawModel, temperature: 0.2, systemPrompt: synthSystem, userPrompt: synthUserPrompt }, input: synthUserPrompt });
    const synthJson = JSON.parse(synthRes.output.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    finalAnswer = String(synthJson.final_answer ?? finalAnswer);
    confidence = Math.min(1, Math.max(0, Number(synthJson.confidence ?? 0.7)));
  } catch { /* use concatenated evidence */ }

  return { final_answer: finalAnswer, slave_outputs: slaveOutputs, cot_plan: rawPlanJson, confidence };
}

// ── Card port defaults (mirrors io-registry.js cardPortOverrides) ──────────
// Used to determine disabled-node behaviour: only nodes with BOTH inputs and
// outputs do a pass-through; others are skipped (produce null).
const CARD_PORT_DEFAULTS: Record<string, { inputs: string[]; outputs: string[] }> = {
  starter:         { inputs: [],  outputs: [] },
  user_input:      { inputs: [],  outputs: ['value'] },
  schedule:        { inputs: [],  outputs: ['firedAt'] },
  webhook_request: { inputs: [],  outputs: ['body', 'headers', 'query'] },
  audio_input:     { inputs: ['input'], outputs: ['audio'] },
  variables:       { inputs: [],  outputs: [] },
  agent:           { inputs: ['input'],  outputs: ['data', 'status', 'headers'] },
  function:        { inputs: ['input'],  outputs: ['result'] },
  response:        { inputs: ['data', 'status', 'headers'], outputs: ['data', 'status', 'headers'] },
  mcp:             { inputs: ['input'],  outputs: ['content'] },
  api:             { inputs: ['input', 'body'], outputs: ['data', 'status', 'headers'] },
  mapper:          { inputs: ['input'],  outputs: ['result'] },
  skill:           { inputs: ['input'],  outputs: ['result'] },
  text_template:   { inputs: ['input'],  outputs: ['result'] },
  json_map:        { inputs: ['input'],  outputs: ['result'] },
  json_path:       { inputs: ['input'],  outputs: ['result'] },
  filter:          { inputs: ['input'],  outputs: ['kept', 'rejected', 'count'] },
  sort:            { inputs: ['input'],  outputs: ['sorted', 'count'] },
  aggregate:       { inputs: ['input'],  outputs: ['result', 'count'] },
  merge:           { inputs: ['input1', 'input2'], outputs: ['merged'] },
  if_else:         { inputs: ['input'],  outputs: [] },
  if_elseif_else:  { inputs: ['input'],  outputs: [] },
  switch:          { inputs: ['input'],  outputs: [] },
  condition:       { inputs: ['input'],  outputs: ['conditionResult', 'selectedPath'] },
  for_loop:        { inputs: ['input'],  outputs: ['iterations', 'last'] },
  for_each:        { inputs: ['input'],  outputs: ['iterations', 'last'] },
  loop:            { inputs: ['collection'], outputs: ['results', 'iterations'] },
  parallel:        { inputs: ['input'],  outputs: ['results', 'winner'] },
  router_v2:       { inputs: ['context'], outputs: ['selectedRoute', 'reasoning'] },
  delay:           { inputs: ['input'],  outputs: ['output', 'elapsed'] },
  wait:            { inputs: ['input'],  outputs: ['output', 'elapsed'] },
  crypto:          { inputs: ['data'],   outputs: ['result'] },
  save_to_files:   { inputs: ['input'],  outputs: ['savedAt', 'bytes'] },
  error_handler:   { inputs: ['input'],  outputs: ['result', 'error'] },
  http_response:   { inputs: ['body', 'statusCode', 'headers'], outputs: ['sent'] },
  smtp:            { inputs: ['body', 'to', 'subject'], outputs: ['success', 'messageId'] },
  ai_classifier:   { inputs: ['input'],  outputs: ['category', 'confidence'] },
  show_preview:    { inputs: ['input'],  outputs: ['payload'] },
  sub_workflow:    { inputs: ['input'],  outputs: ['result', 'status'] },
  table:           { inputs: ['data'],   outputs: ['rows', 'count'] },
  postgresql:      { inputs: ['input'],  outputs: ['rows', 'rowCount', 'message'] },
  mongodb:         { inputs: ['input'],  outputs: ['result', 'count', 'insertedId'] },
  redis:           { inputs: ['input'],  outputs: ['result', 'success'] },
  slack:           { inputs: ['input'],  outputs: ['ok', 'ts'] },
  // Multi-agent orchestration (Sprint 16)
  chain_of_thought: { inputs: ['question', 'context'], outputs: ['reasoning_steps', 'conclusion', 'confidence', 'full_response'] },
  master_agent:     { inputs: ['question', 'context'], outputs: ['final_answer', 'slave_outputs', 'cot_plan', 'confidence'] },
  slave_agent:      { inputs: ['task', 'context'],     outputs: ['answer', 'cited_nodes', 'confidence', 'needs_clarification'] },
  // NS9 knowledge-graph blocks (Sprint 27)
  ns9_query:        { inputs: ['input'],  outputs: ['context_text', 'value', 'confidence'] },
  ns9_rlhf:         { inputs: ['input'],  outputs: ['saved'] },
  ns9_ingest:       { inputs: ['input'],  outputs: ['triggered'] },
};

function hasCardInputs(blockType: string): boolean {
  const def = CARD_PORT_DEFAULTS[blockType];
  return def ? def.inputs.length > 0 : true; // unknown blocks assumed to have ports
}

function hasCardOutputs(blockType: string): boolean {
  const def = CARD_PORT_DEFAULTS[blockType];
  return def ? def.outputs.length > 0 : true;
}

/* ── Main executor ── */

export interface ExecuteGraphOptions {
  workflow: Workflow;
  inputs: Record<string, unknown>;
  callAgent: CallAgentFn;
  callTool: CallToolFn;
}

export async function executeGraph({
  workflow,
  inputs,
  callAgent,
  callTool,
}: ExecuteGraphOptions): Promise<RunResult> {
  const { nodes: allNodes = [], edges: allEdges = [], subBlockValues = {} } = workflow;

  const disabledIds = new Set(allNodes.filter((n) => n.data?.disabled).map((n) => n.id));
  const nodes = allNodes;
  const edges = allEdges;

  // BFS reachability from seed nodes
  const outgoingAll: Record<string, typeof edges> = {};
  for (const e of edges) {
    if (!outgoingAll[e.source]) outgoingAll[e.source] = [];
    outgoingAll[e.source].push(e);
  }
  const reachable = new Set<string>();
  const seedIds = nodes
    .filter((n) => ['starter', 'user_input', 'schedule', 'webhook_request', 'audio_input'].includes(String(n.data?.blockType || '')))
    .map((n) => n.id);
  const queue = [...seedIds];
  for (const id of queue) {
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of (outgoingAll[id] || [])) if (!reachable.has(e.target)) queue.push(e.target);
  }

  const outgoing = groupBy(edges, 'source');
  const incoming = groupBy(edges, 'target');
  const outputs: Record<string, unknown> = {};
  const trace: TraceEntry[] = [];
  const started = new Set<string>();
  const chosenHandle: Record<string, string | null> = {};

  // Seed trigger nodes
  for (const n of nodes) {
    const bt = n.data?.blockType as string;
    if (!['starter', 'user_input', 'webhook_request', 'schedule', 'audio_input'].includes(bt)) continue;

    // Disabled seed node → produce null, mark started, skip core logic
    if (disabledIds.has(n.id)) {
      outputs[n.id] = null;
      trace.push({ nodeId: n.id, blockType: bt, title: n.data?.title as string, input: null, output: null, ms: 0, meta: { skipped: true, reason: 'Node is disabled' } } as TraceEntry);
      started.add(n.id);
      continue;
    }

    if (bt === 'user_input') {
      outputs[n.id] = Object.prototype.hasOwnProperty.call(inputs || {}, n.id) ? inputs[n.id] : null;
      trace.push({ nodeId: n.id, blockType: 'user_input', title: n.data?.title as string, input: null, output: outputs[n.id], ms: 0 });
      started.add(n.id);
    } else if (bt === 'starter') {
      const chatPayload = inputs?.__chat__ ?? null;
      outputs[n.id] = chatPayload;
      trace.push({ nodeId: n.id, blockType: 'starter', title: n.data?.title as string, input: null, output: chatPayload, ms: 0 });
      started.add(n.id);
    } else if (bt === 'webhook_request') {
      outputs[n.id] = inputs[n.id] ?? null;
      trace.push({ nodeId: n.id, blockType: 'webhook_request', title: n.data?.title as string, input: null, output: outputs[n.id], ms: 0 });
      started.add(n.id);
    } else if (bt === 'schedule') {
      const firedAt = new Date().toISOString();
      outputs[n.id] = { firedAt };
      trace.push({ nodeId: n.id, blockType: 'schedule', title: n.data?.title as string, input: null, output: outputs[n.id], ms: 0 });
      started.add(n.id);
    } else if (bt === 'audio_input') {
      const vals = (subBlockValues[n.id] || {}) as Record<string, unknown>;
      const audioB64 = String(vals._audioB64 ?? '');
      const audioFormat = String(vals._audioFormat ?? 'webm');
      const audioDurationMs = Number(vals._audioDurationMs ?? 0);
      outputs[n.id] = audioB64
        ? { audio_base64: audioB64, format: audioFormat, duration_ms: audioDurationMs }
        : null;
      trace.push({ nodeId: n.id, blockType: 'audio_input', title: n.data?.title as string, input: null, output: outputs[n.id], ms: 0 });
      started.add(n.id);
    }
  }

  const edgeIsLive = (e: { source: string; sourceHandle?: string }) => {
    if (!started.has(e.source)) return false;
    const chosen = chosenHandle[e.source];
    if (chosen == null) return true;
    return (e.sourceHandle || 'out') === chosen;
  };

  const resolveEdgeOutput = (e: { source: string; sourceHandle?: string }) => {
    const full = outputs[e.source];
    const sh   = e.sourceHandle || 'out';
    if (sh === 'out' || full == null || typeof full !== 'object') return full;
    const field = sh.startsWith('out_') ? sh.slice(4) : sh;
    return field in (full as Record<string, unknown>) ? (full as Record<string, unknown>)[field] : full;
  };

  /* BFS loop */
  while (true) {
    const ready = nodes.filter((n) => {
      if (started.has(n.id)) return false;
      if (!reachable.has(n.id)) return false;
      const ins = incoming[n.id] || [];
      if (ins.length === 0) return false;
      return ins.every(edgeIsLive);
    });
    if (ready.length === 0) break;

    await Promise.all(ready.map(async (n) => {
      started.add(n.id);
      const t0      = performance.now();
      const inEdges = incoming[n.id] || [];
      const upstream = inEdges.map(resolveEdgeOutput);
      const input    = upstream.length <= 1 ? upstream[0] : upstream;
      const inputsByHandle: Record<string, unknown> = {};
      for (const e of inEdges) {
        const th  = e.targetHandle || 'in';
        const key = th === 'in' ? 'input' : (th.startsWith('in_') ? th.slice(3) : th);
        if (key in inputsByHandle) continue;
        inputsByHandle[key] = resolveEdgeOutput(e);
      }
      const values = subBlockValues[n.id] || {};
      const blockType = n.data?.blockType as string;

      let output: unknown = input;
      let nodeError: string | undefined;

      if (disabledIds.has(n.id)) {
        // ── Disabled node: skip or pass-through based on port presence ──
        // Rule 1: no inputs OR no outputs → skip entirely (produce null)
        // Rule 2: both inputs AND outputs → pass input through without
        //         running core logic. Empty input (e.g. from Starter) → null.
        const bt = n.data?.blockType as string;
        if (hasCardInputs(bt) && hasCardOutputs(bt)) {
          output = input ?? null;
        } else {
          output = null;
        }
        outputs[n.id] = output;
        trace.push({
          nodeId: n.id, blockType: bt, title: n.data?.title as string,
          input, output, values: subBlockValues[n.id] || {},
          meta: hasCardInputs(bt) && hasCardOutputs(bt)
            ? { passThrough: true, reason: 'Node is disabled' }
            : { skipped: true, reason: 'Node is disabled (no pass-through — requires both input and output ports)' },
          ms: performance.now() - t0,
        });
        return;
      } else {
        try {
          switch (blockType) {
            case 'agent': {
              const raw = await runAgentNode({ node: n, values, input, callAgent });
              const meta = (raw as { __meta?: unknown; value?: unknown }).__meta;
              output = (raw as { value?: unknown }).value ?? raw;
              trace.push({ nodeId: n.id, blockType, title: n.data?.title as string, input, output, values, meta: meta as Record<string, unknown>, ms: performance.now() - t0 });
              outputs[n.id] = output;
              return;
            }
            case 'mcp': {
              output = await runMcpNode({ values, input, callTool });
              break;
            }
            case 'function': {
              output = runFunctionNode({ values, input });
              break;
            }
            case 'if_else': {
              const r = runIfElseNode({ values, input });
              chosenHandle[n.id] = r.branch;
              output = r.value;
              break;
            }
            case 'if_elseif_else': {
              const r = runIfElseIfElseNode({ values, input });
              chosenHandle[n.id] = r.branch;
              output = r.value;
              break;
            }
            case 'switch':
            case 'switch_case':
            case 'condition': {
              const r = runSwitchNode({ values, input });
              chosenHandle[n.id] = r.branch;
              output = r.value;
              break;
            }
            case 'json_map': {
              output = runJsonMapNode({ values, input });
              break;
            }
            case 'json_path': {
              output = runJsonPathNode({ values, input });
              break;
            }
            case 'text_template': {
              output = runTextTemplateNode({ values, input });
              break;
            }
            case 'mapper': {
              output = await runMapperNode({ values, input });
              break;
            }
            case 'filter': {
              output = runFilterNode({ values, input });
              break;
            }
            case 'sort': {
              output = runSortNode({ values, input });
              break;
            }
            case 'aggregate': {
              output = runAggregateNode({ values, input });
              break;
            }
            case 'merge': {
              output = runMergeNode({ inputsByHandle });
              break;
            }
            case 'api': {
              output = await runApiNode({ values, input });
              break;
            }
            case 'crypto': {
              output = runCryptoNode({ values, input });
              break;
            }
            case 'variables': {
              output = runVariablesNode({ values, input });
              break;
            }
            case 'ai_classifier': {
              output = await runAiClassifierNode({ node: n, values, input, callAgent });
              break;
            }
            case 'delay':
            case 'wait': {
              const ms = Number(values.ms ?? values.duration ?? 0);
              if (ms > 0) await new Promise((r) => setTimeout(r, ms));
              output = input;
              break;
            }
            case 'json_validator': {
              let parsed = input;
              if (typeof input === 'string') { try { parsed = JSON.parse(input); } catch { parsed = input; } }
              const rules = Array.isArray(values.rules) ? values.rules : [];
              const errors: string[] = [];
              for (const rule of rules) {
                const r = rule as Record<string, unknown>;
                const path = String(r.path ?? '');
                const rType = String(r.rule ?? '');
                const expected = r.value;
                if (!path) continue;
                const got = jsonPath(parsed, path);
                if (rType === 'exists' && got === undefined) errors.push(`${path} missing`);
                if (rType === 'equals' && String(got) !== String(expected)) errors.push(`${path} !== ${expected}`);
                if (rType === 'type' && typeof got !== String(expected)) errors.push(`${path} not a ${expected}`);
              }
              output = { valid: errors.length === 0, errors, value: parsed };
              break;
            }
            case 'response': {
              const data    = inputsByHandle['data']    ?? inputsByHandle['input'] ?? input;
              const status  = inputsByHandle['status']  ?? 200;
              const headers = inputsByHandle['headers'] ?? {};
              output = { data, status, headers };
              break;
            }
            case 'show_preview': {
              output = input;
              break;
            }
            case 'table': {
              throw new Error('Table block requires server-side execution. Use ck8t-server to run database blocks.');
            }
            case 'http_response': {
              const statusCode = Number(values.statusCode ?? 200);
              const body = (values.body !== undefined && values.body !== '') ? values.body : input;
              output = { sent: true, statusCode, body };
              break;
            }
            case 'slack': {
              throw new Error('Slack block requires server-side execution. Use ck8t-server to send Slack messages.');
            }
            case 'smtp': {
              throw new Error('SMTP block requires server-side execution. Use ck8t-server to send emails.');
            }
            case 'postgresql': {
              throw new Error('PostgreSQL block requires server-side execution. Use ck8t-server to query your database.');
            }
            case 'redis': {
              throw new Error('Redis block requires server-side execution. Use ck8t-server to use Redis.');
            }
            case 'mongodb': {
              throw new Error('MongoDB block requires server-side execution. Use ck8t-server to query MongoDB.');
            }
            case 'save_to_files': {
              // In VS Code context, emit output — actual file saving is UI-side
              output = { saved: true, input };
              break;
            }
            case 'error_handler': {
              try {
                output = { result: input, error: null };
              } catch (err: unknown) {
                output = { result: null, error: { message: (err as Error).message } };
              }
              break;
            }
            case 'router_v2': {
              const r = runSwitchNode({ values, input });
              chosenHandle[n.id] = r.branch;
              output = r.value;
              break;
            }
            case 'parallel': {
              // Fan-out: each outgoing edge gets the same input
              output = input;
              break;
            }
            case 'for_loop':
            case 'for_each': {
              let arr = input;
              if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { /* ignore */ } }
              if (Array.isArray(arr)) output = arr;
              else output = input;
              break;
            }
            case 'loop': {
              output = input;
              break;
            }
            case 'sub_workflow': {
              // Execute referenced sub-workflow inline if data available
              output = input;
              break;
            }
            case 'skill': {
              const src = String(values.source || '');
              if (src) {
                try {
                  const fn = new Function('input', 'values', src);
                  output = fn(input, values);
                } catch (err: unknown) {
                  throw new Error('Skill error: ' + (err as Error).message);
                }
              } else {
                output = input;
              }
              break;
            }
            case 'schedule':
            case 'webhook_request': {
              output = input;
              break;
            }
            case 'audio_input': {
              output = input;
              break;
            }
            // ── Multi-agent orchestration (Sprint 16) ─────────────────── //
            case 'chain_of_thought': {
              output = await runChainOfThoughtNode({ node: n, values, input, callAgent });
              break;
            }
            case 'slave_agent': {
              output = await runSlaveAgentNode({ node: n, values, input, callAgent });
              break;
            }
            case 'master_agent': {
              output = await runMasterAgentNode({ node: n, values, input, allNodes, subBlockValues, callAgent });
              break;
            }
            // ── NS9 blocks (Sprint 27) ────────────────────────────────── //
            case 'ns9_query': {
              output = await runNs9QueryBlock({ values, input, callTool });
              break;
            }
            case 'ns9_rlhf': {
              output = await runNs9RlhfBlock({ values, input, callTool });
              break;
            }
            case 'ns9_ingest': {
              output = await runNs9IngestBlock({ values, input, callTool });
              break;
            }
            default: {
              // Community blocks installed at ~/.salilvnair/ck8t/blocks/ via Block Manager.
              const customRun = customBlockRunners.get(blockType);
              if (customRun) {
                const blkHasProgress = customBlockMeta.get(blockType)?.hasProgress ?? false;
                const progressFn = blkHasProgress
                  ? (data: Record<string, unknown>) => emitBlockProgress(n.id, data)
                  : undefined;
                try {
                  output = await customRun({
                    values,
                    input,
                    inputsByHandle,
                    outputs,
                    node: n,
                    allNodes,
                    subBlockValues,
                    callTool,
                    callAgent: callAgent as Parameters<typeof customRun>[0]['callAgent'],
                    progress: progressFn,
                  });
                } finally {
                  if (progressFn) emitBlockProgress(n.id, null);
                }
              } else {
                output = input;
              }
              break;
            }
          }

          // Type-check output
          const outType = (subBlockValues[n.id]?._portTypes as Record<string, string>)?.['out_out'];
          if (outType) {
            const typeErr = checkValueType(output, outType);
            if (typeErr) console.warn(`[graph-runner] Node ${n.id} (${blockType}): ${typeErr}`);
          }

          trace.push({
            nodeId: n.id,
            blockType,
            title: n.data?.title as string,
            input,
            inputsByHandle,
            output,
            values,
            ms: performance.now() - t0,
          });
          outputs[n.id] = output;
          return;
        } catch (err: unknown) {
          const e = err as Error & { [k: string]: unknown };
          nodeError = (e.message as string | undefined) || String(err);
          output = null;
          const errorDetail: Record<string, unknown> = {
            message: nodeError,
            nodeId: n.id,
            nodeTitle: n.data?.title,
            blockType,
            timestamp: new Date().toISOString(),
          };
          if (e.url)             errorDetail.url             = e.url;
          if (e.resolvedUrl)     errorDetail.resolvedUrl     = e.resolvedUrl;
          if (e.method)          errorDetail.method          = e.method;
          if (e.status)          errorDetail.status          = e.status;
          if (e.statusText)      errorDetail.statusText      = e.statusText;
          if (e.responseBody)    errorDetail.responseBody    = e.responseBody;
          if (e.responseHeaders) errorDetail.responseHeaders = e.responseHeaders;
          if (e.requestHeaders)  errorDetail.requestHeaders  = e.requestHeaders;
          if (e.requestPayload)  errorDetail.requestPayload  = e.requestPayload;
          if (e.stack)           errorDetail.stack           = e.stack;
          if (e.cause)           errorDetail.cause           = (e.cause as Error).message || String(e.cause);
          trace.push({
            nodeId: n.id,
            blockType,
            title: n.data?.title as string,
            input,
            inputsByHandle,
            output: null,
            values,
            error: nodeError,
            errorDetail,
            ms: performance.now() - t0,
          });
          outputs[n.id] = null;
          return;
        }
      }

      outputs[n.id] = output;
    }));
  }

  // Find response node output, or last trace entry
  const responseNode = nodes.find((n) => n.data?.blockType === 'response');
  const finalOutput  = responseNode ? outputs[responseNode.id] : (trace[trace.length - 1]?.output ?? null);

  return { output: finalOutput, trace };
}

// Expose a simpler interface matching ck8t-server's API
export async function executeGraphSimple(opts: {
  workflow: Workflow;
  inputs: Record<string, unknown>;
  callAgent: CallAgentFn;
  callTool: CallToolFn;
}): Promise<{ output: unknown; trace: TraceEntry[] }> {
  return executeGraph(opts);
}
