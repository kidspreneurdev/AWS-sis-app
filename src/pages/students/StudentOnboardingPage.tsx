import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import {
  ONBOARDING_SECTIONS,
  visibleOnboardingSections,
  visibleOnboardingStepKeys,
  type OnboardingStep,
} from '@/types/onboarding'

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

// ─── Local types ──────────────────────────────────────────────────────────────
interface RecordStudent {
  id: string
  studentId: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
}

interface StepState {
  completed: boolean
  note: string
}

function toDbErrorMessage(error: unknown) {
  const msg = (error as { message?: string } | null)?.message ?? 'Unknown database error'
  const lower = msg.toLowerCase()
  if (lower.includes('relation') && lower.includes('student_onboarding')) {
    return 'Table "student_onboarding" not found. Run the onboarding migration first.'
  }
  return msg
}

// ─── Step row ─────────────────────────────────────────────────────────────────
function StepRow({
  step, state, busy, onToggle, onNoteBlur,
}: {
  step: OnboardingStep
  state: StepState
  busy: boolean
  onToggle: (completed: boolean) => void
  onNoteBlur: (note: string) => void
}) {
  // Uncontrolled: remounts (via key on the caller) when the saved note changes.
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
      borderTop: '1px solid #EEF1F5',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: busy ? 'wait' : 'pointer', paddingTop: 1 }}>
        <input
          type="checkbox"
          checked={state.completed}
          disabled={busy}
          onChange={e => onToggle(e.target.checked)}
          style={{ width: 17, height: 17, accentColor: '#0E6B3B', cursor: 'inherit' }}
        />
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: state.completed ? '#0E6B3B' : '#1A365E' }}>
          <span style={{ color: '#9EB3C8', fontWeight: 700, marginRight: 6 }}>{step.num}.</span>
          {step.task}
        </div>
        <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Owner: {step.owner}</div>
        <input
          defaultValue={state.note}
          placeholder="Add a note (optional)"
          onBlur={e => { if (e.target.value !== state.note) onNoteBlur(e.target.value) }}
          style={{
            marginTop: 6, width: '100%', maxWidth: 420, padding: '5px 8px', fontSize: 12,
            border: '1px solid #E4EAF2', borderRadius: 6, color: '#1A365E', background: '#F9FBFF',
          }}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StudentOnboardingPage() {
  const cf = useCampusFilter()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState<RecordStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [transferring, setTransferring] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [savingTransfer, setSavingTransfer] = useState(false)

  // Load students
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('students').select('id,student_id,first_name,last_name,grade,status,campus')
    if (cf) q = q.eq('campus', cf)
    q.then(({ data, error }) => {
      if (error) {
        toast(error.message || 'Failed to load students', 'err')
        setStudents([]); setLoading(false); return
      }
      const rows: RecordStudent[] = (data ?? []).map(r => ({
        id: r.id as string,
        studentId: (r.student_id as string) ?? '',
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        grade: r.grade == null ? null : String(r.grade),
        status: (r.status as string) ?? '',
      })).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      setStudents(rows)
      const deepLink = searchParams.get('id')
      setSelectedId(prev => {
        if (prev && rows.some(r => r.id === prev)) return prev
        if (deepLink && rows.some(r => r.id === deepLink)) return deepLink
        return rows[0]?.id ?? ''
      })
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf])

  // Load progress + meta for the selected student
  useEffect(() => {
    if (!selectedId) { setSteps({}); setTransferring(false); return }
    supabase.from('student_onboarding').select('step_key,completed,note').eq('student_id', selectedId).then(({ data, error }) => {
      if (error) { toast(toDbErrorMessage(error), 'err'); setSteps({}); return }
      const map: Record<string, StepState> = {}
      for (const r of data ?? []) {
        map[r.step_key as string] = { completed: !!r.completed, note: (r.note as string | null) ?? '' }
      }
      setSteps(map)
    })
    supabase.from('student_onboarding_meta').select('transferring_credits').eq('student_id', selectedId).maybeSingle().then(({ data }) => {
      setTransferring(!!data?.transferring_credits)
    })
  }, [selectedId])

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedId) ?? null, [students, selectedId])

  const headerPortal = useHeaderActions(
    <select
      value={selectedId}
      onChange={e => setSelectedId(e.target.value)}
      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', maxWidth: 260 }}
    >
      {students.length === 0 && <option value="">No students</option>}
      {students.map(s => (
        <option key={s.id} value={s.id}>
          {s.lastName}, {s.firstName}{s.grade ? ` (Gr ${s.grade})` : ''}
        </option>
      ))}
    </select>,
  )

  function stateFor(key: string): StepState {
    return steps[key] ?? { completed: false, note: '' }
  }

  async function upsertStep(step: OnboardingStep, next: StepState) {
    if (!selectedId) return
    setBusyKey(step.key)
    const prev = steps[step.key]
    setSteps(s => ({ ...s, [step.key]: next }))
    try {
      const nowCompleted = next.completed && !prev?.completed
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('student_onboarding').upsert({
        student_id: selectedId,
        step_key: step.key,
        completed: next.completed,
        note: next.note || null,
        completed_by: user.user?.id ?? null,
        completed_at: next.completed ? (prev?.completed ? undefined : new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,step_key' })
      if (error) {
        setSteps(s => ({ ...s, [step.key]: prev ?? { completed: false, note: '' } }))
        toast(toDbErrorMessage(error), 'err')
        return
      }
      if (nowCompleted) toast(`"${step.task}" marked complete`, 'ok')
    } finally {
      setBusyKey(null)
    }
  }

  async function toggleTransfer(value: boolean) {
    if (!selectedId) return
    setSavingTransfer(true)
    const prev = transferring
    setTransferring(value)
    try {
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('student_onboarding_meta').upsert({
        student_id: selectedId,
        transferring_credits: value,
        updated_by: user.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id' })
      if (error) { setTransferring(prev); toast(toDbErrorMessage(error), 'err') }
    } finally {
      setSavingTransfer(false)
    }
  }

  const visibleSections = visibleOnboardingSections(transferring)
  const visibleKeys = visibleOnboardingStepKeys(transferring)
  const completedCount = visibleKeys.filter(k => steps[k]?.completed).length
  const total = visibleKeys.length
  const pct = total ? Math.round((completedCount / total) * 100) : 0

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>
              {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Onboarding'}
            </div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>
              {selectedStudent
                ? `${selectedStudent.studentId}${selectedStudent.grade ? ` · Grade ${selectedStudent.grade}` : ''} · ${selectedStudent.status}`
                : 'Select a student from the header to track their enrollment checklist.'}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: completedCount === total ? '#0E6B3B' : '#9A5B00' }}>
            {completedCount}/{total} steps complete
          </div>
        </div>

        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
        ) : !selectedStudent ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>No students found.</div>
        ) : (
          <>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Onboarding progress</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#10B981' : '#F59E0B' }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: '#E4EAF2', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F59E0B', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>

            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Transferring credits from another school?</div>
                <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>Turning this on reveals Section B (high school transfer credits).</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: savingTransfer ? 'wait' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={transferring}
                  disabled={savingTransfer}
                  onChange={e => void toggleTransfer(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: '#1A365E', cursor: 'inherit' }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: transferring ? '#1A365E' : '#7A92B0' }}>
                  {transferring ? 'Yes' : 'No'}
                </span>
              </label>
            </div>

            {visibleSections.map(section => (
              <div key={section.id} style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>{section.title}</div>
                {section.subtitle && (
                  <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{section.subtitle}</div>
                )}
                <div style={{ marginTop: 6 }}>
                  {section.steps.map(step => (
                    <StepRow
                      key={`${step.key}:${stateFor(step.key).note}`}
                      step={step}
                      state={stateFor(step.key)}
                      busy={busyKey === step.key}
                      onToggle={completed => void upsertStep(step, { ...stateFor(step.key), completed })}
                      onNoteBlur={note => void upsertStep(step, { ...stateFor(step.key), note })}
                    />
                  ))}
                </div>
              </div>
            ))}

            {!transferring && (
              <div style={{ ...card, background: '#F7F9FC', fontSize: 12, color: '#7A92B0' }}>
                Section B ({ONBOARDING_SECTIONS.find(s => s.id === 'B')?.steps.length} transfer-credit steps) is hidden.
                Toggle “Transferring credits” on if this is a transfer case.
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
