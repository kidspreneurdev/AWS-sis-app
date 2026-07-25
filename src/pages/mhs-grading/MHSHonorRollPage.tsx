import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { closeGradingPeriodForAllStudents } from '@/lib/grading/mhsRollup'
import { toast } from '@/lib/toast'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface Snapshot {
  student_id: string
  academic_year: string
  grading_period: string
  how_pct: number | null
  how_threshold_pct: number
  honor_roll_met: boolean
  computed_at: string
}

/** Admin: closes a grading period (computes + snapshots every student's HOW
 *  GPA for that period) and shows per-period Honor Roll status plus the
 *  derived year-end eligibility — visible per period, not just a year-end
 *  verdict (spec section 3's transparency requirement). */
export function MHSHonorRollPage() {
  const profile = useAuthStore((s) => s.profile)
  const [academicYear, setAcademicYear] = useState('2025-2026')
  const [gradingPeriod, setGradingPeriod] = useState('Quarter 1')
  const [closing, setClosing] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})

  const loadSnapshots = useCallback(async () => {
    const { data } = await supabase
      .from('mhs_period_snapshots')
      .select('student_id,academic_year,grading_period,how_pct,how_threshold_pct,honor_roll_met,computed_at')
      .eq('academic_year', academicYear)
      .order('grading_period')
    setSnapshots(data ?? [])

    const studentIds = [...new Set((data ?? []).map((s) => s.student_id))]
    if (studentIds.length) {
      const { data: students } = await supabase.from('students').select('id,first_name,last_name').in('id', studentIds)
      const names: Record<string, string> = {}
      for (const s of students ?? []) names[s.id] = `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim()
      setStudentNames(names)
    }
  }, [academicYear])

  useEffect(() => { void loadSnapshots() }, [loadSnapshots])

  async function closePeriod() {
    if (!academicYear.trim() || !gradingPeriod.trim()) return
    setClosing(true)
    const results = await closeGradingPeriodForAllStudents(academicYear.trim(), gradingPeriod.trim())
    setClosing(false)
    toast(`Closed ${gradingPeriod} for ${results.length} student(s)`, 'ok')
    await loadSnapshots()
  }

  if (profile?.role !== 'admin') {
    return <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0' }}>⛔ Admin access required.</div>
  }

  const byStudent = new Map<string, Snapshot[]>()
  for (const s of snapshots) {
    const list = byStudent.get(s.student_id) ?? []
    list.push(s)
    byStudent.set(s.student_id, list)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>Close Grading Period</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Academic year</label>
            <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Grading period</label>
            <input value={gradingPeriod} onChange={(e) => setGradingPeriod(e.target.value)} placeholder="Quarter 1" style={input} />
          </div>
          <button
            onClick={() => void closePeriod()}
            disabled={closing}
            style={{ padding: '8px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {closing ? 'Closing…' : 'Close Period for All Students'}
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>Honor Roll — {academicYear}</div>
        {byStudent.size === 0 && <div style={{ fontSize: 12, color: '#7A92B0' }}>No periods closed yet for this year.</div>}
        {[...byStudent.entries()].map(([studentId, periods]) => {
          const yearEndEligible = periods.length > 0 && periods.every((p) => p.honor_roll_met)
          return (
            <div key={studentId} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{studentNames[studentId] ?? studentId}</div>
                <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: yearEndEligible ? '#DCFCE7' : '#FEE2E2', color: yearEndEligible ? '#15803D' : '#B91C1C' }}>
                  {yearEndEligible ? 'Honor Roll eligible' : 'Not eligible this year'}
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
    </div>
  )
}
