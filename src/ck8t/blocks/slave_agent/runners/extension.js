export default [
  {
    type: 'slave_agent',
    async run({ values, input, callAgent, nodeId, nodeTitle }) {
      const question = String(values.question || (typeof input === 'string' ? input : JSON.stringify(input ?? '')))
      const rawModel = values.model ? String(values.model) : null
      if (!rawModel) throw new Error(`No model configured for Slave Agent "${nodeTitle}".`)
      const systemPrompt = String(values.systemPrompt || '')
      const userPrompt = String(values.userPrompt || '{{input}}').replace('{{input}}', question)
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input ?? '')
      const res = await callAgent({ agent: { id: nodeId || 'slave', model: rawModel, temperature: values.temperature ?? 0.7, systemPrompt, userPrompt }, input: inputStr })
      return { output: res.output, agent: nodeId, model: rawModel }
    },
  },
]
