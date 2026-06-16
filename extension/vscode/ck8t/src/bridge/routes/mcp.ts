import { Router, Request, Response } from 'express';
import { listServers, upsertServer, deleteServer, listTools, callTool } from '../../services/mcp';

export function mcpRouter() {
  const router = Router();

  /* GET /api/v1/mcp/servers */
  router.get('/mcp/servers', (_req: Request, res: Response) => {
    try {
      res.json(listServers());
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* POST /api/v1/mcp/servers */
  router.post('/mcp/servers', (req: Request, res: Response) => {
    try {
      const server = upsertServer(req.body);
      res.json(server);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* DELETE /api/v1/mcp/servers/:id */
  router.delete('/mcp/servers/:id', (req: Request, res: Response) => {
    try {
      res.json(deleteServer(req.params.id));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* GET /api/v1/mcp/servers/:id/tools */
  router.get('/mcp/servers/:id/tools', async (req: Request, res: Response) => {
    try {
      const refresh = req.query.refresh === 'true';
      const tools   = await listTools(req.params.id, refresh);
      res.json(tools);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /* POST /api/v1/mcp/servers/:id/tools/:tool/call */
  router.post('/mcp/servers/:id/tools/:tool/call', async (req: Request, res: Response) => {
    // MCP tool calls (e.g. MLX image generation) can run for 10+ minutes.
    // Chromium closes idle TCP connections after ~300s of no data ("Failed to fetch").
    // Flush headers early and send a space heartbeat every 30s to keep the socket
    // alive. Spaces are valid JSON leading whitespace so the client JSON.parse works.
    res.setHeader('Content-Type', 'application/json');
    res.flushHeaders();
    const heartbeat = setInterval(() => { try { res.write(' '); } catch (_) {} }, 30_000);

    try {
      const result = await callTool(req.params.id, req.params.tool, req.body.arguments ?? req.body);
      clearInterval(heartbeat);
      res.end(JSON.stringify({ result }));
    } catch (err: unknown) {
      clearInterval(heartbeat);
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  return router;
}
