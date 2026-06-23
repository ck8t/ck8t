export default [
  {
    type: 'http_response',
    run({ values, input, inputsByHandle }) {
      const statusCode = Number((inputsByHandle?.statusCode ?? values.statusCode) ?? 200)
      const rawHeaders = inputsByHandle?.headers ?? values.headers
      const body = (inputsByHandle?.body !== undefined)
        ? inputsByHandle.body
        : ((values.body !== undefined && values.body !== '') ? values.body : input)
      return { sent: true, statusCode, body, headers: rawHeaders ?? {} }
    },
  },
]
