import { ExtensionIcon } from '../../../components/icons'
import { defineCk8tBlock } from '../../ck8t-block-base.js'

export const Ns9IngestBlock = defineCk8tBlock({
  type: 'ns9_ingest',
  name: 'NS9 Ingest',
  description: 'Trigger NS9 data ingestion from a workflow',
  longDescription:
    'Trigger NS9 ingestion from a CK8T workflow. Useful for automated pipelines — for example, ' +
    're-ingest after a deploy, or schedule nightly ingestion of code, docs, or logs.',
  category: 'tools',
  bgColor: '#1a3a2a',
  icon: ExtensionIcon,
  subBlocks: [
    {
      id: 'server',
      title: 'MCP Server',
      type: 'mcp-server-selector',
      placeholder: 'Select NS9 MCP server (default: ns9)',
    },
    {
      id: 'source',
      title: 'Source',
      type: 'dropdown',
      options: [
        { label: 'All', id: 'all' },
        { label: 'Code', id: 'code' },
        { label: 'Database', id: 'db' },
        { label: 'Logs', id: 'logs' },
        { label: 'Docs', id: 'docs' },
        { label: 'API', id: 'api' },
        { label: 'Ops', id: 'ops' },
        { label: 'Glossary', id: 'glossary' },
      ],
      value: () => 'all',
      required: true,
    },
    {
      id: 'path',
      title: 'Path Override',
      type: 'short-input',
      placeholder: '/optional/path/override',
    },
  ],
  inputs: {
    input: { type: 'any', description: 'Upstream trigger — pass through to chain ingestion' },
    source: { type: 'string', description: 'What to ingest: code, db, logs, docs, api, ops, glossary, or all' },
    path: { type: 'string', description: 'Optional path override for the ingestion source' },
    server: { type: 'string', description: 'NS9 MCP server ID (default: ns9)' },
  },
  outputs: {
    triggered: { type: 'boolean', description: 'Whether ingestion was triggered successfully' },
  },
})
