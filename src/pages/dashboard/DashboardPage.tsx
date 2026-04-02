import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { type Student, type StudentStatus, STATUS_META, fullName } from '@/types/student'

// ─── helpers ─────────────────────────────────────────────────────────────────
function fromRow(row: Record<string, unknown>): Student {
  let ext: Record<string, unknown> = {}
  try { ext = JSON.parse((row.notes as string) || '{}') } catch { /* */ }
  return {
    id: row.id as string, studentId: row.student_id as string ?? '',
    firstName: row.first_name as string ?? '', lastName: row.last_name as string ?? '',
    dob: null, gender: null, nationality: row.nationality as string ?? null, lang: null,
    grade: row.grade as number ?? null, status: row.status as StudentStatus ?? 'Inquiry',
    campus: row.campus as string ?? null, cohort: row.cohort as string ?? null,
    studentType: (ext.studentType as Student['studentType']) ?? 'New',
    appDate: row.application_date as string ?? null,
    enrollDate: row.enroll_date as string ?? null,
    yearJoined: null, yearGraduated: null, gradeWhenJoined: null,
    priority: (row.priority as Student['priority']) ?? 'Normal',
    prevSchool: null, priorGpa: null, iep: null,
    email: null, phone: null, parent: null, relation: null,
    ecName: null, ecPhone: null, address: null, bloodGroup: null,
    allergy: null, meds: null, physician: null, physicianPhone: null, healthNotes: null,
    notes: null, counselorNotes: null, documents: [],
    intDate: null, intTime: null, intViewer: null, intScore: null,
    intNotes: null, intCommittee: null, decDate: null, decNotes: null,
    postSecondary: null, gradDistinction: null, alumniNotes: null,
    createdAt: row.created_at as string ?? '', updatedAt: row.updated_at as string ?? '',
  }
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2', boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon, color, bg }: {
  label: string; value: number; sub: string; icon: string; color: string; bg: string
}) {
  return (
    <div style={{ ...card, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginTop: 3 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#9EB3C8', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

function AttendanceRing({ pct, present, absent, notMarked }: {
  pct: number; present: number; absent: number; notMarked: number
}) {
  const r = 34
  const circ = 2 * Math.PI * r
  const fill = circ * (pct / 100)
  const color = pct >= 80 ? '#1DBD6A' : pct >= 60 ? '#F5A623' : '#D61F31'

  return (
    <div style={{ ...card, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
        Today's Attendance
      </div>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)', width: 80, height: 80 }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#E4EAF2" strokeWidth="8" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ - fill}`}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>{pct}%</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, fontWeight: 700 }}>
        <span style={{ color: '#1DBD6A' }}>✓ {present} present</span>
        <span style={{ color: '#D61F31' }}>✗ {absent} absent</span>
      </div>
      {notMarked > 0 && (
        <div style={{ fontSize: 10, color: '#F5A623', fontWeight: 600 }}>{notMarked} not marked</div>
      )}
    </div>
  )
}

function PipelineCard({ students }: { students: Student[] }) {
  const stages: StudentStatus[] = ['Inquiry', 'Applied', 'Under Review', 'Accepted', 'Enrolled']
  const counts = stages.map(st => students.filter(s => s.status === st).length)
  const max = Math.max(1, ...counts)

  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 24, height: 24, background: '#EEF3FF', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔁</span>
        Admissions Pipeline
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stages.map((st, i) => {
          const n = counts[i]
          const m = STATUS_META[st]
          const pct = Math.round((n / max) * 100)
          return (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 90, fontSize: 11, fontWeight: 700, color: '#3D5475', textAlign: 'right', flexShrink: 0 }}>{st}</div>
              <div style={{ flex: 1, background: '#F0F4FA', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, background: m.dot, height: '100%', borderRadius: 20, transition: 'width .5s ease' }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: m.tc, width: 30, textAlign: 'right' }}>{n}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const actions = [
    { icon: '📝', label: 'New Application', color: '#D61F31', bg: '#FFF0F1', fn: () => navigate('/students/applications') },
    { icon: '📅', label: 'Mark Attendance', color: '#059669', bg: '#F0FDF4', fn: () => navigate('/attendance') },
    { icon: '💳', label: 'Record Fee', color: '#0369A1', bg: '#EFF6FF', fn: () => navigate('/admissions/fees') },
    { icon: '💬', label: 'Log Communication', color: '#7C3AED', bg: '#F5F3FF', fn: () => navigate('/admissions/communications') },
    { icon: '🎤', label: 'Schedule Interview', color: '#B45309', bg: '#FEF3C7', fn: () => navigate('/admissions/interviews') },
  ]

  return (
    <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 24, height: 24, background: '#FFF0F1', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⚡</span>
        Quick Actions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.fn}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', border: '1.5px solid #F0F4FA',
              borderRadius: 10, background: a.bg, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: a.color,
              textAlign: 'left', width: '100%', transition: 'opacity .15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{a.icon}</span>
            {a.label}
            <span style={{ marginLeft: 'auto', opacity: 0.4 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function SnapshotCard({ notMarked, overdueFees, actionsNeeded, unscored, present, total }: {
  notMarked: number; overdueFees: number; actionsNeeded: number
  unscored: number; present: number; total: number
}) {
  const navigate = useNavigate()
  const items = [
    notMarked > 0 && { icon: '⏳', label: 'Attendance not marked', val: notMarked, color: '#F5A623', bg: '#FEF9EC', to: '/attendance' },
    overdueFees > 0 && { icon: '💳', label: 'Overdue fees', val: overdueFees, color: '#D61F31', bg: '#FFF0F1', to: '/admissions/fees' },
    actionsNeeded > 0 && { icon: '💬', label: 'Actions required', val: actionsNeeded, color: '#7C3AED', bg: '#F5F3FF', to: '/admissions/communications' },
    unscored > 0 && { icon: '🎤', label: 'Unscored interviews', val: unscored, color: '#0369A1', bg: '#EFF6FF', to: '/admissions/interviews' },
    { icon: '✅', label: 'Present today', val: `${present} / ${total}`, color: '#059669', bg: '#F0FDF4', to: '/attendance' },
  ].filter(Boolean) as { icon: string; label: string; val: number | string; color: string; bg: string; to: string }[]

  const alertCount = items.filter(i => i.color !== '#059669').length

  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 24, height: 24, background: '#FEF3C7', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔔</span>
        Today's Snapshot
        {alertCount > 0 && (
          <span style={{ marginLeft: 'auto', background: '#D61F31', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10 }}>
            {alertCount} alert{alertCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <div
            key={item.label}
            onClick={() => navigate(item.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: item.bg,
              borderRadius: 10, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A365E', flex: 1 }}>{item.label}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: item.color }}>{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentApplications({ students }: { students: Student[] }) {
  const navigate = useNavigate()
  const recent = [...students]
    .sort((a, b) => (b.appDate ?? '').localeCompare(a.appDate ?? ''))
    .slice(0, 5)

  function initials(s: Student) {
    return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase()
  }

  return (
    <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, background: '#EEF3FF', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>👤</span>
          Recent Applications
        </div>
        <button
          onClick={() => navigate('/students/applications')}
          style={{ background: 'none', border: 'none', color: '#D61F31', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          View all →
        </button>

      </div>

      {recent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#B0C4DE', fontSize: 12 }}>
          No applications yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recent.map(s => {
            const m = STATUS_META[s.status]
            return (
              <div
                key={s.id}
                onClick={() => navigate(`/students/360?id=${s.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#F7F9FC'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: m.bg, color: m.tc,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                }}>
                  {initials(s)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fullName(s)}
                  </div>
                  <div style={{ fontSize: 10, color: '#9EB3C8' }}>
                    {s.grade !== null ? `Grade ${s.grade}` : ''}{s.grade !== null && s.campus ? ' · ' : ''}{s.campus ?? ''}
                  </div>
                </div>
                <StatusBadge status={s.status} size="sm" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function DashboardPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<Record<string, { status: string }>>({})
  const [overdueFees, setOverdueFees] = useState(0)
  const [actionsNeeded, setActionsNeeded] = useState(0)
  const [unscored, setUnscored] = useState(0)
  const [academicYear, setAcademicYear] = useState('')
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const iso = todayISO()

  useEffect(() => {
    Promise.all([
      supabase.from('students').select('*'),
      supabase.from('attendance').select('student_id,status').eq('date', iso),
      supabase.from('fees').select('id').eq('paid', false).lt('due_date', iso),
      supabase.from('communications').select('id').in('outcome', ['Action Required', 'Follow-up Needed']),
      supabase.from('interviews').select('id').eq('status', 'Completed'),
      supabase.from('settings').select('academic_year').single(),
    ]).then(([sRes, aRes, fRes, cRes, iRes, settRes]) => {
      setStudents((sRes.data ?? []).map(fromRow))

      const attMap: Record<string, { status: string }> = {}
      ;(aRes.data ?? []).forEach((a: { student_id: string; status: string }) => {
        attMap[a.student_id] = { status: a.status }
      })
      setAttendance(attMap)

      setOverdueFees((fRes.data ?? []).length)
      setActionsNeeded((cRes.data ?? []).length)
      setUnscored((iRes.data ?? []).length)
      if (settRes.data?.academic_year) setAcademicYear(settRes.data.academic_year)
      setLoading(false)
    })
  }, [iso])

  // Computed stats
  const tot = students.length
  const enrolled = students.filter(s => s.status === 'Enrolled')
  const enr = enrolled.length
  const rev = students.filter(s => s.status === 'Under Review' || s.status === 'Applied').length
  const wl = students.filter(s => s.status === 'Waitlisted').length
  const acc = students.filter(s => s.status === 'Accepted').length
  const accRate = tot ? Math.round(((acc + enr) / tot) * 100) : 0

  const presentToday = enrolled.filter(s => {
    const a = attendance[s.id]
    return a && (a.status === 'P' || a.status === 'R' || a.status === 'Present' || a.status === 'Late')
  }).length
  const absentToday = enrolled.filter(s => {
    const a = attendance[s.id]
    return a && (a.status === 'A' || a.status === 'Absent')
  }).length
  const notMarked = enr - enrolled.filter(s => attendance[s.id]).length
  const attPct = enr ? Math.round((presentToday / enr) * 100) : 0

  const kpiChips = [
    { v: tot, l: 'Total', c: 'rgba(255,255,255,.9)' },
    { v: enr, l: 'Enrolled', c: '#1FD6C4' },
    { v: `${accRate}%`, l: 'Accept Rate', c: '#FAC600' },
    { v: rev, l: 'In Review', c: '#FFA040' },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg,#080F1E 0%,#0F2240 40%,#1A365E 75%,#6B1020 100%)',
        borderRadius: 18, overflow: 'hidden', position: 'relative', minHeight: 140,
      }}>
        {/* Decorative circles */}
        {([
          { top: '-50px', right: '-50px', width: '260px', height: '260px', background: 'rgba(255,255,255,.025)' },
          { bottom: '-70px', right: '160px', width: '200px', height: '200px', background: 'rgba(214,31,49,.1)' },
          { top: '30px', right: '220px', width: '90px', height: '90px', background: 'rgba(250,198,0,.06)' },
          { top: '-20px', left: '200px', width: '130px', height: '130px', background: 'rgba(30,213,196,.05)' },
        ] as React.CSSProperties[]).map((s, i) => (
          <div key={i} style={{ position: 'absolute', borderRadius: '50%', ...s }} />
        ))}

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', padding: '26px 30px', gap: 24, flexWrap: 'wrap' }}>
          {/* AWS Logo */}
          <img src="/Logo.png" alt="AWS" style={{ height: 68, width: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 12px rgba(0,0,0,.4))' }} />

          {/* Divider */}
          <div style={{ width: 1, height: 56, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 6 }}>
              Student Information System · K–12
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 4 }}>
              {getGreeting()}, Admissions Team
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>
              {dayName}, {dateStr}{academicYear ? ` · ${academicYear}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {['Innovation', 'Leadership', 'Integrity', 'Global Citizenship'].map(v => (
                <span key={v} style={{
                  fontSize: 9, fontWeight: 800, color: '#FAC600',
                  background: 'rgba(250,198,0,.12)',
                  border: '1px solid rgba(250,198,0,.25)',
                  padding: '3px 10px', borderRadius: 20, letterSpacing: '.6px',
                }}>
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
            {kpiChips.map(k => (
              <div key={k.l} style={{
                textAlign: 'center', padding: '12px 16px',
                background: 'rgba(255,255,255,.07)', borderRadius: 14,
                border: '1px solid rgba(255,255,255,.1)',
                backdropFilter: 'blur(4px)',
                minWidth: 70,
              }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.45)', marginTop: 3, letterSpacing: '.5px', textTransform: 'uppercase' }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 METRIC CARDS + ATTENDANCE RING ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        <MetricCard label="Applications" value={tot} sub="All time" icon="📋" color="#1A365E" bg="#EEF3FF" />
        <MetricCard label="Enrolled" value={enr} sub="Active students" icon="🎓" color="#0369A1" bg="#E0F2FE" />
        <MetricCard label="Pending Review" value={rev} sub="Awaiting decision" icon="⏳" color="#B45309" bg="#FEF3C7" />
        <MetricCard label="Waitlisted" value={wl} sub="On hold" icon="📋" color="#047857" bg="#D1FAE5" />
        <AttendanceRing pct={attPct} present={presentToday} absent={absentToday} notMarked={notMarked} />
      </div>

      {/* ── PIPELINE + QUICK ACTIONS ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
        <PipelineCard students={students} />
        <QuickActions />
      </div>

      {/* ── SNAPSHOT + RECENT APPLICATIONS ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SnapshotCard
          notMarked={notMarked}
          overdueFees={overdueFees}
          actionsNeeded={actionsNeeded}
          unscored={unscored}
          present={presentToday}
          total={enr}
        />
        <RecentApplications students={students} />
      </div>

    </div>
  )
}
