import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 13,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 6px rgba(26,54,94,.06)',
}

const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'
const SP_GOLD = '#FAC600'
const SP_PURPLE = '#A36CFF'
const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: 16,
  color: '#7A92B0',
  fontSize: 12,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  borderRadius: 10,
}

const motivations = [
  'Every expert was once a beginner. Keep building.',
  'Your portfolio is your proof of work. Make it count.',
  "Asia's first entrepreneurial school - you're making history.",
  'Small daily improvements lead to stunning results.',
  'Your ideas have the power to change the world.',
]

interface Assignment {
  id: string
  title: string
  subject: string
  dueDate: string
  status: string
}

interface Grade {
  subject: string
  grade: number
  term: string
}

interface Badge {
  name: string
  earned_at: string
}

interface AttendanceRow {
  status: string
}

interface FeeRow {
  amount: number
  paid: boolean
}

interface BlockRow {
  id: string
  day: string
  period: string
  time: string
  subject: string
  cohort: string
  room: string
}

interface CorrectionRow {
  id: string
  subject: string
  instructions: string
  status: string
  deadline: string
}

interface CoachReportRow {
  week: string
  coach_note: string
  generated_at: string
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function spCard(label: string, value: string, sub: string, color: string, icon: string) {
  return (
    <div key={label} style={{ ...card, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 8, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6 }}>{sub}</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function percentToGpa(avg: number) {
  if (avg >= 97) return 4
  if (avg >= 93) return 4
  if (avg >= 90) return 3.7
  if (avg >= 87) return 3.3
  if (avg >= 83) return 3
  if (avg >= 80) return 2.7
  if (avg >= 77) return 2.3
  if (avg >= 73) return 2
  if (avg >= 70) return 1.7
  if (avg >= 67) return 1.3
  if (avg >= 65) return 1
  return 0
}

function parseGradeLevel(value: string) {
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function SPDashboardPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [corrections, setCorrections] = useState<CorrectionRow[]>([])
  const [coachReport, setCoachReport] = useState<CoachReportRow | null>(null)

  if (!session) return null
  const studentSession = session

  useEffect(() => {
    async function load() {
      const [
        subRes,
        assignRes,
        gradesRes,
        badgesRes,
        attendanceRes,
        feesRes,
        blocksRes,
        correctionsRes,
        coachReportRes,
      ] = await Promise.all([
        supabase.from('at_submissions').select('assignment_id,status').eq('student_id', studentSession.dbId),
        supabase.from('at_assignments').select('id,title,subject,due_date').order('due_date'),
        supabase.from('grades').select('subject,grade,term').eq('student_id', studentSession.dbId),
        supabase.from('badge_awards').select('name,earned_at').eq('student_id', studentSession.dbId).order('earned_at', { ascending: false }).limit(8),
        supabase.from('attendance').select('status').eq('student_id', studentSession.dbId),
        supabase.from('fees').select('amount,paid').eq('student_id', studentSession.dbId),
        supabase.from('timetable_blocks').select('id,day,period,time,subject,cohort,room').eq('cohort', studentSession.cohort).order('created_at', { ascending: true }),
        supabase.from('at_corrections').select('id,subject,instructions,status,deadline').eq('student_id', studentSession.dbId).order('deadline', { ascending: true }),
        supabase.from('at_reports').select('week,coach_note,generated_at').eq('student_id', studentSession.dbId).order('generated_at', { ascending: false }).limit(1),
      ])

      const submissionMap = Object.fromEntries(
        ((subRes.data as Record<string, unknown>[] | null) ?? []).map((row) => [row.assignment_id as string, (row.status as string) ?? 'Assigned']),
      )

      const mappedAssignments = ((assignRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        subject: (row.subject as string) ?? '',
        dueDate: (row.due_date as string) ?? '',
        status: submissionMap[row.id as string] ?? 'Assigned',
      }))

      setAssignments(mappedAssignments)
      setGrades((((gradesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        subject: (row.subject as string) ?? '',
        grade: Number(row.grade ?? 0),
        term: (row.term as string) ?? '',
      }))))
      setBadges((((badgesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        name: (row.name as string) ?? '',
        earned_at: (row.earned_at as string) ?? '',
      }))))
      setAttendance((((attendanceRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        status: (row.status as string) ?? '',
      }))))
      setFees((((feesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        amount: Number(row.amount ?? 0),
        paid: Boolean(row.paid),
      }))))
      setBlocks((((blocksRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        day: (row.day as string) ?? '',
        period: (row.period as string) ?? '',
        time: (row.time as string) ?? '',
        subject: (row.subject as string) ?? '',
        cohort: (row.cohort as string) ?? '',
        room: (row.room as string) ?? '',
      }))))
      setCorrections((((correctionsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        subject: (row.subject as string) ?? '',
        instructions: (row.instructions as string) ?? '',
        status: (row.status as string) ?? '',
        deadline: (row.deadline as string) ?? '',
      }))))

      const latestReport = ((coachReportRes.data as Record<string, unknown>[] | null) ?? [])[0]
      setCoachReport(latestReport ? {
        week: (latestReport.week as string) ?? '',
        coach_note: (latestReport.coach_note as string) ?? '',
        generated_at: (latestReport.generated_at as string) ?? '',
      } : null)
    }

    void load()
  }, [studentSession])

  const greeting = getGreeting()
  const firstName = session?.fullName.split(' ')[0] ?? 'Student'
  const gradeLevel = parseGradeLevel(session?.grade ?? '')
  const isHS = gradeLevel !== null && gradeLevel >= 9
  const avgGrade = grades.length ? grades.reduce((sum, row) => sum + row.grade, 0) / grades.length : null
  const gpa = avgGrade !== null ? percentToGpa(avgGrade) : null
  const weightedGpa = gpa !== null ? Math.min(4, gpa + 0.2) : null
  const attPresent = attendance.filter((row) => row.status === 'Present').length
  const attRate = attendance.length ? Math.round((attPresent / attendance.length) * 100) : 0
  const outstandingFees = fees.filter((row) => !row.paid).reduce((sum, row) => sum + row.amount, 0)
  const todayIso = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const nowMs = now.getTime()

  const overdue = useMemo(() => (
    assignments
      .filter((row) => row.dueDate && row.dueDate < todayIso && row.status !== 'Turned In')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  ), [assignments, todayIso])

  const pending = useMemo(() => assignments.filter((row) => row.status !== 'Turned In'), [assignments])

  const upcomingDeadlines = useMemo(() => {
    const weekAhead = new Date()
    weekAhead.setDate(weekAhead.getDate() + 7)

    return assignments
      .filter((row) => {
        if (!row.dueDate || row.status === 'Turned In') return false
        const due = new Date(`${row.dueDate}T00:00:00`)
        return due >= new Date(`${todayIso}T00:00:00`) && due <= weekAhead
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
  }, [assignments, todayIso])

  const pendingCorrections = useMemo(() => (
    corrections.filter((row) => row.status === 'Assigned' || row.status === 'In Progress')
  ), [corrections])

  const todayBlocks = useMemo(() => {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    return blocks
      .filter((row) => row.day === day)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }, [blocks])

  const quickActions = [
    { icon: '📝', label: 'Submit Assignment', to: '/portal/assignments', color: SP_RED },
    { icon: '🎯', label: 'Update My Goals', to: '/portal/goals', color: SP_NAVY },
    { icon: '🗂️', label: 'Add to Portfolio', to: '/portal/portfolio', color: SP_PURPLE },
    { icon: '💚', label: 'Wellness Check-in', to: '/portal/wellness', color: SP_GREEN },
    { icon: '💡', label: 'Innovation Lab', to: '/portal/lab', color: SP_GOLD },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'linear-gradient(135deg,#080F1E 0%,#0F2240 40%,#1A365E 75%,#6B1020 100%)', borderRadius: 18, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.03)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Student Portal · 2025-2026
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {greeting}, {firstName}! 👋
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
            {session?.grade || ''}{session?.campus ? ` · ${session.campus}` : ''} · Student ID: {session?.studentId || '—'}
          </div>
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(250,198,0,.1)', borderRadius: 8, borderLeft: `3px solid ${SP_GOLD}` }}>
            <div style={{ fontSize: 11, color: SP_GOLD, fontStyle: 'italic' }}>
              "{motivations[new Date().getDay() % motivations.length]}"
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {spCard('Attendance', `${attRate}%`, 'This term', attRate >= 85 ? SP_GREEN : attRate >= 70 ? SP_GOLD : SP_RED, '📅')}
        {spCard('Pending', String(pending.length), 'assignments', pending.length > 0 ? SP_GOLD : SP_GREEN, '📝')}
        {isHS
          ? spCard('GPA', gpa !== null ? gpa.toFixed(2) : '—', weightedGpa !== null ? `Weighted: ${weightedGpa.toFixed(2)}` : 'Weighted: —', gpa !== null && gpa >= 3.5 ? SP_GREEN : gpa !== null && gpa >= 2.5 ? SP_GOLD : SP_RED, '🎓')
          : spCard('Term', '2025-26', 'Active', SP_NAVY, '📚')}
        {spCard('Fees Due', outstandingFees > 0 ? `$${outstandingFees.toLocaleString()}` : 'Clear', outstandingFees > 0 ? 'outstanding' : 'No outstanding fees', outstandingFees > 0 ? SP_RED : SP_GREEN, '💳')}
      </div>

      <div style={{ ...card, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY }}>📅 Today's Schedule</div>
            <div style={{ fontSize: 10, color: '#7A92B0' }}>{todayLabel()}</div>
          </div>
          {todayBlocks.length === 0 ? (
            <div style={emptyState}>No timetable data is available from Supabase for today's schedule yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayBlocks.map((row) => {
                const parts = row.time.split('–').map((part) => part.trim())
                const start = parts[0] ?? ''
                const end = parts[1] ?? ''
                const startMs = start ? new Date(`${todayIso}T${start}`).getTime() : 0
                const endMs = end ? new Date(`${todayIso}T${end}`).getTime() : 0
                const isNow = startMs && endMs ? nowMs >= startMs && nowMs < endMs : false
                const isPast = endMs ? nowMs >= endMs : false

                return (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isNow ? '#F0FDF4' : isPast ? '#F9FAFB' : '#fff', border: `1px solid ${isNow ? '#059669' : '#E4EAF2'}`, borderRadius: 8, borderLeft: `4px solid ${isNow ? '#059669' : SP_NAVY}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', minWidth: 86, flexShrink: 0 }}>{row.time || row.period}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{row.subject || 'Class'}</div>
                      {row.room && <div style={{ fontSize: 10, color: '#7A92B0' }}>📍 {row.room}</div>}
                    </div>
                    {isNow && <span style={{ fontSize: 9, fontWeight: 800, background: '#DCFCE7', color: '#059669', padding: '2px 8px', borderRadius: 5 }}>NOW</span>}
                    {isPast && <span style={{ fontSize: 9, color: '#94A3B8' }}>Done</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      <div style={{ background: overdue.length > 0 ? '#FFF0F1' : '#FFF7F7', borderLeft: `4px solid ${SP_RED}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: SP_RED, marginBottom: 6 }}>
            ⚠️ {overdue.length} Overdue Assignment{overdue.length > 1 ? 's' : ''}
          </div>
          {overdue.length === 0 ? (
            <div style={{ ...emptyState, textAlign: 'left', padding: 0, background: 'transparent', border: 'none' }}>
              No overdue assignment data is available from Supabase for this section yet.
            </div>
          ) : (
            overdue.slice(0, 3).map((row) => (
              <div key={row.id} style={{ fontSize: 11, color: '#3D5475', marginBottom: 3 }}>
                📝 {row.title} — Due {row.dueDate || '?'} · {row.subject || ''}
              </div>
            ))
          )}
        </div>

      <div style={{ background: '#F0FDF4', borderLeft: '4px solid #059669', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            📋 Latest Coach Report {coachReport?.week ? `· Week of ${coachReport.week}` : ''}
          </div>
          {coachReport?.coach_note ? (
            <div style={{ fontSize: 12, color: SP_NAVY, lineHeight: 1.6 }}>
              {coachReport.coach_note.slice(0, 200)}{coachReport.coach_note.length > 200 ? '…' : ''}
            </div>
          ) : (
            <div style={{ ...emptyState, textAlign: 'left', padding: 0, background: 'transparent', border: 'none' }}>
              No coach report data is available from Supabase for this section yet.
            </div>
          )}
        </div>

      <div style={{ background: '#FFF7ED', borderLeft: '4px solid #D97706', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
            ✏️ {pendingCorrections.length} Correction Task{pendingCorrections.length > 1 ? 's' : ''} Assigned
          </div>
          {pendingCorrections.length === 0 ? (
            <div style={{ ...emptyState, textAlign: 'left', padding: 0, background: 'transparent', border: 'none' }}>
              No correction-task data is available from Supabase for this section yet.
            </div>
          ) : (
            <>
              {pendingCorrections.slice(0, 3).map((row) => (
                <div key={row.id} style={{ fontSize: 11, color: '#3D5475', marginBottom: 3 }}>
                  · {row.subject || ''} — {row.instructions.slice(0, 60)}{row.instructions.length > 60 ? '…' : ''}{row.deadline ? ` (due ${row.deadline})` : ''}
                </div>
              ))}
              <button onClick={() => navigate('/portal/assignments')} style={{ marginTop: 6, fontSize: 10, color: '#D97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: 'Poppins,sans-serif', padding: 0 }}>
                View all →
              </button>
            </>
          )}
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>⏰ Upcoming Deadlines</div>
          {upcomingDeadlines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#7A92B0', fontSize: 12 }}>✅ No assignments due in the next 7 days</div>
          ) : (
            upcomingDeadlines.map((row) => {
              const due = new Date(`${row.dueDate}T00:00:00`)
              const daysLeft = Math.ceil((due.getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000)
              const color = daysLeft <= 1 ? SP_RED : daysLeft <= 3 ? SP_GOLD : SP_NAVY
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F4FA' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📝</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{row.title}</div>
                    <div style={{ fontSize: 10, color: '#7A92B0' }}>{row.subject || ''}</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color }}>
                    {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>⚡ Quick Actions</div>
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', marginBottom: 6, background: `${action.color}10`, border: `1.5px solid ${action.color}25`, borderRadius: 9, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
            >
              <span style={{ fontSize: 16 }}>{action.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: SP_NAVY }}>{action.label}</span>
              <span style={{ marginLeft: 'auto', color: '#7A92B0', fontSize: 12 }}>→</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: SP_NAVY }}>🏅 My Badges</div>
            <button onClick={() => navigate('/portal/badges')} style={{ fontSize: 11, color: SP_RED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
              View all →
            </button>
          </div>
          {badges.length === 0 ? (
            <div style={emptyState}>No badge data is available from Supabase for this section yet.</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {badges.slice(0, 4).map((badge) => (
                <div key={`${badge.name}-${badge.earned_at}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#F7F9FC', borderRadius: 20, border: '1px solid #E4EAF2' }}>
                  <span style={{ fontSize: 18 }}>🏅</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SP_NAVY }}>{badge.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
