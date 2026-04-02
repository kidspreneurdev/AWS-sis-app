import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const CATEGORIES = ['Academic', 'Creative', 'Community', 'Innovation', 'Leadership', 'Personal', 'Other']
const EMPTY = { title: '', category: 'Academic', description: '', url: '' }

interface PortfolioItem { id: string; title: string; category: string; description: string; url: string; created_at: string }

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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Add Portfolio Item</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Category</label><select value={form.category} onChange={e => set('category', e.target.value)} style={inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div><label style={lbl}>Link / URL (optional)</label><input value={form.url} onChange={e => set('url', e.target.value)} style={inp} placeholder="https://…" /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Add'}</button>
        </div>
      </div>
    </div>
  )
}

export function SPPortfolioPage() {
  const { session } = useStudentPortal()
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [modal, setModal] = useState(false)

  async function load() {
    if (!session) return
    const { data } = await supabase.from('portfolio_items').select('*').eq('student_id', session.dbId).order('created_at', { ascending: false })
    if (data) setItems(data as PortfolioItem[])
  }
  useEffect(() => { load() }, [session])

  async function save(form: typeof EMPTY) {
    await supabase.from('portfolio_items').insert({ student_id: session!.dbId, title: form.title, category: form.category, description: form.description, url: form.url || null })
    await load()
  }

  async function deleteItem(id: string) {
    await supabase.from('portfolio_items').delete().eq('id', id)
    setItems(p => p.filter(i => i.id !== id))
  }

  const CAT_COLORS: Record<string, { bg: string; tc: string }> = { Academic: { bg: '#E6F4FF', tc: '#0369A1' }, Creative: { bg: '#EDE9FE', tc: '#5B21B6' }, Community: { bg: '#E8FBF0', tc: '#0E6B3B' }, Innovation: { bg: '#FFF3E0', tc: '#B45309' }, Leadership: { bg: '#FEE2E2', tc: '#991B1B' } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Portfolio</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Showcase your best work and achievements</p></div>
        <button onClick={() => setModal(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Add Item</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {items.map(item => {
          const cm = CAT_COLORS[item.category] ?? { bg: '#F3F4F6', tc: '#6B7280' }
          return (
            <div key={item.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cm.bg, color: cm.tc }}>{item.category}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#7A92B0' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                  <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>{item.title}</div>
              {item.description && <p style={{ fontSize: 12, color: '#7A92B0', lineHeight: 1.5, margin: 0 }}>{item.description}</p>}
              {item.url && <a href={item.url} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#D61F31', display: 'block', marginTop: 8 }}>View →</a>}
            </div>
          )
        })}
        {items.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>Your portfolio is empty. Add your first item!</div>}
      </div>
      {modal && <Modal onClose={() => setModal(false)} onSave={save} />}
    </div>
  )
}
