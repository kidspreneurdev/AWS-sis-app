import { useAuthStore } from '@/store/auth.store'

/**
 * Returns the campus string to filter queries by, or null for admins (no filter).
 * Usage: const cf = useCampusFilter()
 *        supabase.from('students').select('*').then(q => cf ? q.eq('campus', cf) : q)
 */
export function useCampusFilter(): string | null {
  const profile = useAuthStore(s => s.profile)
  if (!profile) return null
  if (profile.role === 'admin') return null
  return profile.campus ?? null
}
