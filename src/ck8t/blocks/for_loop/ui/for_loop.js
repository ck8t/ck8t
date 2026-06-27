/** For loop — run the enclosed sub-flow N times with counter `i`. */
import { LoopIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const ForLoopBlock = defineCk8tBlock({
  type: 'for_loop',
  name: 'For Loop',
  description: 'Run a connected block count times (0..n-1)',
  longDescription:
    'Real cyclic execution: wire the "item" output (emits {i, index} each pass) to the block you want to repeat, then wire that block\'s output back to this node\'s "feedback" input to close the loop. Runs the body chain `count` times and collects results into "iterations" / "last".',
  category: 'blocks',
  bgColor: '#8B5CF6',
  icon: LoopIcon,
  hasProgress: true,
  subBlocks: [
    { id: 'count', title: 'Count', type: 'short-input', placeholder: '10', defaultValue: 10 },
    { id: 'indexVar', title: 'Index var', type: 'short-input', placeholder: 'i', defaultValue: 'i' },
    { id: 'maxConcurrency', title: 'Max concurrency', type: 'slider', min: 1, max: 10, step: 1, integer: true, defaultValue: 1, mode: 'advanced' },
    { id: 'continueOnError', title: 'Continue on item error', type: 'switch', value: () => false, mode: 'advanced', description: 'If an iteration fails, record the error for that item and keep going instead of aborting the whole run.' },
  ],
  tools: { access: ['loop_for'] },
  inputs: {
    input: { type: 'json', description: 'Optional — wire a number here to override Count' },
    feedback: { type: 'any', description: 'Wire the loop body block\'s output back here to close the loop' },
  },
  outputs: {
    item: { type: 'any', description: 'Current {i, index} — wire this to the loop body block\'s input' },
    iterations: { type: 'array', description: 'Results from each iteration, in order' },
    last: { type: 'json', description: 'Output from the final iteration' },
  },
})
