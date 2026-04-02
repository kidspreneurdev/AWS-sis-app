import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { mapLesson, mapUnit, mapEvent, LESSON_STATUS_META, TPMS_EVENT_COLORS, type TpmsLesson, type TpmsUnit, type TpmsEvent } from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }

const PHASES = [
  { phase: 'Phase 1 — Foundation', timeline: 'Aug–Oct 2025', deliverables: 'SIS audit, data migration, calendar setup, teacher training', pct: 100, col: '#1DBD6A' },
  { phase: 'Phase 2 — Planning', timeline: 'Oct 2025–Jan 2026', deliverables: 'Lesson planner launch, unit plan templates, curriculum map builder', pct: 75, col: '#0EA5E9' },
  { phase: 'Phase 3 — Integration', timeline: 'Jan–Apr 2026', deliverables: 'Parent portal expansion, resource library, analytics dashboards', pct: 40, col: '#F5A623' },
  { phase: 'Phase 4 — Optimization', timeline: 'Apr–Aug 2026', deliverables: 'AI features, mobile app, substitute plan automation, PD module', pct: 5, col: '#7C3AED' },
  { phase: 'Phase 5 — Excellence', timeline: 'Aug 2026+', deliverables: 'Advanced analytics, curriculum refinement, system-wide review', pct: 0, col: '#6B7280' },
]

export function TPMSDashboardPage() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<TpmsLesson[]>([])
  const [units, setUnits] = useState<TpmsUnit[]>([])
  const [events, setEvents] = useState<TpmsEvent[]>([])

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    Promise.all([
      supabase.from('tpms').select('*').eq('type', 'lesson').order('created_at', { ascending: false }),
      supabase.from('tpms').select('*').eq('type', 'unit').order('created_at', { ascending: false }),
      supabase.from('calendar').select('*').gte('date', todayStr).order('date').limit(8),
    ]).then(([lr, ur, er]) => {
      if (lr.data) setLessons(lr.data.map(r => mapLesson(r as Record<string,unknown>)))
      if (ur.data) setUnits(ur.data.map(r => mapUnit(r as Record<string,unknown>)))
      if (er.data) setEvents(er.data.map(r => mapEvent(r as Record<string,unknown>)))
    })
  }, [])

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const in7 = new Date(today); in7.setDate(today.getDate() + 7)
  const in7Str = in7.toISOString().slice(0, 10)

  const published = lessons.filter(l => l.status === 'Published').length
  const inReview = lessons.filter(l => l.status === 'Ready for Review').length
  const activeUnits = units.filter(u => u.status === 'Active').length

  const thisWeekLessons = lessons.filter(l => l.date >= todayStr && l.date <= in7Str)
  const upcomingEvents = events.filter(e => e.date >= todayStr).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg,#EEF3FF,#DDE6FF)', borderRadius: 14, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>Welcome to TPMS 📚</div>
          <div style={{ fontSize: 12, color: '#3D5475', marginTop: 4 }}>Teaching & Planning Management System · American World School</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6 }}>Academic Year 2025–2026 · Term Progress Tracking Active</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['📝', 'Lesson Plans', lessons.length, '#0EA5E9'],
            ['📐', 'Unit Plans', units.length, '#7C3AED'],
            ['✅', 'Published', published, '#1DBD6A'],
            ['⏳', 'In Review', inReview, '#F5A623'],
          ].map(([icon, label, val, col]) => (
            <div key={label as string} style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 18 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: col as string }}>{val as number}</div>
              <div style={{ fontSize: 9, color: '#7A92B0', fontWeight: 600 }}>{(label as string).toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { icon: '📝', label: 'New Lesson Plan', path: '/tpms/lessons', col: '#0EA5E9' },
          { icon: '📐', label: 'New Unit Plan', path: '/tpms/units', col: '#7C3AED' },
          { icon: '📆', label: 'Curriculum Map', path: '/tpms/curriculum', col: '#D97706' },
          { icon: '📊', label: 'Teaching Analytics', path: '/tpms/analytics', col: '#059669' },
        ].map(qa => (
          <button key={qa.path} onClick={() => navigate(qa.path)} style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, padding: '16px 12px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{qa.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: qa.col }}>{qa.label}</div>
          </button>
        ))}
      </div>

      {/* Two-column: this week's lessons + upcoming events */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* This week's lessons */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📝 This Week's Lessons</div>
          {thisWeekLessons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#7A92B0', fontSize: 12 }}>
              No lessons this week.
              <br />
              <button onClick={() => navigate('/tpms/lessons')} style={{ marginTop: 8, padding: '6px 14px', background: '#0EA5E9', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>+ Create Lesson</button>
            </div>
          ) : thisWeekLessons.slice(0, 5).map(l => {
            const sm = LESSON_STATUS_META[l.status] ?? LESSON_STATUS_META.Draft
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ width: 36, height: 36, background: '#EEF3FF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📝</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title || 'Untitled Lesson'}</div>
                  <div style={{ fontSize: 10, color: '#7A92B0' }}>{l.subject}{l.date ? ` · ${l.date}` : ''}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sm.bg, color: sm.tc, whiteSpace: 'nowrap' }}>{l.status}</span>
              </div>
            )
          })}
        </div>

        {/* Upcoming events */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📆 Upcoming Events</div>
          {upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#7A92B0', fontSize: 12, padding: 20 }}>No upcoming events.</div>
          ) : upcomingEvents.map(e => {
            const col = TPMS_EVENT_COLORS[e.type] ?? '#6B7280'
            const d = new Date(e.date + 'T00:00:00')
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ minWidth: 40, textAlign: 'center', background: col + '18', borderRadius: 8, padding: '4px 6px', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: col }}>{d.getDate()}</div>
                  <div style={{ fontSize: 8, color: col, fontWeight: 700 }}>{d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: '#7A92B0' }}>{e.type}{e.layer ? ` · ${e.layer}` : ''}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Active units overview */}
      {activeUnits > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📐 Active Unit Plans ({activeUnits})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {units.filter(u => u.status === 'Active').slice(0, 6).map(u => {
              const pacCol = u.pacing === 'Behind' ? '#F5A623' : u.pacing === 'Significantly Behind' ? '#D61F31' : u.pacing === 'Ahead' ? '#0EA5E9' : '#1DBD6A'
              return (
                <div key={u.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#F7F9FC', border: '1.5px solid #E4EAF2' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 3 }}>{u.title}</div>
                  <div style={{ fontSize: 10, color: '#7A92B0' }}>{u.subject} · {u.grade}</div>
                  {u.pacing && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: pacCol + '18', color: pacCol, marginTop: 4, display: 'inline-block' }}>{u.pacing}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Implementation roadmap */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🚀 TPMS Implementation Roadmap 2025–2026</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PHASES.map(p => (
            <div key={p.phase} style={{ padding: '10px 14px', borderRadius: 10, background: '#F7F9FC', border: '1px solid #E4EAF2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{p.phase}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#7A92B0' }}>{p.timeline}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: p.col + '18', color: p.col }}>{p.pct}%</span>
                </div>
              </div>
              <div style={{ background: '#E4EAF2', borderRadius: 4, height: 4, marginBottom: 5, overflow: 'hidden' }}>
                <div style={{ width: `${p.pct}%`, height: '100%', background: p.col, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: '#7A92B0' }}>{p.deliverables}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
