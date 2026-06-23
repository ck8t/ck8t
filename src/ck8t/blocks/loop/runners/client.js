export default [{ type: 'loop', run() { throw new Error('Loop block: not supported in browser mode. Use for_loop or for_each blocks instead.') } }]
