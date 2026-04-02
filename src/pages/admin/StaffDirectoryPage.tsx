import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

interface StaffMember {
  id: string; fullName: string; email: string; role: string
  department: string; campus: string; phone: string; notes: string
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const DEPARTMENTS = ['Administration', 'English', 'Mathematics', 'Science', 'History', 'Foreign Language', 'PE', 'Arts', 'Counselling', 'IT', 'Support', 'Other']
const EMPTY = { fullName: '', email: '', role: '', department: 'Administration', campus: '', phone: '', notes: '' }

function StaffModal({ member, campuses, onClose, onSave, onDelete }: {
  member: StaffMember | null; campuses: string[]
  onClose: () => void; onSave: (f: typeof EMPTY, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(member ? { fullName: member.fullName, email: member.email, role: member.role, department: member.department, campus: member.campus, phone: member.phone, notes: member.notes } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.fullName) return; setSaving(true); await onSave(form, member?.id); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{member ? 'Edit Staff Member' : 'Add Staff Member'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Full Name</label><input value={form.fullName} onChange={e => set('fullName', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Role / Title</label><input value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Head of Department" style={inp} /></div>
            <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Department</label><select value={form.department} onChange={e => set('department', e.target.value)} style={inp}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label style={lbl}>Campus</label>
              <select value={form.campus} onChange={e => set('campus', e.target.value)} style={inp}>
                <option value="">—</option>
                {campuses.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>{member && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(member.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffDirectoryPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [campuses, setCampuses] = useState<string[]>([])
  const [search, setSearch] = useState(''); const [filterDept, setFilterDept] = useState('All'); const [filterCampus, setFilterCampus] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; member: StaffMember | null }>({ open: false, member: null })

  async function load() {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('staff').select('*').order('full_name', { ascending: true }),
      supabase.from('settings').select('campuses').single(),
    ])
    if (data) setStaff(data.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', email: (r.email as string) ?? '', role: (r.role as string) ?? '', department: (r.department as string) ?? '', campus: (r.campus as string) ?? '', phone: (r.phone as string) ?? '', notes: (r.notes as string) ?? '' })))
    if (settings?.campuses) setCampuses(settings.campuses as string[])
  }
  useEffect(() => { load() }, [])

  const departments = useMemo(() => Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort(), [staff])
  const campusList = useMemo(() => Array.from(new Set(staff.map(s => s.campus).filter(Boolean))).sort(), [staff])

  const filtered = useMemo(() => staff.filter(s => {
    if (filterDept !== 'All' && s.department !== filterDept) return false
    if (filterCampus !== 'All' && s.campus !== filterCampus) return false
    const q = search.toLowerCase()
    if (q && !s.fullName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.role.toLowerCase().includes(q)) return false
    return true
  }), [staff, search, filterDept, filterCampus])

  async function saveMember(form: typeof EMPTY, id?: string) {
    const payload = { full_name: form.fullName, email: form.email, role: form.role, department: form.department, campus: form.campus, phone: form.phone, notes: form.notes }
    if (id) { await supabase.from('staff').update(payload).eq('id', id); toast('Staff record updated', 'ok') }
    else { await supabase.from('staff').insert(payload); toast('Staff member added', 'ok') }
    await load()
  }
  async function deleteMember(id: string) { await supabase.from('staff').delete().eq('id', id); setStaff(prev => prev.filter(s => s.id !== id)); toast('Staff member removed', 'ok') }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, member: null })} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Staff</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Staff', value: staff.length, color: '#1A365E' }, { label: 'Departments', value: departments.length, color: '#A36CFF' }, { label: 'Campuses', value: campusList.length, color: '#0EA5E9' }].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…" style={{ ...iStyle, width: 220 }} />
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={iStyle}><option value="All">All Departments</option>{departments.map(d => <option key={d}>{d}</option>)}</select>
        <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)} style={iStyle}><option value="All">All Campuses</option>{campusList.map(c => <option key={c}>{c}</option>)}</select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} staff</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role / Title</th>
            <th style={th}>Department</th><th style={th}>Campus</th><th style={th}>Phone</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}
                onClick={() => setModal({ open: true, member: s })}
                style={{ cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC' }}
              >
                <td style={{ ...td, fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                    {s.fullName}
                  </div>
                </td>
                <td style={{ ...td, color: '#7A92B0' }}>{s.email || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{s.role || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{s.department || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{s.campus || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{s.phone || '—'}</td>
                <td style={td} onClick={e => e.stopPropagation()}><button onClick={() => setModal({ open: true, member: s })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No staff members yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && <StaffModal member={modal.member} campuses={campuses} onClose={() => setModal({ open: false, member: null })} onSave={saveMember} onDelete={deleteMember} />}
    </div></>
  )
}
