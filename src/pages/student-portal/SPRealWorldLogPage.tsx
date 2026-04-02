import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const TYPES = ['Field Trip', 'Community Service', 'Industry Visit', 'Internship', 'Workshop', 'Conference', 'Research', 'Other']
const EMPTY = { date: '', type: 'Field Trip', location: '', description: '', hours: '' }

interface RWLog { id: string; date: string; type: string; location: string; description: string; hours: number; created_at: string }

function Modal({ onClose, onSave }: { onClose: () => void; onSave: (f: typeof EMPTY) => Promise<void> }) {
  const [form, setForm] = useState({ ...EMPTY, date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.description) return; setSaving(true); await onSave(form); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Log Real-World Activity</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Type</label><select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Hours</label><input type="number" value={form.hours} onChange={e => set('hours', e.target.value)} style={inp} placeholder="e.g. 3" /></div>
          </div>
          <div><label style={lbl}>Description / Reflection</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Log'}</button>
        </div>
      </div>
    </div>
  )
}

export function SPRealWorldLogPage() {
  const { session } = useStudentPortal()
  const [logs, setLogs] = useState<RWLog[]>([])
  const [modal, setModal] = useState(false)

  async function load() {
    if (!session) return
    const { data } = await supabase.from('real_world_activities').select('*').eq('student_id', session.dbId).order('date', { ascending: false })
    if (data) setLogs(data as RWLog[])
  }
  useEffect(() => { load() }, [session])

  async function save(form: typeof EMPTY) {
    await supabase.from('real_world_activities').insert({ student_id: session!.dbId, date: form.date, type: form.type, location: form.location, description: form.description, hours: form.hours ? Number(form.hours) : null })
    await load()
  }

  const totalHours = logs.reduce((s, l) => s + (l.hours ?? 0), 0)
  const TYPE_COLORS: Record<string, { bg: string; tc: string }> = { 'Field Trip': { bg: '#E6F4FF', tc: '#0369A1' }, 'Community Service': { bg: '#E8FBF0', tc: '#0E6B3B' }, Internship: { bg: '#EDE9FE', tc: '#5B21B6' }, Workshop: { bg: '#FFF3E0', tc: '#B45309' }, Conference: { bg: '#FEE2E2', tc: '#991B1B' } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Real-World Log</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Record learning experiences beyond the classroom</p></div>
        <button onClick={() => setModal(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Log Activity</button>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {[{ label: 'Activities', value: logs.length, color: '#1A365E' }, { label: 'Total Hours', value: totalHours, color: '#10B981' }].map(c => (
          <div key={c.label} style={{ ...card, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {logs.map(l => {
          const cm = TYPE_COLORS[l.type] ?? { bg: '#F3F4F6', tc: '#6B7280' }
          return (
            <div key={l.id} style={{ ...card, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cm.bg, color: cm.tc }}>{l.type}</span>
                  {l.location && <span style={{ fontSize: 12, color: '#7A92B0' }}>📍 {l.location}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {l.hours > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>{l.hours}h</span>}
                  <span style={{ fontSize: 11, color: '#7A92B0' }}>{new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#1A365E', margin: 0, lineHeight: 1.5 }}>{l.description}</p>
            </div>
          )
        })}
        {logs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>No activities logged yet.</div>}
      </div>
      {modal && <Modal onClose={() => setModal(false)} onSave={save} />}
    </div>
  )
}
