import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { downloadUrl } from '@/lib/uploadFile'
import { PdfScrollViewer } from '@/components/pdf/PdfViewer'
import { CourseConfirmationDocument } from '@/components/records/CourseConfirmationDocument'
import { WeeklyScheduleDocument } from '@/components/records/WeeklyScheduleDocument'
import { EdmentumCredentialsDocument } from '@/components/records/EdmentumCredentialsDocument'
import { AssessmentInstructionsDocument } from '@/components/records/AssessmentInstructionsDocument'
import { printDocument } from '@/lib/records/printDocument'
import { isCourseConfirmationData, type CourseConfirmationData } from '@/types/courseConfirmation'
import { isWeeklyScheduleData, type WeeklyScheduleData } from '@/types/weeklySchedule'
import { isEdmentumCredentialsData, type EdmentumCredentialsData } from '@/types/edmentumCredentials'
import { isAssessmentInstructionsData, type AssessmentInstructionsData } from '@/types/assessmentInstructions'
import {
  STUDENT_RECORD_DEFS,
  formatFileSize,
  type StudentRecordDef,
  type StudentRecordType,
} from '@/types/studentRecord'

const RECORD_BUCKET = 'student-records'
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

interface RecordView {
  recordType: StudentRecordType
  source: 'upload' | 'generated'
  hasFile: boolean
  fileName: string | null
  fileSize: number | null
  uploadedAt: string | null
  generatedAt: string | null
  data: Record<string, unknown> | null
}

class AuthedFetchError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function authedFetch(token: string | null, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...opts.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new AuthedFetchError(body.error || 'Request failed.', res.status)
  return body
}

function PdfModal({ url, title, fileName, onClose }: { url: string; title: string; fileName: string; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.6)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: 24 }}
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => void downloadUrl(url, fileName)} style={{ fontSize: 12, color: '#9EB3C8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PdfScrollViewer url={url} />
        </div>
      </div>
    </div>
  )
}

type GenDoc =
  | { kind: 'course_confirmation'; data: CourseConfirmationData }
  | { kind: 'weekly_schedule'; data: WeeklyScheduleData }
  | { kind: 'edmentum_credentials'; data: EdmentumCredentialsData }
  | { kind: 'assessment_instructions'; data: AssessmentInstructionsData }

const GEN_DOC_LABELS: Record<GenDoc['kind'], string> = {
  course_confirmation: 'Course Confirmation',
  weekly_schedule: 'Weekly Schedule',
  edmentum_credentials: 'Edmentum Courseware Portal',
  assessment_instructions: 'Assessment Instructions',
}

function GeneratedDocModal({ doc, onClose }: { doc: GenDoc; onClose: () => void }) {
  const docRef = useRef<HTMLDivElement>(null)
  const label = GEN_DOC_LABELS[doc.kind]
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.6)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: 24 }}
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{label}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => printDocument(docRef.current, `${label} — ${doc.data.studentName}`)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Print / Save as PDF
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#EEF1F5', padding: '20px 0' }}>
          {doc.kind === 'course_confirmation' && <CourseConfirmationDocument ref={docRef} data={doc.data} />}
          {doc.kind === 'weekly_schedule' && <WeeklyScheduleDocument ref={docRef} data={doc.data} />}
          {doc.kind === 'edmentum_credentials' && <EdmentumCredentialsDocument ref={docRef} data={doc.data} />}
          {doc.kind === 'assessment_instructions' && <AssessmentInstructionsDocument ref={docRef} data={doc.data} />}
        </div>
      </div>
    </div>
  )
}

export function SPStudentRecordsPage() {
  const { session, getToken, logout } = useStudentPortal()
  const [records, setRecords] = useState<Record<string, RecordView>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyType, setBusyType] = useState<StudentRecordType | null>(null)
  const [viewer, setViewer] = useState<{ url: string; title: string; fileName: string } | null>(null)
  const [docViewer, setDocViewer] = useState<GenDoc | null>(null)

  const studentDbId = session?.dbId ?? null

  // An expired / invalid student token → sign out so the layout bounces to login
  // for a fresh session (the sessionStorage session has no TTL of its own).
  const handleAuthError = useCallback((err: unknown): boolean => {
    if (err instanceof AuthedFetchError && err.status === 401) {
      void logout()
      return true
    }
    return false
  }, [logout])

  const load = useCallback(async () => {
    if (!studentDbId) return
    setLoading(true)
    setError('')
    try {
      const token = getToken()
      let rows: RecordView[] = []
      if (token) {
        const body = await authedFetch(token, '/api/student-portal/list-my-records')
        rows = (body.records ?? []).map((r: Record<string, unknown>) => ({
          recordType: r.recordType as StudentRecordType,
          source: (r.source as 'upload' | 'generated') ?? 'upload',
          hasFile: !!r.hasFile,
          fileName: (r.fileName as string | null) ?? null,
          fileSize: r.fileSize == null ? null : Number(r.fileSize),
          uploadedAt: (r.uploadedAt as string | null) ?? null,
          generatedAt: (r.generatedAt as string | null) ?? null,
          data: (r.data as Record<string, unknown> | null) ?? null,
        }))
      } else {
        // Parent portal: authenticated Supabase user, read directly (RLS-scoped to own children).
        const { data, error: dbError } = await supabase
          .from('student_records')
          .select('record_type,source,file_name,file_size,uploaded_at,generated_at,storage_path,data')
          .eq('student_id', studentDbId)
        if (dbError) throw new Error(dbError.message)
        rows = (data ?? []).map((r: Record<string, unknown>) => ({
          recordType: r.record_type as StudentRecordType,
          source: (r.source as 'upload' | 'generated') ?? 'upload',
          hasFile: !!r.storage_path,
          fileName: (r.file_name as string | null) ?? null,
          fileSize: r.file_size == null ? null : Number(r.file_size),
          uploadedAt: (r.uploaded_at as string | null) ?? null,
          generatedAt: (r.generated_at as string | null) ?? null,
          data: (r.data as Record<string, unknown> | null) ?? null,
        }))
      }
      const map: Record<string, RecordView> = {}
      for (const r of rows) map[r.recordType] = r
      setRecords(map)
    } catch (err) {
      if (handleAuthError(err)) return
      setError(err instanceof Error ? err.message : 'Failed to load your records.')
    } finally {
      setLoading(false)
    }
  }, [studentDbId, getToken, handleAuthError])

  useEffect(() => { void load() }, [load])

  async function handleView(def: StudentRecordDef) {
    if (!studentDbId) return
    setBusyType(def.type)
    try {
      const token = getToken()
      let url: string | null = null
      let fileName = `${def.type}.pdf`
      if (token) {
        const body = await authedFetch(token, `/api/student-portal/record-signed-url?recordType=${def.type}`)
        url = body.url
        fileName = body.fileName || fileName
      } else {
        const rec = records[def.type]
        // Parent: re-fetch the path (not held in state), then sign it directly.
        const { data: row } = await supabase
          .from('student_records')
          .select('storage_path,file_name')
          .eq('student_id', studentDbId)
          .eq('record_type', def.type)
          .maybeSingle()
        if (row?.storage_path) {
          const { data: signed } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(row.storage_path as string, 3600)
          url = signed?.signedUrl ?? null
          fileName = (row.file_name as string) || rec?.fileName || fileName
        }
      }
      if (!url) { setError('This document is not available yet.'); return }
      setViewer({ url, title: def.label, fileName })
    } catch (err) {
      if (handleAuthError(err)) return
      setError(err instanceof Error ? err.message : 'Could not open this document.')
    } finally {
      setBusyType(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My Records</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Course confirmation, weekly schedule, and diagnostic reports</p>
      </div>

      {error && (
        <div style={{ ...card, background: '#FFF8F8', border: '1px solid #F5C2C7', color: '#991B1B', fontSize: 13 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : (
        STUDENT_RECORD_DEFS.map(def => {
          const rec = records[def.type]
          const generated = def.source === 'generated'
          const hasFile = Boolean(rec?.hasFile)
          let genDoc: GenDoc | null = null
          if (def.type === 'course_confirmation' && isCourseConfirmationData(rec?.data)) {
            genDoc = { kind: 'course_confirmation', data: rec!.data as unknown as CourseConfirmationData }
          } else if (def.type === 'weekly_schedule' && isWeeklyScheduleData(rec?.data)) {
            genDoc = { kind: 'weekly_schedule', data: rec!.data as unknown as WeeklyScheduleData }
          } else if (def.type === 'edmentum_credentials' && isEdmentumCredentialsData(rec?.data)) {
            genDoc = { kind: 'edmentum_credentials', data: rec!.data as unknown as EdmentumCredentialsData }
          } else if (def.type === 'assessment_instructions' && isAssessmentInstructionsData(rec?.data)) {
            genDoc = { kind: 'assessment_instructions', data: rec!.data as unknown as AssessmentInstructionsData }
          }
          const available = generated ? Boolean(genDoc) : hasFile

          let subtitle: string
          if (generated) {
            subtitle = genDoc
              ? `Generated${rec?.generatedAt ? ` ${new Date(rec.generatedAt).toLocaleDateString()}` : ''}`
              : 'This will be generated by your school.'
          } else {
            subtitle = hasFile
              ? `Uploaded${rec?.uploadedAt ? ` ${new Date(rec.uploadedAt).toLocaleDateString()}` : ''}${rec?.fileSize ? ` · ${formatFileSize(rec.fileSize)}` : ''}`
              : 'Not available yet — your school will upload this.'
          }

          return (
            <div key={def.type} style={{ ...card, background: available ? '#fff' : '#F7F9FC' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{def.label}</div>
                  <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{subtitle}</div>
                </div>
                {available ? (
                  <button
                    onClick={() => (genDoc ? setDocViewer(genDoc) : void handleView(def))}
                    disabled={busyType === def.type}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    {busyType === def.type ? 'Opening…' : 'View'}
                  </button>
                ) : (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: generated ? '#EEF3FF' : '#FFF4E5', color: generated ? '#3557A6' : '#9A5B00', flexShrink: 0 }}>
                    {generated ? 'Coming soon' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
          )
        })
      )}

      {viewer && (
        <PdfModal url={viewer.url} title={viewer.title} fileName={viewer.fileName} onClose={() => setViewer(null)} />
      )}
      {docViewer && (
        <GeneratedDocModal doc={docViewer} onClose={() => setDocViewer(null)} />
      )}
    </div>
  )
}
