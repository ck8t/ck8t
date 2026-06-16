/**
 * Block Manager bridge routes — mirrors ck8t-server/src/services/block-manager.ts
 * but runs directly inside the VS Code extension host so the webview can
 * list / install / uninstall blocks without needing ck8t-server to be running.
 *
 * Routes:
 *   GET  /block-manager/blocks           → list installed
 *   POST /block-manager/install          → { url } — install from GitHub
 *   POST /block-manager/install-zip      → { data: base64, filename } — install from ZIP
 *   DELETE /block-manager/blocks/:id     → uninstall
 *   GET  /block-manager/ui/:id/*         → serve a block UI file
 */
import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';

/* ── Storage helpers ── */

function getBlocksDir(): string {
  return path.join(os.homedir(), '.salilvnair', 'ck8t', 'blocks');
}

function ensureBlocksDir(): string {
  const dir = getBlocksDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

interface BlockManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  blocks: { type: string; ui: string }[];
  runners?: { server?: string; extension?: string; client?: string };
  npm?: string[];
  repository?: string;
  installedAt?: string;
}

/** Install npm packages listed in the block manifest into the block directory. */
function installNpmDeps(blockDir: string, packages: string[]): void {
  if (!packages || packages.length === 0) return;
  try {
    const pkgList = packages.map((p) => JSON.stringify(p)).join(' ');
    execSync(`npm install ${pkgList}`, { cwd: blockDir, stdio: 'pipe', timeout: 120_000 });
  } catch (err: unknown) {
    console.warn('[ck8t] block npm install failed:', err instanceof Error ? err.message : String(err));
  }
}

function listInstalled() {
  const dir = ensureBlocksDir();
  const results: (BlockManifest & { blockCount: number })[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mpath = path.join(dir, entry.name, 'ck8t-block.json');
    if (!fs.existsSync(mpath)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mpath, 'utf-8')) as BlockManifest;
      results.push({ ...m, blockCount: m.blocks?.length ?? 0 });
    } catch { /* skip malformed */ }
  }
  return results;
}

/* ── GitHub install ── */

function parseGithubUrl(url: string) {
  const u = new URL(url.replace(/^github\.com/, 'https://github.com').trim());
  const parts = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/');
  const [owner, repo] = parts;
  let ref = 'main';
  let subdir = '';
  if (parts[2] === 'tree' && parts[3]) {
    ref = parts[3];
    subdir = parts.slice(4).join('/');
  }
  return { owner, repo, ref, subdir };
}

function rawUrl(owner: string, repo: string, ref: string, filePath: string) {
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

async function installFromGitHub(githubUrl: string) {
  const { owner, repo, ref, subdir } = parseGithubUrl(githubUrl);
  const manifestFile = subdir ? `${subdir}/ck8t-block.json` : 'ck8t-block.json';
  const manifest = JSON.parse(await fetchText(rawUrl(owner, repo, ref, manifestFile))) as BlockManifest;

  if (!manifest.id) throw new Error('ck8t-block.json missing "id"');
  if (!Array.isArray(manifest.blocks)) throw new Error('ck8t-block.json missing "blocks" array');

  const blockDir = path.join(ensureBlocksDir(), manifest.id);
  fs.mkdirSync(blockDir, { recursive: true });

  const files = ['ck8t-block.json'];
  for (const b of manifest.blocks) { if (b.ui) files.push(b.ui); }
  if (manifest.runners) {
    for (const v of Object.values(manifest.runners)) { if (v) files.push(v); }
  }

  for (const relFile of files) {
    const remoteFile = subdir ? `${subdir}/${relFile}` : relFile;
    const bytes = await fetchBytes(rawUrl(owner, repo, ref, remoteFile));
    const localPath = path.join(blockDir, relFile);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, bytes);
  }

  if (Array.isArray(manifest.npm) && manifest.npm.length > 0) {
    installNpmDeps(blockDir, manifest.npm);
  }

  const stamped: BlockManifest = { ...manifest, repository: githubUrl, installedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(blockDir, 'ck8t-block.json'), JSON.stringify(stamped, null, 2));
  return { ...stamped, blockCount: manifest.blocks.length };
}

/* ── Update check / update ── */

async function checkForUpdate(id: string): Promise<{
  hasUpdate: boolean; currentVersion: string; latestVersion: string;
} | null> {
  const mpath = path.join(getBlocksDir(), id, 'ck8t-block.json');
  if (!fs.existsSync(mpath)) return null;
  const manifest = JSON.parse(fs.readFileSync(mpath, 'utf-8')) as BlockManifest;
  if (!manifest.repository) return null;
  const { owner, repo, ref, subdir } = parseGithubUrl(manifest.repository);
  const remoteFile = subdir ? `${subdir}/ck8t-block.json` : 'ck8t-block.json';
  const remote = JSON.parse(await fetchText(rawUrl(owner, repo, ref, remoteFile))) as BlockManifest;
  return {
    hasUpdate: remote.version !== manifest.version,
    currentVersion: manifest.version,
    latestVersion: remote.version,
  };
}

/* ── ZIP install ── */

function installFromZip(base64Data: string) {
  const buf = Buffer.from(base64Data, 'base64');
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();

  // Find ck8t-block.json — may be at root or one level deep
  const manifestEntry = entries.find(e => {
    const parts = e.entryName.replace(/\\/g, '/').split('/').filter(Boolean);
    const file = parts[parts.length - 1];
    return file === 'ck8t-block.json' && parts.length <= 2;
  });
  if (!manifestEntry) throw new Error('No ck8t-block.json found in ZIP');

  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as BlockManifest;
  if (!manifest.id) throw new Error('ck8t-block.json missing "id"');

  // Determine strip prefix (folder name containing the manifest)
  const mParts = manifestEntry.entryName.replace(/\\/g, '/').split('/').filter(Boolean);
  const prefix = mParts.length > 1 ? mParts[0] + '/' : '';

  const blockDir = path.join(ensureBlocksDir(), manifest.id);
  fs.mkdirSync(blockDir, { recursive: true });

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const rel = entry.entryName.replace(/\\/g, '/').replace(prefix, '');
    if (!rel) continue;
    const dest = path.resolve(blockDir, rel);
    if (!dest.startsWith(blockDir)) continue; // path traversal guard
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }

  if (Array.isArray(manifest.npm) && manifest.npm.length > 0) {
    installNpmDeps(blockDir, manifest.npm);
  }

  const stamped: BlockManifest = { ...manifest, installedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(blockDir, 'ck8t-block.json'), JSON.stringify(stamped, null, 2));
  return { ...stamped, blockCount: manifest.blocks?.length ?? 0 };
}

/* ── Router ── */

export function blockManagerRouter(): Router {
  const router = Router();

  router.get('/block-manager/blocks', (_req: Request, res: Response) => {
    try {
      res.json(listInstalled());
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/block-manager/install', async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url) { res.status(400).json({ error: 'url is required' }); return; }
    try {
      res.json(await installFromGitHub(url));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/block-manager/install-zip', (req: Request, res: Response) => {
    const { data } = req.body as { data?: string };
    if (!data) { res.status(400).json({ error: 'data (base64) is required' }); return; }
    try {
      res.json(installFromZip(data));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/block-manager/blocks/:id/check-update', async (req: Request, res: Response) => {
    try {
      const result = await checkForUpdate(req.params.id);
      if (!result) { res.status(404).json({ error: 'Not a GitHub-installed block' }); return; }
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/block-manager/blocks/:id/update', async (req: Request, res: Response) => {
    try {
      const mpath = path.join(getBlocksDir(), req.params.id, 'ck8t-block.json');
      if (!fs.existsSync(mpath)) { res.status(404).json({ error: 'Block not installed' }); return; }
      const manifest = JSON.parse(fs.readFileSync(mpath, 'utf-8')) as BlockManifest;
      if (!manifest.repository) { res.status(400).json({ error: 'Not a GitHub-installed block' }); return; }
      res.json(await installFromGitHub(manifest.repository));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.delete('/block-manager/blocks/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const blockDir = path.join(getBlocksDir(), id);
    if (!fs.existsSync(blockDir)) {
      res.status(404).json({ error: `Block "${id}" is not installed` });
      return;
    }
    try {
      fs.rmSync(blockDir, { recursive: true, force: true });
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/block-manager/ui/:id/*', (req: Request, res: Response) => {
    const { id } = req.params;
    const relFile = (req.params as Record<string, string>)[0];
    const blockDir = path.join(getBlocksDir(), id);
    const resolved = path.resolve(blockDir, relFile);
    if (!resolved.startsWith(blockDir) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.type('application/javascript').send(fs.readFileSync(resolved, 'utf-8'));
  });

  return router;
}
