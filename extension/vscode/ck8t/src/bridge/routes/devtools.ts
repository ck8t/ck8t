import { Router, Request, Response } from 'express';
import { getAuditEntries, getAuditStats } from '../audit';
import { getDbTables, getDbTableRows, getDbPath, getDbCollections, getCollectionRows } from '../../storage/db';

export function devtoolsRouter() {
  const router = Router();

  /* GET /api/v1/ck8t/devtools/memory — process memory + system stats */
  router.get('/ck8t/devtools/memory', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    res.json({
      pid: process.pid,
      nodeVersion: process.version,
      uptimeSeconds: process.uptime(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    });
  });

  /* GET /api/v1/ck8t/devtools/snapshot — full debug snapshot */
  router.get('/ck8t/devtools/snapshot', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    const entries = getAuditEntries();
    const stats = getAuditStats();
    res.json({
      generatedAt: new Date().toISOString(),
      extension: {
        nodeVersion: process.version,
        pid: process.pid,
        uptimeSeconds: process.uptime(),
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external,
      },
      audit: {
        ...stats,
        recentErrors: entries.filter((e) => e.error).slice(0, 10),
      },
    });
  });

  /* GET /api/v1/ck8t/devtools/db — db path + table list (real tables + bs_store collections) */
  router.get('/ck8t/devtools/db', (_req: Request, res: Response) => {
    try {
      const realTables = getDbTables();
      const collections = getDbCollections();
      // Present real tables + collections together (collections come first for visibility)
      const tables = [...collections, ...realTables];
      res.json({ path: getDbPath(), tables });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* GET /api/v1/ck8t/devtools/db/:table/rows?limit=100&offset=0 */
  router.get('/ck8t/devtools/db/:table/rows', (req: Request, res: Response) => {
    try {
      const limit  = Math.min(500, Math.max(1, parseInt(String(req.query.limit  ?? 100))));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? 0)));
      const tableName = req.params.table;
      // Check if it's a virtual collection (not a real SQL table)
      const collections = getDbCollections();
      const isCollection = collections.some(c => c.name === tableName);
      if (isCollection) {
        res.json(getCollectionRows(tableName, limit, offset));
      } else {
        res.json(getDbTableRows(tableName, limit, offset));
      }
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
