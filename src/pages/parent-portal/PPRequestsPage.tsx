import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParentPortal } from '@/contexts/ParentPortalContext'

// ─── Request type config ──────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date'
  placeholder?: string
  required?: boolean
}

interface RequestTypeDef {
  id: string
  label: string
  icon: string
  color: string
  bgColor: string
  description: string
  fields: FieldDef[]
}

const REQUEST_TYPES: RequestTypeDef[] = [
  {
    id: 'bonafide',
    label: 'Bonafide Certificate',
    icon: '📜',
    color: '#6B21A8',
    bgColor: '#FAF5FF',
    description: 'Official certificate confirming student enrollment status',
    fields: [
      { key: 'purpose', label: 'Purpose', type: 'text', placeholder: 'e.g. Bank account, Scholarship application', required: true },
      { key: 'addressed_to', label: 'Addressed To', type: 'text', placeholder: 'e.g. The Manager, SBI Bank', required: true },
      { key: 'copies', label: 'Number of Copies', type: 'number', placeholder: '1', required: true },
    ],
  },
  {
    id: 'tc',
    label: 'Transfer Certificate (TC)',
    icon: '🏫',
    color: '#0369A1',
    bgColor: '#F0F9FF',
    description: 'Required when transferring to another school or institution',
    fields: [
      { key: 'reason', label: 'Reason for Transfer', type: 'textarea', placeholder: 'Please explain the reason for transfer', required: true },
      { key: 'new_school', label: 'New School Name', type: 'text', placeholder: 'Name of the new school', required: true },
      { key: 'transfer_date', label: 'Expected Transfer Date', type: 'date', required: true },
    ],
  },
  {
    id: 'transcript',
    label: 'Transcript',
    icon: '📋',
    color: '#065F46',
    bgColor: '#ECFDF5',
    description: 'Official academic transcript of grades and completed courses',
    fields: [
      { key: 'purpose', label: 'Purpose', type: 'text', placeholder: 'e.g. College application, University admission', required: true },
      { key: 'addressed_to', label: 'Addressed To', type: 'text', placeholder: 'e.g. University Admissions Office' },
      { key: 'copies', label: 'Number of Copies', type: 'number', placeholder: '1', required: true },
    ],
  },
  {
    id: 'migration_certificate',
    label: 'Migration Certificate',
    icon: '🔄',
    color: '#92400E',
    bgColor: '#FFFBEB',
    description: 'Certificate required for joining another board or state institution',
    fields: [
      { key: 'reason', label: 'Reason for Migration', type: 'textarea', placeholder: 'Please state the reason for migration', required: true },
      { key: 'new_school', label: 'New School / Board Name', type: 'text', placeholder: 'Name of the new institution', required: true },
      { key: 'transfer_date', label: 'Expected Date', type: 'date', required: true },
    ],
  },
  {
    id: 'id_card_digital',
    label: 'Digital ID Card',
    icon: '🪪',
    color: '#1D4ED8',
    bgColor: '#EFF6FF',
    description: 'Digital version of the official student ID card',
    fields: [
      { key: 'reason', label: 'Reason for Request', type: 'text', placeholder: 'e.g. Lost original, Damaged, First time', required: true },
    ],
  },
]

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #E4EAF2', fontSize: 13, color: '#1A365E',
  background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
}

const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#3D5475',
  textTransform: 'uppercase', letterSpacing: '.7px',
  display: 'block', marginBottom: 4,
}

// ─── Past Requests ────────────────────────────────────────────────────────────

interface SubmittedRequest {
  id: string
  request_type: string
  status: string
  created_at: string
  form_data: Record<string, unknown>
}

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  }
  const s = map[status] ?? { bg: '#F3F4F6', color: '#6B7280', label: status }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ─── Request Form Modal ───────────────────────────────────────────────────────

function RequestModal({
  type,
  activeChild,
  session,
  onClose,
  onSubmitted,
}: {
  type: RequestTypeDef
  activeChild: { dbId: string; fullName: string } | null
  session: { parentName: string; parentId: string } | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string) {
    setFormData(prev => ({ ...prev, [key]: val }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeChild || !session) return
    setSubmitting(true)
    setError('')
    const { error: dbErr } = await supabase.from('student_requests').insert({
      student_id: activeChild.dbId,
      student_name: activeChild.fullName,
      parent_id: session.parentId,
      parent_name: session.parentName,
      request_type: type.id,
      status: 'pending',
      form_data: formData,
    })
    setSubmitting(false)
    if (dbErr) { setError('Failed to submit request. Please try again.'); return }
    setSubmitted(true)
    onSubmitted()
    setTimeout(onClose, 2000)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,34,64,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(15,34,64,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: type.bgColor, padding: '20px 24px',
          borderBottom: `1px solid ${type.color}22`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{type.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: type.color }}>{type.label}</div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{type.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A92B0', padding: '2px 6px', marginTop: -4 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#065F46' }}>Request Submitted!</div>
              <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4 }}>
                Your {type.label} request has been sent to the school admin.
              </div>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeChild && (
                <div style={{ background: '#F7F9FC', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#3D5475' }}>
                  Requesting for: <strong style={{ color: '#1A365E' }}>{activeChild.fullName}</strong>
                </div>
              )}
              {type.fields.map(field => (
                <div key={field.key}>
                  <label style={lbl}>
                    {field.label}{field.required && <span style={{ color: '#D61F31' }}> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] ?? ''}
                      onChange={e => set(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key] ?? ''}
                      onChange={e => set(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      min={field.type === 'number' ? 1 : undefined}
                      style={inp}
                    />
                  )}
                </div>
              ))}
              {error && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 20px', background: '#F7F9FC', border: '1.5px solid #E4EAF2',
                    borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#3D5475',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !activeChild}
                  style={{
                    padding: '9px 24px', background: submitting ? '#aaa' : type.color,
                    color: '#fff', border: 'none', borderRadius: 9,
                    fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PPRequestsPage() {
  const { session, activeChild } = useParentPortal()
  const [selected, setSelected] = useState<RequestTypeDef | null>(null)
  const [myRequests, setMyRequests] = useState<SubmittedRequest[]>([])
  const [loadingReqs, setLoadingReqs] = useState(true)

  async function loadRequests() {
    if (!activeChild) return
    setLoadingReqs(true)
    const { data } = await supabase
      .from('student_requests')
      .select('id, request_type, status, created_at, form_data')
      .eq('student_id', activeChild.dbId)
      .order('created_at', { ascending: false })
    setMyRequests((data ?? []) as SubmittedRequest[])
    setLoadingReqs(false)
  }

  useEffect(() => { void loadRequests() }, [activeChild?.dbId])

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getLabelFor(type: string) {
    return REQUEST_TYPES.find(r => r.id === type)?.label ?? type
  }

  function getIconFor(type: string) {
    return REQUEST_TYPES.find(r => r.id === type)?.icon ?? '📄'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#6B21A8' }}>📬 Requests</div>
        <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
          {activeChild
            ? `Submit official document requests for ${activeChild.fullName}`
            : 'Select a child to submit requests'}
        </div>
      </div>

      {/* Request type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {REQUEST_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setSelected(type)}
            disabled={!activeChild}
            style={{
              background: type.bgColor,
              border: `1.5px solid ${type.color}33`,
              borderRadius: 14,
              padding: '20px 18px',
              cursor: activeChild ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              transition: 'transform 120ms, box-shadow 120ms',
              fontFamily: 'inherit',
              opacity: activeChild ? 1 : 0.5,
            }}
            onMouseEnter={e => {
              if (!activeChild) return
              const el = e.currentTarget
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = `0 8px 24px ${type.color}22`
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.transform = ''
              el.style.boxShadow = ''
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{type.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: type.color, lineHeight: 1.3 }}>{type.label}</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6, lineHeight: 1.5 }}>{type.description}</div>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: type.color }}>
              Request →
            </div>
          </button>
        ))}
      </div>

      {/* Past requests */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,.06)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 700, color: '#1A365E' }}>
          📋 My Requests ({myRequests.length})
        </div>
        {loadingReqs ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>Loading…</div>
        ) : myRequests.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No requests submitted yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {myRequests.map(req => (
              <div key={req.id} style={{ padding: '12px 18px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 20 }}>{getIconFor(req.request_type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{getLabelFor(req.request_type)}</div>
                  <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 1 }}>Submitted {fmtDate(req.created_at)}</div>
                </div>
                {statusChip(req.status)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <RequestModal
          type={selected}
          activeChild={activeChild}
          session={session ? { parentName: session.parentName, parentId: session.parentId } : null}
          onClose={() => setSelected(null)}
          onSubmitted={() => void loadRequests()}
        />
      )}
    </div>
  )
}
