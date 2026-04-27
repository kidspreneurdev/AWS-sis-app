import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { StudentModal } from '@/components/students/StudentModal'
import { StudentDetailPanel } from '@/components/students/StudentDetailPanel'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import {
  type Student, type StudentInsert, type StudentStatus,
  STATUSES, GRADES, fullName,
} from '@/types/student'
import { useCohorts } from '@/hooks/useCohorts'
import { useCampuses } from '@/hooks/useCampuses'
import { useCampusFilter } from '@/hooks/useCampusFilter'

// ─── DB helpers ──────────────────────────────────────────────────────────────
function toRow(s: StudentInsert) {
  return {
    student_id: s.studentId,
    first_name: s.firstName,
    last_name: s.lastName,
    nationality: s.nationality,
    grade: s.grade,
    status: s.status,
    campus: s.campus,
    cohort: s.cohort,
    email: s.email,
    phone: s.phone,
    application_date: s.appDate,
    enroll_date: s.enrollDate,
    parent: s.parent,
    support_needs: s.iep,
    priority: s.priority,
    year_joined: s.yearJoined,
    year_graduated: s.yearGraduated,
    grade_when_joined: s.gradeWhenJoined,
  }
}

function fromRow(row: Record<string, unknown>): Student {
  let ext: Record<string, unknown> = {}
  try { ext = JSON.parse((row.notes as string) || '{}') } catch { /* */ }
  return {
    id: row.id as string,
    studentId: row.student_id as string ?? '',
    firstName: row.first_name as string ?? '',
    lastName: row.last_name as string ?? '',
    dob: ext.dob as string ?? null,
    gender: ext.gender as Student['gender'] ?? null,
    nationality: row.nationality as string ?? null,
    lang: ext.lang as string ?? null,
    grade: row.grade as number ?? null,
    status: row.status as StudentStatus ?? 'Inquiry',
    campus: row.campus as string ?? null,
    cohort: row.cohort as string ?? null,
    studentType: (ext.studentType as Student['studentType']) ?? 'New',
    appDate: row.application_date as string ?? null,
    enrollDate: row.enroll_date as string ?? null,
    yearJoined: typeof row.year_joined === 'string' ? row.year_joined : null,
    yearGraduated: typeof row.year_graduated === 'string' ? row.year_graduated : null,
    gradeWhenJoined: typeof row.grade_when_joined === 'number' ? row.grade_when_joined : null,
    priority: (row.priority as Student['priority']) ?? 'Normal',
    prevSchool: ext.prevSchool as string ?? null,
    priorGpa: ext.priorGpa as string ?? null,
    iep: row.support_needs as string ?? null,
    email: row.email as string ?? null,
    phone: row.phone as string ?? null,
    parent: row.parent as string ?? null,
    relation: ext.relation as string ?? null,
    ecName: ext.ecName as string ?? null,
    ecPhone: ext.ecPhone as string ?? null,
    address: ext.address as string ?? null,
    bloodGroup: ext.bloodGroup as string ?? null,
    allergy: ext.allergy as string ?? null,
    meds: ext.meds as string ?? null,
    physician: ext.physician as string ?? null,
    physicianPhone: ext.physicianPhone as string ?? null,
    healthNotes: ext.healthNotes as string ?? null,
    notes: ext.notes as string ?? null,
    counselorNotes: ext.counselorNotes as string ?? null,
    documents: (ext.documents as string[]) ?? [],
    intDate: ext.intDate as string ?? null,
    intTime: ext.intTime as string ?? null,
    intViewer: ext.intViewer as string ?? null,
    intScore: ext.intScore as number ?? null,
    intNotes: ext.intNotes as string ?? null,
    intCommittee: ext.intCommittee as string ?? null,
    decDate: ext.decDate as string ?? null,
    decNotes: ext.decNotes as string ?? null,
    postSecondary: ext.postSecondary as string ?? null,
    gradDistinction: ext.gradDistinction as string ?? null,
    alumniNotes: ext.alumniNotes as string ?? null,
    createdAt: row.created_at as string ?? '',
    updatedAt: row.updated_at as string ?? '',
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2', boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8,
  padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}
const filterInput: React.CSSProperties = {
  height: 34, borderRadius: 8, border: '1px solid #E4EAF2',
  padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none',
}
const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#7A92B0',
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }

type SortKey = 'firstName' | 'studentId' | 'grade' | 'status' | 'campus' | 'appDate' | 'priority' | 'intDate'

// ─── Component ───────────────────────────────────────────────────────────────
export function ApplicationsPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)
  const [panelStudent, setPanelStudent] = useState<Student | null>(null)
  const [modalType, setModalType] = useState<Student['studentType']>('New')

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterType, setFilterType] = useState<string>('All')
  const [filterGrade, setFilterGrade] = useState<string>('All')
  const [filterCampus, setFilterCampus] = useState<string>('All')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('appDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { fetchStudents() }, [cf])

  async function fetchStudents() {
    setLoading(true)
    let q = supabase.from('students').select('*').order('created_at', { ascending: false })
    if (cf) q = q.eq('campus', cf)
    const { data } = await q
    setStudents((data ?? []).map(fromRow))
    setLoading(false)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list = students.filter(s => {
      if (filterStatus !== 'All' && s.status !== filterStatus) return false
      if (filterType !== 'All' && s.studentType !== filterType) return false
      if (filterGrade !== 'All' && String(s.grade) !== filterGrade) return false
      if (filterCampus !== 'All' && s.campus !== filterCampus) return false
      if (q) {
        const hay = [s.firstName, s.lastName, s.studentId, s.nationality,
          s.email, s.cohort, s.campus, s.parent, s.phone].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      let av: string | number | null = null, bv: string | number | null = null
      if (sortKey === 'firstName') { av = `${a.firstName} ${a.lastName}`; bv = `${b.firstName} ${b.lastName}` }
      else if (sortKey === 'studentId') { av = a.studentId; bv = b.studentId }
      else if (sortKey === 'grade') { av = a.grade ?? -1; bv = b.grade ?? -1 }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else if (sortKey === 'campus') { av = a.campus ?? ''; bv = b.campus ?? '' }
      else if (sortKey === 'appDate') { av = a.appDate ?? ''; bv = b.appDate ?? '' }
      else if (sortKey === 'priority') { const o = ['Urgent','High','Normal','Low']; av = o.indexOf(a.priority); bv = o.indexOf(b.priority) }
      else if (sortKey === 'intDate') { av = a.intDate ?? ''; bv = b.intDate ?? '' }
      if (av === null || av === undefined) av = typeof bv === 'number' ? -Infinity : ''
      if (bv === null || bv === undefined) bv = typeof av === 'number' ? -Infinity : ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [students, search, filterStatus, filterType, filterGrade, filterCampus, sortKey, sortDir])

  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }

  async function handleSave(data: StudentInsert) {
    if (editing) {
      const { error } = await supabase.from('students').update(toRow(data)).eq('id', editing.id)
      if (error) { console.error('Update error:', error); toast(error.message, 'err'); return }
      toast('Application updated', 'ok')
    } else {
      const { error } = await supabase.from('students').insert(toRow(data))
      if (error) { console.error('Insert error:', error); toast(error.message, 'err'); return }
      toast('Application added', 'ok')
    }
    await fetchStudents()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await supabase.from('students').delete().eq('id', id)
    setStudents(prev => prev.filter(s => s.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    if (panelStudent?.id === id) setPanelStudent(null)
    setDeleting(null)
    toast('Student deleted', 'ok')
  }

  async function handleStatusChange(id: string, status: StudentStatus) {
    await supabase.from('students').update({ status }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    setPanelStudent(prev => prev?.id === id ? { ...prev, status } : prev)
  }

  async function handleDocumentsUpdated(id: string, documents: string[]) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, documents } : s))
    setPanelStudent(prev => prev?.id === id ? { ...prev, documents } : prev)
  }

  async function bulkStatus(status: StudentStatus) {
    const ids = [...selected]
    await Promise.all(ids.map(id => supabase.from('students').update({ status }).eq('id', id)))
    setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, status } : s))
    setSelected(new Set())
    toast(`${ids.length} student${ids.length !== 1 ? 's' : ''} → ${status}`, 'ok')
  }

  function exportCSV() {
    const rows = [
      ['ID', 'First Name', 'Last Name', 'Status', 'Grade', 'Campus', 'Applied', 'Priority', 'Nationality', 'Parent', 'Email', 'Phone'],
      ...filtered.map(s => [s.studentId, s.firstName, s.lastName, s.status, s.grade ?? '', s.campus ?? '', s.appDate ?? '', s.priority, s.nationality ?? '', s.parent ?? '', s.email ?? '', s.phone ?? '']),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'students-applications.csv'; a.click()
  }

  const campuses = useCampuses()
  const cohorts = useCohorts()
  const BULK_STATUSES: StudentStatus[] = ['Under Review', 'Accepted', 'Waitlisted', 'Enrolled', 'Denied']

  function SortTh({ label, sortK, style }: { label: string; sortK: SortKey; style?: React.CSSProperties }) {
    const active = sortKey === sortK
    return (
      <th
        style={{ ...th, textAlign: 'left', cursor: 'pointer', userSelect: 'none', ...style }}
        onClick={() => handleSort(sortK)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ fontSize: 9, color: active ? '#D61F31' : '#BDD0E8' }}>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </span>
      </th>
    )
  }

  const segmentedWrap: React.CSSProperties = {
    display: 'inline-flex',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 3px 10px rgba(26,54,94,0.12)',
    border: '1px solid rgba(26,54,94,0.14)',
    maxWidth: '100%',
  }
  const segmentedBtn: React.CSSProperties = {
    border: 'none',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.1,
    padding: '10px 16px',
    minHeight: 40,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: '0.01em',
  }

  const headerPortal = useHeaderActions(
    <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <div style={segmentedWrap}>
        <button
          style={{ ...segmentedBtn, background: '#D61F31', borderRight: '1px solid rgba(255,255,255,0.25)' }}
          onClick={() => { setEditing(null); setModalType('New'); setModalOpen(true) }}
        >
          + New Application
        </button>
        <button
          style={{ ...segmentedBtn, background: '#1A6B4A', borderRight: '1px solid rgba(255,255,255,0.25)' }}
          onClick={() => { setEditing(null); setModalType('Existing'); setModalOpen(true) }}
        >
          ✅ Existing Student
        </button>
        <button
          style={{ ...segmentedBtn, background: '#7040CC' }}
          onClick={() => { setEditing(null); setModalType('Alumni'); setModalOpen(true) }}
        >
          🏅 Add Alumni
        </button>
      </div>
    </div>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ ...card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#EEF5FF', border: '1px solid #C8DEFF', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{selected.size} student{selected.size !== 1 ? 's' : ''} selected</span>
          <span style={{ color: '#C8DEFF' }}>|</span>
          <span style={{ fontSize: 12, color: '#3D5475', fontWeight: 600 }}>Set status:</span>
          {BULK_STATUSES.map(st => (
            <button key={st} onClick={() => bulkStatus(st)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#1A365E', color: '#fff' }}>{st}</button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{ ...btnSecondary, marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }}>✕ Clear</button>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ ...card, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...filterInput, flex: '1 1 200px', minWidth: 160 }} placeholder="🔍  Search by name, ID, nationality, parent…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={filterInput} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={filterInput} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="All">All Types</option>
            <option>New</option><option>Existing</option><option>Alumni</option>
          </select>
          <select style={filterInput} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="All">All Grades</option>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
          <select style={filterInput} value={filterCampus} onChange={e => setFilterCampus(e.target.value)}>
            <option value="All">All Campuses</option>
            {campuses.map(c => <option key={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#7A92B0', whiteSpace: 'nowrap' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <button style={{ ...btnSecondary, marginLeft: 'auto' }} onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9EB3C8', fontSize: 14 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>No applications found</div>
            <div style={{ fontSize: 13, color: '#7A92B0', marginTop: 4 }}>{search || filterStatus !== 'All' ? 'Try adjusting your filters' : 'Click "New Application" to get started'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '1px solid #E4EAF2' }}>
                  <th style={th}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <SortTh label="Student" sortK="firstName" />
                  <SortTh label="Student ID" sortK="studentId" />
                  <th style={{ ...th, textAlign: 'left' }}>Type</th>
                  <SortTh label="Grade" sortK="grade" />
                  <SortTh label="Status" sortK="status" />
                  <SortTh label="Campus" sortK="campus" />
                  <SortTh label="Applied" sortK="appDate" />
                  <SortTh label="Priority" sortK="priority" />
                  <SortTh label="Interview" sortK="intDate" />
                  <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => setPanelStudent(s)}
                    style={{
                      borderBottom: '1px solid #F0F4FA',
                      background: selected.has(s.id) ? '#EEF5FF' : i % 2 === 0 ? '#fff' : '#FAFBFC',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!selected.has(s.id)) (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected.has(s.id) ? '#EEF5FF' : i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                  >
                    <td style={td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} />
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#1A365E' }}>{fullName(s)}</div>
                      {s.nationality && <div style={{ fontSize: 11, color: '#7A92B0' }}>{s.nationality}</div>}
                    </td>
                    <td style={td}>
                      {s.studentId
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span>🎓</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.studentId}</span>
                        </span>
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={td}><span style={{ fontSize: 12, color: '#3D5475' }}>{s.studentType}</span></td>
                    <td style={td}>
                      {s.grade !== null
                        ? <span style={{ background: '#EEF5FF', color: '#1A365E', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{s.grade}</span>
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <select
                          value={s.status}
                          onChange={e => handleStatusChange(s.id, e.target.value as StudentStatus)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, outline: 'none' }}
                        >
                          {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <StatusBadge status={s.status} size="sm" />
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>{s.campus ?? <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                    <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>
                      {s.appDate ? new Date(s.appDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={td}><PriorityBadge priority={s.priority} /></td>
                    <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>
                      {s.intDate ? new Date(s.intDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => { setEditing(s); setModalType(s.studentType); setModalOpen(true) }}
                          title="Edit"
                          style={{ background: '#EEF5FF', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✏️</button>
                        <button
                          onClick={() => { if (confirm(`Delete ${fullName(s)}? This cannot be undone.`)) handleDelete(s.id) }}
                          disabled={deleting === s.id}
                          title="Delete"
                          style={{ background: '#FFF0F1', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentModal
        open={modalOpen}
        student={editing}
        initialStudentType={modalType}
        campuses={campuses}
        cohorts={cohorts}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditing(null); setModalType('New') }}
      />

      <StudentDetailPanel
        student={panelStudent}
        onClose={() => setPanelStudent(null)}
        onStatusChange={handleStatusChange}
        onEdit={(s) => { setPanelStudent(null); setEditing(s); setModalType(s.studentType); setModalOpen(true) }}
        onDocumentsUpdated={handleDocumentsUpdated}
      />
    </div>
    </>
  )
}
