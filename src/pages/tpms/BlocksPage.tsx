import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { TPMS_SUBJECTS, DAYS, PERIODS, type TpmsBlock } from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', overflow: 'hidden' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }

const BLOCK_BG_PALETTE = ['#EEF3FF', '#D1FAE5', '#EDE9FE', '#FFF6E0', '#E6F4FF', '#FFF0F1']

function mapBlock(r: Record<string, unknown>): TpmsBlock {
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    day: (r.day as string) ?? 'Monday',
    period: (r.period as string) ?? 'Block 1',
    time: (r.time as string) ?? '',
    duration: (r.duration as number) ?? 90,
    subject: (r.subject as string) ?? '',
    cohort: (r.cohort as string) ?? '',
    coachId: (r.coach_id as string) ?? '',
    managerId: (r.manager_id as string) ?? '',
    room: (r.room as string) ?? '',
    maxStudents: (r.max_students as number) ?? 25,
    notes: (r.notes as string) ?? '',
  }
}

function BlockModal({ block, cohorts, coaches, onClose, onSave, onDelete }: {
  block: TpmsBlock | null
  cohorts: string[]
  coaches: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: Omit<TpmsBlock, 'id'>, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: block?.name ?? '',
    day: block?.day ?? 'Monday',
    period: block?.period ?? 'Block 1',
    time: block?.time ?? '',
    duration: block?.duration ?? 90,
    subject: block?.subject ?? '',
    cohort: block?.cohort ?? '',
    coachId: block?.coachId ?? '',
    managerId: block?.managerId ?? '',
    room: block?.room ?? '',
    maxStudents: block?.maxStudents ?? 25,
    notes: block?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.subject && !form.name) { alert('Block needs a subject or name'); return }
    setSaving(true)
    await onSave(form as Omit<TpmsBlock, 'id'>, block?.id)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 620, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🟦 {block ? 'Edit' : 'New'} Block</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Configure block schedule · assign cohort & subjects</div>
        </div>
        <div style={{ padding: '22px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Block Name / Label</label><input value={form.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="e.g. Morning Science Block" /></div>
          <div><label style={lbl}>Day</label>
            <select value={form.day} onChange={e => set('day', e.target.value)} style={inp}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Period</label>
            <select value={form.period} onChange={e => set('period', e.target.value)} style={inp}>
              {PERIODS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Time Slot</label><input value={form.time} onChange={e => set('time', e.target.value)} style={inp} placeholder="08:00 – 09:30" /></div>
          <div><label style={lbl}>Duration (mins)</label><input type="number" value={form.duration} onChange={e => set('duration', parseInt(e.target.value) || 90)} min={15} max={300} style={inp} /></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Subject</label>
            <select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>
              <option value="">— Select —</option>
              {TPMS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', background: '#F0FFF4', borderRadius: 8, padding: 10 }}>
            <label style={{ ...lbl, color: '#059669' }}>👥 Assigned Cohort</label>
            <select value={form.cohort} onChange={e => set('cohort', e.target.value)} style={{ ...inp, borderColor: '#D1FAE5' }}>
              <option value="">— None —</option>
              {cohorts.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', background: '#F0FFF4', borderRadius: 8, padding: 10 }}>
            <label style={{ ...lbl, color: '#059669' }}>🟢 Success Coach</label>
            <select value={form.coachId} onChange={e => set('coachId', e.target.value)} style={{ ...inp, borderColor: '#D1FAE5' }}>
              <option value="">— Not Assigned —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', background: '#FAF5FF', borderRadius: 8, padding: 10 }}>
            <label style={{ ...lbl, color: '#7C3AED' }}>🔵 Success Manager <span style={{ fontWeight: 400, color: '#AAB8CC' }}>(supervisor)</span></label>
            <select value={form.managerId} onChange={e => set('managerId', e.target.value)} style={{ ...inp, borderColor: '#EDE9FE' }}>
              <option value="">— Not Assigned —</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Room / Location</label><input value={form.room} onChange={e => set('room', e.target.value)} style={inp} placeholder="Room 101" /></div>
          <div><label style={lbl}>Max Students</label><input type="number" value={form.maxStudents} onChange={e => set('maxStudents', parseInt(e.target.value) || 25)} min={1} style={inp} /></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Additional notes…" /></div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #E4EAF2' }}>
            <div>{block && onDelete && <button onClick={() => { if (confirm('Delete this block?')) onDelete(block.id).then(onClose) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}>🗑 Delete</button>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid #DDE6F0', background: '#F0F4FA', color: '#1A365E', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: '#1A365E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : '💾 Save Block'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BlocksPage() {
  const [blocks, setBlocks] = useState<TpmsBlock[]>([])
  const [cohorts, setCohorts] = useState<string[]>([])
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  const [modal, setModal] = useState<{ open: boolean; block: TpmsBlock | null }>({ open: false, block: null })

  async function load() {
    const [br, sr, cr] = await Promise.all([
      supabase.from('timetable_blocks').select('*').order('created_at', { ascending: true }),
      supabase.from('settings').select('cohorts').single(),
      supabase.from('profiles').select('id,full_name').in('role', ['coach', 'teacher', 'principal', 'staff']).order('full_name'),
    ])
    if (br.data) setBlocks(br.data.map(r => mapBlock(r as Record<string, unknown>)))
    if (sr.data?.cohorts) {
      const raw = sr.data.cohorts as unknown[]
      if (raw.length === 1 && typeof raw[0] === 'string' && (raw[0] as string).startsWith('[')) {
        try { const p = JSON.parse(raw[0] as string); if (Array.isArray(p)) { setCohorts(p.map(String).filter(Boolean)); } } catch { setCohorts(raw.map(String).filter(Boolean)) }
      } else { setCohorts(raw.map(String).filter(Boolean)) }
    }
    if (cr.data) setCoaches(cr.data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.full_name as string) || 'Unknown' })))
  }
  useEffect(() => { load() }, [])

  async function saveBlock(data: Omit<TpmsBlock, 'id'>, id?: string) {
    const row = { name: data.name, day: data.day, period: data.period, time: data.time, duration: data.duration, subject: data.subject, cohort: data.cohort, coach_id: data.coachId, manager_id: data.managerId, room: data.room, max_students: data.maxStudents, notes: data.notes }
    if (id) await supabase.from('timetable_blocks').update(row).eq('id', id)
    else await supabase.from('timetable_blocks').insert(row)
    await load()
  }
  async function deleteBlock(id: string) { await supabase.from('timetable_blocks').delete().eq('id', id); setBlocks(prev => prev.filter(b => b.id !== id)) }

  // Stats
  const cohortSet = useMemo(() => new Set(blocks.map(b => b.cohort).filter(Boolean)), [blocks])
  const coachSet = useMemo(() => new Set(blocks.map(b => b.coachId).filter(Boolean)), [blocks])

  // Group by cohort for cards
  const byCohort = useMemo(() => {
    const g: Record<string, TpmsBlock[]> = {}
    blocks.forEach(b => { const k = b.cohort || '(No Cohort)'; if (!g[k]) g[k] = []; g[k].push(b) })
    return g
  }, [blocks])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>🟦 Blocks / Timetable</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Create and manage class blocks. Assign cohorts, success coaches and managers.</div>
        </div>
        <button onClick={() => setModal({ open: true, block: null })} style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Block</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[['Total Blocks', blocks.length, '#1A365E'], ['Cohorts', cohortSet.size, '#059669'], ['Coaches', coachSet.size, '#0EA5E9'], ['Managers Assigned', new Set(blocks.map(b => b.managerId).filter(Boolean)).size, '#7C3AED']].map(([l, v, c]) => (
          <div key={l as string} style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1.5px solid #E4EAF2', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Weekly timetable grid */}
      {blocks.length > 0 && (
        <div style={card}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>📅 Weekly Block Overview</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', background: '#F7F9FC', border: '1px solid #E4EAF2', fontSize: 10, color: '#7A92B0', textAlign: 'left', whiteSpace: 'nowrap' }}>Block / Period</th>
                  {DAYS.map(d => <th key={d} style={{ padding: '8px 10px', background: '#F7F9FC', border: '1px solid #E4EAF2', fontSize: 10, fontWeight: 800, color: '#1A365E', textAlign: 'center' }}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((per, pi) => (
                  <tr key={per} style={{ background: pi % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                    <td style={{ padding: '7px 12px', border: '1px solid #E4EAF2', fontWeight: 700, color: '#3D5475', whiteSpace: 'nowrap', fontSize: 10 }}>{per}</td>
                    {DAYS.map(day => {
                      const cell = blocks.filter(b => b.day === day && b.period === per)
                      return (
                        <td key={day} style={{ padding: 4, border: '1px solid #E4EAF2', verticalAlign: 'top', minWidth: 110 }}>
                          {cell.map((b) => (
                            <div key={b.id} onClick={() => setModal({ open: true, block: b })} style={{ background: BLOCK_BG_PALETTE[blocks.indexOf(b) % BLOCK_BG_PALETTE.length], borderRadius: 6, padding: '5px 7px', marginBottom: 2, cursor: 'pointer', border: '1px solid rgba(0,0,0,.06)' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E' }}>{b.subject || b.name || '—'}</div>
                              {b.cohort && <div style={{ fontSize: 9, color: '#059669', fontWeight: 700 }}>👥 {b.cohort}</div>}
                              {b.coachId && <div style={{ fontSize: 9, color: '#7A92B0' }}>🟢 {b.coachId}</div>}
                              {b.time && <div style={{ fontSize: 9, color: '#AAB8CC' }}>⏰ {b.time}</div>}
                            </div>
                          ))}
                          {cell.length === 0 && <div style={{ height: 40 }} />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block cards by cohort */}
      {blocks.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🟦</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>No blocks configured yet</div>
          <div style={{ fontSize: 12, maxWidth: 360, margin: '0 auto' }}>Create blocks for each cohort and assign success coaches and subjects. The timetable grid will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.keys(byCohort).sort().map(coh => {
            const cohBlocks = byCohort[coh]
            const coaches = [...new Set(cohBlocks.map(b => b.coachId).filter(Boolean))]
            const managers = [...new Set(cohBlocks.map(b => b.managerId).filter(Boolean))]
            return (
              <div key={coh} style={card}>
                <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>👥 {coh}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                      {coaches.length ? `🟢 ${coaches.join(', ')}` : 'No coach assigned'}
                      {managers.length ? ` · 🔵 ${managers.join(', ')}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,.15)', color: '#fff', padding: '3px 10px', borderRadius: 8 }}>{cohBlocks.length} blocks</span>
                </div>
                <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 8 }}>
                  {cohBlocks.map(b => (
                    <div key={b.id} style={{ border: '1.5px solid #E4EAF2', borderRadius: 10, padding: '11px 13px', background: '#F7F9FC' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 5 }}>{b.subject || b.name || '—'}</div>
                      <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 3 }}>
                        {b.day}{b.period ? ` · ${b.period}` : ''}{b.time ? ` · ${b.time}` : ''}
                      </div>
                      {b.coachId && <div style={{ fontSize: 10, color: '#059669', fontWeight: 600, marginTop: 4 }}>🟢 {b.coachId}</div>}
                      {b.managerId && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>🔵 {b.managerId}</div>}
                      {b.room && <div style={{ fontSize: 9, color: '#AAB8CC', marginTop: 3 }}>📍 {b.room}</div>}
                      <div style={{ display: 'flex', gap: 4, marginTop: 9 }}>
                        <button onClick={() => setModal({ open: true, block: b })} style={{ flex: 1, background: '#EEF3FF', border: 'none', color: '#1A365E', borderRadius: 7, fontSize: 10, fontWeight: 700, padding: 5, cursor: 'pointer' }}>✏️ Edit</button>
                        <button onClick={() => { if (confirm('Delete?')) deleteBlock(b.id) }} style={{ background: '#FFF0F1', border: 'none', color: '#D61F31', borderRadius: 7, fontSize: 10, padding: '5px 9px', cursor: 'pointer' }}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && <BlockModal block={modal.block} cohorts={cohorts} coaches={coaches} onClose={() => setModal({ open: false, block: null })} onSave={saveBlock} onDelete={deleteBlock} />}
    </div>
  )
}
