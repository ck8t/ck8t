/**
 * ChainOfThoughtBlock — forces step-by-step reasoning before producing output.
 *
 * Unlike a bare agent block, this block instructs the LLM to write a numbered
 * scratchpad of reasoning steps first, then emit a structured conclusion with
 * a confidence score.  Wire `conclusion` into downstream blocks; inspect
 * `reasoning_steps` in the trace view to understand how the answer was reached.
 *
 * Outputs:
 *   reasoning_steps  — string[]  — numbered thinking steps
 *   conclusion       — string    — the LLM's final answer after reasoning
 *   confidence       — number    — 0–1 self-assessed confidence
 *   full_response    — json      — raw LLM JSON for debugging
 */
import { AgentIcon } from '../../components/icons'
import { getModelOptions, getDefaultModel, getProviderCredentialSubBlocks } from '../utils'
import { defineCk8tBlock } from '../ck8t-block-base.js'

export const ChainOfThoughtBlock = defineCk8tBlock({
  type: 'chain_of_thought',
  name: 'Chain of Thought',
  description: 'Reason step-by-step before answering',
  longDescription:
    'Forces the LLM to write a numbered reasoning scratchpad before producing ' +
    'a structured conclusion. Plug this before any decision-making block to get ' +
    'more reliable, explainable answers. The reasoning_steps output is visible ' +
    'in the trace view; wire conclusion into downstream blocks.',
  bestPractices: `
  - Wire conclusion → downstream blocks, not full_response.
  - Use "High" effort for complex multi-hop questions; "Low" for quick classifications.
  - Pair with master_agent: the master's CoT plan feeds context into this block.
  `,
  category: 'blocks',
  bgColor: '#7C3AED',
  icon: AgentIcon,
  tags: ['llm', 'reasoning', 'chain-of-thought', 'agentic'],

  subBlocks: [
    {
      id: 'question',
      title: 'Question',
      type: 'long-input',
      placeholder: 'What do you want the LLM to reason through?',
      rows: 3,
      required: true,
    },
    {
      id: 'context',
      title: 'Context',
      type: 'long-input',
      placeholder: 'Optional upstream data or background information…',
      rows: 3,
    },
    {
      id: 'effort',
      title: 'Reasoning Effort',
      type: 'dropdown',
      options: [
        { label: 'Low — quick (2–3 steps)', id: 'low' },
        { label: 'Medium — balanced (4–5 steps)', id: 'medium' },
        { label: 'High — thorough (6–8 steps)', id: 'high' },
      ],
      defaultValue: 'medium',
    },
    {
      id: 'model',
      title: 'Model',
      type: 'combobox',
      placeholder: 'Type or select a model...',
      required: true,
      get defaultValue() { return getDefaultModel() },
      options: getModelOptions,
    },
    ...getProviderCredentialSubBlocks(),
  ],

  inputs: {
    question: { type: 'string', description: 'Question or task to reason about' },
    context:  { type: 'json',   description: 'Optional background data from upstream blocks' },
  },

  outputs: {
    reasoning_steps: { type: 'array',  description: 'Numbered reasoning steps (string[])' },
    conclusion:      { type: 'string', description: 'Final answer after reasoning — wire this downstream' },
    confidence:      { type: 'number', description: 'Self-assessed confidence 0–1' },
    full_response:   { type: 'json',   description: 'Raw LLM JSON for debugging' },
  },
})
