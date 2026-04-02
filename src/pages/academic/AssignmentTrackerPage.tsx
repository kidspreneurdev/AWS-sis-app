import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const SUBJECTS = ['English','Mathematics','Science','History','Foreign Language','PE','Arts','Elective','Reading','Writing','Social Studies','Music','Other']

interface Assignment {
  id: string; title: string; cohort: string; subject: string
  dueDate: string; maxScore: number; academicYear: string; createdBy: string
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const CURRENT_YEAR = new Date().getFullYear().toString()
const EMPTY = { title: '', cohort: '', subject: 'Mathematics', dueDate: '', maxScore: '100', academicYear: CURRENT_YEAR, createdBy: '' }

function AssignmentModal({ assignment, cohorts, onClose, onSave, onDelete }: {
  assignment: Assignment | null; cohorts: string[]
  onClose: () => void; onSave: (f: typeof EMPTY, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(assignment ? { title: assignment.title, cohort: assignment.cohort, subject: assignment.subject, dueDate: assignment.dueDate, maxScore: String(assignment.maxScore), academicYear: assignment.academicYear, createdBy: assignment.createdBy } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.title) return; setSaving(true); await onSave(form, assignment?.id); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{assignment ? 'Edit Assignment' : 'New Assignment'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Cohort</label>
              <select value={form.cohort} onChange={e => set('cohort', e.target.value)} style={inp}>
                <option value="">All cohorts</option>
                {cohorts.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Subject</label><select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Due Date</label><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Max Score</label><input type="number" min={0} value={form.maxScore} onChange={e => set('maxScore', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Academic Year</label><input value={form.academicYear} onChange={e => set('academicYear', e.target.value)} style={inp} /></div>
          </div>
          <div><label style={lbl}>Created By</label><input value={form.createdBy} onChange={e => set('createdBy', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between' }}>
          <div>{assignment && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(assignment.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssignmentTrackerPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [cohorts, setCohorts] = useState<string[]>([])
  const [search, setSearch] = useState(''); const [filterCohort, setFilterCohort] = useState('All'); const [filterSubject, setFilterSubject] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; assignment: Assignment | null }>({ open: false, assignment: null })

  async function load() {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('at_assignments').select('*').order('due_date', { ascending: true }),
      supabase.from('settings').select('cohorts').single(),
    ])
    if (data) setAssignments(data.map((r: Record<string, unknown>) => ({ id: r.id as string, title: r.title as string, cohort: (r.cohort as string) ?? '', subject: (r.subject as string) ?? '', dueDate: (r.due_date as string) ?? '', maxScore: Number(r.max_score) || 100, academicYear: (r.academic_year as string) ?? CURRENT_YEAR, createdBy: (r.created_by as string) ?? '' })))
    if (settings?.cohorts) setCohorts(settings.cohorts as string[])
  }
  useEffect(() => { load() }, [])

  const dueThisWeek = useMemo(() => {
    const now = new Date(); const week = new Date(now); week.setDate(week.getDate() + 7)
    return assignments.filter(a => { if (!a.dueDate) return false; const d = new Date(a.dueDate); return d >= now && d <= week }).length
  }, [assignments])
  const cohortsCovered = useMemo(() => new Set(assignments.map(a => a.cohort).filter(Boolean)).size, [assignments])

  const filtered = useMemo(() => assignments.filter(a => {
    if (filterCohort !== 'All' && a.cohort !== filterCohort) return false
    if (filterSubject !== 'All' && a.subject !== filterSubject) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [assignments, search, filterCohort, filterSubject])

  async function saveAssignment(form: typeof EMPTY, id?: string) {
    const payload = { title: form.title, cohort: form.cohort || null, subject: form.subject, due_date: form.dueDate || null, max_score: parseFloat(form.maxScore) || 100, academic_year: form.academicYear, created_by: form.createdBy }
    if (id) await supabase.from('at_assignments').update(payload).eq('id', id)
    else await supabase.from('at_assignments').insert(payload)
    await load()
  }
  async function deleteAssignment(id: string) { await supabase.from('at_assignments').delete().eq('id', id); setAssignments(prev => prev.filter(a => a.id !== id)) }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Assignment Tracker</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Track assignments by cohort and subject</p></div>
        <button onClick={() => setModal({ open: true, assignment: null })} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New Assignment</button>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Assignments', value: assignments.length, color: '#1A365E' }, { label: 'Due This Week', value: dueThisWeek, color: '#D61F31' }, { label: 'Cohorts Covered', value: cohortsCovered, color: '#0EA5E9' }].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments…" style={{ ...iStyle, width: 220 }} />
        <select value={filterCohort} onChange={e => setFilterCohort(e.target.value)} style={iStyle}><option value="All">All Cohorts</option>{cohorts.map(c => <option key={c}>{c}</option>)}</select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={iStyle}><option value="All">All Subjects</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} assignments</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Title</th><th style={th}>Cohort</th><th style={th}>Subject</th>
            <th style={th}>Due Date</th><th style={{ ...th, textAlign: 'center' }}>Max Score</th><th style={th}>Year</th><th style={th}>Created By</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id}>
                <td style={{ ...td, fontWeight: 600 }}>{a.title}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{a.cohort || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{a.subject}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{a.dueDate || '—'}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{a.maxScore}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{a.academicYear}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{a.createdBy || '—'}</td>
                <td style={td}><button onClick={() => setModal({ open: true, assignment: a })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No assignments yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && <AssignmentModal assignment={modal.assignment} cohorts={cohorts} onClose={() => setModal({ open: false, assignment: null })} onSave={saveAssignment} onDelete={deleteAssignment} />}
    </div>
  )
}
