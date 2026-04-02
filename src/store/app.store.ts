import { create } from 'zustand'
import type { Settings } from '@/types/database'

interface AppState {
  settings: Settings | null
  sidebarOpen: boolean
  setSettings: (settings: Settings | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  settings: null,
  sidebarOpen: true,
  setSettings: (settings) => set({ settings }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
