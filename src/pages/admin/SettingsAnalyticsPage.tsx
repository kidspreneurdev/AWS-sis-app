import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StudentRow {
  id: string
  student_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  grade: number | null
  status: string
  campus: string | null
  cohort: string | null
  priority: string | null
  application_date: string | null
  enroll_date: string | null
  parent: string | null
  created_at?: string
}

interface AttendanceRow {
  status: string
}

interface FeeRow {
  amount: number | null
  paid: boolean
}

interface InterviewRow {
  score: number | null
}

interface SettingsRow {
  enrollment_capacity: number | null
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,.06)' }

const STATUS_COLORS: Record<string, string> = {
  Inquiry: '#7040CC',
  Applied: '#0EA5E9',
  'Under Review': '#F5A623',
  Accepted: '#1DBD6A',
  Enrolled: '#0369A1',
  Waitlisted: '#1FD6C4',
  Denied: '#D61F31',
  Withdrawn: '#7A92B0',
  Alumni: '#FAC600',
}

const STATUS_ORDER = ['Inquiry', 'Applied', 'Under Review', 'Accepted', 'Enrolled', 'Waitlisted', 'Denied', 'Withdrawn', 'Alumni']

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

function toGradeLabel(g: number | null) {
  if (g == null) return 'Unknown'
  if (g === -1) return 'Pre-K'
  if (g === 0) return 'Kindergarten'
  return `Grade ${g}`
}

function csvDownload(rows: StudentRow[], filename: string) {
  const cols = ['student_id', 'first_name', 'last_name', 'nationality', 'grade', 'status', 'campus', 'cohort', 'priority', 'application_date', 'enroll_date', 'parent', 'email', 'phone']
  const lines = [cols.join(',')]
  rows.forEach((r) => {
    const line = cols.map((k) => {
      const v = (r as unknown as Record<string, unknown>)[k] ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
    lines.push(line)
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function BarRows({ rows }: { rows: { label: string; value: number; color: string; sub?: string }[] }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{r.label}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: r.color }}>{r.value}{r.sub ? ` ${r.sub}` : ''}</span>
          </div>
          <div style={{ height: 8, background: '#F0F4F8', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((r.value / max) * 100)}%`, height: '100%', background: r.color, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Donut({ value, total, color }: { value: number; total: number; color: string }) {
  const p = pct(value, total)
  const size = 56
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  const dash = (circ * p) / 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EAF2" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={color}>{p}%</text>
    </svg>
  )
}

export function SettingsAnalyticsPage() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [settings, setSettings] = useState<SettingsRow | null>(null)
  const [loadError, setLoadError] = useState<string>('')

  useEffect(() => {
    async function load() {
      setLoadError('')
      const [{ data: studs, error: studsErr }, { data: att, error: attErr }, { data: fee, error: feeErr }, { data: ints, error: intErr }, { data: sett, error: settErr }] = await Promise.all([
        supabase.from('students').select('id,student_id,first_name,last_name,email,phone,nationality,grade,status,campus,cohort,priority,application_date,enroll_date,parent,created_at'),
        supabase.from('attendance').select('status'),
        supabase.from('fees').select('amount,paid'),
        supabase.from('interviews').select('score'),
        supabase.from('settings').select('enrollment_capacity').single(),
      ])
      const err = studsErr || attErr || feeErr || intErr || settErr
      if (err) setLoadError(err.message || 'Failed to load analytics data from Supabase')
      setStudents((studs as StudentRow[]) ?? [])
      setAttendance((att as AttendanceRow[]) ?? [])
      setFees((fee as FeeRow[]) ?? [])
      setInterviews((ints as InterviewRow[]) ?? [])
      setSettings((sett as SettingsRow) ?? null)
    }
    void load()
  }, [])

  const total = students.length
  const enrolled = students.filter(s => s.status === 'Enrolled').length
  const accepted = students.filter(s => s.status === 'Accepted' || s.status === 'Enrolled').length
  const denied = students.filter(s => s.status === 'Denied').length
  const waitlisted = students.filter(s => s.status === 'Waitlisted').length
  const capacity = settings?.enrollment_capacity ?? 500

  const byStatus = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      label: status,
      value: students.filter(s => s.status === status).length,
      color: STATUS_COLORS[status] ?? '#7A92B0',
      sub: status !== 'Inquiry' ? `(${pct(students.filter(s => s.status === status).length, Math.max(students.filter(s => s.status === 'Inquiry').length, 1))}% of inquiry)` : undefined,
    }))
  }, [students])

  const byBand = useMemo(() => {
    const g = (n: number | null) => n ?? 999
    const preK = students.filter(s => g(s.grade) <= 0).length
    const elem = students.filter(s => g(s.grade) >= 1 && g(s.grade) <= 5).length
    const middle = students.filter(s => g(s.grade) >= 6 && g(s.grade) <= 8).length
    const hs = students.filter(s => g(s.grade) >= 9 && g(s.grade) <= 12).length
    return [
      { label: 'Pre-K/K', value: preK, color: '#FAC600', sub: `(${pct(preK, total)}%)` },
      { label: 'Elementary', value: elem, color: '#0EA5E9', sub: `(${pct(elem, total)}%)` },
      { label: 'Middle', value: middle, color: '#7040CC', sub: `(${pct(middle, total)}%)` },
      { label: 'High School', value: hs, color: '#D61F31', sub: `(${pct(hs, total)}%)` },
    ]
  }, [students, total])

  const byCampus = useMemo(() => {
    const map = new Map<string, number>()
    students.forEach((s) => map.set(s.campus || 'Unknown', (map.get(s.campus || 'Unknown') ?? 0) + 1))
    return Array.from(map.entries()).map(([label, value], i) => ({ label, value, color: ['#1A365E', '#D61F31', '#1FD6C4', '#FAC600', '#7040CC', '#0EA5E9'][i % 6] }))
  }, [students])

  const topNationality = useMemo(() => {
    const map = new Map<string, number>()
    students.forEach((s) => map.set(s.nationality || 'Unknown', (map.get(s.nationality || 'Unknown') ?? 0) + 1))
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({ label, value, color: ['#1A365E', '#D61F31', '#1FD6C4', '#FAC600', '#7040CC', '#0EA5E9'][i % 6], sub: `(${pct(value, total)}%)` }))
  }, [students, total])

  const byPriority = useMemo(() => {
    const p = ['Urgent', 'High', 'Normal', 'Low']
    const col: Record<string, string> = { Urgent: '#D61F31', High: '#F5A623', Normal: '#1DBD6A', Low: '#7A92B0' }
    return p.map((x) => ({ label: x, value: students.filter(s => (s.priority || 'Normal') === x).length, color: col[x] }))
  }, [students])

  const docsComplete = useMemo(() => {
    return 0
  }, [])

  const interviewsScheduled = useMemo(() => {
    return interviews.length
  }, [interviews])

  const interviewsScored = useMemo(() => {
    return interviews.filter(i => i.score != null && !Number.isNaN(Number(i.score))).length
  }, [interviews])

  const monthlyTrend = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-US', { month: 'short' }) })
    }
    return months.map((m) => {
      const applied = students.filter(s => (s.application_date || s.created_at || '').slice(0, 7) === m.key).length
      const enr = students.filter(s => (s.application_date || s.created_at || '').slice(0, 7) === m.key && s.status === 'Enrolled').length
      return { ...m, applied, enrolled: enr }
    })
  }, [students])

  const attendanceTotal = attendance.length
  const attendancePresent = attendance.filter(a => ['Present', 'Late', 'Excused', 'P', 'R'].includes(a.status)).length
  const attendanceAbsent = attendance.filter(a => ['Absent', 'A'].includes(a.status)).length
  const attendanceRate = pct(attendancePresent, attendanceTotal)

  const feeBilled = fees.reduce((sum, f) => sum + (f.amount ?? 0), 0)
  const feePaid = fees.filter(f => f.paid).reduce((sum, f) => sum + (f.amount ?? 0), 0)
  const feeCollectionRate = pct(feePaid, feeBilled)
  const overdueCount = fees.filter(f => !f.paid).length

  const maxTrend = Math.max(...monthlyTrend.map(m => m.applied), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {loadError && (
        <div style={{ ...card, padding: 12, background: '#FFF0F1', borderColor: '#F5C2C7', color: '#D61F31', fontSize: 12, fontWeight: 700 }}>
          Could not load some analytics data from Supabase: {loadError}
        </div>
      )}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Settings Analytics</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Operational and admissions analytics dashboard</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px' }}>Total Students</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#1A365E', marginTop: 6 }}>{total}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px' }}>Acceptance Rate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Donut value={accepted} total={Math.max(total, 1)} color="#1DBD6A" />
            <div style={{ fontSize: 30, fontWeight: 900, color: '#1DBD6A' }}>{pct(accepted, Math.max(total, 1))}%</div>
          </div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px' }}>Enrollment Rate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Donut value={enrolled} total={Math.max(total, 1)} color="#0EA5E9" />
            <div style={{ fontSize: 30, fontWeight: 900, color: '#0EA5E9' }}>{pct(enrolled, Math.max(total, 1))}%</div>
          </div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px' }}>Capacity Used</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Donut value={enrolled} total={Math.max(capacity, 1)} color={pct(enrolled, Math.max(capacity, 1)) >= 90 ? '#D61F31' : pct(enrolled, Math.max(capacity, 1)) >= 70 ? '#F5A623' : '#1FD6C4'} />
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#1A365E' }}>{enrolled}/{capacity}</div>
              <div style={{ fontSize: 10, color: '#7A92B0' }}>seats filled</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>📊 Admissions Funnel</div>
          <BarRows rows={byStatus} />
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #E4EAF2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center', background: '#F7F9FC', borderRadius: 8, padding: 8 }}><div style={{ fontSize: 18, fontWeight: 800, color: '#1FD6C4' }}>{waitlisted}</div><div style={{ fontSize: 10, color: '#7A92B0' }}>Waitlisted</div></div>
            <div style={{ textAlign: 'center', background: '#F7F9FC', borderRadius: 8, padding: 8 }}><div style={{ fontSize: 18, fontWeight: 800, color: '#D61F31' }}>{denied}</div><div style={{ fontSize: 10, color: '#7A92B0' }}>Denied</div></div>
          </div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🎓 Students by Grade Band</div>
          <BarRows rows={byBand} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🏫 Enrollment by Campus</div>
          <BarRows rows={byCampus.map(c => ({ label: c.label, value: c.value, color: c.color }))} />
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>🌍 Nationality Diversity</div>
          <BarRows rows={topNationality.map(n => ({ label: n.label, value: n.value, color: n.color, sub: n.sub }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Priority</div>
          {byPriority.map(p => <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 11, color: '#3D5475' }}>{p.label}</span><span style={{ fontSize: 11, fontWeight: 800, color: p.color }}>{p.value}</span></div>)}
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Documents</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Donut value={docsComplete} total={Math.max(total, 1)} color={pct(docsComplete, Math.max(total, 1)) >= 80 ? '#1DBD6A' : pct(docsComplete, Math.max(total, 1)) >= 50 ? '#F5A623' : '#D61F31'} /></div>
          <div style={{ fontSize: 11, color: '#7A92B0', textAlign: 'center' }}>{docsComplete}/{total} complete files</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Interviews</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 11, color: '#3D5475' }}>Scheduled</span><span style={{ fontSize: 12, fontWeight: 800, color: '#F5A623' }}>{interviewsScheduled}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 11, color: '#3D5475' }}>Scored</span><span style={{ fontSize: 12, fontWeight: 800, color: '#1DBD6A' }}>{interviewsScored}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#3D5475' }}>Coverage</span><span style={{ fontSize: 12, fontWeight: 800, color: '#0EA5E9' }}>{pct(interviewsScored, Math.max(interviewsScheduled, 1))}%</span></div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Grade Snapshot</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {students.slice(0, 6).map(s => <div key={s.id} style={{ fontSize: 10, color: '#7A92B0' }}>{toGradeLabel(s.grade)}</div>)}
            {students.length === 0 && <div style={{ fontSize: 10, color: '#7A92B0' }}>No data</div>}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 14 }}>📈 Monthly Applications Trend (Last 12 Months)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 4 }}>
          {monthlyTrend.map((m) => {
            const pApplied = Math.round((m.applied / maxTrend) * 100)
            const pEnr = Math.round((m.enrolled / maxTrend) * 100)
            return (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#1A365E' }}>{m.applied}</div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 100, gap: 2 }}>
                  <div style={{ width: '100%', background: '#1A365E22', borderRadius: '3px 3px 0 0', height: `${pApplied}%`, minHeight: 2, position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#1DBD6A', borderRadius: '3px 3px 0 0', height: `${pEnr}%`, minHeight: m.enrolled ? 2 : 0 }} />
                  </div>
                </div>
                <div style={{ fontSize: 9, color: '#7A92B0', marginTop: 2 }}>{m.label}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#1A365E22' }} /><span style={{ fontSize: 10, color: '#7A92B0' }}>Applied</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#1DBD6A' }} /><span style={{ fontSize: 10, color: '#7A92B0' }}>Enrolled</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px' }}>Attendance Rate</div><div style={{ fontSize: 28, fontWeight: 900, color: attendanceRate >= 95 ? '#1DBD6A' : attendanceRate >= 90 ? '#F5A623' : '#D61F31', marginTop: 6 }}>{attendanceRate}%</div><div style={{ fontSize: 10, color: '#7A92B0' }}>{attendanceTotal} records</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px' }}>Absent Days</div><div style={{ fontSize: 28, fontWeight: 900, color: attendanceAbsent > 0 ? '#D61F31' : '#1DBD6A', marginTop: 6 }}>{attendanceAbsent}</div><div style={{ fontSize: 10, color: '#7A92B0' }}>of {attendanceTotal} total</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px' }}>Fee Collection</div><div style={{ fontSize: 28, fontWeight: 900, color: feeCollectionRate >= 90 ? '#1DBD6A' : feeCollectionRate >= 70 ? '#F5A623' : '#D61F31', marginTop: 6 }}>{feeCollectionRate}%</div><div style={{ fontSize: 10, color: '#7A92B0' }}>{fees.length} fee records</div></div>
        <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px' }}>Unpaid Fees</div><div style={{ fontSize: 28, fontWeight: 900, color: overdueCount > 0 ? '#D61F31' : '#1DBD6A', marginTop: 6 }}>{overdueCount}</div><div style={{ fontSize: 10, color: '#7A92B0' }}>pending payment</div></div>
      </div>

      <div style={{ ...card, padding: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 }}>📤 Export Reports</span>
        <button onClick={() => csvDownload(students, 'AWS_All_Students.csv')} style={{ padding: '7px 16px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ All Students CSV</button>
        <button onClick={() => csvDownload(students.filter(s => s.status === 'Enrolled'), 'AWS_Enrolled.csv')} style={{ padding: '7px 16px', background: '#0EA5E9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Enrolled CSV</button>
        <button onClick={() => csvDownload(students.filter(s => s.status === 'Applied' || s.status === 'Under Review'), 'AWS_Pending_Review.csv')} style={{ padding: '7px 16px', background: '#F5A623', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Pending Review CSV</button>
        <button onClick={() => csvDownload(students.filter(s => s.status === 'Waitlisted'), 'AWS_Waitlist.csv')} style={{ padding: '7px 16px', background: '#1FD6C4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Waitlist CSV</button>
      </div>
    </div>
  )
}
