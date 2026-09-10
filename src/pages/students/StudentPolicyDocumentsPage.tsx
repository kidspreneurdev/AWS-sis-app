import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { downloadUrl } from '@/lib/uploadFile'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { StudentCombobox } from '@/components/shared/StudentCombobox'
import {
  POLICY_DOCS,
  POLICY_STATUS_META,
  type PolicyDoc,
  type PolicyDocStatus,
} from '@/types/policyDocument'

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 8,
    border: bg === '#fff' ? '1px solid #E4EAF2' : 'none',
    background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }
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

interface PolicyRow {
  status: PolicyDocStatus
  signedFileUrl: string | null
  signedFileName: string | null
  submittedAt: string | null
  reviewNote: string | null
}

function toDbErrorMessage(error: unknown) {
  const msg = (error as { message?: string } | null)?.message ?? 'Unknown database error'
  if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('student_policy_documents')) {
    return 'Table "student_policy_documents" not found. Run the policy-documents migration first.'
  }
  return msg
}

function StatusBadge({ status }: { status: PolicyDocStatus }) {
  const m = POLICY_STATUS_META[status]
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.bg, color: m.fg, flexShrink: 0 }}>
      {m.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StudentPolicyDocumentsPage() {
  const cf = useCampusFilter()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState<RecordStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState<Record<string, PolicyRow>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

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
      const list: RecordStudent[] = (data ?? []).map(r => ({
        id: r.id as string,
        studentId: (r.student_id as string) ?? '',
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        grade: r.grade == null ? null : String(r.grade),
        status: (r.status as string) ?? '',
      })).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
      setStudents(list)
      const deepLink = searchParams.get('id')
      setSelectedId(prev => {
        if (prev && list.some(r => r.id === prev)) return prev
        if (deepLink && list.some(r => r.id === deepLink)) return deepLink
        return list[0]?.id ?? ''
      })
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf])

  function loadRows(studentId: string) {
    setPending(new Set())
    supabase
      .from('student_policy_documents')
      .select('policy_key,status,signed_file_url,signed_file_name,submitted_at,review_note')
      .eq('student_id', studentId)
      .then(({ data, error }) => {
        if (error) { toast(toDbErrorMessage(error), 'err'); setRows({}); return }
        const map: Record<string, PolicyRow> = {}
        for (const r of data ?? []) {
          map[r.policy_key as string] = {
            status: (r.status as PolicyDocStatus) ?? 'requested',
            signedFileUrl: (r.signed_file_url as string | null) ?? null,
            signedFileName: (r.signed_file_name as string | null) ?? null,
            submittedAt: (r.submitted_at as string | null) ?? null,
            reviewNote: (r.review_note as string | null) ?? null,
          }
        }
        setRows(map)
      })
  }

  useEffect(() => {
    if (!selectedId) { setRows({}); setPending(new Set()); return }
    loadRows(selectedId)
  }, [selectedId])

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedId) ?? null, [students, selectedId])

  const headerPortal = useHeaderActions(
    <StudentCombobox
      students={students}
      value={selectedId}
      onChange={setSelectedId}
      getLabel={s => `${s.firstName} ${s.lastName}`}
      getMeta={s => (s.grade ? `Grade ${s.grade}` : undefined)}
      getStatus={s => s.status || undefined}
      placeholder={students.length === 0 ? 'No students' : 'Search students…'}
      style={{ width: 260, maxWidth: 260 }}
    />,
  )

  function togglePending(key: string) {
    setPending(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function sendRequests() {
    if (!selectedId || pending.size === 0) return
    setSending(true)
    try {
      const { data: user } = await supabase.auth.getUser()
      const payload = [...pending].map(policy_key => ({
        student_id: selectedId,
        policy_key,
        status: 'requested',
        requested_by: user.user?.id ?? null,
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase
        .from('student_policy_documents')
        .upsert(payload, { onConflict: 'student_id,policy_key' })
      if (error) { toast(toDbErrorMessage(error), 'err'); return }
      toast(`Request sent for ${pending.size} ${pending.size === 1 ? 'policy' : 'policies'}`, 'ok')
      loadRows(selectedId)
    } finally {
      setSending(false)
    }
  }

  async function review(key: string, status: 'approved' | 'rejected') {
    if (!selectedId) return
    let note: string | null = null
    if (status === 'rejected') {
      const reason = window.prompt('Reason for rejecting this policy document:')
      if (reason == null) return
      note = reason.trim() || null
    }
    setBusyKey(key)
    try {
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('student_policy_documents')
        .update({
          status,
          reviewed_by: user.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: note,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', selectedId)
        .eq('policy_key', key)
      if (error) { toast(toDbErrorMessage(error), 'err'); return }
      toast(status === 'approved' ? 'Policy approved' : 'Policy rejected', 'ok')
      loadRows(selectedId)
    } finally {
      setBusyKey(null)
    }
  }

  async function reRequest(key: string) {
    if (!selectedId) return
    if (!window.confirm('Re-request this policy? The student will need to upload a signed copy again.')) return
    setBusyKey(key)
    try {
      const { error } = await supabase
        .from('student_policy_documents')
        .update({
          status: 'requested',
          signed_file_url: null,
          signed_file_name: null,
          submitted_at: null,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', selectedId)
        .eq('policy_key', key)
      if (error) { toast(toDbErrorMessage(error), 'err'); return }
      loadRows(selectedId)
    } finally {
      setBusyKey(null)
    }
  }

  const rowValues = Object.values(rows)
  const approvedCount = rowValues.filter(r => r.status === 'approved').length

  function PolicyCard({ doc }: { doc: PolicyDoc }) {
    const row = rows[doc.key]
    const busy = busyKey === doc.key
    return (
      <div style={{ ...card, background: row ? '#fff' : '#F7F9FC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: row ? 'default' : 'pointer' }}>
            {!row && (
              <input
                type="checkbox"
                checked={pending.has(doc.key)}
                onChange={() => togglePending(doc.key)}
                style={{ width: 17, height: 17, accentColor: '#1A365E', marginTop: 1 }}
              />
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{doc.label}</div>
              <a
                href={encodeURI(doc.file)}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: '#3557A6', fontWeight: 600, textDecoration: 'none' }}
              >
                Preview blank policy →
              </a>
            </div>
          </label>
          {row ? <StatusBadge status={row.status} /> : (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9EB3C8', flexShrink: 0 }}>Not requested</span>
          )}
        </div>

        {row && (row.status === 'submitted' || row.status === 'approved' || row.status === 'rejected') && (
          <div style={{ marginTop: 12, background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#7A92B0', minWidth: 0 }}>
                {row.signedFileName ? `📄 ${row.signedFileName}` : 'Signed copy uploaded'}
                {row.submittedAt ? ` · ${new Date(row.submittedAt).toLocaleDateString()}` : ''}
              </div>
              {row.signedFileUrl && (
                <button
                  onClick={() => void downloadUrl(row.signedFileUrl!, row.signedFileName || `${doc.label}.pdf`)}
                  style={btn('#1A365E')}
                >
                  View signed file
                </button>
              )}
            </div>
            {row.status === 'rejected' && row.reviewNote && (
              <div style={{ fontSize: 12, color: '#991B1B' }}>Rejected: {row.reviewNote}</div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.status === 'submitted' && (
                <>
                  <button onClick={() => void review(doc.key, 'approved')} disabled={busy} style={btn('#0E6B3B')}>Approve</button>
                  <button onClick={() => void review(doc.key, 'rejected')} disabled={busy} style={btn('#FFF0F1', '#D61F31')}>Reject</button>
                </>
              )}
              {(row.status === 'approved' || row.status === 'rejected') && (
                <button onClick={() => void reRequest(doc.key)} disabled={busy} style={btn('#fff', '#1A365E')}>Re-request</button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>
              {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Policy Documents'}
            </div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>
              {selectedStudent
                ? `${selectedStudent.studentId}${selectedStudent.grade ? ` · Grade ${selectedStudent.grade}` : ''} · ${selectedStudent.status}`
                : 'Select a student from the header to request signed policy documents.'}
            </div>
          </div>
          {rowValues.length > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: approvedCount === rowValues.length ? '#0E6B3B' : '#9A5B00' }}>
              {approvedCount}/{rowValues.length} approved
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
        ) : !selectedStudent ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>No students found.</div>
        ) : (
          <>
            {POLICY_DOCS.map(doc => <PolicyCard key={doc.key} doc={doc} />)}

            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#7A92B0' }}>
                {pending.size > 0
                  ? `${pending.size} ${pending.size === 1 ? 'policy' : 'policies'} selected to request`
                  : 'Tick the policies to request, then send.'}
              </div>
              <button
                onClick={() => void sendRequests()}
                disabled={sending || pending.size === 0}
                style={{ ...btn('#D61F31'), opacity: pending.size === 0 ? 0.5 : 1, cursor: pending.size === 0 ? 'not-allowed' : 'pointer' }}
              >
                {sending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
