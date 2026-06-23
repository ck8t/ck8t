export default [
  {
    type: 'mcp',
    async run({ values, input, callTool }) {
      const serverId = values.server
      const tool = values.tool
      if (!serverId) throw new Error('MCP block: no server selected')
      if (!tool) throw new Error('MCP block: no tool selected')
      let args = {}
      if (input && typeof input === 'object' && !Array.isArray(input)) args = input
      else if (typeof input === 'string' && input.trim()) {
        try { args = JSON.parse(input) } catch { args = {} }
      }
      const resp = await callTool(serverId, tool, args)
      return resp?.result ?? resp
    },
  },
]
