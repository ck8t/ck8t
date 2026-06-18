export async function run({ input }) {
  const url = typeof input === 'string' ? input : String(input?.url || input || '')
  if (!url) return { base64: null, mimeType: null, error: 'No URL provided' }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || 'image/jpeg'
  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  return { base64, mimeType: ct, dataUrl: `data:${ct};base64,${base64}` }
}
