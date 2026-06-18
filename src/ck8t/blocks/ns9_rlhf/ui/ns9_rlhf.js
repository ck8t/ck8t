import { AgentIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const Ns9RlhfBlock = defineCk8tBlock({
  type: 'ns9_rlhf',
  name: 'NS9 RLHF',
  description: 'Record a correction to the NS9 knowledge graph',
  longDescription:
    'Record a human correction when the LLM gave a wrong answer. NS9 updates its knowledge graph so future ' +
    'queries return better answers. Use this in feedback loops where users can correct AI responses.',
  category: 'tools',
  bgColor: '#3b1f5e',
  icon: AgentIcon,
  subBlocks: [
    {
      id: 'server',
      title: 'MCP Server',
      type: 'mcp-server-selector',
      placeholder: 'Select NS9 MCP server (default: ns9)',
    },
    {
      id: 'question',
      title: 'Question',
      type: 'long-input',
      placeholder: 'The question that got the wrong answer',
      required: true,
    },
    {
      id: 'wrong_answer',
      title: 'Wrong Answer',
      type: 'long-input',
      placeholder: 'What the LLM said (incorrect)',
    },
    {
      id: 'correct_answer',
      title: 'Correct Answer',
      type: 'long-input',
      placeholder: 'The right answer',
      required: true,
    },
    {
      id: 'corrector',
      title: 'Corrector',
      type: 'short-input',
      placeholder: 'user',
      value: () => 'user',
    },
    {
      id: 'propagate_now',
      title: 'Propagate Immediately',
      type: 'switch',
      value: () => true,
    },
  ],
  inputs: {
    input: { type: 'any', description: 'Upstream data — fields available as {{field}} in templates' },
    question: { type: 'string', description: 'The question that was answered incorrectly' },
    wrong_answer: { type: 'string', description: 'The incorrect answer the LLM gave' },
    correct_answer: { type: 'string', description: 'The correct answer' },
    corrector: { type: 'string', description: 'Who is providing the correction' },
    propagate_now: { type: 'boolean', description: 'Whether to propagate immediately' },
  },
  outputs: {
    saved: { type: 'boolean', description: 'Whether the correction was saved' },
  },
})
