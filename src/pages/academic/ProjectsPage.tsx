import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const STATUSES = ['Not Started', 'In Progress', 'Submitted', 'Graded']
const STATUS_META: Record<string, { bg: string; tc: string }> = {
  'Not Started': { bg: '#F3F4F6', tc: '#7A92B0' },
  'In Progress': { bg: '#E6F4FF', tc: '#0369A1' },
  Submitted: { bg: '#FFF6E0', tc: '#B45309' },
  Graded: { bg: '#E8FBF0', tc: '#0E6B3B' },
}

interface Project {
  id: string; title: string; studentId: string; studentName: string; grade: string
  cohort: string; dueDate: string; status: string; score: number | null; feedback: string
}
interface Student { id: string; name: string; grade: string; cohort: string }

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const EMPTY = { title: '', studentId: '', cohort: '', dueDate: '', status: 'Not Started', score: '', feedback: '' }

function ProjectModal({ project, students, onClose, onSave, onDelete }: {
  project: Project | null; students: Student[]
  onClose: () => void; onSave: (f: typeof EMPTY, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(project ? { title: project.title, studentId: project.studentId, cohort: project.cohort, dueDate: project.dueDate, status: project.status, score: project.score !== null ? String(project.score) : '', feedback: project.feedback } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }

  function handleStudentChange(id: string) {
    const s = students.find(x => x.id === id)
    setForm(p => ({ ...p, studentId: id, cohort: s?.cohort ?? p.cohort }))
  }

  async function handleSave() { if (!form.title || !form.studentId) return; setSaving(true); await onSave(form, project?.id); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{project ? 'Edit Project' : 'New Project'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Student</label>
              <select value={form.studentId} onChange={e => handleStudentChange(e.target.value)} style={inp}>
                <option value="">Select…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Cohort</label><input value={form.cohort} onChange={e => set('cohort', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Due Date</label><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={lbl}>Score</label><input type="number" min={0} max={100} value={form.score} onChange={e => set('score', e.target.value)} style={inp} placeholder="—" /></div>
          </div>
          <div><label style={lbl}>Feedback</label><textarea value={form.feedback} onChange={e => set('feedback', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>{project && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(project.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState(''); const [filterStatus, setFilterStatus] = useState('All'); const [filterCohort, setFilterCohort] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null })

  async function load() {
    const [{ data: projs }, { data: studs }] = await Promise.all([
      supabase.from('pt_projects').select('*').order('due_date', { ascending: true }),
      supabase.from('students').select('id,first_name,last_name,grade,cohort').eq('status', 'Enrolled'),
    ])
    if (studs) setStudents(studs.map((s: Record<string, unknown>) => ({ id: s.id as string, name: `${s.first_name} ${s.last_name}`, grade: s.grade as string, cohort: (s.cohort as string) ?? '' })))
    if (projs && studs) {
      const sMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, `${s.first_name} ${s.last_name}` as string]))
      const gMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, s.grade as string]))
      setProjects(projs.map((r: Record<string, unknown>) => ({
        id: r.id as string, title: r.title as string,
        studentId: r.student_id as string,
        studentName: sMap.get(r.student_id as string) ?? '—',
        grade: gMap.get(r.student_id as string) ?? '—',
        cohort: (r.cohort as string) ?? '', dueDate: (r.due_date as string) ?? '',
        status: (r.status as string) ?? 'Not Started',
        score: r.score !== null && r.score !== undefined ? Number(r.score) : null,
        feedback: (r.feedback as string) ?? '',
      })))
    }
  }
  useEffect(() => { load() }, [])

  const cohorts = useMemo(() => Array.from(new Set(projects.map(p => p.cohort).filter(Boolean))).sort(), [projects])
  const submitted = projects.filter(p => p.status === 'Submitted' || p.status === 'Graded').length
  const avgScore = useMemo(() => {
    const graded = projects.filter(p => p.score !== null)
    if (!graded.length) return '—'
    return (graded.reduce((s, p) => s + (p.score ?? 0), 0) / graded.length).toFixed(1)
  }, [projects])

  const filtered = useMemo(() => projects.filter(p => {
    if (filterStatus !== 'All' && p.status !== filterStatus) return false
    if (filterCohort !== 'All' && p.cohort !== filterCohort) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.studentName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [projects, search, filterStatus, filterCohort])

  async function saveProject(form: typeof EMPTY, id?: string) {
    const payload = { title: form.title, student_id: form.studentId, cohort: form.cohort || null, due_date: form.dueDate || null, status: form.status, score: form.score !== '' ? parseFloat(form.score) : null, feedback: form.feedback }
    if (id) await supabase.from('pt_projects').update(payload).eq('id', id)
    else await supabase.from('pt_projects').insert(payload)
    await load()
  }
  async function deleteProject(id: string) { await supabase.from('pt_projects').delete().eq('id', id); setProjects(prev => prev.filter(p => p.id !== id)) }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>AWSC-27 Projects</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Student project tracking and grading</p></div>
        <button onClick={() => setModal({ open: true, project: null })} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New Project</button>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Projects', value: projects.length, color: '#1A365E' }, { label: 'Submitted / Graded', value: submitted, color: '#1DBD6A' }, { label: 'Avg Score', value: avgScore, color: '#0EA5E9' }].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects or students…" style={{ ...iStyle, width: 240 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={iStyle}><option value="All">All Statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <select value={filterCohort} onChange={e => setFilterCohort(e.target.value)} style={iStyle}><option value="All">All Cohorts</option>{cohorts.map(c => <option key={c}>{c}</option>)}</select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} projects</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Title</th><th style={th}>Student</th><th style={th}>Cohort</th>
            <th style={th}>Due Date</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'center' }}>Score</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => { const m = STATUS_META[p.status] ?? STATUS_META['Not Started']; return (
              <tr key={p.id}>
                <td style={{ ...td, fontWeight: 600 }}>{p.title}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{p.studentName}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{p.cohort || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{p.dueDate || '—'}</td>
                <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 12, fontWeight: 600 }}>{p.status}</span></td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{p.score !== null ? p.score : '—'}</td>
                <td style={td}><button onClick={() => setModal({ open: true, project: p })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            )})}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No projects yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && <ProjectModal project={modal.project} students={students} onClose={() => setModal({ open: false, project: null })} onSave={saveProject} onDelete={deleteProject} />}
    </div>
  )
}
