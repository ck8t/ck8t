import { Router } from 'express';
import * as path from 'path';

let _storagePath = '';

export function initConfigService(storagePath: string) {
  _storagePath = storagePath;
}

export function configRouter() {
  const router = Router();

  /** GET /api/v1/ck8t/app-config */
  router.get('/ck8t/app-config', (_req, res) => {
    const dbPath = path.join(_storagePath, 'ck8t.db');
    res.json({
      mode: 'vscode-extension',
      storagePath: _storagePath,
      dbPath,
    });
  });

  return router;
}
