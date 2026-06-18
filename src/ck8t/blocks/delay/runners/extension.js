export async function run({ values, input }) {
  const ms = Number(values.ms ?? values.duration ?? 0)
  if (ms > 0) await new Promise(r => setTimeout(r, ms))
  return input
}
