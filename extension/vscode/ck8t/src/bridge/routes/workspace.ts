import { Router, Request, Response } from 'express';
import { syncWorkspace, loadWorkspace } from '../../services/workspace';

export function workspaceRouter() {
  const router = Router();

  /* POST /api/v1/ck8t/workspace/:id/sync */
  router.post('/ck8t/workspace/:id/sync', (req: Request, res: Response) => {
    try {
      const result = syncWorkspace(req.params.id, req.body);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* GET /api/v1/ck8t/workspace/:id */
  router.get('/ck8t/workspace/:id', (req: Request, res: Response) => {
    try {
      const snapshot = loadWorkspace(req.params.id);
      // Return empty-but-valid snapshot on first run — UI persists on next sync
      res.json(snapshot ?? {
        activeWorkspaceId: req.params.id,
        workspaces: [],
        agents: [],
        skills: [],
        workflows: [],
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
