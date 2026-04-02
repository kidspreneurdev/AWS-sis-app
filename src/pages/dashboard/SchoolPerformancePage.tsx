import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

function BarChart({ data, color }: { data: { label: string; value: number; suffix?: string }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, fontSize: 12, color: '#7A92B0', textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, height: 20, background: '#F0F4F8', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 6, width: `${(d.value / max) * 100}%`, background: color, transition: 'width 0.4s ease', minWidth: d.value > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: '#1A365E', flexShrink: 0 }}>{d.value}{d.suffix ?? ''}</div>
        </div>
      ))}
      {data.length === 0 && <div style={{ color: '#7A92B0', fontSize: 13, textAlign: 'center', padding: 12 }}>No data</div>}
    </div>
  )
}

export function SchoolPerformancePage() {
  const [students, setStudents] = useState<{ grade: string; status: string; cohort: string | null }[]>([])
  const [attendance, setAttendance] = useState<{ student_id: string; status: string; date: string }[]>([])
  const [courses, setCourses] = useState<{ area: string; grade: number | null }[]>([])
  const [fees, setFees] = useState<{ paid: boolean; amount: number }[]>([])

  useEffect(() => {
    supabase.from('students').select('grade,status,cohort').then(({ data }) => { if (data) setStudents(data as typeof students) })
    supabase.from('attendance').select('student_id,status,date').then(({ data }) => { if (data) setAttendance(data as typeof attendance) })
    supabase.from('courses').select('area,grade').then(({ data }) => { if (data) setCourses(data as typeof courses) })
    supabase.from('fees').select('paid,amount').then(({ data }) => { if (data) setFees(data as typeof fees) })
  }, [])

  const enrolled = students.filter(s => s.status === 'Enrolled')

  // Avg attendance rate (last 30 days)
  const avgAttendanceRate = useMemo(() => {
    if (!attendance.length) return 0
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const recent = attendance.filter(a => new Date(a.date) >= cutoff)
    if (!recent.length) return 0
    const present = recent.filter(a => a.status === 'P' || a.status === 'Present').length
    return Math.round((present / recent.length) * 100)
  }, [attendance])

  // Avg grade from courses (numeric)
  const avgGrade = useMemo(() => {
    const graded = courses.filter(c => c.grade !== null && c.grade !== undefined)
    if (!graded.length) return '—'
    const avg = graded.reduce((s, c) => s + (c.grade ?? 0), 0) / graded.length
    return avg.toFixed(1)
  }, [courses])

  // Outstanding fees
  const outstandingFees = useMemo(() => fees.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0), [fees])

  // Enrollment by grade
  const enrollByGrade = useMemo(() => {
    const map = new Map<string, number>()
    enrolled.forEach(s => map.set(s.grade, (map.get(s.grade) ?? 0) + 1))
    const order = ['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12']
    return order.filter(g => map.has(g)).map(g => ({ label: `Grade ${g}`, value: map.get(g)! }))
  }, [enrolled])

  // Attendance rate by cohort
  const attendByCohort = useMemo(() => {
    const cohortMap = new Map<string, string>()
    students.forEach(s => { if (s.cohort) cohortMap.set(s.status + s.grade, s.cohort) })
    const byStudent = new Map<string, { p: number; t: number }>()
    attendance.forEach(a => {
      if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, { p: 0, t: 0 })
      const r = byStudent.get(a.student_id)!; r.t++
      if (a.status === 'P' || a.status === 'Present') r.p++
    })
    // cohort from enrolled students
    const cohortRates = new Map<string, { p: number; t: number }>()
    enrolled.forEach(s => {
      const cohort = s.cohort ?? 'Unassigned'
      if (!cohortRates.has(cohort)) cohortRates.set(cohort, { p: 0, t: 0 })
    })
    return Array.from(cohortRates.entries())
      .map(([label, r]) => ({ label, value: r.t > 0 ? Math.round((r.p / r.t) * 100) : 0, suffix: '%' }))
      .sort((a, b) => b.value - a.value)
  }, [enrolled, attendance])

  // Grade distribution by subject area
  const gradeByArea = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>()
    courses.filter(c => c.grade !== null && c.area).forEach(c => {
      if (!map.has(c.area)) map.set(c.area, { sum: 0, count: 0 })
      const r = map.get(c.area)!; r.sum += c.grade ?? 0; r.count++
    })
    return Array.from(map.entries()).map(([label, r]) => ({ label, value: Math.round(r.sum / r.count) })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [courses])

  // Fee collection by type (paid vs total count)
  const feeRate = useMemo(() => {
    const paid = fees.filter(f => f.paid).length
    const total = fees.length
    return total > 0 ? Math.round((paid / total) * 100) : 0
  }, [fees])

  const kpis = [
    { label: 'Total Enrolled', value: enrolled.length, color: '#1A365E' },
    { label: 'Avg Attendance Rate', value: `${avgAttendanceRate}%`, color: avgAttendanceRate >= 95 ? '#1DBD6A' : avgAttendanceRate >= 90 ? '#F5A623' : '#D61F31' },
    { label: 'Avg Course Grade', value: avgGrade, color: '#0EA5E9' },
    { label: 'Outstanding Fees', value: `$${outstandingFees.toLocaleString()}`, color: outstandingFees > 0 ? '#D61F31' : '#1DBD6A' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>School Performance</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Key metrics across enrollment, attendance, grades, and finance</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Enrollment by Grade</div>
          <BarChart data={enrollByGrade} color="#1A365E" />
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Attendance Rate by Cohort</div>
          <BarChart data={attendByCohort} color="#1DBD6A" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Avg Grade by Subject Area</div>
          <BarChart data={gradeByArea} color="#0EA5E9" />
        </div>
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Fee Collection Rate</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: feeRate >= 80 ? '#1DBD6A' : feeRate >= 60 ? '#F5A623' : '#D61F31' }}>{feeRate}%</div>
            <div style={{ width: '100%', height: 12, background: '#F0F4F8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${feeRate}%`, background: feeRate >= 80 ? '#1DBD6A' : feeRate >= 60 ? '#F5A623' : '#D61F31', borderRadius: 8, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 13, color: '#7A92B0' }}>{fees.filter(f => f.paid).length} of {fees.length} fees collected</div>
          </div>
        </div>
      </div>
    </div>
  )
}
