import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { applyComponentScore, computeLatePenaltyPct } from '@/lib/grading/mhsRollup'

const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface MHSOmrScorerComponent {
  id: string
  rawScorePct: number | null
  daysLate: number | null
  excused: boolean
}

interface MHSOmrScorerProps {
  component: MHSOmrScorerComponent
  studentId: string
  answerKey: string | null
  onSaved?: () => void
}

/** Teacher-entered manual bubble-grid scoring: the student's marked answers
 *  are compared letter-by-letter against the lesson's answer key to compute
 *  content accuracy, then lateness is recorded the same way as Notes/Discussion
 *  (spec: OMR is subject to the late-penalty table, unlike Debate). */
export function MHSOmrScorer({ component, studentId, answerKey, onSaved }: MHSOmrScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [studentAnswers, setStudentAnswers] = useState('')
  const [daysLate, setDaysLate] = useState(component.daysLate?.toString() ?? '0')
  const [excused, setExcused] = useState(component.excused)
  const [gateDelayCaused, setGateDelayCaused] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDaysLate(component.daysLate?.toString() ?? '0')
    setExcused(component.excused)
  }, [component])

  const preview = computeLatePenaltyPct(Number(daysLate) || 0, excused, gateDelayCaused)

  const key = (answerKey ?? '').toUpperCase().replace(/[^A-Z]/g, '')
  const marked = studentAnswers.toUpperCase().replace(/[^A-Z]/g, '')
  const canScore = key.length > 0 && marked.length === key.length
  let correct = 0
  if (canScore) {
    for (let i = 0; i < key.length; i++) if (marked[i] === key[i]) correct++
  }
  const computedPct = canScore ? Math.round((correct / key.length) * 10000) / 100 : null

  async function save() {
    if (!profile || computedPct === null) return
    setSaving(true)
    await applyComponentScore(
      component.id,
      studentId,
      {
        rawScorePct: computedPct,
        daysLate: Number(daysLate) || 0,
        excused,
        gateDelayCaused,
        teacherVerified: false,
        spotcheckFlag: false,
      },
      profile.id
    )
    setSaving(false)
    onSaved?.()
  }

  if (!answerKey) {
    return <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E' }}>This lesson has no OMR answer key yet — add one when creating/editing the lesson.</div>
  }

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: '#7A92B0' }}>Answer key ({key.length} questions): <span style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{key}</span></div>
      <div>
        <label style={label}>Student's marked answers ({key.length} letters)</label>
        <input value={studentAnswers} onChange={(e) => setStudentAnswers(e.target.value)} placeholder={key.replace(/./g, '_')} style={{ ...input, fontFamily: 'monospace', letterSpacing: 2 }} />
        {studentAnswers && !canScore && <div style={{ fontSize: 10, color: '#DC2626', marginTop: 4 }}>Needs exactly {key.length} letters (A-Z).</div>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#3D5475' }}>
        <div style={{ width: 100 }}>
          <label style={label}>Days late</label>
          <input value={daysLate} onChange={(e) => setDaysLate(e.target.value)} style={input} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 18 }}>
          <input type="checkbox" checked={excused} onChange={(e) => setExcused(e.target.checked)} /> Excused
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 18 }}>
          <input type="checkbox" checked={gateDelayCaused} onChange={(e) => setGateDelayCaused(e.target.checked)} /> Caused by gate delay
        </label>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: preview.needsReview ? '#B91C1C' : '#15803D' }}>
        {preview.needsReview ? '4+ days late — flagged for manual review, not auto-zeroed.' : `On-time credit: ${preview.retainedPct}% (HOW only)`}
        {computedPct !== null && <span style={{ color: '#1A365E', marginLeft: 10 }}>Score: {correct}/{key.length} = {computedPct}% (Mastery)</span>}
      </div>

      <button
        onClick={() => void save()}
        disabled={!canScore || saving}
        style={{ alignSelf: 'flex-start', padding: '7px 16px', background: canScore ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: canScore ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Saving…' : 'Save OMR Score'}
      </button>
    </div>
  )
}
