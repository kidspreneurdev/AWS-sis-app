import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { mapLesson, mapUnit, mapPd, TPMS_PACING_STATUS, TPMS_STANDARDS_FLAT, type TpmsLesson, type TpmsUnit, type TpmsPd } from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

export function TeachingAnalyticsPage() {
  const [lessons, setLessons] = useState<TpmsLesson[]>([])
  const [units, setUnits] = useState<TpmsUnit[]>([])
  const [pdRecs, setPdRecs] = useState<TpmsPd[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('tpms').select('*').eq('type', 'lesson'),
      supabase.from('tpms').select('*').eq('type', 'unit'),
      supabase.from('tpms').select('*').eq('type', 'pd'),
    ]).then(([lr, ur, pr]) => {
      if (lr.data) setLessons(lr.data.map(r => mapLesson(r as Record<string, unknown>)))
      if (ur.data) setUnits(ur.data.map(r => mapUnit(r as Record<string, unknown>)))
      if (pr.data) setPdRecs(pr.data.map(r => mapPd(r as Record<string, unknown>)))
    })
  }, [])

  // Lesson metrics
  const published = lessons.filter(l => l.status === 'Published').length
  const withObj = lessons.filter(l => l.objectives).length
  const withRefl = lessons.filter(l => l.reflection).length
  const engLessons = lessons.filter(l => l.engagement && parseInt(l.engagement) > 0)
  const avgEng = engLessons.length
    ? Math.round(engLessons.reduce((s, l) => s + parseInt(l.engagement), 0) / engLessons.length * 10) / 10
    : 0
  const completionRate = lessons.length ? Math.round((published / lessons.length) * 100) : 0
  const pdHours = useMemo(() => pdRecs.reduce((s, r) => s + (r.hours || 0), 0), [pdRecs])

  // Standards coverage
  const stdCoverage = useMemo(() => {
    const map: Record<string, number> = {}
    lessons.forEach(l => (l.standards ?? []).forEach(s => { map[s] = (map[s] ?? 0) + 1 }))
    units.forEach(u => (u.standards ?? []).forEach(s => { map[s] = (map[s] ?? 0) + 0.5 }))
    return map
  }, [lessons, units])

  const sortedStds = useMemo(() => {
    return TPMS_STANDARDS_FLAT
      .map(s => ({ name: s, count: stdCoverage[s] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  }, [stdCoverage])

  const maxStdCount = sortedStds.length ? Math.max(...sortedStds.map(s => s.count)) : 1

  // Pacing counts
  const pacingCounts = useMemo(() => {
    const m: Record<string, number> = {}
    TPMS_PACING_STATUS.forEach(p => { m[p] = 0 })
    units.forEach(u => { const k = u.pacing || 'On Track'; m[k] = (m[k] ?? 0) + 1 })
    return m
  }, [units])

  const PACING_COLORS: Record<string, string> = {
    'On Track': '#1DBD6A', 'Behind': '#F5A623', 'Significantly Behind': '#D61F31', 'Ahead': '#0EA5E9',
  }

  const teacherMetrics = [
    { label: 'Lesson Plan Completion Rate', val: completionRate + '%', raw: completionRate, col: completionRate >= 90 ? '#1DBD6A' : completionRate >= 70 ? '#F5A623' : '#D61F31' },
    { label: 'Lessons with Objectives', val: lessons.length ? Math.round((withObj / lessons.length) * 100) + '%' : '0%', raw: lessons.length ? Math.round((withObj / lessons.length) * 100) : 0, col: '#0EA5E9' },
    { label: 'Post-Lesson Reflections', val: lessons.length ? Math.round((withRefl / lessons.length) * 100) + '%' : '0%', raw: lessons.length ? Math.round((withRefl / lessons.length) * 100) : 0, col: '#7C3AED' },
    { label: 'Avg Student Engagement', val: avgEng ? `${avgEng}/5` : '—', raw: avgEng ? (avgEng / 5) * 100 : 0, col: '#D97706' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📈 TPMS Analytics Dashboard</div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          ['📝', 'Total Lessons', lessons.length, '#0EA5E9'],
          ['✅', 'Published', published, '#1DBD6A'],
          ['📐', 'Unit Plans', units.length, '#7C3AED'],
          ['🎓', 'PD Hours', pdHours.toFixed(1), '#D97706'],
        ].map(([icon, label, val, col]) => (
          <div key={label as string} style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1.5px solid #E4EAF2', textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: col as string }}>{val}</div>
            <div style={{ fontSize: 10, color: '#7A92B0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Two-column analytics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Teacher dashboard metrics */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>👩‍🏫 Teacher Dashboard</div>
          {teacherMetrics.map(m => (
            <div key={m.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#3D5475', fontWeight: 600 }}>{m.label}</span>
                <span style={{ fontWeight: 800, color: m.col }}>{m.val}</span>
              </div>
              <div style={{ background: '#F0F4FA', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, m.raw)}%`, height: '100%', background: m.col, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Standards heatmap */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🗺️ Standards Coverage Heatmap</div>
          {sortedStds.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#7A92B0', fontSize: 12, padding: 16 }}>Tag standards to lessons &amp; units to see coverage.</div>
          ) : sortedStds.map(s => {
            const pct = maxStdCount > 0 ? Math.round((s.count / maxStdCount) * 100) : 0
            const col = pct >= 70 ? '#1DBD6A' : pct >= 30 ? '#F5A623' : pct > 0 ? '#0EA5E9' : '#E4EAF2'
            const short = s.name.split(' — ')[0]
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }} title={s.name}>
                <div style={{ width: 110, fontSize: 9, color: '#7A92B0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{short}</div>
                <div style={{ flex: 1, background: '#F0F4FA', borderRadius: 4, height: 10 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 4 }} />
                </div>
                <div style={{ width: 28, textAlign: 'right', fontSize: 9, fontWeight: 700, color: col, flexShrink: 0 }}>{s.count.toFixed(s.count % 1 ? 1 : 0)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unit Pacing */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>🗺️ Curriculum Dashboard — Unit Pacing Overview</div>
        {units.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#7A92B0', padding: 20, fontSize: 12 }}>No unit plans created yet. Create unit plans to see pacing analytics.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              {TPMS_PACING_STATUS.map(p => (
                <div key={p} style={{ textAlign: 'center', padding: 12, background: PACING_COLORS[p] + '18', borderRadius: 10, border: `1.5px solid ${PACING_COLORS[p]}44` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: PACING_COLORS[p] }}>{pacingCounts[p] ?? 0}</div>
                  <div style={{ fontSize: 9, color: PACING_COLORS[p], fontWeight: 700 }}>{p.toUpperCase()}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F9FC' }}>
                  {['Unit', 'Subject', 'Timeline', 'Pacing', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#7A92B0', textAlign: 'left', borderBottom: '1px solid #E4EAF2' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map(u => {
                  const pcol = PACING_COLORS[u.pacing] ?? '#1DBD6A'
                  const scol = u.status === 'Active' ? '#1DBD6A' : u.status === 'Completed' ? '#0EA5E9' : '#F5A623'
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F0F4FA' }}>
                      <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{u.title || 'Untitled'}</td>
                      <td style={{ padding: 8, fontSize: 10, color: '#7A92B0' }}>{u.subject || '—'}</td>
                      <td style={{ padding: 8, fontSize: 10, color: '#7A92B0' }}>{u.startDate && u.endDate ? `${u.startDate} → ${u.endDate}` : 'Not set'}</td>
                      <td style={{ padding: 8 }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: pcol + '18', color: pcol }}>{u.pacing || 'On Track'}</span></td>
                      <td style={{ padding: 8 }}><span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: scol + '18', color: scol }}>{u.status || 'Planning'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Lesson status distribution */}
      {lessons.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📝 Lesson Plan Status Distribution</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['Published', '#1DBD6A'], ['Draft', '#7A92B0'], ['Ready for Review', '#F5A623'], ['Archived', '#B45309'],
            ].map(([status, col]) => {
              const cnt = lessons.filter(l => l.status === status).length
              const pct = lessons.length ? Math.round((cnt / lessons.length) * 100) : 0
              return (
                <div key={status} style={{ flex: 1, minWidth: 120, padding: '12px 14px', borderRadius: 10, background: (col as string) + '18', border: `1.5px solid ${col as string}44` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: col as string }}>{status}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: col as string }}>{cnt}</div>
                  <div style={{ fontSize: 10, color: col as string, opacity: 0.8 }}>{pct}% of total</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
