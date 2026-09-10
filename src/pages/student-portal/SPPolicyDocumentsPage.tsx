import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFile, downloadUrl } from '@/lib/uploadFile'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import {
  POLICY_DOCS,
  POLICY_DOC_BY_KEY,
  POLICY_STATUS_META,
  type PolicyDocStatus,
} from '@/types/policyDocument'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 8, border: bg === '#fff' ? '1px solid #E4EAF2' : 'none',
    background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }
}

interface PolicyRow {
  policyKey: string
  status: PolicyDocStatus
  signedFileUrl: string | null
  signedFileName: string | null
  reviewNote: string | null
}

async function authedFetch(token: string, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers, Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export function SPPolicyDocumentsPage() {
  const { session, getToken } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const [rows, setRows] = useState<PolicyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const studentDbId = session?.dbId ?? null

  const load = useCallback(async () => {
    if (!studentDbId) return
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      let list: PolicyRow[] = []
      if (token) {
        const body = await authedFetch(token, '/api/student-portal/list-my-policy-documents')
        list = (body.policies ?? []).map((r: Record<string, unknown>) => ({
          policyKey: r.policyKey as string,
          status: (r.status as PolicyDocStatus) ?? 'requested',
          signedFileUrl: (r.signedFileUrl as string | null) ?? null,
          signedFileName: (r.signedFileName as string | null) ?? null,
          reviewNote: (r.reviewNote as string | null) ?? null,
        }))
      } else {
        const { data, error: dbError } = await supabase
          .from('student_policy_documents')
          .select('policy_key,status,signed_file_url,signed_file_name,review_note')
          .eq('student_id', studentDbId)
        if (dbError) throw new Error(dbError.message)
        list = (data ?? []).map((r: Record<string, unknown>) => ({
          policyKey: r.policy_key as string,
          status: (r.status as PolicyDocStatus) ?? 'requested',
          signedFileUrl: (r.signed_file_url as string | null) ?? null,
          signedFileName: (r.signed_file_name as string | null) ?? null,
          reviewNote: (r.review_note as string | null) ?? null,
        }))
      }
      // Keep the canonical policy order.
      list.sort((a, b) => POLICY_DOCS.findIndex(d => d.key === a.policyKey) - POLICY_DOCS.findIndex(d => d.key === b.policyKey))
      setRows(list.filter(r => POLICY_DOC_BY_KEY[r.policyKey]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your policy documents.')
    } finally {
      setLoading(false)
    }
  }, [studentDbId, getToken])

  useEffect(() => { void load() }, [load])

  async function handleUpload(policyKey: string, file: File) {
    if (!studentDbId) return
    if (file.type !== 'application/pdf') { setError('Please upload a PDF file.'); return }
    const token = getToken()
    if (!token) { setError('Uploading is only available from the student portal.'); return }
    setBusyKey(policyKey)
    setError('')
    try {
      const path = `policy-signed/${studentDbId}/${policyKey}/${Date.now()}_${file.name}`
      const url = await uploadFile(path, file)
      await authedFetch(token, '/api/student-portal/submit-policy-document', {
        method: 'POST',
        body: JSON.stringify({ policyKey, fileUrl: url, fileName: file.name }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Policy Documents</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Read, sign and return your school policy documents</p>
      </div>

      {error && (
        <div style={{ ...card, background: '#FFF8F8', border: '1px solid #F5C2C7', color: '#991B1B', fontSize: 13 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>
          No policy documents have been requested yet.
        </div>
      ) : (
        rows.map(row => {
          const doc = POLICY_DOC_BY_KEY[row.policyKey]
          const m = POLICY_STATUS_META[row.status]
          const busy = busyKey === row.policyKey
          const canUpload = !readOnly && row.status !== 'approved'
          return (
            <div key={row.policyKey} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{doc.label}</div>
                  {row.status === 'rejected' && row.reviewNote && (
                    <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>Rejected: {row.reviewNote}. Please re-upload a signed copy.</div>
                  )}
                  {row.status === 'submitted' && (
                    <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>Uploaded — waiting for the school to review.</div>
                  )}
                  {row.status === 'approved' && (
                    <div style={{ fontSize: 12, color: '#0E6B3B', marginTop: 2 }}>Approved — nothing more to do.</div>
                  )}
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.bg, color: m.fg, flexShrink: 0 }}>
                  {m.label}
                </span>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => void downloadUrl(encodeURI(doc.file), `${doc.label}.pdf`)} style={btn('#1A365E')}>
                  Download
                </button>

                {row.signedFileUrl && (
                  <button
                    onClick={() => void downloadUrl(row.signedFileUrl!, row.signedFileName || `${doc.label} (signed).pdf`)}
                    style={btn('#fff', '#1A365E')}
                  >
                    View my upload
                  </button>
                )}

                {canUpload && (
                  <>
                    <input
                      ref={el => { fileInputs.current[row.policyKey] = el }}
                      type="file"
                      accept=".pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void handleUpload(row.policyKey, f)
                      }}
                    />
                    <button
                      onClick={() => fileInputs.current[row.policyKey]?.click()}
                      disabled={busy}
                      style={btn('#D61F31')}
                    >
                      {busy ? 'Uploading…' : row.signedFileUrl ? 'Replace upload' : 'Upload signed copy'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
