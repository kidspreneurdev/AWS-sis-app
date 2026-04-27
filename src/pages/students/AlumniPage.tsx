import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { StudentModal } from '@/components/students/StudentModal'
import { type Student, type StudentInsert, fullName } from '@/types/student'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { useCohorts } from '@/hooks/useCohorts'
import { useCampuses } from '@/hooks/useCampuses'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { toast } from '@/lib/toast'

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
    id: row.id as string, studentId: row.student_id as string ?? '',
    firstName: row.first_name as string ?? '', lastName: row.last_name as string ?? '',
    dob: null, gender: null, nationality: row.nationality as string ?? null, lang: null,
    grade: row.grade as number ?? null, status: 'Alumni',
    campus: row.campus as string ?? null, cohort: row.cohort as string ?? null,
    studentType: 'Alumni', appDate: row.application_date as string ?? null,
    enrollDate: row.enroll_date as string ?? null,
    yearJoined: row.year_joined as string ?? null,
    yearGraduated: row.year_graduated as string ?? null,
    gradeWhenJoined: row.grade_when_joined as number ?? null,
    priority: (row.priority as Student['priority']) ?? 'Normal',
    prevSchool: null, priorGpa: null, iep: null, email: row.email as string ?? null,
    phone: row.phone as string ?? null, parent: row.parent as string ?? null,
    relation: null, ecName: null, ecPhone: null, address: null, bloodGroup: null,
    allergy: null, meds: null, physician: null, physicianPhone: null, healthNotes: null,
    notes: null, counselorNotes: null, documents: [],
    intDate: null, intTime: null, intViewer: null, intScore: null,
    intNotes: null, intCommittee: null, decDate: null, decNotes: null,
    postSecondary: ext.postSecondary as string ?? null,
    gradDistinction: ext.gradDistinction as string ?? null,
    alumniNotes: ext.alumniNotes as string ?? null,
    createdAt: row.created_at as string ?? '', updatedAt: row.updated_at as string ?? '',
  }
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2', boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}

const th: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }

const DISTINCTION_COLORS: Record<string, string> = {
  'Valedictorian': '#DAA520',
  'Salutatorian': '#CD853F',
  'Summa Cum Laude': '#B8860B',
  'Magna Cum Laude': '#8B7355',
  'Cum Laude': '#7A7A7A',
  'AP Scholar': '#7040CC',
  'Honour Roll': '#1DBD6A',
}

export function AlumniPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('All')
  const [filterCampus, setFilterCampus] = useState('All')
  const cohorts = useCohorts()

  async function fetchAlumni() {
    setLoading(true)
    let q = supabase.from('students').select('*').eq('status', 'Alumni').order('year_graduated', { ascending: false })
    if (cf) q = q.eq('campus', cf)
    const { data } = await q
    setStudents((data ?? []).map(fromRow))
    setLoading(false)
  }

  useEffect(() => { void fetchAlumni() }, [cf])

  async function handleSave(data: StudentInsert) {
    const payload: StudentInsert = {
      ...data,
      status: 'Alumni',
      studentType: 'Alumni',
    }
    const { error } = await supabase.from('students').insert(toRow(payload))
    if (error) {
      toast(error.message, 'err')
      return
    }
    toast('Alumni record added', 'ok')
    setModalOpen(false)
    await fetchAlumni()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => {
      if (filterYear !== 'All' && s.yearGraduated !== filterYear) return false
      if (filterCampus !== 'All' && s.campus !== filterCampus) return false
      if (q && !`${s.firstName} ${s.lastName} ${s.studentId ?? ''} ${s.campus ?? ''} ${s.postSecondary ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [students, search, filterYear, filterCampus])

  const years = [...new Set(students.map(s => s.yearGraduated).filter(Boolean) as string[])].sort((a, b) => Number(b) - Number(a))
  const campuses = [...new Set(students.map(s => s.campus).filter(Boolean) as string[])]
  const modalCampuses = useCampuses()

  // Stats
  const graduatingClasses = years.length
  const collegeBound = students.filter(s => s.postSecondary).length
  const withDistinction = students.filter(s => s.gradDistinction && s.gradDistinction !== 'None').length

  // Grouped by year
  const grouped = useMemo(() => {
    const m: Record<string, Student[]> = {}
    filtered.forEach(s => {
      const yr = s.yearGraduated ?? 'Unknown'
      if (!m[yr]) m[yr] = []
      m[yr].push(s)
    })
    return Object.entries(m).sort((a, b) => Number(b[0]) - Number(a[0]))
  }, [filtered])

  function exportCSV() {
    const rows = [
      ['Name', 'Student ID', 'Graduated', 'Campus', 'Grade', 'Year Joined', 'Years at AWS', 'Distinction', 'Post-Secondary', 'Email'],
      ...filtered.map(s => {
        const yrsAtAws = s.yearJoined && s.yearGraduated ? Number(s.yearGraduated) - Number(s.yearJoined) : ''
        return [fullName(s), s.studentId, s.yearGraduated ?? '', s.campus ?? '', s.grade ?? '', s.yearJoined ?? '', yrsAtAws, s.gradDistinction ?? '', s.postSecondary ?? '', s.email ?? '']
      }),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'alumni.csv'
    a.click()
  }

  const headerPortal = useHeaderActions(
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇ Export CSV</button>
      <button onClick={() => setModalOpen(true)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7040CC', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🏅 Add Alumni</button>
    </div>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { icon: '🎓', label: 'Total Alumni', val: students.length, col: '#7C3AED' },
          { icon: '📅', label: 'Graduating Classes', val: graduatingClasses, col: '#0EA5E9' },
          { icon: '🏫', label: 'College / Uni Bound', val: collegeBound, col: '#1DBD6A' },
          { icon: '🏆', label: 'With Distinction', val: withDistinction, col: '#D97706' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.col, margin: '4px 0 2px' }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            style={{ height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none', flex: '1 1 200px' }}
            placeholder="🔍  Search by name, ID, destination…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={{ height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none' }}
            value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="All">All Years</option>
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
          <select style={{ height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none' }}
            value={filterCampus} onChange={e => setFilterCampus(e.target.value)}>
            <option value="All">All Campuses</option>
            {campuses.map(c => <option key={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#7A92B0' }}>{filtered.length} results</span>
        </div>
      </div>

      {/* Alumni by year */}
      {loading ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>No alumni found</div>
        </div>
      ) : grouped.map(([year, grp]) => (
        <div key={year} style={{ ...card, overflow: 'hidden' }}>
          {/* Class header */}
          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg,#1A365E,#2D4E7A)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>🎓 Class of {year}</span>
            <span style={{ fontSize: 11, color: '#A8C4E8' }}>{grp.length} graduate{grp.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '1px solid #E4EAF2' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Graduate</th>
                  <th style={{ ...th, textAlign: 'left' }}>Student ID</th>
                  <th style={{ ...th, textAlign: 'left' }}>Final Grade</th>
                  <th style={{ ...th, textAlign: 'left' }}>Year Joined</th>
                  <th style={{ ...th, textAlign: 'left' }}>Years at AWS</th>
                  <th style={{ ...th, textAlign: 'left' }}>Distinction</th>
                  <th style={{ ...th, textAlign: 'left' }}>Post-Secondary</th>
                  <th style={{ ...th, textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {grp.map((s, i) => {
                  const yrsAtAws = s.yearJoined && s.yearGraduated ? Number(s.yearGraduated) - Number(s.yearJoined) : null
                  const distColor = s.gradDistinction ? (DISTINCTION_COLORS[s.gradDistinction] ?? '#7A92B0') : null
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F0F4FA', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#F7F9FC'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: '#1A365E' }}>{fullName(s)}</div>
                        <div style={{ fontSize: 11, color: '#7A92B0' }}>{s.campus ?? ''}{s.nationality ? ` · ${s.nationality}` : ''}</div>
                      </td>
                      <td style={td}>
                        {s.studentId ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>🎓 {s.studentId}</span> : <span style={{ color: '#C4D0DE' }}>—</span>}
                      </td>
                      <td style={td}>
                        {s.grade !== null
                          ? <span style={{ background: '#E0F5FF', color: '#0A527A', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{s.grade}</span>
                          : <span style={{ color: '#C4D0DE' }}>—</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>{s.yearJoined ?? <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {yrsAtAws !== null
                          ? <span style={{ background: '#F3EFF9', color: '#7C3AED', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{yrsAtAws}y</span>
                          : <span style={{ color: '#C4D0DE' }}>—</span>}
                      </td>
                      <td style={td}>
                        {distColor
                          ? <span style={{ background: distColor + '22', color: distColor, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, border: `1px solid ${distColor}44` }}>🏆 {s.gradDistinction}</span>
                          : <span style={{ color: '#C4D0DE' }}>—</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#3D5475', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.postSecondary ?? <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                      <td style={{ ...td, fontSize: 11, color: '#7A92B0', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.alumniNotes ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <StudentModal
        open={modalOpen}
        student={null}
        initialStudentType="Alumni"
        campuses={modalCampuses}
        cohorts={cohorts}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />
    </div>
    </>
  )
}
