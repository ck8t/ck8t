import { extractImageUrl, arrayBufferToBase64 } from '../../block-utils.js'

export default [
  {
    type: 'image_url_to_base64',
    async run({ input }) {
      const url = extractImageUrl(input)
      if (!url) return { base64: null, mimeType: null, dataUri: null, error: 'No image URL found in input' }
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const contentType = resp.headers.get('content-type') || 'image/png'
        const mimeType = contentType.split(';')[0].trim()
        const base64 = arrayBufferToBase64(await resp.arrayBuffer())
        return { base64, mimeType, dataUri: `data:${mimeType};base64,${base64}`, url }
      } catch (err) {
        return { base64: null, mimeType: null, dataUri: null, error: err.message }
      }
    },
  },
]
