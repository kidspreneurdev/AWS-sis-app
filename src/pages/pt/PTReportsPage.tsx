import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PTM, PTQD, mapAssignment, mapEvaluation, ptSUM, ptQST, ptScoreBadge, type PTAssignment, type PTEvaluation } from './ptConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 18 }

interface Student { id: string; fullName: string; grade: string; cohort: string }

function initials(name: string) { return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() }

export function PTReportsPage() {
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [evaluations, setEvaluations] = useState<PTEvaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selS, setSelS] = useState('')
  const [rType, setRType] = useState('progress')
  const [coachMsg, setCoachMsg] = useState('')
  const [showPrev, setShowPrev] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: ev }, { data: st }] = await Promise.all([
        supabase.from('pt_assignments').select('*'),
        supabase.from('pt_evaluations').select('*'),
        supabase.from('students').select('id,full_name,grade,cohort').eq('status', 'enrolled').order('full_name'),
      ])
      if (a) setAssignments(a.map(mapAssignment))
      if (ev) setEvaluations(ev.map(mapEvaluation))
      if (st) {
        const mapped = st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', grade: (r.grade as string) ?? '', cohort: (r.cohort as string) ?? '' }))
        setStudents(mapped)
        if (mapped.length > 0) setSelS(mapped[0].id)
      }
    }
    load()
  }, [])

  const stu = useMemo(() => students.find(s => s.id === selS) ?? null, [students, selS])
  const sum = useMemo(() => ptSUM(selS, assignments, evaluations), [selS, assignments, evaluations])
  const qs = useMemo(() => ptQST(selS, assignments), [selS, assignments])
  const stuEvs = useMemo(() => evaluations.filter(e => e.student_id === selS), [evaluations, selS])
  const stuAppr = useMemo(() => assignments.filter(a => a.student_id === selS && a.status === 'Approved'), [assignments, selS])
  const pct = Math.round(sum.tot / 27 * 100)

  const badges = useMemo(() => {
    const b = []
    if (sum.tot >= 7) b.push({ ic: '🥉', l: 'Q1 Complete', d: '7+ projects' })
    if (sum.tot >= 14) b.push({ ic: '🥈', l: 'Q2 Complete', d: '14+ projects' })
    if (sum.tot >= 20) b.push({ ic: '🥇', l: 'Q3 Complete', d: '20+ projects' })
    if (sum.tot >= 27) b.push({ ic: '🏅', l: 'AWSC-27 Graduate', d: 'All 27 done' })
    if (sum.mas >= 5) b.push({ ic: '⭐', l: '5× Mastery', d: '5 mastery awards' })
    if (sum.mas >= 10) b.push({ ic: '🌟', l: '10× Mastery', d: '10 mastery awards' })
    if (sum.col >= 5) b.push({ ic: '🤝', l: 'Team Champion', d: 'All 5 collaborative' })
    if (b.length === 0) b.push({ ic: '🎯', l: 'Journey Begins', d: 'First steps taken' })
    return b
  }, [sum])

  const fi: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lb: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Controls */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 14 }}>📄 Generate Family Progress Report</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={lb}>Student</label>
            <select value={selS} onChange={e => { setSelS(e.target.value); setShowPrev(false) }} style={fi}>
              {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div><label style={lb}>Report Type</label>
            <select value={rType} onChange={e => setRType(e.target.value)} style={fi}>
              <option value="progress">Progress Report</option>
              <option value="quarterly">Quarterly Summary</option>
              <option value="portfolio">Portfolio Overview</option>
            </select>
          </div>
          <div><label style={lb}>Academic Year</label>
            <input value="2024-25" readOnly style={{ ...fi, background: '#F7F9FC', color: '#7A92B0' }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lb}>✍️ Coach's Message to Family <span style={{ color: '#D61F31', fontWeight: 400, textTransform: 'none' }}>*required</span></label>
          <textarea value={coachMsg} onChange={e => setCoachMsg(e.target.value)} rows={4} placeholder="Write a personalised message summarising this student's progress, achievements, strengths, areas of focus, and encouragement for the family..." style={{ ...fi, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { if (!coachMsg.trim()) return; setShowPrev(true) }} style={{ padding: '9px 18px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>👁 Preview Report</button>
          <button onClick={() => { if (!coachMsg.trim()) return; window.print() }} style={{ padding: '9px 22px', background: '#D61F31', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📥 Download PDF</button>
          <button onClick={() => setShowPrev(false)} style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📦 All Students</button>
        </div>
      </div>

      {showPrev && stu ? (
        <div style={{ border: '2px solid #E4EAF2', borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          {/* Report header */}
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '24px 28px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '3px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>{initials(stu.fullName)}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>AWSC-27 Learning Methodologies · Academic Year 2024–2025</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{stu.fullName}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 3 }}>{stu.grade} · Report generated: {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[{ v: `${sum.tot}/27`, l: 'Projects Approved', c: '#4ADE80' }, { v: `${sum.ind}/22`, l: 'Independent', c: '#60A5FA' }, { v: `${sum.col}/5`, l: 'Collaborative', c: '#A78BFA' }, { v: `⭐ ${sum.mas}`, l: 'Mastery Awards', c: '#FDE68A' }, { v: sum.avg ? sum.avg.toFixed(1) + '/4.0' : '—', l: 'Avg Score', c: '#FCD34D' }, { v: `${pct}%`, l: 'Overall Progress', c: '#4ADE80' }].map(k => (
                <div key={k.l} style={{ textAlign: 'center', padding: '10px 14px', background: 'rgba(255,255,255,.08)', borderRadius: 10, minWidth: 72 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', marginTop: 2 }}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4EAF2' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>📊 Overall Progress — 27 Learning Methodologies</div>
            <div style={{ height: 14, background: '#E4EAF2', borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: 14, background: 'linear-gradient(90deg,#059669,#34D399)', borderRadius: 7, width: `${pct}%`, transition: 'width .4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A92B0' }}>
              <span>{sum.tot} projects approved of 27</span>
              <span>{pct}% complete</span>
            </div>
          </div>

          {/* Quarterly milestone table */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4EAF2' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>📅 Quarterly Milestone Status</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F0F4FA' }}>
                  {['Quarter', 'Target', 'Approved', 'Due Date', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Quarter' ? 'left' : 'center', fontSize: 9, textTransform: 'uppercase', color: '#7A92B0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(PTQD).map((q, ri) => {
                  const qd = PTQD[q]
                  const ms = qs[q]
                  const cfg = { Complete: { c: '#059669', bg: '#F0FDF4' }, Overdue: { c: '#D61F31', bg: '#FEE2E2' }, 'At Risk': { c: '#D97706', bg: '#FEF3C7' }, 'On Track': { c: '#0369A1', bg: '#EFF6FF' } }[ms.st] ?? { c: '#94A3B8', bg: '#F7F9FC' }
                  return (
                    <tr key={q} style={{ background: ri % 2 ? '#F9FAFB' : '#fff', borderBottom: '1px solid #F0F4FA' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1A365E' }}>{qd.lbl} ({q})</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#7A92B0' }}>{qd.tot} projects</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#1A365E' }}>{ms.done}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#7A92B0' }}>{qd.end}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.c, padding: '2px 8px', borderRadius: 5 }}>{ms.st}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Approved projects */}
          {stuAppr.length > 0 && (
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>✅ Approved Projects ({stuAppr.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
                {stuAppr.map(a => {
                  const m = PTM.find(x => x.n === a.methodology_n)
                  const ev = stuEvs.find(e => e.assignment_id === a.id)
                  const sb = ptScoreBadge(ev?.ov ?? null, 10)
                  return (
                    <div key={a.id} style={{ padding: 12, border: `1.5px solid ${a.mastery ? '#FDE68A' : '#E4EAF2'}`, borderRadius: 10, background: a.mastery ? '#FFFBEB' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{m?.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>#{m?.n} · {a.quarter}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m?.name}</div>
                        </div>
                        {a.mastery && <span style={{ fontSize: 14 }}>⭐</span>}
                      </div>
                      {ev?.ov != null && <span style={{ fontSize: 10, fontWeight: 800, background: sb.background as string, color: sb.color as string, padding: '2px 8px', borderRadius: 6 }}>{sb.score} {sb.label}</span>}
                      {ev?.comment && <div style={{ fontSize: 9, color: '#7A92B0', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>{ev.comment.substring(0, 100)}{ev.comment.length > 100 ? '…' : ''}</div>}
                      {a.wurl && <div style={{ marginTop: 6 }}><a href={a.wurl} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#0369A1', fontWeight: 600, textDecoration: 'none' }}>🔗 View work</a></div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Coach message */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4EAF2' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Coach's Message</div>
            <div style={{ padding: '14px 18px', background: '#F7F9FC', borderLeft: '4px solid #1A365E', borderRadius: '0 10px 10px 0', fontSize: 12, lineHeight: 1.7, color: '#3D5475', fontStyle: 'italic' }}>{coachMsg}</div>
          </div>

          {/* Badges */}
          <div style={{ padding: '20px 28px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>🏅 Achievements</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {badges.map(b => (
                <div key={b.l} style={{ textAlign: 'center', padding: '12px 14px', background: 'linear-gradient(135deg,#FEF9C3,#FFF8DC)', border: '1.5px solid #FDE68A', borderRadius: 12, minWidth: 86 }}>
                  <div style={{ fontSize: 26 }}>{b.ic}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', marginTop: 4 }}>{b.l}</div>
                  <div style={{ fontSize: 9, color: '#B45309', marginTop: 2 }}>{b.d}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, padding: '12px 16px', background: '#F0F4FA', borderRadius: 8, fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>
              This report was generated by American World School AWSC-27 Success Coach Portal · {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      ) : (
        /* All students overview */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
          {students.map(s => {
            const ss = ptSUM(s.id, assignments, evaluations)
            const qss = ptQST(s.id, assignments)
            const spc = Math.round(ss.tot / 27 * 100)
            const atRisk = Object.keys(PTQD).some(q => qss[q].st === 'Overdue' || qss[q].st === 'At Risk')
            return (
              <div key={s.id} style={{ padding: 14, background: '#fff', border: `2px solid ${atRisk ? '#FCA5A5' : '#E4EAF2'}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{initials(s.fullName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.fullName}</div>
                    <div style={{ fontSize: 10, color: '#7A92B0' }}>{s.grade}</div>
                  </div>
                </div>
                <div style={{ height: 8, background: '#E4EAF2', borderRadius: 4, marginBottom: 6 }}>
                  <div style={{ height: 8, background: spc >= 80 ? '#059669' : spc >= 50 ? '#0369A1' : '#D97706', borderRadius: 4, width: `${spc}%` }} />
                </div>
                <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 10 }}>{ss.tot}/27 approved · ⭐ {ss.mas}{ss.avg ? ` · ${ss.avg.toFixed(1)}` : ''}</div>
                {atRisk && <div style={{ fontSize: 9, fontWeight: 700, color: '#D61F31', background: '#FEE2E2', padding: '3px 8px', borderRadius: 5, marginBottom: 8, display: 'inline-block' }}>⚠️ Milestone at risk</div>}
                <button onClick={() => { setSelS(s.id); setShowPrev(false) }} style={{ width: '100%', padding: 7, background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📄 Generate Report</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
