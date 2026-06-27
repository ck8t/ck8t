/** ForEach loop — iterate each item of an array/object. */
import { LoopIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const ForEachBlock = defineCk8tBlock({
  type: 'for_each',
  name: 'ForEach Loop',
  description: 'Run a connected block once per item of an array',
  longDescription:
    'Real cyclic execution: wire the "item" output to the block you want to repeat, then wire that block\'s output back to this node\'s "feedback" input to close the loop. The engine runs the body chain once per array item (collection wired to "input", or the Collection field below as a JSON fallback) and collects results into "iterations" / "last". Any other input the body block needs (e.g. a server URL) can stay wired from outside the loop as normal — only the item/feedback edges form the cycle.',
  category: 'blocks',
  bgColor: '#6366F1',
  icon: LoopIcon,
  hasProgress: true,
  subBlocks: [
    { id: 'collection', title: 'Collection (JSON, fallback if nothing wired)', type: 'short-input', placeholder: '[1,2,3]' },
    { id: 'itemVar', title: 'Item var', type: 'short-input', placeholder: 'item', defaultValue: 'item' },
    { id: 'maxConcurrency', title: 'Max concurrency', type: 'slider', min: 1, max: 10, step: 1, integer: true, defaultValue: 1, mode: 'advanced' },
    { id: 'continueOnError', title: 'Continue on item error', type: 'switch', value: () => false, mode: 'advanced', description: 'If an iteration fails, record the error for that item and keep going instead of aborting the whole run.' },
  ],
  tools: { access: ['loop_for_each'] },
  inputs: {
    input: { type: 'json', description: 'Array to iterate over' },
    feedback: { type: 'any', description: 'Wire the loop body block\'s output back here to close the loop' },
  },
  outputs: {
    item: { type: 'any', description: 'Current item — wire this to the loop body block\'s input' },
    iterations: { type: 'array', description: 'Per-item outputs, in order (final, after the loop completes)' },
    last: { type: 'json', description: 'Output from the final item' },
  },
})
