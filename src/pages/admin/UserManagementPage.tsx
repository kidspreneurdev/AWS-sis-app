import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const ROLES = ['admin', 'staff', 'teacher', 'viewer']
const ROLE_META: Record<string, { bg: string; tc: string }> = {
  admin: { bg: '#FEE2E2', tc: '#991B1B' },
  staff: { bg: '#E6F4FF', tc: '#0369A1' },
  teacher: { bg: '#E8FBF0', tc: '#0E6B3B' },
  viewer: { bg: '#F3F4F6', tc: '#7A92B0' },
}

interface UserProfile {
  id: string; email: string; fullName: string; role: string; campus: string; createdAt: string; lastSignIn: string | null
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

function EditModal({ user, campuses, onClose, onSave }: {
  user: UserProfile; campuses: string[]
  onClose: () => void; onSave: (id: string, role: string, campus: string) => Promise<void>
}) {
  const [role, setRole] = useState(user.role)
  const [campus, setCampus] = useState(user.campus)
  const [saving, setSaving] = useState(false)
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { setSaving(true); await onSave(user.id, role, campus); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Edit User Role</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#7A92B0' }}>{user.email}</div>
          <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#1A365E' }}>{user.fullName || '—'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={lbl}>Role</label><select value={role} onChange={e => setRole(e.target.value)} style={inp}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label style={lbl}>Campus</label>
              <select value={campus} onChange={e => setCampus(e.target.value)} style={inp}>
                <option value="">—</option>
                {campuses.map(c => <option key={c}>{c}</option>)}
              </select>
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

export function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [campuses, setCampuses] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; user: UserProfile | null }>({ open: false, user: null })

  async function load() {
    const [{ data: profiles }, { data: settings }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('campuses').single(),
    ])
    if (profiles) setUsers(profiles.map((p: Record<string, unknown>) => ({
      id: p.id as string, email: (p.email as string) ?? '', fullName: (p.full_name as string) ?? '',
      role: (p.role as string) ?? 'viewer', campus: (p.campus as string) ?? '',
      createdAt: (p.created_at as string) ?? '', lastSignIn: p.last_sign_in_at as string | null,
    })))
    if (settings?.campuses) setCampuses(settings.campuses as string[])
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
  }, [users, search])

  const admins = users.filter(u => u.role === 'admin').length
  const staffCount = users.filter(u => u.role === 'staff' || u.role === 'teacher').length

  async function saveUser(id: string, role: string, campus: string) {
    await supabase.from('profiles').update({ role, campus }).eq('id', id)
    await load()
  }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>User Management</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Manage user roles and access</p></div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[{ label: 'Total Users', value: users.length, color: '#1A365E' }, { label: 'Admins', value: admins, color: '#D61F31' }, { label: 'Staff / Teachers', value: staffCount, color: '#0EA5E9' }].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" style={{ ...iStyle, width: 240 }} />
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} users</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th>
            <th style={th}>Campus</th><th style={th}>Joined</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(u => { const m = ROLE_META[u.role] ?? ROLE_META.viewer; return (
              <tr key={u.id}>
                <td style={{ ...td, fontWeight: 600 }}>{u.fullName || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{u.email}</td>
                <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 12, fontWeight: 600 }}>{u.role}</span></td>
                <td style={{ ...td, color: '#7A92B0' }}>{u.campus || '—'}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                <td style={td}><button onClick={() => setModal({ open: true, user: u })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            )})}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && modal.user && <EditModal user={modal.user} campuses={campuses} onClose={() => setModal({ open: false, user: null })} onSave={saveUser} />}
    </div>
  )
}
