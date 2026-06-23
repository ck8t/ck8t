export default [{ type: 'slack', run() { throw new Error('Slack block: not supported in browser mode. Slack integration requires the ck8t-server.') } }]
