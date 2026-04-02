import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Doc keys & labels ────────────────────────────────────────────────────────
const DOC_KEYS = [
  'birthCertificate', 'passport', 'immunization', 'transcripts',
  'reportCard', 'teacherRec', 'counselorRec', 'essay',
  'photos', 'medicalForm', 'iepDoc', 'financialAid',
] as const
type DocKey = typeof DOC_KEYS[number]

const DOC_LABELS: Record<DocKey, string> = {
  birthCertificate: 'Birth Cert',
  passport:         'Passport',
  immunization:     'Immunization',
  transcripts:      'Transcripts',
  reportCard:       'Report Card',
  teacherRec:       'Teacher Rec',
  counselorRec:     'Counselor Rec',
  essay:            'Essay',
  photos:           'Photos',
  medicalForm:      'Medical Form',
  iepDoc:           'IEP Doc',
  financialAid:     'Financial Aid',
}

// ─── Local types ──────────────────────────────────────────────────────────────
interface DocStudent {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  notesRaw: string
  docs: Record<DocKey, boolean>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseExt(notesRaw: string): Record<string, unknown> {
  try { return JSON.parse(notesRaw || '{}') } catch { return {} }
}

function parseDocs(ext: Record<string, unknown>): Record<DocKey, boolean> {
  // documents stored as string[] (array of keys that are checked)
  const raw = ext.documents
  const arr: string[] = Array.isArray(raw) ? raw as string[] : []
  return Object.fromEntries(DOC_KEYS.map(k => [k, arr.includes(k)])) as Record<DocKey, boolean>
}

function docsToArray(docs: Record<DocKey, boolean>): string[] {
  return DOC_KEYS.filter(k => docs[k])
}

function fromRow(row: Record<string, unknown>): DocStudent {
  const notesRaw = (row.notes as string) ?? '{}'
  const ext = parseExt(notesRaw)
  return {
    id:        row.id as string,
    firstName: (row.first_name as string) ?? '',
    lastName:  (row.last_name as string) ?? '',
    grade:     (row.grade as string) ?? null,
    status:    (row.status as string) ?? '',
    notesRaw,
    docs:      parseDocs(ext),
  }
}

function docCount(docs: Record<DocKey, boolean>) {
  return DOC_KEYS.filter(k => docs[k]).length
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

// ─── EditDocsModal ────────────────────────────────────────────────────────────
function EditDocsModal({
  student, onClose, onSave,
}: {
  student: DocStudent
  onClose: () => void
  onSave: (id: string, docs: Record<DocKey, boolean>) => Promise<void>
}) {
  const [docs, setDocs] = useState<Record<DocKey, boolean>>({ ...student.docs })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(student.id, docs)
    setSaving(false)
    onClose()
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
        {/* Header */}
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
        {/* Progress bar */}
        <div style={{ height: 4, background: '#E4EAF2' }}>
          <div style={{ height: '100%', width: `${(count / DOC_KEYS.length) * 100}%`, background: '#D61F31', transition: 'width 0.2s' }} />
        </div>
        {/* Checkboxes */}
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
        {/* Footer */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export function DocumentsPage() {
  const [students, setStudents] = useState<DocStudent[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'All' | 'Complete' | 'Incomplete'>('All')
  const [filterGrade, setFilterGrade] = useState('All')
  const [editing, setEditing] = useState<DocStudent | null>(null)

  useEffect(() => {
    supabase.from('students').select('id,first_name,last_name,grade,status,notes')
      .then(({ data }) => {
        if (data) setStudents(data.map(r => fromRow(r as Record<string, unknown>)))
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
      if (filterStatus === 'Complete' && cnt < DOC_KEYS.length) return false
      if (filterStatus === 'Incomplete' && cnt === DOC_KEYS.length) return false
      return true
    })
  }, [students, search, filterGrade, filterStatus])

  const totalComplete = useMemo(() => students.filter(s => docCount(s.docs) === DOC_KEYS.length).length, [students])
  const avgCompletion = useMemo(() => {
    if (students.length === 0) return 0
    return Math.round(students.reduce((sum, s) => sum + docCount(s.docs), 0) / students.length / DOC_KEYS.length * 100)
  }, [students])

  async function saveDocs(id: string, docs: Record<DocKey, boolean>) {
    const stu = students.find(s => s.id === id)
    if (!stu) return
    const ext = parseExt(stu.notesRaw)
    const newNotes = JSON.stringify({ ...ext, documents: docsToArray(docs) })
    await supabase.from('students').update({ notes: newNotes }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, docs, notesRaw: newNotes } : s))
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
    fontSize: 13, color: '#1A365E', background: '#fff',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Students', value: students.length },
          { label: 'Fully Complete', value: totalComplete, color: '#1DBD6A' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, color: avgCompletion >= 80 ? '#1DBD6A' : avgCompletion >= 50 ? '#F5A623' : '#D61F31' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color ?? '#1A365E', marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students…"
          style={{ ...inputStyle, width: 220 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} style={inputStyle}>
          <option value="All">All Statuses</option>
          <option value="Complete">Complete</option>
          <option value="Incomplete">Incomplete</option>
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={inputStyle}>
          <option value="All">All Grades</option>
          {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0', marginLeft: 4 }}>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 160 }}>Student</th>
                <th style={{ ...th, minWidth: 60 }}>Grade</th>
                {DOC_KEYS.map(k => (
                  <th key={k} style={{ ...th, width: 42, padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 700, color: '#7A92B0', letterSpacing: '0.05em', height: 70, display: 'flex', alignItems: 'center' }}>
                      {DOC_LABELS[k]}
                    </div>
                  </th>
                ))}
                <th style={{ ...th, minWidth: 110 }}>Progress</th>
                <th style={{ ...th, minWidth: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const cnt = docCount(s.docs)
                const pct = Math.round((cnt / DOC_KEYS.length) * 100)
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
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <span style={{ fontWeight: 500 }}>{s.firstName} {s.lastName}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0' }}>{s.grade ?? '—'}</td>
                    {DOC_KEYS.map(k => (
                      <td key={k} style={{ ...td, textAlign: 'center', padding: '9px 4px' }}>
                        {s.docs[k]
                          ? <span style={{ color: '#1DBD6A', fontSize: 15, fontWeight: 700 }}>✓</span>
                          : <span style={{ color: '#E4EAF2', fontSize: 15 }}>✗</span>
                        }
                      </td>
                    ))}
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
              {filtered.length === 0 && (
                <tr><td colSpan={DOC_KEYS.length + 4} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditDocsModal
          student={editing}
          onClose={() => setEditing(null)}
          onSave={saveDocs}
        />
      )}
    </div>
  )
}
