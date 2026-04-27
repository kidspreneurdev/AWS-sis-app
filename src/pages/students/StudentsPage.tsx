import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { StudentModal } from '@/components/students/StudentModal'
import { StudentDetailPanel } from '@/components/students/StudentDetailPanel'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { type Student, type StudentInsert, type StudentStatus, fullName } from '@/types/student'
import { useCohorts } from '@/hooks/useCohorts'
import { useCampuses } from '@/hooks/useCampuses'
import { useCampusFilter } from '@/hooks/useCampusFilter'

// Reuse the same row conversion from ApplicationsPage
function fromRow(row: Record<string, unknown>): Student {
  let ext: Record<string, unknown> = {}
  try { ext = JSON.parse((row.notes as string) || '{}') } catch { /* */ }
  return {
    id: row.id as string,
    studentId: row.student_id as string ?? '',
    firstName: row.first_name as string ?? '',
    lastName: row.last_name as string ?? '',
    dob: (row.date_of_birth as string) ?? (ext.dob as string) ?? null,
    gender: ext.gender as Student['gender'] ?? null,
    nationality: row.nationality as string ?? null,
    lang: ext.lang as string ?? null,
    grade: row.grade as number ?? null,
    status: (row.status as Student['status']) ?? 'Enrolled',
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

function toRow(s: StudentInsert) {
  const notes = JSON.stringify({
    dob: s.dob,
    gender: s.gender,
    lang: s.lang,
    studentType: s.studentType,
    prevSchool: s.prevSchool,
    priorGpa: s.priorGpa,
    relation: s.relation,
    ecName: s.ecName,
    ecPhone: s.ecPhone,
    address: s.address,
    bloodGroup: s.bloodGroup,
    allergy: s.allergy,
    meds: s.meds,
    physician: s.physician,
    physicianPhone: s.physicianPhone,
    healthNotes: s.healthNotes,
    notes: s.notes,
    counselorNotes: s.counselorNotes,
    documents: s.documents,
    intDate: s.intDate,
    intTime: s.intTime,
    intViewer: s.intViewer,
    intScore: s.intScore,
    intNotes: s.intNotes,
    intCommittee: s.intCommittee,
    decDate: s.decDate,
    decNotes: s.decNotes,
    postSecondary: s.postSecondary,
    gradDistinction: s.gradDistinction,
    alumniNotes: s.alumniNotes,
  })

  return {
    student_id: s.studentId,
    first_name: s.firstName,
    last_name: s.lastName,
    date_of_birth: s.dob,
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
    notes,
  }
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2',
  boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}
const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap',
}

export function StudentsPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [panelStudent, setPanelStudent] = useState<Student | null>(null)
  const [search, setSearch] = useState('')
  const [filterCampus, setFilterCampus] = useState('All')
  const [filterCohort, setFilterCohort] = useState('All')
  const [filterGrade, setFilterGrade] = useState('All')

  useEffect(() => { fetchStudents() }, [cf])

  async function fetchStudents() {
    setLoading(true)
    let q = supabase.from('students').select('*').eq('status', 'Enrolled').order('last_name')
    if (cf) q = q.eq('campus', cf)
    const { data } = await q
    setStudents((data ?? []).map(fromRow))
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      if (filterCampus !== 'All' && s.campus !== filterCampus) return false
      if (filterCohort !== 'All' && s.cohort !== filterCohort) return false
      if (filterGrade !== 'All' && String(s.grade) !== filterGrade) return false
      if (q) {
        const hay = [s.firstName, s.lastName, s.studentId, String(s.grade ?? ''), s.cohort ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [students, search, filterCampus, filterCohort, filterGrade])

  async function handleSave(data: StudentInsert) {
    if (editing) {
      const { error } = await supabase.from('students').update(toRow(data)).eq('id', editing.id)
      if (error) { console.error('Student update error:', error); toast(error.message, 'err'); return }
      toast('Student updated', 'ok')
    } else {
      const payload: StudentInsert = { ...data, status: data.status === 'Inquiry' ? 'Enrolled' : data.status }
      const row = toRow(payload)
      console.log('Inserting student row:', row)
      const { error } = await supabase.from('students').insert(row)
      if (error) { console.error('Student insert error:', error); toast(error.message, 'err'); return }
      toast('Student enrolled', 'ok')
    }
    await fetchStudents()
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

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name} from enrolled? This will set their status to Withdrawn.`)) return
    await supabase.from('students').update({ status: 'Withdrawn' }).eq('id', id)
    setStudents(prev => prev.filter(s => s.id !== id))
    if (panelStudent?.id === id) setPanelStudent(null)
    toast(`${name} withdrawn`, 'ok')
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Student ID', 'Grade', 'Cohort', 'Campus', 'Enrolled', 'IEP/Support'],
      ...filtered.map(s => [fullName(s), s.studentId, s.grade ?? '', s.cohort ?? '', s.campus ?? '', s.enrollDate ?? '', s.iep ?? '']),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'enrolled-students.csv'
    a.click()
  }

  const campuses = useCampuses()
  const cohorts = useCohorts()
  const grades = [...new Set(students.map(s => s.grade).filter(v => v !== null) as number[])].sort((a, b) => a - b)

  const headerPortal = useHeaderActions(
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇ Export CSV</button>
      <button onClick={() => { setEditing(null); setModalOpen(true) }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Enroll Student</button>
    </div>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filters */}
      <div style={{ ...card, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{
              height: 34, borderRadius: 8, border: '1px solid #E4EAF2',
              padding: '0 12px', fontSize: 13, color: '#1A365E',
              background: '#fff', outline: 'none', flex: '1 1 200px', minWidth: 160,
            }}
            placeholder="🔍  Search by name, ID, grade, cohort…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {[
            { label: 'All Campuses', value: filterCampus, set: setFilterCampus, opts: campuses },
            { label: 'All Cohorts', value: filterCohort, set: setFilterCohort, opts: cohorts },
            { label: 'All Grades', value: filterGrade, set: setFilterGrade, opts: grades.map(String) },
          ].map(f => (
            <select
              key={f.label}
              style={{ height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none' }}
              value={f.value}
              onChange={e => f.set(e.target.value)}
            >
              <option value="All">{f.label}</option>
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <span style={{ fontSize: 12, color: '#7A92B0' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍🎓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>No enrolled students</div>
            <div style={{ fontSize: 13, color: '#7A92B0', marginTop: 4 }}>
              {search ? 'Try adjusting your search' : 'Enroll students from the Applications page'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '1px solid #E4EAF2' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Student</th>
                  <th style={{ ...th, textAlign: 'left' }}>Student ID</th>
                  <th style={{ ...th, textAlign: 'left' }}>Grade</th>
                  <th style={{ ...th, textAlign: 'left' }}>Cohort</th>
                  <th style={{ ...th, textAlign: 'left' }}>Campus</th>
                  <th style={{ ...th, textAlign: 'left' }}>Support</th>
                  <th style={{ ...th, textAlign: 'left' }}>Enrolled</th>
                  <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => setPanelStudent(s)}
                    style={{ borderBottom: '1px solid #F0F4FA', background: i % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#1A365E' }}>{fullName(s)}</div>
                      {s.nationality && <div style={{ fontSize: 11, color: '#7A92B0' }}>{s.nationality}</div>}
                    </td>
                    <td style={td}>
                      {s.studentId
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>🎓 {s.studentId}</span>
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={td}>
                      {s.grade !== null
                        ? <span style={{ background: '#E0F5FF', color: '#0A527A', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{s.grade}</span>
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={td}>
                      {s.cohort
                        ? <span style={{ background: '#EDE6FB', color: '#5B2DB0', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{s.cohort}</span>
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>{s.campus ?? <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                    <td style={td}>
                      {s.iep
                        ? <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{s.iep}</span>
                        : null}
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>
                      {s.enrollDate
                        ? new Date(s.enrollDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : <span style={{ color: '#C4D0DE' }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => { setEditing(s); setModalOpen(true) }}
                          style={{ background: '#EEF5FF', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✏️</button>
                        <button
                          onClick={() => handleRemove(s.id, fullName(s))}
                          style={{ background: '#FFF0F1', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >×</button>
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
        campuses={campuses}
        cohorts={cohorts}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditing(null) }}
      />

      <StudentDetailPanel
        student={panelStudent}
        onClose={() => setPanelStudent(null)}
        onStatusChange={handleStatusChange}
        onEdit={(s) => { setPanelStudent(null); setEditing(s); setModalOpen(true) }}
        onDocumentsUpdated={handleDocumentsUpdated}
      />
    </div>
    </>
  )
}
