import { create } from 'zustand';

export const useMcpProgressStore = create((set) => ({
  active: null,
  setProgress: (p) => set({ active: p }),
  clearProgress: () => set({ active: null }),
}));
