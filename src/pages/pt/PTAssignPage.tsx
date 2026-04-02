import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PTM, PTQD, PTSTAT, PTDELIV, STAT_META, mapAssignment, type PTAssignment, type PTMethodology } from './ptConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface Student { id: string; fullName: string; cohort: string; firstName: string }

function initials(name: string) { return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() }

function PTModal({ sid, mn, students, assignments, onClose, onSave }: {
  sid: string; mn: number; students: Student[]; assignments: PTAssignment[]
  onClose: () => void; onSave: () => void
}) {
  const m = PTM.find(x => x.n === mn)!
  const stu = students.find(s => s.id === sid)
  const ex = assignments.find(a => a.student_id === sid && a.methodology_n === mn)
  const [form, setForm] = useState({
    status: ex?.status ?? 'Assigned',
    title: ex?.title || (m.name + " — " + (stu?.firstName ?? '') + "'s Project"),
    brief: ex?.brief ?? '',
    due: ex?.due || PTQD[m.q].end,
    deliv: ex?.deliv ?? 'Report',
    wurl: ex?.wurl ?? '',
    reflect: ex?.reflect ?? '',
    cnotes: ex?.cnotes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const fi: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lb: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }

  async function handleSave() {
    setSaving(true)
    const payload = {
      student_id: sid, methodology_n: mn, quarter: m.q,
      status: form.status, title: form.title, brief: form.brief,
      due: form.due || null, deliv: form.deliv, wurl: form.wurl,
      reflect: form.reflect, cnotes: form.cnotes,
      ptype: m.type, mastery: ex?.mastery ?? false, score: ex?.score ?? null, yr: '2024-25',
    }
    if (ex) await supabase.from('pt_assignments').update(payload).eq('id', ex.id)
    else await supabase.from('pt_assignments').insert(payload)
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.72)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 580, boxShadow: '0 28px 70px rgba(0,0,0,.35)', margin: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg,${m.col},${m.col}BB)`, padding: '16px 22px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{m.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{stu?.fullName} · {m.type === 'C' ? 'Collaborative' : 'Independent'} · {m.q} · #{mn}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lb}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={fi}>
                {PTSTAT.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={lb}>Project Title</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={fi} />
            </div>
          </div>
          <div><label style={lb}>📋 Project Brief <span style={{ fontWeight: 400, color: '#7A92B0', textTransform: 'none' }}>(shared with student)</span></label>
            <textarea value={form.brief} onChange={e => setForm(p => ({ ...p, brief: e.target.value }))} rows={3} placeholder="Describe the project challenge, deliverables, and assessment criteria..." style={{ ...fi, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lb}>Due Date</label><input type="date" value={form.due} onChange={e => setForm(p => ({ ...p, due: e.target.value }))} style={fi} /></div>
            <div><label style={lb}>Deliverable Type</label>
              <select value={form.deliv} onChange={e => setForm(p => ({ ...p, deliv: e.target.value }))} style={fi}>
                {PTDELIV.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 12, border: '1.5px solid #E4EAF2' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>📂 Student Work</div>
            <div style={{ marginBottom: 8 }}><label style={lb}>Work URL <span style={{ fontWeight: 400, textTransform: 'none' }}>(Drive, video, website…)</span></label>
              <input type="url" value={form.wurl} onChange={e => setForm(p => ({ ...p, wurl: e.target.value }))} placeholder="https://drive.google.com/..." style={fi} />
            </div>
            <div><label style={lb}>Student Reflection / Coach Notes</label>
              <textarea value={form.reflect} onChange={e => setForm(p => ({ ...p, reflect: e.target.value }))} rows={3} placeholder="Record student's reflection, key observations..." style={{ ...fi, resize: 'vertical' }} />
            </div>
          </div>
          <div><label style={lb}>🔒 Internal Coach Notes</label>
            <textarea value={form.cnotes} onChange={e => setForm(p => ({ ...p, cnotes: e.target.value }))} rows={2} placeholder="Private notes for coaching, parent comms, next steps..." style={{ ...fi, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #E4EAF2' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: m.col, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💾 {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PTAssignPage() {
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [mode, setMode] = useState<'cohort' | 'individual' | 'group'>('cohort')
  const [selQ, setSelQ] = useState('Q1')
  const [selStudent, setSelStudent] = useState('')
  const [modal, setModal] = useState<{ sid: string; mn: number } | null>(null)
  const [briefs, setBriefs] = useState<Record<number, string>>({})
  const [dues, setDues] = useState<Record<number, string>>({})
  const [grpMn, setGrpMn] = useState(3)
  const [grpBrief, setGrpBrief] = useState('')
  const [grpDue, setGrpDue] = useState(PTQD['Q1'].end)
  const [grpDeliv, setGrpDeliv] = useState('Exhibition')
  const [grpMembers, setGrpMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: a }, { data: st }] = await Promise.all([
      supabase.from('pt_assignments').select('*'),
      supabase.from('students').select('id,full_name,cohort').eq('status', 'enrolled').order('full_name'),
    ])
    if (a) setAssignments(a.map(mapAssignment))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', cohort: (r.cohort as string) ?? '', firstName: ((r.full_name as string) ?? '').split(' ')[0] ?? '' })))
  }, [])

  useEffect(() => { load() }, [load])

  const showM = useMemo(() => PTM.filter(m => selQ === 'All' || m.q === selQ), [selQ])
  const showS = useMemo(() => mode === 'individual' && selStudent ? students.filter(s => s.id === selStudent) : students, [mode, selStudent, students])
  const colM = useMemo(() => PTM.filter(m => m.type === 'C' && (selQ === 'All' || m.q === selQ)), [selQ])

  const fi: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, color: '#1A365E', background: '#fff', width: '100%', boxSizing: 'border-box' }

  async function assignAll(m: PTMethodology) {
    setSaving(true)
    const brief = briefs[m.n] ?? ''
    const due = dues[m.n] || PTQD[m.q].end
    for (const stu of students) {
      const ex = assignments.find(x => x.student_id === stu.id && x.methodology_n === m.n)
      const rec = {
        student_id: stu.id, methodology_n: m.n, quarter: m.q, ptype: m.type,
        title: m.name + " — " + stu.firstName + "'s Project",
        brief, due, deliv: m.type === 'C' ? 'Exhibition' : 'Report',
        status: ex && ex.status !== 'Not Assigned' ? ex.status : 'Assigned',
        wurl: ex?.wurl ?? '', reflect: ex?.reflect ?? '', cnotes: ex?.cnotes ?? '',
        score: ex?.score ?? null, mastery: ex?.mastery ?? false, yr: '2024-25',
      }
      if (ex) await supabase.from('pt_assignments').update(rec).eq('id', ex.id)
      else await supabase.from('pt_assignments').insert(rec)
    }
    await load()
    setSaving(false)
  }

  async function createGroup() {
    if (grpMembers.length < 3 || grpMembers.length > 5) return
    const m = PTM.find(x => x.n === grpMn)!
    setSaving(true)
    for (const sid of grpMembers) {
      const ex = assignments.find(x => x.student_id === sid && x.methodology_n === grpMn)
      const rec = {
        student_id: sid, methodology_n: grpMn, quarter: m.q, ptype: 'C',
        title: m.name + ' — Group Project', brief: grpBrief, due: grpDue,
        deliv: grpDeliv, status: 'Assigned', wurl: '', reflect: '', cnotes: grpBrief,
        score: null, mastery: false, yr: '2024-25',
      }
      if (ex) await supabase.from('pt_assignments').update(rec).eq('id', ex.id)
      else await supabase.from('pt_assignments').insert(rec)
    }
    await load()
    setGrpMembers([])
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📋 Assign Projects to Students</div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['cohort', '🏫 Whole Cohort', 'Same project assigned to all students'], ['individual', '👤 Individual', 'Customise per student'], ['group', '🤝 Group / Collaborative', 'Team assignment (3–5 students)']] as const).map(([v, l, d]) => (
          <button key={v} onClick={() => setMode(v)} style={{ flex: 1, padding: '10px 12px', background: mode === v ? '#1A365E' : '#fff', color: mode === v ? '#fff' : '#64748B', border: `2px solid ${mode === v ? '#1A365E' : '#E4EAF2'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{d}</div>
          </button>
        ))}
      </div>

      {/* Quarter filter */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0' }}>Quarter:</span>
        {['All', 'Q1', 'Q2', 'Q3', 'Q4'].map(q => (
          <button key={q} onClick={() => setSelQ(q)} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${selQ === q ? '#1A365E' : '#E4EAF2'}`, background: selQ === q ? '#1A365E' : '#fff', color: selQ === q ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{q}</button>
        ))}
      </div>

      {mode === 'group' ? (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 14 }}>🤝 Create Group Assignment</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Collaborative Methodology</label>
                <select value={grpMn} onChange={e => { setGrpMn(Number(e.target.value)); setGrpDue(PTQD[PTM.find(x => x.n === Number(e.target.value))?.q ?? 'Q1'].end) }} style={fi}>
                  {colM.map(m => <option key={m.n} value={m.n}>{m.icon} {m.name} ({m.q})</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Project Brief</label>
                <textarea value={grpBrief} onChange={e => setGrpBrief(e.target.value)} rows={4} placeholder="Describe the project challenge, expected deliverables, key milestones..." style={{ ...fi, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Due Date</label>
                  <input type="date" value={grpDue} onChange={e => setGrpDue(e.target.value)} style={fi} />
                </div>
                <div><label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Deliverable</label>
                  <select value={grpDeliv} onChange={e => setGrpDeliv(e.target.value)} style={fi}>
                    {PTDELIV.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 8 }}>Select Team Members (3–5 required)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, background: '#F7F9FC', padding: 10, borderRadius: 8, border: '1.5px solid #E4EAF2', maxHeight: 260, overflowY: 'auto' }}>
                {students.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '5px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1A365E' }}>
                    <input type="checkbox" checked={grpMembers.includes(s.id)} onChange={e => setGrpMembers(p => e.target.checked ? [...p, s.id] : p.filter(x => x !== s.id))} style={{ width: 14, height: 14 }} />
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{initials(s.fullName)}</div>
                    {s.fullName}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 10, color: grpMembers.length >= 3 && grpMembers.length <= 5 ? '#059669' : '#D61F31', marginTop: 6 }}>{grpMembers.length} selected (need 3–5)</div>
              <button onClick={createGroup} disabled={saving || grpMembers.length < 3 || grpMembers.length > 5} style={{ marginTop: 12, padding: '10px 20px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>🤝 Create Group Assignment</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {mode === 'individual' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0' }}>Student:</span>
              <select value={selStudent} onChange={e => setSelStudent(e.target.value)} style={{ padding: '7px 12px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontWeight: 600, flex: 1, maxWidth: 320 }}>
                <option value="">— Select student —</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
          )}

          {mode === 'cohort' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
              {showM.map(m => {
                const ta = students.filter(s => { const a = assignments.find(x => x.student_id === s.id && x.methodology_n === m.n); return a && a.status !== 'Not Assigned' }).length
                const td = students.filter(s => { const a = assignments.find(x => x.student_id === s.id && x.methodology_n === m.n); return a && a.status === 'Approved' }).length
                const done = ta >= students.length && students.length > 0
                return (
                  <div key={m.n} style={{ padding: 14, border: `2px solid ${done ? m.col : '#E4EAF2'}`, borderRadius: 12, background: done ? m.col + '08' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: m.col + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{m.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>#{m.n} · {m.type === 'C' ? 'Collaborative' : 'Independent'} · {m.q}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>{m.name}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '5px 8px', background: done ? '#DCFCE7' : '#F0F4FA', borderRadius: 8, minWidth: 40 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: done ? '#059669' : '#7A92B0' }}>{ta}</div>
                        <div style={{ fontSize: 8, color: '#94A3B8' }}>/{students.length}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                      {td > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#F0FDF4', color: '#059669', padding: '2px 8px', borderRadius: 4 }}>✓ {td} approved</span>}
                      {m.type === 'C' && <span style={{ fontSize: 9, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 4 }}>🤝 Collaborative</span>}
                    </div>
                    <textarea
                      value={briefs[m.n] ?? ''}
                      onChange={e => setBriefs(p => ({ ...p, [m.n]: e.target.value }))}
                      placeholder="Project brief for students (optional)..."
                      style={{ width: '100%', padding: '7px 9px', border: '1.5px solid #E4EAF2', borderRadius: 7, fontSize: 11, resize: 'none', height: 56, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="date" value={dues[m.n] ?? PTQD[m.q].end} onChange={e => setDues(p => ({ ...p, [m.n]: e.target.value }))} style={{ padding: '5px 8px', border: '1.5px solid #E4EAF2', borderRadius: 7, fontSize: 10, flex: 1 }} />
                      <button onClick={() => assignAll(m)} disabled={saving} style={{ padding: '7px 14px', background: m.col, color: '#fff', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>{done ? '↺ Re-assign' : '📋 Assign All'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Status matrix */}
          {showS.length > 0 && showM.length > 0 && (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>📊 Status Matrix — click any cell to edit</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600, fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: '#1A365E' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,.7)', fontSize: 9, textTransform: 'uppercase', position: 'sticky', left: 0, background: '#1A365E', minWidth: 150 }}>Student</th>
                      {showM.map(m => <th key={m.n} style={{ padding: '5px 4px', textAlign: 'center', color: 'rgba(255,255,255,.7)', minWidth: 26 }} title={`${m.name} (${m.q})`}>{m.icon}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {showS.map((stu, ri) => (
                      <tr key={stu.id} style={{ background: ri % 2 ? '#F9FAFB' : '#fff' }}>
                        <td style={{ padding: '7px 12px', position: 'sticky', left: 0, background: ri % 2 ? '#F9FAFB' : '#fff', borderRight: '1px solid #E4EAF2', fontWeight: 700, color: '#1A365E', fontSize: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>{initials(stu.fullName)}</div>
                            {stu.fullName}
                          </div>
                        </td>
                        {showM.map(m => {
                          const a = assignments.find(x => x.student_id === stu.id && x.methodology_n === m.n)
                          const st = a?.status ?? 'Not Assigned'
                          const cx = STAT_META[st] ?? { ic: '·', tc: '#D4D4D4', bg: '#F1F5F9' }
                          return (
                            <td key={m.n} style={{ padding: '3px 2px', textAlign: 'center' }} title={`${stu.fullName} — ${m.name}: ${st}`}>
                              <button onClick={() => setModal({ sid: stu.id, mn: m.n })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: cx.tc, width: '100%', padding: '4px 0' }}>{cx.ic}</button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 10, fontSize: 9, fontWeight: 700, marginTop: 8, flexWrap: 'wrap', color: '#64748B' }}>
                  {[['·', 'Not Assigned', '#D4D4D4'], ['○', 'Assigned', '#3B82F6'], ['◑', 'In Progress', '#7C3AED'], ['◕', 'Work Uploaded', '#D97706'], ['✓', 'Approved', '#059669'], ['↩', 'Resubmit', '#D61F31']].map(l => (
                    <span key={l[1]} style={{ color: l[2] }}>{l[0]} {l[1]}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <PTModal sid={modal.sid} mn={modal.mn} students={students} assignments={assignments} onClose={() => setModal(null)} onSave={load} />
      )}
    </div>
  )
}
