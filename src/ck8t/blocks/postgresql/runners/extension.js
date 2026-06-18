// Extension-side runner for the PostgreSQL block.
// Requires the ck8t-server process (or extension bridge) — uses pg npm package.
// NOTE: Direct execution is not available; this block routes through the bridge server.
export async function run({ values, input }) {
  throw new Error(
    'PostgreSQL block requires the ck8t-server process. ' +
    'Start the server from the CK8T panel to run PostgreSQL blocks.'
  )
}
