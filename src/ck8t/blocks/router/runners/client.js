export default [
  {
    type: 'router_v2',
    async run({ values, input, callLlm, resolveModel, nodeId, nodeTitle }) {
      const context = String(values.context || (typeof input === 'string' ? input : JSON.stringify(input)))
      const { model } = resolveModel(values.model, values.provider)
      if (!model) throw new Error(`No model configured for "${nodeTitle}"`)
      let routes = Array.isArray(values.routes) ? values.routes : []
      if (typeof values.routes === 'string') { try { routes = JSON.parse(values.routes) } catch { routes = [] } }
      if (routes.length === 0) return { branch: 'default', value: input }
      const routeList = routes.map((r, i) => (i + 1) + '. id=' + r.id + ': ' + r.description).join('\n')
      const systemPrompt =
        'You are a router. Given the context below, choose the best matching route.\n' +
        'Available routes:\n' + routeList + '\n\nRespond with ONLY the route id (nothing else).'
      const agent = { id: nodeId, model, temperature: 0, systemPrompt, userPrompt: context }
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
      try {
        const { response: res } = await callLlm(agent, inputStr, nodeTitle)
        const raw = String(res?.output ?? res).trim()
        const matched = routes.find(r => r.id === raw)
        return { branch: matched ? matched.id : routes[0].id, value: input }
      } catch {
        return { branch: routes[0]?.id ?? 'default', value: input }
      }
    },
  },
]
