/**
 * "New workflow" dialog.
 *
 * Prompts for a workflow name, optional color, optional description,
 * optional folder, and optional team assignments.
 * Fires `onCreate(name, teamIds, folderId, color, description)` when confirmed.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import StyledSelect from './StyledSelect'

export const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#84cc16',
]

export function randomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]
}

// Deterministic hash-based color from an entity ID (used across sidenav + editors)
export function entityColor(id = '') {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h) ^ id.charCodeAt(i)
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length]
}

const DESC_MAX = 120

export default function CreateWorkflowModal({
  teams = [],
  folders = [],
  defaultTeamIds,
  defaultFolderId,
  onCancel,
  onCreate,
}) {
  const [name, setName] = useState('Untitled workflow')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(() => randomColor())
  const [teamIds, setTeamIds] = useState(() => defaultTeamIds || (teams[0] ? [teams[0].id] : []))
  const [folderId, setFolderId] = useState(defaultFolderId ?? (folders[0]?.id || null))
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.select?.()
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggleTeam(id) {
    setTeamIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const canSubmit = name.trim().length > 0 && !!folderId

  function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onCreate?.(name.trim(), teamIds, folderId, color, description)
  }

  const folderOptions = folders.map((f) => ({ id: f.id, label: f.name }))

  return createPortal(
    <div className="bs-modal-overlay" onClick={onCancel}>
      <form
        className="bs-modal bs-create-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <header className="bs-modal-header">
          <div className="bs-cm-title-row">
            <span className="bs-cm-color-preview" style={{ background: color }} />
            <h3 className="bs-modal-title">New workflow</h3>
          </div>
          <p className="bs-modal-sub">Give it a name, pick a color, and assign teams.</p>
        </header>

        <div className="bs-modal-body">
          {/* Name */}
          <div className="bs-field">
            <label className="bs-label">Name</label>
            <input
              ref={nameRef}
              className="bs-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order triage"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div className="bs-field">
            <label className="bs-label">Color</label>
            <div className="bs-cp-grid">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`bs-cp-swatch ${color === c ? 'is-sel' : ''}`}
                  style={{ '--sc': c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bs-field">
            <label className="bs-label">
              Description <span className="bs-label-hint">(optional)</span>
            </label>
            <div className="bs-field-wrap">
              <textarea
                className="bs-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                placeholder="What does this workflow do?"
                rows={2}
              />
              <span className={`bs-char-count ${description.length >= DESC_MAX ? 'is-limit' : ''}`}>
                {description.length}/{DESC_MAX}
              </span>
            </div>
          </div>

          {/* Folder — required */}
          <div className="bs-field">
            <label className="bs-label">Folder</label>
            {folders.length === 0 ? (
              <div className="bs-hint bs-hint-warn">
                No folders yet — create one in the sidebar first.
              </div>
            ) : (
              <StyledSelect
                value={folderId || ''}
                options={folderOptions}
                onChange={(id) => setFolderId(id || null)}
                placeholder="Select a folder…"
              />
            )}
          </div>

          {/* Teams */}
          <div className="bs-field">
            <label className="bs-label">Teams <span className="bs-label-hint">(optional)</span></label>
            {teams.length === 0 ? (
              <div className="bs-hint bs-hint-warn">
                No teams yet — create one in the Teams tab.
              </div>
            ) : (
              <div className="bs-checkbox-list">
                {teams.map((t) => (
                  <label key={t.id} className="bs-checkbox-item">
                    <input
                      type="checkbox"
                      checked={teamIds.includes(t.id)}
                      onChange={() => toggleTeam(t.id)}
                    />
                    <span>{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="bs-modal-footer">
          <button type="button" className="bs-btn" onClick={onCancel}>Cancel</button>
          <button
            type="submit"
            className="bs-btn-primary"
            disabled={!canSubmit}
            style={{ '--accent': color }}
          >
            Create workflow
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
