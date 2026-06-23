import { extractImageUrl } from '../../block-utils.js'

export default [
  {
    type: 'image_url_preview',
    run({ input }) {
      const url = extractImageUrl(input)
      if (!url) return { url: null, error: 'No image URL found in input' }
      return { url, __ck8t_image_url: url }
    },
  },
]
