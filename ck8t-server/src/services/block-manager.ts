/**
 * Block Manager service — installs, lists, and uninstalls community blocks.
 *
 * Storage root: ~/.salilvnair/ck8t/blocks/<block-id>/
 *   ck8t-block.json   — manifest
 *   ui/               — block UI definition files (served to React app)
 *   runners/
 *     server.js       — server-side graph-runner handler
 *     extension.js    — extension graph-runner handler
 *     client.js       — browser graph-runner handler
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

export interface BlockManifestEntry {
  type: string;
  ui: string;
}

export interface BlockManifestRunners {
  server?: string;
  extension?: string;
  client?: string;
}

export interface BlockManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  ck8tVersion?: string;
  blocks: BlockManifestEntry[];
  runners?: BlockManifestRunners;
  npm?: string[];
  repository?: string;
  installedAt?: string;
}

export interface InstalledBlock extends BlockManifest {
  installedAt: string;
  blockCount: number;
}

/** `~/.salilvnair/ck8t/blocks/` */
export function getBlocksDir(): string {
  return path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks');
}

function ensureBlocksDir(): string {
  const dir = getBlocksDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listInstalled(): InstalledBlock[] {
  const dir = ensureBlocksDir();
  const results: InstalledBlock[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(dir, entry.name, 'ck8t-block.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BlockManifest;
      results.push({ ...manifest, installedAt: manifest.installedAt ?? '', blockCount: manifest.blocks?.length ?? 0 });
    } catch {
      // skip malformed
    }
  }
  return results;
}

export function getManifest(id: string): BlockManifest | null {
  const manifestPath = path.join(getBlocksDir(), id, 'ck8t-block.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BlockManifest;
  } catch {
    return null;
  }
}

/** Parse a GitHub URL into { owner, repo, ref, subdir } */
function parseGithubUrl(url: string): { owner: string; repo: string; ref: string; subdir: string } {
  // Accept: https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/subdir
  const u = new URL(url.trim());
  const parts = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
  const owner = parts[0];
  const repo = parts[1];
  let ref = 'main';
  let subdir = '';
  if (parts[2] === 'tree' && parts[3]) {
    ref = parts[3];
    subdir = parts.slice(4).join('/');
  }
  return { owner, repo, ref, subdir };
}

function rawUrl(owner: string, repo: string, ref: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function installFromGitHub(githubUrl: string): Promise<InstalledBlock> {
  const { owner, repo, ref, subdir } = parseGithubUrl(githubUrl);
  const manifestFile = subdir ? `${subdir}/ck8t-block.json` : 'ck8t-block.json';
  const manifestUrl = rawUrl(owner, repo, ref, manifestFile);

  const manifestText = await fetchText(manifestUrl);
  const manifest = JSON.parse(manifestText) as BlockManifest;

  if (!manifest.id) throw new Error('ck8t-block.json missing required "id" field');
  if (!manifest.blocks || !Array.isArray(manifest.blocks)) {
    throw new Error('ck8t-block.json missing "blocks" array');
  }

  const blockDir = path.join(ensureBlocksDir(), manifest.id);
  fs.mkdirSync(blockDir, { recursive: true });

  // Collect all files to download
  const filesToFetch: string[] = ['ck8t-block.json'];
  for (const b of manifest.blocks) {
    if (b.ui) filesToFetch.push(b.ui);
  }
  if (manifest.runners) {
    for (const v of Object.values(manifest.runners)) {
      if (v) filesToFetch.push(v);
    }
  }

  for (const relFile of filesToFetch) {
    const remoteFile = subdir ? `${subdir}/${relFile}` : relFile;
    const url = rawUrl(owner, repo, ref, remoteFile);
    const localPath = path.join(blockDir, relFile);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    const bytes = await fetchBytes(url);
    fs.writeFileSync(localPath, bytes);
  }

  // Install npm deps declared in the manifest
  if (Array.isArray(manifest.npm) && manifest.npm.length > 0) {
    try {
      const pkgList = manifest.npm.map((p) => JSON.stringify(p)).join(' ');
      execSync(`npm install ${pkgList}`, { cwd: blockDir, stdio: 'pipe', timeout: 120_000 });
    } catch (err: unknown) {
      console.warn('[ck8t] block npm install failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Stamp installedAt into manifest
  const installedAt = new Date().toISOString();
  const stamped: BlockManifest = { ...manifest, repository: githubUrl, installedAt };
  fs.writeFileSync(path.join(blockDir, 'ck8t-block.json'), JSON.stringify(stamped, null, 2));

  return { ...stamped, installedAt, blockCount: manifest.blocks.length };
}

export function uninstall(id: string): void {
  const blockDir = path.join(getBlocksDir(), id);
  if (!fs.existsSync(blockDir)) throw new Error(`Block "${id}" is not installed`);
  fs.rmSync(blockDir, { recursive: true, force: true });
}

/** Check whether a GitHub-installed block has a newer version on the remote. */
export async function checkForUpdate(id: string): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
} | null> {
  const manifest = getManifest(id);
  if (!manifest?.repository) return null;

  const { owner, repo, ref, subdir } = parseGithubUrl(manifest.repository);
  const remoteFile = subdir ? `${subdir}/ck8t-block.json` : 'ck8t-block.json';
  const remoteText = await fetchText(rawUrl(owner, repo, ref, remoteFile));
  const remote = JSON.parse(remoteText) as BlockManifest;

  return {
    hasUpdate: remote.version !== manifest.version,
    currentVersion: manifest.version,
    latestVersion: remote.version,
  };
}

/** Re-download all files for a block from its original GitHub source. */
export async function updateFromGitHub(id: string): Promise<InstalledBlock> {
  const manifest = getManifest(id);
  if (!manifest?.repository) throw new Error(`Block "${id}" was not installed from GitHub`);
  return installFromGitHub(manifest.repository);
}

/** Read a UI file for a block — used to serve block definitions to the React app. */
export function readUiFile(id: string, relFile: string): string {
  const blockDir = path.join(getBlocksDir(), id);
  // Sanitise path — no traversal
  const resolved = path.resolve(blockDir, relFile);
  if (!resolved.startsWith(blockDir)) throw new Error('Path traversal rejected');
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${relFile}`);
  return fs.readFileSync(resolved, 'utf-8');
}

/** Read a server runner file — used by the server graph-runner on startup. */
export function getServerRunnerPath(id: string, manifest: BlockManifest): string | null {
  if (!manifest.runners?.server) return null;
  const p = path.join(getBlocksDir(), id, manifest.runners.server);
  return fs.existsSync(p) ? p : null;
}

/** Populated by loadServerRunners() — the graph-runner reads this map. */
export const customServerBlockRunners = new Map<string, (opts: unknown) => Promise<unknown>>();

/** Per-type metadata (hasProgress etc.) populated alongside customServerBlockRunners. */
export const customServerBlockMeta = new Map<string, { hasProgress: boolean }>();

/* ── Block-progress emitter (mirrors setMcpProgressHandler pattern) ── */
type ServerBlockProgressHandler = ((nodeId: string, data: Record<string, unknown> | null) => void) | null;
let _serverBlockProgressHandler: ServerBlockProgressHandler = null;
export function setServerBlockProgressHandler(h: ServerBlockProgressHandler): void { _serverBlockProgressHandler = h; }
export function emitServerBlockProgress(nodeId: string, data: Record<string, unknown> | null): void {
  _serverBlockProgressHandler?.(nodeId, data);
}

/**
 * Call once at server startup.
 * Scans every installed block dir, requires runners/server.js (CJS) via
 * createRequire (server is ESM), and registers each runner in customServerBlockRunners.
 */
export function loadServerRunners(): void {
  const dir = getBlocksDir();
  if (!fs.existsSync(dir)) return;

  const _require = createRequire(import.meta.url);

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(dir, entry.name, 'ck8t-block.json');
    if (!fs.existsSync(manifestPath)) continue;

    let manifest: BlockManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BlockManifest;
    } catch {
      continue;
    }

    const runnerRelPath = manifest.runners?.server;
    if (!runnerRelPath) continue;

    const runnerPath = path.join(dir, entry.name, runnerRelPath);
    if (!fs.existsSync(runnerPath)) continue;

    try {
      type RawRunner = { type: string; hasProgress?: boolean; run: (opts: unknown) => Promise<unknown> };
      const mod = _require(runnerPath) as RawRunner[] | { default: RawRunner[] };
      const runners: RawRunner[] = Array.isArray(mod)
        ? mod
        : Array.isArray((mod as { default: RawRunner[] }).default)
          ? (mod as { default: RawRunner[] }).default
          : [];

      for (const runner of runners) {
        if (!runner.type || typeof runner.run !== 'function') continue;
        if (customServerBlockRunners.has(runner.type)) {
          console.warn(`[ck8t] block-manager: duplicate server runner type "${runner.type}" from "${entry.name}" — skipped`);
          continue;
        }
        customServerBlockRunners.set(runner.type, runner.run.bind(runner));
        customServerBlockMeta.set(runner.type, { hasProgress: runner.hasProgress === true });
        console.log(`[ck8t] block-manager: registered server runner "${runner.type}" from "${entry.name}"`);
      }
    } catch (err: unknown) {
      console.warn(
        `[ck8t] block-manager: failed to load server runner from "${entry.name}":`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
