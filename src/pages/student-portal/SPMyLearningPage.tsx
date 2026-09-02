import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/uploadFile'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import { TYPE_ICONS, SUBJECT_COLORS, isActiveBool, type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress, type LMSQuestion } from '@/pages/lms/lmsStore'
import { CASE_STUDY_RUBRIC, SCORE_COMPONENT_TYPES, finalGrade, type ScoreComponentType } from '@/lib/lms/caseStudyRubric'
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

const partRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 18px 6px 56px',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
  fontSize: 11, color: '#5A7290',
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
    if (progressPct === 100) return { label: 'Complete', icon: '✅', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (daysPassed < 0) return { label: 'Not Started', icon: '○', color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
    if (paceDiff >= 10) return { label: 'Ahead of Pace', icon: '🏃‍♂️', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (paceDiff >= -10) return { label: 'On Pace', icon: '🚶‍♂️', color: '#2563EB', bg: '#DBEAFE', bucket: 'on' as const }
    return { label: 'Off Pace', icon: '🐢', color: SP_RED, bg: '#FEE2E2', bucket: 'off' as const }
  }
  if (progressPct === 100) return { label: 'Complete', icon: '✅', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
  if (progressPct === 0) return { label: 'Not Started', icon: '○', color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
  return { label: 'In Progress', icon: '⏳', color: '#0891B2', bg: '#E0F2FE', bucket: 'on' as const }
}

function contentStatus(item: LMSContent, progress: LMSProgress | undefined, passMark: number) {
  const completed = progress?.status === 'completed'
  const masteryPassed = progress?.masteryPassed === true || progress?.masteryPassed === 'TRUE'
  const hasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
  const hasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
  const assignScore = progress?.assignScore != null && !Number.isNaN(Number(progress.assignScore)) ? Number(progress.assignScore) : null

  if (hasAssignment && assignScore !== null) {
    return {
      text: `📋 ${assignScore}%`,
      color: assignScore >= passMark ? SP_GREEN : SP_RED,
    }
  }
  if (hasAssignment && progress?.assignStatus === 'submitted') {
    return { text: '📋 Awaiting score', color: '#D97706' }
  }
  if (hasAssignment) {
    return { text: '📋 Assignment due', color: '#64748B' }
  }
  if (hasMastery && masteryPassed) {
    return { text: `✓ Mastery${progress?.masteryScore != null ? ` · ${progress.masteryScore}%` : ''}`, color: SP_GREEN }
  }
  if (hasMastery) {
    return { text: '🎯 Mastery test', color: '#D97706' }
  }
  if (completed) {
    return { text: '✅ Completed', color: SP_GREEN }
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
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 11, color: '#94A3B8' }}>
        🎯 No mastery questions have been configured for this lesson yet.
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
          <div style={{ fontSize: 36, marginBottom: 8 }}>{result.passed ? '🎉' : '😔'}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.passed ? 'Congratulations!' : 'Not quite there yet'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginBottom: 14 }}>
            {result.passed ? `You passed with ${result.score}%` : `You scored ${result.score}% — you need ${passMark}% to pass`}
          </div>
          {!result.passed && remainingRetakes > 0 && (
            <button onClick={retry} style={{ padding: '9px 20px', background: '#fff', color: '#DC2626', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              🔄 Try Again ({remainingRetakes} attempt{remainingRetakes !== 1 ? 's' : ''} left)
            </button>
          )}
          {!result.passed && remainingRetakes <= 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>No more attempts remaining. Contact your teacher.</div>
          )}
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 11, fontWeight: 800, color: '#1A365E' }}>📝 Answer Review</div>
          {questions.map((q, qi) => {
            const isShort = q.type === 'short' || !q.opts?.length
            const studentAns = answers[qi]
            const correct = !isShort && studentAns === q.ans
            return (
              <div key={qi} style={{ padding: '12px 14px', borderBottom: qi < questions.length - 1 ? '1px solid #F0F4FA' : 'none', background: isShort ? '#F7F9FC' : correct ? '#F0FDF4' : '#FFF7F7' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>
                  {isShort ? '📝' : correct ? '✅' : '❌'} Q{qi + 1}: {q.q}
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
          <span style={{ fontSize: 18 }}>⏱</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Time Remaining</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: timeLeft < 60 ? SP_RED : '#D97706', fontVariantNumeric: 'tabular-nums' }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      {timedOut && (
        <div style={{ padding: '8px 12px', background: '#FEE2E2', borderRadius: 8, fontSize: 11, fontWeight: 700, color: SP_RED, marginBottom: 10 }}>
          ⏱ Time's up! Please submit your answers.
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
        {saving ? 'Saving…' : readOnly ? 'View-only access' : (isLast || timedOut) ? `Submit Mastery Test (${questions.length} question${questions.length !== 1 ? 's' : ''})` : 'Next Question →'}
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
  lesson: { id: string; title: string; caseStudyUrl: string | null }
  scores: CSScoreData[]
  discussion: { myStudentId: string; posts: CSPostData[] }
  presentation: { note: string | null; linkUrl: string | null; submittedAt: string } | null
  appeals: CSAppealData[]
}

function CaseStudyPanel({ item, studentId, masteryPassed }: {
  item: LMSContent
  studentId: string
  masteryPassed: boolean
}) {
  const { readOnly } = usePortalReadOnly()
  const { getToken } = useStudentPortal()
  const hasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
  const locked = hasMastery && !masteryPassed

  const [loading, setLoading] = useState(true)
  const [bundle, setBundle] = useState<CaseStudyBundle | null>(null)
  const [postBody, setPostBody] = useState('')
  const [replyBody, setReplyBody] = useState<Record<string, string>>({})
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [presFile, setPresFile] = useState<File | null>(null)
  const [presNote, setPresNote] = useState('')
  const [presSubmitting, setPresSubmitting] = useState(false)
  const [appealOpenFor, setAppealOpenFor] = useState<string | null>(null)
  const [appealText, setAppealText] = useState<Record<string, string>>({})
  const [filingAppeal, setFilingAppeal] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await studentPortalFetch(getToken(), `/api/student-portal/lms-get-case-study?contentId=${item.id}`)
      setBundle(data as CaseStudyBundle)
    } catch {
      setBundle(null)
    }
    setLoading(false)
  }

  useEffect(() => { if (!locked) void load() }, [item.id, locked]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  if (locked) {
    return (
      <div style={{ padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>🔒</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7A92B0' }}>Case Study Assignment Locked</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Pass the mastery test first to unlock this assignment.</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ ...emptyState }}>Loading case study…</div>
  }
  if (!bundle) {
    return <div style={{ ...emptyState }}>Couldn't load the case study assignment. Try reopening this lesson.</div>
  }

  const scoreByType = Object.fromEntries(bundle.scores.map((s) => [s.componentType, s])) as Record<string, CSScoreData | undefined>
  const appealByType = Object.fromEntries(bundle.appeals.map((a) => [a.componentType, a])) as Record<string, CSAppealData | undefined>

  async function submitPost(parentPostId: string | null) {
    const body = parentPostId ? (replyBody[parentPostId] ?? '') : postBody
    if (!body.trim()) return
    setPosting(true)
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-discussion-post', {
        method: 'POST', body: JSON.stringify({ contentId: item.id, body: body.trim(), parentPostId: parentPostId || undefined }),
      })
      if (parentPostId) { setReplyBody((p) => ({ ...p, [parentPostId]: '' })); setReplyOpenFor(null) } else setPostBody('')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post.')
    }
    setPosting(false)
  }

  async function submitPresentation() {
    if (!presFile) return
    setPresSubmitting(true)
    try {
      const path = `lms/${studentId}/${item.id}/${Date.now()}_${presFile.name}`
      const fileUrl = await uploadFile(path, presFile)
      await studentPortalFetch(getToken(), '/api/student-portal/lms-submit-presentation', {
        method: 'POST', body: JSON.stringify({ contentId: item.id, fileUrl, note: presNote.trim() || undefined }),
      })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
    setPresSubmitting(false)
  }

  async function fileAppeal(componentType: string) {
    const message = appealText[componentType] ?? ''
    if (!message.trim()) return
    setFilingAppeal(componentType)
    try {
      await studentPortalFetch(getToken(), '/api/student-portal/lms-file-appeal', {
        method: 'POST', body: JSON.stringify({ contentId: item.id, componentType, message: message.trim() }),
      })
      setAppealOpenFor(null)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to file appeal.')
    }
    setFilingAppeal(null)
  }

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

  function renderScoreBlock(type: ScoreComponentType, icon: string, title: string, order: number) {
    return <CSScoreBlock type={type} icon={icon} title={title} order={order} score={scoreByType[type]} appealControl={renderAppealControl(type)} />
  }

  const myTopLevelPost = bundle.discussion.posts.find((p) => p.isMine && !p.parentPostId)
  const subtotalsByType = Object.fromEntries(SCORE_COMPONENT_TYPES.map((t) => [t, scoreByType[t]?.status === 'scored' ? scoreByType[t]!.subtotal : null])) as Partial<Record<ScoreComponentType, number | null>>
  const overallFinalGrade = finalGrade(subtotalsByType)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>📚 Case Study Assignment</div>

      <div style={{ background: '#fff', border: '1.5px solid #1A365E22', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          {SCORE_COMPONENT_TYPES.map((t) => (
            <div key={t} style={{ textAlign: 'center', flex: 1, minWidth: 64 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase' }}>{CASE_STUDY_RUBRIC[t].label}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: subtotalsByType[t] != null ? '#1A365E' : '#94A3B8' }}>{subtotalsByType[t] != null ? `${subtotalsByType[t]}/${CASE_STUDY_RUBRIC[t].weight}` : '—'}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 80, borderLeft: '1px solid #E4EAF2', paddingLeft: 12 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase' }}>Final Grade</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: overallFinalGrade !== null ? (overallFinalGrade >= 70 ? '#059669' : SP_RED) : '#94A3B8' }}>{overallFinalGrade !== null ? `${overallFinalGrade}/100` : '—'}</div>
          </div>
        </div>
      </div>

      {/* 1. Case Study */}
      <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 800, color: '#1A365E' }}>1. Case Study</div>
        {bundle.lesson.caseStudyUrl ? (
          <>
            <div style={{ position: 'relative', paddingBottom: '65%', height: 0 }}>
              <iframe src={getCaseStudyEmbedUrl(bundle.lesson.caseStudyUrl)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} title="Case Study" loading="lazy" />
            </div>
            <div style={{ padding: '8px 16px', textAlign: 'right' }}>
              <a href={bundle.lesson.caseStudyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700 }}>↗ Open in new tab</a>
            </div>
          </>
        ) : (
          <div style={{ padding: 20, color: '#94A3B8', fontSize: 12 }}>No case study document has been uploaded yet.</div>
        )}
      </div>

      {/* 2. Notes Score */}
      {renderScoreBlock('notes', '📝', 'Notes Score', 2)}

      {/* 3. Discussion Post */}
      <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>💬 3. Discussion Post</div>
        {!myTopLevelPost ? (
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Share your thoughts on the case study</div>
            <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={3} placeholder="What's your take on the case study?" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => void submitPost(null)} disabled={readOnly || posting || !postBody.trim()} style={{ padding: '7px 18px', background: postBody.trim() ? '#1A365E' : '#E4EAF2', color: postBody.trim() ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: postBody.trim() ? 'pointer' : 'not-allowed' }}>{posting ? 'Posting…' : '🚀 Post'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
            {bundle.discussion.posts.filter((p) => !p.parentPostId).map((p) => (
              <div key={p.id} style={{ background: p.isMine ? '#EEF3FF' : '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>{p.authorName}</div>
                <div style={{ fontSize: 12, color: '#3D5475', whiteSpace: 'pre-wrap', marginBottom: 6 }}>{p.body}</div>
                {bundle.discussion.posts.filter((r) => r.parentPostId === p.id).map((r) => (
                  <div key={r.id} style={{ marginLeft: 16, marginTop: 6, background: '#fff', border: '1px solid #E4EAF2', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#1A365E', marginBottom: 2 }}>{r.authorName}</div>
                    <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap' }}>{r.body}</div>
                  </div>
                ))}
                {replyOpenFor === p.id ? (
                  <div style={{ marginLeft: 16, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <textarea rows={2} value={replyBody[p.id] ?? ''} onChange={(e) => setReplyBody((prev) => ({ ...prev, [p.id]: e.target.value }))} placeholder="Write a comment..." style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => void submitPost(p.id)} disabled={posting} style={{ padding: '4px 10px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Reply</button>
                      <button onClick={() => setReplyOpenFor(null)} style={{ padding: '4px 10px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setReplyOpenFor(p.id)} style={{ marginTop: 4, padding: 0, background: 'none', border: 'none', color: '#5A7290', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>💬 Comment</button>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>{renderAppealControl('discussion')}{scoreByType.discussion?.status === 'scored' && (
          <div style={{ marginTop: 4 }}>
            <span style={{ background: '#DCFCE7', color: '#059669', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>Discussion Board: {scoreByType.discussion!.subtotal}/{CASE_STUDY_RUBRIC.discussion.weight}</span>
            {scoreByType.discussion!.feedback && <div style={{ fontSize: 11, color: '#3D5475', marginTop: 6 }}><strong>Teacher feedback:</strong> {scoreByType.discussion!.feedback}</div>}
          </div>
        )}</div>
      </div>

      {/* 4. Socratic Debate Score */}
      {renderScoreBlock('debate', '⚖️', 'Socratic Debate Score', 4)}

      {/* 5. OMR Test Score */}
      {renderScoreBlock('omr', '🔢', 'OMR Test Score', 5)}

      {/* 6. Presentation Upload */}
      <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>📤 6. Presentation Upload</div>
        {bundle.presentation ? (
          <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 4 }}>✅ Submitted {new Date(bundle.presentation.submittedAt).toLocaleDateString()}</div>
            {bundle.presentation.note && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 4, whiteSpace: 'pre-wrap' }}>{bundle.presentation.note}</div>}
            {bundle.presentation.linkUrl && <a href={bundle.presentation.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700 }}>🔗 View your presentation</a>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea rows={2} value={presNote} onChange={(e) => setPresNote(e.target.value)} placeholder="Notes for your teacher (optional)..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `2px dashed ${presFile ? '#1DBD6A' : '#CBD5E0'}`, background: presFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 11, color: presFile ? '#1DBD6A' : '#7A92B0', fontWeight: presFile ? 700 : 400 }}>
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setPresFile(f) }} />
              {presFile ? `✅ ${presFile.name}` : '+ Choose file (PDF, PPT…)'}
            </label>
            <button onClick={() => void submitPresentation()} disabled={readOnly || presSubmitting || !presFile} style={{ padding: '9px 16px', background: presFile && !readOnly ? '#1A365E' : '#E4EAF2', color: presFile && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: presFile && !readOnly ? 'pointer' : 'not-allowed', alignSelf: 'flex-end' }}>
              {presSubmitting ? '⏳ Uploading…' : '📤 Submit Presentation'}
            </button>
          </div>
        )}
      </div>

      {/* 7. Presentation Score */}
      {renderScoreBlock('presentation', '🏆', 'Presentation Score', 7)}
    </div>
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
          ? <span style={{ color: '#92400E', fontWeight: 700 }}>🚩 Appeal sent — pending review.</span>
          : <span style={{ color: '#059669' }}><strong>✅ Appeal resolved:</strong> {appeal.adminReply}</span>}
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
        <button onClick={onOpen} disabled={readOnly} style={{ padding: '4px 10px', background: 'none', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: readOnly ? 'not-allowed' : 'pointer' }}>🚩 Appeal this score</button>
      )}
    </div>
  )
}

function CSScoreBlock({ type, icon, title, order, score, appealControl }: {
  type: ScoreComponentType
  icon: string
  title: string
  order: number
  score: CSScoreData | undefined
  appealControl: React.ReactNode
}) {
  const cat = CASE_STUDY_RUBRIC[type]
  const isScored = score?.status === 'scored'
  return (
    <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{icon} {order}. {title}</div>
        {isScored
          ? <span style={{ background: '#DCFCE7', color: '#059669', fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 20 }}>{score!.subtotal}/{cat.weight}</span>
          : <span style={{ background: '#F0F4FA', color: '#7A92B0', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>⏳ Pending</span>}
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
                <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400 }}>
                  {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? ' ✓' : ''}
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
  const { session } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const [courses, setCourses] = useState<LMSCourse[]>([])
  const [content, setContent] = useState<LMSContent[]>([])
  const [progress, setProgress] = useState<LMSProgress[]>([])
  const [enrolments, setEnrolments] = useState<LMSEnrolment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [activePart, setActivePart] = useState<'tutorial' | 'mastery' | 'assignment' | null>(null)
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
    const [{ data: cData }, { data: coData }, { data: prData }] = await Promise.all([
      supabase.from('lms_courses').select('*').in('id', courseIds),
      supabase.from('lms_content').select('*').in('course_id', courseIds).order('module_order').order('unit_order').order('order_idx'),
      supabase.from('lms_progress').select('*').eq('student_id', session.dbId),
    ])

    const mappedCourses: LMSCourse[] = (cData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
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
        unitOrder: Number(r.unit_order ?? 0),
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

    setCourses(publishedCourses.length ? publishedCourses : mappedCourses)
    setContent(mappedContent)
    setProgress(mappedProgress)
    setLoading(false)
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

  function openPart(item: LMSContent, part: 'tutorial' | 'mastery' | 'assignment') {
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

  const courseProgress = (courseId: string) => {
    const items = content.filter((item) => item.courseId === courseId)
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
      const pct = courseProgress(course.id)
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
      .filter((item) => item.courseId === selectedCourse.id)
      .sort((a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.unitOrder ?? 0) - (b.unitOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
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
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>📚 My Learning</div>
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
              {paceSummary.ahead > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DCFCE7', borderRadius: 10, border: '1px solid #059669' }}><span style={{ fontSize: 16 }}>🏃‍♂️</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>{paceSummary.ahead}</div><div style={{ fontSize: 9, color: '#059669' }}>Ahead of Pace</div></div></div>}
              {paceSummary.on > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DBEAFE', borderRadius: 10, border: '1px solid #2563EB' }}><span style={{ fontSize: 16 }}>🚶‍♂️</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB' }}>{paceSummary.on}</div><div style={{ fontSize: 9, color: '#2563EB' }}>On Pace</div></div></div>}
              {paceSummary.off > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEE2E2', borderRadius: 10, border: '1px solid #D61F31' }}><span style={{ fontSize: 16 }}>🐢</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#D61F31' }}>{paceSummary.off}</div><div style={{ fontSize: 9, color: '#D61F31' }}>Off Pace</div></div></div>}
              {paceSummary.notStarted > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F1F5F9', borderRadius: 10, border: '1px solid #94A3B8' }}><span style={{ fontSize: 16 }}>○</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>{paceSummary.notStarted}</div><div style={{ fontSize: 9, color: '#64748B' }}>Not Started</div></div></div>}
            </div>
          )}

          {courses.length === 0 ? (
            <div style={{ ...card, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No courses assigned yet</div>
              <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 6 }}>No learning data is available from Supabase for this section yet.</div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ ...card, ...emptyState, textAlign: 'center' }}>No courses match your search right now.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
              {filteredCourses.map((course) => {
                const pct = courseProgress(course.id)
                const enrolment = enrolments.find((entry) => entry.courseId === course.id) ?? null
                const pace = paceMeta(pct, enrolment)
                const subjectCol = SUBJECT_COLORS[course.subject] || '#1A365E'
                const courseContent = content.filter((item) => item.courseId === course.id)
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
                          <span>📄 {courseContent.length} lessons</span>
                          {enrolment?.dueDate && <span>📅 Due: {enrolment.dueDate}</span>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: pace.color, background: pace.bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', border: `1px solid ${pace.color}33` }}>
                          {pace.icon} {pace.label}
                        </span>
                      </div>
                      {pendingAssignments > 0 && (
                        <div style={{ marginBottom: 6, padding: '5px 10px', background: '#FEF3C7', borderRadius: 7, fontSize: 10, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📋</span><span>{pendingAssignments} assignment{pendingAssignments !== 1 ? 's' : ''} need attention</span>
                        </div>
                      )}
                      {course.announcement?.trim() ? (
                        <div style={{ marginBottom: 8, padding: '7px 10px', background: '#1A365E0D', borderLeft: '3px solid #1A365E', borderRadius: '0 7px 7px 0', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>📢</span>
                          <div style={{ fontSize: 10, color: '#1A365E', lineHeight: 1.5 }}>{course.announcement.length > 80 ? `${course.announcement.slice(0, 80)}…` : course.announcement}</div>
                        </div>
                      ) : (
                        <div style={{ ...emptyState, marginBottom: 8, padding: '8px 10px' }}>No course announcement posted yet.</div>
                      )}
                      <div style={{ marginTop: 8, padding: '8px 12px', background: subjectCol, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                        {pct === 0 ? '▶ Start Course' : pct === 100 ? '🔁 Review' : '▶ Continue'}
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
              <span style={{ fontSize: 20, flexShrink: 0 }}>📢</span>
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
              <button onClick={() => setActiveCourse(null)} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
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
              <div style={{ fontSize: 13, fontWeight: 900, color: courseProgress(selectedCourse.id) === 100 ? SP_GREEN : courseProgress(selectedCourse.id) >= 50 ? '#D97706' : SP_NAVY }}>{courseProgress(selectedCourse.id)}%</div>
            </div>
            <div style={{ height: 8, background: '#F0F4FA', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${courseProgress(selectedCourse.id)}%`, background: courseProgress(selectedCourse.id) === 100 ? SP_GREEN : courseProgress(selectedCourse.id) >= 50 ? '#D97706' : SP_NAVY, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Average mastery</strong><br />
                {(() => {
                  const mastery = progress.filter((entry) => entry.courseId === selectedCourse.id && entry.studentId === session?.dbId && entry.masteryScore != null)
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
            <div style={{ ...card, ...emptyState }}>No course description is available from Supabase for this course yet.</div>
          )}

          {courseItems.length === 0 ? (
            <div style={{ ...card, ...emptyState }}>No lessons or learning content are available from Supabase for this course yet.</div>
          ) : (
            groupedModules.map((module, moduleIdx) => (
              <div key={`${module.label || 'default'}-${moduleIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {module.label ? <div style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>🗂 {module.label}</div> : null}
                {[...module.units.entries()].map(([unit, items]) => (
                  <div key={unit} style={{ ...card, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 800, color: '#1A365E' }}>
                      📂 {unit}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {items.map((item, idx) => {
                        const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
                        const done = itemProgress?.status === 'completed'
                        const itemHasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
                        const itemHasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
                        const masteryScore = itemProgress?.masteryScore != null && !Number.isNaN(Number(itemProgress.masteryScore)) ? Number(itemProgress.masteryScore) : null
                        const assignScore = itemProgress?.assignScore != null && !Number.isNaN(Number(itemProgress.assignScore)) ? Number(itemProgress.assignScore) : null
                        const expanded = !collapsedLessonIds.has(item.id)
                        return (
                          <div key={item.id} style={{ borderBottom: idx < items.length - 1 ? '1px solid #F0F4FA' : 'none' }}>
                            <button
                              onClick={() => toggleLessonExpanded(item.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            >
                              <span style={{ width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E4EAF2', borderRadius: 4, background: '#fff', fontSize: 12, color: '#5A7290' }}>{expanded ? '−' : '+'}</span>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📄'}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', flex: 1, minWidth: 0 }}>{item.title}</span>
                            </button>
                            {expanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 4 }}>
                                <button onClick={() => openPart(item, 'tutorial')} style={partRowStyle}>
                                  <span style={{ fontSize: 14 }}>📋</span>
                                  <span>{item.title}: Tutorial{done ? ' · ✓ Done' : ''}</span>
                                </button>
                                {itemHasMastery && (
                                  <button onClick={() => openPart(item, 'mastery')} style={partRowStyle}>
                                    <span style={{ fontSize: 14 }}>📋</span>
                                    <span>{item.title}: Mastery Test{masteryScore !== null ? ` · ${masteryScore}%` : ''}</span>
                                  </button>
                                )}
                                {itemHasAssignment && (
                                  <button onClick={() => openPart(item, 'assignment')} style={partRowStyle}>
                                    <span style={{ fontSize: 14 }}>📋</span>
                                    <span>{item.title}: Assignment{assignScore !== null ? ` · ${assignScore}%` : ''}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Course Discussion</div>
            <div style={emptyState}>Course discussion is not yet wired in this React page, so no discussion data is available here yet.</div>
          </div>
        </div>
      )}
      {selectedCourse && activeLesson && activePart === 'tutorial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Lessons</button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📖 {activeLesson.title} · Tutorial</div>
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
                      {activeLesson.estimatedMins ? <span>⏱ {activeLesson.estimatedMins} min required</span> : <span>⏱ No minimum time</span>}
                      {badge ? <span style={{ color: badge.color, fontWeight: 700 }}>{badge.text}</span> : null}
                      {activeLesson.estimatedMins ? (
                        <span style={{ color: canMarkDone ? '#059669' : '#D97706', fontWeight: 700 }}>
                          {canMarkDone ? 'Timer complete' : `Remaining ${formatRemaining(remainingMs)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!readOnly && <button disabled={!done && !canMarkDone} onClick={() => void markComplete(activeLesson)} title={readOnly ? 'View-only access' : undefined} style={{ padding: '9px 16px', background: done ? '#DCFCE7' : canMarkDone ? '#1A365E' : '#E5E7EB', color: done ? '#059669' : canMarkDone ? '#fff' : '#94A3B8', border: `1px solid ${done ? '#86EFAC' : canMarkDone ? '#1A365E' : '#E5E7EB'}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: done || canMarkDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {done ? '✓ Done' : 'Mark done'}
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
            <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Lessons</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🎯 {activeLesson.title} · Mastery Test</div>
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

      {selectedCourse && activeLesson && activePart === 'assignment' && (() => {
        const lessonProg = progress.find((p) => p.contentId === activeLesson.id && p.studentId === session?.dbId)
        const masteryPassed = lessonProg?.masteryPassed === true || lessonProg?.masteryPassed === 'TRUE'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={backToLessonList} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Lessons</button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📚 {activeLesson.title} · Assignment</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)' }}>Case Study Assignment</div>
              </div>
            </div>

            <CaseStudyPanel
              item={activeLesson}
              studentId={session?.dbId ?? ''}
              masteryPassed={masteryPassed}
            />
          </div>
        )
      })()}
    </div>
  )
}
