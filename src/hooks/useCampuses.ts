import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Returns the canonical campus list from settings.campuses.
 * Falls back to ['Main Campus'] if not configured.
 */
export function useCampuses(): string[] {
  const [campuses, setCampuses] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('settings')
      .select('campuses')
      .single()
      .then(({ data }) => {
        if (!data?.campuses) return
        const raw = data.campuses as unknown[]
        if (raw.length === 1 && typeof raw[0] === 'string' && (raw[0] as string).startsWith('[')) {
          try {
            const parsed = JSON.parse(raw[0] as string)
            if (Array.isArray(parsed)) { setCampuses(parsed.map(String).filter(Boolean)); return }
          } catch { /* fall through */ }
        }
        setCampuses(raw.map(String).filter(Boolean))
      })
  }, [])

  return campuses
}
