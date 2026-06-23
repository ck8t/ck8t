// Seed block — graph-runner injects its output before execution begins; this runner is never called during normal flow.
export default [{ type: 'user_input', run({ input }) { return input } }]
