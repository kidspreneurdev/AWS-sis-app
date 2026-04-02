import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { mapPd, type TpmsPd } from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }

const PD_TYPES = ['Workshop', 'Conference', 'Peer Observation', 'Online Course', 'Book Study', 'Coaching', 'Other']

interface PdGoals { goal1: string; goal2: string; goal3: string; reflection: string }

function PdModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Omit<TpmsPd, 'id'>) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', type: 'Workshop', date: today, hours: '1', provider: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title) { alert('Activity title required'); return }
    setSaving(true)
    await onSave({ title: form.title, type: form.type, date: form.date, hours: parseFloat(form.hours) || 1, provider: form.provider, notes: form.notes })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#3B0764,#7C3AED)', padding: '16px 22px', borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>🎓 Log PD Activity</div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={lbl}>Activity Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} placeholder="Workshop name, course title…" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>PD Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>
                {PD_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} min="0.5" max="40" step="0.5" style={inp} /></div>
            <div><label style={lbl}>Provider / Facilitator</label><input value={form.provider} onChange={e => set('provider', e.target.value)} style={inp} placeholder="Organization, trainer…" /></div>
          </div>
          <div><label style={lbl}>Learning Takeaway / Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Key takeaways, application to classroom…" /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid #E4EAF2' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid #DDE6F0', background: '#F0F4FA', color: '#7A92B0', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : '💾 Log Activity'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfDevPage() {
  const [records, setRecords] = useState<TpmsPd[]>([])
  const [showModal, setShowModal] = useState(false)
  const [goals, setGoals] = useState<PdGoals>({ goal1: '', goal2: '', goal3: '', reflection: '' })
  const [goalsSaved, setGoalsSaved] = useState(false)

  useEffect(() => {
    supabase.from('tpms_ipdp').select('*').eq('owner_id', 'default').single()
      .then(({ data }) => { if (data) setGoals({ goal1: data.goal1??'', goal2: data.goal2??'', goal3: data.goal3??'', reflection: data.reflection??'' }) })
  }, [])

  async function load() {
    const { data } = await supabase.from('tpms').select('*').eq('type', 'pd').order('date', { ascending: false })
    if (data) setRecords(data.map(r => mapPd(r as Record<string, unknown>)))
  }
  useEffect(() => { load() }, [])

  async function savePd(data: Omit<TpmsPd, 'id'>) {
    const content = JSON.stringify({ pdType: data.type, hours: data.hours, provider: data.provider, notes: data.notes })
    await supabase.from('tpms').insert({ type: 'pd', title: data.title, date: data.date || null, status: null, content })
    await load()
  }
  async function deletePd(id: string) {
    await supabase.from('tpms').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function saveGoals() {
    await supabase.from('tpms_ipdp').upsert({ owner_id: 'default', ...goals }, { onConflict: 'owner_id' })
    setGoalsSaved(true)
    setTimeout(() => setGoalsSaved(false), 2000)
  }

  const totalHours = useMemo(() => records.reduce((s, r) => s + (r.hours || 0), 0), [records])

  const typeStats = useMemo(() => PD_TYPES.slice(0, 4).map(t => ({
    type: t,
    count: records.filter(r => r.type === t).length,
    hours: records.filter(r => r.type === t).reduce((s, r) => s + r.hours, 0),
  })), [records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>🎓 Professional Development</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{records.length} PD records · {totalHours.toFixed(1)} hours logged</div>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '9px 18px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Log PD Activity</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {typeStats.map(ts => (
          <div key={ts.type} style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{ts.type}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#7C3AED' }}>{ts.count}</div>
            <div style={{ fontSize: 10, color: '#7A92B0' }}>{ts.hours.toFixed(1)} hrs</div>
          </div>
        ))}
      </div>

      {/* IPDP */}
      <div style={{ ...card, padding: 16, border: '1.5px solid #E9D8FD' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📋 Individual Professional Development Plan (IPDP)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([['goal1', 'Goal 1 (aligned to AWS Teaching Framework)'], ['goal2', 'Goal 2'], ['goal3', 'Goal 3']] as const).map(([key, label]) => (
            <div key={key}>
              <label style={lbl}>{label}</label>
              <textarea value={goals[key]} onChange={e => setGoals(p => ({ ...p, [key]: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Click to edit…" />
            </div>
          ))}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Mid-Year Reflection</label>
            <textarea value={goals.reflection} onChange={e => setGoals(p => ({ ...p, reflection: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="How are you progressing toward your goals?" />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={saveGoals} style={{ padding: '7px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {goalsSaved ? '✓ Saved!' : '💾 Save IPDP Goals'}
            </button>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📝 PD Activity Log</div>
        {records.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#7A92B0', padding: 24, fontSize: 12 }}>No PD activities logged yet.</div>
        ) : records.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0F4FA' }}>
            <div style={{ minWidth: 36, height: 36, background: '#F3EFF9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{r.title}</div>
              <div style={{ fontSize: 10, color: '#7A92B0' }}>{r.type}{r.date ? ` · ${r.date}` : ''}{r.provider ? ` · ${r.provider}` : ''}</div>
              {r.notes && <div style={{ fontSize: 10, color: '#3D5475', marginTop: 2, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📋 {r.notes}</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#7C3AED' }}>{r.hours}</div>
              <div style={{ fontSize: 9, color: '#7A92B0' }}>hours</div>
            </div>
            <button onClick={() => { if (confirm('Delete this PD record?')) deletePd(r.id) }} style={{ padding: '3px 8px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 6, fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>🗑</button>
          </div>
        ))}
      </div>

      {/* Summary by type */}
      {records.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📊 PD Summary by Type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PD_TYPES.map(t => {
              const hrs = records.filter(r => r.type === t).reduce((s, r) => s + r.hours, 0)
              if (!hrs) return null
              const maxHrs = Math.max(...PD_TYPES.map(tt => records.filter(r => r.type === tt).reduce((s, r) => s + r.hours, 0)))
              const pct = maxHrs > 0 ? Math.round((hrs / maxHrs) * 100) : 0
              const cnt = records.filter(r => r.type === t).length
              return (
                <div key={t}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#3D5475', fontWeight: 600 }}>{t}</span>
                    <span style={{ fontWeight: 800, color: '#7C3AED' }}>{hrs.toFixed(1)}h · {cnt} session{cnt !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ background: '#F0F4FA', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#7C3AED', borderRadius: 4 }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#F3EFF9', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>Total PD Hours This Year</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#7C3AED' }}>{totalHours.toFixed(1)}</span>
          </div>
        </div>
      )}

      {showModal && <PdModal onClose={() => setShowModal(false)} onSave={savePd} />}
    </div>
  )
}
