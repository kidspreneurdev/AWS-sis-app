import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface MHSDiplomaProgressProps {
  studentId: string
}

/** Diploma progress view: both Mastery and HOW strand thresholds shown
 *  independently, pass/fail per requirement (spec section 12) — never
 *  blended into one number, and honest "not configured" when an admin
 *  hasn't set a threshold yet (spec section 13). */
export function MHSDiplomaProgress({ studentId }: MHSDiplomaProgressProps) {
  const [avgMastery, setAvgMastery] = useState<number | null>(null)
  const [avgHow, setAvgHow] = useState<number | null>(null)
  const [masteryThreshold, setMasteryThreshold] = useState<number | null>(null)
  const [howThreshold, setHowThreshold] = useState<number | null>(null)
  const [hasAnyMhsCourse, setHasAnyMhsCourse] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: config } = await supabase.from('mhs_config').select('mastery_diploma_threshold_pct,how_diploma_threshold_pct').single()
      const { data: courses } = await supabase.from('courses').select('id').eq('student_id', studentId).not('mhs_course_id', 'is', null)
      const courseIds = (courses ?? []).map((c) => c.id)
      const { data: strands } = courseIds.length
        ? await supabase.from('mhs_gpa_strands').select('mastery_pct,how_pct').in('course_id', courseIds)
        : { data: [] }
      if (cancelled) return

      const masteryVals = (strands ?? []).map((s) => s.mastery_pct).filter((v): v is number => v !== null)
      const howVals = (strands ?? []).map((s) => s.how_pct).filter((v): v is number => v !== null)
      setAvgMastery(masteryVals.length ? Math.round((masteryVals.reduce((a, b) => a + b, 0) / masteryVals.length) * 100) / 100 : null)
      setAvgHow(howVals.length ? Math.round((howVals.reduce((a, b) => a + b, 0) / howVals.length) * 100) / 100 : null)
      setMasteryThreshold(config?.mastery_diploma_threshold_pct ?? null)
      setHowThreshold(config?.how_diploma_threshold_pct ?? null)
      setHasAnyMhsCourse(courseIds.length > 0)
    }
    void load()
    return () => { cancelled = true }
  }, [studentId])

  if (!hasAnyMhsCourse) return null

  function row(label: string, value: number | null, threshold: number | null) {
    if (threshold === null) {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>Not configured</span>
        </div>
      )
    }
    const met = value !== null && value >= threshold
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: met ? '#15803D' : '#B91C1C' }}>
          {value ?? '—'}% / {threshold}% required {met ? '✓' : '✗'}
        </span>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>MS/HS Diploma Progress — Two-Strand Requirement</div>
      <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Both thresholds must be met independently — never averaged into one number.</div>
      {row('Mastery GPA', avgMastery, masteryThreshold)}
      {row('Habits of Work (HOW) GPA', avgHow, howThreshold)}
    </div>
  )
}
