import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'

// Split into two contexts to prevent AppLayout from re-rendering when target changes
const SetActionsTargetCtx = createContext<(el: HTMLDivElement | null) => void>(() => {})
const ActionsTargetCtx = createContext<HTMLDivElement | null>(null)

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  return (
    <SetActionsTargetCtx.Provider value={setTarget}>
      <ActionsTargetCtx.Provider value={target}>
        {children}
      </ActionsTargetCtx.Provider>
    </SetActionsTargetCtx.Provider>
  )
}

// Used by AppLayout to register the portal target div
export function useSetActionsTarget() {
  return useContext(SetActionsTargetCtx)
}

// Used by pages to render action buttons into the topbar
export function useHeaderActions(content: React.ReactNode): React.ReactPortal | null {
  const target = useContext(ActionsTargetCtx)
  if (!target || !content) return null
  return createPortal(content, target)
}

// Common button styles for the topbar
export const topbarBtn = {
  primary: {
    padding: '7px 16px', borderRadius: 8, border: 'none',
    background: '#D61F31', color: '#fff', fontWeight: 700,
    fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  } as React.CSSProperties,
  secondary: {
    padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2',
    background: '#fff', color: '#1A365E', fontWeight: 600,
    fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  } as React.CSSProperties,
}
