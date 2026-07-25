import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { applyGateOverride } from '@/lib/grading/mhsRollup'

interface MHSGateOverridePanelProps {
  lessonComponentId: string
  studentId: string
  onDone?: () => void
}

/** Teacher-facing gate override: mandatory reason, always logged to mhs_grade_change_log. */
export function MHSGateOverridePanel({ lessonComponentId, studentId, onDone }: MHSGateOverridePanelProps) {
  const profile = useAuthStore((s) => s.profile)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason.trim() || !profile) return
    setSaving(true)
    await applyGateOverride(lessonComponentId, studentId, reason.trim(), profile.id, profile.role)
    setSaving(false)
    setReason('')
    onDone?.()
  }

  return (
    <div style={{ padding: 10, background: '#FFF7ED', border: '1.5px solid #FDBA74', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#9A3412' }}>⚠ Gate flagged — 4th quiz attempt failed. Clearing requires a reason (logged permanently).</div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder="Reason for clearing this gate…"
        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #FDBA74', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
      />
      <button
        onClick={() => void submit()}
        disabled={!reason.trim() || saving}
        style={{ padding: '7px 14px', background: reason.trim() ? '#D97706' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed', alignSelf: 'flex-start' }}
      >
        {saving ? 'Clearing…' : 'Clear Gate'}
      </button>
    </div>
  )
}
