import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  listInstalled,
  installFromGitHub,
  uninstall,
  readUiFile,
  getManifest,
  checkForUpdate,
  updateFromGitHub,
} from '../services/block-manager.js';

export default async function (app: FastifyInstance) {
  /** List all installed blocks */
  app.get('/block-manager/blocks', async (_req, reply) => {
    try {
      return reply.send(listInstalled());
    } catch (err: unknown) {
      return reply.status(500).send({ error: toMsg(err) });
    }
  });

  /** Install a block from a GitHub URL */
  app.post(
    '/block-manager/install',
    async (req: FastifyRequest<{ Body: { url: string } }>, reply) => {
      const { url } = req.body ?? {};
      if (!url) return reply.status(400).send({ error: 'url is required' });
      try {
        const block = await installFromGitHub(url);
        return reply.send(block);
      } catch (err: unknown) {
        return reply.status(500).send({ error: toMsg(err) });
      }
    },
  );

  /** Uninstall a block */
  app.delete(
    '/block-manager/blocks/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        uninstall(req.params.id);
        return reply.send({ ok: true });
      } catch (err: unknown) {
        return reply.status(500).send({ error: toMsg(err) });
      }
    },
  );

  /** Check if a GitHub-installed block has a newer version available */
  app.get(
    '/block-manager/blocks/:id/check-update',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const result = await checkForUpdate(req.params.id);
        if (!result) return reply.status(404).send({ error: 'Not a GitHub-installed block' });
        return reply.send(result);
      } catch (err: unknown) {
        return reply.status(500).send({ error: toMsg(err) });
      }
    },
  );

  /** Pull latest files from the block's GitHub source */
  app.post(
    '/block-manager/blocks/:id/update',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const block = await updateFromGitHub(req.params.id);
        return reply.send(block);
      } catch (err: unknown) {
        return reply.status(500).send({ error: toMsg(err) });
      }
    },
  );

  /** Serve a block UI file (block config JS) to the React app */
  app.get(
    '/block-manager/ui/:id/*',
    async (
      req: FastifyRequest<{ Params: { id: string; '*': string } }>,
      reply,
    ) => {
      try {
        const content = readUiFile(req.params.id, req.params['*']);
        return reply
          .header('Content-Type', 'application/javascript')
          .send(content);
      } catch (err: unknown) {
        return reply.status(404).send({ error: toMsg(err) });
      }
    },
  );

  /** Get a single block's manifest */
  app.get(
    '/block-manager/blocks/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const manifest = getManifest(req.params.id);
      if (!manifest) return reply.status(404).send({ error: 'Not found' });
      return reply.send(manifest);
    },
  );
}

function toMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
