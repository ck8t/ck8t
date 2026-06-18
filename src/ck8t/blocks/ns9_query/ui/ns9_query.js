import { SearchIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const Ns9QueryBlock = defineCk8tBlock({
  type: 'ns9_query',
  name: 'NS9 Query',
  description: 'Query the NS9 knowledge graph',
  longDescription:
    'Ask a natural-language question to NS9. Returns context_text, live_data, sources, and confidence. ' +
    'Wire the context_text into an Agent block to get an LLM answer grounded in your knowledge graph.',
  category: 'tools',
  bgColor: '#1e3a5f',
  icon: SearchIcon,
  hasProgress: true,
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
      placeholder: 'What is {{topic}}?',
      required: true,
    },
    {
      id: 'top_k',
      title: 'Top K Results',
      type: 'short-input',
      placeholder: '10',
      value: () => '10',
    },
    {
      id: 'include_live',
      title: 'Include Live Data',
      type: 'switch',
      value: () => true,
    },
    {
      id: 'include_qa',
      title: 'Include Past Q&A',
      type: 'switch',
      value: () => true,
    },
  ],
  inputs: {
    input: { type: 'any', description: 'Upstream data — available as {{input}} in the question template' },
    question: { type: 'string', description: 'Natural-language question (supports {{template}} variables)' },
    server: { type: 'string', description: 'NS9 MCP server ID (default: ns9)' },
    top_k: { type: 'number', description: 'Number of search results per retriever' },
    include_live: { type: 'boolean', description: 'Query live log tables' },
    include_qa: { type: 'boolean', description: 'Search Q&A memory' },
  },
  outputs: {
    value: { type: 'string', description: 'context_text — grounding context for an Agent block' },
    context_text: { type: 'string', description: 'Full context text from NS9' },
    confidence: { type: 'number', description: 'Confidence score (0–1)' },
    sources: { type: 'array', description: 'Source documents used' },
  },
})
