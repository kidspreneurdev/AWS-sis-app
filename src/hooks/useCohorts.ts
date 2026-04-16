import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Strip stray JSON brackets/quotes that appear when an array was saved as a raw JSON string */
function cleanCohort(v: unknown): string {
  return String(v).replace(/^[\["\s]+|[\]"\s]+$/g, '').trim()
}

/**
 * Returns the canonical cohort list from settings.
 * Use this wherever a cohort is being assigned or targeted (not just filtered from existing data).
 */
export function useCohorts(): string[] {
  const [cohorts, setCohorts] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('settings')
      .select('cohorts')
      .single()
      .then(({ data }) => {
        if (!data?.cohorts) return
        const raw = data.cohorts as unknown[]
        // If the array has one element that looks like a JSON array string, parse it
        if (raw.length === 1 && typeof raw[0] === 'string' && (raw[0] as string).startsWith('[')) {
          try {
            const parsed = JSON.parse(raw[0] as string)
            if (Array.isArray(parsed)) { setCohorts(parsed.map(cleanCohort).filter(Boolean)); return }
          } catch { /* fall through */ }
        }
        setCohorts(raw.map(cleanCohort).filter(Boolean))
      })
  }, [])

  return cohorts
}
