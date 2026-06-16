import { Router, Request, Response } from 'express';
import { getAuditEntries, clearAuditEntries, getAuditStats } from '../audit';

export function auditRouter() {
  const router = Router();

  /* GET /api/v1/ck8t/audit  — return all entries (newest first) */
  router.get('/ck8t/audit', (_req: Request, res: Response) => {
    res.json({ entries: getAuditEntries(), stats: getAuditStats() });
  });

  /* DELETE /api/v1/ck8t/audit  — clear the log */
  router.delete('/ck8t/audit', (_req: Request, res: Response) => {
    clearAuditEntries();
    res.json({ ok: true });
  });

  return router;
}
