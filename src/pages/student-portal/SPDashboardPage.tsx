import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import { toLegacyStudentGradeValue } from '@/types/student'
import { K5DashboardPage } from '@/pages/student-portal/K5DashboardPage'
import {
  card, SP_NAVY, SP_RED, SP_GREEN, SP_GOLD, SP_PURPLE, portalPrefix,
  calcGPA, calcWeightedGPA, gpaColor, attendanceRate, creditProgress, isOverdue,
  type CourseType,
} from '@/pages/student-portal/gradesShared'
import {
  ClipboardList, Target, FolderKanban, HeartPulse, Lightbulb,
  GraduationCap, CalendarDays, Radio, Book, MapPin, Link2,
  AlertTriangle, FileText, Pencil, Clock, CheckCircle2, Zap, Medal, ArrowRight,
  type LucideIcon,
} from 'lucide-react'

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: 16,
  color: '#7A92B0',
  fontSize: 16,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  borderRadius: 10,
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Assignment {
  id: string
  title: string
  subject: string
  dueDate: string
  status: string
}

interface CourseRow {
  grade_letter: string | null
  type: CourseType
  credits: number
  credits_earned: number
}

interface TransferRow {
  grade_letter: string | null
  type?: string | null
  credits: number
  status: string | null
}

interface Badge {
  name: string
  earned_at: string
}

interface AttendanceRow {
  status: string
}

interface BlockRow {
  id: string
  name: string
  day: string
  period: string
  time: string
  subject: string
  cohort: string
  room: string
  sessionType: string
  meetLink: string
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

function parseGradeLevel(value: string) {
  const match = value.match(/\d+/)
  if (!match) return null
  const n = Number.parseInt(match[0], 10)
  return Number.isNaN(n) ? null : n
}

function ProgressRing({ pct, color, size = 84, strokeWidth = 8, children }: { pct: number | null; color: string; size?: number; strokeWidth?: number; children: React.ReactNode }) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const dash = pct !== null ? (circumference * Math.min(100, Math.max(0, pct))) / 100 : 0
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4EAF2" strokeWidth={strokeWidth} />
        {pct !== null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

export function SPDashboardPage() {
  const { session } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [graduationCredits, setGraduationCredits] = useState<number | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [corrections, setCorrections] = useState<CorrectionRow[]>([])
  const [coachReport, setCoachReport] = useState<CoachReportRow | null>(null)
  const [blocksError, setBlocksError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const studentSession = session
    async function load() {
      const [
        subRes,
        assignRes,
        badgesRes,
        attendanceRes,
        blocksRes,
        correctionsRes,
        coachReportRes,
        coursesRes,
        transfersRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('at_submissions').select('assignment_id,status').eq('student_id', studentSession.dbId),
        supabase.from('at_assignments').select('id,title,subject,due_date').order('due_date'),
        supabase.from('badge_awards').select('name,earned_at').eq('student_id', studentSession.dbId).order('earned_at', { ascending: false }).limit(8),
        supabase.from('attendance').select('status').eq('student_id', studentSession.dbId),
        (() => {
          const orClauses = [`student_ids.cs.{${studentSession.dbId}}`]
          if (studentSession.cohort) orClauses.unshift(`cohort.eq."${studentSession.cohort}"`)
          return supabase
            .from('timetable_blocks')
            .select('id,name,day,period,time,subject,cohort,room,session_type,meet_link,student_ids')
            .or(orClauses.join(','))
            .order('created_at', { ascending: true })
        })(),
        supabase.from('at_corrections').select('id,subject,instructions,status,deadline').eq('student_id', studentSession.dbId).order('deadline', { ascending: true }),
        supabase.from('at_reports').select('week,coach_note,generated_at').eq('student_id', studentSession.dbId).order('generated_at', { ascending: false }).limit(1),
        supabase.from('courses').select('grade_letter,type,credits,credits_earned').eq('student_id', studentSession.dbId),
        supabase.from('transfer_credits').select('*').eq('student_id', studentSession.dbId),
        supabase.from('settings').select('graduation_credits').single(),
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
      setCourses((((coursesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        grade_letter: (row.grade_letter as string) ?? null,
        type: ((row.type as CourseType) ?? 'STD'),
        credits: Number(row.credits ?? 0),
        credits_earned: Number(row.credits_earned ?? row.credits ?? 0),
      }))))
      setTransfers((((transfersRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        grade_letter: (row.grade_letter as string) ?? null,
        type: (row.type as string) ?? null,
        credits: Number(row.credits ?? 0),
        status: (row.status as string) ?? null,
      }))))
      setGraduationCredits((settingsRes.data as Record<string, unknown> | null)?.graduation_credits != null
        ? Number((settingsRes.data as Record<string, unknown>).graduation_credits) : null)
      setBadges((((badgesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        name: (row.name as string) ?? '',
        earned_at: (row.earned_at as string) ?? '',
      }))))
      setAttendance((((attendanceRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        status: (row.status as string) ?? '',
      }))))
      setBlocksError(blocksRes.error?.message ?? null)
      setBlocks((((blocksRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        name: (row.name as string) ?? '',
        day: (row.day as string) ?? '',
        period: (row.period as string) ?? '',
        time: (row.time as string) ?? '',
        subject: (row.subject as string) ?? '',
        cohort: (row.cohort as string) ?? '',
        room: (row.room as string) ?? '',
        sessionType: (row.session_type as string) ?? 'Live Session',
        meetLink: (row.meet_link as string) ?? '',
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
  }, [session])

  const todayIso = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const nowMs = now.getTime()

  const overdue = useMemo(() => (
    assignments
      .filter((row) => isOverdue(row.dueDate, row.status, todayIso))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  ), [assignments, todayIso])

  const upcomingDeadlines = useMemo(() => {
    const weekAhead = new Date()
    weekAhead.setDate(weekAhead.getDate() + 7)

    return assignments
      .filter((row) => {
        if (!row.dueDate || row.status === 'Turned In' || isOverdue(row.dueDate, row.status, todayIso)) return false
        const due = new Date(`${row.dueDate}T00:00:00`)
        return due >= new Date(`${todayIso}T00:00:00`) && due <= weekAhead
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
  }, [assignments, todayIso])

  const pendingCorrections = useMemo(() => (
    corrections.filter((row) => row.status === 'Assigned' || row.status === 'In Progress')
  ), [corrections])

  const nextClass = useMemo(() => {
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date(now)
      d.setDate(d.getDate() + offset)
      const dayName = DAY_NAMES[d.getDay()]
      const dateIso = d.toISOString().slice(0, 10)
      const dayBlocks = blocks
        .filter((b) => b.day === dayName)
        .map((b) => {
          const parts = (b.time || '').split('–').map((p) => p.trim())
          const start = parts[0] ?? ''
          const end = parts[1] ?? ''
          const startMs = start ? new Date(`${dateIso}T${start}`).getTime() : null
          const endMs = end ? new Date(`${dateIso}T${end}`).getTime() : null
          return { ...b, startMs, endMs }
        })
        .filter((b) => b.endMs === null || b.endMs > nowMs)
        .sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))
      if (dayBlocks.length) {
        const first = dayBlocks[0]
        const isLive = first.startMs !== null && first.endMs !== null && nowMs >= first.startMs && nowMs < first.endMs
        return { ...first, isToday: offset === 0, isLive }
      }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, nowMs])

  const weekStrip = useMemo(() => (
    Array.from({ length: 7 }).map((_, offset) => {
      const d = new Date(now)
      d.setDate(d.getDate() + offset)
      const dayName = DAY_NAMES[d.getDay()]
      const count = blocks.filter((b) => b.day === dayName).length
      return {
        dateIso: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        count,
        isToday: offset === 0,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [blocks, nowMs])

  const quickActions: { icon: LucideIcon; label: string; to: string; color: string }[] = [
    { icon: ClipboardList, label: 'Submit Assignment', to: `${prefix}/assignments`, color: SP_RED },
    { icon: Target, label: 'Update My Goals', to: `${prefix}/goals`, color: SP_NAVY },
    { icon: FolderKanban, label: 'Add to Portfolio', to: `${prefix}/portfolio`, color: SP_PURPLE },
    { icon: HeartPulse, label: 'Wellness Check-in', to: `${prefix}/wellness`, color: SP_GREEN },
    { icon: Lightbulb, label: 'Innovation Lab', to: `${prefix}/lab`, color: SP_GOLD },
  ]

  type QueueItem = { id: string; icon: LucideIcon; color: string; bg: string; title: string; detail: string; sortKey: string; cta?: { label: string; to: string } }

  const queueItems = useMemo(() => {
    const items: QueueItem[] = []
    overdue.slice(0, 5).forEach((row) => {
      items.push({
        id: `ov-${row.id}`, icon: AlertTriangle, color: SP_RED, bg: '#FEE2E2',
        title: row.title, detail: `${row.subject ? `${row.subject} · ` : ''}Overdue since ${row.dueDate}`,
        sortKey: row.dueDate || '', cta: { label: 'Submit now', to: `${prefix}/assignments` },
      })
    })
    pendingCorrections.slice(0, 5).forEach((row) => {
      items.push({
        id: `co-${row.id}`, icon: Pencil, color: '#D97706', bg: '#FFF7ED',
        title: row.subject || 'Correction task',
        detail: row.instructions.slice(0, 80) + (row.instructions.length > 80 ? '…' : ''),
        sortKey: row.deadline || '9999-12-31', cta: { label: 'View', to: `${prefix}/assignments` },
      })
    })
    if (coachReport?.coach_note) {
      items.push({
        id: 'coach', icon: ClipboardList, color: '#059669', bg: '#F0FDF4',
        title: `Coach report${coachReport.week ? ` · Week of ${coachReport.week}` : ''}`,
        detail: coachReport.coach_note.slice(0, 120) + (coachReport.coach_note.length > 120 ? '…' : ''),
        sortKey: '9999-12-32',
      })
    }
    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [overdue, pendingCorrections, coachReport, prefix])

  if (!session) return null
  const gradeNum = toLegacyStudentGradeValue(session.grade)
  if (!readOnly && gradeNum !== null && gradeNum <= 5) return <K5DashboardPage />

  const gradeLevel = parseGradeLevel(session.grade)
  const isHS = gradeLevel !== null && gradeLevel >= 9

  const hasGradedCourses = courses.some((c) => c.grade_letter && c.grade_letter !== 'IP')
    || transfers.some((t) => t.status === 'Approved' && t.grade_letter)
  const uwGpa = hasGradedCourses ? calcGPA(courses, transfers) : null
  const wGpa = hasGradedCourses ? calcWeightedGPA(courses, transfers) : null
  const attRate = attendanceRate(attendance)
  const credit = isHS ? creditProgress(courses, transfers, graduationCredits) : null

  const ringMetrics: { key: string; label: string; pct: number | null; display: string; sub?: string; color: string }[] = [
    {
      key: 'attendance', label: 'Attendance', pct: attRate,
      display: attRate !== null ? `${attRate}%` : '—',
      color: attRate !== null ? (attRate >= 85 ? SP_GREEN : attRate >= 70 ? SP_GOLD : SP_RED) : '#94A3B8',
    },
  ]
  if (isHS) {
    ringMetrics.push({
      key: 'gpa', label: 'GPA', pct: uwGpa !== null ? Math.min(100, Math.round((uwGpa / 4) * 100)) : null,
      display: uwGpa !== null ? uwGpa.toFixed(2) : '—',
      sub: wGpa !== null ? `Weighted ${wGpa.toFixed(2)}` : undefined,
      color: uwGpa !== null ? gpaColor(uwGpa) : '#94A3B8',
    })
    if (credit) {
      ringMetrics.push({
        key: 'graduation', label: 'Graduation', pct: credit.pct, display: `${credit.pct}%`,
        color: credit.pct >= 100 ? SP_GREEN : SP_GOLD,
      })
      ringMetrics.push({
        key: 'credits', label: 'Credits', pct: credit.pct, display: `${credit.totalEarned}/${credit.required}`,
        color: credit.pct >= 100 ? SP_GREEN : SP_GOLD,
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {blocksError && (
        <div style={{ ...card, padding: '10px 16px', borderLeft: `4px solid ${SP_GOLD}`, fontSize: 15, color: '#7A92B0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={12} color={SP_GOLD} />
          We couldn't load your class schedule right now. Try refreshing, or check{' '}
          <button
            onClick={() => navigate(`${prefix}/timetable`)}
            style={{ background: 'none', border: 'none', padding: 0, color: SP_NAVY, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Poppins,sans-serif' }}
          >
            My Timetable
          </button>{' '}directly.
        </div>
      )}

      {/* Zone 1 — Progress / Next Class */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* Column 1 — Progress */}
        <div style={{ ...card, padding: 18, flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={13} /> Progress</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {ringMetrics.map((m) => (
              <div key={m.key} style={{ textAlign: 'center', minWidth: 68 }}>
                <ProgressRing pct={m.pct} color={m.color} size={66} strokeWidth={7}>
                  <span title={m.pct === null ? 'Not yet calculated' : undefined} style={{ fontSize: 15, fontWeight: 900, color: m.pct === null ? '#94A3B8' : m.color }}>{m.display}</span>
                </ProgressRing>
                <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY, marginTop: 7 }}>{m.label}</div>
                {m.sub && <div style={{ fontSize: 14, color: '#7A92B0', marginTop: 1 }}>{m.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2 — Next Class */}
        <div style={{ ...card, padding: 18, flex: 1, minWidth: 260, borderLeft: nextClass ? `4px solid ${nextClass.isLive ? SP_GREEN : SP_NAVY}` : undefined }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {nextClass?.sessionType === 'Live Session' ? <Radio size={13} /> : <Book size={13} />} Next Class
          </div>
          {nextClass ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: nextClass.isLive ? '#DCFCE7' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: nextClass.isLive ? SP_GREEN : SP_NAVY, flexShrink: 0 }}>
                  {nextClass.sessionType === 'Live Session' ? <Radio size={18} /> : <Book size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: nextClass.isLive ? SP_GREEN : '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {nextClass.isLive ? 'Live now' : nextClass.isToday ? 'Today' : nextClass.day}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: SP_NAVY }}>{nextClass.name || nextClass.subject || 'Class'}</div>
                </div>
              </div>
              <div style={{ fontSize: 15, color: '#7A92B0', display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <span>{nextClass.time || nextClass.period}</span>
                {nextClass.room && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {nextClass.room}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {nextClass.sessionType === 'Live Session' && nextClass.meetLink && (
                  <a
                    href={nextClass.meetLink} target="_blank" rel="noreferrer"
                    style={{ fontSize: 15, fontWeight: 800, background: nextClass.isLive ? SP_GREEN : '#E0F2FE', color: nextClass.isLive ? '#fff' : '#0369A1', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Link2 size={12} /> Join Now
                  </a>
                )}
                <button
                  onClick={() => navigate(`${prefix}/timetable`)}
                  style={{ fontSize: 15, color: '#7A92B0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  Full timetable <ArrowRight size={11} />
                </button>
              </div>
            </>
          ) : (
            <div style={emptyState}>No upcoming classes scheduled</div>
          )}
        </div>
      </div>

      {/* Zone 3 — Action Queue */}
      {queueItems.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={13} /> Needs Your Attention</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {queueItems.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: item.bg, borderRadius: 9 }}>
                <div style={{ color: item.color, flexShrink: 0 }}><item.icon size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: SP_NAVY }}>{item.title}</div>
                  <div style={{ fontSize: 15, color: '#7A92B0' }}>{item.detail}</div>
                </div>
                {item.cta && (
                  <button
                    onClick={() => navigate(item.cta!.to)}
                    style={{ fontSize: 15, fontWeight: 800, color: item.color, background: '#fff', border: `1.5px solid ${item.color}40`, borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {item.cta.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone 4 — Quick Actions / This Week & Upcoming Deadlines */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {/* Column 1 — Quick Actions */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={13} /> Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.to)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 10px', background: `${action.color}10`, border: `1.5px solid ${action.color}25`, borderRadius: 9, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                >
                  <span style={{ display: 'inline-flex', color: action.color }}><action.icon size={14} /></span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: SP_NAVY }}>{action.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#7A92B0', display: 'inline-flex' }}><ArrowRight size={11} /></span>
                </button>
              ))}
            </div>
          </div>

          {/* Column 2 — This Week + Upcoming Deadlines */}
          <div style={{ flex: 1.4, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={13} /> This Week</div>
              <button
                onClick={() => navigate(`${prefix}/timetable`)}
                style={{ fontSize: 15, color: '#7A92B0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                Full timetable <ArrowRight size={10} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {weekStrip.map((d) => (
                <div key={d.dateIso} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: d.isToday ? SP_NAVY : '#F7F9FC', border: `1px solid ${d.isToday ? SP_NAVY : '#E4EAF2'}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: d.isToday ? 'rgba(255,255,255,.7)' : '#94A3B8', textTransform: 'uppercase' }}>{d.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: d.isToday ? '#fff' : SP_NAVY, marginTop: 2 }}>{d.dayNum}</div>
                  {d.count > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: d.isToday ? SP_GOLD : SP_NAVY, marginTop: 2 }}>{d.count} class{d.count !== 1 ? 'es' : ''}</div>}
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={11} /> Upcoming Deadlines</div>
                <button
                  onClick={() => navigate(`${prefix}/assignments`)}
                  style={{ fontSize: 14, color: '#7A92B0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                >
                  View all <ArrowRight size={9} />
                </button>
              </div>
              {upcomingDeadlines.length === 0 ? (
                <div style={{ ...emptyState, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><CheckCircle2 size={11} /> Nothing due in the next 7 days</div>
              ) : (
                upcomingDeadlines.map((row) => {
                  const due = new Date(`${row.dueDate}T00:00:00`)
                  const daysLeft = Math.ceil((due.getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86400000)
                  const color = daysLeft <= 1 ? SP_RED : daysLeft <= 3 ? SP_GOLD : SP_NAVY
                  return (
                    <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F4FA' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}><FileText size={13} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: SP_NAVY }}>{row.title}</div>
                        <div style={{ fontSize: 14, color: '#7A92B0' }}>{row.subject || ''}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color, flexShrink: 0 }}>
                        {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F0F4F8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 5 }}><Medal size={11} /> My Badges</div>
            <button
              onClick={() => navigate(`${prefix}/badges`)}
              style={{ fontSize: 14, color: SP_RED, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            >
              View all <ArrowRight size={9} />
            </button>
          </div>
          {badges.length === 0 ? (
            <div style={{ fontSize: 15, color: '#94A3B8' }}>No badges earned yet.</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {badges.slice(0, 6).map((badge) => (
                <div key={`${badge.name}-${badge.earned_at}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#F7F9FC', borderRadius: 16, border: '1px solid #E4EAF2' }}>
                  <Medal size={14} color={SP_GOLD} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY }}>{badge.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
