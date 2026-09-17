import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, GraduationCap, BookOpen, FileText, ArrowRight, ClipboardList,
  CheckCircle2, Clock, Siren, XCircle, RefreshCw, CircleDot, CalendarDays, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { toLegacyStudentGradeValue } from '@/types/student'
import { K5GradesPage } from '@/pages/student-portal/K5GradesPage'
import { card, SP_NAVY, portalPrefix } from './gradesShared'

const STATUS_META: Record<string, { bg: string; color: string; icon: LucideIcon }> = {
  'Turned In': { bg: '#DCFCE7', color: '#1DBD6A', icon: CheckCircle2 },
  Late: { bg: '#FEF3C7', color: '#B45309', icon: Clock },
  Overdue: { bg: '#FEE2E2', color: '#D61F31', icon: Siren },
  Missing: { bg: '#FEE2E2', color: '#D61F31', icon: XCircle },
  Assigned: { bg: '#DBEAFE', color: '#1E40AF', icon: ClipboardList },
  Resubmit: { bg: '#FDF4FF', color: '#7C3AED', icon: RefreshCw },
  Resubmitted: { bg: '#F3E8FF', color: '#7C3AED', icon: CircleDot },
}

interface AssignmentRow {
  id: string
  title: string
  type: string
  subject: string
  dueDate: string
  cohort: string
  maxScore: number | null
}

interface SubmissionRow {
  assignment_id: string
  status: string
  submitted_date: string
  score: number | null
}

export function SPGradesPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])

  const studentDbId = session?.dbId ?? ''
  const studentCohort = session?.cohort ?? ''
  const gradeNum = session ? toLegacyStudentGradeValue(session.grade) : null

  useEffect(() => {
    if (!session) return

    async function loadAssignments() {
      const { data } = await supabase
        .from('at_assignments')
        .select('id,title,type,subject,due_date,cohort,max_score')
        .order('due_date')
      const mapped = ((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        type: (row.type as string) ?? '',
        subject: (row.subject as string) ?? '',
        dueDate: (row.due_date as string) ?? '',
        cohort: (row.cohort as string) ?? '',
        maxScore: row.max_score == null ? null : Number(row.max_score),
      }))
      setAssignments(mapped.filter((r) => !r.cohort || r.cohort === studentCohort))
    }

    async function loadSubmissions() {
      const { data } = await supabase
        .from('at_submissions')
        .select('assignment_id,status,submitted_date,score')
        .eq('student_id', studentDbId)
      setSubmissions(((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        assignment_id: row.assignment_id as string,
        status: (row.status as string) ?? 'Assigned',
        submitted_date: (row.submitted_date as string) ?? '',
        score: row.score == null ? null : Number(row.score),
      })))
    }

    void loadAssignments()
    void loadSubmissions()
  }, [session, studentCohort, studentDbId])

  const submissionMap = useMemo(
    () => Object.fromEntries(submissions.map((item) => [item.assignment_id, item])),
    [submissions],
  )

  const enriched = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    return assignments.map((assignment) => {
      const submission = submissionMap[assignment.id] ?? null
      const rawStatus = submission?.status ?? 'Assigned'
      const overdue = Boolean(assignment.dueDate && assignment.dueDate < todayIso && !['Turned In', 'Late', 'Resubmitted'].includes(rawStatus))
      return { ...assignment, submission, displayStatus: overdue ? 'Overdue' : rawStatus }
    })
  }, [assignments, submissionMap])

  const bySubject = useMemo(() => {
    const map = new Map<string, typeof enriched>()
    enriched.forEach((a) => {
      const key = a.subject || 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    })
    return map
  }, [enriched])

  const subjects = useMemo(() => Array.from(bySubject.keys()).sort(), [bySubject])

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const activeSubject = selectedSubject && subjects.includes(selectedSubject) ? selectedSubject : (subjects[0] ?? null)
  const activeRows = activeSubject ? (bySubject.get(activeSubject) ?? []) : []

  if (!session) return null

  if (gradeNum !== null && gradeNum <= 5) return <K5GradesPage />

  const navButtons: { key: string; label: string; icon: LucideIcon; color: string; path: string }[] = [
    { key: 'audit', label: 'Graduation Audit', icon: GraduationCap, color: '#1A365E', path: `${prefix}/grades/audit` },
    { key: 'courses', label: 'Course Records', icon: BookOpen, color: '#0A6B64', path: `${prefix}/grades/courses` },
    { key: 'report', label: 'Report Card', icon: FileText, color: '#A36CFF', path: `${prefix}/grades/report-card` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} /> My Grades</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {navButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => navigate(btn.path)}
            style={{
              ...card,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              borderLeft: `4px solid ${btn.color}`,
              fontFamily: 'Poppins,sans-serif',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(26,54,94,0.13)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(26,54,94,0.06)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: `${btn.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: btn.color, flexShrink: 0 }}>
                <btn.icon size={17} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY }}>{btn.label}</span>
            </span>
            <ArrowRight size={14} color="#94A3B8" />
          </button>
        ))}
      </div>

      {subjects.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#94A3B8' }}><CalendarDays size={32} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY }}>No graded coursework yet.</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4 }}>Your curriculum and grades will appear here once assignments are posted.</div>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <BookOpen size={15} color={SP_NAVY} />
            <span style={{ fontSize: 13, fontWeight: 700, color: SP_NAVY, flexShrink: 0 }}>Course</span>
            <select
              value={activeSubject ?? ''}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1.5px solid #E4EAF2',
                fontSize: 12.5,
                fontWeight: 700,
                color: SP_NAVY,
                background: '#fff',
                fontFamily: 'Poppins,sans-serif',
                cursor: 'pointer',
                minWidth: 220,
              }}
            >
              {subjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <span style={{ fontSize: 11, color: '#7A92B0' }}>{activeRows.length} item{activeRows.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#F7F9FC' }}>
                  {['Name', 'Due', 'Submitted', 'Status', 'Score'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 14px',
                        textAlign: i === 4 ? 'right' : 'left',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#7A92B0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => {
                  const meta = STATUS_META[row.displayStatus] ?? STATUS_META.Assigned
                  const score = row.submission?.score ?? null
                  return (
                    <tr key={row.id}>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', verticalAlign: 'top' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: SP_NAVY }}>{row.title}</div>
                        {row.type && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{row.type}</div>}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 12, color: '#3D5475', whiteSpace: 'nowrap' }}>
                        {row.dueDate || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 12, color: '#3D5475', whiteSpace: 'nowrap' }}>
                        {row.submission?.submitted_date || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8' }}>
                        <span style={{ background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <meta.icon size={10} /> {row.displayStatus}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 12.5, fontWeight: 800, color: SP_NAVY, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {score !== null ? `${score} / ${row.maxScore ?? '—'}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
