export function run({ values, input }) {
  const statusCode = Number(values.statusCode ?? 200)
  const body = (values.body !== undefined && values.body !== '') ? values.body : input
  return { sent: true, statusCode, body }
}
