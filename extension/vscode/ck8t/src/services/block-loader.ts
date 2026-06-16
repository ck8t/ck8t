/**
 * Block Loader — scans ~/.salilvnair/ck8t/blocks/ on extension activate and
 * registers any installed block runners into the extension's graph-runner dispatch.
 *
 * Each block package exposes runners/extension.js which exports an array of:
 *   { type: string, run(opts): Promise<unknown> }
 *
 * These are collected into a Map and read by the graph-runner's custom-block fallback.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type CallToolFn = (serverId: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;
export type CallAgentFn = (req: {
  agent: {
    id: string;
    provider?: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
    userPrompt?: string;
    responseFormat?: string | null;
    strictOutput?: boolean;
    skills?: string[];
  };
  input: string;
}) => Promise<{ output: unknown; ms: number }>;

export interface CustomBlockRunnerOpts {
  values: Record<string, unknown>;
  input: unknown;
  inputsByHandle: Record<string, unknown>;
  outputs: Record<string, unknown>;
  node: { id: string; data?: Record<string, unknown>; [k: string]: unknown };
  allNodes: { id: string; data?: Record<string, unknown>; [k: string]: unknown }[];
  subBlockValues: Record<string, Record<string, unknown>>;
  callTool: CallToolFn;
  callAgent: CallAgentFn;
  progress?: (data: Record<string, unknown>) => void;
}

export interface CustomBlockRunner {
  type: string;
  hasProgress?: boolean;
  run(opts: CustomBlockRunnerOpts): Promise<unknown>;
}

/** Shared Map — the graph-runner imports this to look up custom blocks. */
export const customBlockRunners = new Map<string, CustomBlockRunner['run']>();

/** Per-type metadata (hasProgress etc.) populated alongside customBlockRunners. */
export const customBlockMeta = new Map<string, { hasProgress: boolean }>();

/* ── Block-progress emitter (same pattern as setMcpProgressHandler) ── */
type BlockProgressHandler = ((nodeId: string, data: Record<string, unknown> | null) => void) | null;
let _blockProgressHandler: BlockProgressHandler = null;
export function setBlockProgressHandler(h: BlockProgressHandler): void { _blockProgressHandler = h; }
export function emitBlockProgress(nodeId: string, data: Record<string, unknown> | null): void {
  _blockProgressHandler?.(nodeId, data);
}

/** ~/.salilvnair/ck8t/blocks/ */
function getBlocksDir(): string {
  return path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks');
}

/**
 * Call once from extension.ts activate().
 * Scans every installed block dir, requires runners/extension.js, and
 * registers each exported runner in customBlockRunners.
 */
export function initBlockLoader(): void {
  const dir = getBlocksDir();
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(dir, entry.name, 'ck8t-block.json');
    if (!fs.existsSync(manifestPath)) continue;

    let manifest: { runners?: { extension?: string } };
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      continue;
    }

    const runnerRelPath = manifest.runners?.extension;
    if (!runnerRelPath) continue;

    const runnerPath = path.join(dir, entry.name, runnerRelPath);
    if (!fs.existsSync(runnerPath)) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(runnerPath) as CustomBlockRunner[] | { default: CustomBlockRunner[] };
      const runners: CustomBlockRunner[] = Array.isArray(mod)
        ? mod
        : Array.isArray((mod as { default: CustomBlockRunner[] }).default)
          ? (mod as { default: CustomBlockRunner[] }).default
          : [];

      for (const runner of runners) {
        if (!runner.type || typeof runner.run !== 'function') continue;
        if (customBlockRunners.has(runner.type)) {
          console.warn(`[ck8t] block-loader: duplicate type "${runner.type}" from "${entry.name}" — skipped`);
          continue;
        }
        customBlockRunners.set(runner.type, runner.run.bind(runner));
        customBlockMeta.set(runner.type, { hasProgress: runner.hasProgress === true });
        console.log(`[ck8t] block-loader: registered "${runner.type}" from "${entry.name}"`);
      }
    } catch (err: unknown) {
      console.warn(
        `[ck8t] block-loader: failed to load runner from "${entry.name}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
