/** Loop — real cyclic execution, dispatches to for/forEach/while modes. */
import { LoopIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const LoopBlock = defineCk8tBlock({
  type: 'loop',
  name: 'Loop',
  description: 'Run a connected block N times, once per item, or while a condition holds',
  longDescription:
    'Real cyclic execution: wire the "item" output to the block you want to repeat, then wire that block\'s output back to this node\'s "feedback" input to close the loop. Loop Type picks how iteration is driven — For (N times), ForEach (over an array, wired to "collection" or typed below), or While (re-evaluates the condition against the previous iteration\'s output after each pass). Collects results into "results" / "iterations".',
  category: 'blocks',
  bgColor: '#1F9D7A',
  icon: LoopIcon,
  hasProgress: true,
  subBlocks: [
    {
      id: 'loopType',
      title: 'Loop Type',
      type: 'dropdown',
      options: [
        { label: 'For (N iterations)', id: 'for' },
        { label: 'ForEach (over array)', id: 'forEach' },
        { label: 'While', id: 'while' },
      ],
      value: () => 'for',
    },
    {
      id: 'iterations',
      title: 'Iterations',
      type: 'short-input',
      placeholder: '10',
      condition: { field: 'loopType', value: 'for' },
    },
    {
      id: 'collection',
      title: 'Collection (JSON, fallback if nothing wired)',
      type: 'long-input',
      placeholder: '[1,2,3]',
      condition: { field: 'loopType', value: 'forEach' },
    },
    {
      id: 'whileCondition',
      title: 'While Condition (JS, sees `prev` and `index`)',
      type: 'long-input',
      placeholder: 'index < 5 && prev?.keepGoing !== false',
      condition: { field: 'loopType', value: 'while' },
      required: true,
    },
    {
      id: 'maxIterations',
      title: 'Max Iterations',
      type: 'short-input',
      placeholder: '1000',
      mode: 'advanced',
    },
    { id: 'maxConcurrency', title: 'Max concurrency', type: 'slider', min: 1, max: 10, step: 1, integer: true, defaultValue: 1, mode: 'advanced' },
    { id: 'continueOnError', title: 'Continue on item error', type: 'switch', value: () => false, mode: 'advanced', description: 'If an iteration fails, record the error for that item and keep going instead of aborting the whole run.' },
  ],
  tools: { access: [] },
  inputs: {
    collection: { type: 'json', description: 'Array to iterate over (ForEach mode) — wired value overrides the Collection field' },
    feedback: { type: 'any', description: 'Wire the loop body block\'s output back here to close the loop' },
  },
  outputs: {
    item: { type: 'any', description: 'Current item/{i,index}/{index,prev} depending on Loop Type — wire to the loop body block\'s input' },
    iterations: { type: 'number', description: 'Total iterations executed' },
    results: { type: 'array', description: 'Output of each iteration, in order' },
  },
})
