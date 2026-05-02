import type { FastifyInstance, FastifyRequest } from 'fastify'
import { changeProvider, getAvailableProviders } from '../services/provider.js'
import {
  listCustomProviders,
  saveCustomProvider,
  deleteCustomProvider,
  refreshCustomProviderModels,
  type CustomProvider,
} from '../services/customProvider.js'

type ChangeProviderBody = {
  provider?: string
  model?: string
  temperature?: number
}

export default async function (app: FastifyInstance) {
  // ── Built-in providers ────────────────────────────────────────────────
  app.get('/ck8t/llm/providers', async (_req, reply) => {
    try {
      return reply.send(await getAvailableProviders())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ error: message })
    }
  })

  app.post(
    '/ck8t/llm/provider',
    async (req: FastifyRequest<{ Body: ChangeProviderBody }>, reply) => {
      try {
        return reply.send(await changeProvider(req.body || {}))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    },
  )

  // ── Custom provider CRUD ──────────────────────────────────────────────
  app.get('/ck8t/llm/custom-providers', async (_req, reply) => {
    return reply.send(listCustomProviders())
  })

  app.post(
    '/ck8t/llm/custom-providers',
    async (req: FastifyRequest<{ Body: Partial<CustomProvider> & { name: string } }>, reply) => {
      try {
        return reply.send(saveCustomProvider(req.body))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(400).send({ error: message })
      }
    },
  )

  app.delete(
    '/ck8t/llm/custom-providers/:key',
    async (req: FastifyRequest<{ Params: { key: string } }>, reply) => {
      const deleted = deleteCustomProvider(req.params.key)
      return reply.send({ ok: deleted })
    },
  )

  // POST :key/models — server-side fetch (bypasses browser CORS)
  app.post(
    '/ck8t/llm/custom-providers/:key/models',
    async (req: FastifyRequest<{ Params: { key: string }; Body: Partial<CustomProvider> }>, reply) => {
      try {
        // If body contains provider data, upsert it first so the store has latest config
        const body = req.body || {}
        if (body.name || body.modelsUrl || body.chatUrl) {
          saveCustomProvider({ ...body, key: req.params.key, name: body.name || req.params.key })
        }
        const models = await refreshCustomProviderModels(req.params.key)
        return reply.send(models)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: message })
      }
    },
  )
}