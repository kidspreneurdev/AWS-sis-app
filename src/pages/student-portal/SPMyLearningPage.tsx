import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, Circle, Rabbit, Footprints, Turtle, Hourglass, ClipboardList,
  Check, Target, Timer, BookOpen, Scale, Calculator,
  Upload, Link2, Trophy, Flag, FileText, CalendarDays, Megaphone, FolderKanban,
  FolderOpen, PartyPopper, Frown, RefreshCw, X, Play, Video,
  ChevronDown, ChevronRight, Search,
  ArrowLeft, ArrowRight, Star, Lock, AlertTriangle, ExternalLink, Info,
  MessageSquare, Eye,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/uploadFile'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import { DiscussionBoard, type DiscussionPost } from '@/components/lms/DiscussionBoard'
import {
  SUBJECT_COLORS, isActiveBool, rowToLMSCourse, rowToLMSContent, rowToLMSEnrolment, rowToLMSProgress,
  type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress, type LMSQuestion,
} from '@/pages/lms/lmsStore'
import { portalPrefix } from './gradesShared'

import { ACTIVE_SCORE_COMPONENT_TYPES, getEffectiveRubric, finalGrade, DEFAULT_PRESENTATION_BRIEF, type ScoreComponentType, type RubricOverrides } from '@/lib/lms/caseStudyRubric'
import { toLegacyStudentGradeValue } from '@/types/student'
import { K5MyLearningPage } from '@/pages/student-portal/K5MyLearningPage'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 6px rgba(26,54,94,.06)' }
const emptyState: React.CSSProperties = { padding: '16px 18px', borderRadius: 10, background: '#F8FAFC', border: '1px dashed #D7E0EA', fontSize: 16, color: '#7A92B0' }
const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'

function getLessonTimerKey(studentId: string, lessonId: string) {
  return `sp_learning_started_${studentId}_${lessonId}`
}


function lessonElapsedMs(studentId: string | undefined, lessonId: string, openedAtMap: Record<string, number>) {
  const startedAt = studentId ? openedAtMap[lessonId] : undefined
  if (!startedAt) return 0
  return Math.max(0, Date.now() - startedAt)
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function paceMeta(progressPct: number, enrolment?: LMSEnrolment | null) {
  if (enrolment?.dueDate && enrolment.assignedAt) {
    const now = Date.now()
    const start = new Date(enrolment.assignedAt).getTime()
    const end = new Date(enrolment.dueDate).getTime()
    const totalDays = (end - start) / 86400000
    const daysPassed = (now - start) / 86400000
    const expectedPct = totalDays > 0 ? Math.min(100, Math.round((daysPassed / totalDays) * 100)) : 0
    const paceDiff = progressPct - expectedPct
    if (progressPct === 100) return { label: 'Complete', icon: CheckCircle2, color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (daysPassed < 0) return { label: 'Not Started', icon: Circle, color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
    if (paceDiff >= 10) return { label: 'Ahead of Pace', icon: Rabbit, color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (paceDiff >= -10) return { label: 'On Pace', icon: Footprints, color: '#2563EB', bg: '#DBEAFE', bucket: 'on' as const }
    return { label: 'Off Pace', icon: Turtle, color: SP_RED, bg: '#FEE2E2', bucket: 'off' as const }
  }
  if (progressPct === 100) return { label: 'Complete', icon: CheckCircle2, color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
  if (progressPct === 0) return { label: 'Not Started', icon: Circle, color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
  return { label: 'In Progress', icon: Hourglass, color: '#0891B2', bg: '#E0F2FE', bucket: 'on' as const }
}

function contentStatus(item: LMSContent, progress: LMSProgress | undefined, passMark: number) {
  const completed = progress?.status === 'completed'
  const masteryPassed = progress?.masteryPassed === true || progress?.masteryPassed === 'TRUE'
  const hasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
  const hasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
  const assignScore = progress?.assignScore != null && !Number.isNaN(Number(progress.assignScore)) ? Number(progress.assignScore) : null

  if (hasAssignment && assignScore !== null) {
    return {
      icon: ClipboardList as LucideIcon,
      text: `${assignScore}%`,
      color: assignScore >= passMark ? SP_GREEN : SP_RED,
    }
  }
  if (hasAssignment && progress?.assignStatus === 'submitted') {
    return { icon: ClipboardList as LucideIcon, text: 'Awaiting score', color: '#D97706' }
  }
  if (hasAssignment) {
    return { icon: ClipboardList as LucideIcon, text: 'Assignment due', color: '#64748B' }
  }
  if (hasMastery && masteryPassed) {
    return { icon: Check as LucideIcon, text: `Mastery${progress?.masteryScore != null ? ` · ${progress.masteryScore}%` : ''}`, color: SP_GREEN }
  }
  if (hasMastery) {
    return { icon: Target as LucideIcon, text: 'Mastery test', color: '#D97706' }
  }
  if (completed) {
    return { icon: CheckCircle2 as LucideIcon, text: 'Completed', color: SP_GREEN }
  }
  return null
}

// ─── Mastery Quiz ─────────────────────────────────────────────────────────────
function MasteryQuiz({ item, prog, studentId, coursePassMark, onUpdate }: {
  item: LMSContent
  prog: LMSProgress | undefined
  studentId: string
  coursePassMark: number
  onUpdate: (updates: Partial<LMSProgress>) => void
}) {
  const { readOnly } = usePortalReadOnly()
  const passMark = item.masteryPassMark ?? coursePassMark
  const maxRetakes = item.masteryRetakes ?? 999
  const timeLimitSecs = (item.masteryTimeLimit ?? 0) * 60

  let questions: LMSQuestion[] = []
  try { questions = JSON.parse(item.masteryQuizJson ?? item.quizJson ?? '[]') } catch { /* empty */ }

  const alreadyPassed = prog?.masteryPassed === true || prog?.masteryPassed === 'TRUE'
  const attempts = prog?.masteryAttempts ?? 0

  const [phase, setPhase] = useState<'quiz' | 'result'>(alreadyPassed ? 'result' : 'quiz')
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number | string>>({})
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(
    alreadyPassed && prog?.masteryScore != null ? { score: Number(prog.masteryScore), passed: true } : null,
  )
  const [timeLeft, setTimeLeft] = useState(timeLimitSecs)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!timeLimitSecs || phase !== 'quiz') return
    if (timeLeft <= 0) return
    const id = window.setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timeLimitSecs, phase, timeLeft])

  if (!questions.length) {
    return (
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 15, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Target size={12} /> No mastery questions have been configured for this lesson yet.
      </div>
    )
  }

  async function submitQuiz(ans: Record<number, number | string>) {
    const mcqQs = questions.filter((q) => q.type !== 'short' && q.opts?.length)
    let correct = 0
    mcqQs.forEach((q) => {
      const origIdx = questions.indexOf(q)
      if (ans[origIdx] === q.ans) correct++
    })
    const score = mcqQs.length > 0 ? Math.round((correct / mcqQs.length) * 100) : 100
    const passed = score >= passMark
    setSaving(true)
    const masteryPayload: Record<string, unknown> = {
      student_id: studentId,
      course_id: item.courseId,
      content_id: item.id,
      status: passed ? 'completed' : (prog?.status ?? 'in_progress'),
      mastery_score: score,
      mastery_passed: passed,
      mastery_attempts: attempts + 1,
    }
    if (prog?.id) masteryPayload.id = prog.id
    await supabase.from('lms_progress').upsert(masteryPayload, { onConflict: 'student_id,content_id' })
    try {
      const questionSnapshot = questions.map((q, qi) => ({
        q: q.q,
        type: q.type ?? (q.opts?.length ? 'mcq' : 'short'),
        opts: q.opts ?? [],
        ans: q.ans,
        studentAnswer: ans[qi] ?? null,
      }))
      await supabase.from('lms_submissions').insert({
        student_id: studentId,
        content_id: item.id,
        course_id: item.courseId,
        // Stored as JSON in note so existing schemas can persist quiz attempts without migration.
        note: JSON.stringify({
          kind: 'mastery_quiz',
          submittedAt: new Date().toISOString(),
          score,
          passed,
          attempt: attempts + 1,
          answers: ans,
          questions: questionSnapshot,
        }),
        link_url: null,
        submitted_at: new Date().toISOString(),
      })
    } catch {
      /* lms_submissions may not exist in all deployments */
    }
    setSaving(false)
    const newAttempts = attempts + 1
    setResult({ score, passed })
    setPhase('result')
    onUpdate({ masteryScore: score, masteryPassed: passed, masteryAttempts: newAttempts, status: passed ? 'completed' : prog?.status })
  }

  function retry() {
    setPhase('quiz')
    setQIdx(0)
    setAnswers({})
    setResult(null)
    setTimeLeft(timeLimitSecs)
  }

  const remainingRetakes = maxRetakes - attempts

  if (phase === 'result' && result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: result.passed ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#DC2626,#B91C1C)', borderRadius: 14, padding: '20px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#fff' }}>{result.passed ? <PartyPopper size={36} /> : <Frown size={36} />}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.passed ? 'Congratulations!' : 'Not quite there yet'}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
            {result.passed ? `You passed with ${result.score}%` : `You scored ${result.score}% — you need ${passMark}% to pass`}
          </div>
          {!result.passed && remainingRetakes > 0 && (
            <button onClick={retry} style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: 'none', borderRadius: 9, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} /> Try Again ({remainingRetakes} attempt{remainingRetakes !== 1 ? 's' : ''} left)</span>
            </button>
          )}
          {!result.passed && remainingRetakes <= 0 && (
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,.75)' }}>No more attempts remaining. Contact your teacher.</div>
          )}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 15, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={12} /> Answer Review</div>
          {questions.map((q, qi) => {
            const isShort = q.type === 'short' || !q.opts?.length
            const studentAns = answers[qi]
            const correct = !isShort && studentAns === q.ans
            return (
              <div key={qi} style={{ padding: '12px 14px', borderBottom: qi < questions.length - 1 ? '1px solid #F0F4FA' : 'none', background: isShort ? '#F7F9FC' : correct ? '#F0FDF4' : '#FFF7F7' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A365E', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isShort ? <FileText size={11} /> : correct ? <CheckCircle2 size={11} color="#059669" /> : <X size={11} color="#DC2626" />} Q{qi + 1}: {q.q}
                </div>
                {isShort ? (
                  <>
                    <div style={{ fontSize: 14, color: '#5A7290' }}>Short answer — teacher will review your response.</div>
                    {studentAns !== undefined && <div style={{ fontSize: 14, color: '#3D5475', marginTop: 4, padding: '5px 8px', background: '#F7F9FC', borderRadius: 6 }}><em>{String(studentAns)}</em></div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, color: correct ? '#059669' : '#DC2626', marginBottom: 3 }}>
                      Your answer: {studentAns !== undefined ? `${String.fromCharCode(65 + Number(studentAns))}. ${q.opts?.[Number(studentAns)] ?? ''}` : 'Not answered'}
                    </div>
                    {!correct && <div style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>Correct answer: {String.fromCharCode(65 + (q.ans ?? 0))}. {q.opts?.[q.ans ?? 0] ?? ''}</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const currentQ = questions[qIdx]
  const isLast = qIdx === questions.length - 1
  const isShort = currentQ.type === 'short' || !currentQ.opts?.length
  const timedOut = timeLimitSecs > 0 && timeLeft === 0

  return (
    <div style={{ background: '#F7F9FC', borderRadius: 13, padding: 20, border: '1px solid #E4EAF2' }}>
      {timeLimitSecs > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 10 }}>
          <Timer size={18} color="#92400E" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: timeLeft < 60 ? SP_RED : '#D97706', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      {timedOut && (
        <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 15, fontWeight: 700, color: SP_RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={12} /> Time's up! Please submit your answers.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#7A92B0' }}>Question {qIdx + 1} of {questions.length}</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: i === qIdx ? 20 : 8, height: 8, borderRadius: 4, background: i < qIdx ? '#059669' : i === qIdx ? '#1A365E' : '#E4EAF2', transition: 'all .3s' }} />
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', lineHeight: 1.6, marginBottom: 14 }}>{currentQ.q}</div>
        {isShort ? (
          <textarea
            rows={3}
            placeholder="Type your answer here..."
            value={String(answers[qIdx] ?? '')}
            onChange={(e) => setAnswers((p) => ({ ...p, [qIdx]: e.target.value }))}
            style={{ width: '100%', padding: 10, border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 16, fontFamily: 'Poppins,sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
          />
        ) : (
          currentQ.opts?.map((opt, oi) => {
            const selected = answers[qIdx] === oi
            return (
              <label
                key={oi}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 16, color: selected ? '#1A365E' : '#3D5475', marginBottom: 6, background: selected ? '#EEF3FF' : '#fff', border: `1.5px solid ${selected ? '#1A365E' : '#E4EAF2'}`, transition: 'all .15s' }}
                onClick={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))}
              >
                <input type="radio" name={`q_${qIdx}`} value={oi} checked={selected} onChange={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))} style={{ flexShrink: 0, accentColor: '#1A365E' }} readOnly />
                <span style={{ fontSize: 14, fontWeight: 800, color: '#7A92B0', background: '#F0F4FA', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
                <span>{opt}</span>
              </label>
            )
          })
        )}
      </div>
      <button
        onClick={isLast || timedOut ? () => void submitQuiz(answers) : () => setQIdx((p) => p + 1)}
        disabled={readOnly || saving || (!timedOut && answers[qIdx] === undefined)}
        title={readOnly ? 'View-only access' : undefined}
        style={{ width: '100%', padding: 11, background: saving ? '#94A3B8' : (answers[qIdx] !== undefined || timedOut) ? '#1A365E' : '#E4EAF2', color: (answers[qIdx] !== undefined || timedOut) ? '#fff' : '#94A3B8', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: readOnly || (answers[qIdx] === undefined && !timedOut) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: readOnly ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : readOnly ? 'View-only access' : (isLast || timedOut) ? `Submit Mastery Test (${questions.length} question${questions.length !== 1 ? 's' : ''})` : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Next Question <ArrowRight size={13} /></span>}
      </button>
    </div>
  )
}

// ─── Assignment Panel ──────────────────────────────────────────────────────────
async function studentPortalFetch(token: string | null, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token ?? ''}`, ...(opts.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || 'Request failed.')
  return body
}

function getCaseStudyEmbedUrl(url: string): string {
  if (url.includes('docs.google.com/presentation')) {
    const base = url.replace(/\/pub(\?.*)?$/, '').replace(/\/edit(\?.*)?$/, '').replace(/\/embed(\?.*)?$/, '')
    return base + '/embed?start=false&loop=false&rm=minimal'
  }
  const driveMatch = url.match(/\/file\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  return url
}

interface CSScoreData { componentType: string; criteriaScores: Record<string, number>; subtotal: number | null; feedback: string | null; status: 'not_scored' | 'scored' }
interface CSPostData {
  id: string; studentId: string | null; authorName: string; isStaff: boolean; isMine: boolean
  isAnnouncement: boolean; isPinned: boolean; isLocked: boolean
  title: string | null; body: string | null; deletedAt: string | null; edited: boolean
  parentPostId: string | null; createdAt: string
  attachmentUrl: string | null; attachmentFileName: string | null
  reactionCount: number; reactedByMe: boolean
}
interface CSAppealData { id: string; componentType: string; message: string; status: 'open' | 'resolved'; adminReply: string | null }
interface CaseStudyBundle {
  lesson: { id: string; title: string; caseStudyUrl: string | null; moduleDescription: string | null; omrFormUrl: string | null; socraticDate: string | null; socraticBrief: string | null; presentationBrief: string | null }
  scores: CSScoreData[]
  discussion: { myStudentId: string; posts: CSPostData[] }
  presentation: { note: string | null; linkUrl: string | null; submittedAt: string } | null
  appeals: CSAppealData[]
}

interface MySubmission { contentId: string; kind: string; note: string | null; linkUrl: string | null; submittedAt: string }

// A unit's content flattens into one row per "activity" — the case study (Learn It),
// each lesson (Do It), and the module's Show It / Prove It / Master It slots. The last
// four of those all live on the single hasAssignment carrier row, so a contentId alone
// can't tell them apart — activeGroupKind disambiguates which of the four is open.
type PartKind = 'tutorial' | 'video' | 'mastery' | 'lessonNotes' | 'caseStudyView' | 'caseStudyNotes' | 'socratic' | 'omr' | 'presentation' | 'discussion'
type ActivityGroupKind = 'learn' | 'lesson' | 'show' | 'prove' | 'master' | 'discussion'
interface ActivityGroupRef { key: string; kind: ActivityGroupKind; contentId: string }

/** Loads the fixed-flow score/appeal bundle for one module's case-study carrier item.
 *  Used by the Socratic/OMR/Presentation detail panels via useModuleScoring below. */
function useCaseStudyBundle(contentId: string | null) {
  const { getToken } = useStudentPortal()
  const [loading, setLoading] = useState(true)
  const [bundle, setBundle] = useState<CaseStudyBundle | null>(null)

  async function load() {
    if (!contentId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await studentPortalFetch(getToken(), `/api/student-portal/lms-get-case-study?contentId=${contentId}`)
      setBundle(data as CaseStudyBundle)
    } catch {
      setBundle(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [contentId]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  return { loading, bundle, refresh: load }
}

/** Show it: Notes — a real student upload, used both for the module's case-study notes
 *  ("Learn it") and each lesson's own notes ("Show it"). Ungraded — presence is enough. */
function NotesUploadRow({ contentId, kind, studentId, submission, onSubmitted }: {
  contentId: string
  kind: 'case_study_notes' | 'lesson_notes'
  studentId: string
  submission: MySubmission | undefined
  onSubmitted: (s: MySubmission) => void
}) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!file) return
    setSubmitting(true)
    try {
      const path = `lms/${studentId}/${contentId}/${Date.now()}_${file.name}`
      const fileUrl = await uploadFile(path, file)
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-notes', {
        method: 'POST', body: JSON.stringify({ contentId, kind, fileUrl, note: note.trim() || undefined }),
      })
      onSubmitted({ contentId, kind, note: note.trim() || null, linkUrl: fileUrl, submittedAt: new Date().toISOString() })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
    setSubmitting(false)
  }

  if (submission) {
    return (
      <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', border: '1px solid #BBF7D0' }}>
        <div style={{ fontSize: 15, color: '#059669', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Submitted {new Date(submission.submittedAt).toLocaleDateString()}</div>
        {submission.note && <div style={{ fontSize: 15, color: '#3D5475', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{submission.note}</div>}
        {submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 15, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> View your notes</a>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes for your teacher (optional)..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${file ? '#1DBD6A' : '#CBD5E0'}`, background: file ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 15, color: file ? '#1DBD6A' : '#7A92B0', fontWeight: file ? 700 : 400 }}>
        <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
        {file ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={12} /> {file.name}</span> : '+ Choose file (PDF, image…)'}
      </label>
      <button onClick={() => void submit()} disabled={readOnly || submitting || !file} style={{ padding: '9px 16px', background: file && !readOnly ? '#1A365E' : '#E4EAF2', color: file && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: file && !readOnly ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
        {submitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hourglass size={12} /> Uploading…</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Upload size={12} /> Submit Notes</span>}
      </button>
    </div>
  )
}

/** Case-study document viewer only — "Learn It › View case study". No fetch needed;
 *  caseStudyUrl is already on the carrier item from the course-wide content load. */
function CaseStudyDocPanel({ carrierItem }: { carrierItem: LMSContent }) {
  const caseStudyUrl = carrierItem.caseStudyUrl ?? null
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Explore the {carrierItem.title} case study</div>
      {caseStudyUrl ? (
        <>
          <div style={{ position: 'relative', paddingBottom: '65%', height: 0 }}>
            <iframe src={getCaseStudyEmbedUrl(caseStudyUrl)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} title="Case Study" loading="lazy" />
          </div>
          <div style={{ padding: '8px 16px', textAlign: 'right' }}>
            <a href={caseStudyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 15, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> Open in new tab</a>
          </div>
        </>
      ) : (
        <div style={{ padding: 20, color: '#94A3B8', fontSize: 16 }}>No case study document has been uploaded yet.</div>
      )}
    </div>
  )
}

/** Shared scoring/appeal plumbing for the Show It (Socratic), Prove It (OMR), and
 *  Master It (Presentation) detail pages — each is its own page now, but all three
 *  read from the same fixed-rubric bundle on the module's carrier item. */
function useModuleScoring(carrierItem: LMSContent) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  const { loading, bundle, refresh } = useCaseStudyBundle(carrierItem.id)
  const [appealOpenFor, setAppealOpenFor] = useState<string | null>(null)
  const [appealText, setAppealText] = useState<Record<string, string>>({})
  const [filingAppeal, setFilingAppeal] = useState<string | null>(null)

  async function fileAppeal(componentType: string) {
    const message = appealText[componentType] ?? ''
    if (!message.trim()) return
    setFilingAppeal(componentType)
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-file-appeal', {
        method: 'POST', body: JSON.stringify({ contentId: carrierItem.id, componentType, message: message.trim() }),
      })
      setAppealOpenFor(null)
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to file appeal.')
    }
    setFilingAppeal(null)
  }

  const scoreByType = bundle ? Object.fromEntries(bundle.scores.map((s) => [s.componentType, s])) as Record<string, CSScoreData | undefined> : {}
  const appealByType = bundle ? Object.fromEntries(bundle.appeals.map((a) => [a.componentType, a])) as Record<string, CSAppealData | undefined> : {}

  function renderAppealControl(type: ScoreComponentType) {
    const score = scoreByType[type]
    if (!score || score.status !== 'scored') return null
    return (
      <CSAppealControl
        appeal={appealByType[type]}
        isOpen={appealOpenFor === type}
        draftText={appealText[type] ?? ''}
        filing={filingAppeal === type}
        readOnly={readOnly}
        onOpen={() => setAppealOpenFor(type)}
        onCancel={() => setAppealOpenFor(null)}
        onDraftChange={(val) => setAppealText((p) => ({ ...p, [type]: val }))}
        onFile={() => void fileAppeal(type)}
      />
    )
  }

  return { loading, bundle, refresh, scoreByType, renderAppealControl }
}

/** Simple read-only rubric viewer — shows the fixed criteria/points for one score
 *  component so students know what they're graded on even before it's scored. Basic
 *  for now; may grow into something richer later. */
function RubricViewer({ type, overrides }: { type: ScoreComponentType; overrides: RubricOverrides | undefined }) {
  const cat = getEffectiveRubric(overrides, type)
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>Rubric — {cat.label} ({cat.weight} pts)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cat.criteria.map((c) => (
          <span key={c.key} style={{ fontSize: 15, fontWeight: 700, color: '#3D5475', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 6, padding: '4px 8px' }}>{c.label}: {c.max} pts</span>
        ))}
      </div>
    </div>
  )
}

/** Show It — Socratic Seminar: activity brief, rubric, and score. */
function SocraticPanel({ carrierItem }: { carrierItem: LMSContent }) {
  const { loading, bundle, scoreByType, renderAppealControl } = useModuleScoring(carrierItem)
  if (loading) return <div style={{ ...card, ...emptyState }}>Loading…</div>
  if (!bundle) return <div style={{ ...card, ...emptyState }}>Couldn't load this. Try refreshing.</div>
  return (
    <>
      {carrierItem.socraticBrief ? (
        <div style={{ ...card, padding: '14px 16px', fontSize: 16, color: '#3D5475', lineHeight: 1.6 }}>{carrierItem.socraticBrief}</div>
      ) : (
        <div style={{ ...card, ...emptyState }}>No activity description has been added yet.</div>
      )}
      {carrierItem.socraticDate && (
        <div style={{ fontSize: 15, fontWeight: 700, color: '#7A92B0', display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={11} /> Scheduled {carrierItem.socraticDate}</div>
      )}
      <RubricViewer type="debate" overrides={carrierItem.rubricOverrides} />
      <CSScoreBlock type="debate" overrides={carrierItem.rubricOverrides} icon={Scale} title="Socratic Seminar Score" order={1} score={scoreByType.debate} appealControl={renderAppealControl('debate')} />
    </>
  )
}

/** Prove It — OMR Test: an in-app auto-graded MCQ quiz, same shape/UX as a lesson's
 *  Mastery Test — but the score is read from/written to the case study's 'omr' rubric
 *  component (lms_score_components) instead of lms_progress, since it's one of the
 *  categories that feeds the module's overall grade. */
function OmrQuiz({ carrierItem, score, onSubmitted }: {
  carrierItem: LMSContent
  score: CSScoreData | undefined
  onSubmitted: () => void
}) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  const passMark = carrierItem.omrPassMark ?? 80
  const maxAttempts = carrierItem.omrRetakes ?? 3
  const timeLimitSecs = (carrierItem.omrTimeLimit ?? 0) * 60

  let questions: Array<{ q: string; opts: string[]; ans: number }> = []
  try { questions = JSON.parse(carrierItem.omrQuizJson ?? '[]') } catch { /* empty */ }

  const priorCorrect = score?.criteriaScores?.correct
  const priorTotal = score?.criteriaScores?.total
  const priorAttempts = score?.criteriaScores?.attempts ?? 0
  const priorPassed = score?.criteriaScores?.passed === 1
  const alreadyScored = score?.status === 'scored' && priorCorrect != null && priorTotal != null

  const [phase, setPhase] = useState<'quiz' | 'result'>(alreadyScored ? 'result' : 'quiz')
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [attemptsUsed, setAttemptsUsed] = useState(priorAttempts)
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(
    alreadyScored ? { score: Math.round((priorCorrect! / priorTotal!) * 100), passed: priorPassed, correct: priorCorrect!, total: priorTotal! } : null,
  )
  const [timeLeft, setTimeLeft] = useState(timeLimitSecs)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!timeLimitSecs || phase !== 'quiz') return
    if (timeLeft <= 0) return
    const id = window.setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timeLimitSecs, phase, timeLeft])

  if (!questions.length) {
    return (
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 15, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calculator size={12} /> No OMR questions have been configured for this module yet.
      </div>
    )
  }

  async function submitQuiz(ans: Record<number, number>) {
    setSaving(true)
    try {
      const data = await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-omr-quiz', {
        method: 'POST', body: JSON.stringify({ contentId: carrierItem.id, answers: ans }),
      }) as { score: number; correct: number; total: number; passed: boolean; attempts: number }
      setResult({ score: data.score, passed: data.passed, correct: data.correct, total: data.total })
      setAttemptsUsed(data.attempts)
      setPhase('result')
      onSubmitted()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    }
    setSaving(false)
  }

  function retry() {
    setPhase('quiz')
    setQIdx(0)
    setAnswers({})
    setResult(null)
    setTimeLeft(timeLimitSecs)
  }

  const remainingAttempts = maxAttempts - attemptsUsed

  if (phase === 'result' && result) {
    return (
      <div style={{ background: result.passed ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#DC2626,#B91C1C)', borderRadius: 14, padding: '20px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#fff' }}>{result.passed ? <PartyPopper size={36} /> : <Frown size={36} />}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.passed ? 'Congratulations!' : 'Not quite there yet'}</div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
          {result.passed ? `You passed with ${result.score}% (${result.correct}/${result.total} correct)` : `You scored ${result.score}% (${result.correct}/${result.total} correct) — you need ${passMark}% to pass`}
        </div>
        {!result.passed && remainingAttempts > 0 && (
          <button onClick={retry} style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: 'none', borderRadius: 9, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} /> Try Again ({remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} left)</span>
          </button>
        )}
        {!result.passed && remainingAttempts <= 0 && (
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.75)' }}>No more attempts remaining. Contact your teacher.</div>
        )}
      </div>
    )
  }

  const currentQ = questions[qIdx]
  const isLast = qIdx === questions.length - 1
  const timedOut = timeLimitSecs > 0 && timeLeft === 0

  return (
    <div style={{ background: '#F7F9FC', borderRadius: 13, padding: 20, border: '1px solid #E4EAF2' }}>
      {timeLimitSecs > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 10 }}>
          <Timer size={18} color="#92400E" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: timeLeft < 60 ? SP_RED : '#D97706', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      {timedOut && (
        <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 15, fontWeight: 700, color: SP_RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={12} /> Time's up! Please submit your answers.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#7A92B0' }}>Question {qIdx + 1} of {questions.length}</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: i === qIdx ? 20 : 8, height: 8, borderRadius: 4, background: i < qIdx ? '#059669' : i === qIdx ? '#1A365E' : '#E4EAF2', transition: 'all .3s' }} />
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', lineHeight: 1.6, marginBottom: 14 }}>{currentQ.q}</div>
        {currentQ.opts.map((opt, oi) => {
          const selected = answers[qIdx] === oi
          return (
            <label
              key={oi}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 16, color: selected ? '#1A365E' : '#3D5475', marginBottom: 6, background: selected ? '#EEF3FF' : '#fff', border: `1.5px solid ${selected ? '#1A365E' : '#E4EAF2'}`, transition: 'all .15s' }}
              onClick={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))}
            >
              <input type="radio" name={`omr_q_${qIdx}`} value={oi} checked={selected} onChange={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))} style={{ flexShrink: 0, accentColor: '#1A365E' }} readOnly />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#7A92B0', background: '#F0F4FA', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </label>
          )
        })}
      </div>
      <button
        onClick={isLast || timedOut ? () => void submitQuiz(answers) : () => setQIdx((p) => p + 1)}
        disabled={readOnly || saving || (!timedOut && answers[qIdx] === undefined)}
        title={readOnly ? 'View-only access' : undefined}
        style={{ width: '100%', padding: 11, background: saving ? '#94A3B8' : (answers[qIdx] !== undefined || timedOut) ? '#1A365E' : '#E4EAF2', color: (answers[qIdx] !== undefined || timedOut) ? '#fff' : '#94A3B8', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: readOnly || (answers[qIdx] === undefined && !timedOut) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: readOnly ? 0.5 : 1 }}
      >
        {saving ? 'Saving…' : readOnly ? 'View-only access' : (isLast || timedOut) ? `Submit OMR Test (${questions.length} question${questions.length !== 1 ? 's' : ''})` : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Next Question <ArrowRight size={13} /></span>}
      </button>
    </div>
  )
}

/** Prove It — OMR Test. */
function OmrPanel({ carrierItem }: { carrierItem: LMSContent }) {
  const { loading, bundle, refresh, scoreByType } = useModuleScoring(carrierItem)
  if (loading) return <div style={{ ...card, ...emptyState }}>Loading…</div>
  if (!bundle) return <div style={{ ...card, ...emptyState }}>Couldn't load this. Try refreshing.</div>
  return <OmrQuiz carrierItem={carrierItem} score={scoreByType.omr} onSubmitted={() => void refresh()} />
}

/** Master It — final presentation upload + score, plus the module's overall grade
 *  (computed across Notes / Socratic / OMR / Presentation — Discussion is parked). */
function PresentationPanel({ carrierItem, studentId }: { carrierItem: LMSContent; studentId: string }) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  // renderAppealControl is unused while the presentation rubric/score block below is
  // commented out — re-destructure it when that block is restored.
  const { loading, bundle, refresh, scoreByType } = useModuleScoring(carrierItem)
  const [presFile, setPresFile] = useState<File | null>(null)
  const [presNote, setPresNote] = useState('')
  const [presSubmitting, setPresSubmitting] = useState(false)

  async function submitPresentation() {
    if (!presFile) return
    setPresSubmitting(true)
    try {
      const path = `lms/${studentId}/${carrierItem.id}/${Date.now()}_${presFile.name}`
      const fileUrl = await uploadFile(path, presFile)
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-presentation', {
        method: 'POST', body: JSON.stringify({ contentId: carrierItem.id, fileUrl, note: presNote.trim() || undefined }),
      })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
    setPresSubmitting(false)
  }

  if (loading) return <div style={{ ...card, ...emptyState }}>Loading…</div>
  if (!bundle) return <div style={{ ...card, ...emptyState }}>Couldn't load this. Try refreshing.</div>

  const subtotalsByType = Object.fromEntries(ACTIVE_SCORE_COMPONENT_TYPES.map((t) => [t, scoreByType[t]?.status === 'scored' ? scoreByType[t]!.subtotal : null])) as Partial<Record<ScoreComponentType, number | null>>
  const overallFinalGrade = finalGrade(subtotalsByType)

  const videoYtMatch = carrierItem.presentationVideoUrl && !carrierItem.presentationVideoFileName
    ? carrierItem.presentationVideoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
    : null

  return (
    <>
      <div style={{ ...card, padding: '14px 16px', fontSize: 16, color: '#3D5475', lineHeight: 1.6 }}>{carrierItem.presentationBrief || DEFAULT_PRESENTATION_BRIEF}</div>
      {carrierItem.presentationBriefUrl && (
        <a href={carrierItem.presentationBriefUrl} target="_blank" rel="noreferrer" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <FileText size={18} color="#1A365E" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Assignment Brief</div>
            <div style={{ fontSize: 13, color: '#7A92B0' }}>{carrierItem.presentationBriefFileName || 'View the presentation brief'}</div>
          </div>
          <ExternalLink size={14} color="#7A92B0" />
        </a>
      )}
      {carrierItem.presentationVideoUrl && (
        <div style={{ ...card, padding: '14px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Video size={13} /> Video Explaining What's Due</div>
          {carrierItem.presentationVideoFileName ? (
            <video controls src={carrierItem.presentationVideoUrl} style={{ width: '100%', borderRadius: 10, background: '#000', display: 'block' }} />
          ) : videoYtMatch ? (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 10 }}>
              <iframe src={`https://www.youtube.com/embed/${videoYtMatch[1]}?rel=0&modestbranding=1`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} title="Video explaining what's due" loading="lazy" allowFullScreen />
            </div>
          ) : (
            <iframe src={carrierItem.presentationVideoUrl} style={{ width: '100%', height: 400, border: '1.5px solid #E4EAF2', borderRadius: 10 }} title="Video explaining what's due" loading="lazy" allowFullScreen />
          )}
        </div>
      )}
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={13} /> Submit Final Presentation</div>
        {bundle.presentation ? (
          <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 15, color: '#059669', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Submitted {new Date(bundle.presentation.submittedAt).toLocaleDateString()}</div>
            {bundle.presentation.note && <div style={{ fontSize: 15, color: '#3D5475', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{bundle.presentation.note}</div>}
            {bundle.presentation.linkUrl && <a href={bundle.presentation.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 15, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> View your presentation</a>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea rows={2} value={presNote} onChange={(e) => setPresNote(e.target.value)} placeholder="Notes for your teacher (optional)..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${presFile ? '#1DBD6A' : '#CBD5E0'}`, background: presFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 15, color: presFile ? '#1DBD6A' : '#7A92B0', fontWeight: presFile ? 700 : 400 }}>
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPresFile(f) }} />
              {presFile ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={12} /> {presFile.name}</span> : '+ Choose file (PDF, PPT…)'}
            </label>
            <button onClick={() => void submitPresentation()} disabled={readOnly || presSubmitting || !presFile} style={{ padding: '9px 16px', background: presFile && !readOnly ? '#1A365E' : '#E4EAF2', color: presFile && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: presFile && !readOnly ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
              {presSubmitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hourglass size={12} /> Uploading…</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Upload size={12} /> Submit Presentation</span>}
            </button>
          </div>
        )}
      </div>

      {/* Presentation rubric/score — temporarily disabled; grading happens on paper via the
          Rubric PDF below until this is re-enabled. Restore by uncommenting this line. */}
      {/* <CSScoreBlock type="presentation" overrides={carrierItem.rubricOverrides} icon={Trophy} title="Presentation Score" order={3} score={scoreByType.presentation} appealControl={renderAppealControl('presentation')} /> */}

      <a href="/LMS/Presentation Content Guide.pdf" target="_blank" rel="noreferrer" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <FileText size={18} color="#1A365E" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Presentation Content Guide</div>
          <div style={{ fontSize: 13, color: '#7A92B0' }}>How to structure and prepare your presentation</div>
        </div>
        <ExternalLink size={14} color="#7A92B0" />
      </a>
      <a href="/LMS/Presentation Rubric.pdf" target="_blank" rel="noreferrer" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <Trophy size={18} color="#1A365E" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Presentation Rubric</div>
          <div style={{ fontSize: 13, color: '#7A92B0' }}>How your presentation will be graded</div>
        </div>
        <ExternalLink size={14} color="#7A92B0" />
      </a>

      <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#5A7290' }}>Module Final Grade</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: overallFinalGrade !== null ? (overallFinalGrade >= 70 ? '#059669' : SP_RED) : '#94A3B8' }}>{overallFinalGrade !== null ? `${overallFinalGrade}/100` : '—'}</span>
      </div>
    </>
  )
}

/** Master It — Discussion Board. Top-level posts are discussion topics; replies hang one
 *  level deep off a topic (matching the schema — no deeper nesting in this pass). Staff
 *  post/pin/lock/moderate from the admin LMS page (LMSPage.tsx's DiscussionBoardModal);
 *  students get create/reply/edit/delete own/like here. Both surfaces render the shared
 *  <DiscussionBoard> component — this wrapper just adapts this page's data source
 *  (useCaseStudyBundle + the student-portal API broker) to its props. */
function DiscussionBoardPanel({ carrierItem, studentId }: { carrierItem: LMSContent; studentId: string }) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  const { loading, bundle, refresh } = useCaseStudyBundle(carrierItem.id)
  const [busy, setBusy] = useState(false)

  if (loading) return <div style={{ ...card, ...emptyState }}>Loading…</div>
  if (!bundle) return <div style={{ ...card, ...emptyState }}>Couldn't load this. Try refreshing.</div>

  const posts: DiscussionPost[] = bundle.discussion.posts.map((p) => ({
    id: p.id, authorName: p.authorName, isStaff: p.isStaff, isMine: p.isMine,
    isAnnouncement: p.isAnnouncement, isPinned: p.isPinned, isLocked: p.isLocked,
    title: p.title, body: p.body, deletedAt: p.deletedAt, edited: p.edited,
    parentPostId: p.parentPostId, createdAt: p.createdAt,
    attachmentUrl: p.attachmentUrl, attachmentFileName: p.attachmentFileName,
    reactionCount: p.reactionCount, reactedByMe: p.reactedByMe,
  }))

  async function uploadAttachment(file: File) {
    const path = `lms-discussion/${studentId}/${carrierItem.id}/${Date.now()}_${file.name}`
    const url = await uploadFile(path, file)
    return { url, name: file.name }
  }

  async function handleCreateTopic({ title, body, file }: { title: string; body: string; file: File | null }) {
    setBusy(true)
    try {
      const attachment = file ? await uploadAttachment(file) : null
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-discussion-post', {
        method: 'POST',
        body: JSON.stringify({ contentId: carrierItem.id, title, body, attachmentUrl: attachment?.url, attachmentFileName: attachment?.name }),
      })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post. Please try again.')
    }
    setBusy(false)
  }

  async function handleCreateReply(topicId: string, { body, file }: { body: string; file: File | null }) {
    setBusy(true)
    try {
      const attachment = file ? await uploadAttachment(file) : null
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-discussion-post', {
        method: 'POST',
        body: JSON.stringify({ contentId: carrierItem.id, parentPostId: topicId, body, attachmentUrl: attachment?.url, attachmentFileName: attachment?.name }),
      })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reply. Please try again.')
    }
    setBusy(false)
  }

  async function handleEdit(post: DiscussionPost, newBody: string) {
    setBusy(true)
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-edit-discussion-post', {
        method: 'POST', body: JSON.stringify({ postId: post.id, body: newBody }),
      })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save changes.')
    }
    setBusy(false)
  }

  async function handleDelete(post: DiscussionPost) {
    setBusy(true)
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-delete-discussion-post', {
        method: 'POST', body: JSON.stringify({ postId: post.id }),
      })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete post.')
    }
    setBusy(false)
  }

  async function handleReact(post: DiscussionPost) {
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-react-discussion-post', { method: 'POST', body: JSON.stringify({ postId: post.id }) })
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to react.')
    }
  }

  return (
    <DiscussionBoard
      mode="student"
      posts={posts}
      busy={busy}
      readOnly={readOnly}
      onCreateTopic={({ title, body, file }) => handleCreateTopic({ title, body, file })}
      onCreateReply={handleCreateReply}
      onEditPost={handleEdit}
      onDeletePost={handleDelete}
      onReact={handleReact}
    />
  )
}

function CSAppealControl({ appeal, isOpen, draftText, filing, readOnly, onOpen, onCancel, onDraftChange, onFile }: {
  appeal: CSAppealData | undefined
  isOpen: boolean
  draftText: string
  filing: boolean
  readOnly: boolean
  onOpen: () => void
  onCancel: () => void
  onDraftChange: (val: string) => void
  onFile: () => void
}) {
  if (appeal) {
    return (
      <div style={{ marginTop: 8, padding: '8px 10px', background: appeal.status === 'open' ? '#FEF3C7' : '#F0FDF4', border: `1px solid ${appeal.status === 'open' ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 8, fontSize: 15 }}>
        {appeal.status === 'open'
          ? <span style={{ color: '#92400E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flag size={11} /> Appeal sent — pending review.</span>
          : <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> <strong>Appeal resolved:</strong> {appeal.adminReply}</span>}
      </div>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      {isOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea rows={2} value={draftText} onChange={(e) => onDraftChange(e.target.value)} placeholder="Explain the discrepancy you'd like reviewed..." style={{ width: '100%', padding: '7px 9px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onFile} disabled={filing} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{filing ? 'Sending…' : 'Send Appeal'}</button>
            <button onClick={onCancel} style={{ padding: '5px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={onOpen} disabled={readOnly} style={{ padding: '4px 10px', background: 'none', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: readOnly ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flag size={10} /> Appeal this score</button>
      )}
    </div>
  )
}

function CSScoreBlock({ type, overrides, icon: Icon, title, order, score, appealControl }: {
  type: ScoreComponentType
  overrides: RubricOverrides | undefined
  icon: LucideIcon
  title: string
  order: number
  score: CSScoreData | undefined
  appealControl: React.ReactNode
}) {
  const cat = getEffectiveRubric(overrides, type)
  const isScored = score?.status === 'scored'
  return (
    <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} /> {order}. {title}</div>
        {isScored
          ? <span style={{ background: '#DCFCE7', color: '#059669', fontSize: 16, fontWeight: 900, padding: '4px 12px', borderRadius: 20 }}>{score!.subtotal}/{cat.weight}</span>
          : <span style={{ background: '#F0F4FA', color: '#7A92B0', fontSize: 14, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Hourglass size={10} /> Pending</span>}
      </div>
      {isScored && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {cat.criteria.map((c) => (
            <span key={c.key} style={{ fontSize: 14, fontWeight: 700, color: '#3D5475', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 6, padding: '4px 8px' }}>{c.label}: {score!.criteriaScores[c.key] ?? 0}/{c.max}</span>
          ))}
        </div>
      )}
      {isScored && score!.feedback && (
        <div style={{ background: '#EEF3FF', borderRadius: 8, padding: '8px 10px', fontSize: 15, color: '#3D5475', whiteSpace: 'pre-wrap' }}>
          <strong style={{ color: '#1A365E' }}>Teacher feedback:</strong> {score!.feedback}
        </div>
      )}
      {!isScored && <div style={{ fontSize: 15, color: '#94A3B8' }}>Your teacher hasn't scored this yet.</div>}
      {appealControl}
    </div>
  )
}

function LessonPreviewContent({
  item,
}: {
  item: LMSContent
}) {
  const [slideIdx, setSlideIdx] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)

  function renderContent() {
    const url = item.url || ''

    if (item.type === 'video') {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
      if (ytMatch) {
        return (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
            <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} title={item.title} loading="lazy" />
          </div>
        )
      }
      return url
        ? (
          <div style={{ padding: 20 }}>
            <iframe src={url} style={{ width: '100%', height: 520, border: '1.5px solid #E4EAF2', borderRadius: 10 }} title={item.title} loading="lazy" />
          </div>
        )
        : <div style={{ padding: 20, color: '#94A3B8' }}>No video URL provided.</div>
    }

    if (item.type === 'article') {
      const content = item.body || item.url || ''
      return content
        ? <div style={{ padding: 20, lineHeight: 1.7, fontSize: 16, color: '#1A365E', whiteSpace: 'pre-wrap' }}>{content}</div>
        : <div style={{ padding: 20, color: '#94A3B8' }}>No article content.</div>
    }

    if (item.type === 'presentation' && url) {
      const slideCount = item.slideCount || 20
      const slideM = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
      const slideId = slideM ? slideM[1] : null

      // Uploaded file (PDF/PPTX): 16:9 container + Prev/Next, scroll blocked by overlay
      if (!slideId) {
        const pct2 = Math.round(slideIdx / Math.max(1, slideCount - 1) * 100)
        const isFirst2 = slideIdx === 0
        const isLast2 = slideIdx === slideCount - 1
        const pageUrl = `${url}#page=${slideIdx + 1}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#1A1A2E' }}>
              <iframe
                key={slideIdx}
                src={pageUrl}
                onLoad={() => setTimeout(() => setPdfLoading(false), 300)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none', visibility: pdfLoading ? 'hidden' : 'visible' }}
                title={item.title}
                scrolling="no"
              />
              {/* loading overlay — hides page-1 flash while PDF navigates to #page=N */}
              {pdfLoading && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ color: '#9EB3C8', fontSize: 16, fontWeight: 600 }}>Loading slide…</div>
                </div>
              )}
              {/* blocks scroll so only app nav works */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
            </div>
            <div style={{ background: '#F0F4FA', padding: '10px 16px 12px', border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
              <div style={{ position: 'relative', height: 6, background: '#DDE6F0', borderRadius: 3, marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${pct2}%`, background: '#1A365E', borderRadius: 3, transition: 'width .2s' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => { setPdfLoading(true); setSlideIdx(p => Math.max(0, p - 1)) }} disabled={isFirst2} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: isFirst2 ? 'not-allowed' : 'pointer', background: isFirst2 ? '#E4EAF2' : '#1A365E', color: isFirst2 ? '#94A3B8' : '#fff' }}>◀ Prev</button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
                <button onClick={() => { setPdfLoading(true); setSlideIdx(p => Math.min(slideCount - 1, p + 1)) }} disabled={isLast2} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: isLast2 ? 'not-allowed' : 'pointer', background: isLast2 ? '#E4EAF2' : '#1A365E', color: isLast2 ? '#94A3B8' : '#fff' }}>Next ▶</button>
              </div>
            </div>
          </div>
        )
      }

      // Google Slides: custom slide-by-slide navigation
      // SLIDE_H uses 16:9 ratio at a standard 960px reference width → 540px
      const SLIDE_H = 540
      const embedUrl = `https://docs.google.com/presentation/d/${slideId}/embed?rm=minimal&start=false&loop=false&delayms=99999`
      const pct = Math.round(slideIdx / Math.max(1, slideCount - 1) * 100)
      const isFirst = slideIdx === 0
      const isLast = slideIdx === slideCount - 1
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#1A1A2E', height: SLIDE_H }}>
            <div style={{ position: 'relative', width: '100%', transform: `translateY(-${slideIdx * SLIDE_H}px)`, transition: 'transform .3s ease' }}>
              <iframe src={embedUrl} style={{ width: '100%', height: slideCount * SLIDE_H + 100, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" allowFullScreen title={item.title} loading="lazy" />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'transparent' }} />
          </div>
          <div style={{ background: '#F0F4FA', padding: '10px 16px 12px', border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
            <div style={{ position: 'relative', height: 6, background: '#DDE6F0', borderRadius: 3, marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1A365E', borderRadius: 3, transition: 'width .2s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSlideIdx((p) => Math.max(0, p - 1))} disabled={isFirst} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: isFirst ? 'not-allowed' : 'pointer', background: isFirst ? '#E4EAF2' : '#1A365E', color: isFirst ? '#94A3B8' : '#fff' }}>◀ Prev</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
              <button onClick={() => setSlideIdx((p) => Math.min(slideCount - 1, p + 1))} disabled={isLast} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: isLast ? 'not-allowed' : 'pointer', background: isLast ? '#E4EAF2' : '#1A365E', color: isLast ? '#94A3B8' : '#fff' }}>Next ▶</button>
            </div>
          </div>
        </div>
      )
    }

    if (item.type === 'file' && url) {
      const driveMatch = url.match(/\/file\/d\/([^/]+)/)
      const previewUrl = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : `${url}#toolbar=0`
      return <iframe src={previewUrl} style={{ width: '100%', height: 560, border: 'none' }} title={item.title} loading="lazy" />
    }

    if (item.type === 'link' && url) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 15, color: '#7A92B0', marginBottom: 8 }}>Loading external content inline...</div>
          <iframe src={url} style={{ width: '100%', height: 500, border: '1.5px solid #E4EAF2', borderRadius: 10 }} sandbox="allow-scripts allow-same-origin allow-forms" loading="lazy" title={item.title} />
        </div>
      )
    }

    if (item.type === 'quiz') {
      let questions: Array<{ q: string; opts?: string[]; ans?: number }> = []
      try { questions = JSON.parse(item.quizJson || '[]') } catch { /* empty */ }
      if (!questions.length) return <div style={{ padding: 20, color: '#94A3B8' }}>No quiz questions defined yet.</div>
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {questions.map((q, qi) => (
            <div key={qi} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              {q.opts && q.opts.map((opt, oi) => (
                <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 15, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? <Check size={11} strokeWidth={3} /> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    return <div style={{ padding: 20, color: '#94A3B8' }}>No content available.</div>
  }

  return (
    <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0F4FA', background: '#F7F9FC' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A365E' }}>{item.unitTitle || 'Lesson Content'}</span>
      </div>
      {renderContent()}
    </div>
  )
}

// ─── Course-detail content list: dated, filterable, flat rows ─────────────────
// "Teacher Needed" has no backing status anywhere yet (no field on lms_progress
// tracks it), so its chip stays disabled rather than pretending to filter something
// real. Bookmarking is the same story — shown as a dashed, disabled affordance.
type ContentFilterId = 'all' | 'weekly_target' | 'past_target' | 'not_started' | 'in_progress' | 'not_mastered' | 'completed'
type RowStatus = 'completed' | 'in_progress' | 'not_started' | 'not_mastered'

const CONTENT_FILTERS: { id: ContentFilterId | 'teacher_needed'; label: string; dot: string; disabled?: boolean }[] = [
  { id: 'all', label: 'All', dot: '#94A3B8' },
  { id: 'weekly_target', label: 'Weekly Target', dot: '#2563EB' },
  { id: 'past_target', label: 'Past Target', dot: SP_RED },
  { id: 'not_started', label: 'Not Started', dot: '#94A3B8' },
  { id: 'in_progress', label: 'In Progress', dot: '#2563EB' },
  { id: 'not_mastered', label: 'Not Mastered', dot: '#D97706' },
  { id: 'teacher_needed', label: 'Teacher Needed', dot: SP_RED, disabled: true },
  { id: 'completed', label: 'Completed', dot: SP_GREEN },
]

const ROW_STATUS_META: Record<RowStatus, { bar: string; textColor: string; icon: LucideIcon }> = {
  completed: { bar: SP_GREEN, textColor: SP_GREEN, icon: CheckCircle2 },
  not_mastered: { bar: SP_RED, textColor: SP_RED, icon: AlertTriangle },
  in_progress: { bar: '#2563EB', textColor: '#2563EB', icon: Play },
  not_started: { bar: '#E4EAF2', textColor: '#94A3B8', icon: Circle },
}

// One color identity per stage of the Learn It → Discussion Board journey, so a
// student can tell what kind of activity a row is before reading it. Every value
// here is either a color already used elsewhere for that exact meaning in this
// file (e.g. '#DCFCE7'/'#059669' is the same pass-state tint used by CSScoreBlock,
// '#FEF3C7'/'#92400E' the same pair already used for the "needs attention" banner
// below) or a low-opacity tint of a hue that already exists in the design system
// (Show It / Discussion reuse the English-Arts and World-Language subject colors
// from SUBJECT_COLORS) — nothing here is a newly invented hue.
type StageKey = 'learn' | 'do' | 'show' | 'prove' | 'master' | 'discussion'
const STAGE_META: Record<StageKey, { label: string; icon: LucideIcon; text: string; bg: string }> = {
  learn: { label: 'Learn It', icon: FileText, text: '#059669', bg: '#DCFCE7' },
  do: { label: 'Do It', icon: BookOpen, text: '#2563EB', bg: '#DBEAFE' },
  show: { label: 'Show It', icon: Scale, text: '#8B5CF6', bg: 'rgba(139,92,246,.13)' },
  prove: { label: 'Prove It', icon: Calculator, text: SP_RED, bg: '#FEE2E2' },
  master: { label: 'Master It', icon: Trophy, text: '#92400E', bg: '#FEF3C7' },
  discussion: { label: 'Discuss', icon: MessageSquare, text: '#0891B2', bg: 'rgba(8,145,178,.12)' },
}

function rowBuckets(status: RowStatus, targetDate?: string | null): ContentFilterId[] {
  const buckets: ContentFilterId[] = ['all', status]
  if (targetDate && status !== 'completed') {
    const diffDays = Math.round((new Date(`${targetDate}T00:00:00`).getTime() - Date.now()) / 86400000)
    if (diffDays < 0) buckets.push('past_target')
    else if (diffDays <= 7) buckets.push('weekly_target')
  }
  return buckets
}

function formatShortDate(targetDate: string) {
  const d = new Date(`${targetDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
    overdue: d.getTime() < new Date(new Date().toDateString()).getTime(),
  }
}

const contentRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '4px 50px 42px 1fr auto auto 14px', gap: 12, alignItems: 'center',
  width: '100%', padding: '11px 14px 11px 10px', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 10,
  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background .15s ease, border-color .15s ease',
}

function ContentRow({ stage, title, targetDate, status, statusText, score, passMark, timeMins, locked, lockReason, onClick, activeFilter }: {
  stage: StageKey
  title: string
  targetDate?: string | null
  status: RowStatus
  statusText: string
  score?: number | null
  passMark?: number
  timeMins?: number | null
  locked?: boolean
  lockReason?: string
  onClick?: () => void
  activeFilter: ContentFilterId
}) {
  const buckets = rowBuckets(status, targetDate)
  if (activeFilter !== 'all' && !buckets.includes(activeFilter)) return null

  const stageMeta = STAGE_META[stage]
  const meta = locked ? { bar: '#E4EAF2', textColor: '#94A3B8', icon: Lock } : ROW_STATUS_META[status]
  const dateInfo = targetDate ? formatShortDate(targetDate) : null
  const Icon = locked ? Lock : stageMeta.icon
  const StatusIcon = meta.icon
  const clickable = !!onClick && !locked

  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={locked ? (lockReason || 'Complete the previous activity to unlock this.') : undefined}
      style={{ ...contentRowStyle, opacity: locked ? .55 : 1, cursor: locked ? 'not-allowed' : clickable ? 'pointer' : 'default' }}
      onMouseEnter={(e) => { if (!locked) e.currentTarget.style.background = '#F8FAFC' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
    >
      <span style={{ alignSelf: 'stretch', minHeight: 28, borderRadius: 2, background: meta.bar }} />
      <span style={{ fontSize: 12, fontWeight: 800, color: dateInfo?.overdue && status !== 'completed' && !locked ? SP_RED : '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>
        {dateInfo ? <>{dateInfo.dow}<br />{dateInfo.short}</> : 'No date'}
      </span>
      <span style={{ width: 40, height: 40, borderRadius: 11, background: locked ? '#F0F4FA' : stageMeta.bg, color: locked ? '#94A3B8' : stageMeta.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: locked ? '#94A3B8' : '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: meta.textColor, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <StatusIcon size={10} />{locked ? 'Locked' : statusText}
        </div>
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 100, background: locked ? '#F0F4FA' : stageMeta.bg, color: locked ? '#94A3B8' : stageMeta.text, whiteSpace: 'nowrap', justifySelf: 'end' }}>
        {stageMeta.label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'end' }}>
        {typeof score === 'number' && <span style={{ fontSize: 15, fontWeight: 800, color: score >= (passMark ?? 80) ? SP_GREEN : SP_RED }}>{score}%</span>}
        {!!timeMins && <span style={{ fontSize: 13, color: '#94A3B8' }}>{timeMins}m</span>}
        <span
          title="Bookmarking isn't available yet — needs a new field"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D7E0EA', cursor: 'not-allowed', flexShrink: 0 }}
        >
          <Star size={12} />
        </span>
      </span>
      <ChevronRight size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
    </button>
  )
}

function formatLongDate(targetDate: string) {
  const d = new Date(`${targetDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' })
}

// One Play row inside an activity's overview (e.g. "Expressions: Tutorial").
function OverviewPartRow({ title, status, statusText, score, passMark, targetDate, isVideo, onClick }: {
  title: string
  status: RowStatus
  statusText: string
  score?: number | null
  passMark?: number
  targetDate?: string | null
  isVideo?: boolean
  onClick: () => void
}) {
  const meta = ROW_STATUS_META[status]
  const StatusIcon = meta.icon
  const dateInfo = targetDate ? formatShortDate(targetDate) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid #E4EAF2', borderRadius: 12, background: '#fff' }}>
      <span style={{ width: 32, height: 32, borderRadius: '50%', background: meta.bar, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <StatusIcon size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          <span title="Bookmarking isn't available yet — needs a new field" style={{ display: 'inline-flex', color: '#D7E0EA', cursor: 'not-allowed' }}><Star size={13} /></span>
        </div>
        <div style={{ fontSize: 15, color: meta.textColor, marginTop: 2, fontWeight: 600 }}>
          {statusText}{typeof score === 'number' ? ` · ${score}%${passMark != null ? ` (pass ${passMark}%)` : ''}` : ''}
        </div>
        {dateInfo && (
          <div style={{ fontSize: 13, color: dateInfo.overdue && status !== 'completed' ? SP_RED : '#94A3B8', marginTop: 2, fontWeight: 600 }}>
            Due {dateInfo.dow} {dateInfo.short}
          </div>
        )}
      </div>
      <button onClick={onClick} style={{ padding: '8px 18px', background: '#fff', color: SP_NAVY, border: `1.5px solid ${SP_NAVY}`, borderRadius: 20, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        {isVideo ? <><Play size={12} /> Play</> : <><Eye size={12} /> View</>}
      </button>
    </div>
  )
}

export function SPMyLearningPage() {
  const { session, getToken } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const navigate = useNavigate()
  const location = useLocation()
  const [courses, setCourses] = useState<LMSCourse[]>([])
  const [content, setContent] = useState<LMSContent[]>([])
  const [progress, setProgress] = useState<LMSProgress[]>([])
  const [enrolments, setEnrolments] = useState<LMSEnrolment[]>([])
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [contentFilter, setContentFilter] = useState<ContentFilterId>('all')
  const [sectionDetailsOpen, setSectionDetailsOpen] = useState(false)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [activeGroupKind, setActiveGroupKind] = useState<ActivityGroupKind | null>(null)
  const [activePart, setActivePart] = useState<PartKind | null>(null)
  const [collapsedLessonIds, setCollapsedLessonIds] = useState<Set<string>>(new Set())
  const [openedAtMap, setOpenedAtMap] = useState<Record<string, number>>({})
  const [, setTimerNow] = useState(Date.now())

  const gradeNum = toLegacyStudentGradeValue(session?.grade ?? '')
  if (!readOnly && gradeNum !== null && gradeNum <= 5) return <K5MyLearningPage />

  useEffect(() => {
    if (!session) return
    void load()
  }, [session])

  useEffect(() => {
    setContentFilter('all')
    setSectionDetailsOpen(false)
    setActiveGroupKind(null)
    setActiveLessonId(null)
    setActivePart(null)
  }, [activeCourse])

  useEffect(() => {
    if (!session) return
    try {
      const next: Record<string, number> = {}
      content.forEach((item) => {
        const raw = localStorage.getItem(getLessonTimerKey(session.dbId, item.id))
        if (raw) {
          const parsed = Number(raw)
          if (!Number.isNaN(parsed) && parsed > 0) next[item.id] = parsed
        }
      })
      setOpenedAtMap(next)
    } catch {
      setOpenedAtMap({})
    }
  }, [content, session])

  useEffect(() => {
    const id = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  async function load() {
    if (!session) return
    setLoading(true)

    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const sessionGrade = String(session.grade ?? '').trim()
    const sessionGradeNorm = norm(sessionGrade)
    const sessionCohortNorm = norm(session.cohort)

    const { data: enrolData } = await supabase.from('lms_enrolments').select('*')
    const allEnrolments: LMSEnrolment[] = (enrolData ?? []).map(rowToLMSEnrolment)

    const matched = allEnrolments.filter((entry) => {
      if (!isActiveBool(entry.active)) return false
      const targetType = norm(entry.targetType)
      const targetValueNorm = norm(entry.targetValue)
      if (targetType === 'student') return targetValueNorm === norm(session.dbId)
      if (targetType === 'cohort') return targetValueNorm === sessionCohortNorm
      if (targetType === 'grade') return targetValueNorm === sessionGradeNorm || targetValueNorm === norm(`Grade ${sessionGrade}`)
      return false
    })

    setEnrolments(matched)

    if (!matched.length) {
      setCourses([])
      setContent([])
      setProgress([])
      setLoading(false)
      return
    }

    const courseIds = [...new Set(matched.map((entry) => entry.courseId))]
    const [{ data: cData }, { data: prData }] = await Promise.all([
      supabase.from('lms_courses').select('*').in('id', courseIds),
      supabase.from('lms_progress').select('*').eq('student_id', session.dbId),
    ])

    // Curriculum belongs to the Course (group), shared by every section — load content by group_id.
    const groupIds = [...new Set((cData ?? []).map((r: Record<string, unknown>) => (r.group_id as string) ?? (r.id as string)).filter(Boolean))]
    const { data: coData } = await supabase.from('lms_content').select('*')
      .in('course_id', groupIds).order('unit_order').order('module_order').order('order_idx')

    const mappedCourses: LMSCourse[] = (cData ?? []).map(rowToLMSCourse)

    const publishedCourses = mappedCourses.filter((course) => course.status?.toLowerCase() === 'published')

    const mappedContent: LMSContent[] = (coData ?? []).map(rowToLMSContent)

    const mappedProgress: LMSProgress[] = (prData ?? []).map(rowToLMSProgress)

    // A content row (e.g. a case study) can be saved without unitOrder, which would
    // otherwise coerce to 0 and tie it with the first module, scrambling module order.
    // Backfill it from a sibling that shares the same course + unit title.
    const unitOrderByKey = new Map<string, number>()
    mappedContent.forEach((c) => {
      if (c.unitOrder !== undefined) unitOrderByKey.set(`${c.courseId}::${c.unitTitle}`, c.unitOrder)
    })
    const backfilledContent = mappedContent.map((c) => (
      c.unitOrder === undefined ? { ...c, unitOrder: unitOrderByKey.get(`${c.courseId}::${c.unitTitle}`) ?? 0 } : c
    ))

    setCourses(publishedCourses.length ? publishedCourses : mappedCourses)
    setContent(backfilledContent)
    setProgress(mappedProgress)

    try {
      const subsData = await studentPortalFetch(getToken(), '/api/student-portal/lms-get-my-submissions')
      setMySubmissions((subsData as { submissions: MySubmission[] }).submissions ?? [])
    } catch {
      setMySubmissions([])
    }

    setLoading(false)
  }

  function onSubmissionAdded(sub: MySubmission) {
    setMySubmissions((prev) => [sub, ...prev.filter((s) => !(s.contentId === sub.contentId && s.kind === sub.kind))])
  }

  async function markComplete(item: LMSContent) {
    if (!session) return
    const existing = progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId)
    const next = existing?.status === 'completed' ? 'in_progress' : 'completed'

    // Optimistic update — button responds immediately
    setProgress((prev) => {
      const filtered = prev.filter((entry) => !(entry.contentId === item.id && entry.studentId === session.dbId))
      return [...filtered, { ...existing, studentId: session.dbId, courseId: item.courseId, contentId: item.id, status: next }]
    })

    const payload: Record<string, unknown> = {
      student_id: session.dbId,
      course_id: item.courseId,
      content_id: item.id,
      status: next,
    }
    if (existing?.id) payload.id = existing.id
    const { error } = await supabase.from('lms_progress').upsert(payload, { onConflict: 'student_id,content_id' })
    if (error) console.error('markComplete error:', error)
  }

  function openPart(item: LMSContent, part: PartKind) {
    if (part === 'tutorial' && session) {
      const existing = openedAtMap[item.id]
      if (!existing) {
        const startedAt = Date.now()
        setOpenedAtMap((prev) => ({ ...prev, [item.id]: startedAt }))
        try {
          localStorage.setItem(getLessonTimerKey(session.dbId, item.id), String(startedAt))
        } catch {
          // ignore storage failures
        }
      }
    }
    setActiveLessonId(item.id)
    setActivePart(part)
  }

  // Opens an activity's overview (the Tutorial/Notes/Mastery-style checklist) —
  // clicking a Play row from there calls openPart for that specific part.
  function openGroup(kind: ActivityGroupKind, contentId: string) {
    setActiveGroupKind(kind)
    setActiveLessonId(contentId)
    setActivePart(null)
  }

  // From inside a part (Tutorial, Mastery Test, ...), "Back" returns to that
  // activity's overview rather than all the way out to the unit list.
  function backToLessonList() {
    setActivePart(null)
  }

  // From the overview itself, "Close" returns all the way out to the unit list.
  function closeActivity() {
    setActiveGroupKind(null)
    setActiveLessonId(null)
    setActivePart(null)
  }

  const hasSubmission = (contentId: string, kind: string) => mySubmissions.some((s) => s.contentId === contentId && s.kind === kind)

  // Same "is this Do It lesson actually done" rule the row itself uses (tutorial +
  // notes, plus mastery if the lesson has it) — mirrored here so the unit's Do It
  // step count in the journey stepper always agrees with what the rows below show.
  function lessonIsComplete(item: LMSContent): boolean {
    const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
    const tutorialDone = itemProgress?.status === 'completed'
    const itemHasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
    const masteryPassed = itemProgress?.masteryPassed === true || itemProgress?.masteryPassed === 'TRUE'
    const notesDone = hasSubmission(item.id, 'lesson_notes')
    return tutorialDone && notesDone && (!itemHasMastery || masteryPassed)
  }

  function toggleLessonExpanded(itemId: string) {
    setCollapsedLessonIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId)
      return next
    })
  }

  function handleProgressUpdate(contentId: string, updates: Partial<LMSProgress>) {
    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.contentId === contentId && p.studentId === session?.dbId)
      if (idx === -1) {
        return [...prev, { studentId: session?.dbId ?? '', courseId: updates.courseId ?? '', contentId, status: 'in_progress', ...updates }]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], ...updates }
      return next
    })
  }

  const subjects = useMemo(() => {
    const values = [...new Set(courses.map((course) => course.subject).filter(Boolean))]
    return ['All', ...values]
  }, [courses])

  const courseProgress = (course: LMSCourse) => {
    const items = content.filter((item) => item.courseId === (course.groupId ?? course.id))
    if (!items.length || !session) return 0
    const done = items.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId && entry.status === 'completed')).length
    return Math.round((done / items.length) * 100)
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (subjectFilter !== 'All' && course.subject !== subjectFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return course.title.toLowerCase().includes(q) || course.subject.toLowerCase().includes(q) || course.description.toLowerCase().includes(q)
    })
  }, [courses, search, subjectFilter])

  const paceSummary = useMemo(() => {
    let ahead = 0
    let on = 0
    let off = 0
    let notStarted = 0

    courses.forEach((course) => {
      const enrolment = enrolments.find((entry) => entry.courseId === course.id)
      const pct = courseProgress(course)
      const meta = paceMeta(pct, enrolment)
      if (meta.bucket === 'ahead') ahead += 1
      else if (meta.bucket === 'on') on += 1
      else if (meta.bucket === 'off') off += 1
      else notStarted += 1
    })

    return { ahead, on, off, notStarted }
  }, [courses, enrolments, content, progress, session])

  const selectedCourse = activeCourse ? courses.find((course) => course.id === activeCourse) ?? null : null
  const selectedEnrolment = selectedCourse ? enrolments.find((entry) => entry.courseId === selectedCourse.id) ?? null : null
  const courseItems = useMemo(() => {
    if (!selectedCourse) return []
    return content
      .filter((item) => item.courseId === (selectedCourse.groupId ?? selectedCourse.id))
      .sort((a, b) => (a.unitOrder ?? 0) - (b.unitOrder ?? 0) || (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
  }, [content, selectedCourse])

  const groupedModules = useMemo(() => {
    const modules = new Map<string, { label: string; units: Map<string, LMSContent[]> }>()
    courseItems.forEach((item) => {
      const moduleKey = item.moduleTitle || '__default__'
      if (!modules.has(moduleKey)) modules.set(moduleKey, { label: item.moduleTitle || '', units: new Map() })
      const module = modules.get(moduleKey)!
      const unitKey = item.unitTitle || 'Lessons'
      if (!module.units.has(unitKey)) module.units.set(unitKey, [])
      module.units.get(unitKey)!.push(item)
    })
    return [...modules.values()]
  }, [courseItems])
  const activeLesson = activeLessonId ? courseItems.find((item) => item.id === activeLessonId) ?? null : null

  // Flat, ordered list of every activity across every unit — powers Previous/Next
  // Activity navigation on the overview screen, independent of which unit it's in.
  const allGroups = useMemo(() => {
    const out: ActivityGroupRef[] = []
    groupedModules.forEach((module) => {
      module.units.forEach((items) => {
        const carrierItem = items.find((i) => i.hasAssignment === true || i.hasAssignment === 'TRUE') ?? null
        const lessonItems = items.filter((i) => i !== carrierItem)
        if (carrierItem) out.push({ key: `learn:${carrierItem.id}`, kind: 'learn', contentId: carrierItem.id })
        lessonItems.forEach((item) => out.push({ key: `lesson:${item.id}`, kind: 'lesson', contentId: item.id }))
        if (carrierItem) {
          out.push({ key: `show:${carrierItem.id}`, kind: 'show', contentId: carrierItem.id })
          out.push({ key: `prove:${carrierItem.id}`, kind: 'prove', contentId: carrierItem.id })
          out.push({ key: `master:${carrierItem.id}`, kind: 'master', contentId: carrierItem.id })
          out.push({ key: `discussion:${carrierItem.id}`, kind: 'discussion', contentId: carrierItem.id })
        }
      })
    })
    return out
  }, [groupedModules])
  const activeGroupIndex = activeLessonId && activeGroupKind ? allGroups.findIndex((g) => g.kind === activeGroupKind && g.contentId === activeLessonId) : -1
  const prevGroup = activeGroupIndex > 0 ? allGroups[activeGroupIndex - 1] : null
  const nextGroup = activeGroupIndex >= 0 && activeGroupIndex < allGroups.length - 1 ? allGroups[activeGroupIndex + 1] : null

  function groupDisplay(ref: ActivityGroupRef): { title: string; icon: LucideIcon } {
    const item = courseItems.find((i) => i.id === ref.contentId)
    switch (ref.kind) {
      case 'learn': return { title: `Learn It: ${item?.title || 'Case Study'}`, icon: FileText }
      case 'show': return { title: 'Show It: Socratic Seminar', icon: Scale }
      case 'prove': return { title: 'Prove It: OMR Test', icon: Calculator }
      case 'master': return { title: 'Master It: Presentation', icon: Trophy }
      case 'discussion': return { title: 'Discussion Board', icon: MessageSquare }
      default: return { title: item?.title || 'Lesson', icon: BookOpen }
    }
  }

  // Sequential Completion / Mastery Learning with Sequential Completion — set per
  // course by an admin (Course Progression Settings). "Open" and plain "Mastery
  // Learning" never lock navigation here; only the two sequential modes do.
  const sequentialLock = selectedCourse?.progressionMode === 'sequential' || selectedCourse?.progressionMode === 'mastery_sequential'

  // Show It / Prove It have no trackable completion signal yet (no submission or
  // score is recorded for them), so they're treated as auto-complete for gating —
  // otherwise they'd permanently block Master It with no way for a student to clear them.
  function isGroupComplete(ref: ActivityGroupRef): boolean {
    if (ref.kind === 'show' || ref.kind === 'prove' || ref.kind === 'discussion') return true
    const item = courseItems.find((i) => i.id === ref.contentId)
    if (!item) return false
    if (ref.kind === 'learn') return hasSubmission(item.id, 'case_study_notes')
    if (ref.kind === 'master') return hasSubmission(item.id, 'presentation')
    const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
    const tutorialDone = itemProgress?.status === 'completed'
    const hasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
    const masteryPassed = itemProgress?.masteryPassed === true || itemProgress?.masteryPassed === 'TRUE'
    const notesDone = hasSubmission(item.id, 'lesson_notes')
    return tutorialDone && notesDone && (!hasMastery || masteryPassed)
  }

  // A group is locked if either (a) an admin locked its content row directly —
  // the same 🔒 toggle already in Curriculum, which works anytime regardless of
  // progression mode or student progress — or (b) sequential progression is on
  // and the activity immediately before it (course-wide, across unit boundaries)
  // isn't complete yet. Learn It / Show It / Prove It / Master It all share one
  // content row (the module's carrier item), so an admin lock on that row locks
  // all four together — there's no per-slot lock for those four independently yet.
  function isGroupLocked(ref: ActivityGroupRef): boolean {
    const item = courseItems.find((i) => i.id === ref.contentId)
    if (item?.locked) return true
    if (!sequentialLock) return false
    const idx = allGroups.findIndex((g) => g.key === ref.key)
    if (idx <= 0) return false
    return !isGroupComplete(allGroups[idx - 1])
  }

  function groupLockReason(ref: ActivityGroupRef): string {
    const item = courseItems.find((i) => i.id === ref.contentId)
    return item?.locked ? 'This activity has been locked by your teacher.' : 'Complete the previous activity to unlock this.'
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: '#7A92B0', fontSize: 16 }}>Loading your courses…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} /> My Learning</div>
          <div style={{ fontSize: 15, color: '#7A92B0', marginTop: 2 }}>{courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you</div>
        </div>
        {!selectedCourse && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            style={{ padding: '8px 12px', border: '1.5px solid #E4EAF2', borderRadius: 9, fontSize: 16, minWidth: 190, outline: 'none', fontFamily: 'Poppins,sans-serif' }}
          />
        )}
      </div>

      {!selectedCourse && (
        <>
          {subjects.length > 2 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              {subjects.map((subject) => {
                const active = subjectFilter === subject
                return (
                  <button
                    key={subject}
                    onClick={() => setSubjectFilter(subject)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? SP_NAVY : '#E4EAF2'}`,
                      background: active ? SP_NAVY : '#fff',
                      color: active ? '#fff' : '#5A7290',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Poppins,sans-serif',
                    }}
                  >
                    {subject}
                  </button>
                )
              })}
            </div>
          )}

          {courses.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {paceSummary.ahead > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DCFCE7', borderRadius: 10, border: '1px solid #059669' }}><Rabbit size={16} color="#059669" /><div><div style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>{paceSummary.ahead}</div><div style={{ fontSize: 14, color: '#059669' }}>Ahead of Pace</div></div></div>}
              {paceSummary.on > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DBEAFE', borderRadius: 10, border: '1px solid #2563EB' }}><Footprints size={16} color="#2563EB" /><div><div style={{ fontSize: 15, fontWeight: 800, color: '#2563EB' }}>{paceSummary.on}</div><div style={{ fontSize: 14, color: '#2563EB' }}>On Pace</div></div></div>}
              {paceSummary.off > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEE2E2', borderRadius: 10, border: '1px solid #D61F31' }}><Turtle size={16} color="#D61F31" /><div><div style={{ fontSize: 15, fontWeight: 800, color: '#D61F31' }}>{paceSummary.off}</div><div style={{ fontSize: 14, color: '#D61F31' }}>Off Pace</div></div></div>}
              {paceSummary.notStarted > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F1F5F9', borderRadius: 10, border: '1px solid #94A3B8' }}><Circle size={16} color="#64748B" /><div><div style={{ fontSize: 15, fontWeight: 800, color: '#64748B' }}>{paceSummary.notStarted}</div><div style={{ fontSize: 14, color: '#64748B' }}>Not Started</div></div></div>}
            </div>
          )}

          {courses.length === 0 ? (
            <div style={{ ...card, padding: 48, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#94A3B8' }}><BookOpen size={40} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A365E' }}>No courses assigned yet</div>
              <div style={{ fontSize: 16, color: '#7A92B0', marginTop: 6 }}>Once courses are assigned, they will appear here.</div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ ...card, ...emptyState, textAlign: 'center' }}>No courses match your search right now.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
              {filteredCourses.map((course) => {
                const pct = courseProgress(course)
                const enrolment = enrolments.find((entry) => entry.courseId === course.id) ?? null
                const pace = paceMeta(pct, enrolment)
                const subjectCol = SUBJECT_COLORS[course.subject] || '#1A365E'
                const courseContent = content.filter((item) => item.courseId === (course.groupId ?? course.id))
                const doneCount = courseContent.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId && entry.status === 'completed')).length
                const pendingAssignments = courseContent.filter((item) => {
                  const hasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
                  if (!hasAssignment || !session) return false
                  const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId)
                  const assignScore = itemProgress?.assignScore != null && !Number.isNaN(Number(itemProgress.assignScore)) ? Number(itemProgress.assignScore) : null
                  return itemProgress && assignScore === null
                }).length

                return (
                  <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setActiveCourse(course.id)}>
                    <div style={{ height: 6, background: subjectCol }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>{course.title}</div>
                      <div style={{ fontSize: 15, color: '#7A92B0', marginBottom: 10 }}>{course.subject}{course.gradeLevel ? ` · ${course.gradeLevel}` : ''}</div>
                      <div style={{ fontSize: 15, color: '#3D5475', marginBottom: 10, lineHeight: 1.5 }}>{course.description ? `${course.description.slice(0, 80)}${course.description.length > 80 ? '…' : ''}` : 'No course description available yet.'}</div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, color: '#7A92B0' }}>{doneCount}/{courseContent.length} lessons</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : SP_NAVY }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : subjectCol, borderRadius: 3, transition: 'width .5s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 14, color: '#7A92B0', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={10} /> {courseContent.length} lessons</span>
                          {enrolment?.dueDate && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={10} /> Due: {enrolment.dueDate}</span>}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: pace.color, background: pace.bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', border: `1px solid ${pace.color}33`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <pace.icon size={11} /> {pace.label}
                        </span>
                      </div>
                      {pendingAssignments > 0 && (
                        <div style={{ marginBottom: 6, padding: '5px 10px', background: '#FEF3C7', borderRadius: 7, fontSize: 14, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ClipboardList size={12} /><span>{pendingAssignments} assignment{pendingAssignments !== 1 ? 's' : ''} need attention</span>
                        </div>
                      )}
                      {course.announcement?.trim() ? (
                        <div style={{ marginBottom: 8, padding: '7px 10px', background: '#1A365E0D', borderLeft: '3px solid #1A365E', borderRadius: '0 7px 7px 0', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <Megaphone size={13} color="#1A365E" style={{ flexShrink: 0 }} />
                          <div style={{ fontSize: 14, color: '#1A365E', lineHeight: 1.5 }}>{course.announcement.length > 80 ? `${course.announcement.slice(0, 80)}…` : course.announcement}</div>
                        </div>
                      ) : (
                        <div style={{ ...emptyState, marginBottom: 8, padding: '8px 10px' }}>No course announcement posted yet.</div>
                      )}
                      <div style={{ marginTop: 8, padding: '8px 12px', background: subjectCol, color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {pct === 0 ? <><Play size={12} /> Start Course</> : pct === 100 ? <><RefreshCw size={12} /> Review</> : <><Play size={12} /> Continue</>}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedCourse && !activeLesson && (() => {
        const paceInfo = paceMeta(courseProgress(selectedCourse), selectedEnrolment)
        const totalTimeMins = progress
          .filter((entry) => entry.courseId === (selectedCourse.groupId ?? selectedCourse.id) && entry.studentId === session?.dbId)
          .reduce((sum, entry) => sum + (entry.timeSpentMins || 0), 0)
        const daysRemaining = selectedEnrolment?.dueDate
          ? Math.ceil((new Date(`${selectedEnrolment.dueDate}T00:00:00`).getTime() - Date.now()) / 86400000)
          : null
        const doneCount = courseItems.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId && entry.status === 'completed')).length

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedCourse.announcement?.trim() ? (
            <div style={{ background: 'linear-gradient(135deg,#1A365E,#0F2240)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Megaphone size={20} color="#fff" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Course Announcement</div>
                <div style={{ fontSize: 16, color: '#fff', lineHeight: 1.6 }}>{selectedCourse.announcement}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course announcement has been posted for this course yet.</div>
          )}

          <div style={{ ...card, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button onClick={() => setActiveCourse(null)} style={{ padding: '4px 11px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
                  <span style={{ padding: '4px 11px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: `${SUBJECT_COLORS[selectedCourse.subject] || SP_NAVY}1F`, color: SUBJECT_COLORS[selectedCourse.subject] || SP_NAVY }}>{selectedCourse.subject || 'No subject'}</span>
                  {selectedCourse.gradeLevel && <span style={{ padding: '4px 11px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: '#F0F4FA', color: '#5A7290' }}>Grade {selectedCourse.gradeLevel}</span>}
                  <span style={{ padding: '4px 11px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: '#F0F4FA', color: '#5A7290' }}>Mastery {selectedCourse.passMark || 80}%</span>
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#1A365E' }}>{selectedCourse.title}</div>
                {selectedEnrolment?.dueDate && (
                  <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600, marginTop: 3 }}>
                    Due {selectedEnrolment.dueDate}{daysRemaining !== null && daysRemaining >= 0 ? ` · ${daysRemaining} days remaining` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSectionDetailsOpen(true)} style={{ padding: '8px 13px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <Info size={12} /> Section Details
                </button>
                <button onClick={() => navigate(`${portalPrefix(location.pathname)}/grades`)} style={{ padding: '8px 13px', background: SP_NAVY, color: '#fff', border: `1px solid ${SP_NAVY}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <ExternalLink size={12} /> View Gradebook
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#5A7290' }}>Course Progress</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#1A365E', fontVariantNumeric: 'tabular-nums' }}>{courseProgress(selectedCourse)}%</span>
              </div>
              <div style={{ height: 9, background: '#F0F4FA', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${courseProgress(selectedCourse)}%`, background: courseProgress(selectedCourse) === 100 ? SP_GREEN : courseProgress(selectedCourse) >= 50 ? '#D97706' : SP_NAVY, borderRadius: 100, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, marginTop: 7 }}>{doneCount} of {courseItems.length} lessons completed</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: paceInfo.color, background: paceInfo.bg, padding: '5px 12px', borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <paceInfo.icon size={12} /> {paceInfo.label}
            </span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ background: '#F0F4FA', borderRadius: 10, padding: '8px 13px', minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1A365E' }}>
                  {(() => {
                    const mastery = progress.filter((entry) => entry.courseId === (selectedCourse.groupId ?? selectedCourse.id) && entry.studentId === session?.dbId && entry.masteryScore != null)
                    return mastery.length ? `${Math.round(mastery.reduce((sum, entry) => sum + Number(entry.masteryScore ?? 0), 0) / mastery.length)}%` : '—'
                  })()}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Avg. mastery</div>
              </div>
              <div style={{ background: '#F0F4FA', borderRadius: 10, padding: '8px 13px', minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1A365E' }}>{totalTimeMins > 0 ? `${Math.floor(totalTimeMins / 60)}h ${totalTimeMins % 60}m` : '—'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Time on task</div>
              </div>
              <div style={{ background: '#F0F4FA', borderRadius: 10, padding: '8px 13px', minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1A365E' }}>{selectedCourse.requiredHours > 0 ? `${selectedCourse.requiredHours} hrs` : '—'}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Required</div>
              </div>
            </div>
          </div>

          {selectedCourse.description ? (
            <div style={{ ...card, padding: '14px 16px', fontSize: 16, color: '#5A7290', lineHeight: 1.6 }}>{selectedCourse.description}</div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course description is available yet.</div>
          )}

          {courseItems.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CONTENT_FILTERS.map((f) => {
                const active = contentFilter === f.id
                return (
                  <button
                    key={f.id}
                    disabled={f.disabled}
                    title={f.disabled ? "Not tracked yet — needs a new status field" : undefined}
                    onClick={() => !f.disabled && setContentFilter(f.id as ContentFilterId)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20,
                      border: `1.5px solid ${active ? SP_NAVY : f.disabled ? '#D7E0EA' : '#E4EAF2'}`,
                      borderStyle: f.disabled ? 'dashed' : 'solid',
                      background: active ? SP_NAVY : '#fff', color: active ? '#fff' : f.disabled ? '#B9C6D6' : '#5A7290',
                      fontSize: 15, fontWeight: 700, cursor: f.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.dot, flexShrink: 0 }} />
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}

          {courseItems.length === 0 ? (
            <div style={{ ...card, ...emptyState }}>No lessons or learning content are available for this course yet.</div>
          ) : (
            groupedModules.map((module, moduleIdx) => (
              <div key={`${module.label || 'default'}-${moduleIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {module.label ? <div style={{ fontSize: 14, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}><FolderKanban size={11} /> {module.label}</div> : null}
                {[...module.units.entries()].map(([unit, items]) => {
                  const carrierItem = items.find((i) => i.hasAssignment === true || i.hasAssignment === 'TRUE') ?? null
                  const lessonItems = items.filter((i) => i !== carrierItem)
                  const moduleKey = `unit:${unit}`
                  const moduleExpanded = !collapsedLessonIds.has(moduleKey)

                  // Same done/total per stage the rows below compute — reused here to
                  // drive the Learn It → Discussion Board journey stepper and the
                  // unit header's summary, so the two never disagree.
                  const stageCounts: Record<StageKey, { done: number; total: number }> = {
                    learn: { done: carrierItem && hasSubmission(carrierItem.id, 'case_study_notes') ? 1 : 0, total: carrierItem ? 1 : 0 },
                    do: { done: lessonItems.filter(lessonIsComplete).length, total: lessonItems.length },
                    show: { done: 0, total: carrierItem ? 1 : 0 },
                    prove: { done: 0, total: carrierItem ? 1 : 0 },
                    master: { done: carrierItem && hasSubmission(carrierItem.id, 'presentation') ? 1 : 0, total: carrierItem ? 1 : 0 },
                    discussion: { done: 0, total: carrierItem ? 1 : 0 },
                  }
                  const unitDone = Object.values(stageCounts).reduce((sum, s) => sum + s.done, 0)
                  const unitTotal = Object.values(stageCounts).reduce((sum, s) => sum + s.total, 0)
                  const unitDates = [carrierItem?.targetDate, carrierItem?.socraticDate, carrierItem?.omrTargetDate, carrierItem?.presentationTargetDate, ...lessonItems.map((i) => i.targetDate)]
                    .filter((d): d is string => !!d).sort()
                  const badgeState = unitTotal === 0 ? 'empty' : unitDone === unitTotal ? 'done' : unitDone > 0 ? 'active' : 'todo'

                  return (
                    <div key={unit} style={{ ...card, overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleLessonExpanded(moduleKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 18px', background: 'none', border: 'none', borderBottom: moduleExpanded ? '1px solid #F7F9FC' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      >
                        <span style={{
                          width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                          background: badgeState === 'done' ? '#DCFCE7' : badgeState === 'active' ? '#DBEAFE' : '#F0F4FA',
                          color: badgeState === 'done' ? '#059669' : badgeState === 'active' ? '#2563EB' : '#94A3B8',
                        }}>
                          {badgeState === 'done' ? <CheckCircle2 size={15} /> : <FolderOpen size={14} />}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A365E', flex: 1, minWidth: 0 }}>{unit}</span>
                        {unitTotal > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: badgeState === 'done' ? '#059669' : badgeState === 'active' ? '#2563EB' : '#94A3B8', whiteSpace: 'nowrap' }}>
                            {badgeState === 'done' ? 'Completed' : `${unitDone} of ${unitTotal} items completed`}
                          </span>
                        )}
                        <ChevronDown size={15} color="#94A3B8" style={{ flexShrink: 0, transform: moduleExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />
                      </button>
                      {moduleExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 18px 16px' }}>

                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
                            {(['learn', 'do', 'show', 'prove', 'master', 'discussion'] as StageKey[]).map((key, i, arr) => {
                              const meta = STAGE_META[key]
                              const s = stageCounts[key]
                              const stepDone = s.total > 0 && s.done === s.total
                              return (
                                <div key={key} style={{ display: 'flex', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 58 }}>
                                    <span style={{ position: 'relative' }}>
                                      <span style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, color: meta.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <meta.icon size={15} />
                                      </span>
                                      {stepDone && (
                                        <span style={{ position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: '50%', background: SP_GREEN, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Check size={7} color="#fff" strokeWidth={4} />
                                        </span>
                                      )}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', textAlign: 'center', lineHeight: 1.15 }}>{meta.label}</span>
                                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8' }}>{s.done}/{s.total}</span>
                                  </div>
                                  {i < arr.length - 1 && <ChevronRight size={12} color="#D7E0EA" style={{ marginTop: 10, flexShrink: 0 }} />}
                                </div>
                              )
                            })}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: carrierItem?.moduleDescription ? '1fr 220px' : '220px', gap: 12 }}>
                            {carrierItem?.moduleDescription && (
                              <div style={{ background: '#F8FAFC', border: '1px solid #F0F4FA', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#5A7290', lineHeight: 1.6 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>About this unit</div>
                                {carrierItem.moduleDescription}
                              </div>
                            )}
                            <div style={{ background: '#F8FAFC', border: '1px solid #F0F4FA', borderRadius: 12, padding: '12px 14px' }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><CalendarDays size={12} /> Unit dates</div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A365E' }}>
                                {unitDates.length ? (unitDates.length > 1 ? `${unitDates[0]} – ${unitDates[unitDates.length - 1]}` : unitDates[0]) : 'No dates set'}
                              </div>
                              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{unitTotal} item{unitTotal !== 1 ? 's' : ''}</div>
                            </div>
                          </div>

                          {carrierItem && (
                            <ContentRow
                              stage="learn" title={`Learn It · ${carrierItem.title || 'Case Study'}`} targetDate={carrierItem.targetDate}
                              status={hasSubmission(carrierItem.id, 'case_study_notes') ? 'completed' : 'not_started'}
                              statusText={hasSubmission(carrierItem.id, 'case_study_notes') ? 'Notes submitted' : 'Not started'}
                              locked={isGroupLocked({ key: `learn:${carrierItem.id}`, kind: 'learn', contentId: carrierItem.id })}
                              lockReason={groupLockReason({ key: `learn:${carrierItem.id}`, kind: 'learn', contentId: carrierItem.id })}
                              onClick={() => openGroup('learn', carrierItem.id)} activeFilter={contentFilter}
                            />
                          )}

                          {lessonItems.map((item, idx) => {
                            const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
                            const tutorialDone = itemProgress?.status === 'completed'
                            const itemHasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
                            const masteryScore = itemProgress?.masteryScore != null && !Number.isNaN(Number(itemProgress.masteryScore)) ? Number(itemProgress.masteryScore) : null
                            const masteryPassed = itemProgress?.masteryPassed === true || itemProgress?.masteryPassed === 'TRUE'
                            const masteryAttempted = (itemProgress?.masteryAttempts ?? 0) > 0 || masteryScore !== null
                            const notesDone = hasSubmission(item.id, 'lesson_notes')
                            const status: RowStatus = itemHasMastery && masteryAttempted && !masteryPassed
                              ? 'not_mastered'
                              : tutorialDone && notesDone && (!itemHasMastery || masteryPassed)
                              ? 'completed'
                              : tutorialDone || notesDone || masteryAttempted
                              ? 'in_progress'
                              : 'not_started'
                            const statusText = status === 'completed' ? 'Completed'
                              : status === 'not_mastered' ? 'Not mastered · retake available'
                              : status === 'in_progress' ? 'In Progress' : 'Not started'
                            return (
                              <ContentRow
                                key={item.id}
                                stage="do" title={`Do It · Lesson ${idx + 1}: ${item.title}`} targetDate={item.targetDate}
                                status={status} statusText={statusText}
                                score={itemHasMastery ? masteryScore : null} passMark={item.masteryPassMark ?? selectedCourse.passMark}
                                locked={isGroupLocked({ key: `lesson:${item.id}`, kind: 'lesson', contentId: item.id })}
                                lockReason={groupLockReason({ key: `lesson:${item.id}`, kind: 'lesson', contentId: item.id })}
                                onClick={() => openGroup('lesson', item.id)} activeFilter={contentFilter}
                              />
                            )
                          })}

                          {carrierItem && (
                            <>
                              <ContentRow
                                stage="show" title="Show It · Socratic Seminar" targetDate={carrierItem.socraticDate || carrierItem.targetDate}
                                status="not_started" statusText="Not started"
                                locked={isGroupLocked({ key: `show:${carrierItem.id}`, kind: 'show', contentId: carrierItem.id })}
                                lockReason={groupLockReason({ key: `show:${carrierItem.id}`, kind: 'show', contentId: carrierItem.id })}
                                onClick={() => openGroup('show', carrierItem.id)} activeFilter={contentFilter}
                              />
                              <ContentRow
                                stage="prove" title="Prove It · OMR Test" targetDate={carrierItem.omrTargetDate}
                                status="not_started" statusText="Not started"
                                locked={isGroupLocked({ key: `prove:${carrierItem.id}`, kind: 'prove', contentId: carrierItem.id })}
                                lockReason={groupLockReason({ key: `prove:${carrierItem.id}`, kind: 'prove', contentId: carrierItem.id })}
                                onClick={() => openGroup('prove', carrierItem.id)} activeFilter={contentFilter}
                              />
                              <ContentRow
                                stage="master" title="Master It · Presentation" targetDate={carrierItem.presentationTargetDate}
                                status={hasSubmission(carrierItem.id, 'presentation') ? 'completed' : 'not_started'}
                                statusText={hasSubmission(carrierItem.id, 'presentation') ? 'Submitted' : 'Not started'}
                                locked={isGroupLocked({ key: `master:${carrierItem.id}`, kind: 'master', contentId: carrierItem.id })}
                                lockReason={groupLockReason({ key: `master:${carrierItem.id}`, kind: 'master', contentId: carrierItem.id })}
                                onClick={() => openGroup('master', carrierItem.id)} activeFilter={contentFilter}
                              />
                              <ContentRow
                                stage="discussion" title="Master It · Discussion Board" targetDate={carrierItem.targetDate}
                                status="not_started" statusText="Join the conversation"
                                locked={isGroupLocked({ key: `discussion:${carrierItem.id}`, kind: 'discussion', contentId: carrierItem.id })}
                                lockReason={groupLockReason({ key: `discussion:${carrierItem.id}`, kind: 'discussion', contentId: carrierItem.id })}
                                onClick={() => openGroup('discussion', carrierItem.id)} activeFilter={contentFilter}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}

          {/* Course Discussion — parked pending future exploration; not deleted.
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={13} /> Course Discussion</div>
            <div style={emptyState}>Course discussion is not yet wired in this React page, so no discussion data is available here yet.</div>
          </div>
          */}

          {sectionDetailsOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setSectionDetailsOpen(false)}>
              <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Section Details</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>{selectedCourse.title}</div>
                  </div>
                  <button onClick={() => setSectionDetailsOpen(false)} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', display: 'inline-flex', padding: 0 }}><X size={20} /></button>
                </div>
                <div style={{ padding: '8px 20px 18px', display: 'flex', flexDirection: 'column' }}>
                  {[
                    ['Subject', selectedCourse.subject || '—'],
                    ['Grade level', selectedCourse.gradeLevel || '—'],
                    ['Credit hours', selectedCourse.creditHours ? String(selectedCourse.creditHours) : '—'],
                    ['Required hours', selectedCourse.requiredHours > 0 ? `${selectedCourse.requiredHours} hrs` : 'Not set'],
                    ['Mastery', `${selectedCourse.passMark || 80}%`],
                    ['Pacing', selectedEnrolment?.paceType ? `${selectedEnrolment.paceType}${selectedEnrolment.paceDaysPerLesson ? ` · ${selectedEnrolment.paceDaysPerLesson} days/lesson` : ''}` : 'Not set'],
                    ['Start date', selectedCourse.startDate || 'Not set'],
                    ['Due date', selectedEnrolment?.dueDate || 'Not set'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 0', borderTop: '1px solid #F0F4FA', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 16 }}>
                      <span style={{ color: '#7A92B0', fontWeight: 600 }}>{k}</span>
                      <span style={{ color: '#1A365E', fontWeight: 700, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {selectedCourse && activeLesson && activeGroupKind && !activePart && (() => {
        const kind = activeGroupKind
        const GroupIcon: LucideIcon = kind === 'learn' ? FileText : kind === 'show' ? Scale : kind === 'prove' ? Calculator : kind === 'master' ? Trophy : kind === 'discussion' ? MessageSquare : BookOpen
        const groupTitle = kind === 'learn' ? (activeLesson.title || 'Case Study')
          : kind === 'show' ? 'Socratic Seminar'
          : kind === 'prove' ? 'OMR Test'
          : kind === 'master' ? 'Presentation'
          : kind === 'discussion' ? 'Discussion Board'
          : activeLesson.title
        const groupTargetDate = kind === 'show' ? (activeLesson.socraticDate || activeLesson.targetDate)
          : kind === 'prove' ? activeLesson.omrTargetDate
          : kind === 'master' ? activeLesson.presentationTargetDate
          : activeLesson.targetDate

        type PartRow = { key: PartKind; title: string; status: RowStatus; statusText: string; score?: number | null; passMark?: number; targetDate?: string | null; isVideo?: boolean }
        let parts: PartRow[] = []
        if (kind === 'learn') {
          const notesDone = hasSubmission(activeLesson.id, 'case_study_notes')
          parts = [
            { key: 'caseStudyView', title: `${groupTitle}: View Case Study`, status: 'not_started', statusText: 'Not started', targetDate: activeLesson.targetDate },
            { key: 'caseStudyNotes', title: `${groupTitle}: Notes Upload`, status: notesDone ? 'completed' : 'not_started', statusText: notesDone ? 'Done' : 'Not started', targetDate: activeLesson.targetDate },
          ]
        } else if (kind === 'lesson') {
          const itemProgress = progress.find((entry) => entry.contentId === activeLesson.id && entry.studentId === session?.dbId)
          const tutorialDone = itemProgress?.status === 'completed'
          const itemHasMastery = activeLesson.hasMastery === true || activeLesson.hasMastery === 'TRUE'
          const masteryScore = itemProgress?.masteryScore != null && !Number.isNaN(Number(itemProgress.masteryScore)) ? Number(itemProgress.masteryScore) : null
          const masteryPassed = itemProgress?.masteryPassed === true || itemProgress?.masteryPassed === 'TRUE'
          const masteryAttempted = (itemProgress?.masteryAttempts ?? 0) > 0 || masteryScore !== null
          const notesDone = hasSubmission(activeLesson.id, 'lesson_notes')
          parts = [
            { key: 'tutorial', title: `${groupTitle}: Tutorial`, status: tutorialDone ? 'completed' : itemProgress?.status === 'in_progress' ? 'in_progress' : 'not_started', statusText: tutorialDone ? 'Completed' : itemProgress?.status === 'in_progress' ? 'In Progress' : 'Not started', targetDate: activeLesson.targetDate, isVideo: activeLesson.type === 'video' },
            ...(activeLesson.videoUrl ? [{ key: 'video' as PartKind, title: `${groupTitle}: Video`, status: 'not_started' as RowStatus, statusText: 'Not started', targetDate: activeLesson.targetDate, isVideo: true }] : []),
            { key: 'lessonNotes', title: `${groupTitle}: Notes Upload`, status: notesDone ? 'completed' : 'not_started', statusText: notesDone ? 'Done' : 'Not started', targetDate: activeLesson.notesTargetDate || activeLesson.targetDate },
            ...(itemHasMastery ? [{ key: 'mastery' as PartKind, title: `${groupTitle}: Mastery Test`, status: (masteryPassed ? 'completed' : masteryAttempted ? 'not_mastered' : 'not_started') as RowStatus, statusText: masteryPassed ? 'Passed' : masteryAttempted ? 'Not mastered · retake available' : 'Not started', score: masteryScore, passMark: activeLesson.masteryPassMark ?? selectedCourse.passMark, targetDate: activeLesson.masteryTargetDate || activeLesson.targetDate }] : []),
          ]
        } else if (kind === 'show') {
          parts = [{ key: 'socratic', title: 'Socratic Seminar', status: 'not_started', statusText: 'Not started', targetDate: activeLesson.socraticDate || activeLesson.targetDate }]
        } else if (kind === 'prove') {
          parts = [{ key: 'omr', title: 'OMR Test', status: 'not_started', statusText: 'Not started', targetDate: activeLesson.omrTargetDate }]
        } else if (kind === 'discussion') {
          parts = [{ key: 'discussion', title: 'Discussion Board', status: 'not_started', statusText: 'Join the conversation' }]
        } else {
          const submitted = hasSubmission(activeLesson.id, 'presentation')
          parts = [{ key: 'presentation', title: 'Presentation', status: submitted ? 'completed' : 'not_started', statusText: submitted ? 'Submitted' : 'Not started', targetDate: activeLesson.presentationTargetDate }]
        }

        const nextLocked = !!nextGroup && isGroupLocked(nextGroup)

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              {prevGroup ? (
                <button onClick={() => openGroup(prevGroup.kind, prevGroup.contentId)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', maxWidth: '38%' }}>
                  <ArrowLeft size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {(() => { const D = groupDisplay(prevGroup); const Icon = D.icon; return <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F0F4FA', color: '#5A7290', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={14} /></span> })()}
                    <span style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Previous Activity</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupDisplay(prevGroup).title}</div>
                    </span>
                  </span>
                </button>
              ) : <span />}
              {nextGroup ? (
                <button
                  onClick={() => !nextLocked && openGroup(nextGroup.kind, nextGroup.contentId)}
                  disabled={nextLocked}
                  title={nextLocked ? groupLockReason(nextGroup) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: nextLocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'right', maxWidth: '38%', opacity: nextLocked ? .5 : 1 }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Next Activity</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupDisplay(nextGroup).title}</div>
                    </span>
                    {nextLocked
                      ? <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F0F4FA', color: '#5A7290', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Lock size={14} /></span>
                      : (() => { const D = groupDisplay(nextGroup); const Icon = D.icon; return <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F0F4FA', color: '#5A7290', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={14} /></span> })()}
                  </span>
                  <ArrowRight size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                </button>
              ) : <span />}
            </div>
            {nextLocked && (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', marginTop: -12 }}>
                {groupLockReason(nextGroup!)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <span style={{ width: 56, height: 56, borderRadius: 14, background: '#F0F4FA', color: SP_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GroupIcon size={26} />
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', marginTop: 4 }}>{groupTitle}</div>
              {groupTargetDate && (
                <div style={{ fontSize: 16, color: '#5A7290' }}><strong style={{ color: '#1A365E' }}>Target Date:</strong> {formatLongDate(groupTargetDate) || groupTargetDate}</div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640, width: '100%', margin: '0 auto' }}>
              {parts.map((part) => {
                // Only surface a row's own date when it's actually an override the
                // teacher set — otherwise it just duplicates the header above.
                const rowDate = part.targetDate && part.targetDate !== groupTargetDate ? part.targetDate : null
                return (
                  <OverviewPartRow
                    key={part.key}
                    title={part.title} status={part.status} statusText={part.statusText}
                    score={part.score} passMark={part.passMark} targetDate={rowDate} isVideo={part.isVideo}
                    onClick={() => openPart(activeLesson, part.key)}
                  />
                )
              })}
            </div>

            <button onClick={closeActivity} style={{ alignSelf: 'center', padding: '10px 32px', background: '#fff', color: '#1A365E', border: '1.5px solid #E4EAF2', borderRadius: 24, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Close
            </button>
          </div>
        )
      })()}

      {selectedCourse && activeLesson && activePart === 'tutorial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={15} /> {activeLesson.title} · Tutorial</div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,.78)' }}>{activeLesson.type}{activeLesson.estimatedMins ? ` · ${activeLesson.estimatedMins} min` : ''}</div>
              </div>
            </div>
          </div>

          <LessonPreviewContent item={activeLesson} />

          <div style={{ ...card, padding: 16 }}>
            {(() => {
              const itemProgress = progress.find((entry) => entry.contentId === activeLesson.id && entry.studentId === session?.dbId)
              const done = itemProgress?.status === 'completed'
              const elapsedMs = lessonElapsedMs(session?.dbId, activeLesson.id, openedAtMap)
              const requiredMs = (activeLesson.estimatedMins ?? 0) * 60 * 1000
              const canMarkDone = !activeLesson.estimatedMins || elapsedMs >= requiredMs
              const remainingMs = Math.max(0, requiredMs - elapsedMs)
              const badge = contentStatus(activeLesson, itemProgress, selectedCourse.passMark || 80)
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Lesson Progress</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 15, color: '#7A92B0' }}>
                      <span>{activeLesson.type.charAt(0).toUpperCase() + activeLesson.type.slice(1)}</span>
                      {activeLesson.estimatedMins ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={11} /> {activeLesson.estimatedMins} min required</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={11} /> No minimum time</span>}
                      {badge ? <span style={{ color: badge.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><badge.icon size={11} /> {badge.text}</span> : null}
                      {activeLesson.estimatedMins ? (
                        <span style={{ color: canMarkDone ? '#059669' : '#D97706', fontWeight: 700 }}>
                          {canMarkDone ? 'Timer complete' : `Remaining ${formatRemaining(remainingMs)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!readOnly && <button disabled={!done && !canMarkDone} onClick={() => void markComplete(activeLesson)} title={readOnly ? 'View-only access' : undefined} style={{ padding: '9px 16px', background: done ? '#DCFCE7' : canMarkDone ? '#1A365E' : '#E5E7EB', color: done ? '#059669' : canMarkDone ? '#fff' : '#94A3B8', border: `1px solid ${done ? '#86EFAC' : canMarkDone ? '#1A365E' : '#E5E7EB'}`, borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: done || canMarkDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} strokeWidth={3} /> Done</span> : 'Mark done'}
                  </button>}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Video size={15} /> {activeLesson.title} · Video</div>
            </div>
          </div>
          <div style={{ ...card, padding: 12 }}>
            {activeLesson.videoUrl ? (
              <video controls src={activeLesson.videoUrl} style={{ width: '100%', borderRadius: 10, background: '#000', display: 'block' }} />
            ) : (
              <div style={{ ...emptyState }}>No video has been uploaded for this lesson yet.</div>
            )}
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'mastery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Target size={15} /> {activeLesson.title} · Mastery Test</div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,.78)' }}>Pass mark: {activeLesson.masteryPassMark ?? 80}%</div>
            </div>
          </div>

          <MasteryQuiz
            item={activeLesson}
            prog={progress.find((p) => p.contentId === activeLesson.id && p.studentId === session?.dbId)}
            studentId={session?.dbId ?? ''}
            coursePassMark={selectedCourse.passMark || 80}
            onUpdate={(updates) => handleProgressUpdate(activeLesson.id, updates)}
          />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'lessonNotes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0891B2,#0E7490)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} /> {activeLesson.title} · Show it: Notes</div>
            </div>
          </div>
          <div style={{ ...card, padding: '14px 16px' }}>
            <NotesUploadRow contentId={activeLesson.id} kind="lesson_notes" studentId={session?.dbId ?? ''} submission={mySubmissions.find((s) => s.contentId === activeLesson.id && s.kind === 'lesson_notes')} onSubmitted={onSubmissionAdded} />
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'caseStudyView' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Search size={15} /> Learn it · Case Study</div>
            </div>
          </div>
          <CaseStudyDocPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'caseStudyNotes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} /> Learn it · Show it: Notes</div>
            </div>
          </div>
          <a href="/LMS/Case Study Note-Taking Guide.pdf" target="_blank" rel="noreferrer" style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <FileText size={18} color="#1A365E" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Case Study Note-Taking Guide</div>
              <div style={{ fontSize: 13, color: '#7A92B0' }}>How to organize and score your notebook — worth 15% of your grade</div>
            </div>
            <ExternalLink size={14} color="#7A92B0" />
          </a>
          <div style={{ ...card, padding: '14px 16px' }}>
            <NotesUploadRow contentId={activeLesson.id} kind="case_study_notes" studentId={session?.dbId ?? ''} submission={mySubmissions.find((s) => s.contentId === activeLesson.id && s.kind === 'case_study_notes')} onSubmitted={onSubmissionAdded} />
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'socratic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={15} /> Show it · Socratic Seminar</div>
            </div>
          </div>
          <SocraticPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'omr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={15} /> Prove it · OMR Test</div>
            </div>
          </div>
          <OmrPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'presentation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={15} /> Master it · Presentation</div>
            </div>
          </div>
          <PresentationPanel carrierItem={activeLesson} studentId={session?.dbId ?? ''} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'discussion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={15} /> Master it · Discussion Board</div>
            </div>
          </div>
          <DiscussionBoardPanel carrierItem={activeLesson} studentId={session?.dbId ?? ''} />
        </div>
      )}
    </div>
  )
}
