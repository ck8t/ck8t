export default [{ type: 'mongodb', run() { throw new Error('MongoDB block: not supported in browser mode. Direct MongoDB requires the ck8t-server.') } }]
