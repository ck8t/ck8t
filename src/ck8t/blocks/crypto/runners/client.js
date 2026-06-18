// Browser-safe crypto using the Web Crypto API.
export async function run({ values, input }) {
  const op = String(values.operation || values.mode || 'sha256')
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input)

  if (op === 'uuid') return crypto.randomUUID()
  if (op === 'base64_encode') return btoa(unescape(encodeURIComponent(inputStr)))
  if (op === 'base64_decode') return decodeURIComponent(escape(atob(inputStr)))

  const algoMap = { sha256: 'SHA-256', sha512: 'SHA-512', md5: null }
  const algo = algoMap[op]
  if (algo) {
    const enc = new TextEncoder()
    const digest = await crypto.subtle.digest(algo, enc.encode(inputStr))
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  if (op === 'hmac_sha256') {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(String(values.key || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(inputStr))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  throw new Error(`Unknown crypto operation: ${op}`)
}
