import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface Snapshot { grading_period: string; how_pct: number | null; how_threshold_pct: number; honor_roll_met: boolean; academic_year: string }

interface MHSHonorRollStatusProps {
  studentId: string
}

/** Read-only, student/parent-facing Honor Roll transparency: exactly which
 *  period(s) caused ineligibility, not just a pass/fail flag for the year
 *  (spec section 3's deliberate transparency requirement). */
export function MHSHonorRollStatus({ studentId }: MHSHonorRollStatusProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('mhs_period_snapshots')
        .select('grading_period,how_pct,how_threshold_pct,honor_roll_met,academic_year')
        .eq('student_id', studentId)
        .order('computed_at', { ascending: true })
      if (!cancelled) setSnapshots(data ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [studentId])

  if (snapshots.length === 0) return null

  const byYear = new Map<string, Snapshot[]>()
  for (const s of snapshots) {
    const list = byYear.get(s.academic_year) ?? []
    list.push(s)
    byYear.set(s.academic_year, list)
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>Honor Roll Status</div>
      {[...byYear.entries()].map(([year, periods]) => {
        const eligible = periods.every((p) => p.honor_roll_met)
        return (
          <div key={year} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{year}</span>
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: eligible ? '#DCFCE7' : '#FEE2E2', color: eligible ? '#15803D' : '#B91C1C' }}>
                {eligible ? 'Honor Roll eligible' : 'Not eligible this year'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {periods.map((p) => (
                <span
                  key={p.grading_period}
                  style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: p.honor_roll_met ? '#DCFCE7' : '#FEE2E2', color: p.honor_roll_met ? '#15803D' : '#B91C1C' }}
                >
                  {p.grading_period}: {p.how_pct ?? '—'}% {p.honor_roll_met ? '' : `— below ${p.how_threshold_pct}% threshold`}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
