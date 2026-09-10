import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { downloadUrl } from '@/lib/uploadFile'
import { PdfScrollViewer } from '@/components/pdf/PdfViewer'
import { StudentCombobox } from '@/components/shared/StudentCombobox'
import { CollapsibleSection } from '@/components/shared/CollapsibleSection'
import { CourseConfirmationDocument } from '@/components/records/CourseConfirmationDocument'
import { CourseConfirmationForm } from '@/components/records/CourseConfirmationForm'
import { WeeklyScheduleDocument } from '@/components/records/WeeklyScheduleDocument'
import { WeeklyScheduleForm } from '@/components/records/WeeklyScheduleForm'
import { EdmentumCredentialsDocument } from '@/components/records/EdmentumCredentialsDocument'
import { EdmentumCredentialsForm } from '@/components/records/EdmentumCredentialsForm'
import { AssessmentInstructionsDocument } from '@/components/records/AssessmentInstructionsDocument'
import { AssessmentInstructionsForm } from '@/components/records/AssessmentInstructionsForm'
import { printDocument } from '@/lib/records/printDocument'
import {
  buildDefaultCourseConfirmationData,
  isCourseConfirmationData,
  type CourseConfirmationData,
} from '@/types/courseConfirmation'
import {
  buildDefaultWeeklyScheduleData,
  isWeeklyScheduleData,
  type WeeklyScheduleData,
} from '@/types/weeklySchedule'
import {
  buildDefaultEdmentumCredentialsData,
  isEdmentumCredentialsData,
  type EdmentumCredentialsData,
} from '@/types/edmentumCredentials'
import {
  buildDefaultAssessmentInstructionsData,
  isAssessmentInstructionsData,
  type AssessmentInstructionsData,
} from '@/types/assessmentInstructions'
import {
  STUDENT_RECORD_DEFS,
  RECORD_CATEGORIES,
  recordDefsForCategory,
  diagnosticDefsBySemester,
  MAX_RECORD_FILE_BYTES,
  SIGNED_STATUS_META,
  sanitizeRecordFileName,
  rowToStudentRecord,
  recordSupportsSignedReturn,
  formatFileSize,
  type StudentRecord,
  type StudentRecordDef,
  type StudentRecordType,
} from '@/types/studentRecord'

const RECORD_BUCKET = 'student-records'

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
  cohort: string | null
  status: string
}

function toStorageErrorMessage(error: unknown) {
  const msg = (error as { message?: string } | null)?.message ?? 'Unknown storage error'
  const lower = msg.toLowerCase()
  if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return `Storage bucket "${RECORD_BUCKET}" not found. Run the student-records migrations first.`
  }
  if (lower.includes('relation') && lower.includes('student_records')) {
    return 'Table "student_records" not found. Run the student-records migration first.'
  }
  return msg
}

// ─── PDF modal ────────────────────────────────────────────────────────────────
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
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#9EB3C8', fontWeight: 600, textDecoration: 'none' }}>Open in new tab</a>
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

// ─── Upload-type section ──────────────────────────────────────────────────────
function UploadRecordCard({
  def, record, busy, onUpload, onView, onDelete,
}: {
  def: StudentRecordDef
  record: StudentRecord | undefined
  busy: boolean
  onUpload: (file: File) => void
  onView: () => void
  onDelete: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasFile = Boolean(record?.storagePath)

  function pick(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf') { toast('Only PDF files are supported.', 'err'); return }
    if (file.size > MAX_RECORD_FILE_BYTES) { toast('File too large. Maximum size is 10MB.', 'err'); return }
    onUpload(file)
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{def.label}</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{def.description}</div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: hasFile ? '#E8FBF0' : '#FFF4E5', color: hasFile ? '#0E6B3B' : '#9A5B00',
        }}>
          {hasFile ? 'Uploaded' : 'Not uploaded'}
        </span>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
        onChange={e => { pick(e.target.files?.[0] ?? undefined); e.target.value = '' }} />

      {hasFile ? (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📄 {record?.fileName || 'document.pdf'}
            </div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
              {formatFileSize(record?.fileSize)}
              {record?.uploadedAt ? ` · Uploaded ${new Date(record.uploadedAt).toLocaleDateString()}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onView} disabled={busy} style={btn('#1A365E')}>View</button>
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn('#fff', '#1A365E')}>{busy ? 'Working…' : 'Replace'}</button>
            <button onClick={onDelete} disabled={busy} style={btn('#FFF0F1', '#D61F31')}>Delete</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] ?? undefined) }}
          style={{
            marginTop: 14, border: `2px dashed ${dragOver ? '#1A365E' : '#C4D4E8'}`, borderRadius: 10,
            padding: '22px 16px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? '#EFF6FF' : '#F9FBFF', color: '#1A365E', fontSize: 13,
          }}
        >
          {busy ? '⏳ Uploading…' : '📁 Drop a PDF here or click to browse'}
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 4 }}>PDF only · max 10MB</div>
        </div>
      )}
    </div>
  )
}

// ─── Generic generated-document preview modal ─────────────────────────────────
function DocPreviewModal({
  title, printTitle, onClose, renderDoc,
}: {
  title: string
  printTitle: string
  onClose: () => void
  renderDoc: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode
}) {
  const docRef = useRef<HTMLDivElement>(null)
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.6)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: 24 }}
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => printDocument(docRef.current, printTitle)} style={btn('#D61F31')}>Print / Save as PDF</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#EEF1F5', padding: '20px 0' }}>
          {renderDoc(docRef)}
        </div>
      </div>
    </div>
  )
}

// ─── Signed-return review strip (admin) ──────────────────────────────────────
function SignedReturnStrip({
  record, busy, onApprove, onReject, onClear,
}: {
  record: StudentRecord | undefined
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onClear: () => void
}) {
  const status = record?.signedStatus ?? null
  const meta = status ? SIGNED_STATUS_META[status] : null

  return (
    <div style={{ marginTop: 10, background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>Signed copy</div>
        {meta && (
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.fg }}>{meta.label}</span>
        )}
      </div>

      {!status ? (
        <div style={{ fontSize: 12, color: '#7A92B0' }}>Awaiting signed copy from the student.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: '#7A92B0', minWidth: 0 }}>
              📄 {record?.signedFileName || 'signed-document.pdf'}
              {record?.signedSubmittedAt ? ` · ${new Date(record.signedSubmittedAt).toLocaleDateString()}` : ''}
            </div>
            {record?.signedFileUrl && (
              <button onClick={() => void downloadUrl(record.signedFileUrl!, record.signedFileName || 'signed-document.pdf')} style={btn('#1A365E')}>
                View signed file
              </button>
            )}
          </div>
          {status === 'rejected' && record?.signedReviewNote && (
            <div style={{ fontSize: 12, color: '#991B1B' }}>Rejected: {record.signedReviewNote}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status === 'submitted' && (
              <>
                <button onClick={onApprove} disabled={busy} style={btn('#0E6B3B')}>Approve</button>
                <button onClick={onReject} disabled={busy} style={btn('#FFF0F1', '#D61F31')}>Reject</button>
              </>
            )}
            {(status === 'approved' || status === 'rejected') && (
              <button onClick={onClear} disabled={busy} style={btn('#fff', '#1A365E')}>Clear</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Generated-document card (admin) ──────────────────────────────────────────
function GeneratedDocCard({
  def, record, has, busy, onCreate, onEdit, onPreview, onDelete,
  onApproveSigned, onRejectSigned, onClearSigned,
}: {
  def: StudentRecordDef
  record: StudentRecord | undefined
  has: boolean
  busy: boolean
  onCreate: () => void
  onEdit: () => void
  onPreview: () => void
  onDelete: () => void
  onApproveSigned?: () => void
  onRejectSigned?: () => void
  onClearSigned?: () => void
}) {
  const showSigned = has && recordSupportsSignedReturn(def.type)
  return (
    <div style={{ ...card, background: has ? '#fff' : '#F7F9FC' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{def.label}</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{def.description}</div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: has ? '#E8FBF0' : '#EEF3FF', color: has ? '#0E6B3B' : '#3557A6',
        }}>
          {has ? 'Generated' : 'Not generated'}
        </span>
      </div>

      {has ? (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#7A92B0' }}>
            {record?.generatedAt ? `Generated ${new Date(record.generatedAt).toLocaleDateString()}` : 'Saved'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onPreview} disabled={busy} style={btn('#1A365E')}>Preview / Print</button>
            <button onClick={onEdit} disabled={busy} style={btn('#fff', '#1A365E')}>Edit</button>
            <button onClick={onDelete} disabled={busy} style={btn('#FFF0F1', '#D61F31')}>Delete</button>
          </div>
        </div>
      ) : (
        <button onClick={onCreate} disabled={busy} style={{ marginTop: 12, ...btn('#1A365E') }}>
          {busy ? 'Working…' : `Create ${def.label}`}
        </button>
      )}

      {showSigned && (
        <SignedReturnStrip
          record={record}
          busy={busy}
          onApprove={() => onApproveSigned?.()}
          onReject={() => onRejectSigned?.()}
          onClear={() => onClearSigned?.()}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StudentRecordsPage() {
  const cf = useCampusFilter()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState<RecordStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState<Record<string, StudentRecord>>({})
  const [loading, setLoading] = useState(true)
  const [busyType, setBusyType] = useState<StudentRecordType | null>(null)
  const [viewer, setViewer] = useState<{ url: string; title: string; fileName: string } | null>(null)
  const [academicYear, setAcademicYear] = useState('')
  const [studentCourses, setStudentCourses] = useState<{ title: string; area: string | null; credits: number | null; term: string | null }[]>([])
  const [scheduleBlocks, setScheduleBlocks] = useState<{ day: string; time: string; subject: string; teacher: string }[]>([])
  const [ccForm, setCcForm] = useState<CourseConfirmationData | null>(null)
  const [ccPreview, setCcPreview] = useState<CourseConfirmationData | null>(null)
  const [wsForm, setWsForm] = useState<WeeklyScheduleData | null>(null)
  const [wsPreview, setWsPreview] = useState<WeeklyScheduleData | null>(null)
  const [edForm, setEdForm] = useState<EdmentumCredentialsData | null>(null)
  const [edPreview, setEdPreview] = useState<EdmentumCredentialsData | null>(null)
  const [aiForm, setAiForm] = useState<AssessmentInstructionsData | null>(null)
  const [aiPreview, setAiPreview] = useState<AssessmentInstructionsData | null>(null)

  // Load students
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('students').select('id,student_id,first_name,last_name,grade,cohort,status,campus')
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
        cohort: (r.cohort as string | null) ?? null,
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

  // Academic year (single-row settings table) — for Course Confirmation prefill
  useEffect(() => {
    supabase.from('settings').select('academic_year').single().then(({ data }) => {
      setAcademicYear((data?.academic_year as string) ?? '')
    })
  }, [])

  // Load records + courses for the selected student
  useEffect(() => {
    if (!selectedId) { setRecords({}); setStudentCourses([]); return }
    supabase.from('student_records').select('*').eq('student_id', selectedId).then(({ data, error }) => {
      if (error) { toast(toStorageErrorMessage(error), 'err'); setRecords({}); return }
      const map: Record<string, StudentRecord> = {}
      for (const r of data ?? []) {
        const rec = rowToStudentRecord(r as Record<string, unknown>)
        map[rec.recordType] = rec
      }
      setRecords(map)
    })
    supabase.from('courses').select('title,area,credits,term').eq('student_id', selectedId).then(({ data }) => {
      setStudentCourses((data ?? []).map(c => ({
        title: (c.title as string) ?? '',
        area: (c.area as string | null) ?? null,
        credits: c.credits == null ? null : Number(c.credits),
        term: (c.term as string | null) ?? null,
      })))
    })
  }, [selectedId])

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedId) ?? null, [students, selectedId])

  // Timetable blocks for the selected student's cohort — for Weekly Schedule prefill
  useEffect(() => {
    const cohort = selectedStudent?.cohort
    if (!cohort) { setScheduleBlocks([]); return }
    let cancelled = false
    ;(async () => {
      const { data: blocks } = await supabase
        .from('timetable_blocks')
        .select('day,time,subject,coach_id')
        .eq('cohort', cohort)
      const coachIds = Array.from(new Set((blocks ?? []).map(b => b.coach_id).filter(Boolean))) as string[]
      const { data: profiles } = coachIds.length
        ? await supabase.from('profiles').select('id,full_name').in('id', coachIds)
        : { data: [] as { id: string; full_name: string }[] }
      const nameById = new Map((profiles ?? []).map(p => [p.id as string, (p.full_name as string) ?? '']))
      if (cancelled) return
      setScheduleBlocks((blocks ?? []).map(b => ({
        day: (b.day as string) ?? '',
        time: (b.time as string) ?? '',
        subject: (b.subject as string) ?? '',
        teacher: b.coach_id ? (nameById.get(b.coach_id as string) ?? '') : '',
      })))
    })()
    return () => { cancelled = true }
  }, [selectedStudent?.cohort])

  const headerPortal = useHeaderActions(
    <StudentCombobox
      students={students}
      value={selectedId}
      onChange={setSelectedId}
      getLabel={s => `${s.firstName} ${s.lastName}`}
      getMeta={s => [s.grade && `Grade ${s.grade}`, s.cohort].filter(Boolean).join(' · ') || undefined}
      getStatus={s => s.status || undefined}
      placeholder={students.length === 0 ? 'No students' : 'Search students…'}
      style={{ width: 260, maxWidth: 260 }}
    />,
  )

  async function handleUpload(def: StudentRecordDef, file: File) {
    if (!selectedId) return
    setBusyType(def.type)
    try {
      const path = `students/${selectedId}/${def.type}/${Date.now()}-${sanitizeRecordFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from(RECORD_BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: 'application/pdf',
      })
      if (uploadError) { toast(toStorageErrorMessage(uploadError), 'err'); return }

      const oldPath = records[def.type]?.storagePath ?? null
      const { data: user } = await supabase.auth.getUser()
      const { error: dbError } = await supabase.from('student_records').upsert({
        student_id: selectedId,
        record_type: def.type,
        source: 'upload',
        status: 'available',
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: 'application/pdf',
        uploaded_by: user.user?.id ?? null,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,record_type' }).select('*').single()

      if (dbError) {
        // roll back the just-uploaded object so we don't orphan it
        await supabase.storage.from(RECORD_BUCKET).remove([path])
        toast(toStorageErrorMessage(dbError), 'err')
        return
      }

      if (oldPath && oldPath !== path) {
        await supabase.storage.from(RECORD_BUCKET).remove([oldPath])
      }

      const { data: fresh } = await supabase.from('student_records').select('*').eq('student_id', selectedId).eq('record_type', def.type).single()
      if (fresh) setRecords(prev => ({ ...prev, [def.type]: rowToStudentRecord(fresh as Record<string, unknown>) }))
      toast(`${def.label} uploaded`, 'ok')
    } finally {
      setBusyType(null)
    }
  }

  async function handleDelete(def: StudentRecordDef) {
    const rec = records[def.type]
    if (!rec) return
    const verb = def.source === 'generated' ? 'the generated' : 'the uploaded file for'
    if (!confirm(`Delete ${verb} "${def.label}"?`)) return
    setBusyType(def.type)
    try {
      if (rec.storagePath) {
        const { error } = await supabase.storage.from(RECORD_BUCKET).remove([rec.storagePath])
        if (error && !(error.message ?? '').toLowerCase().includes('not found')) {
          toast(toStorageErrorMessage(error), 'err'); return
        }
      }
      const { error: dbError } = await supabase.from('student_records').delete().eq('id', rec.id)
      if (dbError) { toast(toStorageErrorMessage(dbError), 'err'); return }
      setRecords(prev => {
        const next = { ...prev }
        delete next[def.type]
        return next
      })
      toast(`${def.label} deleted`, 'ok')
    } finally {
      setBusyType(null)
    }
  }

  async function handleView(def: StudentRecordDef) {
    const rec = records[def.type]
    if (!rec?.storagePath) return
    setBusyType(def.type)
    try {
      const { data, error } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(rec.storagePath, 3600)
      if (error || !data?.signedUrl) { toast(toStorageErrorMessage(error), 'err'); return }
      setViewer({ url: data.signedUrl, title: def.label, fileName: rec.fileName || `${def.type}.pdf` })
    } finally {
      setBusyType(null)
    }
  }

  function openCourseConfirmationForm() {
    if (!selectedStudent) return
    const existing = records.course_confirmation?.data
    if (isCourseConfirmationData(existing)) { setCcForm(existing); return }
    setCcForm(buildDefaultCourseConfirmationData({
      firstName: selectedStudent.firstName,
      lastName: selectedStudent.lastName,
      studentIdCode: selectedStudent.studentId,
      grade: selectedStudent.grade,
      academicYear,
      courses: studentCourses,
    }))
  }

  function openWeeklyScheduleForm() {
    if (!selectedStudent) return
    const existing = records.weekly_schedule?.data
    if (isWeeklyScheduleData(existing)) { setWsForm(existing); return }
    setWsForm(buildDefaultWeeklyScheduleData({
      firstName: selectedStudent.firstName,
      lastName: selectedStudent.lastName,
      studentIdCode: selectedStudent.studentId,
      grade: selectedStudent.grade,
      academicYear,
      blocks: scheduleBlocks,
    }))
  }

  function openEdmentumForm() {
    if (!selectedStudent) return
    const existing = records.edmentum_credentials?.data
    if (isEdmentumCredentialsData(existing)) { setEdForm(existing); return }
    setEdForm(buildDefaultEdmentumCredentialsData({
      firstName: selectedStudent.firstName,
      lastName: selectedStudent.lastName,
      studentIdCode: selectedStudent.studentId,
      grade: selectedStudent.grade,
    }))
  }

  function openAssessmentForm() {
    if (!selectedStudent) return
    const existing = records.assessment_instructions?.data
    if (isAssessmentInstructionsData(existing)) { setAiForm(existing); return }
    setAiForm(buildDefaultAssessmentInstructionsData({
      firstName: selectedStudent.firstName,
      lastName: selectedStudent.lastName,
      studentIdCode: selectedStudent.studentId,
    }))
  }

  async function saveGeneratedDoc(
    recordType: 'course_confirmation' | 'weekly_schedule' | 'edmentum_credentials' | 'assessment_instructions',
    data: Record<string, unknown>,
    onDone: () => void,
  ) {
    if (!selectedId) return
    setBusyType(recordType)
    try {
      const now = new Date().toISOString()
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('student_records').upsert({
        student_id: selectedId,
        record_type: recordType,
        source: 'generated',
        status: 'available',
        data: { ...data, generatedAt: now },
        uploaded_by: user.user?.id ?? null,
        generated_at: now,
        updated_at: now,
      }, { onConflict: 'student_id,record_type' })
      if (error) { toast(toStorageErrorMessage(error), 'err'); return }
      const { data: fresh } = await supabase.from('student_records').select('*').eq('student_id', selectedId).eq('record_type', recordType).single()
      if (fresh) setRecords(prev => ({ ...prev, [recordType]: rowToStudentRecord(fresh as Record<string, unknown>) }))
      onDone()
      toast('Document saved', 'ok')
    } finally {
      setBusyType(null)
    }
  }

  async function refreshRecord(recordType: StudentRecordType) {
    if (!selectedId) return
    const { data: fresh } = await supabase.from('student_records').select('*').eq('student_id', selectedId).eq('record_type', recordType).single()
    if (fresh) setRecords(prev => ({ ...prev, [recordType]: rowToStudentRecord(fresh as Record<string, unknown>) }))
  }

  async function reviewSigned(recordType: StudentRecordType, decision: 'approved' | 'rejected') {
    if (!selectedId) return
    let note: string | null = null
    if (decision === 'rejected') {
      const reason = window.prompt('Reason for rejecting this signed copy:')
      if (reason == null) return
      note = reason.trim() || null
    }
    setBusyType(recordType)
    try {
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase.from('student_records').update({
        signed_status: decision,
        signed_reviewed_by: user.user?.id ?? null,
        signed_reviewed_at: new Date().toISOString(),
        signed_review_note: note,
        updated_at: new Date().toISOString(),
      }).eq('student_id', selectedId).eq('record_type', recordType)
      if (error) { toast(toStorageErrorMessage(error), 'err'); return }
      await refreshRecord(recordType)
      toast(decision === 'approved' ? 'Signed copy approved' : 'Signed copy rejected', 'ok')
    } finally {
      setBusyType(null)
    }
  }

  async function clearSigned(recordType: StudentRecordType) {
    if (!selectedId) return
    if (!confirm('Clear the submitted signed copy? The student will be able to upload a new one.')) return
    setBusyType(recordType)
    try {
      const { error } = await supabase.from('student_records').update({
        signed_file_url: null,
        signed_file_name: null,
        signed_submitted_at: null,
        signed_status: null,
        signed_review_note: null,
        signed_reviewed_by: null,
        signed_reviewed_at: null,
        updated_at: new Date().toISOString(),
      }).eq('student_id', selectedId).eq('record_type', recordType)
      if (error) { toast(toStorageErrorMessage(error), 'err'); return }
      await refreshRecord(recordType)
    } finally {
      setBusyType(null)
    }
  }

  const uploadedCount = STUDENT_RECORD_DEFS.filter(d => d.source === 'upload' && records[d.type]?.storagePath).length
  const uploadTotal = STUDENT_RECORD_DEFS.filter(d => d.source === 'upload').length

  function renderRecordCard(def: StudentRecordDef) {
    if (def.source === 'upload') {
      return (
        <UploadRecordCard
          key={def.type}
          def={def}
          record={records[def.type]}
          busy={busyType === def.type}
          onUpload={file => void handleUpload(def, file)}
          onView={() => void handleView(def)}
          onDelete={() => void handleDelete(def)}
        />
      )
    }

    const signedHandlers = recordSupportsSignedReturn(def.type)
      ? {
          onApproveSigned: () => void reviewSigned(def.type, 'approved'),
          onRejectSigned: () => void reviewSigned(def.type, 'rejected'),
          onClearSigned: () => void clearSigned(def.type),
        }
      : {}

    switch (def.type) {
      case 'course_confirmation':
        return (
          <GeneratedDocCard
            key={def.type}
            def={def}
            record={records[def.type]}
            has={isCourseConfirmationData(records.course_confirmation?.data)}
            busy={busyType === 'course_confirmation'}
            onCreate={openCourseConfirmationForm}
            onEdit={openCourseConfirmationForm}
            onPreview={() => {
              const data = records.course_confirmation?.data
              if (isCourseConfirmationData(data)) setCcPreview(data)
            }}
            onDelete={() => void handleDelete(def)}
            {...signedHandlers}
          />
        )
      case 'weekly_schedule':
        return (
          <GeneratedDocCard
            key={def.type}
            def={def}
            record={records[def.type]}
            has={isWeeklyScheduleData(records.weekly_schedule?.data)}
            busy={busyType === 'weekly_schedule'}
            onCreate={openWeeklyScheduleForm}
            onEdit={openWeeklyScheduleForm}
            onPreview={() => {
              const data = records.weekly_schedule?.data
              if (isWeeklyScheduleData(data)) setWsPreview(data)
            }}
            onDelete={() => void handleDelete(def)}
            {...signedHandlers}
          />
        )
      case 'edmentum_credentials':
        return (
          <GeneratedDocCard
            key={def.type}
            def={def}
            record={records[def.type]}
            has={isEdmentumCredentialsData(records.edmentum_credentials?.data)}
            busy={busyType === 'edmentum_credentials'}
            onCreate={openEdmentumForm}
            onEdit={openEdmentumForm}
            onPreview={() => {
              const data = records.edmentum_credentials?.data
              if (isEdmentumCredentialsData(data)) setEdPreview(data)
            }}
            onDelete={() => void handleDelete(def)}
          />
        )
      case 'assessment_instructions':
        return (
          <GeneratedDocCard
            key={def.type}
            def={def}
            record={records[def.type]}
            has={isAssessmentInstructionsData(records.assessment_instructions?.data)}
            busy={busyType === 'assessment_instructions'}
            onCreate={openAssessmentForm}
            onEdit={openAssessmentForm}
            onPreview={() => {
              const data = records.assessment_instructions?.data
              if (isAssessmentInstructionsData(data)) setAiPreview(data)
            }}
            onDelete={() => void handleDelete(def)}
          />
        )
      default:
        return null
    }
  }

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>
              {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Student Records'}
            </div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>
              {selectedStudent
                ? `${selectedStudent.studentId}${selectedStudent.grade ? ` · Grade ${selectedStudent.grade}` : ''} · ${selectedStudent.status}`
                : 'Select a student from the header to manage their documents.'}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: uploadedCount === uploadTotal ? '#0E6B3B' : '#9A5B00' }}>
            {uploadedCount}/{uploadTotal} reports uploaded
          </div>
        </div>

        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
        ) : !selectedStudent ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>No students found.</div>
        ) : (
          RECORD_CATEGORIES.map(cat => (
            <CollapsibleSection key={cat.key} level="category" title={cat.label} subtitle={cat.note} defaultOpen>
              {cat.key === 'diagnostics'
                ? ([1, 2, 3] as const).map(sem => (
                    <CollapsibleSection key={sem} level="sub" title={`Semester ${sem}`} defaultOpen>
                      {diagnosticDefsBySemester()[sem].map(renderRecordCard)}
                    </CollapsibleSection>
                  ))
                : recordDefsForCategory(cat.key).map(renderRecordCard)}
            </CollapsibleSection>
          ))
        )}
      </div>

      {viewer && (
        <PdfModal url={viewer.url} title={viewer.title} fileName={viewer.fileName} onClose={() => setViewer(null)} />
      )}
      {ccForm && (
        <CourseConfirmationForm
          initial={ccForm}
          saving={busyType === 'course_confirmation'}
          onClose={() => setCcForm(null)}
          onSave={data => void saveGeneratedDoc('course_confirmation', data as unknown as Record<string, unknown>, () => setCcForm(null))}
        />
      )}
      {ccPreview && (
        <DocPreviewModal
          title="Course Confirmation — Preview"
          printTitle={`Course Confirmation — ${ccPreview.studentName}`}
          onClose={() => setCcPreview(null)}
          renderDoc={ref => <CourseConfirmationDocument ref={ref} data={ccPreview} />}
        />
      )}
      {wsForm && (
        <WeeklyScheduleForm
          initial={wsForm}
          saving={busyType === 'weekly_schedule'}
          onClose={() => setWsForm(null)}
          onSave={data => void saveGeneratedDoc('weekly_schedule', data as unknown as Record<string, unknown>, () => setWsForm(null))}
        />
      )}
      {wsPreview && (
        <DocPreviewModal
          title="Weekly Course Schedule — Preview"
          printTitle={`Weekly Course Schedule — ${wsPreview.studentName}`}
          onClose={() => setWsPreview(null)}
          renderDoc={ref => <WeeklyScheduleDocument ref={ref} data={wsPreview} />}
        />
      )}
      {edForm && (
        <EdmentumCredentialsForm
          initial={edForm}
          saving={busyType === 'edmentum_credentials'}
          onClose={() => setEdForm(null)}
          onSave={data => void saveGeneratedDoc('edmentum_credentials', data as unknown as Record<string, unknown>, () => setEdForm(null))}
        />
      )}
      {edPreview && (
        <DocPreviewModal
          title="Edmentum Courseware Portal — Preview"
          printTitle={`Edmentum Login Credentials — ${edPreview.studentName}`}
          onClose={() => setEdPreview(null)}
          renderDoc={ref => <EdmentumCredentialsDocument ref={ref} data={edPreview} />}
        />
      )}
      {aiForm && (
        <AssessmentInstructionsForm
          initial={aiForm}
          saving={busyType === 'assessment_instructions'}
          onClose={() => setAiForm(null)}
          onSave={data => void saveGeneratedDoc('assessment_instructions', data as unknown as Record<string, unknown>, () => setAiForm(null))}
        />
      )}
      {aiPreview && (
        <DocPreviewModal
          title="Psychometric Assessment Login Information — Preview"
          printTitle={`Psychometric Assessment Login Information — ${aiPreview.studentName}`}
          onClose={() => setAiPreview(null)}
          renderDoc={ref => <AssessmentInstructionsDocument ref={ref} data={aiPreview} />}
        />
      )}
    </>
  )
}
