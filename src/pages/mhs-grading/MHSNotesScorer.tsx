import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { applyComponentScore, computeLatePenaltyPct } from '@/lib/grading/mhsRollup'

const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface MHSNotesScorerComponent {
  id: string
  rawScorePct: number | null
  daysLate: number | null
  excused: boolean
  teacherVerified: boolean
  spotcheckFlag: boolean
}

interface MHSNotesScorerProps {
  component: MHSNotesScorerComponent
  studentId: string
  onSaved?: () => void
}

/** Teacher scoring for Physical Notes: content accuracy (feeds Mastery) is
 *  entered separately from lateness (feeds HOW only) — spec section 6/7. */
export function MHSNotesScorer({ component, studentId, onSaved }: MHSNotesScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [rawScore, setRawScore] = useState(component.rawScorePct?.toString() ?? '')
  const [daysLate, setDaysLate] = useState(component.daysLate?.toString() ?? '0')
  const [excused, setExcused] = useState(component.excused)
  const [gateDelayCaused, setGateDelayCaused] = useState(false)
  const [teacherVerified, setTeacherVerified] = useState(component.teacherVerified)
  const [spotcheckFlag, setSpotcheckFlag] = useState(component.spotcheckFlag)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRawScore(component.rawScorePct?.toString() ?? '')
    setDaysLate(component.daysLate?.toString() ?? '0')
    setExcused(component.excused)
    setTeacherVerified(component.teacherVerified)
    setSpotcheckFlag(component.spotcheckFlag)
  }, [component])

  const preview = computeLatePenaltyPct(Number(daysLate) || 0, excused, gateDelayCaused)

  async function save() {
    if (!profile) return
    setSaving(true)
    await applyComponentScore(
      component.id,
      studentId,
      {
        rawScorePct: rawScore.trim() ? Number(rawScore) : null,
        daysLate: Number(daysLate) || 0,
        excused,
        gateDelayCaused,
        teacherVerified,
        spotcheckFlag,
      },
      profile.id
    )
    setSaving(false)
    onSaved?.()
  }

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={label}>Content accuracy %</label>
          <input value={rawScore} onChange={(e) => setRawScore(e.target.value)} placeholder="e.g. 90" style={input} />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label style={label}>Days late</label>
          <input value={daysLate} onChange={(e) => setDaysLate(e.target.value)} style={input} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#3D5475' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="checkbox" checked={excused} onChange={(e) => setExcused(e.target.checked)} /> Excused (attendance)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="checkbox" checked={gateDelayCaused} onChange={(e) => setGateDelayCaused(e.target.checked)} /> Caused by gate delay
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="checkbox" checked={teacherVerified} onChange={(e) => setTeacherVerified(e.target.checked)} /> Teacher verified
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input type="checkbox" checked={spotcheckFlag} onChange={(e) => setSpotcheckFlag(e.target.checked)} /> Handwriting spot-check done this period
        </label>
      </div>
      <div style={{ fontSize: 11, color: preview.needsReview ? '#B91C1C' : '#15803D', fontWeight: 700 }}>
        {preview.needsReview
          ? '4+ days late — flagged for manual review, not auto-zeroed.'
          : `On-time credit: ${preview.retainedPct}% (affects HOW only, never Mastery)`}
      </div>
      <button
        onClick={() => void save()}
        disabled={saving}
        style={{ alignSelf: 'flex-start', padding: '7px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        {saving ? 'Saving…' : 'Save Notes Score'}
      </button>
    </div>
  )
}
