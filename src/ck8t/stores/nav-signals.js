import { create } from 'zustand'

/** Ephemeral navigation signals — not persisted, cleared after consumption. */
export const useNavSignals = create((set) => ({
  gsSelectId: null,
  setGsTarget: (id) => set({ gsSelectId: id }),
  clearGsTarget: () => set({ gsSelectId: null }),
}))
