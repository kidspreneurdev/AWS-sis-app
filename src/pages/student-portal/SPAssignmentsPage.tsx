import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)',
  padding: 20,
}

const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'
const SP_GOLD = '#FAC600'
const SP_BLUE = '#0EA5E9'

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: 16,
  color: '#7A92B0',
  fontSize: 12,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  borderRadius: 10,
}

const STATUS_META: Record<string, { bg: string; color: string; icon: string; border: string }> = {
  'Turned In': { bg: '#DCFCE7', color: SP_GREEN, icon: '✅', border: SP_GREEN },
  Late: { bg: '#FEF3C7', color: SP_GOLD, icon: '⏰', border: SP_GOLD },
  Overdue: { bg: '#FEE2E2', color: SP_RED, icon: '🚨', border: SP_RED },
  Missing: { bg: '#FEE2E2', color: SP_RED, icon: '❌', border: SP_RED },
  Assigned: { bg: '#DBEAFE', color: '#1E40AF', icon: '📋', border: '#3B82F6' },
  Resubmit: { bg: '#FDF4FF', color: '#7C3AED', icon: '🔄', border: '#A855F7' },
  Resubmitted: { bg: '#F3E8FF', color: '#7C3AED', icon: '🟣', border: '#A855F7' },
}

interface AssignmentRow {
  id: string
  title: string
  type: string
  subject: string
  dueDate: string
  description: string
  cohort: string
  maxScore: number | null
}

interface SubmissionRow {
  id?: string
  assignment_id: string
  status: string
  submitted_date: string
  late_reason: string
  score: number | null
  teacher_note: string
  file_url: string
  link_url: string
  student_note: string
}

interface NoteRow {
  id: string
  subject: string
  note_text: string
  topic_tag: string
  correction_required: boolean
  date_logged: string
  visibility: string
}

interface CorrectionRow {
  id: string
  subject: string
  instructions: string
  status: string
  deadline: string
}

interface ReportRow {
  id: string
  week: string
  coach_note: string
}

interface AssessmentRow {
  id: string
  subject: string
  raw_score: number | null
  max_score: number | null
  feedback: string
  week_start: string
}

function getRelativeDueText(dueDate: string, status: string) {
  if (!dueDate) return { text: '', color: '#7A92B0', isOverdue: false }
  const today = new Date()
  const due = new Date(`${dueDate}T00:00:00`)
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diff = Math.ceil((due.getTime() - startToday) / 86400000)
  const isOverdue = diff < 0 && !['Turned In', 'Late', 'Resubmitted'].includes(status)
  if (isOverdue) return { text: `Overdue by ${Math.abs(diff)}d`, color: SP_RED, isOverdue: true }
  if (diff === 0) return { text: 'Due today!', color: SP_GOLD, isOverdue: false }
  if (diff === 1) return { text: 'Due tomorrow', color: SP_GOLD, isOverdue: false }
  return { text: `Due in ${diff}d`, color: SP_NAVY, isOverdue: false }
}

function displayScore(score: number | null, maxScore: number | null) {
  if (score === null || score === undefined) return null
  const pct = maxScore && maxScore > 0 ? Math.round((score / maxScore) * 100) : null
  const color = pct === null ? SP_NAVY : pct >= 90 ? SP_GREEN : pct >= 70 ? SP_GOLD : SP_RED
  return { pct, color }
}

export function SPAssignmentsPage() {
  const { session } = useStudentPortal()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [corrections, setCorrections] = useState<CorrectionRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'submitted'>('all')
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<Record<string, { link: string; note: string }>>({})

  const studentDbId = session?.dbId ?? ''
  const studentCohort = session?.cohort ?? ''

  useEffect(() => {
    if (!session) return

    // Load assignments independently so missing tables don't block it
    async function loadAssignments() {
      const { data, error } = await supabase
        .from('at_assignments')
        .select('id,title,type,subject,due_date,description,cohort,max_score')
        .order('due_date')
      if (error) { console.error('AT assignments load error:', error); return }
      if (!data) return
      const mapped = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        type: (row.type as string) ?? '',
        subject: (row.subject as string) ?? '',
        dueDate: (row.due_date as string) ?? '',
        description: (row.description as string) ?? '',
        cohort: (row.cohort as string) ?? '',
        maxScore: row.max_score == null ? null : Number(row.max_score),
      }))
      // Show assignments matching student's cohort, or with no cohort (global)
      setAssignments(mapped.filter(r => !r.cohort || r.cohort === studentCohort))
    }

    async function loadSubmissions() {
      const { data } = await supabase
        .from('at_submissions')
        .select('id,assignment_id,status,submitted_date,late_reason,score,teacher_note,file_url,link_url,student_note')
        .eq('student_id', studentDbId)
      if (!data) return
      const mapped = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        assignment_id: row.assignment_id as string,
        status: (row.status as string) ?? 'Assigned',
        submitted_date: (row.submitted_date as string) ?? '',
        late_reason: (row.late_reason as string) ?? '',
        score: row.score == null ? null : Number(row.score),
        teacher_note: (row.teacher_note as string) ?? '',
        file_url: (row.file_url as string) ?? '',
        link_url: (row.link_url as string) ?? '',
        student_note: (row.student_note as string) ?? '',
      }))
      setSubmissions(mapped)
      setFormState(Object.fromEntries(mapped.map((item) => [item.assignment_id, { link: item.link_url ?? '', note: item.student_note ?? '' }])))
    }

    async function loadExtras() {
      const [nts, corr, rep, assess] = await Promise.all([
        supabase.from('at_notes').select('id,subject,note_text,topic_tag,correction_required,date_logged,visibility').eq('student_id', studentDbId).order('date_logged', { ascending: false }),
        supabase.from('at_corrections').select('id,subject,instructions,status,deadline').eq('student_id', studentDbId).order('deadline', { ascending: true }),
        supabase.from('at_reports').select('id,week,coach_note').eq('student_id', studentDbId).order('week', { ascending: false }),
        supabase.from('at_assessments').select('id,subject,raw_score,max_score,feedback,week_start').eq('student_id', studentDbId).order('week_start', { ascending: false }),
      ])
      if (nts.data) setNotes(nts.data.map((row: Record<string, unknown>) => ({ id: row.id as string, subject: (row.subject as string) ?? '', note_text: (row.note_text as string) ?? '', topic_tag: (row.topic_tag as string) ?? '', correction_required: Boolean(row.correction_required), date_logged: (row.date_logged as string) ?? '', visibility: (row.visibility as string) ?? '' })))
      if (corr.data) setCorrections(corr.data.map((row: Record<string, unknown>) => ({ id: row.id as string, subject: (row.subject as string) ?? '', instructions: (row.instructions as string) ?? '', status: (row.status as string) ?? '', deadline: (row.deadline as string) ?? '' })))
      if (rep.data) setReports(rep.data.map((row: Record<string, unknown>) => ({ id: row.id as string, week: (row.week as string) ?? '', coach_note: (row.coach_note as string) ?? '' })))
      if (assess.data) setAssessments(assess.data.map((row: Record<string, unknown>) => ({ id: row.id as string, subject: (row.subject as string) ?? '', raw_score: row.raw_score == null ? null : Number(row.raw_score), max_score: row.max_score == null ? null : Number(row.max_score), feedback: (row.feedback as string) ?? '', week_start: (row.week_start as string) ?? '' })))
    }

    void loadAssignments()
    void loadSubmissions()
    void loadExtras()
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
      return {
        ...assignment,
        submission,
        rawStatus,
        displayStatus: overdue ? 'Overdue' : rawStatus,
        overdue,
      }
    })
  }, [assignments, submissionMap])

  const counts = useMemo(() => ({
    all: enriched.length,
    pending: enriched.filter((item) => !['Turned In', 'Late', 'Resubmitted'].includes(item.rawStatus) && !item.overdue).length,
    overdue: enriched.filter((item) => item.overdue).length,
    submitted: enriched.filter((item) => ['Turned In', 'Late', 'Resubmitted'].includes(item.rawStatus)).length,
  }), [enriched])

  const filtered = useMemo(() => {
    const list = [...enriched]
    if (filter === 'pending') return list.filter((item) => !['Turned In', 'Late', 'Resubmitted'].includes(item.rawStatus) && !item.overdue)
    if (filter === 'overdue') return list.filter((item) => item.overdue)
    if (filter === 'submitted') return list.filter((item) => ['Turned In', 'Late', 'Resubmitted'].includes(item.rawStatus))
    return list
  }, [enriched, filter])

  if (!session) return null

  async function submitAssignment(assignmentId: string, currentStatus: string) {
    const form = formState[assignmentId] ?? { link: '', note: '' }
    if (!form.link.trim()) return

    setSubmittingId(assignmentId)
    const normalizedLink = form.link.startsWith('http://') || form.link.startsWith('https://')
      ? form.link.trim()
      : `https://${form.link.trim()}`

    const payload = {
      assignment_id: assignmentId,
      student_id: studentDbId,
      status: currentStatus === 'Resubmit' ? 'Resubmitted' : 'Turned In',
      link_url: normalizedLink,
      student_note: form.note.trim(),
      submitted_date: new Date().toISOString().slice(0, 10),
    }

    const existing = submissionMap[assignmentId]
    let error
    if (existing?.id) {
      ({ error } = await supabase.from('at_submissions').update(payload).eq('id', existing.id))
    } else {
      ({ error } = await supabase.from('at_submissions').upsert(payload, { onConflict: 'assignment_id,student_id' }))
    }

    if (error) {
      console.error('Submit error:', error)
      alert('Failed to submit: ' + error.message)
      setSubmittingId(null)
      return
    }

    // Reload submissions from DB to get the real saved state
    const { data: freshSubs } = await supabase
      .from('at_submissions')
      .select('id,assignment_id,status,submitted_date,late_reason,score,teacher_note,file_url,link_url,student_note')
      .eq('student_id', studentDbId)
    if (freshSubs) {
      const mapped = freshSubs.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        assignment_id: row.assignment_id as string,
        status: (row.status as string) ?? 'Assigned',
        submitted_date: (row.submitted_date as string) ?? '',
        late_reason: (row.late_reason as string) ?? '',
        score: row.score == null ? null : Number(row.score),
        teacher_note: (row.teacher_note as string) ?? '',
        file_url: (row.file_url as string) ?? '',
        link_url: (row.link_url as string) ?? '',
        student_note: (row.student_note as string) ?? '',
      }))
      setSubmissions(mapped)
      setFormState(Object.fromEntries(mapped.map((item) => [item.assignment_id, { link: item.link_url ?? '', note: item.student_note ?? '' }])))
    }
    setSubmittingId(null)
  }

  function setFormValue(assignmentId: string, field: 'link' | 'note', value: string) {
    setFormState((prev) => ({
      ...prev,
      [assignmentId]: {
        link: prev[assignmentId]?.link ?? '',
        note: prev[assignmentId]?.note ?? '',
        [field]: value,
      },
    }))
  }

  const filterButtons = [
    { key: 'all' as const, label: 'All', count: counts.all, color: SP_NAVY },
    { key: 'pending' as const, label: 'Pending', count: counts.pending, color: SP_BLUE },
    { key: 'overdue' as const, label: 'Overdue', count: counts.overdue, color: SP_RED },
    { key: 'submitted' as const, label: 'Submitted', count: counts.submitted, color: SP_GREEN },
  ]

  const emptyMessages = {
    all: '🎉 No assignments yet. Check back soon!',
    pending: '✅ No pending assignments — you are all caught up!',
    overdue: '🎉 No overdue assignments!',
    submitted: '📝 No submitted assignments yet.',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY }}>📝 My Assignments</div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filterButtons.map((button) => {
          const active = filter === button.key
          return (
            <button
              key={button.key}
              onClick={() => setFilter(button.key)}
              style={{
                padding: '7px 16px',
                border: `1.5px solid ${active ? button.color : '#E4EAF2'}`,
                background: active ? button.color : '#fff',
                color: active ? '#fff' : '#3D5475',
                borderRadius: 9,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Poppins,sans-serif',
              }}
            >
              {button.label}
              <span style={{ background: active ? 'rgba(255,255,255,.25)' : '#F1F5F9', padding: '1px 7px', borderRadius: 10, fontSize: 10, marginLeft: 4 }}>
                {button.count}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY }}>{emptyMessages[filter]}</div>
        </div>
      ) : (
        filtered.map((assignment) => {
          const submission = assignment.submission
          const meta = STATUS_META[assignment.displayStatus] ?? STATUS_META.Assigned
          const relative = getRelativeDueText(assignment.dueDate, assignment.rawStatus)
          const score = displayScore(submission?.score ?? null, assignment.maxScore)
          const form = formState[assignment.id] ?? { link: submission?.link_url ?? '', note: submission?.student_note ?? '' }
          const canSubmit = !['Turned In', 'Resubmitted'].includes(assignment.rawStatus) || assignment.rawStatus === 'Resubmit'

          return (
            <div key={assignment.id} style={{ ...card, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${meta.border}` }}>
              <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: SP_NAVY }}>{assignment.title}</span>
                      <span style={{ background: meta.bg, color: meta.color, padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                        {meta.icon} {assignment.displayStatus}
                      </span>
                      {assignment.type && (
                        <span style={{ background: '#F7F9FC', color: '#7A92B0', padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>
                          {assignment.type}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {assignment.subject && <span style={{ fontSize: 11, color: '#7A92B0' }}>📚 {assignment.subject}</span>}
                      {assignment.maxScore != null && <span style={{ fontSize: 11, color: '#7A92B0' }}>📊 {assignment.maxScore} pts max</span>}
                      {assignment.dueDate && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: relative.color }}>
                          📅 {assignment.dueDate}{relative.text ? ` (${relative.text})` : ''}
                        </span>
                      )}
                    </div>
                    {assignment.description && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#3D5475', lineHeight: 1.6, background: '#F7F9FC', padding: '8px 12px', borderRadius: 7 }}>
                        {assignment.description}
                      </div>
                    )}
                  </div>

                  {score && (
                    <div style={{ textAlign: 'center', padding: '12px 18px', background: `${score.color}15`, borderRadius: 10, minWidth: 90, flexShrink: 0 }}>
                      <div style={{ fontSize: 26, fontWeight: 900, color: score.color }}>{submission?.score}</div>
                      <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>{assignment.maxScore ? `of ${assignment.maxScore}` : 'pts'}</div>
                      {score.pct !== null && <div style={{ fontSize: 12, fontWeight: 800, color: score.color }}>{score.pct}%</div>}
                    </div>
                  )}
                </div>
              </div>

              {submission?.teacher_note && (
                <div style={{ padding: '10px 18px', background: '#F0F9FF', borderTop: '1px solid #BAE6FD' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.5px' }}>💬 Teacher Feedback: </span>
                  <span style={{ fontSize: 12, color: '#0C4A6E' }}>{submission.teacher_note}</span>
                </div>
              )}

              {(submission?.file_url || submission?.link_url) && (
                <div style={{ padding: '8px 18px', background: '#F0FDF4', borderTop: '1px solid #BBF7D0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0E6B3B' }}>Your submission:</span>
                  {submission.file_url && <a href={submission.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0369A1', fontWeight: 700, textDecoration: 'none' }}>📎 View uploaded file</a>}
                  {submission.link_url && <a href={submission.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0369A1', fontWeight: 700, textDecoration: 'none' }}>🔗 View work link</a>}
                </div>
              )}

              {canSubmit && (
                <div style={{ padding: '14px 18px', borderTop: '2px dashed #E4EAF2', background: '#F7F9FC' }}>
                  {assignment.rawStatus === 'Resubmit' && (
                    <div style={{ background: '#FDF4FF', border: '1.5px solid #A855F7', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>🔄 Resubmission Requested</div>
                      <div style={{ fontSize: 11, color: '#6B21A8', marginTop: 3 }}>
                        Your teacher has reviewed your work and is asking for a revision. Check the feedback above, then resubmit below.
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>
                    {assignment.rawStatus === 'Resubmit' ? '🔄 Resubmit Your Work' : '📤 Turn In Your Work'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 4 }}>
                        🔗 Paste a Link (Google Doc, Slides, Drive folder, website…)
                      </label>
                      <input
                        value={form.link}
                        onChange={(event) => setFormValue(assignment.id, 'link', event.target.value)}
                        placeholder="https://docs.google.com/..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: SP_NAVY, background: '#fff' }}
                      />
                    </div>

                    <div style={{ padding: '10px 12px', background: '#FFFBEA', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
                      File upload is not configured in this Supabase portal yet. Use a share link for now so your work stays accessible.
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 4 }}>
                        📝 Note to Teacher (optional)
                      </label>
                      <input
                        value={form.note}
                        onChange={(event) => setFormValue(assignment.id, 'note', event.target.value)}
                        placeholder="Any context or comments for your teacher..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: SP_NAVY, background: '#fff' }}
                      />
                    </div>

                    <button
                      onClick={() => submitAssignment(assignment.id, assignment.rawStatus)}
                      disabled={submittingId === assignment.id || !form.link.trim()}
                      style={{ padding: '11px 24px', background: SP_GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: 'Poppins,sans-serif', marginTop: 4, opacity: submittingId === assignment.id || !form.link.trim() ? 0.6 : 1 }}
                    >
                      {submittingId === assignment.id ? '⏳ Submitting…' : '✅ Turn In Assignment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>📌 Class Notes & Feedback</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.length === 0 ? (
            <div style={emptyState}>No class notes or feedback are available from Supabase for this section yet.</div>
          ) : (
            notes.map((note) => {
              const needsCorrection = note.correction_required
              const borderColor = needsCorrection ? '#D97706' : '#E4EAF2'
              return (
                <div key={note.id} style={{ padding: '12px 14px', background: needsCorrection ? '#FFF7ED' : '#F7F9FC', border: `1px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    {needsCorrection && <span style={{ fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 5 }}>CORRECTION REQUIRED</span>}
                    {note.subject && <span style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0' }}>{note.subject}</span>}
                    {note.topic_tag && <span style={{ fontSize: 10, color: '#94A3B8' }}>· {note.topic_tag}</span>}
                    {note.date_logged && <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 'auto' }}>{note.date_logged}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: SP_NAVY, lineHeight: 1.6 }}>{note.note_text}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>✏️ My Corrections</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {corrections.length === 0 ? (
            <div style={emptyState}>No correction tasks are available from Supabase for this section yet.</div>
          ) : (
            corrections.map((correction) => {
              const done = correction.status === 'Verified Complete'
              const color = done ? SP_GREEN : correction.status === 'In Progress' ? '#D97706' : SP_RED
              return (
                <div key={correction.id} style={{ padding: '12px 14px', background: done ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${done ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {correction.subject && <span style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0' }}>{correction.subject}</span>}
                      <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}15`, padding: '2px 8px', borderRadius: 5 }}>{correction.status || 'Assigned'}</span>
                    </div>
                    {correction.deadline && <span style={{ fontSize: 9, color: '#94A3B8' }}>Due: {correction.deadline}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: SP_NAVY, lineHeight: 1.5 }}>{correction.instructions}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>📋 Weekly Coach Reports</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.length === 0 ? (
            <div style={emptyState}>No weekly coach reports are available from Supabase for this section yet.</div>
          ) : (
            reports.slice(0, 5).map((report) => (
              <div key={report.id} style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: SP_GREEN, marginBottom: 5 }}>Week of {report.week || '—'}</div>
                <div style={{ fontSize: 12, color: SP_NAVY, lineHeight: 1.6 }}>{report.coach_note || 'No note written.'}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>📊 Weekly Assessment Scores</div>
        {assessments.length === 0 ? (
          <div style={emptyState}>No weekly assessment scores are available from Supabase for this section yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
            {assessments.map((assessment) => {
              const pct = assessment.max_score && assessment.raw_score !== null ? Math.round((assessment.raw_score / assessment.max_score) * 100) : null
              const color = pct === null ? '#94A3B8' : pct >= 80 ? SP_GREEN : pct >= 60 ? SP_GOLD : SP_RED
              return (
                <div key={assessment.id} style={{ padding: 12, background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', marginBottom: 2 }}>{assessment.subject || ''}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginBottom: 5 }}>Week of {assessment.week_start || ''}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color }}>
                    {assessment.raw_score !== null ? assessment.raw_score : '—'}
                    {assessment.max_score ? <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/ {assessment.max_score}</span> : null}
                  </div>
                  {pct !== null && <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</div>}
                  {assessment.feedback && <div style={{ fontSize: 10, color: '#3D5475', marginTop: 4, fontStyle: 'italic' }}>{assessment.feedback}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
