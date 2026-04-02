import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PTM, PTQD, STAT_META, mapAssignment, mapEvaluation, ptSUM, ptQST, ptScoreBadge, type PTAssignment, type PTEvaluation } from './ptConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface Student { id: string; fullName: string; cohort: string; grade: string }

export function PTDashboardPage() {
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [evaluations, setEvaluations] = useState<PTEvaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [cohorts, setCohorts] = useState<string[]>([])
  const [selCohort, setSelCohort] = useState('All')

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: ev }, { data: st }, { data: settings }] = await Promise.all([
        supabase.from('pt_assignments').select('*'),
        supabase.from('pt_evaluations').select('*'),
        supabase.from('students').select('id,full_name,cohort,grade').eq('status', 'enrolled').order('full_name'),
        supabase.from('settings').select('cohorts').single(),
      ])
      if (a) setAssignments(a.map(mapAssignment))
      if (ev) setEvaluations(ev.map(mapEvaluation))
      if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', cohort: (r.cohort as string) ?? '', grade: (r.grade as string) ?? '' })))
      if (settings?.cohorts) setCohorts(settings.cohorts as string[])
    }
    load()
  }, [])

  const filteredStudents = useMemo(() => selCohort === 'All' ? students : students.filter(s => s.cohort === selCohort), [students, selCohort])
  const filteredAssignments = useMemo(() => {
    const ids = new Set(filteredStudents.map(s => s.id))
    return assignments.filter(a => ids.has(a.student_id))
  }, [assignments, filteredStudents])

  const today = new Date().toISOString().slice(0, 10)

  const stats = useMemo(() => {
    const asgn = filteredAssignments.filter(a => a.status !== 'Not Assigned').length
    const pend = filteredAssignments.filter(a => a.status === 'Work Uploaded' || a.status === 'Under Review').length
    const appr = filteredAssignments.filter(a => a.status === 'Approved').length
    const ovd = filteredAssignments.filter(a => a.status !== 'Approved' && a.status !== 'Not Assigned' && a.due && a.due < today).length
    const mas = filteredAssignments.filter(a => a.mastery).length
    const unass = filteredStudents.length * 27 - asgn
    return { asgn, pend, appr, ovd, mas, unass }
  }, [filteredAssignments, filteredStudents, today])

  const mmap = useMemo(() => PTM.map(m => {
    const mp = filteredAssignments.filter(a => a.methodology_n === m.n && a.status !== 'Not Assigned')
    const done = mp.filter(a => a.status === 'Approved').length
    return { m, rate: mp.length ? Math.round(done / mp.length * 100) : 0, done, tot: mp.length }
  }), [filteredAssignments])

  const iStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 11, color: '#1A365E', background: '#fff' }

  const qNow = new Date().getMonth()
  const curQ = qNow < 3 ? 'Q1' : qNow < 6 ? 'Q2' : qNow < 9 ? 'Q3' : 'Q4'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Gradient banner */}
      <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E,#312E81)', borderRadius: 18, padding: '22px 28px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 140, opacity: 0.04 }}>🎯</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 5 }}>AWSC-27 · SUCCESS COACH PORTAL</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>27 Learning Methodologies — Project Tracker</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 3 }}>Assign · track due dates · upload student work · evaluate · generate family reports</div>
          </div>
          <select value={selCohort} onChange={e => setSelCohort(e.target.value)} style={{ ...iStyle, background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', minWidth: 130 }}>
            <option value="All">All Cohorts</option>
            {cohorts.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          {[{ v: filteredStudents.length, l: 'Students', c: '#60A5FA' }, { v: stats.asgn, l: 'Assigned', c: '#A78BFA' }, { v: stats.pend, l: 'Awaiting Eval', c: '#FCD34D' }, { v: stats.appr, l: 'Approved', c: '#4ADE80' }, { v: stats.ovd, l: 'Overdue', c: '#F87171' }, { v: stats.mas, l: 'Mastery ⭐', c: '#FDE68A' }].map(k => (
            <div key={k.l} style={{ textAlign: 'center', padding: '10px 14px', background: 'rgba(255,255,255,.08)', borderRadius: 10, minWidth: 68 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginTop: 2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert strips */}
      {(stats.pend > 0 || stats.ovd > 0 || stats.unass > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.pend > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F5F3FF', borderLeft: '4px solid #7C3AED', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
            <span>📂</span><span style={{ flex: 1 }}>{stats.pend} project{stats.pend > 1 ? 's' : ''} uploaded — waiting for evaluation.</span>
          </div>}
          {stats.ovd > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FEE2E2', borderLeft: '4px solid #D61F31', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#D61F31' }}>
            <span>⏰</span><span style={{ flex: 1 }}>{stats.ovd} project{stats.ovd > 1 ? 's' : ''} past due date — immediate attention needed.</span>
          </div>}
          {stats.unass > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FEF3C7', borderLeft: '4px solid #D97706', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#B45309' }}>
            <span>📋</span><span style={{ flex: 1 }}>{stats.unass} project slots not yet assigned to students.</span>
          </div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
        {/* Cohort progress table */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>👥 Cohort Progress</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#F0F4FA' }}>
                  {['Student', 'Done', 'Ind', 'Col', '⭐', 'Avg', 'Current Q'].map(col => (
                    <th key={col} style={{ padding: '6px 8px', textAlign: col === 'Student' ? 'left' : 'center', color: '#7A92B0', fontSize: 9, textTransform: 'uppercase', fontWeight: 700 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((stu, ri) => {
                  const sum = ptSUM(stu.id, assignments, evaluations)
                  const qs = ptQST(stu.id, assignments)
                  const pct = Math.round(sum.tot / 27 * 100)
                  const ms = qs[curQ]
                  const mc = { Complete: { c: '#059669', bg: '#F0FDF4' }, Overdue: { c: '#D61F31', bg: '#FEE2E2' }, 'At Risk': { c: '#D97706', bg: '#FEF3C7' }, 'On Track': { c: '#0369A1', bg: '#EFF6FF' } }[ms.st] ?? { c: '#94A3B8', bg: '#F7F9FC' }
                  const initials = stu.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
                  const sb = ptScoreBadge(sum.avg, 9)
                  return (
                    <tr key={stu.id} style={{ background: ri % 2 ? '#F9FAFB' : '#fff', borderBottom: '1px solid #F0F4FA' }}>
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                          <div style={{ fontWeight: 700, color: '#1A365E', fontSize: 11 }}>{stu.fullName}</div>
                        </div>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                          <div style={{ width: 34, height: 5, background: '#E4EAF2', borderRadius: 3 }}>
                            <div style={{ height: 5, background: pct >= 80 ? '#059669' : pct >= 50 ? '#0369A1' : '#D97706', borderRadius: 3, width: `${pct}%` }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', minWidth: 26 }}>{sum.tot}/27</span>
                        </div>
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#1A365E' }}>{sum.ind}/22</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#7C3AED' }}>{sum.col}/5</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', color: '#B45309', fontWeight: 700 }}>{sum.mas}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {sum.avg !== null ? <span style={{ fontSize: 9, fontWeight: 800, background: sb.background as string, color: sb.color as string, padding: '2px 8px', borderRadius: 6 }}>{sb.score}</span> : <span style={{ color: '#94A3B8', fontSize: 9 }}>—</span>}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, background: mc.bg, color: mc.c, padding: '2px 7px', borderRadius: 5 }}>{ms.st}</span>
                      </td>
                    </tr>
                  )
                })}
                {filteredStudents.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 11 }}>No enrolled students</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Quarterly milestones */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>📅 Quarterly Milestones</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.keys(PTQD).map(q => {
                const qd = PTQD[q]
                const qA = filteredAssignments.filter(a => a.quarter === q && a.status === 'Approved').length
                const qT = filteredAssignments.filter(a => a.quarter === q && a.status !== 'Not Assigned').length
                const pct = qT ? Math.round(qA / qT * 100) : 0
                const now = new Date().toISOString().slice(0, 10)
                const cfg = pct >= 100 ? { bg: '#DCFCE7', tc: '#15803D', bc: '#86EFAC' }
                  : now > qd.end ? { bg: '#FEE2E2', tc: '#DC2626', bc: '#FCA5A5' }
                  : pct >= 50 ? { bg: '#FEF3C7', tc: '#B45309', bc: '#FDE68A' }
                  : { bg: '#EFF6FF', tc: '#1D4ED8', bc: '#BFDBFE' }
                return (
                  <div key={q} style={{ padding: 10, background: cfg.bg, border: `1.5px solid ${cfg.bc}`, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: cfg.tc }}>{q}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: cfg.tc }}>{pct}%</div>
                    <div style={{ fontSize: 9, color: cfg.tc, marginTop: 2 }}>{qA} approved</div>
                    <div style={{ fontSize: 8, color: cfg.tc, opacity: 0.7 }}>Due: {qd.end}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Methodology heatmap */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>🔥 Methodology Heatmap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {mmap.map(mc => {
                const bc = mc.rate >= 80 ? '#059669' : mc.rate >= 50 ? '#0369A1' : mc.rate >= 25 ? '#D97706' : '#D61F31'
                return (
                  <div key={mc.m.n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, width: 18, textAlign: 'center' }}>{mc.m.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: '#3D5475', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mc.m.name}</div>
                      <div style={{ height: 4, background: '#E4EAF2', borderRadius: 2, marginTop: 2 }}>
                        <div style={{ height: 4, background: bc, borderRadius: 2, width: `${mc.rate || 2}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: bc, minWidth: 26, textAlign: 'right' }}>{mc.rate}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coach actions */}
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>⚡ Coach Actions</div>
            {[
              { l: '📋 Assign Projects to Cohort', c: '#1A365E', bg: '#EEF3FF' },
              { l: '📈 Track Progress & Due Dates', c: '#059669', bg: '#F0FDF4' },
              { l: '✅ Evaluate Uploaded Work', c: '#7C3AED', bg: '#F5F3FF' },
              { l: '📄 Generate Family Reports', c: '#D61F31', bg: '#FFF0F1' },
            ].map(a => (
              <div key={a.l} style={{ display: 'block', marginBottom: 6, padding: '9px 12px', background: a.bg, color: a.c, borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'left' }}>{a.l}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, fontWeight: 700, color: '#64748B' }}>
        {Object.entries(STAT_META).map(([st, m]) => (
          <span key={st} style={{ color: m.tc }}>{m.ic} {st}</span>
        ))}
      </div>
    </div>
  )
}
