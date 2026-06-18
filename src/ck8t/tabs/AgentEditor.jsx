/**
 * Agent editor — opens as a tab when an agent row is clicked in the SideNav.
 * Mirrors the agent canvas block: basic (name, model, prompts, skills, memory)
 * and advanced (temperature, maxTokens, reasoningEffort, thinkingLevel, verbosity).
 */
import { useEffect, useMemo, useState } from 'react'
import { changeRuntimeProvider } from '../api/llm-provider-client'
import { useWorkspaceStore } from '../stores/workspace-store'
import { getConfiguredProviderForModel, useLlmConfigStore } from '../stores/llm-config-store'
import { useTabsStore, agentTabId } from '../stores/tabs-store'
import { entityColor } from '../components/CreateWorkflowModal'
import { AgentsIcon, SkillsIcon, ChevronDownIcon } from '../components/icons'
import JsonEditor from '../components/JsonEditor'
import FullscreenWrapper from '../components/FullscreenWrapper'
import StyledSelect from '../components/StyledSelect'

const MEMORY_OPTIONS = [
  { id: 'none',                   label: 'None' },
  { id: 'conversation',           label: 'Conversation' },
  { id: 'sliding_window',         label: 'Sliding window (messages)' },
  { id: 'sliding_window_tokens',  label: 'Sliding window (tokens)' },
]

const REASONING_OPTIONS = [
  { id: 'auto', label: 'auto' },
  { id: 'low',  label: 'low' },
  { id: 'medium', label: 'medium' },
  { id: 'high', label: 'high' },
]

const THINKING_OPTIONS = [
  { id: 'none',    label: 'none' },
  { id: 'minimal', label: 'minimal' },
  { id: 'low',     label: 'low' },
  { id: 'medium',  label: 'medium' },
  { id: 'high',    label: 'high' },
  { id: 'max',     label: 'max' },
]

const VERBOSITY_OPTIONS = [
  { id: 'auto',   label: 'auto' },
  { id: 'low',    label: 'low' },
  { id: 'medium', label: 'medium' },
  { id: 'high',   label: 'high' },
]

export default function AgentEditor({ agentId }) {
  const agent = useWorkspaceStore((s) => s.agents.find((a) => a.id === agentId))
  const skills = useWorkspaceStore((s) => s.skills)
  const updateAgent = useWorkspaceStore((s) => s.updateAgent)
  const models = useLlmConfigStore((s) => s.models)
  const pool = useWorkspaceStore((s) =>
    agent ? s.agentPools.find((p) => p.id === agent.poolId) : null
  )
  const closeTab = useTabsStore((s) => s.closeTab)
  const tabId = agentTabId(agentId)

  const attached = useMemo(() => new Set(agent?.attachedSkillIds || []), [agent])
  const [advOpen, setAdvOpen] = useState(false)

  // Auto-close tab when agent is deleted
  useEffect(() => {
    if (!agent) closeTab(tabId)
  }, [agent, closeTab, tabId])

  if (!agent) return null

  function toggleSkill(skillId) {
    const next = new Set(attached)
    if (next.has(skillId)) next.delete(skillId); else next.add(skillId)
    updateAgent(agent.id, { attachedSkillIds: Array.from(next) })
  }

  const heroColor = agent.color || entityColor(agent.id)
  const memType = agent.memoryType || 'none'

  return (
    <div className="bs-editor">
      {/* ── Hero ── */}
      <div className="bs-entity-hero" style={{ '--ehc': heroColor }}>
        <div className="bs-entity-hero-bg" />
        <div className="bs-entity-hero-content">
          <div className="bs-entity-hero-avatar">
            <AgentsIcon style={{ width: 16, height: 16, color: '#fff' }} />
          </div>
          <div className="bs-entity-hero-info">
            <div className="bs-entity-hero-title">{agent.name}</div>
            <div className="bs-entity-hero-stats">
              <span className="bs-entity-hero-stat">
                <span className="bs-entity-hero-stat-dot" />
                {pool?.name || 'Unassigned pool'}
              </span>
              <span className="bs-entity-hero-stat">
                <span className="bs-entity-hero-stat-dot" />
                {agent.model}
              </span>
              <span className="bs-entity-hero-stat">
                <span className="bs-entity-hero-stat-dot" />
                {agent.attachedSkillIds?.length || 0} skill{(agent.attachedSkillIds?.length || 0) === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <span className="bs-entity-hero-badge">Agent</span>
        </div>
      </div>

      {/* ── Name ── */}
      <section className="bs-editor-section">
        <label className="bs-label">Name</label>
        <input
          className="bs-input"
          value={agent.name}
          onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
        />
      </section>

      {/* ── Model ── */}
      <section className="bs-editor-section">
        <label className="bs-label">Model</label>
        <StyledSelect
          value={agent.model}
          options={models}
          placeholder="Select model…"
          onChange={(model) => {
            updateAgent(agent.id, { model })
            void changeRuntimeProvider({
              provider: getConfiguredProviderForModel(model) || undefined,
              model,
            }).then((config) => useLlmConfigStore.getState().setConfig(config)).catch(() => {})
          }}
        />
      </section>

      {/* ── System prompt ── */}
      <section className="bs-editor-section">
        <label className="bs-label">System prompt</label>
        <textarea
          className="bs-textarea"
          rows={4}
          value={agent.systemPrompt || ''}
          onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant that …"
        />
      </section>

      {/* ── User prompt template ── */}
      <section className="bs-editor-section">
        <label className="bs-label">User prompt template</label>
        <textarea
          className="bs-textarea"
          rows={3}
          value={agent.userPrompt || ''}
          onChange={(e) => updateAgent(agent.id, { userPrompt: e.target.value })}
          placeholder="{{input}}"
        />
        <div className="bs-hint">Use <code>{'{{input}}'}</code> to reference the upstream node's output.</div>
      </section>

      {/* ── Skills ── */}
      <section className="bs-editor-section">
        <label className="bs-label">Skills / Tools</label>
        <ul className="bs-chip-list">
          {skills.length === 0 && <li className="bs-empty">No skills defined yet.</li>}
          {skills.map((k) => {
            const on = attached.has(k.id)
            return (
              <li key={k.id}>
                <button className={`bs-chip ${on ? 'is-on' : ''}`} onClick={() => toggleSkill(k.id)} type="button">
                  <SkillsIcon className="bs-ico-xs" />
                  <span>{k.name}</span>
                  <span className="bs-chip-meta">{k.language}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Memory ── */}
      <section className="bs-editor-section">
        <label className="bs-label">Memory</label>
        <StyledSelect
          value={memType}
          options={MEMORY_OPTIONS}
          onChange={(v) => updateAgent(agent.id, { memoryType: v })}
        />
        {memType !== 'none' && (
          <div style={{ marginTop: 8 }}>
            <label className="bs-label">Conversation ID</label>
            <input
              className="bs-input"
              value={agent.conversationId || ''}
              onChange={(e) => updateAgent(agent.id, { conversationId: e.target.value })}
              placeholder="e.g. user-123, session-abc"
            />
          </div>
        )}
        {memType === 'sliding_window' && (
          <div style={{ marginTop: 8 }}>
            <label className="bs-label">Sliding window size (messages)</label>
            <input
              className="bs-input"
              type="number"
              value={agent.slidingWindowSize || ''}
              onChange={(e) => updateAgent(agent.id, { slidingWindowSize: e.target.value })}
              placeholder="e.g. 10"
            />
          </div>
        )}
        {memType === 'sliding_window_tokens' && (
          <div style={{ marginTop: 8 }}>
            <label className="bs-label">Max tokens for window</label>
            <input
              className="bs-input"
              type="number"
              value={agent.slidingWindowTokens || ''}
              onChange={(e) => updateAgent(agent.id, { slidingWindowTokens: e.target.value })}
              placeholder="e.g. 4000"
            />
          </div>
        )}
      </section>

      {/* ── Response schema ── */}
      <section className="bs-editor-section">
        <label className="bs-label">Response format (JSON schema)</label>
        <FullscreenWrapper label="Response schema">
          <JsonEditor
            value={agent.responseSchema || ''}
            onChange={(text) => updateAgent(agent.id, { responseSchema: text })}
            defaultMode="tree"
            height="520px"
          />
        </FullscreenWrapper>
      </section>

      <section className="bs-editor-section">
        <label className="bs-check-row">
          <input
            type="checkbox"
            className="bs-check"
            checked={agent.strictOutput === true}
            onChange={(e) => updateAgent(agent.id, { strictOutput: e.target.checked })}
          />
          <span className="bs-check-body">
            <span className="bs-check-title">Strict JSON output</span>
            <span className="bs-check-sub">
              Routes through <code>generateJsonStrict</code> — on OpenAI sets{' '}
              <code>{'{ type: "json_schema", strict: true }'}</code>. Only applies when a Response Format is set.
            </span>
          </span>
        </label>
      </section>

      {/* ── Advanced ── */}
      <section className="bs-editor-section">
        <button
          className="bs-collapsible-toggle"
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
        >
          <ChevronDownIcon
            className="bs-ico-xs"
            style={{ transform: advOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 140ms' }}
          />
          <span>Advanced</span>
        </button>
        {advOpen && (
          <div className="bs-adv-fields">
            <div className="bs-adv-row">
              <label className="bs-label">Temperature <span className="bs-label-hint">(0 – 2, default 0.3)</span></label>
              <input
                className="bs-input"
                type="number"
                min="0"
                max="2"
                step="0.05"
                value={agent.temperature ?? ''}
                onChange={(e) => updateAgent(agent.id, { temperature: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                placeholder="0.3"
              />
            </div>
            <div className="bs-adv-row">
              <label className="bs-label">Max output tokens</label>
              <input
                className="bs-input"
                type="number"
                value={agent.maxTokens || ''}
                onChange={(e) => updateAgent(agent.id, { maxTokens: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                placeholder="e.g. 4096"
              />
            </div>
            <div className="bs-adv-row">
              <label className="bs-label">Reasoning effort</label>
              <StyledSelect
                value={agent.reasoningEffort || ''}
                options={REASONING_OPTIONS}
                placeholder="Select…"
                onChange={(v) => updateAgent(agent.id, { reasoningEffort: v })}
              />
            </div>
            <div className="bs-adv-row">
              <label className="bs-label">Thinking level</label>
              <StyledSelect
                value={agent.thinkingLevel || ''}
                options={THINKING_OPTIONS}
                placeholder="Select…"
                onChange={(v) => updateAgent(agent.id, { thinkingLevel: v })}
              />
            </div>
            <div className="bs-adv-row">
              <label className="bs-label">Verbosity</label>
              <StyledSelect
                value={agent.verbosity || ''}
                options={VERBOSITY_OPTIONS}
                placeholder="Select…"
                onChange={(v) => updateAgent(agent.id, { verbosity: v })}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
