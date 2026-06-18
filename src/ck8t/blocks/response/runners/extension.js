export function run({ inputsByHandle, input }) {
  const data = (inputsByHandle && inputsByHandle['data']) ?? (inputsByHandle && inputsByHandle['input']) ?? input
  const status = (inputsByHandle && inputsByHandle['status']) ?? 200
  const headers = (inputsByHandle && inputsByHandle['headers']) ?? {}
  return { data, status, headers }
}
