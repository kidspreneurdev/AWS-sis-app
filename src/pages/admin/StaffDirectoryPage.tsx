import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  department: string
  campus: string
  active: boolean
  createdAt: string
}

interface StaffForm {
  firstName: string
  lastName: string
  email: string
  role: string
  department: string
  campus: string
  active: boolean
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,.06)' }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap', background: '#F7F9FC' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const DEPARTMENTS = ['Administration', 'English', 'Mathematics', 'Science', 'History', 'Foreign Language', 'PE', 'Arts', 'Counselling', 'IT', 'Support', 'Other']
const EMPTY_FORM: StaffForm = { firstName: '', lastName: '', email: '', role: 'Teacher', department: 'Administration', campus: '', active: true }

function StaffModal({ member, campuses, onClose, onSave, onDelete }: {
  member: StaffMember | null
  campuses: string[]
  onClose: () => void
  onSave: (form: StaffForm, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<StaffForm>(member ? {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    role: member.role || 'Teacher',
    department: member.department || 'Administration',
    campus: member.campus,
    active: member.active,
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#3D5475', textTransform: 'uppercase', letterSpacing: '.7px', display: 'block', marginBottom: 4 }

  function set<K extends keyof StaffForm>(k: K, v: StaffForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('First and last name are required', 'err')
      return
    }
    if (!form.email.trim()) {
      toast('Email is required', 'err')
      return
    }
    setSaving(true)
    await onSave(form, member?.id)
    setSaving(false)
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{member ? 'Edit Staff Member' : 'Add Staff Member'}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>First Name</label><input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Last Name</label><input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inp} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Role / Title</label><input value={form.role} onChange={e => set('role', e.target.value)} style={inp} placeholder="e.g. Success Coach" /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)} style={inp}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Campus</label>
              <select value={form.campus} onChange={e => set('campus', e.target.value)} style={inp}>
                <option value="">—</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Status</label>
            <select value={form.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')} style={inp}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            {member && (
              <button onClick={() => { if (confirm('Remove this staff member?')) void onDelete(member.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void handleSave()} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffDirectoryPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [campuses, setCampuses] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('All')
  const [filterRole, setFilterRole] = useState('All')
  const [filterCampus, setFilterCampus] = useState('All')
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [modal, setModal] = useState<{ open: boolean; member: StaffMember | null }>({ open: false, member: null })
  const [loadError, setLoadError] = useState('')

  async function load() {
    setLoadError('')
    const [{ data: staffRows, error: staffError }, { data: settingsRows, error: settingsError }] = await Promise.all([
      supabase.from('staff').select('id,first_name,last_name,email,role,department,campus,active,created_at').order('last_name', { ascending: true }),
      supabase.from('settings').select('campuses').single(),
    ])

    if (staffError) setLoadError(staffError.message)
    if (settingsError && !loadError) setLoadError(settingsError.message)

    if (staffRows) {
      setStaff((staffRows as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        email: (r.email as string) ?? '',
        role: (r.role as string) ?? '',
        department: (r.department as string) ?? '',
        campus: (r.campus as string) ?? '',
        active: r.active !== false,
        createdAt: (r.created_at as string) ?? '',
      })))
    } else {
      setStaff([])
    }

    if (settingsRows?.campuses) setCampuses(settingsRows.campuses as string[])
  }

  useEffect(() => { void load() }, [])

  const departments = useMemo(() => Array.from(new Set(staff.map(s => s.department).filter(Boolean))).sort(), [staff])
  const roles = useMemo(() => Array.from(new Set(staff.map(s => s.role).filter(Boolean))).sort(), [staff])
  const campusList = useMemo(() => Array.from(new Set(staff.map(s => s.campus).filter(Boolean))).sort(), [staff])

  const filtered = useMemo(() => staff.filter(s => {
    if (filterDept !== 'All' && s.department !== filterDept) return false
    if (filterRole !== 'All' && s.role !== filterRole) return false
    if (filterCampus !== 'All' && s.campus !== filterCampus) return false
    if (filterStatus === 'Active' && !s.active) return false
    if (filterStatus === 'Inactive' && s.active) return false
    const q = search.toLowerCase()
    if (!q) return true
    return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q)
      || s.role.toLowerCase().includes(q)
      || s.department.toLowerCase().includes(q)
  }), [staff, search, filterDept, filterRole, filterCampus, filterStatus])

  async function saveMember(form: StaffForm, id?: string) {
    const payload = {
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      role: form.role.trim() || 'Teacher',
      department: form.department.trim() || 'Other',
      campus: form.campus.trim() || null,
      active: form.active,
    }
    if (id) {
      const { error } = await supabase.from('staff').update(payload).eq('id', id)
      if (error) {
        toast(error.message, 'err')
        return
      }
      toast('Staff record updated', 'ok')
    } else {
      const { error } = await supabase.from('staff').insert(payload)
      if (error) {
        toast(error.message, 'err')
        return
      }
      toast('Staff member added', 'ok')
    }
    await load()
  }

  async function deleteMember(id: string) {
    const { error } = await supabase.from('staff').delete().eq('id', id)
    if (error) {
      toast(error.message, 'err')
      return
    }
    setStaff(prev => prev.filter(s => s.id !== id))
    toast('Staff member removed', 'ok')
  }

  const total = staff.length
  const active = staff.filter(s => s.active).length
  const successCoaches = staff.filter(s => s.role.toLowerCase().includes('success coach')).length
  const successManagers = staff.filter(s => s.role.toLowerCase().includes('success manager')).length

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', fontFamily: 'inherit' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, member: null })} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
      + Add Staff
    </button>,
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loadError && (
          <div style={{ ...card, padding: 12, background: '#FFF0F1', borderColor: '#F5C2C7', color: '#D61F31', fontSize: 12, fontWeight: 700 }}>
            Could not load staff data: {loadError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Total Staff', value: total, color: '#1A365E' },
            { label: 'Success Coaches', value: successCoaches, color: '#059669' },
            { label: 'Success Managers', value: successManagers, color: '#7C3AED' },
            { label: 'Active', value: active, color: '#0EA5E9' },
          ].map(c => (
            <div key={c.label} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1.1px' }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: c.color, marginTop: 6, lineHeight: 1 }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…" style={{ ...iStyle, width: 220 }} />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={iStyle}>
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={iStyle}>
            <option value="All">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)} style={iStyle}>
            <option value="All">All Campuses</option>
            {campusList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as 'All' | 'Active' | 'Inactive')} style={iStyle}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <span style={{ fontSize: 12, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} results</span>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role / Title</th>
                <th style={th}>Department</th>
                <th style={th}>Campus</th>
                <th style={th}>Status</th>
                <th style={th}>Joined</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const fullName = `${s.firstName} ${s.lastName}`.trim()
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {(s.firstName[0] || '') + (s.lastName[0] || '')}
                        </div>
                        {fullName || '—'}
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.email || '—'}</td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.role || '—'}</td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.department || '—'}</td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.campus || '—'}</td>
                    <td style={td}>
                      <span style={{ background: s.active ? '#DCFCE7' : '#FEE2E2', color: s.active ? '#0E6B3B' : '#D61F31', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                        {s.active ? '✓ Active' : '✕ Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: '#7A92B0' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setModal({ open: true, member: s })} style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No staff members found.</td></tr>}
            </tbody>
          </table>
        </div>

        {modal.open && (
          <StaffModal
            member={modal.member}
            campuses={campuses}
            onClose={() => setModal({ open: false, member: null })}
            onSave={saveMember}
            onDelete={deleteMember}
          />
        )}
      </div>
    </>
  )
}
