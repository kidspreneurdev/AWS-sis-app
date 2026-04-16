import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

export interface StudentSession {
  studentId: string
  fullName: string
  grade: string
  campus: string
  cohort: string
  dbId: string
  email: string
}

interface StudentPortalContextType {
  session: StudentSession | null
  loading: boolean
  setSession: (s: StudentSession | null) => void
  refreshSession: () => Promise<StudentSession | null>
  logout: () => Promise<void>
}

const StudentPortalContext = createContext<StudentPortalContextType | null>(null)

function mapStudentSession(row: Record<string, unknown>): StudentSession {
  return {
    studentId: (row.student_id as string) ?? '',
    fullName: `${(row.first_name as string) ?? ''} ${(row.last_name as string) ?? ''}`.trim(),
    grade: row.grade != null ? String(row.grade) : '',
    campus: (row.campus as string) ?? '',
    cohort: (row.cohort as string) ?? '',
    dbId: row.id as string,
    email: (row.email as string) ?? '',
  }
}

function getStoredSession(): StudentSession | null {
  try {
    const raw = sessionStorage.getItem('sp_session')
    if (!raw) return null
    return JSON.parse(raw) as StudentSession
  } catch {
    return null
  }
}

export function StudentPortalProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)

  function setSession(s: StudentSession | null) {
    setSessionState(s)
    if (!s) {
      try { sessionStorage.removeItem('sp_session') } catch { /* ignore */ }
    }
  }

  async function refreshSession() {
    // Check sessionStorage first (portal_password-based auth)
    const stored = getStoredSession()
    if (stored) {
      setSessionState(stored)
      setLoading(false)
      return stored
    }

    // Fallback: Supabase auth (legacy flow)
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const email = authSession?.user?.email

    if (!email) {
      setSessionState(null)
      setLoading(false)
      return null
    }

    const { data, error } = await supabase
      .from('students')
      .select('id,first_name,last_name,student_id,grade,cohort,campus,email')
      .eq('email', email)
      .single()

    if (error || !data) {
      setSessionState(null)
      setLoading(false)
      return null
    }

    const next = mapStudentSession(data as Record<string, unknown>)
    setSessionState(next)
    setLoading(false)
    return next
  }

  async function logout() {
    try { sessionStorage.removeItem('sp_session') } catch { /* ignore */ }
    await supabase.auth.signOut()
    setSessionState(null)
  }

  useEffect(() => {
    void refreshSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const stored = getStoredSession()
        if (!stored) {
          setSessionState(null)
          setLoading(false)
        }
        return
      }
      void refreshSession()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <StudentPortalContext.Provider value={{ session, loading, setSession, refreshSession, logout }}>
      {children}
    </StudentPortalContext.Provider>
  )
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext)
  if (!ctx) throw new Error('useStudentPortal must be used within StudentPortalProvider')
  return ctx
}
