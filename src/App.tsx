import { RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthListener } from '@/hooks/useAuth'
import { router } from '@/router'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { StudentPortalProvider } from '@/contexts/StudentPortalContext'
import { hasSupabaseEnv, supabaseConfigError } from '@/lib/supabase'

function AuthBridge() {
  useAuthListener()
  return null
}

export default function App() {
  if (!hasSupabaseEnv) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F4F7FB',
        padding: 24,
        fontFamily: 'Poppins, sans-serif',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 680,
          background: '#fff',
          border: '1px solid #E4EAF2',
          borderRadius: 18,
          boxShadow: '0 20px 60px rgba(15,34,64,.08)',
          padding: 28,
        }}>
          <img
            src="/Logo_b.png"
            alt="AWS"
            style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 16 }}
          />
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, color: '#1A365E' }}>
            Deployment configuration is incomplete
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: '#5E7491' }}>
            {supabaseConfigError}
          </p>
          <div style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            background: '#F7F9FC',
            border: '1px solid #E4EAF2',
            color: '#1A365E',
            fontSize: 13,
            lineHeight: 1.7,
          }}>
            <div><strong>Required variables</strong></div>
            <div><code>VITE_SUPABASE_URL</code></div>
            <div><code>VITE_SUPABASE_ANON_KEY</code></div>
          </div>
        </div>
      </div>
    )
  }

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
