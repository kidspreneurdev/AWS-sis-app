import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }

interface QuizQuestion { question: string; choices: string[]; correctIndex: number }
interface QuizAttempt { attempt_number: number; score_pct: number; passed: boolean; answers: number[] | null; submitted_at: string }

interface MHSQuizAnswersPanelProps {
  componentId: string
  questions: QuizQuestion[]
}

/** Inline (not modal) view of exactly what a student chose on a quiz attempt —
 *  expands in place the same way MHSHowScorer/MHSNotesScorer do. Previously
 *  answers were used to compute the score and thrown away, so there was no
 *  way to review them after the fact. */
export function MHSQuizAnswersPanel({ componentId, questions }: MHSQuizAnswersPanelProps) {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('mhs_quiz_attempts')
        .select('attempt_number,score_pct,passed,answers,submitted_at')
        .eq('lesson_component_id', componentId)
        .order('attempt_number', { ascending: true })
      if (cancelled) return
      setAttempts(data ?? [])
      setSelectedAttempt(data && data.length > 0 ? data[data.length - 1].attempt_number : null)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [componentId])

  const attempt = attempts.find((a) => a.attempt_number === selectedAttempt) ?? null

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {loading ? (
        <div style={{ fontSize: 12, color: '#7A92B0' }}>Loading…</div>
      ) : attempts.length === 0 ? (
        <div style={{ fontSize: 12, color: '#7A92B0' }}>No attempts recorded yet.</div>
      ) : (
        <>
          <div>
            <label style={label}>Attempt</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {attempts.map((a) => (
                <button
                  key={a.attempt_number}
                  onClick={() => setSelectedAttempt(a.attempt_number)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${selectedAttempt === a.attempt_number ? '#1A365E' : '#E4EAF2'}`,
                    background: selectedAttempt === a.attempt_number ? '#1A365E' : '#fff',
                    color: selectedAttempt === a.attempt_number ? '#fff' : '#1A365E',
                  }}
                >
                  #{a.attempt_number} · {a.score_pct}% {a.passed ? '✓' : '✗'}
                </button>
              ))}
            </div>
          </div>

          {attempt && !attempt.answers && (
            <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '10px 12px', borderRadius: 8 }}>
              This attempt was submitted before answer capture was added — only the score was recorded, not the individual choices.
            </div>
          )}

          {attempt?.answers && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {questions.map((q, qi) => {
                const chosen = attempt.answers?.[qi]
                const isCorrect = chosen === q.correctIndex
                return (
                  <div key={qi} style={{ padding: 10, background: '#fff', border: '1px solid #E4EAF2', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>
                      {qi + 1}. {q.question} <span style={{ marginLeft: 6 }}>{isCorrect ? '✅' : '❌'}</span>
                    </div>
                    {q.choices.map((c, ci) => {
                      const isChosen = chosen === ci
                      const isAnswer = ci === q.correctIndex
                      return (
                        <div
                          key={ci}
                          style={{
                            padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 4,
                            background: isAnswer ? '#DCFCE7' : isChosen ? '#FEE2E2' : '#F7F9FC',
                            color: isAnswer ? '#15803D' : isChosen ? '#B91C1C' : '#3D5475',
                            border: `1px solid ${isAnswer ? '#86EFAC' : isChosen ? '#FCA5A5' : '#E4EAF2'}`,
                            fontWeight: isChosen || isAnswer ? 700 : 400,
                          }}
                        >
                          {c}
                          {isChosen ? ' — chosen' : ''}
                          {isAnswer ? ' — correct answer' : ''}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
