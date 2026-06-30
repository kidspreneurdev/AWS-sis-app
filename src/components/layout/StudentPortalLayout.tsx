import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { toLegacyStudentGradeValue } from '@/types/student'

const SP_NAV = [
  { id: 'sp_dash',     icon: '🏠', label: 'Dashboard',          to: '/portal/dashboard' },
  { id: 'sp_grades',   icon: '📊', label: 'My Grades',           to: '/portal/grades' },
  { id: 'sp_attend',   icon: '📅', label: 'Attendance',          to: '/portal/attendance' },
  { id: 'sp_assign',   icon: '📝', label: 'Assignments',         to: '/portal/assignments' },
  { id: 'sp_learning', icon: '📚', label: 'My Learning',         to: '/portal/learning' },
  { id: 'sp_project',  icon: '🚀', label: 'My Project',          to: '/portal/project' },
  { id: 'sp_portfolio',icon: '🗂️', label: 'Portfolio',           to: '/portal/portfolio' },
  { id: 'sp_goals',    icon: '🎯', label: 'Goals & Reflections', to: '/portal/goals' },
  { id: 'sp_skills',   icon: '🧠', label: 'Skill Graph',         to: '/portal/skills' },
  { id: 'sp_wellness', icon: '💚', label: 'Wellness',            to: '/portal/wellness' },
  { id: 'sp_lab',      icon: '💡', label: 'Innovation Lab',      to: '/portal/lab' },
  { id: 'sp_rwlog',    icon: '🌍', label: 'Real-World Log',      to: '/portal/rwlog' },
  { id: 'sp_fees',     icon: '💳', label: 'My Fees',             to: '/portal/fees' },
  { id: 'sp_docs',     icon: '📄', label: 'My Documents',        to: '/portal/documents' },
  { id: 'sp_badges',   icon: '🏅', label: 'My Badges',           to: '/portal/badges' },
  { id: 'sp_profile',  icon: '👤', label: 'My Profile',          to: '/portal/profile' },
]

const K5_NAV = [
  { id: 'k5_dash',    icon: '🏠', label: 'My Home',      to: '/portal/dashboard' },
  { id: 'k5_learn',   icon: '📚', label: 'My Lessons',   to: '/portal/learning' },
  { id: 'k5_stars',   icon: '⭐', label: 'My Stars',     to: '/portal/badges' },
  { id: 'k5_grades',  icon: '📊', label: 'My Grades',    to: '/portal/grades' },
  { id: 'k5_attend',  icon: '📅', label: 'Attendance',   to: '/portal/attendance' },
  { id: 'k5_certs',   icon: '🏆', label: 'Certificates', to: '/portal/k5-certificates' },
  { id: 'k5_port',    icon: '🎨', label: 'My Portfolio', to: '/portal/portfolio' },
  { id: 'k5_profile', icon: '👤', label: 'My Profile',   to: '/portal/profile' },
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

  const gradeNum = toLegacyStudentGradeValue(session.grade)
  const isK5 = gradeNum !== null && gradeNum <= 5

  async function handleLogout() {
    await logout()
    navigate('/portal/login')
  }

  const nav = isK5 ? K5_NAV : SP_NAV
  const sidebarWidth = isK5 ? 185 : 220
  const initials = session.fullName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg,#0F2240 0%,#1A365E 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding: isK5 ? '14px 12px 10px' : '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: isK5 ? 'center' : undefined }}>
          <img
            src="/Logo_w.png"
            alt="AWS"
            style={{ height: isK5 ? 40 : 48, width: 'auto', objectFit: 'contain', margin: isK5 ? '0 auto' : '16px auto 8px', display: 'block' }}
          />
          {!isK5 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
              Student Portal
            </div>
          )}
        </div>

        {/* Student identity */}
        {isK5 ? (
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
        ) : (
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
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: isK5 ? '8px 0' : '0 0 58px', overflowY: 'auto' }}>
          {nav.map(item => (
            <NavLink key={item.id} to={item.to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isK5 ? '11px 14px' : '10px 14px',
                  margin: '2px 8px',
                  borderRadius: isK5 ? 9 : 8,
                  background: isActive
                    ? (isK5 ? 'rgba(214,31,49,.22)' : 'rgba(255,255,255,.12)')
                    : 'transparent',
                  borderLeft: isK5 ? `3px solid ${isActive ? '#D61F31' : 'transparent'}` : 'none',
                  color: isActive ? '#fff' : (isK5 ? 'rgba(255,255,255,.58)' : 'rgba(255,255,255,.7)'),
                  fontSize: 12,
                  fontWeight: isK5 ? 700 : 600,
                  cursor: 'pointer',
                  width: 'calc(100% - 16px)',
                  boxSizing: 'border-box' as const,
                  fontFamily: 'Poppins, sans-serif',
                  transition: 'background 160ms, color 160ms',
                }}>
                  <span style={{ fontSize: isK5 ? 16 : 15, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        {isK5 ? (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <button
              onClick={handleLogout}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, color: 'rgba(255,255,255,.55)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(180deg,rgba(15,34,64,.2),rgba(15,34,64,.95))' }}>
            <button
              onClick={handleLogout}
              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: 'rgba(255,255,255,.6)', fontSize: 11, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', transition: 'background 160ms, color 160ms' }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* ── Main area ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, gap: 10 }}>
          {isK5 ? (
            <>
              <span style={{ fontSize: 16 }}>⭐</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FAC600' }}>K–5 Learning Portal</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>2025–26</span>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9EB3C8' }}>Student Portal</span>
          )}
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: isK5 ? 20 : 24 }}>
          <Outlet />
        </main>
      </div>

    </div>
  )
}
