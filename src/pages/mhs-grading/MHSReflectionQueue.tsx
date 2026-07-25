import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { approveReflection, denyReflection } from '@/lib/grading/mhsRollup'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const input: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface ReflectionRow {
  id: string
  reflectionText: string
  pointsRequested: number | null
  submittedAt: string
  studentName: string
  lessonTitle: string
}

interface MHSReflectionQueueProps {
  onResolved?: () => void
}

export function MHSReflectionQueue({ onResolved }: MHSReflectionQueueProps) {
  const profile = useAuthStore((s) => s.profile)
  const [rows, setRows] = useState<ReflectionRow[]>([])
  const [awardInput, setAwardInput] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mhs_reflections')
      .select('id,reflection_text,points_requested,submitted_at,student_id,lesson_component_id,students(first_name,last_name),mhs_lesson_components(mhs_lessons(title))')
      .eq('status', 'Pending')
      .order('submitted_at', { ascending: true })

    const mapped: ReflectionRow[] = (data ?? []).map((r) => {
      const s = r.students as unknown as { first_name: string | null; last_name: string | null } | null
      const lesson = r.mhs_lesson_components as unknown as { mhs_lessons: { title: string } | null } | null
      return {
        id: r.id,
        reflectionText: r.reflection_text,
        pointsRequested: r.points_requested,
        submittedAt: r.submitted_at,
        studentName: `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.trim() || '(unnamed student)',
        lessonTitle: lesson?.mhs_lessons?.title ?? '',
      }
    })
    setRows(mapped)
  }, [])

  useEffect(() => { void load() }, [load])

  async function approve(id: string, requested: number | null) {
    if (!profile) return
    const raw = awardInput[id] ?? requested?.toString() ?? '0'
    const awarded = Math.min(Number(raw) || 0, requested ?? 0)
    setSaving(id)
    await approveReflection(id, awarded, profile.id, profile.role)
    setSaving(null)
    await load()
    onResolved?.()
  }

  async function deny(id: string) {
    if (!profile) return
    setSaving(id)
    await denyReflection(id, profile.id, 'Denied by teacher')
    setSaving(null)
    await load()
    onResolved?.()
  }

  if (rows.length === 0) {
    return <div style={{ ...card, padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No pending reflections.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{r.studentName} · {r.lessonTitle}</div>
          <div style={{ fontSize: 12, color: '#3D5475', margin: '8px 0', padding: '8px 10px', background: '#F7F9FC', borderRadius: 8 }}>{r.reflectionText}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#7A92B0' }}>Requested: {r.pointsRequested ?? 0} pts</span>
            <input
              value={awardInput[r.id] ?? r.pointsRequested?.toString() ?? '0'}
              onChange={(e) => setAwardInput((p) => ({ ...p, [r.id]: e.target.value }))}
              style={{ ...input, width: 70 }}
            />
            <button
              onClick={() => void approve(r.id, r.pointsRequested)}
              disabled={saving === r.id}
              style={{ padding: '6px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Approve
            </button>
            <button
              onClick={() => void deny(r.id)}
              disabled={saving === r.id}
              style={{ padding: '6px 14px', background: '#FEE2E2', color: '#D61F31', border: '1.5px solid #FCA5A5', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
