import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const ROLES = ['admin', 'staff', 'teacher', 'principal', 'partner', 'coach', 'viewer']
const ROLE_COLORS: Record<string, { bg: string; tc: string }> = {
  admin:     { bg: '#EEF3FF', tc: '#1A365E' },
  staff:     { bg: '#F0FFF4', tc: '#0E6B3B' },
  teacher:   { bg: '#F0FFF4', tc: '#0E6B3B' },
  principal: { bg: '#FFF7ED', tc: '#C2500A' },
  partner:   { bg: '#FDF4FF', tc: '#7C3AED' },
  coach:     { bg: '#FFF7ED', tc: '#D97706' },
  viewer:    { bg: '#F3F4F6', tc: '#7A92B0' },
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,.06)' }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap', background: '#F7F9FC' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#3D5475', textTransform: 'uppercase', letterSpacing: '.7px', display: 'block', marginBottom: 4 }

interface UserProfile {
  id: string; email: string; fullName: string; role: string; campus: string
  createdAt: string; lastSignIn: string | null; active: boolean
}

interface Student {
  id: string; studentId: string; fullName: string; grade: string; campus: string
  portalPassword: string | null; lastPortalLogin: string | null
}

// ─── Add / Edit Staff Modal ────────────────────────────────────────────────────
function StaffModal({ user, campuses, onClose, onSave }: {
  user: UserProfile | null
  campuses: string[]
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!user
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [role, setRole] = useState(user?.role ?? 'staff')
  const [campus, setCampus] = useState(user?.campus ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [active, setActive] = useState(user?.active !== false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setErr('')
    if (!isEdit) {
      if (!email.trim()) { setErr('Email is required.'); return }
      if (password.length < 8) { setErr('Password must be at least 8 characters.'); return }
    }
    setSaving(true)
    if (isEdit && user) {
      await supabase.from('profiles').update({ full_name: fullName, role, campus: campus || null, active }).eq('id', user.id)
    } else {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        setErr('Your session has expired. Please sign in again and retry.')
        setSaving(false)
        return
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName,
          role,
          campus: campus || null,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        setErr(payload?.error ?? 'Failed to create account.')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{isEdit ? 'Edit User' : 'Add Staff User'}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isEdit && (
            <div style={{ background: '#EEF3FF', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1A365E' }}>
              <strong>{user?.email}</strong>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Full Name</label><input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="e.g. Jane Smith" /></div>
            <div><label style={lbl}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {!isEdit && (
            <>
              <div><label style={lbl}>Email</label><input value={email} onChange={e => { setEmail(e.target.value); setErr('') }} style={inp} placeholder="user@school.edu" autoComplete="off" /></div>
              <div><label style={lbl}>Temporary Password</label><input type="password" value={password} onChange={e => { setPassword(e.target.value); setErr('') }} style={inp} placeholder="Minimum 8 characters" autoComplete="new-password" /></div>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Campus</label>
              <select value={campus} onChange={e => setCampus(e.target.value)} style={inp}>
                <option value="">— Any Campus —</option>
                {campuses.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {isEdit && (
              <div><label style={lbl}>Account Status</label>
                <select value={active ? 'true' : 'false'} onChange={e => setActive(e.target.value === 'true')} style={inp}>
                  <option value="true">Active</option>
                  <option value="false">Inactive (cannot log in)</option>
                </select>
              </div>
            )}
          </div>
          {err && <div style={{ fontSize: 11, color: '#D61F31', fontWeight: 600 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid #E4EAF2' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #E4EAF2', background: '#fff', color: '#3D5475', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void save()} disabled={saving} style={{ padding: '8px 22px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : '✓ Create Account'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Set Student Portal Password Modal ────────────────────────────────────────
function SetPasswordModal({ student, onClose, onSave }: {
  student: Student
  onClose: () => void
  onSave: () => void
}) {
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (pass.length < 4) { setErr('Password must be at least 4 characters.'); return }
    if (pass !== confirm) { setErr('Passwords do not match.'); return }
    setSaving(true)
    await supabase.from('students').update({ portal_password: pass }).eq('id', student.id)
    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🔑 Set Portal Password</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#EEF3FF', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1A365E' }}>
            <strong>{student.fullName}</strong> — <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{student.studentId}</span>
            {student.campus && <span style={{ color: '#7A92B0' }}> ({student.campus})</span>}
          </div>
          <div><label style={lbl}>New Portal Password *</label><input type="password" name="portal_password_new" autoComplete="new-password" value={pass} onChange={e => { setPass(e.target.value); setErr('') }} style={inp} placeholder="Minimum 4 characters" /></div>
          <div><label style={lbl}>Confirm Password *</label><input type="password" name="portal_password_confirm" autoComplete="new-password" value={confirm} onChange={e => { setConfirm(e.target.value); setErr('') }} style={inp} placeholder="Re-enter password" /></div>
          {err && <div style={{ fontSize: 11, color: '#D61F31', fontWeight: 600 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid #E4EAF2' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #E4EAF2', background: '#fff', color: '#3D5475', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void save()} disabled={saving} style={{ padding: '8px 22px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : '✓ Set Password & Activate Portal'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function UserManagementPage() {
  const [tab, setTab] = useState<'staff' | 'students'>('staff')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [campuses, setCampuses] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [staffModal, setStaffModal] = useState<{ open: boolean; user: UserProfile | null }>({ open: false, user: null })
  const [pwdModal, setPwdModal] = useState<Student | null>(null)

  async function load() {
    const [{ data: profiles }, { data: settings }, { data: { user } }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('campuses').single(),
      supabase.auth.getUser(),
    ])
    if (profiles) setUsers(profiles.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      email: (p.email as string) ?? '',
      fullName: (p.full_name as string) ?? '',
      role: (p.role as string) ?? 'viewer',
      campus: (p.campus as string) ?? '',
      createdAt: (p.created_at as string) ?? '',
      lastSignIn: (p.last_sign_in_at as string) ?? null,
      active: p.active !== false,
    })))
    if (settings?.campuses) setCampuses(settings.campuses as string[])
    if (user) setCurrentUserId(user.id)
  }

  async function loadStudents() {
    const { data, error } = await supabase
      .from('students')
      .select('id,student_id,first_name,last_name,grade,campus,portal_password,last_portal_login')
      .order('last_name')
    if (error) {
      // Fallback if new columns don't exist yet
      const { data: fallback } = await supabase
        .from('students')
        .select('id,student_id,first_name,last_name,grade,campus')
        .order('last_name')
      if (fallback) setStudents((fallback as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        studentId: (r.student_id as string) ?? '',
        fullName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
        grade: r.grade != null ? String(r.grade) : '',
        campus: (r.campus as string) ?? '',
        portalPassword: null,
        lastPortalLogin: null,
      })))
      return
    }
    if (data) setStudents((data as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      studentId: (r.student_id as string) ?? '',
      fullName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      grade: r.grade != null ? String(r.grade) : '',
      campus: (r.campus as string) ?? '',
      portalPassword: (r.portal_password as string) ?? null,
      lastPortalLogin: (r.last_portal_login as string) ?? null,
    })))
  }

  useEffect(() => { void load(); void loadStudents() }, [])

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => !q || u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
  }, [users, search])

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase()
    return students.filter(s => !q || s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))
  }, [students, search])
  const visibleStudents = pwdModal ? students : filteredStudents

  async function removeUser(u: UserProfile) {
    if (!confirm(`Remove ${u.fullName || u.email} from the system?`)) return
    await supabase.from('profiles').delete().eq('id', u.id)
    void load()
  }

  async function removeStudentPortal(s: Student) {
    if (!confirm(`Remove portal access for ${s.fullName}?`)) return
    await supabase.from('students').update({ portal_password: null }).eq('id', s.id)
    void loadStudents()
  }

  const portalActive = students.filter(s => s.portalPassword).length
  const admins = users.filter(u => u.role === 'admin').length
  const staffCount = users.filter(u => u.role === 'staff' || u.role === 'teacher' || u.role === 'principal').length

  function fmtDate(d: string | null) {
    if (!d) return 'Never'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>👥 User Management</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{users.length} total accounts · {staffCount} staff · {portalActive} student portal</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" autoComplete="off" spellCheck={false} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', outline: 'none', fontFamily: 'inherit', width: 200 }} />
          {tab === 'staff' && (
            <button onClick={() => setStaffModal({ open: true, user: null })} style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Staff User</button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Accounts', value: users.length + students.filter(s => s.portalPassword).length, color: '#1A365E' },
          { label: 'Admins', value: admins, color: '#D61F31' },
          { label: 'Staff / Teachers', value: staffCount, color: '#0EA5E9' },
          { label: 'Student Portal', value: portalActive, color: '#1DBD6A' },
        ].map(c => (
          <div key={c.label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E4EAF2', width: 'fit-content' }}>
        {([['staff', `👤 Staff & Admins (${users.length})`], ['students', `🎓 Student Portal (${portalActive})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setSearch('') }} style={{ flex: 1, padding: '10px 20px', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: tab === key ? '#1A365E' : '#F7F9FC', color: tab === key ? '#fff' : '#7A92B0', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>

      {/* Staff Table */}
      {tab === 'staff' && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Campus</th>
                <th style={th}>Status</th>
                <th style={th}>Last Login</th>
                <th style={th}>Joined</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.viewer
                const isMe = u.id === currentUserId
                return (
                  <tr key={u.id} style={{ background: '#fff' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span>{u.fullName || '—'}</span>
                      {isMe && <span style={{ fontSize: 9, background: '#FAC600', color: '#7A5100', padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>YOU</span>}
                    </td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{u.email}</td>
                    <td style={td}><span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: rc.bg, color: rc.tc }}>{u.role}</span></td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{u.campus || '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: u.active ? '#1DBD6A' : '#D61F31' }}>
                        {u.active ? '✓ Active' : '✕ Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: '#7A92B0' }}>{fmtDate(u.lastSignIn)}</td>
                    <td style={{ ...td, fontSize: 11, color: '#7A92B0' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {isMe ? <span style={{ fontSize: 11, color: '#7A92B0' }}>—</span> : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setStaffModal({ open: true, user: u })} style={{ padding: '5px 12px', border: '1.5px solid #E4EAF2', background: '#fff', color: '#3D5475', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => void removeUser(u)} style={{ padding: '5px 12px', border: '1.5px solid #F5C2C7', background: '#FFF0F1', color: '#D61F31', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredUsers.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Portal Table */}
      {tab === 'students' && (
        <>
          <div style={{ background: '#EEF3FF', borderLeft: '4px solid #1A365E', borderRadius: 8, padding: '12px 16px', fontSize: 11, color: '#1A365E' }}>
            <strong>🎓 Student Portal Accounts</strong> — Students log in using their <strong>Student ID</strong> and portal password. Click <strong>🔑 Set Password</strong> to activate a student's portal access.
          </div>
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Student ID</th>
                  <th style={th}>Name</th>
                  <th style={th}>Grade</th>
                  <th style={th}>Campus</th>
                  <th style={th}>Portal Status</th>
                  <th style={th}>Last Portal Login</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map(s => {
                  const hasPortal = !!s.portalPassword
                  return (
                    <tr key={s.id} style={{ background: '#fff' }}>
                      <td style={td}><span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1A365E', fontSize: 12 }}>{s.studentId}</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>{s.fullName || '—'}</td>
                      <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.grade || '—'}</td>
                      <td style={{ ...td, color: '#7A92B0', fontSize: 11 }}>{s.campus || '—'}</td>
                      <td style={td}>
                        {hasPortal
                          ? <span style={{ background: '#DCFCE7', color: '#0E6B3B', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>✓ Active</span>
                          : <span style={{ background: '#FEE2E2', color: '#D61F31', padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>✕ Not Created</span>
                        }
                      </td>
                      <td style={{ ...td, fontSize: 11, color: '#7A92B0' }}>{fmtDate(s.lastPortalLogin)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setPwdModal(s)} style={{ padding: '5px 10px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #C4D4E8', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🔑 {hasPortal ? 'Change' : 'Set Password'}</button>
                          {hasPortal && <button onClick={() => void removeStudentPortal(s)} style={{ padding: '5px 8px', background: '#FFF0F1', color: '#D61F31', border: '1.5px solid #F5C2C7', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {visibleStudents.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modals */}
      {staffModal.open && (
        <StaffModal
          user={staffModal.user}
          campuses={campuses}
          onClose={() => setStaffModal({ open: false, user: null })}
          onSave={() => void load()}
        />
      )}
      {pwdModal && (
        <SetPasswordModal
          student={pwdModal}
          onClose={() => setPwdModal(null)}
          onSave={() => void loadStudents()}
        />
      )}
    </div>
  )
}
