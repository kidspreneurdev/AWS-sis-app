import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useParentPortal } from '@/contexts/ParentPortalContext'
import { StudentPortalContext } from '@/contexts/StudentPortalContext'
import { PortalReadOnlyContext } from '@/contexts/PortalReadOnlyContext'

const PP_NAV = [
  { id: 'pp_dash',     icon: '🏠', label: 'Dashboard',         to: '/parent/dashboard' },
  { id: 'pp_grades',   icon: '📊', label: 'Grades',             to: '/parent/grades' },
  { id: 'pp_attend',   icon: '📅', label: 'Attendance',         to: '/parent/attendance' },
  { id: 'pp_assign',   icon: '📝', label: 'Assignments',        to: '/parent/assignments' },
  { id: 'pp_learning', icon: '📚', label: 'Learning',           to: '/parent/learning' },
  { id: 'pp_project',  icon: '🚀', label: 'Project',            to: '/parent/project' },
  { id: 'pp_portfolio',icon: '🗂️', label: 'Portfolio',         to: '/parent/portfolio' },
  { id: 'pp_goals',    icon: '🎯', label: 'Goals',              to: '/parent/goals' },
  { id: 'pp_skills',   icon: '🧠', label: 'Skills',             to: '/parent/skills' },
  { id: 'pp_wellness', icon: '💚', label: 'Wellness',           to: '/parent/wellness' },
  { id: 'pp_lab',      icon: '💡', label: 'Innovation Lab',     to: '/parent/lab' },
  { id: 'pp_rwlog',    icon: '🌍', label: 'Real-World Log',     to: '/parent/rwlog' },
  { id: 'pp_docs',     icon: '📄', label: 'Documents',          to: '/parent/documents' },
  { id: 'pp_badges',   icon: '🏅', label: 'Badges',             to: '/parent/badges' },
  { id: 'pp_msgs',     icon: '💬', label: 'Messages',           to: '/parent/messages' },
  { id: 'pp_requests', icon: '📬', label: 'Requests',           to: '/parent/requests' },
  { id: 'pp_profile',  icon: '👤', label: 'Profile',            to: '/parent/profile' },
]

export function ParentPortalLayout() {
  const { session, loading, activeChild, setActiveChildIndex, logout } = useParentPortal()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#6B21A8', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!session) return <Navigate to="/parent/login" replace />

  async function handleLogout() {
    await logout()
    navigate('/parent/login')
  }

  // Provide a fake student session (the active child) to all SP pages
  const fakeStudentCtx = {
    session: activeChild,
    loading: false,
    setSession: () => {},
    refreshSession: async () => activeChild,
    logout: async () => {},
  }

  return (
    <StudentPortalContext.Provider value={fakeStudentCtx}>
      <PortalReadOnlyContext.Provider value={{ readOnly: true }}>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{
            width: 220,
            background: 'linear-gradient(180deg,#3B0764,#6B21A8)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Logo */}
            <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <img
                src="/Logo_w.png"
                alt="AWS"
                style={{ height: 48, width: 'auto', objectFit: 'contain', margin: '16px auto 8px', display: 'block' }}
              />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                Parent Portal
              </div>
            </div>

            {/* Parent name */}
            <div style={{ padding: '8px' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.08)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.parentName || 'Parent'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>Parent Account</div>
              </div>
            </div>

            {/* Child switcher */}
            {session.children.length > 0 && (
              <div style={{ padding: '0 8px 4px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 6, marginBottom: 4 }}>
                  Viewing Child
                </div>
                {session.children.length === 1 ? (
                  <div style={{ padding: '9px 14px', background: 'rgba(255,255,255,.12)', borderRadius: 9, border: '1px solid rgba(255,255,255,.2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{activeChild?.fullName ?? '—'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>{activeChild?.grade}{activeChild?.campus ? ` · ${activeChild.campus}` : ''}</div>
                  </div>
                ) : (
                  <select
                    value={session.activeChildIndex}
                    onChange={e => setActiveChildIndex(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 9,
                      border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.12)',
                      color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'Poppins, sans-serif', outline: 'none',
                    }}
                  >
                    {session.children.map((c, i) => (
                      <option key={c.dbId} value={i} style={{ background: '#6B21A8', color: '#fff' }}>
                        {c.fullName} ({c.grade})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {session.children.length === 0 && (
              <div style={{ margin: '8px', padding: '12px', background: 'rgba(255,255,255,.08)', borderRadius: 9, border: '1px dashed rgba(255,255,255,.2)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>No children linked yet.</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>Contact your school admin.</div>
              </div>
            )}

            {/* Nav */}
            <nav style={{ flex: 1, padding: '4px 0 58px', overflowY: 'auto' }}>
              {PP_NAV.map(item => (
                <NavLink key={item.id} to={item.to}>
                  {({ isActive }) => (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', margin: '1px 8px', borderRadius: 8,
                      background: isActive ? 'rgba(255,255,255,.15)' : 'transparent',
                      color: isActive ? '#fff' : 'rgba(255,255,255,.65)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      width: 'calc(100% - 16px)', boxSizing: 'border-box',
                      fontFamily: 'Poppins, sans-serif',
                      transition: 'background 160ms, color 160ms',
                    }}>
                      <span style={{ fontSize: 14, lineHeight: 1, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Footer */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(180deg,rgba(59,7,100,.2),rgba(59,7,100,.95))' }}>
              <button
                onClick={() => void handleLogout()}
                style={{
                  width: '100%', padding: '8px', background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.15)', borderRadius: 8,
                  color: 'rgba(255,255,255,.6)', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Main */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ background: 'linear-gradient(135deg,#3B0764,#6B21A8)', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>Parent Portal</span>
              {activeChild && (
                <>
                  <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 12 }}>·</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{activeChild.fullName}</span>
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,.15)', color: 'rgba(255,255,255,.8)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                    View-only
                  </span>
                </>
              )}
            </header>
            <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {session.children.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#7A92B0', textAlign: 'center', gap: 12 }}>
                  <div style={{ fontSize: 48 }}>👨‍👩‍👧</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E' }}>No children linked to your account</div>
                  <div style={{ fontSize: 13 }}>Please contact your school administrator to link your children.</div>
                </div>
              ) : (
                <Outlet />
              )}
            </main>
          </div>
        </div>
      </PortalReadOnlyContext.Provider>
    </StudentPortalContext.Provider>
  )
}
