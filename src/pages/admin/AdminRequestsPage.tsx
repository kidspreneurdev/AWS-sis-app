import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRequest {
  id: string
  student_id: string
  student_name: string
  parent_name: string
  request_type: string
  status: string
  form_data: Record<string, unknown>
  created_at: string
  approved_at: string | null
  approved_by: string | null
}

// ─── Request label map ────────────────────────────────────────────────────────

const REQUEST_META: Record<string, { label: string; icon: string; color: string; fieldLabels: Record<string, string> }> = {
  bonafide: {
    label: 'Bonafide Certificate', icon: '📜', color: '#6B21A8',
    fieldLabels: { purpose: 'Purpose', addressed_to: 'Addressed To', copies: 'Copies' },
  },
  tc: {
    label: 'Transfer Certificate (TC)', icon: '🏫', color: '#0369A1',
    fieldLabels: { reason: 'Reason for Transfer', new_school: 'New School', transfer_date: 'Transfer Date' },
  },
  transcript: {
    label: 'Transcript', icon: '📋', color: '#065F46',
    fieldLabels: { purpose: 'Purpose', addressed_to: 'Addressed To', copies: 'Copies' },
  },
  migration_certificate: {
    label: 'Migration Certificate', icon: '🔄', color: '#92400E',
    fieldLabels: { reason: 'Reason', new_school: 'New School / Board', transfer_date: 'Expected Date' },
  },
  id_card_digital: {
    label: 'Digital ID Card', icon: '🪪', color: '#1D4ED8',
    fieldLabels: { reason: 'Reason for Request' },
  },
}

function getMeta(type: string) {
  return REQUEST_META[type] ?? { label: type, icon: '📄', color: '#6B7280', fieldLabels: {} }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,.06)',
}

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em',
  borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap', background: '#F7F9FC',
}

const td: React.CSSProperties = {
  padding: '11px 14px', fontSize: 13, color: '#1A365E',
  borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle',
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    approved: { bg: '#D1FAE5', color: '#065F46', label: 'Approved' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  }
  const s = map[status] ?? { bg: '#F3F4F6', color: '#6B7280', label: status }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function RequestDetailModal({
  request,
  onClose,
  onApproved,
}: {
  request: StudentRequest
  onClose: () => void
  onApproved: () => void
}) {
  const { profile } = useAuthStore()
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const meta = getMeta(request.request_type)

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  async function approve() {
    setApproving(true)
    setError('')
    const { error: dbErr } = await supabase
      .from('student_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: profile?.full_name ?? profile?.email ?? 'Admin',
      })
      .eq('id', request.id)
    setApproving(false)
    if (dbErr) { setError('Failed to approve request. Please try again.'); return }
    onApproved()
    onClose()
  }

  const formEntries = Object.entries(request.form_data ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,34,64,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(15,34,64,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', background: '#F7F9FC',
          borderBottom: '1px solid #E4EAF2',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 20 }}>{meta.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 12, color: '#7A92B0' }}>Request #{request.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusChip status={request.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A92B0', padding: '2px 6px' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Student & parent info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>Student</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{request.student_name || '—'}</div>
            </div>
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>Requested By</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{request.parent_name || '—'}</div>
            </div>
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>Submitted</div>
              <div style={{ fontSize: 12, color: '#1A365E' }}>{fmtDate(request.created_at)}</div>
            </div>
            {request.approved_at && (
              <div style={{ background: '#F0FFF4', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>Approved</div>
                <div style={{ fontSize: 12, color: '#065F46' }}>{fmtDate(request.approved_at)}</div>
                {request.approved_by && <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 1 }}>by {request.approved_by}</div>}
              </div>
            )}
          </div>

          {/* Form details */}
          {formEntries.length > 0 && (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #E4EAF2', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>
                Request Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {formEntries.map(([key, value]) => (
                  <div key={key} style={{ padding: '10px 14px', borderBottom: '1px solid #F0F4F8', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0' }}>
                      {meta.fieldLabels[key] ?? key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 13, color: '#1A365E' }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 20px', background: '#F7F9FC', border: '1.5px solid #E4EAF2',
                borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#3D5475',
              }}
            >
              Close
            </button>
            {request.status === 'pending' && (
              <button
                onClick={() => void approve()}
                disabled={approving}
                style={{
                  padding: '9px 24px', background: approving ? '#aaa' : '#059669',
                  color: '#fff', border: 'none', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {approving ? 'Approving…' : '✓ Approve Request'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['All', 'Pending', 'Approved'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

export function AdminRequestsPage() {
  const [requests, setRequests] = useState<StudentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StudentRequest | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [typeFilter, setTypeFilter] = useState('All')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('student_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as StudentRequest[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const pending = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length

  const filtered = requests.filter(r => {
    const statusMatch = filter === 'All' || r.status === filter.toLowerCase()
    const typeMatch = typeFilter === 'All' || r.request_type === typeFilter
    return statusMatch && typeMatch
  })

  const allTypes = Array.from(new Set(requests.map(r => r.request_type)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📬 Parent Requests</div>
        <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Review and approve document requests submitted by parents</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Requests', value: requests.length, color: '#1A365E', bg: '#EEF3FF' },
          { label: 'Pending', value: pending, color: '#92400E', bg: '#FEF3C7' },
          { label: 'Approved', value: approved, color: '#065F46', bg: '#D1FAE5' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px', background: s.bg, border: 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: .7, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#F7F9FC', borderRadius: 9, padding: 4, border: '1px solid #E4EAF2' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', fontFamily: 'inherit',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: filter === f ? '#1A365E' : 'transparent',
                color: filter === f ? '#fff' : '#7A92B0',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E4EAF2',
            fontSize: 12, color: '#1A365E', background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          <option value="All">All Types</option>
          {allTypes.map(t => (
            <option key={t} value={t}>{getMeta(t).label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Student</th>
              <th style={th}>Request Type</th>
              <th style={th}>Requested By</th>
              <th style={th}>Submitted</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No requests found.</td>
              </tr>
            ) : (
              filtered.map(req => {
                const meta = getMeta(req.request_type)
                return (
                  <tr
                    key={req.id}
                    onClick={() => setSelected(req)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F7F9FC' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{req.student_name || '—'}</div>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{meta.icon}</span>
                        <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#3D5475' }}>{req.parent_name || '—'}</td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 12 }}>{fmtDate(req.created_at)}</td>
                    <td style={td}><StatusChip status={req.status} /></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setSelected(req) }}
                        style={{
                          padding: '5px 14px', background: req.status === 'pending' ? '#1A365E' : '#F7F9FC',
                          color: req.status === 'pending' ? '#fff' : '#7A92B0',
                          border: '1px solid #E4EAF2', borderRadius: 7,
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {req.status === 'pending' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <RequestDetailModal
          request={selected}
          onClose={() => setSelected(null)}
          onApproved={() => void load()}
        />
      )}
    </div>
  )
}
