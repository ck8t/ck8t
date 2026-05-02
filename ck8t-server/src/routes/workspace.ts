import type { FastifyInstance, FastifyRequest } from 'fastify'
import { syncWorkspace, loadWorkspace } from '../services/workspace.js'
import type { WorkspaceSnapshot } from '../types/index.js'

export default async function (app: FastifyInstance) {
  app.post(
    '/ck8t/workspace/:id/sync',
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: WorkspaceSnapshot }>,
      reply,
    ) => {
      try {
        await syncWorkspace(req.params.id, req.body)
        return reply.send({ ok: true })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    },
  )

  app.get(
    '/ck8t/workspace/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      try {
        const snapshot = await loadWorkspace(req.params.id)
        // Return 200+null for "not found" — avoids browser console 404 noise
        return reply.send(snapshot ?? null)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    },
  )
}
