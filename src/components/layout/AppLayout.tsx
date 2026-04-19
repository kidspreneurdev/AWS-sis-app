import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarProvider, SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import {
  LayoutDashboard, TrendingUp, Users, ClipboardList,
  UserCheck, DollarSign, MessageSquare, FileText, Calendar,
  GraduationCap, BookOpen, FolderKanban, Heart,
  AlertTriangle, Presentation, Layers, Map, Award, BarChart2,
  Settings, Bell, Shield, Briefcase, LogOut, UserPlus,
  BarChart, Clock, Target, FileCheck, StickyNote, Printer,
  PlusSquare, Activity, CheckSquare, FileBarChart, Telescope, Flag,
  Library, BookMarked, BookCopy, UserCog, BarChart3, LayoutList,
} from 'lucide-react'
import { PageHeaderProvider, useSetActionsTarget } from '@/contexts/PageHeaderContext'

type NavItem = { title: string; icon: React.ComponentType<{ style?: React.CSSProperties }>; to: string }
type NavGroup = {
  label: string
  items?: NavItem[]
  accordion?: { id: string; title: string; icon: React.ComponentType<{ style?: React.CSSProperties }>; items: NavItem[] }[]
}

const NAV: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { title: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { title: 'School Performance', icon: TrendingUp, to: '/performance' },
    ],
  },
  {
    label: 'Students',
    items: [
      { title: 'Applications', icon: ClipboardList, to: '/students/applications' },
      { title: 'Enrolled Students', icon: Users, to: '/students/enrolled' },
      { title: 'Alumni Directory', icon: Award, to: '/students/alumni' },
      { title: 'Waitlist', icon: UserPlus, to: '/students/waitlist' },
      { title: 'Cohorts', icon: Layers, to: '/students/cohorts' },
      { title: 'Documents', icon: FileText, to: '/students/documents' },
      { title: 'Student Goals', icon: Flag, to: '/students/goals' },
      { title: 'Student 360°', icon: Telescope, to: '/students/360' },
    ],
  },
  {
    label: 'Admissions',
    items: [
      { title: 'Grades (HS 9–12)', icon: GraduationCap, to: '/grades/hs' },
      { title: 'Elementary Grades', icon: BookOpen, to: '/grades/ls' },
      { title: 'Analytics', icon: BarChart2, to: '/admissions/analytics' },
      { title: 'Attendance', icon: UserCheck, to: '/attendance' },
      { title: 'Interviews', icon: MessageSquare, to: '/admissions/interviews' },
      { title: 'Fees & Tuition', icon: DollarSign, to: '/admissions/fees' },
      { title: 'Communications', icon: MessageSquare, to: '/admissions/communications' },
      { title: 'Report Cards', icon: FileText, to: '/admissions/reportcards' },
      { title: 'Calendar', icon: Calendar, to: '/academic/calendar' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Health Records', icon: Heart, to: '/operations/health' },
      { title: 'Behaviour Log', icon: AlertTriangle, to: '/operations/behaviour' },
    ],
    accordion: [
      {
        id: 'tpms',
        title: 'Teaching & Planning',
        icon: Presentation,
        items: [
          { title: 'T&P Dashboard', icon: BarChart, to: '/tpms/dashboard' },
          { title: 'Lesson Plans', icon: BookOpen, to: '/tpms/lessons' },
          { title: 'Unit Plans', icon: Layers, to: '/tpms/units' },
          { title: 'Blocks / Timetable', icon: Calendar, to: '/tpms/blocks' },
          { title: 'Curriculum Map', icon: Map, to: '/tpms/curriculum' },
          { title: 'Professional Dev', icon: Award, to: '/tpms/pd' },
          { title: 'Teaching Analytics', icon: BarChart2, to: '/tpms/analytics' },
        ],
      },
      {
        id: 'at',
        title: 'Assignment Tracker',
        icon: ClipboardList,
        items: [
          { title: 'Dashboard', icon: BarChart, to: '/at/dashboard' },
          { title: 'Assignments', icon: ClipboardList, to: '/at/assignments' },
          { title: 'Weekly Tracker', icon: Calendar, to: '/at/weekly' },
          { title: 'Exact Path', icon: Target, to: '/at/exactpath' },
          { title: 'Assessments', icon: FileCheck, to: '/at/assessment' },
          { title: 'Notes & Corrections', icon: StickyNote, to: '/at/notes' },
          { title: 'Late Submissions', icon: Clock, to: '/at/late' },
          { title: 'Reports', icon: Printer, to: '/at/reports' },
        ],
      },
      {
        id: 'pt',
        title: 'AWSC-27 Projects',
        icon: FolderKanban,
        items: [
          { title: 'Dashboard', icon: BarChart, to: '/pt/dashboard' },
          { title: 'Assign Projects', icon: PlusSquare, to: '/pt/assign' },
          { title: 'Track Progress', icon: Activity, to: '/pt/track' },
          { title: 'Evaluate Work', icon: CheckSquare, to: '/pt/evaluate' },
          { title: 'Family Reports', icon: FileBarChart, to: '/pt/reports' },
        ],
      },
      {
        id: 'lms',
        title: 'Learning Management',
        icon: Library,
        items: [
          { title: 'Manage Courses', icon: LayoutList, to: '/lms/manage' },
          { title: 'Courses', icon: BookMarked, to: '/lms/courses' },
          { title: 'Content Library', icon: BookCopy, to: '/lms/content' },
          { title: 'Assign Courses', icon: UserCog, to: '/lms/assign' },
          { title: 'Gradebook', icon: BarChart3, to: '/lms/gradebook' },
          { title: 'Section Details', icon: LayoutList, to: '/lms/section' },
          { title: 'Progress Reports', icon: TrendingUp, to: '/lms/progress' },
        ],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      { title: 'Alerts & Notifications', icon: Bell, to: '/admin/alerts' },
      { title: 'Settings', icon: Settings, to: '/admin/settings' },
      { title: 'Analytics', icon: BarChart2, to: '/admin/analytics' },
      { title: 'Audit Log', icon: FileText, to: '/admin/audit' },
      { title: 'User Management', icon: Shield, to: '/admin/users' },
      { title: 'Staff Directory', icon: Briefcase, to: '/admin/staff' },
    ],
  },
]

// Flat route → title map (used in topbar)
const ROUTE_TITLES: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const g of NAV) {
    for (const item of g.items ?? []) map[item.to] = item.title
    for (const acc of g.accordion ?? []) {
      for (const item of acc.items) map[item.to] = item.title
    }
  }
  return map
})()

// ─── Global Search ────────────────────────────────────────────────────────────

interface SearchResult { id: string; name: string; grade: number | null; cohort: string | null; status: string }

function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const input = wrapRef.current?.querySelector('input') as HTMLInputElement | null
        input?.focus()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function handleInput(val: string) {
    setQ(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('students')
        .select('id,first_name,last_name,grade,cohort,status')
        .or(`first_name.ilike.%${val}%,last_name.ilike.%${val}%,student_id.ilike.%${val}%`)
        .limit(8)
      setResults((data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: [(r.first_name as string) ?? '', (r.last_name as string) ?? ''].filter(Boolean).join(' '),
        grade: typeof r.grade === 'number' ? r.grade : null,
        cohort: (r.cohort as string) ?? null,
        status: (r.status as string) ?? '',
      })))
      setOpen(true)
      setLoading(false)
    }, 280)
  }

  function select(id: string) {
    setQ('')
    setOpen(false)
    navigate(`/students/360?id=${id}`)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, maxWidth: 320, margin: '0 16px' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8', pointerEvents: 'none' }}>🔍</span>
      <input
        value={q}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => q && results.length > 0 && setOpen(true)}
        placeholder="Search students… (⌘K)"
        autoComplete="off"
        style={{
          width: '100%', padding: '7px 12px 7px 32px',
          border: '1.5px solid #E4EAF2', borderRadius: 9,
          fontSize: 12, color: '#1A365E', outline: 'none', boxSizing: 'border-box',
          background: '#F7F9FC',
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(26,54,94,.12)', zIndex: 9999,
          maxHeight: 320, overflowY: 'auto',
        }}>
          {loading && <div style={{ padding: '12px 16px', fontSize: 12, color: '#7A92B0' }}>Searching…</div>}
          {!loading && results.length === 0 && <div style={{ padding: '12px 16px', fontSize: 12, color: '#7A92B0' }}>No students found</div>}
          {results.map(r => (
            <div
              key={r.id}
              onClick={() => select(r.id)}
              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F0F6FF' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#7A92B0' }}>
                  {r.grade != null ? `Grade ${r.grade}` : ''}
                  {r.grade != null && r.cohort ? ' · ' : ''}
                  {r.cohort ?? ''}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', whiteSpace: 'nowrap' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar() {
  const location = useLocation()
  const setActionsTarget = useSetActionsTarget()
  const title = ROUTE_TITLES[location.pathname] ?? ''

  return (
    <header style={{
      background: '#fff',
      borderBottom: '1px solid #E4EAF2',
      height: 58,
      display: 'flex',
      alignItems: 'center',
      padding: '0 22px',
      gap: 12,
      flexShrink: 0,
      zIndex: 10,
    }}>
      <SidebarTrigger style={{ color: '#1A365E', flexShrink: 0 }} />

      {title && (
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {title}
        </div>
      )}

      <GlobalSearch />

      {/* Portal target — pages render their action buttons here */}
      <div
        ref={setActionsTarget}
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
      />
    </header>
  )
}

// ─── Sidebar nav item helpers (hover state) ───────────────────────────────────

function SbItem({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        paddingTop: 8, paddingBottom: 8, paddingRight: 12,
        paddingLeft: isActive ? 9 : hov ? 15 : 12,
        borderRadius: 8, margin: '1px 4px',
        color: isActive ? '#fff' : hov ? '#fff' : '#8DACC8',
        background: isActive
          ? 'linear-gradient(90deg,rgba(214,31,49,.25),rgba(214,31,49,.12))'
          : hov ? 'rgba(255,255,255,.08)' : 'transparent',
        borderLeft: isActive ? '3px solid #D61F31' : '3px solid transparent',
        fontWeight: isActive ? 700 : 500, fontSize: 12,
        cursor: 'pointer', transition: 'all 0.15s ease', letterSpacing: '.2px',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  )
}

function SbParent({ isOpen, hasActive, onClick, children }: {
  isOpen: boolean; hasActive: boolean; onClick: () => void; children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        paddingTop: 8, paddingBottom: 8, paddingRight: 12,
        paddingLeft: hasActive ? 9 : hov ? 15 : 12,
        borderRadius: 8, margin: '1px 4px',
        width: 'calc(100% - 8px)',
        color: hasActive || isOpen ? '#fff' : hov ? '#fff' : '#8DACC8',
        background: hasActive
          ? 'linear-gradient(90deg,rgba(214,31,49,.25),rgba(214,31,49,.12))'
          : hov ? 'rgba(255,255,255,.08)' : isOpen ? 'rgba(255,255,255,.06)' : 'transparent',
        borderLeft: hasActive ? '3px solid #D61F31' : '3px solid transparent',
        border: hasActive ? undefined : 'none',
        cursor: 'pointer', fontSize: 12, fontWeight: hasActive ? 700 : 500,
        transition: 'all 0.15s ease', letterSpacing: '.2px', textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}

function SbSubItem({ isActive, children }: { isActive: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingTop: 6, paddingBottom: 6, paddingRight: 10,
        paddingLeft: isActive ? 7 : hov ? 13 : 10,
        borderRadius: 6, margin: '1px 4px',
        color: isActive ? '#fff' : hov ? '#fff' : '#7A92B0',
        background: isActive ? 'rgba(214,31,49,.15)' : hov ? 'rgba(255,255,255,.08)' : 'transparent',
        borderLeft: isActive ? '3px solid #D61F31' : '3px solid transparent',
        fontSize: 11, fontWeight: isActive ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s ease',
      }}
    >
      {children}
    </div>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, reset } = useAuthStore()
  const [academicYear, setAcademicYear] = useState('')
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(() => {
    const open = new Set<string>()
    if (location.pathname.startsWith('/at/')) open.add('at')
    if (location.pathname.startsWith('/pt/')) open.add('pt')
    if (location.pathname.startsWith('/tpms/')) open.add('tpms')
    if (location.pathname.startsWith('/lms/')) open.add('lms')
    return open
  })

  useEffect(() => {
    supabase.from('settings').select('academic_year').single().then(({ data }) => {
      if (data?.academic_year) setAcademicYear(data.academic_year)
    })
  }, [])
  function toggleAccordion(id: string) {
    setOpenAccordions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <PageHeaderProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden" style={{ background: '#F4F7FB' }}>
          <Sidebar
            style={{
              '--sidebar-background': '#0F2240',
              '--sidebar-foreground': '#E8EFF8',
              '--sidebar-accent': '#1a3a5c',
              '--sidebar-accent-foreground': '#fff',
              '--sidebar-border': 'rgba(255,255,255,.06)',
              '--sidebar-primary': '#D61F31',
              '--sidebar-primary-foreground': '#fff',
            } as React.CSSProperties}
          >
            {/* Logo Header */}
            <SidebarHeader style={{ background: '#0F2240', borderBottom: '1px solid rgba(255,255,255,.1)', padding: '14px 12px' }}>
              <img src="/Logo.png" alt="AWS" style={{ width: '100%', maxWidth: 180, height: 'auto', objectFit: 'contain' }} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 5, letterSpacing: '.3px' }}>
                {academicYear || '2024–2025'} · Admissions SIS
              </div>
            </SidebarHeader>

            <SidebarContent style={{ background: 'linear-gradient(180deg,#0F2240 0%,#1A365E 100%)', overflowY: 'auto' }}>
              {NAV.map((group, gi) => (
                <SidebarGroup
                  key={group.label}
                  style={{
                    padding: '4px 0',
                    marginTop: gi > 0 ? 4 : 0,
                    borderTop: gi > 0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                  }}
                >
                  <SidebarGroupLabel
                    style={{
                      color: 'rgba(255,255,255,.3)', fontSize: 9, fontWeight: 700,
                      letterSpacing: '2px', textTransform: 'uppercase',
                      padding: gi > 0 ? '14px 10px 5px' : '8px 10px 5px',
                    }}
                  >
                    {group.label}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu style={{ gap: 0 }}>
                      {(group.items ?? []).map((item) => (
                        <SidebarMenuItem key={item.to}>
                          <NavLink to={item.to} style={{ textDecoration: 'none', display: 'block' }}>
                            {({ isActive }) => (
                              <SbItem isActive={isActive}>
                                <item.icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                                <span>{item.title}</span>
                              </SbItem>
                            )}
                          </NavLink>
                        </SidebarMenuItem>
                      ))}
                      {(group.accordion ?? []).map((acc) => {
                        const isOpen = openAccordions.has(acc.id)
                        const hasActive = acc.items.some(i => location.pathname === i.to)
                        return (
                          <SidebarMenuItem key={acc.id}>
                            <SbParent isOpen={isOpen} hasActive={hasActive} onClick={() => toggleAccordion(acc.id)}>
                              <acc.icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{acc.title}</span>
                              <span style={{ fontSize: 9, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', color: isOpen ? '#D61F31' : 'rgba(255,255,255,.4)' }}>▶</span>
                            </SbParent>
                            {isOpen && (
                              <div style={{ paddingLeft: 10, marginTop: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {acc.items.map((item) => (
                                  <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', display: 'block' }}>
                                    {({ isActive }) => (
                                      <SbSubItem isActive={isActive}>
                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? '#D61F31' : 'rgba(255,255,255,.2)', flexShrink: 0 }} />
                                        <item.icon style={{ width: 12, height: 12, flexShrink: 0 }} />
                                        <span>{item.title}</span>
                                      </SbSubItem>
                                    )}
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>

            <SidebarFooter style={{ background: '#0a1a30', borderTop: '1px solid rgba(255,255,255,.08)', padding: '6px 4px 4px' }}>
              <DropdownMenu>
                <DropdownMenuTrigger style={{ all: 'unset', width: '100%', display: 'block' }}>
                  <div style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,.08)',
                    cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: '#D61F31', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile?.full_name ?? 'User'}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>
                        {profile?.role ?? 'staff'}
                      </div>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleLogout() }}
                      title="Sign out"
                      role="button"
                      style={{ background: 'rgba(255,255,255,.1)', borderRadius: 5, padding: '3px 7px', fontSize: 10, cursor: 'pointer', color: 'rgba(255,255,255,.5)', userSelect: 'none' }}
                    >
                      ⏏
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} style={{ color: '#D61F31' }}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>

          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PageHeaderProvider>
  )
}
