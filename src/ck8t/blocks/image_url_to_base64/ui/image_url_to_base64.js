import { ImageBase64Icon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const ImageUrlToBase64Block = defineCk8tBlock({
  type: 'image_url_to_base64',
  name: 'Image URL → Base64',
  description: 'Downloads an image from a URL and converts it to base64.',
  longDescription:
    'Fetches the image at the given URL and returns both a raw base64 string and a complete data URI. Accepts a plain URL string or any object with a recognisable URL field (Ideogram response, api-block data, etc.). Useful for feeding an API-generated image into nodes that expect base64 input.',
  category: 'blocks',
  bgColor: '#6366F1',
  icon: ImageBase64Icon,
  subBlocks: [
    {
      id: '__preview',
      title: 'Output',
      type: 'json-preview',
      description: 'base64 / dataUri / mimeType after the last run.',
    },
  ],
  tools: { access: [] },
  inputs: {
    input: { type: 'any', description: 'Image URL or object containing a URL field' },
  },
  outputs: {
    base64: { type: 'string', description: 'Raw base64-encoded image bytes' },
    mimeType: { type: 'string', description: 'MIME type (e.g. image/png)' },
    dataUri: { type: 'string', description: 'Complete data URI (data:<mime>;base64,<data>)' },
    url: { type: 'string', description: 'Original image URL' },
  },
})
