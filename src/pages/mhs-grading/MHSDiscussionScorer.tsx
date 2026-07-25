import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { applyComponentScore, computeLatePenaltyPct } from '@/lib/grading/mhsRollup'

const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

const SC_CFG = {
  4: { c: '#15803D', bg: '#DCFCE7' },
  3: { c: '#0369A1', bg: '#DBEAFE' },
  2: { c: '#B45309', bg: '#FEF3C7' },
  1: { c: '#D61F31', bg: '#FEE2E2' },
} as Record<number, { c: string; bg: string }>

const CRITERIA = [
  { key: 'argument', label: 'Argument Quality' },
  { key: 'evidence', label: 'Evidence & Reasoning' },
  { key: 'engagement', label: 'Engagement with Peers' },
] as const

interface MHSDiscussionScorerComponent {
  id: string
  daysLate: number | null
  excused: boolean
}

interface MHSDiscussionScorerProps {
  component: MHSDiscussionScorerComponent
  studentId: string
  onSaved?: () => void
}

/** Teacher scoring for a Discussion Board post: the shared 1-4 rubric engine
 *  (same visual pattern as MHSHowScorer/PTEvaluatePage) with discussion-specific
 *  criteria feeding Mastery, plus the same lateness fields as Notes feeding HOW. */
export function MHSDiscussionScorer({ component, studentId, onSaved }: MHSDiscussionScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [scores, setScores] = useState<Record<string, number>>({ argument: 0, evidence: 0, engagement: 0 })
  const [daysLate, setDaysLate] = useState(component.daysLate?.toString() ?? '0')
  const [excused, setExcused] = useState(component.excused)
  const [gateDelayCaused, setGateDelayCaused] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDaysLate(component.daysLate?.toString() ?? '0')
    setExcused(component.excused)
  }, [component])

  const allScored = CRITERIA.every((c) => scores[c.key] > 0)
  const rubricAvg = allScored ? CRITERIA.reduce((sum, c) => sum + scores[c.key], 0) / CRITERIA.length : null
  const preview = computeLatePenaltyPct(Number(daysLate) || 0, excused, gateDelayCaused)

  async function save() {
    if (!profile || rubricAvg === null) return
    setSaving(true)
    await applyComponentScore(
      component.id,
      studentId,
      {
        rawScorePct: Math.round((rubricAvg / 4) * 10000) / 100,
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

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CRITERIA.map((c) => {
        const cur = scores[c.key]
        return (
          <div key={c.key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>{c.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
              {([4, 3, 2, 1] as const).map((sc) => {
                const cfg = SC_CFG[sc]
                const sel = cur === sc
                return (
                  <label key={sc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', background: sel ? cfg.bg : '#fff', border: `2px solid ${sel ? cfg.c : '#E4EAF2'}`, borderRadius: 8, cursor: 'pointer' }}>
                    <input type="radio" name={`${c.key}_${component.id}`} checked={sel} onChange={() => setScores((p) => ({ ...p, [c.key]: sc }))} style={{ margin: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 900, color: cfg.c }}>{sc}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

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
        {rubricAvg !== null && <span style={{ color: '#1A365E', marginLeft: 10 }}>Content score: {Math.round((rubricAvg / 4) * 100)}% (Mastery)</span>}
      </div>

      <button
        onClick={() => void save()}
        disabled={!allScored || saving}
        style={{ alignSelf: 'flex-start', padding: '7px 16px', background: allScored ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: allScored ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Saving…' : 'Save Discussion Score'}
      </button>
    </div>
  )
}
