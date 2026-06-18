import { createHash, createHmac, randomUUID } from 'crypto'

export function run({ values, input }) {
  const op = String(values.operation || values.mode || 'sha256')
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)
  switch (op) {
    case 'sha256': return createHash('sha256').update(inputStr).digest('hex')
    case 'sha512': return createHash('sha512').update(inputStr).digest('hex')
    case 'md5': return createHash('md5').update(inputStr).digest('hex')
    case 'hmac_sha256': return createHmac('sha256', String(values.key || '')).update(inputStr).digest('hex')
    case 'uuid': return randomUUID()
    case 'base64_encode': return Buffer.from(inputStr, 'utf8').toString('base64')
    case 'base64_decode': return Buffer.from(inputStr, 'base64').toString('utf8')
    default: return createHash('sha256').update(inputStr).digest('hex')
  }
}
