export default [
  {
    type: 'webhook_request',
    run({ input }) { return { body: input, headers: {}, query: {} } },
  },
]
