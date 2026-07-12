import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { formatStudentGrade } from '@/types/student'
import type { StudentSession } from './StudentPortalContext'

export interface ParentSession {
  parentId: string
  parentName: string
  email: string
  children: StudentSession[]
  activeChildIndex: number
}

interface ParentPortalContextType {
  session: ParentSession | null
  loading: boolean
  activeChild: StudentSession | null
  setActiveChildIndex: (i: number) => void
  refreshSession: () => Promise<void>
  logout: () => Promise<void>
}

const ParentPortalContext = createContext<ParentPortalContextType | null>(null)

function mapChild(row: Record<string, unknown>): StudentSession {
  return {
    studentId: (row.student_id as string) ?? '',
    fullName: `${(row.first_name as string) ?? ''} ${(row.last_name as string) ?? ''}`.trim(),
    grade: formatStudentGrade(row.grade),
    campus: (row.campus as string) ?? '',
    cohort: (row.cohort as string) ?? '',
    dbId: row.id as string,
    email: (row.email as string) ?? '',
  }
}

export function ParentPortalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ParentSession | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadSession() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSession(null); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as Record<string, unknown>).role !== 'parent') {
      setSession(null); setLoading(false); return
    }

    const { data: links } = await supabase
      .from('parent_students')
      .select('student_id, students(id, first_name, last_name, student_id, grade, campus, cohort, email)')
      .eq('parent_id', user.id)

    const childRows = (links ?? [])
      .map((l: Record<string, unknown>) => l.students as Record<string, unknown>)
      .filter(Boolean)
      .map(mapChild)

    const p = profile as Record<string, unknown>
    setSession({
      parentId: user.id,
      parentName: (p.full_name as string) ?? user.email ?? '',
      email: user.email ?? '',
      children: childRows,
      activeChildIndex: 0,
    })
    setLoading(false)
  }

  function setActiveChildIndex(i: number) {
    setSession(prev => prev ? { ...prev, activeChildIndex: i } : prev)
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
  }

  useEffect(() => {
    void loadSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadSession()
    })
    return () => subscription.unsubscribe()
  }, [])

  const activeChild = session?.children[session.activeChildIndex] ?? null

  return (
    <ParentPortalContext.Provider value={{ session, loading, activeChild, setActiveChildIndex, refreshSession: loadSession, logout }}>
      {children}
    </ParentPortalContext.Provider>
  )
}

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext)
  if (!ctx) throw new Error('useParentPortal must be used within ParentPortalProvider')
  return ctx
}
