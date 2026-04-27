import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { toast } from '@/lib/toast'

interface InterviewStudent {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  campus: string | null
  notesRaw: string
  intDate: string | null
  intTime: string | null
  intViewer: string | null
  intScore: number | null
  intNotes: string | null
  intCommittee: string | null
  decDate: string | null
  decNotes: string | null
}

function parseExt(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

function fromRow(r: Record<string, unknown>): InterviewStudent {
  const notesRaw = (r.notes as string) ?? '{}'
  const ext = parseExt(notesRaw)
  return {
    id:           r.id as string,
    firstName:    (r.first_name as string) ?? '',
    lastName:     (r.last_name as string) ?? '',
    grade:        r.grade != null ? String(r.grade) : null,
    status:       (r.status as string) ?? '',
    campus:       (r.campus as string) ?? null,
    notesRaw,
    intDate:      (ext.intDate as string) ?? null,
    intTime:      (ext.intTime as string) ?? null,
    intViewer:    (ext.intViewer as string) ?? null,
    intScore:     ext.intScore != null ? Number(ext.intScore) : null,
    intNotes:     (ext.intNotes as string) ?? null,
    intCommittee: (ext.intCommittee as string) ?? null,
    decDate:      (ext.decDate as string) ?? null,
    decNotes:     (ext.decNotes as string) ?? null,
  }
}

function scoreColor(s: number | null) {
  if (s === null) return '#7A92B0'
  if (s >= 8) return '#1DBD6A'
  if (s >= 6) return '#F5A623'
  return '#D61F31'
}

function iStatus(s: InterviewStudent): { label: string; bg: string; tc: string } {
  if (!s.intDate) return { label: 'Not Scheduled', bg: '#F3F4F6', tc: '#7A92B0' }
  const today = new Date().toISOString().slice(0, 10)
  if (s.intDate > today) return { label: 'Scheduled', bg: '#E6F4FF', tc: '#0EA5E9' }
  if (s.intScore !== null) return { label: 'Completed', bg: '#E8FBF0', tc: '#1DBD6A' }
  return { label: 'Pending Score', bg: '#FFF6E0', tc: '#F5A623' }
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }

function InterviewModal({ student, onClose, onSave }: {
  student: InterviewStudent
  onClose: () => void
  onSave: (id: string, data: Partial<InterviewStudent>) => Promise<void>
}) {
  const [form, setForm] = useState({
    intDate: student.intDate ?? '', intTime: student.intTime ?? '',
    intViewer: student.intViewer ?? '', intScore: student.intScore != null ? String(student.intScore) : '',
    intNotes: student.intNotes ?? '', intCommittee: student.intCommittee ?? '',
    decDate: student.decDate ?? '', decNotes: student.decNotes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    await onSave(student.id, {
      intDate: form.intDate || null, intTime: form.intTime || null,
      intViewer: form.intViewer || null,
      intScore: form.intScore !== '' ? Number(form.intScore) : null,
      intNotes: form.intNotes || null, intCommittee: form.intCommittee || null,
      decDate: form.decDate || null, decNotes: form.decNotes || null,
    })
    setSaving(false); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{student.firstName} {student.lastName}</div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 2 }}>Interview Details</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date</label><input type="date" value={form.intDate} onChange={e => set('intDate', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Time</label><input type="time" value={form.intTime} onChange={e => set('intTime', e.target.value)} style={inp} /></div>
          </div>
          <div><label style={lbl}>Interviewer</label><input value={form.intViewer} onChange={e => set('intViewer', e.target.value)} placeholder="Name of interviewer" style={inp} /></div>
          <div><label style={lbl}>Committee</label><input value={form.intCommittee} onChange={e => set('intCommittee', e.target.value)} placeholder="Committee members" style={inp} /></div>
          <div><label style={lbl}>Score (1–10)</label><input type="number" min={1} max={10} value={form.intScore} onChange={e => set('intScore', e.target.value)} placeholder="e.g. 8" style={inp} /></div>
          <div><label style={lbl}>Interview Notes</label><textarea value={form.intNotes} onChange={e => set('intNotes', e.target.value)} rows={3} placeholder="Notes from interview…" style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ borderTop: '1px solid #E4EAF2', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 10 }}>Decision</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Decision Date</label><input type="date" value={form.decDate} onChange={e => set('decDate', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Decision Notes</label><input value={form.decNotes} onChange={e => set('decNotes', e.target.value)} placeholder="e.g. Accepted" style={inp} /></div>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

export function InterviewsPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<InterviewStudent[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [editing, setEditing] = useState<InterviewStudent | null>(null)

  useEffect(() => {
    let q = supabase.from('students').select('id,first_name,last_name,grade,status,campus,notes')
      .in('status', ['Applied', 'Under Review', 'Accepted', 'Enrolled', 'Denied', 'Waitlisted'])
    if (cf) q = q.eq('campus', cf)
    q.then(({ data }) => { if (data) setStudents(data.map(r => fromRow(r as Record<string, unknown>))) })
  }, [cf])

  const filtered = useMemo(() => students.filter(s => {
    if (search && !`${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'All' && iStatus(s).label !== filterStatus) return false
    return true
  }), [students, search, filterStatus])

  const scheduled = students.filter(s => iStatus(s).label === 'Scheduled').length
  const completed = students.filter(s => iStatus(s).label === 'Completed').length
  const scores = students.map(s => s.intScore).filter((x): x is number => x !== null)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(1) : '—'

  async function saveInterview(id: string, data: Partial<InterviewStudent>) {
    const stu = students.find(s => s.id === id)
    if (!stu) return
    const ext = parseExt(stu.notesRaw)
    const merged = { ...ext, ...data }
    const newNotes = JSON.stringify(merged)
    await supabase.from('students').update({ notes: newNotes }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data, notesRaw: newNotes } : s))
    toast('Interview saved', 'ok')
  }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: students.length },
          { label: 'Scheduled', value: scheduled, color: '#0EA5E9' },
          { label: 'Completed', value: completed, color: '#1DBD6A' },
          { label: 'Avg Score', value: avgScore, sub: 'out of 10' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: (c as { color?: string }).color ?? '#1A365E', marginTop: 6 }}>{c.value}</div>
            {(c as { sub?: string }).sub && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{(c as { sub?: string }).sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" style={{ ...iStyle, width: 220 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={iStyle}>
          <option value="All">All Statuses</option>
          {['Not Scheduled', 'Scheduled', 'Pending Score', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} students</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F9FC' }}>
              <th style={th}>Student</th><th style={th}>Grade</th><th style={th}>Campus</th>
              <th style={th}>Date & Time</th><th style={th}>Interviewer</th>
              <th style={{ ...th, textAlign: 'center' }}>Score</th>
              <th style={th}>Status</th><th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const ist = iStatus(s)
              return (
                <tr key={s.id}
                  onClick={() => setEditing(s)}
                  style={{ cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#1A365E,#2D5A8E)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.firstName} {s.lastName}</span>
                    </div>
                  </td>
                  <td style={{ ...td, color: '#7A92B0' }}>{s.grade ?? '—'}</td>
                  <td style={{ ...td, color: '#7A92B0' }}>{s.campus ?? '—'}</td>
                  <td style={td}>{s.intDate ? `${s.intDate}${s.intTime ? ' · ' + s.intTime : ''}` : <span style={{ color: '#BDD0E8' }}>—</span>}</td>
                  <td style={{ ...td, color: '#7A92B0' }}>{s.intViewer ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {s.intScore !== null ? <span style={{ fontWeight: 700, fontSize: 15, color: scoreColor(s.intScore) }}>{s.intScore}</span> : <span style={{ color: '#BDD0E8' }}>—</span>}
                  </td>
                  <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, background: ist.bg, color: ist.tc, fontSize: 12, fontWeight: 600 }}>{ist.label}</span></td>
                  <td style={td} onClick={e => e.stopPropagation()}><button onClick={() => setEditing(s)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <InterviewModal student={editing} onClose={() => setEditing(null)} onSave={saveInterview} />}
    </div>
  )
}
