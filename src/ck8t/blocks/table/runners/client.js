export default [{ type: 'table', run() { throw new Error('Table block: not supported in browser mode. Use the api or postgresql blocks to query data.') } }]
