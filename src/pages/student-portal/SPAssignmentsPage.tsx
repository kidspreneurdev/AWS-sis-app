import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFile, downloadUrl } from '@/lib/uploadFile'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'

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
  const { readOnly } = usePortalReadOnly()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<Record<string, { note: string }>>({})
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({})

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
      setFormState(Object.fromEntries(mapped.map((item) => [item.assignment_id, { note: item.student_note ?? '' }])))
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

  if (!session) return null

  async function submitAssignment(assignmentId: string, currentStatus: string) {
    const pending = pendingFiles[assignmentId]
    if (!pending) return

    setSubmittingId(assignmentId)
    let fileUrl = ''
    try {
      const path = `assignments/${studentDbId}/${assignmentId}/${Date.now()}_${pending.name}`
      fileUrl = await uploadFile(path, pending)
    } catch (e) {
      console.error('Upload error:', e)
      alert('Upload failed: ' + (e instanceof Error ? e.message : String(e)))
      setSubmittingId(null)
      return
    }

    const payload = {
      assignment_id: assignmentId,
      student_id: studentDbId,
      status: currentStatus === 'Resubmit' ? 'Resubmitted' : 'Turned In',
      file_url: fileUrl,
      link_url: null,
      student_note: (formState[assignmentId]?.note ?? '').trim(),
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
      setFormState(Object.fromEntries(mapped.map((item) => [item.assignment_id, { note: item.student_note ?? '' }])))
    }
    setSubmittingId(null)
  }

  function setFormNote(assignmentId: string, value: string) {
    setFormState((prev) => ({
      ...prev,
      [assignmentId]: { note: value },
    }))
  }

  function setPendingFile(assignmentId: string, file: File) {
    setPendingFiles((prev) => ({ ...prev, [assignmentId]: file }))
  }

  // Group enriched assignments by subject
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
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'pending' | 'overdue' | 'submitted'>('all')

  const subjectAssignments = useMemo(() => {
    if (!selectedSubject) return []
    const list = bySubject.get(selectedSubject) ?? []
    if (subjectFilter === 'pending') return list.filter((a) => !['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus) && !a.overdue)
    if (subjectFilter === 'overdue') return list.filter((a) => a.overdue)
    if (subjectFilter === 'submitted') return list.filter((a) => ['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus))
    return list
  }, [selectedSubject, bySubject, subjectFilter])

  function renderAssignmentCard(assignment: typeof enriched[number]) {
    const submission = assignment.submission
    const meta = STATUS_META[assignment.displayStatus] ?? STATUS_META.Assigned
    const relative = getRelativeDueText(assignment.dueDate, assignment.rawStatus)
    const score = displayScore(submission?.score ?? null, assignment.maxScore)
    const note = formState[assignment.id]?.note ?? ''
    const pendingFile = pendingFiles[assignment.id] ?? null
    const canSubmit = !readOnly && (!['Turned In', 'Resubmitted'].includes(assignment.rawStatus) || assignment.rawStatus === 'Resubmit')

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
          <div style={{ padding: '8px 18px', background: '#F0FDF4', borderTop: '1px solid #BBF7D0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#0E6B3B' }}>Your submission:</span>
            {submission.file_url && <>
              <a href={submission.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0369A1', fontWeight: 700, textDecoration: 'none' }}>📎 View</a>
              <button onClick={() => void downloadUrl(submission.file_url!)} style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>⬇ Download</button>
            </>}
            {submission.link_url && <>
              <a href={submission.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0369A1', fontWeight: 700, textDecoration: 'none' }}>🔗 View</a>
              <button onClick={() => void downloadUrl(submission.link_url!)} style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>⬇ Download</button>
            </>}
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
                  📎 Upload Your Work
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${pendingFile ? SP_GREEN : '#CBD5E0'}`, background: pendingFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 12, color: pendingFile ? SP_GREEN : '#7A92B0', fontWeight: pendingFile ? 700 : 400 }}>
                  <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(assignment.id, f) }} />
                  {pendingFile ? `✅ ${pendingFile.name}` : '+ Choose file (PDF, image, doc…)'}
                </label>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 4 }}>
                  📝 Note to Teacher (optional)
                </label>
                <input
                  value={note}
                  onChange={(e) => setFormNote(assignment.id, e.target.value)}
                  placeholder="Any context or comments for your teacher..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: SP_NAVY, background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => submitAssignment(assignment.id, assignment.rawStatus)}
                disabled={submittingId === assignment.id || !pendingFile}
                style={{ padding: '11px 24px', background: SP_GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', fontFamily: 'Poppins,sans-serif', marginTop: 4, opacity: submittingId === assignment.id || !pendingFile ? 0.6 : 1 }}
              >
                {submittingId === assignment.id ? '⏳ Uploading & Submitting…' : '✅ Turn In Assignment'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Subject detail view ──────────────────────────────────────────────────
  if (selectedSubject) {
    const all = bySubject.get(selectedSubject) ?? []
    const pending = all.filter((a) => !['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus) && !a.overdue).length
    const overdue = all.filter((a) => a.overdue).length
    const submitted = all.filter((a) => ['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus)).length

    const filterBtns = [
      { key: 'all' as const, label: 'All', count: all.length, color: SP_NAVY },
      { key: 'pending' as const, label: 'Pending', count: pending, color: SP_BLUE },
      { key: 'overdue' as const, label: 'Overdue', count: overdue, color: SP_RED },
      { key: 'submitted' as const, label: 'Submitted', count: submitted, color: SP_GREEN },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Back + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { setSelectedSubject(null); setSubjectFilter('all') }}
            style={{ background: '#F0F4F8', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: SP_NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY }}>📚 {selectedSubject}</div>
            <div style={{ fontSize: 12, color: '#7A92B0' }}>{all.length} assignment{all.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filterBtns.map((btn) => {
            const active = subjectFilter === btn.key
            return (
              <button
                key={btn.key}
                onClick={() => setSubjectFilter(btn.key)}
                style={{ padding: '7px 16px', border: `1.5px solid ${active ? btn.color : '#E4EAF2'}`, background: active ? btn.color : '#fff', color: active ? '#fff' : '#3D5475', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {btn.label}
                <span style={{ background: active ? 'rgba(255,255,255,.25)' : '#F1F5F9', padding: '1px 7px', borderRadius: 10, fontSize: 10, marginLeft: 4 }}>{btn.count}</span>
              </button>
            )
          })}
        </div>

        {/* Assignment cards */}
        {subjectAssignments.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY }}>No assignments in this view.</div>
          </div>
        ) : (
          subjectAssignments.map(renderAssignmentCard)
        )}
      </div>
    )
  }

  // ─── Subject cards home view ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY }}>📝 My Assignments</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{counts.all} total · {counts.overdue} overdue · {counts.pending} pending</div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY }}>No assignments yet. Check back soon!</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {subjects.map((subject) => {
            const list = bySubject.get(subject) ?? []
            const pendingCount = list.filter((a) => !['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus) && !a.overdue).length
            const overdueCount = list.filter((a) => a.overdue).length
            const submittedCount = list.filter((a) => ['Turned In', 'Late', 'Resubmitted'].includes(a.rawStatus)).length
            const accentColor = overdueCount > 0 ? SP_RED : pendingCount > 0 ? SP_BLUE : SP_GREEN

            return (
              <div
                key={subject}
                onClick={() => { setSelectedSubject(subject); setSubjectFilter('all') }}
                style={{ ...card, padding: 0, overflow: 'hidden', borderTop: `4px solid ${accentColor}`, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(26,54,94,0.13)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(26,54,94,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
              >
                <div style={{ padding: '16px 18px 12px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: SP_NAVY, marginBottom: 4 }}>📚 {subject}</div>
                  <div style={{ fontSize: 12, color: '#7A92B0', marginBottom: 14 }}>{list.length} assignment{list.length !== 1 ? 's' : ''}</div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {overdueCount > 0 && (
                      <span style={{ background: '#FEE2E2', color: SP_RED, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        🚨 {overdueCount} Overdue
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        📋 {pendingCount} Pending
                      </span>
                    )}
                    {submittedCount > 0 && (
                      <span style={{ background: '#DCFCE7', color: SP_GREEN, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        ✅ {submittedCount} Submitted
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: '10px 18px', background: '#F7F9FC', borderTop: '1px solid #F0F4F8', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>View assignments →</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
