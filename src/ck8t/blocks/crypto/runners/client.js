export default [
  {
    type: 'crypto',
    async run({ values, input }) {
      const operation = String(values.operation || 'sha256')
      const data = String(input != null ? (typeof input === 'string' ? input : JSON.stringify(input)) : (values.data ?? ''))
      const secret = String(values.secret ?? '')
      const encode = s => new TextEncoder().encode(s)
      const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      switch (operation) {
        case 'sha256': return { result: hex(await crypto.subtle.digest('SHA-256', encode(data))) }
        case 'md5': return { result: null, error: 'MD5 is not available in browser crypto' }
        case 'base64_encode': return { result: btoa(data) }
        case 'base64_decode': return { result: atob(data) }
        case 'url_encode': return { result: encodeURIComponent(data) }
        case 'url_decode': return { result: decodeURIComponent(data) }
        case 'uuid': return { result: crypto.randomUUID() }
        case 'hmac_sha256': {
          const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
          return { result: hex(await crypto.subtle.sign('HMAC', key, encode(data))) }
        }
        default: return { result: data }
      }
    },
  },
]
