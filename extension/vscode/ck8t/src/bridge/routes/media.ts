import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Media routes — keep large binary blobs off the Zustand store.
 *
 * POST /ck8t/save-temp-file   — accepts base64 image/PDF, writes to OS temp dir,
 *                               returns { path, filename } so the webview can store
 *                               a lightweight sentinel instead of raw base64.
 *
 * GET  /ck8t/preview-file     — serves a previously saved temp file so the webview
 *                               can render it without holding the bytes in memory.
 *                               Security: only allows paths inside os.tmpdir().
 */
export function mediaRouter() {
  const router = Router();

  router.post('/ck8t/save-temp-file', (req: Request, res: Response) => {
    try {
      const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
      if (!base64) return res.status(400).json({ error: 'base64 is required' });

      const ext = mimeType === 'application/pdf' ? '.pdf'
        : mimeType === 'image/jpeg' ? '.jpg'
        : '.png';
      const uid = crypto.randomBytes(8).toString('hex');
      const filename = `ck8t-tmp-${uid}${ext}`;
      const filePath = path.join(os.tmpdir(), filename);

      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      res.json({ path: filePath, filename });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/ck8t/preview-file', (req: Request, res: Response) => {
    try {
      const filePath = String(req.query.path || '');
      const tmpDir = os.tmpdir();
      if (!filePath || !filePath.startsWith(tmpDir)) {
        return res.status(403).json({ error: 'Access denied: path must be inside temp dir' });
      }
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.pdf' ? 'application/pdf'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.gif' ? 'image/gif'
        : 'image/png';

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
