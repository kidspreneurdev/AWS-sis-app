import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { StudentDetailPanel } from '@/components/students/StudentDetailPanel'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { type Student, type StudentStatus, fullName } from '@/types/student'

function fromRow(row: Record<string, unknown>): Student {
  let ext: Record<string, unknown> = {}
  try { ext = JSON.parse((row.notes as string) || '{}') } catch { /* */ }
  return {
    id: row.id as string, studentId: row.student_id as string ?? '',
    firstName: row.first_name as string ?? '', lastName: row.last_name as string ?? '',
    dob: null, gender: null, nationality: row.nationality as string ?? null, lang: null,
    grade: row.grade as number ?? null, status: 'Waitlisted',
    campus: row.campus as string ?? null, cohort: row.cohort as string ?? null,
    studentType: (ext.studentType as Student['studentType']) ?? 'New',
    appDate: row.application_date as string ?? null, enrollDate: null,
    yearJoined: null, yearGraduated: null, gradeWhenJoined: null,
    priority: (row.priority as Student['priority']) ?? 'Normal',
    prevSchool: null, priorGpa: null, iep: null, email: null, phone: null,
    parent: row.parent as string ?? null, relation: null, ecName: null, ecPhone: null,
    address: null, bloodGroup: null, allergy: null, meds: null,
    physician: null, physicianPhone: null, healthNotes: null,
    notes: null, counselorNotes: null, documents: (ext.documents as string[]) ?? [],
    intDate: null, intTime: null, intViewer: null, intScore: null,
    intNotes: null, intCommittee: null, decDate: null, decNotes: null,
    postSecondary: null, gradDistinction: null, alumniNotes: null,
    createdAt: row.created_at as string ?? '', updatedAt: row.updated_at as string ?? '',
  }
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2', boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ ...card, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#7A92B0', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function WaitlistPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [panelStudent, setPanelStudent] = useState<Student | null>(null)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('status', 'Waitlisted').order('application_date')
    setStudents((data ?? []).map(fromRow))
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return students
    return students.filter(s =>
      [s.firstName, s.lastName, s.campus ?? '', s.nationality ?? ''].join(' ').toLowerCase().includes(q)
    )
  }, [students, search])

  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)))
  }

  async function updateStatus(ids: string[], status: 'Accepted' | 'Denied') {
    await Promise.all(ids.map(id => supabase.from('students').update({ status }).eq('id', id)))
    setStudents(prev => prev.filter(s => !ids.includes(s.id)))
    if (panelStudent && ids.includes(panelStudent.id)) setPanelStudent(null)
    setSelected(new Set())
    toast(`${ids.length} student${ids.length !== 1 ? 's' : ''} → ${status}`, 'ok')
  }

  async function handleStatusChange(id: string, status: StudentStatus) {
    await supabase.from('students').update({ status }).eq('id', id)
    if (status !== 'Waitlisted') {
      setStudents(prev => prev.filter(s => s.id !== id))
      setPanelStudent(null)
    } else {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      setPanelStudent(prev => prev?.id === id ? { ...prev, status } : prev)
    }
  }

  function handleDocumentsUpdated(id: string, documents: string[]) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, documents } : s))
    setPanelStudent(prev => prev?.id === id ? { ...prev, documents } : prev)
  }

  function exportCSV() {
    const rows = [
      ['#', 'Name', 'Campus', 'Nationality', 'Grade', 'Applied', 'Days Waiting', 'Priority', 'Docs'],
      ...filtered.map((s, i) => [
        i + 1, fullName(s), s.campus ?? '', s.nationality ?? '',
        s.grade ?? '', s.appDate ?? '', daysSince(s.appDate),
        s.priority, `${s.documents.length}/6`,
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'waitlist.csv'
    a.click()
  }

  const highPriority = students.filter(s => s.priority === 'Urgent' || s.priority === 'High').length
  const avgDays = students.length
    ? Math.round(students.reduce((sum, s) => sum + daysSince(s.appDate), 0) / students.length)
    : 0
  const docsComplete = students.filter(s => s.documents.length >= 6).length

  const th: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, fontWeight: 700,
    color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }

  const headerPortal = useHeaderActions(
    <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇ Export CSV</button>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard label="On Waitlist" value={students.length} color="#1FD6C4" />
        <StatCard label="High / Urgent Priority" value={highPriority} color="#D61F31" />
        <StatCard label="Docs Complete" value={docsComplete} color="#1DBD6A" />
        <StatCard label="Avg Days Waiting" value={avgDays} color="#F5A623" />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div style={{ ...card, padding: '10px 16px', background: '#EEF5FF', border: '1px solid #C8DEFF', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{selected.size} selected</span>
          <button
            onClick={() => updateStatus([...selected], 'Accepted')}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: '#1DBD6A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ✓ Accept Selected
          </button>
          <button
            onClick={() => updateStatus([...selected], 'Denied')}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: '#D61F31', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            ✕ Deny Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ ...card, padding: '12px 16px' }}>
        <input
          style={{ height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          placeholder="🔍  Search waitlist…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>Waitlist is empty</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '1px solid #E4EAF2' }}>
                  <th style={th}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                  <th style={{ ...th, textAlign: 'left' }}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>Student</th>
                  <th style={{ ...th, textAlign: 'left' }}>Grade</th>
                  <th style={{ ...th, textAlign: 'left' }}>Applied</th>
                  <th style={{ ...th, textAlign: 'left' }}>Days</th>
                  <th style={{ ...th, textAlign: 'left' }}>Priority</th>
                  <th style={{ ...th, textAlign: 'left' }}>Docs</th>
                  <th style={{ ...th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const days = daysSince(s.appDate)
                  const docPct = Math.round((s.documents.length / 6) * 100)
                  return (
                    <tr key={s.id}
                      onClick={() => setPanelStudent(s)}
                      style={{ borderBottom: '1px solid #F0F4FA', background: selected.has(s.id) ? '#EEF5FF' : i % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer' }}
                      onMouseEnter={e => { if (!selected.has(s.id)) (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected.has(s.id) ? '#EEF5FF' : i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                    >
                      <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} /></td>
                      <td style={{ ...td, color: '#7A92B0', fontWeight: 700 }}>{i + 1}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: '#1A365E' }}>{fullName(s)}</div>
                        <div style={{ fontSize: 11, color: '#7A92B0' }}>{s.campus ?? ''}{s.nationality ? ` · ${s.nationality}` : ''}</div>
                      </td>
                      <td style={td}>
                        {s.grade !== null
                          ? <span style={{ background: '#E0F5FF', color: '#0A527A', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{s.grade}</span>
                          : <span style={{ color: '#C4D0DE' }}>—</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#3D5475' }}>
                        {s.appDate ? new Date(s.appDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={td}>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: days > 30 ? '#D61F31' : days > 14 ? '#F5A623' : '#1DBD6A',
                        }}>
                          {days}d
                        </span>
                      </td>
                      <td style={td}><PriorityBadge priority={s.priority} /></td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: '#F0F4FA', borderRadius: 20 }}>
                            <div style={{ height: 6, borderRadius: 20, width: `${docPct}%`, background: docPct >= 100 ? '#1DBD6A' : docPct >= 50 ? '#F5A623' : '#D61F31', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#7A92B0' }}>{s.documents.length}/6</span>
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => updateStatus([s.id], 'Accepted')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#E8FBF0', color: '#0E6B3B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                          <button onClick={() => updateStatus([s.id], 'Denied')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#FEE2E2', color: '#991B1B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Deny</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentDetailPanel
        student={panelStudent}
        onClose={() => setPanelStudent(null)}
        onStatusChange={handleStatusChange}
        onEdit={() => setPanelStudent(null)}
        onDocumentsUpdated={handleDocumentsUpdated}
      />
    </div>
    </>
  )
}
