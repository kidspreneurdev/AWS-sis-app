import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const SP_NAV = [
  { id: 'sp_dash', icon: '🏠', label: 'Dashboard', to: '/portal/dashboard' },
  { id: 'sp_grades', icon: '📊', label: 'My Grades', to: '/portal/grades' },
  { id: 'sp_attend', icon: '📅', label: 'Attendance', to: '/portal/attendance' },
  { id: 'sp_assign', icon: '📝', label: 'Assignments', to: '/portal/assignments' },
  { id: 'sp_learning', icon: '📚', label: 'My Learning', to: '/portal/learning' },
  { id: 'sp_project', icon: '🚀', label: 'My Project', to: '/portal/project' },
  { id: 'sp_portfolio', icon: '🗂️', label: 'Portfolio', to: '/portal/portfolio' },
  { id: 'sp_goals', icon: '🎯', label: 'Goals & Reflections', to: '/portal/goals' },
  { id: 'sp_skills', icon: '🧠', label: 'Skill Graph', to: '/portal/skills' },
  { id: 'sp_wellness', icon: '💚', label: 'Wellness', to: '/portal/wellness' },
  { id: 'sp_lab', icon: '💡', label: 'Innovation Lab', to: '/portal/lab' },
  { id: 'sp_rwlog', icon: '🌍', label: 'Real-World Log', to: '/portal/rwlog' },
  { id: 'sp_fees', icon: '💳', label: 'My Fees', to: '/portal/fees' },
  { id: 'sp_docs', icon: '📄', label: 'My Documents', to: '/portal/documents' },
  { id: 'sp_badges', icon: '🏅', label: 'My Badges', to: '/portal/badges' },
  { id: 'sp_profile', icon: '👤', label: 'My Profile', to: '/portal/profile' },
]

export function StudentPortalLayout() {
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        background: 'linear-gradient(180deg,#0F2240,#1A365E)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <img
            src="/Logo.png"
            alt="AWS"
            style={{ height: 48, width: 'auto', objectFit: 'contain', margin: '16px auto 8px', display: 'block' }}
          />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
            Student Portal
          </div>
        </div>

        {/* Student pill */}
        <div style={{ padding: '8px' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.07)', borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.fullName || 'Student'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
              {session.grade || 'Student'}{session.campus ? ` · ${session.campus}` : ''}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 0 58px', overflowY: 'auto' }}>
          {SP_NAV.map(item => (
            <NavLink key={item.id} to={item.to}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  margin: '2px 8px',
                  borderRadius: 8,
                  border: 'none',
                  background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,.7)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: 'calc(100% - 16px)',
                  boxSizing: 'border-box',
                  textAlign: 'left',
                  fontFamily: 'Poppins, sans-serif',
                  transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}>
                  <span style={{ fontSize: 15, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(180deg,rgba(15,34,64,.2),rgba(15,34,64,.95))' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 8,
              color: 'rgba(255,255,255,.6)',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              transition: 'background 160ms cubic-bezier(0.23, 1, 0.32, 1), color 160ms cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9EB3C8' }}>Student Portal</span>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
