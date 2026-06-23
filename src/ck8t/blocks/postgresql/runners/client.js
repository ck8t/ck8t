export default [{ type: 'postgresql', run() { throw new Error('PostgreSQL block: not supported in browser mode. Configure the ck8t-server bridge.') } }]
