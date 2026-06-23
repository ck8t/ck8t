export default [
  {
    type: 'ns9_ingest',
    async run({ values, callTool }) {
      const server = String(values.server || 'ns9')
      const args = { source: String(values.source || 'all') }
      if (values.path) args.path = String(values.path)
      try {
        return await callTool(server, 'ns9_ingest', args)
      } catch (err) { return { error: `ns9_ingest failed: ${err?.message ?? err}`, triggered: false } }
    },
  },
]
