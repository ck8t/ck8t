import { Router, Request, Response } from 'express';
import { callAgent } from '../../services/llm';
import { addAuditEntry } from '../audit';

export function agentRouter() {
  const router = Router();

  /* POST /api/v1/ck8t/agent */
  router.post('/ck8t/agent', async (req: Request, res: Response) => {
    const t0 = Date.now();
    const agent = req.body?.agent ?? {};
    try {
      const result = await callAgent(req.body);
      addAuditEntry({
        stage: 'ck8t.agent',
        model: result.model || agent.model,
        systemPrompt: agent.systemPrompt,
        userPrompt: agent.userPrompt,
        request: { model: agent.model, systemPrompt: agent.systemPrompt, userPrompt: agent.userPrompt, input: req.body?.input },
        response: { output: result.output },
        durationMs: Date.now() - t0,
      });
      res.json({ output: result.output, model: result.model, ms: result.ms });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addAuditEntry({
        stage: 'ck8t.agent',
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        userPrompt: agent.userPrompt,
        request: { model: agent.model, systemPrompt: agent.systemPrompt, userPrompt: agent.userPrompt, input: req.body?.input },
        durationMs: Date.now() - t0,
        error: message,
      });
      res.status(500).json({ error: message });
    }
  });

  return router;
}
