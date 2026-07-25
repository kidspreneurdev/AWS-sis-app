import { useState } from 'react'
import { uploadFile } from '@/lib/uploadFile'
import { useAuthStore } from '@/store/auth.store'
import { applyDebateScore, scheduleMakeupDebate } from '@/lib/grading/mhsRollup'

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
  { key: 'evidence', label: 'Use of Evidence' },
  { key: 'responsiveness', label: 'Responsiveness to Questions' },
] as const

interface MHSDebateScorerComponent {
  id: string
  recordingUrl: string | null
  recordingType: 'audio' | 'video' | null
  accommodated: boolean
  debateAbsenceFlag: boolean
  makeupScheduledFor: string | null
  makeupDeadline: string | null
}

interface MHSDebateScorerProps {
  component: MHSDebateScorerComponent
  studentId: string
  onSaved?: () => void
}

/** Teacher scoring for a Socratic Live Debate: same 1-4 rubric engine as
 *  Discussion, but exempt from the late-penalty table — instead requires a
 *  recording (or an accommodated flag) before it can be marked scored, and
 *  supports scheduling a no-zero makeup for an absence (spec section 7). */
export function MHSDebateScorer({ component, studentId, onSaved }: MHSDebateScorerProps) {
  const profile = useAuthStore((s) => s.profile)
  const [scores, setScores] = useState<Record<string, number>>({ argument: 0, evidence: 0, responsiveness: 0 })
  const [recordingUrl, setRecordingUrl] = useState(component.recordingUrl ?? '')
  const [recordingType, setRecordingType] = useState<'audio' | 'video'>(component.recordingType ?? 'video')
  const [accommodated, setAccommodated] = useState(component.accommodated)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [absenceDate, setAbsenceDate] = useState('')
  const [schedulingMakeup, setSchedulingMakeup] = useState(false)

  const allScored = CRITERIA.every((c) => scores[c.key] > 0)
  const rubricAvg = allScored ? CRITERIA.reduce((sum, c) => sum + scores[c.key], 0) / CRITERIA.length : null
  const canSave = allScored && (accommodated || recordingUrl.trim().length > 0)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const url = await uploadFile(`mhs-debates/${component.id}-${Date.now()}-${file.name}`, file)
      setRecordingUrl(url)
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!profile || rubricAvg === null || !canSave) return
    setSaving(true)
    await applyDebateScore(
      component.id,
      studentId,
      {
        rawScorePct: Math.round((rubricAvg / 4) * 10000) / 100,
        recordingUrl: accommodated ? recordingUrl.trim() || null : recordingUrl.trim(),
        recordingType: recordingUrl.trim() ? recordingType : null,
        accommodated,
      },
      profile.id
    )
    setSaving(false)
    onSaved?.()
  }

  async function scheduleMakeup() {
    if (!profile || !absenceDate) return
    setSchedulingMakeup(true)
    await scheduleMakeupDebate(component.id, studentId, absenceDate, profile.id, profile.role)
    setSchedulingMakeup(false)
    setAbsenceDate('')
    onSaved?.()
  }

  return (
    <div style={{ padding: 12, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {component.debateAbsenceFlag && (
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '6px 10px', borderRadius: 6 }}>
          Absence recorded — makeup {component.makeupScheduledFor ?? 'not yet scheduled'}, deadline {component.makeupDeadline ?? '—'}. This component is not zeroed while pending.
        </div>
      )}

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

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={label}>Recording URL {accommodated ? '(optional)' : '(required unless accommodated)'}</label>
          <input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://…" style={input} />
        </div>
        <div>
          <label style={label}>Type</label>
          <select value={recordingType} onChange={(e) => setRecordingType(e.target.value as 'audio' | 'video')} style={input}>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
        </div>
        <div>
          <label style={label}>Or upload</label>
          <input type="file" accept="audio/*,video/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} style={{ fontSize: 11 }} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#3D5475' }}>
        <input type="checkbox" checked={accommodated} onChange={(e) => setAccommodated(e.target.checked)} /> Accommodated (ELL/IEP/504/documented anxiety) — recorded 1-on-1 oral response, scored identically, never shown as lesser
      </label>

      <button
        onClick={() => void save()}
        disabled={!canSave || saving}
        style={{ alignSelf: 'flex-start', padding: '7px 16px', background: canSave ? '#059669' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }}
      >
        {saving ? 'Saving…' : 'Save Debate Score'}
      </button>

      <div style={{ borderTop: '1px dashed #E4EAF2', paddingTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={label}>Absence date (schedule makeup)</label>
          <input type="date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} style={input} />
        </div>
        <button
          onClick={() => void scheduleMakeup()}
          disabled={!absenceDate || schedulingMakeup}
          style={{ padding: '7px 14px', background: absenceDate ? '#D97706' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: absenceDate ? 'pointer' : 'not-allowed' }}
        >
          {schedulingMakeup ? 'Scheduling…' : 'Schedule Makeup (absence)'}
        </button>
      </div>
    </div>
  )
}
