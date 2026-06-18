/**
 * Modal shown after importing a workflow JSON.
 * Lets the user confirm/edit the name, pick a folder, and assign teams.
 *
 * Props:
 *   teams         — array of { id, name } team objects
 *   folders       — array of { id, name } folder objects
 *   defaultName   — pre-filled workflow name from the JSON
 *   defaultTeamIds — pre-selected team ids (optional)
 *   defaultFolderId — pre-selected folder id (optional)
 *   onCancel      — () => void
 *   onImport      — (name: string, teamIds: string[], folderId: string|null) => void
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import StyledSelect from './StyledSelect'

export default function ImportWorkflowModal({
  teams = [],
  folders = [],
  defaultName = 'Imported Workflow',
  defaultTeamIds,
  defaultFolderId,
  onCancel,
  onImport,
}) {
  const [name, setName] = useState(defaultName)
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

  const canSubmit = name.trim().length > 0

  function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onImport?.(name.trim(), teamIds, folderId || null)
  }

  const folderOptions = [
    { id: '', label: '— No folder (root) —' },
    ...folders.map((f) => ({ id: f.id, label: f.name })),
  ]

  return createPortal(
    <div className="bs-modal-overlay" onClick={onCancel}>
      <form
        className="bs-modal bs-create-modal bs-import-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <header className="bs-modal-header">
          <div className="bs-import-modal-icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#6366f1"/>
              <polyline points="17 8 12 3 7 8" stroke="#818cf8"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="#818cf8"/>
            </svg>
          </div>
          <h3 className="bs-modal-title">Import workflow</h3>
          <p className="bs-modal-sub">Confirm the name, pick a folder, and assign teams.</p>
        </header>

        <div className="bs-modal-body">
          <div className="bs-field">
            <label className="bs-label">Workflow name</label>
            <input
              ref={nameRef}
              className="bs-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. URL → Summary"
              autoFocus
            />
          </div>

          {folders.length > 0 && (
            <div className="bs-field">
              <label className="bs-label">Folder</label>
              <StyledSelect
                value={folderId || ''}
                options={folderOptions}
                onChange={(id) => setFolderId(id || null)}
              />
            </div>
          )}

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
          <button type="button" className="bs-btn bs-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="bs-btn bs-btn-primary"
            disabled={!canSubmit}
          >
            Import &amp; open
          </button>
        </footer>
      </form>
    </div>,
    document.body
  )
}
