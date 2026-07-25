import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { applyCapstoneScore } from '@/lib/grading/mhsRollup'

const SC_CFG = {
  4: { c: '#15803D', bg: '#DCFCE7' },
  3: { c: '#0369A1', bg: '#DBEAFE' },
  2: { c: '#B45309', bg: '#FEF3C7' },
  1: { c: '#D61F31', bg: '#FEE2E2' },
} as Record<number, { c: string; bg: string }>

const CRITERIA = [
  { key: 'synthesis', label: 'Synthesis Across Lessons' },
  { key: 'depth', label: 'Depth of Understanding' },
  { key: 'defense', label: 'Communication & Defense' },
] as const

interface MHSCapstoneScorerProps {
  componentId: string
  existingScorePct: number | null
  onSaved?: () => void
}

/** Module-level checkpoint: same standardized 1-4 rubric engine, weighted
 *  higher than a single lesson component per module.capstone_weight_pct —
 *  scored as an oral defense synthesizing 3-5 lessons (spec section 8). */
export function MHSCapstoneScorer({ componentId, existingScorePct, onSaved }: MHSCapstoneScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [scores, setScores] = useState<Record<string, number>>({ synthesis: 0, depth: 0, defense: 0 })
  const [saving, setSaving] = useState(false)

  const allScored = CRITERIA.every((c) => scores[c.key] > 0)
  const rubricAvg = allScored ? CRITERIA.reduce((sum, c) => sum + scores[c.key], 0) / CRITERIA.length : null

  async function save() {
    if (!profile || rubricAvg === null) return
    setSaving(true)
    await applyCapstoneScore(componentId, Math.round((rubricAvg / 4) * 10000) / 100, profile.id)
    setSaving(false)
    onSaved?.()
  }

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {existingScorePct !== null && <div style={{ fontSize: 11, color: '#15803D', fontWeight: 700 }}>Current score: {existingScorePct}%</div>}
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
                    <input type="radio" name={`${c.key}_${componentId}`} checked={sel} onChange={() => setScores((p) => ({ ...p, [c.key]: sc }))} style={{ margin: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 900, color: cfg.c }}>{sc}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      <button
        onClick={() => void save()}
        disabled={!allScored || saving}
        style={{ alignSelf: 'flex-start', padding: '7px 16px', background: allScored ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: allScored ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Saving…' : 'Save Capstone Score'}
      </button>
    </div>
  )
}
