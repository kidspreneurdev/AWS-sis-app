import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { mapUnit, TPMS_SUBJECTS, TPMS_STANDARDS_FLAT, type TpmsUnit } from './tpmsConstants'

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const MONTH_DATES = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

const HIERARCHY_LEVELS = [
  { n: 1, label: 'School Philosophy & Graduate Profile', desc: 'AWS Mission, core values, graduate attributes', col: '#1A365E' },
  { n: 2, label: 'Program Framework', desc: 'Curriculum standards: Common Core, NGSS, IB PYP/MYP/DP, Cambridge, AP', col: '#7C3AED' },
  { n: 3, label: 'Subject & Course Scope', desc: 'Year-long course goals, essential questions, big ideas per subject', col: '#059669' },
  { n: 4, label: 'Unit Plan', desc: '2–6 week thematic instructional units with standards, enduring understandings, assessments', col: '#D97706' },
  { n: 5, label: 'Lesson Plan', desc: 'Daily or weekly instructional session linked to parent unit', col: '#0EA5E9' },
]

const LEGEND = [
  { bg: '#E8FBF0', label: 'Not Started' },
  { bg: '#FFF7D0', label: 'In Progress' },
  { bg: '#0EA5E9', label: 'Active' },
  { bg: '#1DBD6A', label: 'Completed' },
]

function unitColor(status: string) {
  if (status === 'Completed') return '#1DBD6A'
  if (status === 'Active') return '#0EA5E9'
  if (status === 'Planning') return '#F5A623'
  return '#6B7280'
}

export function CurriculumMapPage() {
  const [units, setUnits] = useState<TpmsUnit[]>([])

  useEffect(() => {
    supabase.from('tpms').select('*').eq('type', 'unit').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setUnits(data.map(r => mapUnit(r as Record<string, unknown>))) })
  }, [])

  const subjects = useMemo(() => {
    const seen = new Set<string>()
    units.forEach(u => { if (u.subject) seen.add(u.subject) })
    const fromUnits = Array.from(seen)
    // Pad with TPMS_SUBJECTS up to 3 missing ones
    const missing = TPMS_SUBJECTS.filter(s => !seen.has(s)).slice(0, 3)
    return fromUnits.length ? fromUnits : missing
  }, [units])

  // Standards coverage count
  const stdCoverage = useMemo(() => {
    const map: Record<string, number> = {}
    units.forEach(u => (u.standards ?? []).forEach(s => { map[s] = (map[s] ?? 0) + 1 }))
    return map
  }, [units])

  const allStdsList = TPMS_STANDARDS_FLAT.slice(0, 18) // show top 18 standards in coverage grid

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>🗺️ Curriculum Map Builder</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Academic Year 2025–2026 · Scope &amp; Sequence Overview</div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {LEGEND.map(l => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, border: '1px solid #ddd', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#7A92B0' }}>{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Curriculum grid table */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', border: '1px solid #E4EAF2' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 140, padding: '10px 14px', background: '#1A365E', color: '#fff', fontSize: 11, textAlign: 'left', fontWeight: 700, borderRight: '1px solid #2D4E7A' }}>Subject</th>
              {MONTHS.map(m => <th key={m} style={{ padding: '10px 8px', background: '#1A365E', color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: 700, borderRight: '1px solid #2D4E7A', whiteSpace: 'nowrap' }}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub) => {
              const hasUnits = units.some(u => u.subject === sub)
              return (
                <tr key={sub} style={{ borderBottom: '1px solid #E4EAF2', opacity: hasUnits ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: hasUnits ? '#1A365E' : '#7A92B0', background: '#F7F9FC', borderRight: '1px solid #E4EAF2', verticalAlign: 'top', fontStyle: hasUnits ? 'normal' : 'italic' }}>{sub}</td>
                  {MONTH_DATES.map(mDate => {
                    const monthUnits = units.filter(u => {
                      if (u.subject !== sub) return false
                      if (!u.startDate && !u.endDate) return false
                      const start = u.startDate || ''
                      const end = u.endDate || u.startDate || ''
                      return start.startsWith(mDate) || end.startsWith(mDate) || (start < mDate && end > mDate)
                    })
                    return (
                      <td key={mDate} style={{ padding: '6px 4px', borderRight: '1px solid #E4EAF2', verticalAlign: 'top', minWidth: 80 }}>
                        {monthUnits.length > 0 ? monthUnits.map(u => {
                          const ucol = unitColor(u.status)
                          const short = u.title.length > 14 ? u.title.slice(0, 14) + '…' : u.title
                          return (
                            <div key={u.id} title={u.title} style={{ background: ucol + '20', borderLeft: `2px solid ${ucol}`, borderRadius: 4, padding: '3px 6px', marginBottom: 3, fontSize: 9, fontWeight: 600, color: ucol, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{short}</div>
                          )
                        }) : (
                          <div style={{ height: 24, border: '1px dashed #E4EAF2', borderRadius: 4, background: '#FAFBFF' }} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* AWS Curriculum Hierarchy */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #E4EAF2' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>🏗️ AWS Curriculum Framework Hierarchy</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {HIERARCHY_LEVELS.map(lv => (
            <div key={lv.n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: lv.col + '10', borderLeft: `3px solid ${lv.col}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: lv.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>{lv.n}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: lv.col }}>{lv.label}</div>
                <div style={{ fontSize: 10, color: '#7A92B0' }}>{lv.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Standards Coverage */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #E4EAF2' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>📋 Standards Coverage Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {allStdsList.map(s => {
            const cnt = stdCoverage[s] ?? 0
            const col = cnt >= 3 ? '#1DBD6A' : cnt >= 1 ? '#F5A623' : '#E4EAF2'
            const tcol = cnt >= 1 ? '#1A365E' : '#7A92B0'
            return (
              <div key={s} style={{ padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${col}`, background: col + '18' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: tcol, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s}>{s.split(' — ')[0]}</div>
                <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>{cnt} unit{cnt !== 1 ? 's' : ''}{cnt === 0 ? ' — Not yet addressed' : ''}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Empty state */}
      {units.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#7A92B0', border: '1px solid #E4EAF2' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 6 }}>No unit plans yet</div>
          <div style={{ fontSize: 12 }}>Create unit plans with start/end dates to populate the curriculum map.</div>
        </div>
      )}
    </div>
  )
}
