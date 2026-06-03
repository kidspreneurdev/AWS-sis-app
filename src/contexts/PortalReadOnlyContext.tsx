import { createContext, useContext } from 'react'

const PortalReadOnlyContext = createContext({ readOnly: false })

export function usePortalReadOnly() {
  return useContext(PortalReadOnlyContext)
}

export { PortalReadOnlyContext }
