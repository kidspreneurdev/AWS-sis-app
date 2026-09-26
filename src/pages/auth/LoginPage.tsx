import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { useParentPortal } from '@/contexts/ParentPortalContext'
import { syncAuthState } from '@/hooks/useAuth'

type LoginTab = 'staff' | 'student' | 'parent'

const BRAND_GRADIENT = 'linear-gradient(135deg,#0F2240 0%,#1A365E 60%,#D61F31 100%)'

const pageStyles = `
  .awsc-login-shell {
    display: flex;
    min-height: 100vh;
    width: 100%;
    font-family: 'Poppins', sans-serif;
    background: ${BRAND_GRADIENT};
  }

  .awsc-login-brand {
    container-type: inline-size;
    position: relative;
    flex: 1.35 1 0%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }

  .awsc-brand-watermark {
    position: absolute;
    left: -9%;
    bottom: -14%;
    width: min(46cqw, 380px);
    opacity: 0.1;
    transform: rotate(16deg);
    pointer-events: none;
    user-select: none;
    -webkit-mask-image: radial-gradient(circle at 50% 50%, black 0%, black 35%, transparent 75%);
    mask-image: radial-gradient(circle at 50% 50%, black 0%, black 35%, transparent 75%);
  }

  .awsc-brand-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 100%;
    animation: awsc-rise-in 620ms cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  .awsc-brand-logo {
    width: clamp(300px, 46cqw, 560px);
    height: auto;
    filter: drop-shadow(0 16px 28px rgba(0,0,0,0.35));
    animation: awsc-float 6s ease-in-out infinite;
    animation-delay: 620ms;
  }

  .awsc-brand-rule {
    width: 56px;
    height: 3px;
    margin: 24px 0 16px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
    border-radius: 2px;
  }

  .awsc-brand-caption {
    max-width: 100%;
    font-family: 'Poppins', sans-serif;
    font-size: clamp(0.95rem, 3.2cqw, 1.15rem);
    font-weight: 500;
    letter-spacing: 0.08em;
    color: rgba(255,255,255,0.62);
  }

  .awsc-brand-tagline {
    margin: 40px 0 0;
    font-family: 'Poppins', sans-serif;
    font-size: clamp(0.95rem, 2.6cqw, 1.2rem);
    font-weight: 700;
    letter-spacing: -0.01em;
    color: rgba(255,255,255,0.78);
    text-align: center;
  }

  .awsc-brand-dot {
    color: #D61F31;
  }

  .awsc-login-panel {
    flex: 1 1 0%;
    min-width: 420px;
    max-width: 560px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .awsc-login-card {
    width: 100%;
    max-width: 400px;
    background: #fff;
    border-radius: 26px;
    padding: 44px 38px;
    border: 1px solid rgba(16,35,63,0.06);
    box-shadow: 0 1px 2px rgba(16,35,63,0.04), 0 24px 48px -16px rgba(16,35,63,0.18);
    animation: awsc-card-in 520ms cubic-bezier(0.23, 1, 0.32, 1) both;
  }

  .awsc-mobile-brand {
    display: none;
  }

  .awsc-card-icon {
    width: 46px;
    height: auto;
    margin-bottom: 18px;
    filter: drop-shadow(0 6px 14px rgba(16,35,63,0.18));
  }

  .awsc-card-eyebrow {
    font-size: 12px;
    font-weight: 600;
    color: #7A92B0;
    margin-bottom: 6px;
  }

  .awsc-card-eyebrow strong {
    color: #1A365E;
    font-weight: 700;
  }

  .awsc-card-title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.2;
    color: #10233F;
    margin: 0 0 26px;
  }

  .awsc-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: #F1F4F9;
    border-radius: 13px;
    margin-bottom: 22px;
  }

  .awsc-tab {
    flex: 1;
    padding: 9px 6px;
    border: none;
    border-radius: 9px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    background: transparent;
    transition: background-color 180ms ease, color 180ms ease, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .awsc-tab:active {
    transform: scale(0.96);
  }

  .awsc-input {
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .awsc-input:focus {
    border-color: #1A365E;
    box-shadow: 0 0 0 4px rgba(26,54,94,0.12);
  }

  .awsc-btn {
    transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), filter 160ms ease;
  }

  .awsc-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .awsc-btn:not(:disabled):hover {
    filter: brightness(1.06);
  }

  .awsc-error {
    animation: awsc-fade-up 220ms ease-out both;
  }

  @keyframes awsc-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes awsc-rise-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes awsc-fade-up {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes awsc-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  @media (max-width: 900px) {
    .awsc-login-brand { display: none; }
    .awsc-login-panel {
      flex: 1 1 100%;
      max-width: 100%;
      min-width: 0;
      min-height: 100vh;
      padding: 20px;
    }
    .awsc-mobile-brand {
      display: block;
      background: #0F2240;
      border-radius: 14px;
      padding: 16px 12px;
      text-align: center;
      margin-bottom: 20px;
    }
    .awsc-card-icon {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .awsc-brand-content, .awsc-login-card, .awsc-error { animation-duration: 1ms; }
    .awsc-brand-crest { animation: none; }
  }
`

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #E4EAF2',
  borderRadius: 10,
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
  const { refreshSession: refreshParentSession } = useParentPortal()

  const [tab, setTab] = useState<LoginTab>(initialTab)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffLoading, setStaffLoading] = useState(false)

  const [parentEmail, setParentEmail] = useState('')
  const [parentPassword, setParentPassword] = useState('')
  const [parentError, setParentError] = useState<string | null>(null)
  const [parentLoading, setParentLoading] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentError, setStudentError] = useState('')
  const [studentLoading, setStudentLoading] = useState(false)

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    setStaffError(null)
    setStaffLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStaffError(error.message)
      setStaffLoading(false)
      return
    }

    // Wait for the global auth store to be populated before navigating, so
    // the route guard doesn't bounce back to /login on the first attempt.
    await syncAuthState(data.session)
    setStaffLoading(false)
    navigate('/dashboard')
  }

  async function handleParentLogin(e: React.FormEvent) {
    e.preventDefault()
    setParentError(null)
    setParentLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email: parentEmail, password: parentPassword })

    if (error || !data.user) {
      setParentError(error?.message ?? 'Login failed.')
      setParentLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (!profile || (profile as Record<string, unknown>).role !== 'parent') {
      await supabase.auth.signOut()
      setParentError('This account does not have parent access.')
      setParentLoading(false)
      return
    }

    // Wait for ParentPortalContext.session to be populated before navigating,
    // so the layout guard doesn't bounce back to /parent/login on the first attempt.
    await refreshParentSession()
    setParentLoading(false)
    navigate('/parent/dashboard')
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

      // Password check happens server-side (api/student-portal/login.js), which also
      // issues a signed session token — the portal_password value never reaches the client.
      const res = await fetch('/api/student-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: normalizedStudentId, portalPassword: studentPassword }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        setStudentError(body.error || 'Incorrect student ID or password.')
        return
      }

      try {
        sessionStorage.setItem('sp_session', JSON.stringify(body.session))
        sessionStorage.setItem('sp_token', body.token)
      } catch { /* ignore */ }

      // Wait for StudentPortalContext.session to be populated before navigating,
      // so the layout guard doesn't bounce back to /portal/login on the first attempt.
      await refreshSession()
      navigate('/portal/dashboard')
    } finally {
      setStudentLoading(false)
    }
  }

  function switchTab(nextTab: LoginTab) {
    setTab(nextTab)
    setStaffError(null)
    setStudentError('')
    setParentError(null)
  }

  return (
    <div className="awsc-login-shell">
      <style>{pageStyles}</style>

      <div className="awsc-login-brand">
        <img src="/Logo_a.png" alt="" className="awsc-brand-watermark" aria-hidden="true" />
        <div className="awsc-brand-content">
          <img src="/Logo_w_trim.png" alt="American World School" className="awsc-brand-logo" />
          <div className="awsc-brand-rule" />
          <div className="awsc-brand-caption">Asia’s First Entrepreneurial School.</div>
          <div className="awsc-brand-tagline">
            Be Seen<span className="awsc-brand-dot">.</span> Be Heard<span className="awsc-brand-dot">.</span> Be Known<span className="awsc-brand-dot">.</span> Belong<span className="awsc-brand-dot">.</span>
          </div>
        </div>
      </div>

      <div className="awsc-login-panel">
        <div className="awsc-login-card">
          <div className="awsc-mobile-brand">
            <img
              src="/Logo_w_trim.png"
              alt="AWS"
              style={{ width: '100%', maxWidth: 280, height: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }}
            />
          </div>

          <img src="/Logo_a.png" alt="" className="awsc-card-icon" aria-hidden="true" />
          <div className="awsc-card-eyebrow">Welcome to <strong>American World School</strong></div>
          <h1 className="awsc-card-title">Sign in to your account</h1>

          <div className="awsc-tabs">
            {([
              { key: 'staff',  label: 'Staff',  activeColor: '#D61F31' },
              { key: 'student',label: 'Student', activeColor: '#1A365E' },
              { key: 'parent', label: 'Parent', activeColor: '#6B21A8' },
            ] as const).map(t => (
              <button
                key={t.key}
                type="button"
                className="awsc-tab"
                data-active={tab === t.key}
                onClick={() => switchTab(t.key)}
                style={{
                  background: tab === t.key ? t.activeColor : 'transparent',
                  color: tab === t.key ? '#fff' : '#7A92B0',
                  boxShadow: tab === t.key ? '0 2px 8px rgba(16,35,63,0.16)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

        {tab === 'parent' ? (
          <form onSubmit={handleParentLogin}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="pp-login-email" style={labelStyle}>Email Address</label>
              <input
                id="pp-login-email"
                type="email"
                placeholder="parent@email.com"
                autoComplete="username"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                style={inputStyle}
                className="awsc-input"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
              <label htmlFor="pp-login-pass" style={labelStyle}>Password</label>
              <input
                id="pp-login-pass"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                style={inputStyle}
                className="awsc-input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={parentLoading}
              className="awsc-btn"
              style={{
                width: '100%', padding: 13, border: 'none', borderRadius: 11,
                fontSize: 14, fontWeight: 700, marginTop: 6,
                background: parentLoading ? '#C0C0C0' : '#6B21A8',
                color: '#fff',
                cursor: parentLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {parentLoading ? 'Signing in…' : 'Sign In to Parent Portal'}
            </button>
            {parentError && <div style={errorStyle} className="awsc-error">{parentError}</div>}
            <div style={{ fontSize: 11, color: '#7A92B0', textAlign: 'center', marginTop: 10 }}>
              Don&apos;t have an account? Contact your school admin to set one up.
            </div>
          </form>
        ) : tab === 'staff' ? (
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
                className="awsc-input"
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
                className="awsc-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={staffLoading}
              className="awsc-btn"
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
              }}
            >
              {staffLoading ? 'Signing in…' : 'Sign In'}
            </button>

            {staffError && <div style={errorStyle} className="awsc-error">{staffError}</div>}
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
                className="awsc-input"
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
                className="awsc-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={studentLoading}
              className="awsc-btn"
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
              }}
            >
              {studentLoading ? 'Signing in…' : 'Sign In'}
            </button>

            {studentError && <div style={errorStyle} className="awsc-error">{studentError}</div>}

            <div style={{ fontSize: 11, color: '#7A92B0', textAlign: 'center', marginTop: 10 }}>
              Don&apos;t have an account? Contact your school admin to set one up.
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
