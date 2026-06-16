import { Router, Request, Response } from 'express';
import { executeGraph } from '../../engine/graph-runner';
import { callAgent } from '../../services/llm';
import { callTool } from '../../services/mcp';
import { customBlockRunners } from '../../services/block-loader';
import type { Workflow } from '../../types';

export function runRouter() {
  const router = Router();

  /* POST /api/v1/ck8t/run-block  — run a single community block server-side */
  router.post('/ck8t/run-block', async (req: Request, res: Response) => {
    const { type, values, input, inputsByHandle } = req.body as {
      type: string;
      values: Record<string, unknown>;
      input: unknown;
      inputsByHandle?: Record<string, unknown>;
    };
    if (!type) return res.status(400).json({ error: 'type is required' });
    const runner = customBlockRunners.get(type);
    if (!runner) return res.status(404).json({ error: `No server runner for block type: ${type}` });

    // Flush headers early so we can stream heartbeats. Chromium's network stack
    // closes idle TCP connections after ~300s of no data (causing "Failed to fetch"
    // on long-running MCP calls like 10-min MLX inference). Sending a space byte
    // every 30s keeps the connection alive; spaces are valid JSON leading whitespace
    // so the client's res.json() / JSON.parse still works on the final payload.
    res.setHeader('Content-Type', 'application/json');
    res.flushHeaders();
    const heartbeat = setInterval(() => { try { res.write(' '); } catch (_) {} }, 30_000);

    try {
      const output = await runner({
        values: values ?? {},
        input: input ?? null,
        inputsByHandle: inputsByHandle ?? {},
        outputs: {},
        node: { id: type },
        allNodes: [],
        subBlockValues: {},
        callAgent,
        callTool,
      });
      clearInterval(heartbeat);
      res.end(JSON.stringify({ output }));
    } catch (err: unknown) {
      clearInterval(heartbeat);
      const message = err instanceof Error ? err.message : String(err);
      res.end(JSON.stringify({ error: message }));
    }
  });

  /* POST /api/v1/ck8t/run  — server-side graph execution */
  router.post('/ck8t/run', async (req: Request, res: Response) => {
    try {
      const { workflow, inputs } = req.body as { workflow: Workflow; inputs: Record<string, unknown> };

      if (!workflow?.nodes || !workflow?.edges) {
        return res.status(400).json({ error: 'workflow must include nodes and edges' });
      }

      const result = await executeGraph({
        workflow,
        inputs: inputs || {},
        callAgent,
        callTool,
      });

      res.json({ output: result.output, trace: result.trace });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
