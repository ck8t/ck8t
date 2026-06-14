/**
 * NS9 block handlers for the CK8T graph runner — Sprint 27.
 *
 * Three block types:
 *
 *  ns9_query   — ask a natural-language question; NS9 returns a full context
 *                packet (context_text, live_data, sources, confidence).
 *                Wire the context_text into an agent block to get an LLM answer.
 *
 *  ns9_rlhf    — record a user correction when the LLM answered wrong.
 *                NS9 updates the knowledge graph so future answers are correct.
 *
 *  ns9_ingest  — trigger NS9 ingestion from a CK8T workflow.
 *                Useful for automated pipelines (e.g. re-ingest after a deploy).
 *
 * All three blocks call through to the NS9 MCP server via the injected
 * `callTool` function (same mechanism as the generic `mcp` block).
 *
 * Block values schema
 * -------------------
 *
 *  ns9_query block:
 *    server        — MCP server ID registered in CK8T (default: "ns9")
 *    question      — the question to ask (supports {{template}} variables)
 *    include_live  — boolean, default true: query live log tables
 *    include_qa    — boolean, default true: search Q&A memory
 *    top_k         — number of search results per retriever (default 10)
 *
 *  ns9_rlhf block:
 *    server         — MCP server ID (default: "ns9")
 *    question       — the question that got the wrong answer
 *    wrong_answer   — what the LLM said (incorrect)
 *    correct_answer — the right answer
 *    corrector      — who is correcting (default: "user")
 *    propagate_now  — boolean, default true
 *
 *  ns9_ingest block:
 *    server  — MCP server ID (default: "ns9")
 *    source  — one of: code | db | logs | docs | api | ops | glossary | all
 *    path    — optional override path
 */

export type CallToolFn = (
  serverId: string,
  tool: string,
  args: Record<string, unknown>
) => Promise<unknown>;

function interpolate(template: string, bag: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, key: string) => {
    const val = bag[key.trim()];
    if (val === undefined) return '';
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}

function toBag(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string') {
    try { return JSON.parse(input) as Record<string, unknown>; } catch { /**/ }
    return { input };
  }
  return { input: String(input ?? '') };
}

// ── ns9_query ──────────────────────────────────────────────────────────────

export async function runNs9QueryBlock(opts: {
  values: Record<string, unknown>;
  input: unknown;
  callTool: CallToolFn;
}): Promise<unknown> {
  const { values, input, callTool } = opts;
  const server = String(values.server || 'ns9');
  const bag    = toBag(input);

  const question = interpolate(
    String(values.question || '{{input}}'),
    bag
  );

  if (!question.trim()) {
    return {
      error: 'ns9_query: question is empty. Set the "question" block value.',
      context_text: '',
      confidence: 0,
    };
  }

  const args: Record<string, unknown> = {
    question,
    top_k:            Number(values.top_k ?? 10),
    include_live_data: values.include_live !== false,
    include_past_qa:   values.include_qa   !== false,
  };

  try {
    const result = await callTool(server, 'ns9_query', args);
    // Surface context_text at the top level so it can be piped straight
    // into an agent block's {{input}}
    const r = result as Record<string, unknown>;
    return {
      ...(r || {}),
      value: r?.context_text ?? '',   // primary output for agent blocks
    };
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_query MCP call failed: ${msg}`, context_text: '', confidence: 0 };
  }
}

// ── ns9_rlhf ───────────────────────────────────────────────────────────────

export async function runNs9RlhfBlock(opts: {
  values: Record<string, unknown>;
  input: unknown;
  callTool: CallToolFn;
}): Promise<unknown> {
  const { values, input, callTool } = opts;
  const server = String(values.server || 'ns9');
  const bag    = toBag(input);

  const question      = interpolate(String(values.question      || '{{question}}'),      bag);
  const wrongAnswer   = interpolate(String(values.wrong_answer  || '{{wrong_answer}}'),  bag);
  const correctAnswer = interpolate(String(values.correct_answer || '{{correct_answer}}'), bag);

  if (!question.trim() || !correctAnswer.trim()) {
    return {
      error: 'ns9_rlhf: question and correct_answer are required.',
      saved: false,
    };
  }

  const args: Record<string, unknown> = {
    question,
    wrong_answer:    wrongAnswer,
    correct_answer:  correctAnswer,
    corrector:       String(values.corrector || 'user'),
    propagate_now:   values.propagate_now !== false,
  };

  try {
    return await callTool(server, 'ns9_rlhf_correct', args);
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_rlhf MCP call failed: ${msg}`, saved: false };
  }
}

// ── ns9_ingest ─────────────────────────────────────────────────────────────

export async function runNs9IngestBlock(opts: {
  values: Record<string, unknown>;
  input: unknown;
  callTool: CallToolFn;
}): Promise<unknown> {
  const { values, callTool } = opts;
  const server = String(values.server || 'ns9');

  const source = String(values.source || 'all');
  const path   = values.path ? String(values.path) : undefined;

  const args: Record<string, unknown> = { source };
  if (path) args['path'] = path;

  try {
    const result = await callTool(server, 'ns9_ingest', args);
    return result;
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_ingest MCP call failed: ${msg}`, triggered: false };
  }
}
