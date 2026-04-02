import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PTM, PTQD, PTSTAT, STAT_META, mapAssignment, mapEvaluation, ptSUM, ptQST, ptScoreBadge, type PTAssignment, type PTEvaluation } from './ptConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }

interface Student { id: string; fullName: string; cohort: string; grade: string }

function initials(name: string) { return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() }

export function PTTrackPage() {
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [evaluations, setEvaluations] = useState<PTEvaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selS, setSelS] = useState('')
  const [selQ, setSelQ] = useState('All')
  const [selSt, setSelSt] = useState('All')

  const load = useCallback(async () => {
    const [{ data: a }, { data: ev }, { data: st }] = await Promise.all([
      supabase.from('pt_assignments').select('*'),
      supabase.from('pt_evaluations').select('*'),
      supabase.from('students').select('id,full_name,cohort,grade').eq('status', 'enrolled').order('full_name'),
    ])
    if (a) setAssignments(a.map(mapAssignment))
    if (ev) setEvaluations(ev.map(mapEvaluation))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', cohort: (r.cohort as string) ?? '', grade: (r.grade as string) ?? '' })))
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => assignments.filter(a => {
    if (a.status === 'Not Assigned') return false
    if (selS && a.student_id !== selS) return false
    if (selQ !== 'All' && a.quarter !== selQ) return false
    if (selSt === 'Overdue') return a.due && a.due < today && a.status !== 'Approved'
    if (selSt !== 'All' && a.status !== selSt) return false
    return true
  }), [assignments, selS, selQ, selSt, today])

  const ovc = useMemo(() => assignments.filter(a => a.due && a.due < today && a.status !== 'Approved' && a.status !== 'Not Assigned').length, [assignments, today])

  const grouped = useMemo(() => {
    const g: Record<string, PTAssignment[]> = {}
    filtered.forEach(a => { if (!g[a.student_id]) g[a.student_id] = []; g[a.student_id].push(a) })
    Object.values(g).forEach(arr => arr.sort((a, b) => a.methodology_n - b.methodology_n))
    return g
  }, [filtered])

  const iStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <select value={selS} onChange={e => setSelS(e.target.value)} style={{ ...iStyle, flex: 1, minWidth: 180 }}>
          <option value="">All Students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <select value={selQ} onChange={e => setSelQ(e.target.value)} style={iStyle}>
          {['All', 'Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q}>{q}</option>)}
        </select>
        <select value={selSt} onChange={e => setSelSt(e.target.value)} style={iStyle}>
          {['All', 'Overdue', ...PTSTAT].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{filtered.length} records</span>
        {ovc > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#D61F31', background: '#FEE2E2', padding: '3px 10px', borderRadius: 6 }}>⏰ {ovc} overdue</span>}
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 40 }}>📈</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 10 }}>No projects matching filters</div>
        </div>
      ) : (
        Object.entries(grouped).map(([sid, recs]) => {
          const stu = students.find(s => s.id === sid)
          if (!stu) return null
          const sum = ptSUM(sid, assignments, evaluations)
          const qs = ptQST(sid, assignments)
          const ini = initials(stu.fullName)
          return (
            <div key={sid} style={{ ...card, overflow: 'hidden', marginBottom: 6 }}>
              {/* Student header */}
              <div style={{ background: 'linear-gradient(135deg,#F0F4FA,#E8EFF8)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #E4EAF2' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{ini}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{stu.fullName}</div>
                  <div style={{ fontSize: 10, color: '#7A92B0' }}>{stu.grade} · {sum.tot}/27 approved · ⭐ {sum.mas} mastery{sum.avg !== null ? ` · Avg: ${sum.avg}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.keys(PTQD).map(q => {
                    const ms = qs[q]
                    const cfg = { Complete: { c: '#059669', bg: '#DCFCE7' }, Overdue: { c: '#D61F31', bg: '#FEE2E2' }, 'At Risk': { c: '#D97706', bg: '#FEF3C7' }, 'On Track': { c: '#0369A1', bg: '#DBEAFE' } }[ms.st] ?? { c: '#94A3B8', bg: '#F1F5F9' }
                    return <span key={q} style={{ fontSize: 9, fontWeight: 800, background: cfg.bg, color: cfg.c, padding: '2px 7px', borderRadius: 5 }}>{q}: {ms.done}/{ms.need}</span>
                  })}
                </div>
              </div>

              {/* Project rows */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {recs.map(a => {
                  const m = PTM.find(x => x.n === a.methodology_n)
                  if (!m) return null
                  const evr = evaluations.find(e => e.assignment_id === a.id)
                  const iov = a.due && a.due < today && a.status !== 'Approved'
                  const ipend = a.status === 'Work Uploaded' || a.status === 'Under Review'
                  const bc = iov ? '#FCA5A5' : ipend ? '#FDE68A' : a.status === 'Approved' ? '#BBF7D0' : '#E4EAF2'
                  const sb = ptScoreBadge(evr?.ov ?? null, 9)
                  const stMeta = STAT_META[a.status] ?? { bg: '#F1F5F9', tc: '#94A3B8', ic: '·' }
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${bc}`, borderRadius: 10, background: iov ? '#FFFAFA' : ipend ? '#FFFBEB' : '#fff' }}>
                      <span style={{ fontSize: 18, width: 22, textAlign: 'center', flexShrink: 0 }}>{m.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap' }}>#{m.n} · {a.quarter}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{a.title || m.name}</span>
                          {iov && <span style={{ fontSize: 9, fontWeight: 800, color: '#D61F31', background: '#FEE2E2', padding: '1px 6px', borderRadius: 4 }}>OVERDUE</span>}
                          {ipend && <span style={{ fontSize: 9, fontWeight: 800, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4 }}>NEEDS EVAL</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94A3B8', flexWrap: 'wrap' }}>
                          {a.due && <span>📅 Due: <strong style={{ color: iov ? '#D61F31' : '#3D5475' }}>{a.due}</strong></span>}
                          {a.deliv && <span>📦 {a.deliv}</span>}
                          {a.brief && <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.brief}>📋 {a.brief.substring(0, 50)}{a.brief.length > 50 ? '…' : ''}</span>}
                          {a.wurl && <><span style={{ color: '#059669', fontWeight: 600 }}>📂 Work on file</span> <a href={a.wurl} target="_blank" rel="noreferrer" style={{ color: '#0369A1', fontWeight: 600, textDecoration: 'none' }}>🔗 Open</a></>}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: stMeta.bg, color: stMeta.tc, padding: '2px 9px', borderRadius: 6, whiteSpace: 'nowrap' }}>{a.status}</span>
                        {evr?.ov != null && <span style={{ fontSize: 9, fontWeight: 800, background: sb.background as string, color: sb.color as string, padding: '2px 8px', borderRadius: 6 }}>{sb.score} {sb.label}</span>}
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <button style={{ padding: '4px 10px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
                        {ipend && <button style={{ padding: '4px 10px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>✅ Eval</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
