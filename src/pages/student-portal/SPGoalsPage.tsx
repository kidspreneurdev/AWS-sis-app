import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const STATUS_META: Record<string, { bg: string; tc: string }> = {
  Active:   { bg: '#E6F4FF', tc: '#0369A1' },
  Complete: { bg: '#E8FBF0', tc: '#0E6B3B' },
  Paused:   { bg: '#FFF3E0', tc: '#B45309' },
}
const EMPTY = { goal: '', deadline: '', status: 'Active', reflection: '' }

interface Goal { id: string; goal: string; deadline: string; status: string; reflection: string; created_at: string }

function Modal({ onClose, onSave }: { onClose: () => void; onSave: (f: typeof EMPTY) => Promise<void> }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.goal) return; setSaving(true); await onSave(form); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Goal</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Goal</label><textarea value={form.goal} onChange={e => set('goal', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="What do you want to achieve?" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Deadline</label><input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>{Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label style={lbl}>Initial Reflection</label><textarea value={form.reflection} onChange={e => set('reflection', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Why is this important to you?" /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save Goal'}</button>
        </div>
      </div>
    </div>
  )
}

export function SPGoalsPage() {
  const { session } = useStudentPortal()
  const [goals, setGoals] = useState<Goal[]>([])
  const [modal, setModal] = useState(false)

  async function load() {
    if (!session) return
    const { data } = await supabase.from('goals').select('*').eq('student_id', session.dbId).order('created_at', { ascending: false })
    if (data) setGoals(data as Goal[])
  }
  useEffect(() => { load() }, [session])

  async function saveGoal(form: typeof EMPTY) {
    await supabase.from('goals').insert({ student_id: session!.dbId, goal: form.goal, deadline: form.deadline || null, status: form.status, reflection: form.reflection })
    await load()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('goals').update({ status }).eq('id', id)
    setGoals(p => p.map(g => g.id === id ? { ...g, status } : g))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Goals & Reflections</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Track your personal and academic goals</p></div>
        <button onClick={() => setModal(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New Goal</button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {[{ label: 'Active', count: goals.filter(g => g.status === 'Active').length, color: '#3B82F6' }, { label: 'Complete', count: goals.filter(g => g.status === 'Complete').length, color: '#10B981' }].map(c => (
          <div key={c.label} style={{ ...card, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.count}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {goals.map(g => {
          const sm = STATUS_META[g.status] ?? { bg: '#F3F4F6', tc: '#6B7280' }
          return (
            <div key={g.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.tc }}>{g.status}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {g.deadline && <span style={{ fontSize: 11, color: '#7A92B0' }}>Due {new Date(g.deadline).toLocaleDateString()}</span>}
                  {g.status !== 'Complete' && <button onClick={() => updateStatus(g.id, 'Complete')} style={{ fontSize: 11, color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Mark done</button>}
                </div>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A365E', lineHeight: 1.5, margin: '0 0 8px' }}>{g.goal}</p>
              {g.reflection && <p style={{ fontSize: 12, color: '#7A92B0', fontStyle: 'italic', margin: 0 }}>"{g.reflection}"</p>}
            </div>
          )
        })}
        {goals.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>No goals set yet. Create your first goal!</div>}
      </div>
      {modal && <Modal onClose={() => setModal(false)} onSave={saveGoal} />}
    </div>
  )
}
