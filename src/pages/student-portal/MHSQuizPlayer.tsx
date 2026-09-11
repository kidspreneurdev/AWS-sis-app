import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Flag, RotateCcw } from 'lucide-react'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface QuizListItem { lessonId: string; title: string; courseTitle: string; status: string; attemptCount: number; maxAttempts: number | null }
interface MyComponent {
  componentId: string
  componentType: string
  lessonTitle: string
  courseTitle: string
  status: string
  rawScorePct: number | null
  latePenaltyPct: number | null
  daysLate: number | null
  needsReview: boolean
  canReflect: boolean
  reflection: { status: string; pointsRequested: number | null; pointsAwarded: number | null } | null
  canDispute: boolean
  dispute: { status: string; resolutionNotes: string | null } | null
}
interface MyHowScore { howScoreId: string; lessonTitle: string; pct: number; canDispute: boolean; dispute: { status: string } | null }
interface QuizQuestion { question: string; choices: string[] }
interface QuizData {
  lesson: { id: string; title: string; gateThresholdPct: number; maxAttempts: number }
  questions: QuizQuestion[]
  component: { id: string; status: string; attemptCount: number; maxAttempts: number; gatePassed: boolean | null; gateOverride: boolean }
}
interface AttemptResult { scorePct: number; passed: boolean; attemptNumber: number; maxAttempts: number; status: string; flaggedForTeacher: boolean }

async function authedFetch(token: string | null, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...opts.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export function MHSQuizPlayer() {
  const { getToken } = useStudentPortal()
  const [list, setList] = useState<QuizListItem[]>([])
  const [components, setComponents] = useState<MyComponent[]>([])
  const [howScores, setHowScores] = useState<MyHowScore[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadList = useCallback(async () => {
    try {
      const body = await authedFetch(getToken(), '/api/student-portal/list-quizzes')
      setList(body.lessons ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quizzes.')
    }
  }, [getToken])

  const loadComponents = useCallback(async () => {
    try {
      const body = await authedFetch(getToken(), '/api/student-portal/list-my-components')
      setComponents((body.components ?? []).filter((c: MyComponent) => c.componentType !== 'quiz'))
    } catch {
      // non-fatal — quiz list above still works even if this fails
    }
  }, [getToken])

  const loadHowScores = useCallback(async () => {
    try {
      const body = await authedFetch(getToken(), '/api/student-portal/list-my-how-scores')
      setHowScores(body.howScores ?? [])
    } catch {
      // non-fatal
    }
  }, [getToken])

  useEffect(() => { void loadList() }, [loadList])
  useEffect(() => { void loadComponents() }, [loadComponents])
  useEffect(() => { void loadHowScores() }, [loadHowScores])

  async function openQuiz(lessonId: string) {
    setError('')
    setResult(null)
    setSelectedLessonId(lessonId)
    try {
      const body = await authedFetch(getToken(), `/api/student-portal/get-quiz?lessonId=${lessonId}`)
      setQuiz(body)
      setAnswers(new Array(body.questions.length).fill(-1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz.')
      setQuiz(null)
    }
  }

  async function submit() {
    if (!quiz) return
    setLoading(true)
    setError('')
    try {
      const body = await authedFetch(getToken(), '/api/student-portal/submit-quiz-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonComponentId: quiz.component.id, answers }),
      })
      setResult(body)
      await loadList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedLessonId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>My Quizzes</div>
          {error && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          {list.length === 0 && <div style={{ fontSize: 12, color: '#7A92B0' }}>No quizzes assigned yet.</div>}
          {list.map((q) => (
            <button key={q.lessonId} onClick={() => void openQuiz(q.lessonId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1.5px solid #E4EAF2', background: '#F7F9FC', cursor: 'pointer' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{q.title}</div>
              <div style={{ fontSize: 10, color: '#7A92B0' }}>{q.courseTitle} · attempt {q.attemptCount}/{q.maxAttempts ?? '—'} · {q.status.replace('_', ' ')}</div>
            </button>
          ))}
        </div>

        {components.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>My Notes &amp; Other Work</div>
            {components.map((c) => (
              <MyComponentRow key={c.componentId} component={c} onChanged={() => { void loadComponents() }} />
            ))}
          </div>
        )}

        {howScores.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>My Habits of Work Scores</div>
            {howScores.map((h) => (
              <MyHowScoreRow key={h.howScoreId} howScore={h} onChanged={() => { void loadHowScores() }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={card}>
      <button onClick={() => { setSelectedLessonId(null); setQuiz(null) }} style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 11, cursor: 'pointer', marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={12} /> Back to quiz list</button>
      {error && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {!quiz ? (
        <div style={{ fontSize: 12, color: '#7A92B0' }}>Loading…</div>
      ) : result ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            {result.passed
              ? <CheckCircle2 size={32} color="#10B981" />
              : result.flaggedForTeacher
              ? <Flag size={32} color="#DC2626" />
              : <RotateCcw size={32} color="#7A92B0" />}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>Score: {result.scorePct}%</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4 }}>
            {result.passed
              ? 'You passed! This lesson is unlocked.'
              : result.flaggedForTeacher
              ? `Attempt ${result.attemptNumber}/${result.maxAttempts} used — flagged for your teacher to review.`
              : `Attempt ${result.attemptNumber}/${result.maxAttempts} — you can try again.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{quiz.lesson.title}</div>
          <div style={{ fontSize: 11, color: '#7A92B0' }}>Need {quiz.lesson.gateThresholdPct}% to pass · Attempt {quiz.component.attemptCount + 1} of {quiz.lesson.maxAttempts}</div>
          {quiz.questions.map((q, qi) => (
            <div key={qi} style={{ padding: 10, background: '#F7F9FC', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>{qi + 1}. {q.question}</div>
              {q.choices.map((c, ci) => (
                <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                  <input type="radio" name={`q_${qi}`} checked={answers[qi] === ci} onChange={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))} />
                  {c}
                </label>
              ))}
            </div>
          ))}
          <button
            onClick={() => void submit()}
            disabled={loading || answers.some((a) => a === -1)}
            style={{ alignSelf: 'flex-start', padding: '9px 20px', background: answers.some((a) => a === -1) ? '#CBD5E1' : '#059669', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: answers.some((a) => a === -1) ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Submitting…' : 'Submit Quiz'}
          </button>
        </div>
      )}
    </div>
  )
}

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  notes: 'Do it',
  discussion: 'Share it',
  debate: 'Share it',
  omr: 'Prove it',
}

function MyComponentRow({ component, onChanged }: { component: MyComponent; onChanged: () => void }) {
  const { getToken } = useStudentPortal()
  const [showForm, setShowForm] = useState<'reflection' | 'dispute' | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submitReflection() {
    if (!text.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await authedFetch(getToken(), '/api/student-portal/submit-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonComponentId: component.componentId, reflectionText: text.trim() }),
      })
      setShowForm(null)
      setText('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDispute() {
    if (!text.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await authedFetch(getToken(), '/api/student-portal/file-grade-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType: component.componentType, lessonComponentId: component.componentId, reason: text.trim() }),
      })
      setShowForm(null)
      setText('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1.5px solid #E4EAF2', background: '#F7F9FC' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{component.lessonTitle} <span style={{ fontWeight: 400, color: '#7A92B0' }}>· {COMPONENT_TYPE_LABELS[component.componentType] ?? component.componentType}</span></div>
      <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>
        {component.needsReview
          ? '4+ days late — your teacher will review this.'
          : component.latePenaltyPct !== null && component.latePenaltyPct < 100
          ? `${component.latePenaltyPct}% on-time credit (${component.daysLate ?? 0} day${component.daysLate === 1 ? '' : 's'} late)`
          : component.status.replace('_', ' ')}
        {component.rawScorePct !== null ? ` · score ${component.rawScorePct}%` : ''}
      </div>

      {component.reflection && (
        <div style={{ fontSize: 10, marginTop: 6, color: component.reflection.status === 'Approved' ? '#15803D' : component.reflection.status === 'Denied' ? '#B91C1C' : '#92400E' }}>
          Reflection {component.reflection.status.toLowerCase()}
          {component.reflection.status === 'Approved' ? ` — ${component.reflection.pointsAwarded} pts restored` : ''}
        </div>
      )}
      {component.dispute && (
        <div style={{ fontSize: 10, marginTop: 6, color: component.dispute.status === 'Resolved' ? '#15803D' : '#92400E' }}>
          Dispute {component.dispute.status.toLowerCase()}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {component.canReflect && !showForm && (
          <button onClick={() => { setShowForm('reflection'); setText('') }} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Submit a reflection to recover points
          </button>
        )}
        {component.canDispute && !showForm && (
          <button onClick={() => { setShowForm('dispute'); setText('') }} style={{ padding: '5px 12px', background: '#FEE2E2', color: '#B91C1C', border: '1.5px solid #FCA5A5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            File a Dispute
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && <div style={{ color: '#DC2626', fontSize: 11 }}>{error}</div>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={showForm === 'reflection' ? 'What happened, and what will you do differently next time?' : 'Why do you believe this score should be reviewed?'}
            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => void (showForm === 'reflection' ? submitReflection() : submitDispute())}
              disabled={submitting || !text.trim()}
              style={{ padding: '6px 14px', background: text.trim() ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed' }}
            >
              {submitting ? 'Submitting…' : showForm === 'reflection' ? 'Submit Reflection' : 'File Dispute'}
            </button>
            <button onClick={() => setShowForm(null)} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, color: '#7A92B0', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MyHowScoreRow({ howScore, onChanged }: { howScore: MyHowScore; onChanged: () => void }) {
  const { getToken } = useStudentPortal()
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submitDispute() {
    if (!text.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await authedFetch(getToken(), '/api/student-portal/file-grade-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType: 'how', howScoreId: howScore.howScoreId, reason: text.trim() }),
      })
      setShowForm(false)
      setText('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1.5px solid #E4EAF2', background: '#F7F9FC' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{howScore.lessonTitle}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{howScore.pct}%</div>
      </div>
      {howScore.dispute && <div style={{ fontSize: 10, marginTop: 4, color: howScore.dispute.status === 'Resolved' ? '#15803D' : '#92400E' }}>Dispute {howScore.dispute.status.toLowerCase()}</div>}
      {howScore.canDispute && !showForm && (
        <button onClick={() => setShowForm(true)} style={{ marginTop: 8, padding: '5px 12px', background: '#FEE2E2', color: '#B91C1C', border: '1.5px solid #FCA5A5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          File a Dispute
        </button>
      )}
      {showForm && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {error && <div style={{ color: '#DC2626', fontSize: 11 }}>{error}</div>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Why do you believe this score should be reviewed?" style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void submitDispute()} disabled={submitting || !text.trim()} style={{ padding: '6px 14px', background: text.trim() ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
              {submitting ? 'Submitting…' : 'File Dispute'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, color: '#7A92B0', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
