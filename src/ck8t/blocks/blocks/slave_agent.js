/**
 * SlaveAgentBlock — specialist agent that can only be dispatched by a master_agent.
 *
 * Each slave has a capability_label (e.g. "log_analysis") that the master uses
 * to route sub-tasks. The slave has its own system prompt, tool access list,
 * and enforced output schema — completely self-contained.
 *
 * Registration: drag this block onto a master_agent block on the canvas.
 * The canvas auto-registers the slave via workspace-store.registerSlaveToMaster
 * and draws a dashed "registered_to" overlay edge.
 *
 * Inputs (injected by master dispatcher — NOT wired manually on canvas):
 *   task      — string   — the specific sub-question assigned by the master
 *   context   — json     — shared evidence from prior slave results
 *
 * Outputs:
 *   answer               — string  — plain text answer to the sub-task
 *   cited_nodes          — array   — evidence references (NS9 node IDs or doc refs)
 *   confidence           — number  — 0–1 self-assessed confidence
 *   needs_clarification  — boolean — if true, master may trigger adaptive re-plan
 */
import { AgentIcon } from '../../components/icons'
import { getModelOptions, getDefaultModel, getProviderCredentialSubBlocks } from '../utils'
import { defineCk8tBlock } from '../ck8t-block-base.js'

export const SlaveAgentBlock = defineCk8tBlock({
  type: 'slave_agent',
  name: 'Slave Agent',
  description: 'Specialist agent dispatched by a master_agent',
  longDescription:
    'A specialist agent block that is dispatched by a master_agent block. ' +
    'Has a capability_label that the master uses to assign matching sub-tasks. ' +
    'Returns a structured answer with evidence citations and a confidence score. ' +
    'Register by dragging this block onto a master_agent block on the canvas.',
  bestPractices: `
  - Set a clear capability_label — the master routes tasks to matching slaves.
  - The slave receives the master's shared context, so avoid re-fetching what peers found.
  - Set needs_clarification=true in your output schema when the slave needs more info.
  - Use output_schema to enforce structured JSON — aids synthesis quality.
  `,
  category: 'blocks',
  bgColor: '#0284C7',
  icon: AgentIcon,
  tags: ['llm', 'specialist', 'multi-agent', 'slave', 'master-slave'],

  subBlocks: [
    {
      id: 'capabilityLabel',
      title: 'Capability Label',
      type: 'short-input',
      placeholder: 'e.g. log_analysis, db_query, code_review…',
      required: true,
      description:
        'Unique label the master uses to route tasks. Keep it short and descriptive.',
    },
    {
      id: 'systemPrompt',
      title: 'System Prompt',
      type: 'long-input',
      placeholder:
        'You are a specialist agent for log analysis. ' +
        'Given a sub-task and shared context, answer precisely with cited evidence…',
      rows: 5,
      required: true,
    },
    {
      id: 'outputSchema',
      title: 'Output Schema (JSON Schema)',
      type: 'code-editor',
      language: 'json',
      placeholder: JSON.stringify(
        {
          type: 'object',
          required: ['answer', 'cited_nodes', 'confidence', 'needs_clarification'],
          properties: {
            answer:              { type: 'string' },
            cited_nodes:         { type: 'array', items: { type: 'string' } },
            confidence:          { type: 'number', minimum: 0, maximum: 1 },
            needs_clarification: { type: 'boolean' },
          },
        },
        null,
        2
      ),
      defaultValue: JSON.stringify(
        {
          type: 'object',
          required: ['answer', 'cited_nodes', 'confidence', 'needs_clarification'],
          properties: {
            answer:              { type: 'string' },
            cited_nodes:         { type: 'array', items: { type: 'string' } },
            confidence:          { type: 'number', minimum: 0, maximum: 1 },
            needs_clarification: { type: 'boolean' },
          },
        },
        null,
        2
      ),
      mode: 'advanced',
    },
    {
      id: 'toolsAccess',
      title: 'Tools / MCP Access',
      type: 'skill-input',
      defaultValue: [],
      description:
        'Which MCP tools or workspace skills this slave can call. ' +
        'Leave empty to use text-only LLM reasoning.',
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

  // Note: inputs are injected programmatically by the master dispatcher.
  // They are declared here for type-checking in the graph runner.
  inputs: {
    task:    { type: 'string', description: 'Sub-task assigned by the master — injected at dispatch time' },
    context: { type: 'json',   description: 'Shared evidence from prior slave results' },
  },

  outputs: {
    answer:              { type: 'string',  description: 'Answer to the sub-task' },
    cited_nodes:         { type: 'array',   description: 'Evidence node IDs or doc refs' },
    confidence:          { type: 'number',  description: '0–1 confidence score' },
    needs_clarification: { type: 'boolean', description: 'True → master may trigger adaptive re-plan' },
  },
})
