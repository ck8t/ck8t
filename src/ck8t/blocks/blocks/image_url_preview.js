import { ImagePreviewIcon } from '../../components/icons'
import { defineCk8tBlock } from '../ck8t-block-base.js'

export const ImageUrlPreviewBlock = defineCk8tBlock({
  type: 'image_url_preview',
  name: 'Image URL Preview',
  description: 'Renders an image from a URL directly on the canvas card.',
  longDescription:
    'Accepts an image URL (or an Ideogram/API response object containing one) and displays it as a live image preview. Pass-through: the URL is also available as an output for downstream nodes.',
  category: 'blocks',
  bgColor: '#8B5CF6',
  icon: ImagePreviewIcon,
  subBlocks: [
    {
      id: '__preview',
      title: 'Preview',
      type: 'json-preview',
      description: 'Image rendered from the last received URL.',
    },
  ],
  tools: { access: [] },
  inputs: {
    input: { type: 'any', description: 'Image URL string, or an object containing a URL field (e.g. Ideogram response)' },
  },
  outputs: {
    url: { type: 'string', description: 'Extracted image URL (pass-through)' },
  },
})
