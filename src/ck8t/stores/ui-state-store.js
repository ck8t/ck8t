/**
 * UI layout state store — panel open/closed, widths, active tabs.
 *
 * Kept in a dedicated store (not workspace-store) so it can be saved and
 * restored independently of workflow data, mirroring Daakia's UIState pattern.
 *
 * In standalone mode: persisted to localStorage so layout survives page refresh.
 * In VS Code extension mode: included in the workspace snapshot (see snapshot.js)
 *   and restored via hydrateSnapshot(). localStorage persist is skipped there
 *   because the snapshot is the authoritative source of truth.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const UI_PANEL_DEFAULTS = {
  // Right inspector panel
  rOpen:       false,
  rWidth:      340,
  // Bottom run/dock panel
  runOpen:     false,
  dockTab:     'run',
  // Left SideNav
  sideNavOpen: true,
  sideNavWidth: 288,
  sideNavTab:  'blocks',
}

const isVsCode = typeof window !== 'undefined' && window.__CK8T_MODE__ === 'vscode-extension'

export const useUiStateStore = create(
  persist(
    (set, get) => ({
      ...UI_PANEL_DEFAULTS,

      setPanelState(patch) {
        set((s) => ({ ...s, ...patch }))
      },

      resetPanelState() {
        set(UI_PANEL_DEFAULTS)
      },

      getSnapshot() {
        const { setPanelState: _, resetPanelState: __, getSnapshot: ___, ...rest } = get()
        return rest
      },
    }),
    {
      name: 'ck8t-ui-state',
      // In VS Code mode the snapshot system owns UI state — skip localStorage.
      skipHydration: isVsCode,
      // Only persist the data fields, never the methods.
      partialize: (s) => {
        const { setPanelState: _, resetPanelState: __, getSnapshot: ___, ...data } = s
        return data
      },
    }
  )
)
