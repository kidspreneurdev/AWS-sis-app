import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthListener } from '@/hooks/useAuth'
import { router } from '@/router'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { StudentPortalProvider } from '@/contexts/StudentPortalContext'

function AuthBridge() {
  useAuthListener()
  return null
}

export default function App() {
  return (
    <TooltipProvider>
      <AuthBridge />
      <StudentPortalProvider>
        <RouterProvider router={router} />
      </StudentPortalProvider>
      <ToastContainer />
    </TooltipProvider>
  )
}
