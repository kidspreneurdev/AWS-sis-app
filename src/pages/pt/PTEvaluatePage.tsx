import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PTM, PTCORE, mapAssignment, mapEvaluation, ptScoreBadge, type PTAssignment, type PTEvaluation } from './ptConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface Student { id: string; fullName: string }

function initials(name: string) { return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() }

const SC_CFG = {
  4: { c: '#15803D', bg: '#DCFCE7', l: 'Mastery' },
  3: { c: '#0369A1', bg: '#DBEAFE', l: 'Proficient' },
  2: { c: '#B45309', bg: '#FEF3C7', l: 'Developing' },
  1: { c: '#D61F31', bg: '#FEE2E2', l: 'Beginning' },
} as Record<number, { c: string; bg: string; l: string }>

export function PTEvaluatePage() {
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [evaluations, setEvaluations] = useState<PTEvaluation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [crScores, setCrScores] = useState<Record<string, number>>({})
  const [coScores, setCoScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: a }, { data: ev }, { data: st }] = await Promise.all([
      supabase.from('pt_assignments').select('*'),
      supabase.from('pt_evaluations').select('*'),
      supabase.from('students').select('id,full_name').eq('status', 'enrolled').order('full_name'),
    ])
    if (a) setAssignments(a.map(mapAssignment))
    if (ev) setEvaluations(ev.map(mapEvaluation))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '' })))
  }, [])

  useEffect(() => { load() }, [load])

  const queue = useMemo(() => assignments.filter(a => a.status === 'Work Uploaded' || a.status === 'Under Review'), [assignments])
  const recent = useMemo(() => [...evaluations].reverse().slice(0, 4), [evaluations])

  const selA = useMemo(() => assignments.find(a => a.id === selId) ?? null, [assignments, selId])
  const selM = useMemo(() => selA ? PTM.find(m => m.n === selA.methodology_n) ?? null : null, [selA])
  const exEv = useMemo(() => selId ? evaluations.find(e => e.assignment_id === selId) ?? null : null, [evaluations, selId])
  const stu = useMemo(() => selA ? students.find(s => s.id === selA.student_id) ?? null : null, [selA, students])

  // Initialize scores when selection changes
  useEffect(() => {
    if (!selM || !exEv) { setCrScores({}); setCoScores({}); setComment(''); return }
    const cr: Record<string, number> = {}
    selM.cr.forEach(c => { cr[c.name] = exEv.cr?.[c.name] ?? 0 })
    const co: Record<string, number> = {}
    PTCORE.forEach(c => { co[c.name] = exEv.co?.[c.name] ?? 0 })
    setCrScores(cr)
    setCoScores(co)
    setComment(exEv.comment ?? '')
  }, [selId, selM, exEv])

  // Select first in queue when queue loads
  useEffect(() => {
    if (!selId && queue.length > 0) setSelId(queue[0].id)
  }, [queue, selId])

  const calcScore = useCallback(() => {
    if (!selM) return null
    const crVals = selM.cr.map(c => crScores[c.name] ?? 0)
    const coVals = PTCORE.map(c => coScores[c.name] ?? 0)
    if (crVals.some(v => v === 0) || coVals.some(v => v === 0)) return null
    const ma = crVals.reduce((a, b) => a + b, 0) / crVals.length
    const ca = coVals.reduce((a, b) => a + b, 0) / coVals.length
    const ov = Math.round((ma * 0.6 + ca * 0.4) * 10) / 10
    return { ma, ca, ov, isMas: ov >= 3.5 }
  }, [selM, crScores, coScores])

  const liveScore = calcScore()

  async function doSave(approve: boolean) {
    const r = calcScore()
    if (!r || !selA || !selM) return
    setSaving(true)
    const crSave: Record<string, number> = {}
    selM.cr.forEach(c => { crSave[c.name] = crScores[c.name] ?? 0 })
    const coSave: Record<string, number> = {}
    PTCORE.forEach(c => { coSave[c.name] = coScores[c.name] ?? 0 })

    const evPayload = {
      assignment_id: selA.id, student_id: selA.student_id,
      ms: Math.round(r.ma * 10) / 10, cs: Math.round(r.ca * 10) / 10,
      ov: r.ov, mastery: r.isMas, cr: crSave, co: coSave, comment,
      // legacy columns for compatibility
      overall: r.ov, competencies: { ...coSave },
    }
    if (exEv) await supabase.from('pt_evaluations').update(evPayload).eq('id', exEv.id)
    else await supabase.from('pt_evaluations').insert(evPayload)

    await supabase.from('pt_assignments').update({
      status: approve ? 'Approved' : 'Resubmission Required',
      score: r.ov, mastery: r.isMas,
    }).eq('id', selA.id)

    await load()
    setSelId(null)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
        {/* Left queue panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>📋 Work Uploaded ({queue.length})</div>
            {queue.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#7A92B0', fontSize: 12 }}>✅ No work pending</div>}
            {queue.map(a => {
              const m = PTM.find(x => x.n === a.methodology_n)
              const s = students.find(x => x.id === a.student_id)
              const act = a.id === selId
              return (
                <button key={a.id} onClick={() => setSelId(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: act ? '#1A365E' : '#F7F9FC', color: act ? '#fff' : '#1A365E', border: `1.5px solid ${act ? '#1A365E' : '#E4EAF2'}`, borderRadius: 9, cursor: 'pointer', marginBottom: 4, textAlign: 'left' }}>
                  <span style={{ fontSize: 16 }}>{m?.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s?.fullName}</div>
                    <div style={{ fontSize: 9, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m?.name}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {recent.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Recently Evaluated</div>
              {recent.map((ev, i) => {
                const a = assignments.find(x => x.id === ev.assignment_id)
                const m = a ? PTM.find(x => x.n === a.methodology_n) : null
                const s = ev.student_id ? students.find(x => x.id === ev.student_id) : null
                const sb = ptScoreBadge(ev.ov, 9)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #F0F4FA' }}>
                    <span style={{ fontSize: 12 }}>{m?.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s?.fullName}</div>
                      <div style={{ fontSize: 9, color: '#7A92B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m?.name}</div>
                    </div>
                    {ev.ov != null && <span style={{ fontSize: 9, fontWeight: 800, background: sb.background as string, color: sb.color as string, padding: '2px 8px', borderRadius: 6 }}>{sb.score}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right eval panel */}
        {!selA || !selM ? (
          <div style={{ ...card, padding: 60, textAlign: 'center', color: '#7A92B0' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3D5475' }}>Select a project from the queue</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Upload student work via Track or Assign first</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Context card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: selM.col + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{selM.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>{selA.title || selM.name}</div>
                  <div style={{ fontSize: 11, color: '#7A92B0' }}>{selM.name} · {selA.ptype === 'C' ? 'Collaborative' : 'Independent'} · {selA.quarter}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, marginLeft: 'auto' }}>{initials(stu?.fullName ?? '')}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1A365E', marginTop: 3 }}>{stu?.fullName}</div>
                </div>
              </div>
              {selA.wurl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>📂</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Submitted Work</div>
                    <a href={selA.wurl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#0369A1', wordBreak: 'break-all' }}>{selA.wurl}</a>
                  </div>
                  <a href={selA.wurl} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', background: '#059669', color: '#fff', borderRadius: 6, fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>Open ↗</a>
                </div>
              )}
              {selA.brief && (
                <div style={{ background: '#F7F9FC', borderLeft: `3px solid ${selM.col}`, borderRadius: '0 8px 8px 0', padding: '8px 12px', fontSize: 11, color: '#3D5475', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3 }}>Project Brief</div>
                  {selA.brief}
                </div>
              )}
              {selA.reflect && (
                <div style={{ background: '#F7F9FC', borderLeft: '3px solid #7C3AED', borderRadius: '0 8px 8px 0', padding: '8px 12px', fontSize: 11, color: '#3D5475' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3 }}>Student Reflection</div>
                  {selA.reflect}
                </div>
              )}
            </div>

            {/* Methodology rubric (60%) */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>📊 Methodology Criteria <span style={{ fontSize: 10, fontWeight: 500, color: '#7A92B0' }}>· 60% of total score</span></div>
              {selM.cr.map(cr => {
                const cur = crScores[cr.name] ?? 0
                return (
                  <div key={cr.name} style={{ padding: 12, background: '#F7F9FC', borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 10 }}>{cr.name} <span style={{ fontSize: 9, fontWeight: 400, color: '#94A3B8' }}>({cr.w}% weight)</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
                      {([4, 3, 2, 1] as const).map(sc => {
                        const cfg = SC_CFG[sc]
                        const sel = cur === sc
                        return (
                          <label key={sc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', background: sel ? cfg.bg : '#fff', border: `2px solid ${sel ? cfg.c : '#E4EAF2'}`, borderRadius: 8, cursor: 'pointer' }}>
                            <input type="radio" name={`cr_${cr.name}`} value={sc} checked={sel} onChange={() => setCrScores(p => ({ ...p, [cr.name]: sc }))} style={{ margin: 0 }} />
                            <span style={{ fontSize: 16, fontWeight: 900, color: cfg.c }}>{sc}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: cfg.c }}>{cfg.l}</span>
                          </label>
                        )
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: '#7A92B0', fontStyle: 'italic', padding: '6px 8px', background: '#fff', borderRadius: 6 }}>
                      {cur > 0 ? (cr.d as Record<string, string>)[String(cur)] : 'Select a score to see descriptor'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Core competencies (40%) */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>💡 Core Competencies <span style={{ fontSize: 10, fontWeight: 500, color: '#7A92B0' }}>· 40% of total score</span></div>
              {PTCORE.map(cc => {
                const cur = coScores[cc.name] ?? 0
                return (
                  <div key={cc.name} style={{ padding: '10px 12px', background: '#F7F9FC', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{cc.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                      {([4, 3, 2, 1] as const).map(sc => {
                        const cfg = SC_CFG[sc]
                        const sel = cur === sc
                        return (
                          <label key={sc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 4px', background: sel ? cfg.bg : '#fff', border: `2px solid ${sel ? cfg.c : '#E4EAF2'}`, borderRadius: 8, cursor: 'pointer' }}>
                            <input type="radio" name={`co_${cc.name}`} value={sc} checked={sel} onChange={() => setCoScores(p => ({ ...p, [cc.name]: sc }))} style={{ margin: 0 }} />
                            <span style={{ fontSize: 16, fontWeight: 900, color: cfg.c }}>{sc}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Comment + score preview + actions */}
            <div style={card}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>✍️ Evaluator Feedback <span style={{ fontWeight: 400, textTransform: 'none' }}>(included in family report)</span></label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Specific, constructive feedback about quality, strengths, and areas for growth..." style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              {liveScore ? (
                <div style={{ padding: '10px 14px', borderRadius: 8, textAlign: 'center', fontSize: 11, marginBottom: 12, background: liveScore.isMas ? '#FEF9C3' : liveScore.ov >= 3 ? '#DCFCE7' : liveScore.ov >= 2.5 ? '#DBEAFE' : '#FEE2E2', color: liveScore.isMas ? '#92400E' : liveScore.ov >= 3 ? '#15803D' : liveScore.ov >= 2.5 ? '#1E3A8A' : '#DC2626' }}>
                  <strong>Score: {liveScore.ov.toFixed(1)}/4.0</strong> — Methodology: {liveScore.ma.toFixed(2)}×60% + Core: {liveScore.ca.toFixed(2)}×40%
                  {liveScore.isMas && <> &nbsp;⭐ <strong>MASTERY AWARDED</strong></>}
                </div>
              ) : (
                <div style={{ padding: '10px 14px', borderRadius: 8, textAlign: 'center', fontSize: 11, color: '#94A3B8', background: '#F7F9FC', marginBottom: 12 }}>Select all scores to see live calculation</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <button onClick={() => doSave(false)} disabled={saving || !liveScore} style={{ padding: '9px 18px', background: '#FEE2E2', color: '#D61F31', border: '1.5px solid #FCA5A5', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↩ Request Resubmission</button>
                <button onClick={() => doSave(true)} disabled={saving || !liveScore} style={{ padding: '9px 26px', background: '#059669', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✅ {saving ? 'Saving…' : 'Approve & Save'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
