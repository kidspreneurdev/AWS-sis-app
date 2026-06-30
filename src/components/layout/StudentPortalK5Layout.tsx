import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const K5_NAV = [
  { id: 'k5_dash',   icon: '🏠', label: 'My Home',      to: '/portal/dashboard' },
  { id: 'k5_learn',  icon: '📚', label: 'My Lessons',   to: '/portal/learning' },
  { id: 'k5_stars',  icon: '⭐', label: 'My Stars',     to: '/portal/badges' },
  { id: 'k5_grades', icon: '📊', label: 'My Grades',    to: '/portal/grades' },
  { id: 'k5_attend', icon: '📅', label: 'Attendance',   to: '/portal/attendance' },
  { id: 'k5_certs',  icon: '🏆', label: 'Certificates', to: '/portal/documents' },
  { id: 'k5_port',   icon: '🎨', label: 'My Portfolio', to: '/portal/portfolio' },
  { id: 'k5_profile',icon: '👤', label: 'My Profile',   to: '/portal/profile' },
]

export function StudentPortalK5Layout() {
  const { session, loading, logout } = useStudentPortal()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!session) return <Navigate to="/portal/login" replace />

  async function handleLogout() {
    await logout()
    navigate('/portal/login')
  }

  const initials = session.fullName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: 185,
        background: 'linear-gradient(180deg,#0F2240 0%,#1A365E 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
      }}>

        {/* Logo */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', textAlign: 'center' }}>
          <img src="/Logo_w.png" alt="AWS" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Student avatar + info */}
        <div style={{ padding: '14px 12px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#FAC600',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 900, color: '#1A365E',
            margin: '0 auto 8px',
            border: '3px solid rgba(255,255,255,.2)',
          }}>
            {initials}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{session.fullName}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 3 }}>
            Grade {session.grade}{session.campus ? ` · ${session.campus}` : ''}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {K5_NAV.map(item => (
            <NavLink key={item.id} to={item.to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  margin: '2px 8px',
                  borderRadius: 9,
                  background: isActive ? 'rgba(214,31,49,.22)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? '#D61F31' : 'transparent'}`,
                  color: isActive ? '#fff' : 'rgba(255,255,255,.58)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background .15s, color .15s',
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '8px', background: 'rgba(255,255,255,.07)',
              border: '1px solid rgba(255,255,255,.14)', borderRadius: 8,
              color: 'rgba(255,255,255,.55)', fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          background: 'linear-gradient(135deg,#0F2240,#1A365E)',
          height: 46, display: 'flex', alignItems: 'center', padding: '0 20px',
          flexShrink: 0, gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FAC600' }}>K–5 Learning Portal</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>2025–26</span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <Outlet />
        </main>
      </div>

    </div>
  )
}
