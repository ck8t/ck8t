import { extractMediaUri } from '../../block-utils.js'

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0))
}

export default [
  {
    type: 'save_to_files',
    run({ values, input, vsApi }) {
      const fmt = values.format || 'json'
      const defaultFilename = (values.filename || '').trim() || 'output'
      const filenameHint = (values.path || '').trim().replace(/^.*[\\/]/, '') || defaultFilename
      const result = { savedAt: null, bytes: 0, payload: input }
      let blob = null, downloadName = filenameHint, b64ForVscode = null

      if (fmt === 'pdf' || fmt === 'binary') {
        const media = extractMediaUri(input)
        if (media) {
          const ext = media.mimeType === 'application/pdf' ? '.pdf' : media.mimeType.replace('image/', '.')
          const b64 = media.dataUri.split(',')[1]
          const bytes = b64ToBytes(b64)
          blob = new Blob([bytes], { type: media.mimeType })
          result.bytes = bytes.length
          if (!downloadName.includes('.')) downloadName += ext
          b64ForVscode = b64
        } else if (typeof input === 'string' && /^[A-Za-z0-9+/]+=*$/.test(input.trim())) {
          const mime = fmt === 'pdf' ? 'application/pdf' : 'application/octet-stream'
          const ext  = fmt === 'pdf' ? '.pdf' : '.bin'
          const bytes = b64ToBytes(input.trim())
          blob = new Blob([bytes], { type: mime })
          result.bytes = bytes.length
          if (!downloadName.includes('.')) downloadName += ext
          b64ForVscode = input.trim()
        }
      }

      if (!blob) {
        const body = fmt === 'raw' || typeof input === 'string'
          ? (typeof input === 'string' ? input : JSON.stringify(input))
          : JSON.stringify(input, null, 2)
        blob = new Blob([body], { type: fmt === 'raw' ? 'text/plain' : 'application/json' })
        result.bytes = body.length
        if (!downloadName.includes('.')) downloadName += fmt === 'raw' ? '.txt' : '.json'
      }

      const path = (values.path || '').trim()
      if (path || values.filename) {
        try {
          if (vsApi) {
            if (b64ForVscode) vsApi.postMessage({ type: 'saveFile', payload: { filename: downloadName, content: b64ForVscode, format: fmt } })
            else blob.text().then(text => vsApi.postMessage({ type: 'saveFile', payload: { filename: downloadName, content: text } }))
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = downloadName
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(url)
          }
          result.savedAt = path || downloadName
        } catch (e) { result.error = e.message || String(e) }
      }
      return input
    },
  },
]
