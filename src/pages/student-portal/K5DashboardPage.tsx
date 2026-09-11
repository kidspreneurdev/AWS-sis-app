import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator, BookOpen, FlaskConical, Palette, Dumbbell, Music, Globe, Library,
  Sparkles, Star, CalendarDays, Link2, Book, Medal, Lock, BarChart3, Zap,
  Trophy, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const NAVY = '#1A365E'
const RED = '#D61F31'
const GOLD = '#FAC600'
const GREEN = '#16A34A'

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function todayDay() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' })
}

interface BadgeRow { name: string; earned_at: string }
interface AttRow { status: string }
interface BlockRow { id: string; day: string; period: string; time: string; subject: string; room: string; sessionType: string; meetLink: string }
interface GradeRow { subject: string; grade: number; letter_grade: string }

const SUBJECT_ICON: Record<string, LucideIcon> = {
  maths: Calculator, math: Calculator, mathematics: Calculator,
  english: BookOpen, 'language arts': BookOpen, reading: BookOpen,
  science: FlaskConical,
  art: Palette,
  pe: Dumbbell, 'physical education': Dumbbell,
  music: Music,
  'social studies': Globe,
}

function subjectIcon(s: string): LucideIcon {
  return SUBJECT_ICON[s.toLowerCase()] ?? Library
}

const SUBJECT_COLORS = ['#DBEAFE', '#DCFCE7', '#EDE9FE', '#FEF3C7', '#FEE2E2', '#E0F2FE']

export function K5DashboardPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const [badges, setBadges] = useState<BadgeRow[]>([])
  const [attendance, setAttendance] = useState<AttRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [grades, setGrades] = useState<GradeRow[]>([])

  useEffect(() => {
    if (!session) return
    void Promise.all([
      supabase.from('badge_awards').select('name,earned_at').eq('student_id', session.dbId).order('earned_at', { ascending: false }),
      supabase.from('attendance').select('status').eq('student_id', session.dbId),
      supabase.from('timetable_blocks').select('id,day,period,time,subject,room,session_type,meet_link,student_ids').or(`cohort.eq."${session.cohort ?? ''}",student_ids.cs.{${session.dbId}}`).order('created_at', { ascending: true }),
      supabase.from('grades').select('subject,grade,letter_grade').eq('student_id', session.dbId),
    ]).then(([b, a, bl, g]) => {
      setBadges((b.data ?? []).map((r: Record<string, unknown>) => ({ name: (r.name as string) ?? '', earned_at: (r.earned_at as string) ?? '' })))
      setAttendance((a.data ?? []).map((r: Record<string, unknown>) => ({ status: (r.status as string) ?? '' })))
      setBlocks((bl.data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as string, day: (r.day as string) ?? '', period: (r.period as string) ?? '', time: (r.time as string) ?? '', subject: (r.subject as string) ?? '', room: (r.room as string) ?? '', sessionType: (r.session_type as string) ?? 'Live Session', meetLink: (r.meet_link as string) ?? '' })))
      setGrades((g.data ?? []).map((r: Record<string, unknown>) => ({ subject: (r.subject as string) ?? '', grade: Number(r.grade ?? 0), letter_grade: (r.letter_grade as string) ?? '' })))
    })
  }, [session])

  const attRate = useMemo(() => {
    if (!attendance.length) return 0
    const present = attendance.filter(r => r.status === 'Present' || r.status === 'Remote').length
    return Math.round((present / attendance.length) * 100)
  }, [attendance])

  const todayBlocks = useMemo(() => (
    blocks.filter(r => r.day === todayDay()).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  ), [blocks])

  const firstName = session?.fullName.split(' ')[0] ?? 'Student'
  const recentBadges = badges.slice(0, 3)
  const topGrades = grades.slice(0, 4)

  const todayIso = new Date().toISOString().slice(0, 10)
  const nowMs = Date.now()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Hero greeting */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius: 16, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(250,198,0,.07)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
            K–5 Student Portal · 2025–26
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            {getGreeting()}, {firstName}! <Sparkles size={20} color={GOLD} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
            Grade {session?.grade}{session?.campus ? ` · ${session.campus}` : ''} · Student ID: {session?.studentId || '—'}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/portal/learning')} style={{ background: GOLD, color: NAVY, border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} /> Start learning <ArrowRight size={14} />
            </button>
            <button onClick={() => navigate('/portal/badges')} style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', borderRadius: 10, padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Star size={14} /> My stars
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'Stars Earned', value: String(badges.length), icon: Star, color: GOLD },
          { label: 'Attendance', value: `${attRate}%`, icon: null, color: attRate >= 90 ? GREEN : attRate >= 75 ? GOLD : RED },
          { label: 'Badges', value: String(badges.length), icon: null, color: NAVY },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 13, padding: '16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {s.value}{s.icon ? <s.icon size={20} /> : null}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Today's schedule */}
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={14} /> Today's Classes</div>
          {todayBlocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 18, color: '#94A3B8', fontSize: 12 }}>No classes scheduled today</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayBlocks.map(b => {
                const parts = b.time.split('–').map(p => p.trim())
                const startMs = parts[0] ? new Date(`${todayIso}T${parts[0]}`).getTime() : 0
                const endMs = parts[1] ? new Date(`${todayIso}T${parts[1]}`).getTime() : 0
                const isNow = startMs && endMs ? nowMs >= startMs && nowMs < endMs : false
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: isNow ? '#F0FDF4' : '#F8FAFC', borderRadius: 9, border: `1.5px solid ${isNow ? '#16A34A' : '#E2E8F0'}` }}>
                    {(() => { const SI = subjectIcon(b.subject); return <SI size={18} color={NAVY} /> })()}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{b.subject}</div>
                      <div style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>{b.time || b.period}{b.sessionType === 'Self-Paced Mastery' ? <> · <Book size={10} /> Self-Paced</> : ''}</div>
                    </div>
                    {b.sessionType === 'Live Session' && b.meetLink && (
                      <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ fontSize: 9, fontWeight: 800, background: isNow ? GREEN : '#E0F2FE', color: isNow ? '#fff' : '#0369A1', padding: '4px 9px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Join</a>
                    )}
                    {isNow && <span style={{ fontSize: 9, fontWeight: 800, background: '#DCFCE7', color: GREEN, padding: '2px 7px', borderRadius: 5 }}>NOW</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* My badges preview */}
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><Medal size={14} /> My Badges</div>
            <button onClick={() => navigate('/portal/badges')} style={{ fontSize: 11, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              See all →
            </button>
          </div>
          {recentBadges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 18, color: '#94A3B8', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><Lock size={28} /></div>
              Complete lessons to earn badges!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {recentBadges.map((b, i) => (
                <div key={`${b.name}-${b.earned_at}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], borderRadius: 9 }}>
                  <Medal size={20} color={NAVY} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{b.name}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{new Date(b.earned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <Star size={14} color={GOLD} fill={GOLD} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My grades preview */}
      {topGrades.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={14} /> My Grades</div>
            <button onClick={() => navigate('/portal/grades')} style={{ fontSize: 11, color: RED, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              See all →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {topGrades.map((g, i) => (
              <div key={g.subject} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], borderRadius: 10 }}>
                {(() => { const SI = subjectIcon(g.subject); return <SI size={22} color={NAVY} /> })()}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{g.subject}</div>
                  <div style={{ fontSize: 9, color: '#64748B' }}>{g.grade ? `${g.grade}%` : ''}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: g.grade >= 90 ? GREEN : g.grade >= 75 ? GOLD : RED }}>
                  {g.letter_grade || (g.grade >= 90 ? 'A' : g.grade >= 80 ? 'B' : g.grade >= 70 ? 'C' : 'D')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={14} /> Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { icon: BarChart3, label: 'Grades', to: '/portal/grades', bg: '#DBEAFE' },
            { icon: CalendarDays, label: 'Attendance', to: '/portal/attendance', bg: '#DCFCE7' },
            { icon: Trophy, label: 'Certificates', to: '/portal/documents', bg: '#FEF3C7' },
            { icon: Palette, label: 'Portfolio', to: '/portal/portfolio', bg: '#EDE9FE' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.to)} style={{ background: a.bg, border: 'none', borderRadius: 10, padding: '12px 6px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: NAVY }}><a.icon size={22} /></div>
              <div style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
