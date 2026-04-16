import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// ─── Doc keys & labels ────────────────────────────────────────────────────────
const DOC_KEYS = [
  'birthCertificate', 'passport', 'immunization', 'transcripts',
  'reportCard', 'teacherRec', 'counselorRec', 'essay',
  'photos', 'medicalForm', 'iepDoc', 'financialAid',
] as const

type DocKey = typeof DOC_KEYS[number]

const DOC_LABELS: Record<DocKey, string> = {
  birthCertificate: 'Birth Cert',
  passport: 'Passport',
  immunization: 'Immunization',
  transcripts: 'Transcripts',
  reportCard: 'Report Card',
  teacherRec: 'Teacher Rec',
  counselorRec: 'Counselor Rec',
  essay: 'Essay',
  photos: 'Photos',
  medicalForm: 'Medical Form',
  iepDoc: 'IEP Doc',
  financialAid: 'Financial Aid',
}

const DOC_BUCKET = import.meta.env.VITE_SUPABASE_DOCS_BUCKET ?? 'student-documents'
const DOCS_LS_KEY = 'aws_students_documents_v1'
const DOC_FILES_LS_KEY = 'aws_students_doc_files_v1'
const MAX_FILE_BYTES = 10 * 1024 * 1024

// ─── Local types ──────────────────────────────────────────────────────────────
interface UploadedDocMeta {
  path: string
  url: string
  fileName: string
  size: number
  uploadedAt: string
}

interface DocStudent {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  docs: Record<DocKey, boolean>
  docFiles: Partial<Record<DocKey, UploadedDocMeta>>
}

// ─── Local storage helpers (schema-safe fallback) ─────────────────────────────
function isDocKey(key: string): key is DocKey {
  return (DOC_KEYS as readonly string[]).includes(key)
}

function parseDocs(raw: unknown): Record<DocKey, boolean> {
  const arr: string[] = Array.isArray(raw) ? raw.filter(x => typeof x === 'string') as string[] : []
  return Object.fromEntries(DOC_KEYS.map(k => [k, arr.includes(k)])) as Record<DocKey, boolean>
}

function docsToArray(docs: Record<DocKey, boolean>): string[] {
  return DOC_KEYS.filter(k => docs[k])
}

function loadDocsMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(DOCS_LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, string[]> = {}
    for (const [studentId, value] of Object.entries(parsed)) {
      result[studentId] = Array.isArray(value) ? value.filter(v => typeof v === 'string') as string[] : []
    }
    return result
  } catch {
    return {}
  }
}

function saveDocsMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(DOCS_LS_KEY, JSON.stringify(map))
  } catch {
    // ignore local storage failures silently
  }
}

function loadDocFilesMap(): Record<string, Partial<Record<DocKey, UploadedDocMeta>>> {
  try {
    const raw = localStorage.getItem(DOC_FILES_LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, Partial<Record<DocKey, UploadedDocMeta>>> = {}

    for (const [studentId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const fileObj = value as Record<string, unknown>
      const next: Partial<Record<DocKey, UploadedDocMeta>> = {}

      for (const [docKey, metaValue] of Object.entries(fileObj)) {
        if (!isDocKey(docKey)) continue
        if (!metaValue || typeof metaValue !== 'object' || Array.isArray(metaValue)) continue
        const meta = metaValue as Record<string, unknown>
        const path = typeof meta.path === 'string' ? meta.path : ''
        const url = typeof meta.url === 'string' ? meta.url : ''
        const fileName = typeof meta.fileName === 'string' ? meta.fileName : ''
        const size = typeof meta.size === 'number' ? meta.size : 0
        const uploadedAt = typeof meta.uploadedAt === 'string' ? meta.uploadedAt : ''
        if (!path || !url) continue
        next[docKey] = { path, url, fileName, size, uploadedAt }
      }

      result[studentId] = next
    }

    return result
  } catch {
    return {}
  }
}

function saveDocFilesMap(map: Record<string, Partial<Record<DocKey, UploadedDocMeta>>>) {
  try {
    localStorage.setItem(DOC_FILES_LS_KEY, JSON.stringify(map))
  } catch {
    // ignore local storage failures silently
  }
}

function fromRow(
  row: Record<string, unknown>,
  docsMap: Record<string, string[]>,
  filesMap: Record<string, Partial<Record<DocKey, UploadedDocMeta>>>,
): DocStudent {
  const id = row.id as string
  const docs = parseDocs(docsMap[id])
  const docFiles = filesMap[id] ?? {}
  DOC_KEYS.forEach(k => {
    if (docFiles[k]) docs[k] = true
  })

  const gradeVal = row.grade
  return {
    id,
    firstName: (row.first_name as string) ?? '',
    lastName: (row.last_name as string) ?? '',
    grade: gradeVal == null ? null : String(gradeVal),
    status: (row.status as string) ?? '',
    docs,
    docFiles,
  }
}

function docCount(docs: Record<DocKey, boolean>) {
  return DOC_KEYS.filter(k => docs[k]).length
}

function sanitizeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
}

function toStorageErrorMessage(error: unknown) {
  const msg = (error as { message?: string } | null)?.message ?? 'Unknown storage error'
  const lower = msg.toLowerCase()
  if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return `Storage bucket "${DOC_BUCKET}" not found. Create it in Supabase Storage first.`
  }
  return msg
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

const th: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8',
  verticalAlign: 'middle',
}

// ─── EditDocsModal (bulk checkbox editor) ────────────────────────────────────
function EditDocsModal({
  student, onClose, onSave,
}: {
  student: DocStudent
  onClose: () => void
  onSave: (id: string, docs: Record<DocKey, boolean>) => Promise<boolean>
}) {
  const [docs, setDocs] = useState<Record<DocKey, boolean>>({ ...student.docs })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(student.id, docs)
    setSaving(false)
    if (ok) onClose()
  }

  const count = docCount(docs)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#0F2240,#1A365E)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              Edit Documents — {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 2 }}>
              {count} / {DOC_KEYS.length} submitted
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ height: 4, background: '#E4EAF2' }}>
          <div style={{ height: '100%', width: `${(count / DOC_KEYS.length) * 100}%`, background: '#D61F31', transition: 'width 0.2s' }} />
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {DOC_KEYS.map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1A365E' }}>
              <input
                type="checkbox"
                checked={docs[k]}
                onChange={e => setDocs(prev => ({ ...prev, [k]: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: '#D61F31' }}
              />
              {DOC_LABELS[k]}
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2',
            background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload cell modal ────────────────────────────────────────────────────────
function DocCellModal({
  student,
  docKey,
  checked,
  fileMeta,
  onClose,
  onSave,
  onDelete,
}: {
  student: DocStudent
  docKey: DocKey
  checked: boolean
  fileMeta: UploadedDocMeta | undefined
  onClose: () => void
  onSave: (markSubmitted: boolean, file: File | null) => Promise<boolean>
  onDelete: () => Promise<boolean>
}) {
  const [markSubmitted, setMarkSubmitted] = useState(checked)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const hasFile = Boolean(fileMeta)

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(markSubmitted, selectedFile)
    setSaving(false)
    if (ok) onClose()
  }

  async function handleDelete() {
    if (!fileMeta) return
    if (!confirm(`Delete the uploaded file for "${DOC_LABELS[docKey]}"?`)) return
    setSaving(true)
    const ok = await onDelete()
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1001, padding: 20,
    }} onClick={e => { if (e.currentTarget === e.target) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#0F2240,#1A365E)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>📄 {DOC_LABELS[docKey]}</div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 2 }}>{student.firstName} {student.lastName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{hasFile ? 'File uploaded' : (checked ? 'Submitted (without file)' : 'Not submitted')}</div>
            {fileMeta && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <a href={fileMeta.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0369A1', fontWeight: 600 }}>🔗 View uploaded file</a>
                <span style={{ fontSize: 11, color: '#7A92B0' }}>{fileMeta.fileName || 'File'} · {Math.max(1, Math.round(fileMeta.size / 1024))} KB</span>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7A92B0', marginBottom: 6 }}>{hasFile ? 'Replace File' : 'Upload File'}</div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '14px 12px', border: '2px dashed #C4D4E8', borderRadius: 10,
                background: '#F9FBFF', color: '#1A365E', fontSize: 13, cursor: 'pointer',
              }}
            >
              {selectedFile
                ? `Selected: ${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
                : 'Click to choose file (max 10MB)'}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A365E', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={markSubmitted}
              onChange={e => setMarkSubmitted(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#1A365E' }}
            />
            Mark as submitted (checkbox)
          </label>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', gap: 10 }}>
          {hasFile && (
            <button onClick={handleDelete} disabled={saving} style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #F5C2C7',
              background: '#FFF0F1', color: '#D61F31', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>🗑 Delete File</button>
          )}
          <button onClick={onClose} style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: '1px solid #E4EAF2',
            background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none',
            background: '#1A365E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function DocumentsPage() {
  const [students, setStudents] = useState<DocStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'All' | 'Complete' | 'Partial' | 'None' | 'Uploaded'>('All')
  const [filterGrade, setFilterGrade] = useState('All')
  const [editing, setEditing] = useState<DocStudent | null>(null)
  const [uploadTarget, setUploadTarget] = useState<{ studentId: string; doc: DocKey } | null>(null)

  useEffect(() => {
    setLoading(true)
    const docsMap = loadDocsMap()
    const filesMap = loadDocFilesMap()

    supabase.from('students').select('id,first_name,last_name,grade,status')
      .then(({ data, error }) => {
        if (error) {
          console.error('DocumentsPage fetch error:', error)
          toast(error.message || 'Failed to load documents', 'err')
          setStudents([])
          setLoading(false)
          return
        }
        if (data) setStudents(data.map(r => fromRow(r as Record<string, unknown>, docsMap, filesMap)))
        setLoading(false)
      })
  }, [])

  const grades = useMemo(() => {
    const set = new Set<string>()
    students.forEach(s => { if (s.grade) set.add(s.grade) })
    return Array.from(set).sort()
  }, [students])

  const filtered = useMemo(() => {
    return students.filter(s => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase()
      if (search && !name.includes(search.toLowerCase())) return false
      if (filterGrade !== 'All' && s.grade !== filterGrade) return false

      const cnt = docCount(s.docs)
      const hasFiles = Object.keys(s.docFiles).length > 0
      const complete = cnt === DOC_KEYS.length
      const none = cnt === 0
      const partial = !complete && !none

      if (filterStatus === 'Complete' && !complete) return false
      if (filterStatus === 'Partial' && !partial) return false
      if (filterStatus === 'None' && !none) return false
      if (filterStatus === 'Uploaded' && !hasFiles) return false

      return true
    })
  }, [students, search, filterGrade, filterStatus])

  const totalComplete = useMemo(() => students.filter(s => docCount(s.docs) === DOC_KEYS.length).length, [students])
  const totalFilesUploaded = useMemo(() => students.reduce((sum, s) => sum + Object.keys(s.docFiles).length, 0), [students])
  const avgCompletion = useMemo(() => {
    if (students.length === 0) return 0
    return Math.round(students.reduce((sum, s) => sum + docCount(s.docs), 0) / students.length / DOC_KEYS.length * 100)
  }, [students])

  async function saveDocs(id: string, docs: Record<DocKey, boolean>): Promise<boolean> {
    const docsMap = loadDocsMap()
    docsMap[id] = docsToArray(docs)
    saveDocsMap(docsMap)

    setStudents(prev => prev.map(s => s.id === id ? { ...s, docs } : s))
    toast('Documents updated', 'ok')
    return true
  }

  async function saveCellDoc(studentId: string, docKey: DocKey, markSubmitted: boolean, file: File | null): Promise<boolean> {
    const target = students.find(s => s.id === studentId)
    if (!target) return false

    if (file && file.size > MAX_FILE_BYTES) {
      toast('File too large. Maximum size is 10MB.', 'err')
      return false
    }

    const nextDocs = { ...target.docs, [docKey]: markSubmitted }
    const nextDocFiles = { ...target.docFiles }

    if (file) {
      const safe = sanitizeFileName(file.name)
      const path = `students/${studentId}/${docKey}/${Date.now()}-${safe}`

      const { error: uploadError } = await supabase.storage.from(DOC_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

      if (uploadError) {
        toast(toStorageErrorMessage(uploadError), 'err')
        return false
      }

      const { data: publicData } = supabase.storage.from(DOC_BUCKET).getPublicUrl(path)
      const oldPath = nextDocFiles[docKey]?.path

      nextDocFiles[docKey] = {
        path,
        url: publicData.publicUrl,
        fileName: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }

      nextDocs[docKey] = true

      if (oldPath && oldPath !== path) {
        await supabase.storage.from(DOC_BUCKET).remove([oldPath])
      }
    }

    const docsMap = loadDocsMap()
    docsMap[studentId] = docsToArray(nextDocs)
    saveDocsMap(docsMap)

    const filesMap = loadDocFilesMap()
    filesMap[studentId] = nextDocFiles
    saveDocFilesMap(filesMap)

    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, docs: nextDocs, docFiles: nextDocFiles } : s))

    toast(file ? `${DOC_LABELS[docKey]} uploaded` : 'Document status updated', 'ok')
    return true
  }

  async function deleteCellDocFile(studentId: string, docKey: DocKey): Promise<boolean> {
    const target = students.find(s => s.id === studentId)
    if (!target) return false

    const existing = target.docFiles[docKey]
    if (!existing) return true

    const { error } = await supabase.storage.from(DOC_BUCKET).remove([existing.path])
    if (error) {
      const msg = (error.message ?? '').toLowerCase()
      if (!msg.includes('not found')) {
        toast(toStorageErrorMessage(error), 'err')
        return false
      }
    }

    const nextDocFiles = { ...target.docFiles }
    delete nextDocFiles[docKey]

    const filesMap = loadDocFilesMap()
    filesMap[studentId] = nextDocFiles
    saveDocFilesMap(filesMap)

    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, docFiles: nextDocFiles } : s))
    toast('Uploaded file deleted', 'ok')
    return true
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
    fontSize: 13, color: '#1A365E', background: '#fff',
  }

  const uploadStudent = uploadTarget ? students.find(s => s.id === uploadTarget.studentId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Students', value: students.length },
          { label: 'Fully Complete', value: totalComplete, color: '#1DBD6A' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, color: avgCompletion >= 80 ? '#1DBD6A' : avgCompletion >= 50 ? '#F5A623' : '#D61F31' },
          { label: 'Files Uploaded', value: totalFilesUploaded, color: '#1E40AF' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color ?? '#1A365E', marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students…"
          style={{ ...inputStyle, width: 220 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} style={inputStyle}>
          <option value="All">All Students</option>
          <option value="Complete">Complete</option>
          <option value="Partial">Partial</option>
          <option value="None">None Submitted</option>
          <option value="Uploaded">Has Uploaded Files</option>
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={inputStyle}>
          <option value="All">All Grades</option>
          {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0', marginLeft: 4 }}>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 160 }}>Student</th>
                <th style={{ ...th, minWidth: 60 }}>Grade</th>
                {DOC_KEYS.map(k => (
                  <th key={k} style={{ ...th, width: 44, padding: '8px 4px', textAlign: 'center' }} title={DOC_LABELS[k]}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700, color: '#7A92B0', letterSpacing: '0.05em', height: 70, display: 'flex', alignItems: 'center' }}>
                      {DOC_LABELS[k].split(' ')[0]}
                    </div>
                  </th>
                ))}
                <th style={{ ...th, minWidth: 70 }}>Files</th>
                <th style={{ ...th, minWidth: 110 }}>Progress</th>
                <th style={{ ...th, minWidth: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={DOC_KEYS.length + 5} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>Loading documents…</td></tr>
              )}
              {filtered.map(s => {
                const cnt = docCount(s.docs)
                const pct = Math.round((cnt / DOC_KEYS.length) * 100)
                const fileCount = Object.keys(s.docFiles).length
                const initials = `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.trim() || '??'

                return (
                  <tr key={s.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg,#1A365E,#2D5A8E)',
                          color: '#fff', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 500 }}>{s.firstName} {s.lastName}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0' }}>{s.grade ?? '—'}</td>

                    {DOC_KEYS.map(k => {
                      const hasFile = Boolean(s.docFiles[k])
                      const checked = s.docs[k]
                      const icon = hasFile ? '📄' : checked ? '✓' : '—'
                      const color = hasFile ? '#0EA5E9' : checked ? '#1DBD6A' : '#C4D4E8'
                      const bg = hasFile ? '#DBEAFE' : checked ? '#DCFCE7' : '#F9FAFB'
                      const title = hasFile ? 'File uploaded: click to manage' : checked ? 'Submitted (no file)' : 'Not submitted'

                      return (
                        <td key={k} style={{ ...td, textAlign: 'center', padding: '9px 4px' }}>
                          <button
                            title={title}
                            onClick={() => setUploadTarget({ studentId: s.id, doc: k })}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `1.5px solid ${color}66`,
                              background: bg,
                              color,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {icon}
                          </button>
                        </td>
                      )
                    })}

                    <td style={{ ...td, textAlign: 'center' }}>
                      {fileCount > 0
                        ? <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{fileCount} 📄</span>
                        : <span style={{ color: '#7A92B0', fontSize: 11 }}>—</span>}
                    </td>

                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: '#E4EAF2', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4, transition: 'width 0.2s',
                            width: `${pct}%`,
                            background: pct === 100 ? '#1DBD6A' : pct >= 60 ? '#F5A623' : '#D61F31',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#7A92B0', whiteSpace: 'nowrap' }}>{cnt}/{DOC_KEYS.length}</span>
                      </div>
                    </td>

                    <td style={td}>
                      <button
                        onClick={() => setEditing(s)}
                        style={{
                          padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2',
                          background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}

              {!loading && filtered.length === 0 && (
                <tr><td colSpan={DOC_KEYS.length + 5} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: '#EEF3FF', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#1A365E' }}>
        <b>📄 Upload workflow:</b> Click any document cell to upload, replace, view, or delete that file. Files are stored in Supabase Storage bucket <code>{DOC_BUCKET}</code>.
      </div>

      {editing && (
        <EditDocsModal
          student={editing}
          onClose={() => setEditing(null)}
          onSave={saveDocs}
        />
      )}

      {uploadTarget && uploadStudent && (
        <DocCellModal
          student={uploadStudent}
          docKey={uploadTarget.doc}
          checked={uploadStudent.docs[uploadTarget.doc]}
          fileMeta={uploadStudent.docFiles[uploadTarget.doc]}
          onClose={() => setUploadTarget(null)}
          onSave={(markSubmitted, file) => saveCellDoc(uploadStudent.id, uploadTarget.doc, markSubmitted, file)}
          onDelete={() => deleteCellDocFile(uploadStudent.id, uploadTarget.doc)}
        />
      )}
    </div>
  )
}
