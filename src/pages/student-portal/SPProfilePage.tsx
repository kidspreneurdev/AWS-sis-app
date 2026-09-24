import { useRef, useState } from 'react'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { usePortalReadOnly } from '@/contexts/PortalReadOnlyContext'
import { authedFetch } from '@/lib/studentPortalApi'
import { uploadFile } from '@/lib/uploadFile'
import { Camera, Loader2 } from 'lucide-react'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

export function SPProfilePage() {
  const { session, getToken, refreshSession } = useStudentPortal()
  const { readOnly } = usePortalReadOnly()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = session?.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !session) return

    if (!file.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Image must be smaller than 5MB.'); return }

    const token = getToken()
    if (!token) { setPhotoError('Your session has expired. Please log in again.'); return }

    setPhotoError('')
    setPhotoUploading(true)
    try {
      const path = `student-photos/${session.dbId}/${Date.now()}_${file.name}`
      const url = await uploadFile(path, file)
      await authedFetch(token, '/api/student-portal/update-profile-photo', {
        method: 'POST',
        body: JSON.stringify({ photoUrl: url }),
      })
      await refreshSession()
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to upload photo.')
    } finally {
      setPhotoUploading(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return }
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'Password must be at least 6 characters.' }); return }
    const token = getToken()
    if (!token) { setPwMsg({ ok: false, text: 'Your session has expired. Please log in again.' }); return }
    setSaving(true)
    try {
      await authedFetch(token, '/api/student-portal/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }),
      })
      setPwMsg({ ok: true, text: 'Password changed successfully!' })
      setOldPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to change password.' })
    } finally {
      setSaving(false)
    }
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
        <div
          style={{ position: 'relative', width: 72, height: 72, flexShrink: 0, borderRadius: 18, cursor: readOnly ? 'default' : 'pointer' }}
          onClick={() => { if (!readOnly && !photoUploading) fileInputRef.current?.click() }}
          role={readOnly ? undefined : 'button'}
          aria-label={readOnly ? undefined : 'Change profile photo'}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 18, background: '#1A365E', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800,
            overflow: 'hidden',
          }}>
            {session?.photoUrl
              ? <img src={session.photoUrl} alt={session.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>

          {!readOnly && (
            <div
              className="sp-avatar-edit"
              style={{
                position: 'absolute', inset: 0, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,34,64,0.55)', opacity: photoUploading ? 1 : 0,
                transition: 'opacity 150ms ease-out',
              }}
            >
              {photoUploading ? <Loader2 size={20} color="#fff" style={{ animation: 'spin 0.8s linear infinite' }} /> : <Camera size={20} color="#fff" />}
            </div>
          )}

          {!readOnly && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelected}
              style={{ display: 'none' }}
            />
          )}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1A365E' }}>{session?.fullName}</div>
          {photoError && <div style={{ fontSize: 12, fontWeight: 600, color: '#D61F31', marginTop: 4 }}>{photoError}</div>}
        </div>
      </div>
      <style>{`
        .sp-avatar-edit:hover, .sp-avatar-edit:focus-visible { opacity: 1 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

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
            { label: 'Address', value: session?.address || '—' },
            { label: 'Emergency Contact', value: [session?.ecName, session?.ecPhone].filter(Boolean).join(' · ') || '—' },
            { label: 'Parent Contact', value: [session?.parent, session?.relation].filter(Boolean).join(' · ') || '—' },
            { label: 'Email', value: session?.email || '—' },
            { label: 'Blood Group', value: session?.bloodGroup || '—' },
            { label: 'Aadhar/Passport - Identification', value: 'Not provided' },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A365E' }}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change password — hidden for parent view-only mode */}
      {!readOnly && <div style={card}>
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
      </div>}
    </div>
  )
}
