import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

export function SPProfilePage() {
  const { session } = useStudentPortal()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const initials = session?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'Password must be at least 6 characters.' }); return }
    if (!session?.email) { setPwMsg({ ok: false, text: 'No email is linked to this student account.' }); return }
    setSaving(true)
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: session.email, password: oldPw })
    if (reauthError) { setPwMsg({ ok: false, text: 'Current password is incorrect.' }); setSaving(false); return }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
    if (updateError) { setPwMsg({ ok: false, text: updateError.message }); setSaving(false); return }
    setPwMsg({ ok: true, text: 'Password changed successfully!' })
    setOldPw(''); setNewPw(''); setConfirmPw('')
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Your student account information</p>
      </div>

      {/* Profile card */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1A365E' }}>{session?.fullName}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#E6F4FF', color: '#0369A1' }}>{session?.studentId}</span>
            {session?.grade && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#EDE9FE', color: '#5B21B6' }}>{session.grade}</span>}
            {session?.cohort && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#E8FBF0', color: '#0E6B3B' }}>{session.cohort}</span>}
            {session?.campus && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#FFF3E0', color: '#B45309' }}>{session.campus}</span>}
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 14 }}>Student Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Full Name', value: session?.fullName },
            { label: 'Student ID', value: session?.studentId },
            { label: 'Grade', value: session?.grade || '—' },
            { label: 'Cohort', value: session?.cohort || '—' },
            { label: 'Campus', value: session?.campus || '—' },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A365E' }}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 14 }}>Change Portal Password</div>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Current Password</label><input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>New Password</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Confirm New Password</label><input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inp} /></div>
          </div>
          {pwMsg && <div style={{ padding: '10px 14px', borderRadius: 8, background: pwMsg.ok ? '#E8FBF0' : '#FEE2E2', color: pwMsg.ok ? '#0E6B3B' : '#D61F31', fontSize: 13, fontWeight: 600 }}>{pwMsg.text}</div>}
          <div>
            <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {saving ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
