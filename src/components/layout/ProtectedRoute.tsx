import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function ProtectedRoute() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
