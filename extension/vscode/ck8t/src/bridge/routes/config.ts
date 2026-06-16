import { Router } from 'express';
import { getAuditMaxEntries, setAuditMaxEntries } from '../audit';
import { getDbPath } from '../../storage/db';

let _storagePath = '';

export function initConfigService(storagePath: string) {
  _storagePath = storagePath;
}

export function configRouter() {
  const router = Router();

  /** GET /api/v1/ck8t/app-config */
  router.get('/ck8t/app-config', (_req, res) => {
    res.json({
      mode: 'vscode-extension',
      storagePath: _storagePath,
      dbPath: getDbPath(),
      auditMaxEntries: getAuditMaxEntries(),
    });
  });

  /** PATCH /api/v1/ck8t/app-config */
  router.patch('/ck8t/app-config', (req, res) => {
    const { auditMaxEntries } = req.body as { auditMaxEntries?: number };
    if (auditMaxEntries !== undefined) {
      setAuditMaxEntries(auditMaxEntries);
    }
    res.json({ ok: true, auditMaxEntries: getAuditMaxEntries() });
  });

  return router;
}
