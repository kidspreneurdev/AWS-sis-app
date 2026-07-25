import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { recomputeGradeForLesson } from '@/lib/grading/mhsRollup'
import { toast } from '@/lib/toast'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', padding: 14 }

const SC_CFG = {
  4: { c: '#15803D', bg: '#DCFCE7', l: 'Consistently exceeds' },
  3: { c: '#0369A1', bg: '#DBEAFE', l: 'Meets reliably' },
  2: { c: '#B45309', bg: '#FEF3C7', l: 'Inconsistent' },
  1: { c: '#D61F31', bg: '#FEE2E2', l: 'Rarely meets' },
} as Record<number, { c: string; bg: string; l: string }>

const AXES = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'preparedness', label: 'Preparedness' },
  { key: 'participation', label: 'Participation Quality' },
  { key: 'integrity', label: 'Integrity / Revision Behavior' },
] as const

type AxisKey = (typeof AXES)[number]['key']

interface MHSHowScorerProps {
  lessonId: string
  studentId: string
  onSaved?: () => void
}

/** Standardized 1-4 HOW rubric scorer — the shared rubric engine this feature
 *  reuses for Discussion/Debate/Capstone scoring in later phases too. */
export function MHSHowScorer({ lessonId, studentId, onSaved }: MHSHowScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [scores, setScores] = useState<Record<AxisKey, number>>({
    punctuality: 0,
    preparedness: 0,
    participation: 0,
    integrity: 0,
  })
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('mhs_how_scores')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('student_id', studentId)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setExistingId(data.id)
        setScores({
          punctuality: data.punctuality,
          preparedness: data.preparedness,
          participation: data.participation,
          integrity: data.integrity,
        })
        setComment(data.comment ?? '')
      } else {
        setExistingId(null)
        setScores({ punctuality: 0, preparedness: 0, participation: 0, integrity: 0 })
        setComment('')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [lessonId, studentId])

  const allScored = AXES.every((a) => scores[a.key] > 0)

  async function save() {
    if (!allScored) return
    setSaving(true)
    const payload = {
      lesson_id: lessonId,
      student_id: studentId,
      ...scores,
      comment,
      scored_by: profile?.id,
      scored_at: new Date().toISOString(),
    }
    // Upsert on the table's own unique(lesson_id, student_id) constraint rather than
    // branching on locally-cached `existingId` — that local state can go stale (e.g. a
    // row created by another action after this panel loaded) and an insert against an
    // already-existing row 409s instead of just updating it.
    const { error } = await supabase.from('mhs_how_scores').upsert(payload, { onConflict: 'lesson_id,student_id' })
    if (error) {
      toast(`Failed to save HOW score: ${error.message}`, 'err')
      setSaving(false)
      return
    }
    await recomputeGradeForLesson(lessonId, studentId)
    setSaving(false)
    onSaved?.()
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>Habits of Work — standardized rubric</div>
      {AXES.map((axis) => {
        const cur = scores[axis.key]
        return (
          <div key={axis.key} style={{ padding: 10, background: '#F7F9FC', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>{axis.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
              {([4, 3, 2, 1] as const).map((sc) => {
                const cfg = SC_CFG[sc]
                const sel = cur === sc
                return (
                  <label
                    key={sc}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 4px',
                      background: sel ? cfg.bg : '#fff', border: `2px solid ${sel ? cfg.c : '#E4EAF2'}`, borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name={`${axis.key}_${lessonId}_${studentId}`}
                      checked={sel}
                      onChange={() => setScores((p) => ({ ...p, [axis.key]: sc }))}
                      style={{ margin: 0 }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 900, color: cfg.c }}>{sc}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: cfg.c, textAlign: 'center' }}>{cfg.l}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional note…"
        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
      />
      <button
        onClick={() => void save()}
        disabled={!allScored || saving}
        style={{ padding: '8px 16px', background: allScored ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: allScored ? 'pointer' : 'not-allowed', alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving…' : existingId ? 'Update HOW Score' : 'Save HOW Score'}
      </button>
    </div>
  )
}
