import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const REQUIRED_DOCS = ['Passport', 'Visa', 'Birth Certificate', 'Medical Records', 'Immunization Records', 'Emergency Contact Form', 'Photo ID', 'Previous School Records']

interface StudentDocument { id: string; document_name: string; status: string; uploaded_at: string; notes: string }

export function SPDocumentsPage() {
  const { session } = useStudentPortal()
  const [docs, setDocs] = useState<StudentDocument[]>([])

  useEffect(() => {
    if (!session) return
    supabase.from('student_documents').select('*').eq('student_id', session.dbId).then(({ data }) => {
      if (data) setDocs(data.map((r: Record<string, unknown>) => ({ id: r.id as string, document_name: (r.document_name as string) ?? '', status: (r.status as string) ?? 'Missing', uploaded_at: (r.uploaded_at as string) ?? '', notes: (r.notes as string) ?? '' })))
    })
  }, [session])

  const docMap = Object.fromEntries(docs.map(d => [d.document_name, d]))
  const submitted = docs.filter(d => d.status === 'Submitted' || d.status === 'Approved').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My Documents</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Required enrollment documents and submission status</p>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Documents Submitted</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: submitted === REQUIRED_DOCS.length ? '#10B981' : '#F59E0B' }}>{submitted}/{REQUIRED_DOCS.length}</span>
          </div>
          <div style={{ height: 8, background: '#E4EAF2', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${(submitted / REQUIRED_DOCS.length) * 100}%`, background: submitted === REQUIRED_DOCS.length ? '#10B981' : '#F59E0B', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {REQUIRED_DOCS.map(docName => {
          const doc = docMap[docName]
          const status = doc?.status ?? 'Missing'
          const isOk = status === 'Submitted' || status === 'Approved'
          return (
            <div key={docName} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOk ? '#F0FBF5' : '#FFF8F8', border: `1px solid ${isOk ? '#A7E3C0' : '#F5C2C7'}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{docName}</div>
                {doc?.uploaded_at && <div style={{ fontSize: 11, color: '#7A92B0' }}>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</div>}
                {doc?.notes && <div style={{ fontSize: 11, color: '#7A92B0' }}>{doc.notes}</div>}
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: isOk ? '#E8FBF0' : '#FEE2E2', color: isOk ? '#0E6B3B' : '#991B1B', flexShrink: 0 }}>
                {status}
              </span>
            </div>
          )
        })}
      </div>

      {docs.filter(d => !REQUIRED_DOCS.includes(d.document_name)).map(d => (
        <div key={d.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{d.document_name}</div>
          <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#E6F4FF', color: '#0369A1' }}>{d.status}</span>
        </div>
      ))}
    </div>
  )
}
