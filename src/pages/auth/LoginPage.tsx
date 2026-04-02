import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

type LoginTab = 'staff' | 'student'

const shell: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: 20,
  background: 'linear-gradient(135deg,#0F2240 0%,#1A365E 60%,#D61F31 100%)',
  fontFamily: 'Poppins, sans-serif',
}

const panel: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  padding: 36,
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 24px 60px rgba(0,0,0,.4)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  border: '2px solid #E4EAF2',
  borderRadius: 9,
  fontSize: 13,
  color: '#1A365E',
  outline: 'none',
  fontFamily: 'Poppins, sans-serif',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#3D5475',
  textTransform: 'uppercase',
  letterSpacing: '.7px',
  display: 'block',
  marginBottom: 5,
}

const errorStyle: React.CSSProperties = {
  padding: '10px 13px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 600,
  marginTop: 10,
  textAlign: 'center',
  background: '#FFF0F1',
  color: '#D61F31',
  border: '1px solid #F5C2C7',
}

export function LoginPage({ initialTab = 'staff' }: { initialTab?: LoginTab }) {
  const navigate = useNavigate()
  const { refreshSession } = useStudentPortal()

  const [tab, setTab] = useState<LoginTab>(initialTab)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffLoading, setStaffLoading] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentError, setStudentError] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    setStaffError(null)
    setStaffLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStaffError(error.message)
      setStaffLoading(false)
      return
    }

    navigate('/dashboard')
  }

  async function handleStudentLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId.trim() || !studentPassword.trim()) {
      setStudentError('Please enter both Student ID and password.')
      return
    }

    setStudentLoading(true)
    setStudentError('')

    try {
      const normalizedStudentId = studentId.trim().toUpperCase()
      const { data, error: dbError } = await supabase
        .from('students')
        .select('email,student_id')
        .eq('student_id', normalizedStudentId)
        .single()

      if (dbError || !data) {
        setStudentError('Student ID not found.')
        return
      }

      if (!data.email) {
        setStudentError('Student login is not enabled for this account. Add an email in the student record first.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: studentPassword,
      })

      if (signInError) {
        setStudentError('Incorrect student ID or password.')
        return
      }

      void refreshSession()

      navigate('/portal/dashboard')
    } finally {
      setStudentLoading(false)
    }
  }

  function switchTab(nextTab: LoginTab) {
    setTab(nextTab)
    setStaffError(null)
    setStudentError('')
  }

  return (
    <div style={shell}>
      <div style={panel}>
        <div style={{ background: '#0F2240', borderRadius: 14, padding: '16px 12px', textAlign: 'center', marginBottom: 20 }}>
          <img
            src="/Logo.png"
            alt="AWS"
            style={{ width: '100%', maxWidth: 280, height: 'auto', objectFit: 'contain', margin: '0 auto' }}
          />
        </div>

        <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>Student Information System</h1>
        <div style={{ fontSize: 12, color: '#7A92B0', marginBottom: 20 }}>American World School · K-12 Admissions &amp; Enrollment</div>

        <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E4EAF2', marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => switchTab('staff')}
            style={{
              flex: 1,
              padding: 9,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: tab === 'staff' ? '#1A365E' : '#F7F9FC',
              color: tab === 'staff' ? '#fff' : '#7A92B0',
              fontFamily: 'Poppins, sans-serif',
              transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            👤 Staff / Admin
          </button>
          <button
            type="button"
            onClick={() => switchTab('student')}
            style={{
              flex: 1,
              padding: 9,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: tab === 'student' ? '#1A365E' : '#F7F9FC',
              color: tab === 'student' ? '#fff' : '#7A92B0',
              fontFamily: 'Poppins, sans-serif',
              transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            🎓 Student
          </button>
        </div>

        {tab === 'staff' ? (
          <form onSubmit={handleStaffLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="login-user" style={labelStyle}>Username</label>
              <input
                id="login-user"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="login-pass" style={labelStyle}>Password</label>
              <input
                id="login-pass"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={staffLoading}
              style={{
                width: '100%',
                padding: 13,
                background: staffLoading ? '#C0C0C0' : '#D61F31',
                color: '#fff',
                border: 'none',
                borderRadius: 11,
                fontSize: 14,
                fontWeight: 700,
                marginTop: 6,
                cursor: staffLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Poppins, sans-serif',
                transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              {staffLoading ? 'Signing in…' : 'Sign In'}
            </button>

            {staffError && <div style={errorStyle}>{staffError}</div>}
          </form>
        ) : (
          <form onSubmit={handleStudentLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="sp-login-sid" style={labelStyle}>Student ID</label>
              <input
                id="sp-login-sid"
                type="text"
                placeholder="e.g. AWSS-2026-004"
                autoComplete="username"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="sp-login-pass" style={labelStyle}>Portal Password</label>
              <input
                id="sp-login-pass"
                type="password"
                placeholder="Enter your portal password"
                autoComplete="current-password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <button
              type="submit"
              disabled={studentLoading}
              style={{
                width: '100%',
                padding: 12,
                background: studentLoading ? '#C0C0C0' : '#1A365E',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                marginTop: 4,
                cursor: studentLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Poppins, sans-serif',
                transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              {studentLoading ? 'Signing in…' : 'Sign In to Student Portal'}
            </button>

            {studentError && <div style={errorStyle}>{studentError}</div>}

            <div style={{ fontSize: 11, color: '#7A92B0', textAlign: 'center', marginTop: 10 }}>
              Don&apos;t have a password? Ask your school admin to set one for you.
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
