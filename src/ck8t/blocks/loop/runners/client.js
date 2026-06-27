// Real iteration happens in src/ck8t/run/loop-engine.js, special-cased by
// graph-runner.js whenever this node's "item" output is wired to a body
// chain that closes back to "feedback". This stub only runs when no body is
// wired — a graceful passthrough, mirroring for_each/for_loop's own fallback.
export default [
  {
    type: 'loop',
    run({ input }) {
      const arr = Array.isArray(input) ? input : (input != null ? [input] : [])
      return { results: arr, iterations: arr.length }
    },
  },
]
