// Extension-side runner for the NS9 Ingest block.
// Calls the ns9_ingest MCP tool on the NS9 server.
export async function run({ values, callTool }) {
  const server = String(values.server || 'ns9')
  const source = String(values.source || 'all')
  const path = values.path ? String(values.path) : undefined

  const args = { source }
  if (path) args.path = path

  try {
    const result = await callTool(server, 'ns9_ingest', args)
    return result
  } catch (err) {
    const msg = err?.message || String(err)
    return { error: `ns9_ingest MCP call failed: ${msg}`, triggered: false }
  }
}
