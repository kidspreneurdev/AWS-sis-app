import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const STATUSES = ['Ideation', 'Prototyping', 'Testing', 'Presenting', 'Complete']
const EMPTY = { title: '', description: '', status: 'Ideation', notes: '' }

interface LabProject { id: string; title: string; description: string; status: string; notes: string; created_at: string }

function Modal({ onClose, onSave }: { onClose: () => void; onSave: (f: typeof EMPTY) => Promise<void> }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.title) return; setSaving(true); await onSave(form); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Lab Project</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Project Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div><label style={lbl}>Notes / Updates</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      </div>
    </div>
  )
}

export function SPInnovationLabPage() {
  const { session } = useStudentPortal()
  const [projects, setProjects] = useState<LabProject[]>([])
  const [modal, setModal] = useState(false)

  async function load() {
    if (!session) return
    const { data } = await supabase.from('innovation_projects').select('*').eq('student_id', session.dbId).order('created_at', { ascending: false })
    if (data) setProjects(data as LabProject[])
  }
  useEffect(() => { load() }, [session])

  async function save(form: typeof EMPTY) {
    await supabase.from('innovation_projects').insert({ student_id: session!.dbId, title: form.title, description: form.description, status: form.status, notes: form.notes })
    await load()
  }

  const STATUS_COLORS: Record<string, { bg: string; tc: string }> = { Ideation: { bg: '#EDE9FE', tc: '#5B21B6' }, Prototyping: { bg: '#FFF3E0', tc: '#B45309' }, Testing: { bg: '#E6F4FF', tc: '#0369A1' }, Presenting: { bg: '#FEE2E2', tc: '#991B1B' }, Complete: { bg: '#E8FBF0', tc: '#0E6B3B' } }
  const STAGE_ORDER = ['Ideation', 'Prototyping', 'Testing', 'Presenting', 'Complete']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Innovation Lab</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Track your innovation and prototype projects</p></div>
        <button onClick={() => setModal(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ New Project</button>
      </div>

      {/* Kanban-style view */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, 1fr)`, gap: 12 }}>
        {STAGE_ORDER.map(stage => {
          const sc = STATUS_COLORS[stage]
          const stageProjects = projects.filter(p => p.status === stage)
          return (
            <div key={stage} style={{ background: '#F7F9FC', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: sc.tc, textTransform: 'uppercase' }}>{stage}</span>
                <span style={{ fontSize: 11, background: sc.bg, color: sc.tc, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{stageProjects.length}</span>
              </div>
              {stageProjects.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #E4EAF2' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', marginBottom: 4 }}>{p.title}</div>
                  {p.description && <div style={{ fontSize: 11, color: '#7A92B0' }}>{p.description.slice(0, 60)}…</div>}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>
          No lab projects yet. Start your first innovation project!
        </div>
      )}
      {modal && <Modal onClose={() => setModal(false)} onSave={save} />}
    </div>
  )
}
