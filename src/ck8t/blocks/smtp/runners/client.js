export default [{ type: 'smtp', run() { throw new Error('SMTP block: not supported in browser mode. SMTP requires the ck8t-server.') } }]
