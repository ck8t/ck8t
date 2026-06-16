/**
 * NS9 block handlers for the CK8T server graph runner — Sprint 27.
 *
 * Three block types:
 *  ns9_query   — ask a natural-language question; NS9 returns context packet.
 *  ns9_rlhf    — record a user correction so future answers improve.
 *  ns9_ingest  — trigger NS9 ingestion from a workflow.
 *
 * All three call through to the NS9 MCP server via callTool.
 */
import { callTool } from '../services/mcp.js';

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

// ── ns9_query ─────────────────────────────────────────────────────────────

export async function runNs9QueryBlock(opts: {
  values: Record<string, unknown>;
  input: unknown;
}): Promise<unknown> {
  const { values, input } = opts;
  const server = String(values.server || 'ns9');
  const bag    = toBag(input);

  const question = interpolate(String(values.question || '{{input}}'), bag);

  if (!question.trim()) {
    return { error: 'ns9_query: question is empty.', context_text: '', confidence: 0 };
  }

  const args: Record<string, unknown> = {
    question,
    top_k:             Number(values.top_k ?? 10),
    include_live_data: values.include_live !== false,
    include_past_qa:   values.include_qa   !== false,
  };

  try {
    const result = await callTool(server, 'ns9_query', args);
    const r = result as Record<string, unknown>;
    return { ...(r || {}), value: r?.context_text ?? '' };
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_query MCP call failed: ${msg}`, context_text: '', confidence: 0 };
  }
}

// ── ns9_rlhf ─────────────────────────────────────────────────────────────

export async function runNs9RlhfBlock(opts: {
  values: Record<string, unknown>;
  input: unknown;
}): Promise<unknown> {
  const { values, input } = opts;
  const server = String(values.server || 'ns9');
  const bag    = toBag(input);

  const question      = interpolate(String(values.question       || '{{question}}'),      bag);
  const wrongAnswer   = interpolate(String(values.wrong_answer   || '{{wrong_answer}}'),  bag);
  const correctAnswer = interpolate(String(values.correct_answer || '{{correct_answer}}'), bag);

  if (!question.trim() || !correctAnswer.trim()) {
    return { error: 'ns9_rlhf: question and correct_answer are required.', saved: false };
  }

  const args: Record<string, unknown> = {
    question,
    wrong_answer:   wrongAnswer,
    correct_answer: correctAnswer,
    corrector:      String(values.corrector || 'user'),
    propagate_now:  values.propagate_now !== false,
  };

  try {
    return await callTool(server, 'ns9_rlhf_correct', args);
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_rlhf MCP call failed: ${msg}`, saved: false };
  }
}

// ── ns9_ingest ───────────────────────────────────────────────────────────

export async function runNs9IngestBlock(opts: {
  values: Record<string, unknown>;
}): Promise<unknown> {
  const { values } = opts;
  const server = String(values.server || 'ns9');
  const source = String(values.source || 'all');
  const filePath = values.path ? String(values.path) : undefined;

  const args: Record<string, unknown> = { source };
  if (filePath) args['path'] = filePath;

  try {
    return await callTool(server, 'ns9_ingest', args);
  } catch (err: unknown) {
    const msg = (err as Error).message || String(err);
    return { error: `ns9_ingest MCP call failed: ${msg}`, triggered: false };
  }
}
