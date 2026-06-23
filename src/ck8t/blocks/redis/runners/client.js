export default [{ type: 'redis', run() { throw new Error('Redis block: not supported in browser mode. Direct Redis requires the ck8t-server.') } }]
