// Extension-side runner for the MCP block.
// Calls an MCP tool via the callTool bridge (provided by the extension host).
export async function run({ values, input, callTool }) {
  const serverId = String(values.server || '')
  const tool = String(values.tool || '')

  let args = {}
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    args = input
  } else if (typeof input === 'string' && input.trim()) {
    try { args = JSON.parse(input) } catch { args = {} }
  }

  const resp = await callTool(serverId, tool, args)
  return resp?.result ?? resp
}
