import { useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import type { Profile } from '@/types/database'

const DEV_MODE = import.meta.env.VITE_DEV_BYPASS === 'true'

const DEV_PROFILE: Profile = {
  id: 'dev-user',
  email: 'admin@awschool.edu',
  full_name: 'Dev Admin',
  role: 'admin',
  campus: null,
  active: true,
  avatar_url: null,
  created_at: new Date().toISOString(),
}

// Standalone (non-hook) helpers so callers like the login form can await the
// store being fully populated before navigating, instead of relying on the
// onAuthStateChange listener firing on its own schedule (race condition).
export async function syncAuthState(session: Session | null) {
  const { setUser, setSession, setProfile, setLoading } = useAuthStore.getState()
  setSession(session)
  setUser(session?.user ?? null)

  if (!session?.user) {
    setProfile(null)
    setLoading(false)
    return
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  setProfile(data as Profile | null)
  setLoading(false)
}

export function useAuthListener() {
  const { setUser, setSession, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    // Dev bypass: skip Supabase auth when no real credentials are set
    if (DEV_MODE) {
      setUser({ id: 'dev-user', email: 'admin@awschool.edu' } as never)
      setProfile(DEV_PROFILE)
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      void syncAuthState(session)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setProfile, setLoading])
}
