import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2, Circle, Rabbit, Footprints, Turtle, Hourglass, ClipboardList,
  Check, Target, Timer, BookOpen, Scale, Calculator,
  Upload, Link2, Trophy, Flag, FileText, CalendarDays, Megaphone, FolderKanban,
  FolderOpen, PartyPopper, Frown, RefreshCw, X, Play, Video, Link as LinkIcon,
  Paperclip, HelpCircle, MonitorPlay, ChevronDown, ChevronRight, Search,
  ArrowLeft, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/uploadFile'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import { SUBJECT_COLORS, isActiveBool, type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress, type LMSQuestion } from '@/pages/lms/lmsStore'

const CONTENT_TYPE_ICONS: Record<string, LucideIcon> = {
  video: Video, article: FileText, link: LinkIcon, file: Paperclip, quiz: HelpCircle, presentation: MonitorPlay,
}
import { ACTIVE_SCORE_COMPONENT_TYPES, getEffectiveRubric, finalGrade, type ScoreComponentType, type RubricOverrides } from '@/lib/lms/caseStudyRubric'
import { toLegacyStudentGradeValue } from '@/types/student'
import { K5MyLearningPage } from '@/pages/student-portal/K5MyLearningPage'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 6px rgba(26,54,94,.06)' }
const emptyState: React.CSSProperties = { padding: '16px 18px', borderRadius: 10, background: '#F8FAFC', border: '1px dashed #D7E0EA', fontSize: 12, color: '#7A92B0' }
const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'

function getLessonTimerKey(studentId: string, lessonId: string) {
  return `sp_learning_started_${studentId}_${lessonId}`
}

// Tree row styles for the per-module outline (Learn It / Do It / Show It / Prove It /
// Master It). sectionLabelStyle marks a category; partRowStyle is a clickable leaf one
// level in; partRowStyleNested is a leaf under a lesson, one level deeper still.
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1,
  padding: '10px 18px 4px', display: 'flex', alignItems: 'center', gap: 4,
}
const partRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 18px 6px 40px',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  fontSize: 12, color: '#3D5475', fontWeight: 600,
}
const partRowStyleNested: React.CSSProperties = { ...partRowStyle, padding: '6px 18px 6px 64px', fontSize: 11, color: '#5A7290', fontWeight: 400 }
const lessonHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 18px 8px 40px',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
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
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.passed ? 'Congratulations!' : 'Not quite there yet'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
            {result.passed ? `You passed with ${result.score}%` : `You scored ${result.score}% — you need ${passMark}% to pass`}
          </div>
          {!result.passed && remainingRetakes > 0 && (
            <button onClick={retry} style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} /> Try Again ({remainingRetakes} attempt{remainingRetakes !== 1 ? 's' : ''} left)</span>
            </button>
          )}
          {!result.passed && remainingRetakes <= 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>No more attempts remaining. Contact your teacher.</div>
          )}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 11, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={12} /> Answer Review</div>
          {questions.map((q, qi) => {
            const isShort = q.type === 'short' || !q.opts?.length
            const studentAns = answers[qi]
            const correct = !isShort && studentAns === q.ans
            return (
              <div key={qi} style={{ padding: '12px 14px', borderBottom: qi < questions.length - 1 ? '1px solid #F0F4FA' : 'none', background: isShort ? '#F7F9FC' : correct ? '#F0FDF4' : '#FFF7F7' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isShort ? <FileText size={11} /> : correct ? <CheckCircle2 size={11} color="#059669" /> : <X size={11} color="#DC2626" />} Q{qi + 1}: {q.q}
                </div>
                {isShort ? (
                  <>
                    <div style={{ fontSize: 10, color: '#5A7290' }}>Short answer — teacher will review your response.</div>
                    {studentAns !== undefined && <div style={{ fontSize: 10, color: '#3D5475', marginTop: 4, padding: '5px 8px', background: '#F7F9FC', borderRadius: 6 }}><em>{String(studentAns)}</em></div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: correct ? '#059669' : '#DC2626', marginBottom: 3 }}>
                      Your answer: {studentAns !== undefined ? `${String.fromCharCode(65 + Number(studentAns))}. ${q.opts?.[Number(studentAns)] ?? ''}` : 'Not answered'}
                    </div>
                    {!correct && <div style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>Correct answer: {String.fromCharCode(65 + (q.ans ?? 0))}. {q.opts?.[q.ans ?? 0] ?? ''}</div>}
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: timeLeft < 60 ? SP_RED : '#D97706', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      {timedOut && (
        <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 11, fontWeight: 700, color: SP_RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={12} /> Time's up! Please submit your answers.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0' }}>Question {qIdx + 1} of {questions.length}</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: i === qIdx ? 20 : 8, height: 8, borderRadius: 4, background: i < qIdx ? '#059669' : i === qIdx ? '#1A365E' : '#E4EAF2', transition: 'all .3s' }} />
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', lineHeight: 1.6, marginBottom: 14 }}>{currentQ.q}</div>
        {isShort ? (
          <textarea
            rows={3}
            placeholder="Type your answer here..."
            value={String(answers[qIdx] ?? '')}
            onChange={(e) => setAnswers((p) => ({ ...p, [qIdx]: e.target.value }))}
            style={{ width: '100%', padding: 10, border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'Poppins,sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
          />
        ) : (
          currentQ.opts?.map((opt, oi) => {
            const selected = answers[qIdx] === oi
            return (
              <label
                key={oi}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, color: selected ? '#1A365E' : '#3D5475', marginBottom: 6, background: selected ? '#EEF3FF' : '#fff', border: `1.5px solid ${selected ? '#1A365E' : '#E4EAF2'}`, transition: 'all .15s' }}
                onClick={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))}
              >
                <input type="radio" name={`q_${qIdx}`} value={oi} checked={selected} onChange={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))} style={{ flexShrink: 0, accentColor: '#1A365E' }} readOnly />
                <span style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', background: '#F0F4FA', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
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
        style={{ width: '100%', padding: 11, background: saving ? '#94A3B8' : (answers[qIdx] !== undefined || timedOut) ? '#1A365E' : '#E4EAF2', color: (answers[qIdx] !== undefined || timedOut) ? '#fff' : '#94A3B8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: readOnly || (answers[qIdx] === undefined && !timedOut) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: readOnly ? 0.5 : 1 }}
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
interface CSPostData { id: string; studentId: string; authorName: string; isMine: boolean; body: string; parentPostId: string | null; createdAt: string }
interface CSAppealData { id: string; componentType: string; message: string; status: 'open' | 'resolved'; adminReply: string | null }
interface CaseStudyBundle {
  lesson: { id: string; title: string; caseStudyUrl: string | null; moduleDescription: string | null; omrFormUrl: string | null; socraticDate: string | null; socraticBrief: string | null; presentationBrief: string | null }
  scores: CSScoreData[]
  discussion: { myStudentId: string; posts: CSPostData[] }
  presentation: { note: string | null; linkUrl: string | null; submittedAt: string } | null
  appeals: CSAppealData[]
}

interface MySubmission { contentId: string; kind: string; note: string | null; linkUrl: string | null; submittedAt: string }

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
        <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Submitted {new Date(submission.submittedAt).toLocaleDateString()}</div>
        {submission.note && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{submission.note}</div>}
        {submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> View your notes</a>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes for your teacher (optional)..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${file ? '#1DBD6A' : '#CBD5E0'}`, background: file ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 11, color: file ? '#1DBD6A' : '#7A92B0', fontWeight: file ? 700 : 400 }}>
        <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
        {file ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={12} /> {file.name}</span> : '+ Choose file (PDF, image…)'}
      </label>
      <button onClick={() => void submit()} disabled={readOnly || submitting || !file} style={{ padding: '9px 16px', background: file && !readOnly ? '#1A365E' : '#E4EAF2', color: file && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: file && !readOnly ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
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
      <div style={{ padding: '10px 16px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 800, color: '#1A365E' }}>Explore the {carrierItem.title} case study</div>
      {caseStudyUrl ? (
        <>
          <div style={{ position: 'relative', paddingBottom: '65%', height: 0 }}>
            <iframe src={getCaseStudyEmbedUrl(caseStudyUrl)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} title="Case Study" loading="lazy" />
          </div>
          <div style={{ padding: '8px 16px', textAlign: 'right' }}>
            <a href={caseStudyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> Open in new tab</a>
          </div>
        </>
      ) : (
        <div style={{ padding: 20, color: '#94A3B8', fontSize: 12 }}>No case study document has been uploaded yet.</div>
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
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>Rubric — {cat.label} ({cat.weight} pts)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cat.criteria.map((c) => (
          <span key={c.key} style={{ fontSize: 11, fontWeight: 700, color: '#3D5475', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 6, padding: '4px 8px' }}>{c.label}: {c.max} pts</span>
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
        <div style={{ ...card, padding: '14px 16px', fontSize: 12, color: '#3D5475', lineHeight: 1.6 }}>{carrierItem.socraticBrief}</div>
      ) : (
        <div style={{ ...card, ...emptyState }}>No activity description has been added yet.</div>
      )}
      {carrierItem.socraticDate && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'flex', alignItems: 'center', gap: 4 }}><CalendarDays size={11} /> Scheduled {carrierItem.socraticDate}</div>
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
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
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
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.passed ? 'Congratulations!' : 'Not quite there yet'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
          {result.passed ? `You passed with ${result.score}% (${result.correct}/${result.total} correct)` : `You scored ${result.score}% (${result.correct}/${result.total} correct) — you need ${passMark}% to pass`}
        </div>
        {!result.passed && remainingAttempts > 0 && (
          <button onClick={retry} style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} /> Try Again ({remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} left)</span>
          </button>
        )}
        {!result.passed && remainingAttempts <= 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>No more attempts remaining. Contact your teacher.</div>
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
            <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: timeLeft < 60 ? SP_RED : '#D97706', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      {timedOut && (
        <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 11, fontWeight: 700, color: SP_RED, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Timer size={12} /> Time's up! Please submit your answers.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0' }}>Question {qIdx + 1} of {questions.length}</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: i === qIdx ? 20 : 8, height: 8, borderRadius: 4, background: i < qIdx ? '#059669' : i === qIdx ? '#1A365E' : '#E4EAF2', transition: 'all .3s' }} />
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', lineHeight: 1.6, marginBottom: 14 }}>{currentQ.q}</div>
        {currentQ.opts.map((opt, oi) => {
          const selected = answers[qIdx] === oi
          return (
            <label
              key={oi}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, color: selected ? '#1A365E' : '#3D5475', marginBottom: 6, background: selected ? '#EEF3FF' : '#fff', border: `1.5px solid ${selected ? '#1A365E' : '#E4EAF2'}`, transition: 'all .15s' }}
              onClick={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))}
            >
              <input type="radio" name={`omr_q_${qIdx}`} value={oi} checked={selected} onChange={() => setAnswers((p) => ({ ...p, [qIdx]: oi }))} style={{ flexShrink: 0, accentColor: '#1A365E' }} readOnly />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', background: '#F0F4FA', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </label>
          )
        })}
      </div>
      <button
        onClick={isLast || timedOut ? () => void submitQuiz(answers) : () => setQIdx((p) => p + 1)}
        disabled={readOnly || saving || (!timedOut && answers[qIdx] === undefined)}
        title={readOnly ? 'View-only access' : undefined}
        style={{ width: '100%', padding: 11, background: saving ? '#94A3B8' : (answers[qIdx] !== undefined || timedOut) ? '#1A365E' : '#E4EAF2', color: (answers[qIdx] !== undefined || timedOut) ? '#fff' : '#94A3B8', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: readOnly || (answers[qIdx] === undefined && !timedOut) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: readOnly ? 0.5 : 1 }}
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
  const { loading, bundle, refresh, scoreByType, renderAppealControl } = useModuleScoring(carrierItem)
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

  return (
    <>
      {carrierItem.presentationBrief && (
        <div style={{ ...card, padding: '14px 16px', fontSize: 12, color: '#3D5475', lineHeight: 1.6 }}>{carrierItem.presentationBrief}</div>
      )}
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={13} /> Submit Final Presentation</div>
        {bundle.presentation ? (
          <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Submitted {new Date(bundle.presentation.submittedAt).toLocaleDateString()}</div>
            {bundle.presentation.note && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{bundle.presentation.note}</div>}
            {bundle.presentation.linkUrl && <a href={bundle.presentation.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={11} /> View your presentation</a>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea rows={2} value={presNote} onChange={(e) => setPresNote(e.target.value)} placeholder="Notes for your teacher (optional)..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${presFile ? '#1DBD6A' : '#CBD5E0'}`, background: presFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 11, color: presFile ? '#1DBD6A' : '#7A92B0', fontWeight: presFile ? 700 : 400 }}>
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPresFile(f) }} />
              {presFile ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={12} /> {presFile.name}</span> : '+ Choose file (PDF, PPT…)'}
            </label>
            <button onClick={() => void submitPresentation()} disabled={readOnly || presSubmitting || !presFile} style={{ padding: '9px 16px', background: presFile && !readOnly ? '#1A365E' : '#E4EAF2', color: presFile && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: presFile && !readOnly ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
              {presSubmitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hourglass size={12} /> Uploading…</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Upload size={12} /> Submit Presentation</span>}
            </button>
          </div>
        )}
      </div>

      <CSScoreBlock type="presentation" overrides={carrierItem.rubricOverrides} icon={Trophy} title="Presentation Score" order={3} score={scoreByType.presentation} appealControl={renderAppealControl('presentation')} />

      <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A7290' }}>Module Final Grade</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: overallFinalGrade !== null ? (overallFinalGrade >= 70 ? '#059669' : SP_RED) : '#94A3B8' }}>{overallFinalGrade !== null ? `${overallFinalGrade}/100` : '—'}</span>
      </div>
    </>
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
      <div style={{ marginTop: 8, padding: '8px 10px', background: appeal.status === 'open' ? '#FEF3C7' : '#F0FDF4', border: `1px solid ${appeal.status === 'open' ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 8, fontSize: 11 }}>
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
          <textarea rows={2} value={draftText} onChange={(e) => onDraftChange(e.target.value)} placeholder="Explain the discrepancy you'd like reviewed..." style={{ width: '100%', padding: '7px 9px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onFile} disabled={filing} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{filing ? 'Sending…' : 'Send Appeal'}</button>
            <button onClick={onCancel} style={{ padding: '5px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={onOpen} disabled={readOnly} style={{ padding: '4px 10px', background: 'none', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: readOnly ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Flag size={10} /> Appeal this score</button>
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
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} /> {order}. {title}</div>
        {isScored
          ? <span style={{ background: '#DCFCE7', color: '#059669', fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 20 }}>{score!.subtotal}/{cat.weight}</span>
          : <span style={{ background: '#F0F4FA', color: '#7A92B0', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Hourglass size={10} /> Pending</span>}
      </div>
      {isScored && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {cat.criteria.map((c) => (
            <span key={c.key} style={{ fontSize: 10, fontWeight: 700, color: '#3D5475', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 6, padding: '4px 8px' }}>{c.label}: {score!.criteriaScores[c.key] ?? 0}/{c.max}</span>
          ))}
        </div>
      )}
      {isScored && score!.feedback && (
        <div style={{ background: '#EEF3FF', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap' }}>
          <strong style={{ color: '#1A365E' }}>Teacher feedback:</strong> {score!.feedback}
        </div>
      )}
      {!isScored && <div style={{ fontSize: 11, color: '#94A3B8' }}>Your teacher hasn't scored this yet.</div>}
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
        ? <div style={{ padding: 20, lineHeight: 1.7, fontSize: 13, color: '#1A365E', whiteSpace: 'pre-wrap' }}>{content}</div>
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
                  <div style={{ color: '#9EB3C8', fontSize: 12, fontWeight: 600 }}>Loading slide…</div>
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
                <button onClick={() => { setPdfLoading(true); setSlideIdx(p => Math.max(0, p - 1)) }} disabled={isFirst2} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isFirst2 ? 'not-allowed' : 'pointer', background: isFirst2 ? '#E4EAF2' : '#1A365E', color: isFirst2 ? '#94A3B8' : '#fff' }}>◀ Prev</button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
                <button onClick={() => { setPdfLoading(true); setSlideIdx(p => Math.min(slideCount - 1, p + 1)) }} disabled={isLast2} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isLast2 ? 'not-allowed' : 'pointer', background: isLast2 ? '#E4EAF2' : '#1A365E', color: isLast2 ? '#94A3B8' : '#fff' }}>Next ▶</button>
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
              <button onClick={() => setSlideIdx((p) => Math.max(0, p - 1))} disabled={isFirst} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isFirst ? 'not-allowed' : 'pointer', background: isFirst ? '#E4EAF2' : '#1A365E', color: isFirst ? '#94A3B8' : '#fff' }}>◀ Prev</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
              <button onClick={() => setSlideIdx((p) => Math.min(slideCount - 1, p + 1))} disabled={isLast} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isLast ? 'not-allowed' : 'pointer', background: isLast ? '#E4EAF2' : '#1A365E', color: isLast ? '#94A3B8' : '#fff' }}>Next ▶</button>
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
          <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Loading external content inline...</div>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              {q.opts && q.opts.map((opt, oi) => (
                <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
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
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{item.unitTitle || 'Lesson Content'}</span>
      </div>
      {renderContent()}
    </div>
  )
}

export function SPMyLearningPage() {
  const { session, getToken } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const [courses, setCourses] = useState<LMSCourse[]>([])
  const [content, setContent] = useState<LMSContent[]>([])
  const [progress, setProgress] = useState<LMSProgress[]>([])
  const [enrolments, setEnrolments] = useState<LMSEnrolment[]>([])
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [activePart, setActivePart] = useState<'tutorial' | 'mastery' | 'lessonNotes' | 'caseStudyView' | 'caseStudyNotes' | 'socratic' | 'omr' | 'presentation' | null>(null)
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
    const allEnrolments: LMSEnrolment[] = (enrolData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      courseId: r.course_id as string,
      targetType: r.target_type as LMSEnrolment['targetType'],
      targetValue: r.target_value as string,
      assignedAt: (r.assigned_at as string) ?? '',
      paceType: (r.pace_type as string) ?? '',
      dueDate: (r.due_date as string) ?? '',
      active: r.active as boolean,
    }))

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

    const mappedCourses: LMSCourse[] = (cData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      groupId: (r.group_id as string) ?? null,
      title: (r.title as string) ?? '',
      subject: (r.subject as string) ?? '',
      gradeLevel: (r.grade_level as string) ?? '',
      description: (r.description as string) ?? '',
      passMark: Number(r.pass_mark ?? 70),
      creditHours: Number(r.credit_hours ?? 0),
      requiredHours: Number(r.required_hours ?? 0),
      status: (r.status as LMSCourse['status']) ?? 'Draft',
      announcement: (r.announcement as string) ?? '',
    }))

    const publishedCourses = mappedCourses.filter((course) => course.status?.toLowerCase() === 'published')

    const mappedContent: LMSContent[] = (coData ?? []).map((r: Record<string, unknown>) => {
      const extra = (() => {
        try { return JSON.parse(((r.extra as string) || '{}')) as Record<string, unknown> } catch { return (r.extra as Record<string, unknown>) ?? {} }
      })()
      return {
        id: r.id as string,
        courseId: r.course_id as string,
        title: (r.title as string) ?? '',
        type: (r.type as LMSContent['type']) ?? 'article',
        url: (extra.url as string) ?? '',
        body: (extra.body as string) ?? '',
        unitTitle: (r.unit_title as string) ?? '',
        unitOrder: r.unit_order == null ? undefined : Number(r.unit_order),
        order: Number(r.order_idx ?? 0),
        estimatedMins: Number(extra.estimatedMins ?? 0) || undefined,
        moduleTitle: (r.module_title as string) ?? '',
        moduleOrder: Number(r.module_order ?? 0) || undefined,
        hasMastery: extra.hasMastery as boolean | 'TRUE' | undefined,
        masteryPassMark: Number(extra.masteryPassMark ?? 0) || undefined,
        masteryRetakes: extra.masteryRetakes !== undefined ? Number(extra.masteryRetakes) : undefined,
        masteryTimeLimit: Number(extra.masteryTimeLimit ?? 0) || undefined,
        masteryWeight: Number(extra.masteryWeight ?? 0) || undefined,
        masteryQuizJson: (extra.masteryQuizJson as string) ?? undefined,
        quizJson: (extra.quizJson as string) ?? undefined,
        hasAssignment: extra.hasAssignment as boolean | 'TRUE' | undefined,
        assignInstructions: (extra.assignInstructions as string) ?? undefined,
        assignMaxScore: Number(extra.assignMaxScore ?? 0) || undefined,
        assignWeight: Number(extra.assignWeight ?? 0) || undefined,
        assignRubric: (extra.assignRubric as string) ?? undefined,
        caseStudyUrl: (extra.caseStudyUrl as string) ?? undefined,
        caseStudyFileName: (extra.caseStudyFileName as string) ?? undefined,
        moduleDescription: (extra.moduleDescription as string) ?? undefined,
        omrFormUrl: (extra.omrFormUrl as string) ?? undefined,
        socraticDate: (extra.socraticDate as string) ?? undefined,
        socraticBrief: (extra.socraticBrief as string) ?? undefined,
        presentationBrief: (extra.presentationBrief as string) ?? undefined,
      }
    })

    const mappedProgress: LMSProgress[] = (prData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      studentId: r.student_id as string,
      courseId: r.course_id as string,
      contentId: r.content_id as string,
      status: (r.status as LMSProgress['status']) ?? 'not_started',
      masteryScore: r.mastery_score as number | null,
      masteryPassed: r.mastery_passed === true,
      assignScore: r.assign_score as number | null,
      assignStatus: (r.assign_status as string) ?? undefined,
      masteryAttempts: Number(r.mastery_attempts ?? 0),
      timeSpentMins: Number(r.time_spent_mins ?? 0),
    }))

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

  function openPart(item: LMSContent, part: 'tutorial' | 'mastery' | 'lessonNotes' | 'caseStudyView' | 'caseStudyNotes' | 'socratic' | 'omr' | 'presentation') {
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

  function backToLessonList() {
    setActiveLessonId(null)
    setActivePart(null)
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

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: '#7A92B0', fontSize: 13 }}>Loading your courses…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E', display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} /> My Learning</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you</div>
        </div>
        {!selectedCourse && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            style={{ padding: '8px 12px', border: '1.5px solid #E4EAF2', borderRadius: 9, fontSize: 12, minWidth: 190, outline: 'none', fontFamily: 'Poppins,sans-serif' }}
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
                      fontSize: 10,
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
              {paceSummary.ahead > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DCFCE7', borderRadius: 10, border: '1px solid #059669' }}><Rabbit size={16} color="#059669" /><div><div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>{paceSummary.ahead}</div><div style={{ fontSize: 9, color: '#059669' }}>Ahead of Pace</div></div></div>}
              {paceSummary.on > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DBEAFE', borderRadius: 10, border: '1px solid #2563EB' }}><Footprints size={16} color="#2563EB" /><div><div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB' }}>{paceSummary.on}</div><div style={{ fontSize: 9, color: '#2563EB' }}>On Pace</div></div></div>}
              {paceSummary.off > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEE2E2', borderRadius: 10, border: '1px solid #D61F31' }}><Turtle size={16} color="#D61F31" /><div><div style={{ fontSize: 11, fontWeight: 800, color: '#D61F31' }}>{paceSummary.off}</div><div style={{ fontSize: 9, color: '#D61F31' }}>Off Pace</div></div></div>}
              {paceSummary.notStarted > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F1F5F9', borderRadius: 10, border: '1px solid #94A3B8' }}><Circle size={16} color="#64748B" /><div><div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>{paceSummary.notStarted}</div><div style={{ fontSize: 9, color: '#64748B' }}>Not Started</div></div></div>}
            </div>
          )}

          {courses.length === 0 ? (
            <div style={{ ...card, padding: 48, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: '#94A3B8' }}><BookOpen size={40} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No courses assigned yet</div>
              <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 6 }}>Once courses are assigned, they will appear here.</div>
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
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>{course.title}</div>
                      <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 10 }}>{course.subject}{course.gradeLevel ? ` · ${course.gradeLevel}` : ''}</div>
                      <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 10, lineHeight: 1.5 }}>{course.description ? `${course.description.slice(0, 80)}${course.description.length > 80 ? '…' : ''}` : 'No course description available yet.'}</div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: '#7A92B0' }}>{doneCount}/{courseContent.length} lessons</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : SP_NAVY }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : subjectCol, borderRadius: 3, transition: 'width .5s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#7A92B0', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={10} /> {courseContent.length} lessons</span>
                          {enrolment?.dueDate && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={10} /> Due: {enrolment.dueDate}</span>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: pace.color, background: pace.bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', border: `1px solid ${pace.color}33`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <pace.icon size={11} /> {pace.label}
                        </span>
                      </div>
                      {pendingAssignments > 0 && (
                        <div style={{ marginBottom: 6, padding: '5px 10px', background: '#FEF3C7', borderRadius: 7, fontSize: 10, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ClipboardList size={12} /><span>{pendingAssignments} assignment{pendingAssignments !== 1 ? 's' : ''} need attention</span>
                        </div>
                      )}
                      {course.announcement?.trim() ? (
                        <div style={{ marginBottom: 8, padding: '7px 10px', background: '#1A365E0D', borderLeft: '3px solid #1A365E', borderRadius: '0 7px 7px 0', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <Megaphone size={13} color="#1A365E" style={{ flexShrink: 0 }} />
                          <div style={{ fontSize: 10, color: '#1A365E', lineHeight: 1.5 }}>{course.announcement.length > 80 ? `${course.announcement.slice(0, 80)}…` : course.announcement}</div>
                        </div>
                      ) : (
                        <div style={{ ...emptyState, marginBottom: 8, padding: '8px 10px' }}>No course announcement posted yet.</div>
                      )}
                      <div style={{ marginTop: 8, padding: '8px 12px', background: subjectCol, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
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

      {selectedCourse && !activeLesson && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedCourse.announcement?.trim() ? (
            <div style={{ background: 'linear-gradient(135deg,#1A365E,#0F2240)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Megaphone size={20} color="#fff" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Course Announcement</div>
                <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>{selectedCourse.announcement}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course announcement has been posted for this course yet.</div>
          )}

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ height: 6, background: SUBJECT_COLORS[selectedCourse.subject] || SP_NAVY }} />
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setActiveCourse(null)} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>{selectedCourse.title}</div>
                <div style={{ fontSize: 11, color: '#7A92B0' }}>{selectedCourse.subject || 'No subject'} · Pass: {selectedCourse.passMark || 80}%</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>
                {courseItems.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId && entry.status === 'completed')).length} / {courseItems.length} lessons completed
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: courseProgress(selectedCourse) === 100 ? SP_GREEN : courseProgress(selectedCourse) >= 50 ? '#D97706' : SP_NAVY }}>{courseProgress(selectedCourse)}%</div>
            </div>
            <div style={{ height: 8, background: '#F0F4FA', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${courseProgress(selectedCourse)}%`, background: courseProgress(selectedCourse) === 100 ? SP_GREEN : courseProgress(selectedCourse) >= 50 ? '#D97706' : SP_NAVY, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Average mastery</strong><br />
                {(() => {
                  const mastery = progress.filter((entry) => entry.courseId === (selectedCourse.groupId ?? selectedCourse.id) && entry.studentId === session?.dbId && entry.masteryScore != null)
                  return mastery.length ? `${Math.round(mastery.reduce((sum, entry) => sum + Number(entry.masteryScore ?? 0), 0) / mastery.length)}%` : 'No mastery data available'
                })()}
              </div>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Time requirement</strong><br />
                {selectedCourse.requiredHours > 0 ? `${selectedCourse.requiredHours} hrs required` : 'No time requirement set'}
              </div>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Due date</strong><br />
                {selectedEnrolment?.dueDate || 'No due date set'}
              </div>
            </div>
          </div>

          {selectedCourse.description ? (
            <div style={{ ...card, padding: '14px 16px', fontSize: 12, color: '#5A7290', lineHeight: 1.6 }}>{selectedCourse.description}</div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course description is available yet.</div>
          )}

          {courseItems.length === 0 ? (
            <div style={{ ...card, ...emptyState }}>No lessons or learning content are available for this course yet.</div>
          ) : (
            groupedModules.map((module, moduleIdx) => (
              <div key={`${module.label || 'default'}-${moduleIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {module.label ? <div style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}><FolderKanban size={11} /> {module.label}</div> : null}
                {[...module.units.entries()].map(([unit, items]) => {
                  const carrierItem = items.find((i) => i.hasAssignment === true || i.hasAssignment === 'TRUE') ?? null
                  const lessonItems = items.filter((i) => i !== carrierItem)
                  const moduleKey = `unit:${unit}`
                  const moduleExpanded = !collapsedLessonIds.has(moduleKey)
                  const hasSubmission = (contentId: string, kind: string) => mySubmissions.some((s) => s.contentId === contentId && s.kind === kind)
                  return (
                    <div key={unit} style={{ ...card, overflow: 'hidden' }}>
                      <button
                        onClick={() => toggleLessonExpanded(moduleKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '14px 18px', background: '#F7F9FC', border: 'none', borderBottom: moduleExpanded ? '1px solid #E4EAF2' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                      >
                        <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E4EAF2', borderRadius: 4, background: '#fff', color: '#5A7290' }}>{moduleExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                        <FolderOpen size={13} style={{ flexShrink: 0, color: '#5A7290' }} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', flex: 1, minWidth: 0 }}>{unit}</span>
                      </button>
                      {moduleExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
                          {carrierItem?.moduleDescription && (
                            <div style={{ padding: '10px 18px', fontSize: 12, color: '#5A7290', lineHeight: 1.6, borderBottom: '1px solid #F0F4FA' }}>{carrierItem.moduleDescription}</div>
                          )}

                          {carrierItem && (
                            <>
                              <div style={sectionLabelStyle}><Search size={11} /> Learn It</div>
                              <button onClick={() => openPart(carrierItem, 'caseStudyView')} style={partRowStyle}>
                                <FileText size={14} />
                                <span>View case study</span>
                              </button>
                              <button onClick={() => openPart(carrierItem, 'caseStudyNotes')} style={partRowStyle}>
                                <Upload size={14} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Notes Upload{hasSubmission(carrierItem.id, 'case_study_notes') ? <> · <Check size={11} strokeWidth={3} /> Done</> : ''}</span>
                              </button>
                            </>
                          )}

                          <div style={sectionLabelStyle}><CheckCircle2 size={11} /> Do It</div>
                          {lessonItems.map((item, idx) => {
                            const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
                            const done = itemProgress?.status === 'completed'
                            const itemHasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
                            const masteryScore = itemProgress?.masteryScore != null && !Number.isNaN(Number(itemProgress.masteryScore)) ? Number(itemProgress.masteryScore) : null
                            const lessonExpanded = !collapsedLessonIds.has(item.id)
                            return (
                              <div key={item.id}>
                                <button onClick={() => toggleLessonExpanded(item.id)} style={lessonHeaderStyle}>
                                  <span style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>{lessonExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                                  <span style={{ flexShrink: 0, display: 'inline-flex', color: '#5A7290' }}>{(() => { const TI = CONTENT_TYPE_ICONS[item.type] || FileText; return <TI size={14} /> })()}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', flex: 1, minWidth: 0 }}>Lesson {idx + 1}: {item.title}</span>
                                </button>
                                {lessonExpanded && (
                                  <>
                                    <button onClick={() => openPart(item, 'tutorial')} style={partRowStyleNested}>
                                      <span>Tutorial{done ? <> · <Check size={11} strokeWidth={3} /> Done</> : ''}</span>
                                    </button>
                                    <button onClick={() => openPart(item, 'lessonNotes')} style={partRowStyleNested}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Notes: Upload{hasSubmission(item.id, 'lesson_notes') ? <> · <Check size={11} strokeWidth={3} /> Done</> : ''}</span>
                                    </button>
                                    {itemHasMastery && (
                                      <button onClick={() => openPart(item, 'mastery')} style={partRowStyleNested}>
                                        <span>Mastery Test{masteryScore !== null ? ` · ${masteryScore}%` : ''}</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}

                          {carrierItem && (
                            <>
                              <div style={sectionLabelStyle}><Scale size={11} /> Show It</div>
                              <button onClick={() => openPart(carrierItem, 'socratic')} style={partRowStyle}>
                                <Scale size={14} />
                                <span>Socratic Seminar</span>
                              </button>

                              <div style={sectionLabelStyle}><Calculator size={11} /> Prove It</div>
                              <button onClick={() => openPart(carrierItem, 'omr')} style={partRowStyle}>
                                <Calculator size={14} />
                                <span>OMR Test</span>
                              </button>

                              <div style={sectionLabelStyle}><Trophy size={11} /> Master It</div>
                              <button onClick={() => openPart(carrierItem, 'presentation')} style={partRowStyle}>
                                <Trophy size={14} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Presentation{hasSubmission(carrierItem.id, 'presentation') ? <> · <Check size={11} strokeWidth={3} /> Submitted</> : ''}</span>
                              </button>
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
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={13} /> Course Discussion</div>
            <div style={emptyState}>Course discussion is not yet wired in this React page, so no discussion data is available here yet.</div>
          </div>
          */}
        </div>
      )}
      {selectedCourse && activeLesson && activePart === 'tutorial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={15} /> {activeLesson.title} · Tutorial</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)' }}>{activeLesson.type}{activeLesson.estimatedMins ? ` · ${activeLesson.estimatedMins} min` : ''}</div>
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
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>Lesson Progress</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#7A92B0' }}>
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
                  {!readOnly && <button disabled={!done && !canMarkDone} onClick={() => void markComplete(activeLesson)} title={readOnly ? 'View-only access' : undefined} style={{ padding: '9px 16px', background: done ? '#DCFCE7' : canMarkDone ? '#1A365E' : '#E5E7EB', color: done ? '#059669' : canMarkDone ? '#fff' : '#94A3B8', border: `1px solid ${done ? '#86EFAC' : canMarkDone ? '#1A365E' : '#E5E7EB'}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: done || canMarkDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {done ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} strokeWidth={3} /> Done</span> : 'Mark done'}
                  </button>}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'mastery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Target size={15} /> {activeLesson.title} · Mastery Test</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)' }}>Pass mark: {activeLesson.masteryPassMark ?? 80}%</div>
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
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} /> {activeLesson.title} · Show it: Notes</div>
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
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Search size={15} /> Learn it · Case Study</div>
            </div>
          </div>
          <CaseStudyDocPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'caseStudyNotes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Upload size={15} /> Learn it · Show it: Notes</div>
            </div>
          </div>
          <div style={{ ...card, padding: '14px 16px' }}>
            <NotesUploadRow contentId={activeLesson.id} kind="case_study_notes" studentId={session?.dbId ?? ''} submission={mySubmissions.find((s) => s.contentId === activeLesson.id && s.kind === 'case_study_notes')} onSubmitted={onSubmissionAdded} />
          </div>
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'socratic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={15} /> Show it · Socratic Seminar</div>
            </div>
          </div>
          <SocraticPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'omr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Calculator size={15} /> Prove it · OMR Test</div>
            </div>
          </div>
          <OmrPanel carrierItem={activeLesson} />
        </div>
      )}

      {selectedCourse && activeLesson && activePart === 'presentation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={11} /> Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={15} /> Master it · Presentation</div>
            </div>
          </div>
          <PresentationPanel carrierItem={activeLesson} studentId={session?.dbId ?? ''} />
        </div>
      )}
    </div>
  )
}
