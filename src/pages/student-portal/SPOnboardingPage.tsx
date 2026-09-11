import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import {
  visibleOnboardingSections,
  visibleOnboardingStepKeys,
} from '@/types/onboarding'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

interface StepView {
  completed: boolean
  note: string | null
}

async function authedFetch(token: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export function SPOnboardingPage() {
  const { session, getToken } = useStudentPortal()
  const [steps, setSteps] = useState<Record<string, StepView>>({})
  const [transferring, setTransferring] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const studentDbId = session?.dbId ?? null

  const load = useCallback(async () => {
    if (!studentDbId) return
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      const map: Record<string, StepView> = {}
      let isTransfer = false

      if (token) {
        const body = await authedFetch(token, '/api/student-portal/list-my-onboarding')
        for (const s of body.steps ?? []) {
          map[s.stepKey as string] = { completed: !!s.completed, note: (s.note as string | null) ?? null }
        }
        isTransfer = !!body.transferringCredits
      } else {
        // Parent portal: authenticated Supabase user, read directly (RLS-scoped to own children).
        const [{ data: stepRows, error: stepErr }, { data: metaRow, error: metaErr }] = await Promise.all([
          supabase.from('student_onboarding').select('step_key,completed,note').eq('student_id', studentDbId),
          supabase.from('student_onboarding_meta').select('transferring_credits').eq('student_id', studentDbId).maybeSingle(),
        ])
        if (stepErr) throw new Error(stepErr.message)
        if (metaErr) throw new Error(metaErr.message)
        for (const r of stepRows ?? []) {
          map[r.step_key as string] = { completed: !!r.completed, note: (r.note as string | null) ?? null }
        }
        isTransfer = !!metaRow?.transferring_credits
      }

      setSteps(map)
      setTransferring(isTransfer)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your onboarding checklist.')
    } finally {
      setLoading(false)
    }
  }, [studentDbId, getToken])

  useEffect(() => { void load() }, [load])

  const sections = visibleOnboardingSections(transferring)
  const visibleKeys = visibleOnboardingStepKeys(transferring)
  const completedCount = visibleKeys.filter(k => steps[k]?.completed).length
  const total = visibleKeys.length
  const pct = total ? Math.round((completedCount / total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Onboarding</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Your enrollment checklist and how far along you are</p>
      </div>

      {error && (
        <div style={{ ...card, background: '#FFF8F8', border: '1px solid #F5C2C7', color: '#991B1B', fontSize: 13 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Steps completed</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#10B981' : '#F59E0B' }}>{completedCount}/{total}</span>
            </div>
            <div style={{ height: 8, background: '#E4EAF2', borderRadius: 4 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10B981' : '#F59E0B', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
          </div>

          {sections.map(section => (
            <div key={section.id} style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>{section.title}</div>
              {section.subtitle && (
                <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{section.subtitle}</div>
              )}
              <div style={{ marginTop: 6 }}>
                {section.steps.map(step => {
                  const st = steps[step.key]
                  const done = !!st?.completed
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid #EEF1F5' }}>
                      <span style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800,
                        background: done ? '#E8FBF0' : '#F0F3F8', color: done ? '#0E6B3B' : '#9EB3C8',
                        border: `1px solid ${done ? '#A7E3C0' : '#E4EAF2'}`,
                      }}>
                        {done ? <Check size={12} strokeWidth={3} /> : ''}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#0E6B3B' : '#1A365E' }}>{step.task}</div>
                        <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                          Owner: {step.owner}
                          {st?.note ? ` · ${st.note}` : ''}
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: done ? '#0E6B3B' : '#9A5B00' }}>
                        {done ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
