import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { toLegacyStudentGradeValue } from '@/types/student'
import { authedFetch, timeAgo, type PortalNotification } from '@/lib/studentPortalApi'
import {
  Home, GraduationCap, UserCheck, CalendarRange, ClipboardList,
  BookOpen, FolderArchive, FileCheck, CalendarDays, Bell,
  UserCircle, Star, Trophy, Palette, PanelLeftClose, PanelLeftOpen, LogOut, type LucideIcon,
} from 'lucide-react'

const SIDEBAR_COLLAPSED_KEY = 'sp_sidebar_collapsed'
function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

type SpNavItem = { id: string; icon: LucideIcon; label: string; to: string }
type SpNavGroup = { id: string; label: string; items: SpNavItem[] }

// Interaction states (:hover/:active/:focus-visible) can't be expressed via inline
// style objects, so they live here as real CSS — same pattern as LoginPage.tsx.
const sidebarStyles = `
  .sp-nav-link { text-decoration: none; display: block; }

  .sp-sidebar-rail { transition: width 220ms cubic-bezier(0.23,1,0.32,1); }

  .sp-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    margin: 2px 8px;
    border-radius: 8px;
    border-left: 3px solid transparent;
    background: transparent;
    color: rgba(255,255,255,.7);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    width: calc(100% - 16px);
    box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1);
  }

  .sp-nav-item--k5 {
    padding: 11px 14px;
    border-radius: 9px;
    font-weight: 700;
    color: rgba(255,255,255,.58);
  }

  .sp-nav-item--active {
    background: rgba(255,255,255,.12);
    border-left-color: #D61F31;
    color: #fff;
  }

  .sp-nav-item--k5.sp-nav-item--active {
    background: rgba(214,31,49,.22);
    color: #fff;
  }

  @media (hover: hover) and (pointer: fine) {
    .sp-nav-item:not(.sp-nav-item--active):hover {
      background: rgba(255,255,255,.06);
      color: rgba(255,255,255,.9);
    }
  }

  .sp-nav-item:active { transform: scale(0.97); }

  .sp-nav-item:focus-visible {
    outline: 2px solid #D61F31;
    outline-offset: 2px;
  }

  .sp-nav-item--collapsed {
    justify-content: center;
    gap: 0;
    padding-left: 0;
    padding-right: 0;
    width: 44px;
    margin-left: auto;
    margin-right: auto;
  }

  .sp-nav-label {
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 1;
    max-width: 160px;
    transition: opacity 140ms ease, max-width 200ms cubic-bezier(0.23,1,0.32,1), margin 200ms cubic-bezier(0.23,1,0.32,1);
  }

  .sp-nav-item--collapsed .sp-nav-label {
    opacity: 0;
    max-width: 0;
    margin: 0;
  }

  .sp-group-divider {
    height: 1px;
    margin: 10px 18px;
    background: rgba(255,255,255,.14);
  }

  .sp-collapse-toggle {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 36px;
    border-radius: 8px;
    background: #1A365E;
    border: 1px solid rgba(255,255,255,.15);
    box-shadow: 0 1px 4px rgba(15,34,64,.3);
    color: rgba(255,255,255,.65);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    z-index: 10;
    transform: translateY(-50%);
    transition: left 220ms cubic-bezier(0.23,1,0.32,1), background 160ms ease, color 160ms ease, transform 120ms cubic-bezier(0.23,1,0.32,1);
  }

  .sp-collapse-toggle:active { transform: translateY(-50%) scale(0.92); }

  .sp-collapse-toggle:focus-visible {
    outline: 2px solid #D61F31;
    outline-offset: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .sp-collapse-toggle:hover { background: #24487A; color: #fff; }
  }

  .sp-signout-btn {
    width: 100%;
    padding: 8px;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 8px;
    color: rgba(255,255,255,.6);
    font-size: 11px;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1);
  }

  .sp-signout-btn--k5 {
    background: rgba(255,255,255,.07);
    border-color: rgba(255,255,255,.14);
    color: rgba(255,255,255,.55);
    font-family: inherit;
  }

  @media (hover: hover) and (pointer: fine) {
    .sp-signout-btn:hover {
      background: rgba(214,31,49,.18);
      border-color: rgba(214,31,49,.45);
      color: #fff;
    }
  }

  .sp-signout-btn:active { transform: scale(0.97); }

  .sp-signout-btn:focus-visible {
    outline: 2px solid #D61F31;
    outline-offset: 2px;
  }

  .sp-nav::-webkit-scrollbar { width: 6px; }
  .sp-nav::-webkit-scrollbar-track { background: transparent; }
  .sp-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 3px; }
  .sp-nav { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent; }

  @media (prefers-reduced-motion: reduce) {
    .sp-nav-item, .sp-signout-btn {
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .sp-nav-item:active, .sp-signout-btn:active { transform: none; }
    .sp-nav-label, .sp-collapse-toggle, .sp-sidebar-rail { transition-duration: 1ms; }
  }

  @keyframes sp-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sp-modal-in {
    from { opacity: 0; transform: scale(0.95) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .sp-modal-backdrop { animation: sp-backdrop-in 160ms ease-out both; }
  .sp-modal-card { animation: sp-modal-in 200ms cubic-bezier(0.23,1,0.32,1) both; }

  .sp-modal-btn {
    padding: 9px 20px; border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: filter 140ms ease, transform 120ms cubic-bezier(0.23,1,0.32,1);
  }
  .sp-modal-btn:active:not(:disabled) { transform: scale(0.97); }
  .sp-modal-btn:focus-visible { outline: 2px solid #D61F31; outline-offset: 2px; }
  @media (hover: hover) and (pointer: fine) {
    .sp-modal-btn:not(:disabled):hover { filter: brightness(1.08); }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-modal-backdrop, .sp-modal-card { animation-duration: 1ms; }
  }

  .sp-bell-btn {
    position: relative;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 160ms ease, transform 140ms cubic-bezier(0.23,1,0.32,1);
  }
  @media (hover: hover) and (pointer: fine) {
    .sp-bell-btn:hover { background: rgba(255,255,255,.16); }
  }
  .sp-bell-btn:active { transform: scale(0.94); }
  .sp-bell-btn:focus-visible { outline: 2px solid #D61F31; outline-offset: 2px; }

  .sp-bell-dot {
    position: absolute;
    top: -2px; right: -2px;
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #D61F31;
    border: 2px solid #0F2240;
  }

  .sp-bell-panel {
    position: fixed;
    width: 340px;
    max-width: calc(100vw - 24px);
    background: #fff;
    border: 1px solid #E4EAF2;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(26,54,94,.16), 0 1px 2px rgba(26,54,94,.06);
    z-index: 3000;
    transform-origin: top right;
    overflow: hidden;
    animation: sp-bell-panel-in 180ms cubic-bezier(0.23,1,0.32,1) both;
  }
  @keyframes sp-bell-panel-in {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .sp-bell-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #F0F3F8;
  }
  .sp-bell-title { font-size: 12.5px; font-weight: 800; color: #1A365E; }

  .sp-bell-markall {
    background: none; border: none; padding: 0;
    font-size: 11px; font-weight: 700; color: #1A365E;
    cursor: pointer; font-family: inherit;
  }
  .sp-bell-markall:disabled { color: #B7C3D6; cursor: default; }
  @media (hover: hover) and (pointer: fine) {
    .sp-bell-markall:not(:disabled):hover { color: #D61F31; }
  }

  .sp-bell-list { max-height: 360px; overflow-y: auto; }

  .sp-bell-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 11px 14px;
    border: none;
    border-left: 3px solid transparent;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    transition: background 140ms ease;
  }
  .sp-bell-item + .sp-bell-item { border-top: 1px solid #F5F7FA; }
  .sp-bell-item--unread { background: #F0F6FF; border-left-color: #D61F31; }
  @media (hover: hover) and (pointer: fine) {
    .sp-bell-item:hover { background: #F7F9FC; }
    .sp-bell-item--unread:hover { background: #E9F1FF; }
  }

  .sp-bell-empty { padding: 28px 14px; text-align: center; font-size: 12px; color: #9AACC4; }

  .sp-bell-footer {
    display: block;
    width: 100%;
    text-align: center;
    padding: 11px;
    border: none;
    border-top: 1px solid #F0F3F8;
    background: #FAFBFD;
    color: #1A365E;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 140ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .sp-bell-footer:hover { background: #F0F3F8; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-bell-panel { animation-duration: 1ms; }
    .sp-bell-btn:active { transform: none; }
  }
`

// Sections grouped by how often a student needs them — all always expanded.
const SP_GROUPS: SpNavGroup[] = [
  {
    id: 'today', label: 'Today',
    items: [
      { id: 'sp_dash',     icon: Home,          label: 'Dashboard',    to: '/portal/dashboard' },
      { id: 'sp_timetable',icon: CalendarRange, label: 'My Timetable', to: '/portal/timetable' },
      { id: 'sp_notif',    icon: Bell,          label: 'Notifications', to: '/portal/notifications' },
    ],
  },
  {
    id: 'learning', label: 'Learning',
    items: [
      { id: 'sp_learning', icon: BookOpen,      label: 'My Learning',    to: '/portal/learning' },
      { id: 'sp_assign',   icon: ClipboardList, label: 'My Assignments', to: '/portal/assignments' },
      { id: 'sp_grades',   icon: GraduationCap, label: 'My Grades',     to: '/portal/grades' },
      { id: 'sp_attend',   icon: UserCheck,     label: 'My Attendance', to: '/portal/attendance' },
      // My Quizzes, Skill Graph, Share it — temporarily disabled, not yet ready for students.
    ],
  },
  // "Me" section (Goals & Reflections, Wellness, Real-World Log, My Badges) — temporarily
  // disabled in full, not yet ready for students.
  {
    id: 'admin', label: 'School Admin',
    items: [
      { id: 'sp_enrollment_docs', icon: FolderArchive, label: 'Onboarding', to: '/portal/documents-hub' },
      { id: 'sp_policy',   icon: FileCheck,     label: 'Policy Documents',  to: '/portal/policy-documents' },
      { id: 'sp_calendar', icon: CalendarDays,  label: 'Academic Calendar', to: '/portal/academic-calendar' },
      { id: 'sp_profile',  icon: UserCircle,    label: 'My Profile',        to: '/portal/profile' },
    ],
  },
]

const K5_NAV: SpNavItem[] = [
  { id: 'k5_dash',    icon: Home,          label: 'My Home',      to: '/portal/dashboard' },
  { id: 'k5_learn',   icon: BookOpen,      label: 'My Lessons',   to: '/portal/learning' },
  { id: 'k5_stars',   icon: Star,          label: 'My Stars',     to: '/portal/badges' },
  { id: 'k5_grades',  icon: GraduationCap, label: 'My Grades',    to: '/portal/grades' },
  { id: 'k5_attend',  icon: UserCheck,     label: 'Attendance',   to: '/portal/attendance' },
  { id: 'k5_timetable', icon: CalendarRange, label: 'My Timetable', to: '/portal/timetable' },
  { id: 'k5_notif',   icon: Bell,          label: 'Notifications', to: '/portal/notifications' },
  { id: 'k5_certs',   icon: Trophy,        label: 'Certificates', to: '/portal/k5-certificates' },
  { id: 'k5_calendar', icon: CalendarDays, label: 'Calendar',    to: '/portal/academic-calendar' },
  { id: 'k5_port',    icon: Palette,       label: 'My Portfolio', to: '/portal/portfolio' },
  { id: 'k5_profile', icon: UserCircle,    label: 'My Profile',   to: '/portal/profile' },
]

const NOTIFICATIONS_POLL_MS = 60_000

const BELL_PANEL_WIDTH = 340

function NotificationBell({ getToken }: { getToken: () => string | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [markingAll, setMarkingAll] = useState(false)

  async function fetchNotifications() {
    const token = getToken()
    if (!token) return
    setLoading(true)
    try {
      const body = await authedFetch(token, '/api/student-portal/list-my-notifications?limit=5')
      setNotifications((body.notifications ?? []) as PortalNotification[])
      setUnreadCount(typeof body.unreadCount === 'number' ? body.unreadCount : 0)
    } catch {
      // Silently ignore — the bell just won't update this cycle.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(fetchNotifications, NOTIFICATIONS_POLL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const updatePos = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.max(12, Math.min(r.right - BELL_PANEL_WIDTH, window.innerWidth - BELL_PANEL_WIDTH - 12))
    setPos({ top: r.bottom + 10, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function openNotification(n: PortalNotification) {
    setOpen(false)
    if (!n.read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnreadCount(prev => Math.max(0, prev - 1))
      const token = getToken()
      if (token) {
        try { await authedFetch(token, '/api/student-portal/mark-notification-read', { method: 'POST', body: JSON.stringify({ notificationId: n.id }) }) } catch { /* best-effort */ }
      }
    }
    navigate(`/portal/notifications?id=${n.id}`)
  }

  async function markAllRead() {
    if (unreadCount === 0) return
    setMarkingAll(true)
    setNotifications(prev => prev.map(x => ({ ...x, read: true })))
    setUnreadCount(0)
    const token = getToken()
    if (token) {
      try { await authedFetch(token, '/api/student-portal/mark-all-notifications-read', { method: 'POST' }) } catch { /* best-effort */ }
    }
    setMarkingAll(false)
  }

  return (
    <div style={{ marginLeft: 'auto' }}>
      <button
        ref={btnRef}
        className="sp-bell-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && <span className="sp-bell-dot" aria-hidden="true" />}
      </button>

      {open && pos && createPortal(
        <div ref={panelRef} className="sp-bell-panel" role="menu" style={{ top: pos.top, left: pos.left }}>
          <div className="sp-bell-header">
            <span className="sp-bell-title">Notifications</span>
            <button className="sp-bell-markall" onClick={markAllRead} disabled={unreadCount === 0 || markingAll}>
              Mark all read
            </button>
          </div>
          <div className="sp-bell-list">
            {notifications.length === 0 ? (
              <div className="sp-bell-empty">{loading ? 'Loading…' : "You're all caught up."}</div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  className={`sp-bell-item${n.read ? '' : ' sp-bell-item--unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: n.read ? 600 : 800, color: '#1A365E' }}>{n.subject}</span>
                    <span style={{ fontSize: 14, color: '#9AACC4', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.sentAt)}</span>
                  </div>
                  <div style={{ fontSize: 16, color: '#7A92B0', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.content}
                  </div>
                </button>
              ))
            )}
          </div>
          <button className="sp-bell-footer" onClick={() => { setOpen(false); navigate('/portal/notifications') }}>
            View more
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function StudentPortalLayout() {
  const { session, loading, logout, getToken } = useStudentPortal()
  const navigate = useNavigate()
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [collapsed, setCollapsed] = useState(getStoredCollapsed)

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
    setSigningOut(true)
    await logout()
    navigate('/portal/login')
  }

  const sidebarWidth = isK5 ? 185 : (collapsed ? 64 : 220)
  const initials = session.fullName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch { /* per-viewer convenience only */ }
      return next
    })
  }

  function renderNavItem(item: SpNavItem) {
    const showCollapsed = !isK5 && collapsed
    return (
      <NavLink key={item.id} to={item.to} className="sp-nav-link" title={showCollapsed ? item.label : undefined}>
        {({ isActive }) => (
          <div className={[
            'sp-nav-item',
            isK5 ? 'sp-nav-item--k5' : '',
            showCollapsed ? 'sp-nav-item--collapsed' : '',
            isActive ? 'sp-nav-item--active' : '',
          ].filter(Boolean).join(' ')}>
            <span aria-hidden="true" style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <item.icon size={isK5 ? 16 : 15} strokeWidth={2} />
            </span>
            <span className={showCollapsed ? 'sp-nav-label' : undefined} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          </div>
        )}
      </NavLink>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <style>{sidebarStyles}</style>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <div className="sp-sidebar-rail" style={{
        width: sidebarWidth,
        background: 'linear-gradient(180deg,#0F2240 0%,#1A365E 100%)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: isK5 ? '14px 12px 10px' : (collapsed ? '14px 8px' : '20px 16px 4px'),
          borderBottom: (isK5 || collapsed) ? '1px solid rgba(255,255,255,0.1)' : 'none',
          textAlign: (isK5 || collapsed) ? 'center' : undefined,
        }}>
          {!isK5 && collapsed ? (
            <img src="/Logo_a.png" alt="AWS" style={{ height: 30, width: 'auto', objectFit: 'contain', margin: '2px auto', display: 'block' }} />
          ) : (
            <img
              src="/Logo_w.png"
              alt="AWS"
              style={isK5
                ? { height: 40, width: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }
                : { width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }}
            />
          )}
        </div>

        {/* Student identity */}
        {isK5 ? (
          <div style={{ padding: '14px 12px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#FAC600',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900, color: '#1A365E',
              margin: '0 auto 8px',
              border: '3px solid rgba(255,255,255,.2)',
            }}>
              {initials}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{session.fullName}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', marginTop: 3 }}>
              Grade {session.grade}{session.campus ? ` · ${session.campus}` : ''}
            </div>
          </div>
        ) : collapsed ? (
          <div style={{ padding: '10px 8px', textAlign: 'center' }} title={session.fullName}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: '#fff',
              margin: '0 auto',
            }}>
              {initials}
            </div>
          </div>
        ) : (
          <div style={{ padding: '4px 16px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color: '#fff',
              margin: '0 auto 10px',
              fontFamily: 'Poppins, sans-serif',
            }}>
              {initials}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.fullName || 'Student'}
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,.5)', marginTop: 3, fontFamily: 'Poppins, sans-serif' }}>
              {session.grade || 'Student'}{session.campus ? ` · ${session.campus}` : ''}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 10,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,.08)',
              fontSize: 15, letterSpacing: 0.5, color: 'rgba(255,255,255,.55)',
              fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}>
              {session.studentId}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav aria-label="Student portal navigation" className="sp-nav" style={{ flex: 1, padding: isK5 ? '8px 0' : '0 0 58px', overflowY: 'auto' }}>
          {isK5 ? (
            K5_NAV.map((item) => renderNavItem(item))
          ) : (
            SP_GROUPS.map((group, index) => {
              const headingId = `sp-group-${group.id}-label`
              return (
                <div key={group.id} role="group" aria-labelledby={headingId}>
                  {collapsed && index > 0 && <div className="sp-group-divider" aria-hidden="true" />}
                  <div
                    id={headingId}
                    style={collapsed
                      ? { height: 0, padding: 0, margin: 0, overflow: 'hidden' }
                      : {
                        width: 'calc(100% - 16px)', margin: '10px 8px 2px', padding: '4px 6px',
                        color: 'rgba(255,255,255,.55)', fontSize: 14, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Poppins, sans-serif',
                      }}
                  >
                    {group.label}
                  </div>
                  {group.items.map((item) => renderNavItem(item))}
                </div>
              )
            })
          )}
        </nav>

        {/* Sign out */}
        {isK5 ? (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <button onClick={() => setConfirmSignOutOpen(true)} className="sp-signout-btn sp-signout-btn--k5">
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(180deg,rgba(15,34,64,.2),rgba(15,34,64,.95))' }}>
            <button
              onClick={() => setConfirmSignOutOpen(true)}
              className="sp-signout-btn"
              title={collapsed ? 'Sign Out' : undefined}
              aria-label={collapsed ? 'Sign Out' : undefined}
              style={collapsed ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}
            >
              {collapsed ? <LogOut size={14} strokeWidth={2} aria-hidden="true" /> : 'Sign Out'}
            </button>
          </div>
        )}
      </div>

      {!isK5 && (
        <button
          onClick={toggleCollapsed}
          className="sp-collapse-toggle"
          style={{ left: sidebarWidth - 9 }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={12} strokeWidth={2} /> : <PanelLeftClose size={12} strokeWidth={2} />}
        </button>
      )}

      {/* ── Main area ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', height: 48, display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, gap: 10 }}>
          {isK5 ? (
            <>
              <Star size={16} color="#FAC600" fill="#FAC600" />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#FAC600' }}>K–5 Learning Portal</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.3)', marginLeft: 4 }}>2025–26</span>
            </>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Greetings, {session.fullName}</span>
          )}
          <NotificationBell getToken={getToken} />
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: isK5 ? 20 : 24 }}>
          <Outlet />
        </main>
      </div>

      {confirmSignOutOpen && (
        <div
          className="sp-modal-backdrop"
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !signingOut) setConfirmSignOutOpen(false) }}
          onKeyDown={e => { if (e.key === 'Escape' && !signingOut) setConfirmSignOutOpen(false) }}
        >
          <div className="sp-modal-card" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: '22px 24px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>Sign out?</div>
            <div style={{ fontSize: 17, color: '#5A7290', lineHeight: 1.55, marginTop: 8 }}>
              You'll need to sign back in with your Student ID and password to access the portal again.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                autoFocus
                onClick={() => setConfirmSignOutOpen(false)}
                disabled={signingOut}
                className="sp-modal-btn"
                style={{ background: '#F0F4FA', color: '#1A365E', opacity: signingOut ? .6 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="sp-modal-btn"
                style={{ background: '#D61F31', color: '#fff', opacity: signingOut ? .7 : 1 }}
              >
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
