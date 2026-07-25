import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { resolveDispute } from '@/lib/grading/mhsRollup'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const input: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface DisputeRow {
  id: string
  studentName: string
  subjectType: string
  reason: string
  filedAt: string
  windowDeadline: string
  recordingUrl: string | null
  currentScore: number | null
}

/** Second-reviewer (department-head-equivalent — admin/principal, see plan's
 *  open decision on the missing enum value) queue for filed disputes. Always
 *  logs an outcome, even a "no change," per spec section 9. */
export function MHSDisputeQueue() {
  const profile = useAuthStore((s) => s.profile)
  const [rows, setRows] = useState<DisputeRow[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [newScore, setNewScore] = useState<Record<string, string>>({})
  const [scoreChanged, setScoreChanged] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const canReview = profile?.role === 'admin' || profile?.role === 'principal'

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mhs_grade_disputes')
      .select('id,student_id,subject_type,reason,filed_at,window_deadline,lesson_component_id,how_score_id,students(first_name,last_name),mhs_lesson_components(raw_score_pct,recording_url)')
      .eq('status', 'Open')
      .order('filed_at', { ascending: true })

    setRows(
      (data ?? []).map((d) => {
        const s = d.students as unknown as { first_name: string | null; last_name: string | null } | null
        const comp = d.mhs_lesson_components as unknown as { raw_score_pct: number | null; recording_url: string | null } | null
        return {
          id: d.id,
          studentName: s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : '(unnamed student)',
          subjectType: d.subject_type,
          reason: d.reason,
          filedAt: d.filed_at,
          windowDeadline: d.window_deadline,
          recordingUrl: comp?.recording_url ?? null,
          currentScore: comp?.raw_score_pct ?? null,
        }
      })
    )
  }, [])

  useEffect(() => { void load() }, [load])

  async function resolve(id: string) {
    if (!profile) return
    const changed = scoreChanged[id] ?? false
    setSaving(id)
    await resolveDispute(id, profile.id, profile.role, {
      resolutionNotes: notes[id] ?? '',
      scoreChanged: changed,
      newScore: changed && newScore[id] ? Number(newScore[id]) : null,
    })
    setSaving(null)
    await load()
  }

  if (!canReview) {
    return <div style={{ ...card, padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>⛔ Only admin/principal (department-head-equivalent) can resolve disputes.</div>
  }

  if (rows.length === 0) {
    return <div style={{ ...card, padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No open disputes.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{r.studentName} · <span style={{ textTransform: 'capitalize' }}>{r.subjectType}</span></div>
            <div style={{ fontSize: 10, color: '#7A92B0' }}>Filed {new Date(r.filedAt).toLocaleDateString()} · window closes {r.windowDeadline}</div>
          </div>
          <div style={{ fontSize: 12, color: '#3D5475', margin: '8px 0', padding: '8px 10px', background: '#F7F9FC', borderRadius: 8 }}>{r.reason}</div>
          {r.currentScore !== null && <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Current score: {r.currentScore}%</div>}
          {r.recordingUrl && <a href={r.recordingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0369A1', display: 'block', marginBottom: 8 }}>View recording ↗</a>}

          <textarea
            value={notes[r.id] ?? ''}
            onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
            rows={2}
            placeholder="Resolution notes (recorded regardless of outcome)…"
            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <input type="checkbox" checked={scoreChanged[r.id] ?? false} onChange={(e) => setScoreChanged((p) => ({ ...p, [r.id]: e.target.checked }))} /> Change score
            </label>
            {scoreChanged[r.id] && (
              <input value={newScore[r.id] ?? ''} onChange={(e) => setNewScore((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="New %" style={{ ...input, width: 80 }} />
            )}
            <button
              onClick={() => void resolve(r.id)}
              disabled={saving === r.id}
              style={{ marginLeft: 'auto', padding: '6px 14px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {saving === r.id ? 'Resolving…' : 'Resolve'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
