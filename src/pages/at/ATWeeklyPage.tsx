import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_COLORS: Record<string, { bg: string; tc: string }> = {
  'Turned In': { bg: '#E8FBF0', tc: '#0E6B3B' },
  'Missing':   { bg: '#FEE2E2', tc: '#991B1B' },
  'Late':      { bg: '#FFF3E0', tc: '#B45309' },
  'Incomplete': { bg: '#EDE9FE', tc: '#5B21B6' },
  'Resubmit':  { bg: '#E0F2FE', tc: '#0369A1' },
  'Excused':   { bg: '#F3F4F6', tc: '#6B7280' },
  'Assigned':  { bg: '#F3F4F6', tc: '#6B7280' },
}

function gpaColor(g: number | null): { bg: string; tc: string } {
  if (g === null) return { bg: '#F0F4FA', tc: '#7A92B0' }
  if (g >= 3.5) return { bg: '#FEF9C3', tc: '#92400E' }
  if (g >= 3.0) return { bg: '#DCFCE7', tc: '#14532D' }
  if (g >= 2.5) return { bg: '#DBEAFE', tc: '#1E3A8A' }
  if (g >= 2.0) return { bg: '#FFEDD5', tc: '#9A3412' }
  return { bg: '#FEE2E2', tc: '#7F1D1D' }
}

function getMonday(offset = 0): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7
  const m = new Date(d); m.setDate(diff); m.setHours(0, 0, 0, 0)
  return m.toISOString().slice(0, 10)
}
function getFriday(monday: string): string {
  const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + 4)
  return d.toISOString().slice(0, 10)
}

const TYPE_HDR_COLORS: Record<string, string> = {
  Homework: '#93C5FD', Classwork: '#C4B5FD', Quiz: '#FCA5A5', Assessment: '#FCD34D', Lab: '#6EE7B7',
}

interface Assignment { id: string; title: string; type: string; subject: string; dueDate: string; maxScore: number | null }
interface Student { id: string; fullName: string; grade: string; cohort: string }
interface Submission { assignment_id: string; student_id: string; status: string; score: number | null; file_url: string; link_url: string }

export function ATWeeklyPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [cohorts, setCohorts] = useState<string[]>([])
  const [selCohort, setSelCohort] = useState('All')
  const [weekOffset, setWeekOffset] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: st }, { data: sub }, { data: settings }] = await Promise.all([
        supabase.from('at_assignments').select('id,title,type,subject,due_date,max_score').order('due_date'),
        supabase.from('students').select('id,full_name,grade,cohort').eq('status', 'enrolled').order('full_name'),
        supabase.from('at_submissions').select('assignment_id,student_id,status,score'),
        supabase.from('settings').select('cohorts').single(),
      ])
      if (a) setAssignments(a.map((r: Record<string, unknown>) => ({ id: r.id as string, title: r.title as string, type: (r.type as string) ?? 'Homework', subject: (r.subject as string) ?? '', dueDate: (r.due_date as string) ?? '', maxScore: r.max_score as number | null })))
      if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', grade: (r.grade as string) ?? '', cohort: (r.cohort as string) ?? '' })))
      if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({ assignment_id: r.assignment_id as string, student_id: r.student_id as string, status: r.status as string, score: r.score as number | null, file_url: (r.file_url as string) ?? '', link_url: (r.link_url as string) ?? '' })))
      if (settings?.cohorts) setCohorts(settings.cohorts as string[])
    }
    load()
  }, [])

  const monday = useMemo(() => getMonday(weekOffset), [weekOffset])
  const friday = useMemo(() => getFriday(monday), [monday])

  const weekAssignments = useMemo(() => assignments.filter(a => a.dueDate >= monday && a.dueDate <= friday), [assignments, monday, friday])
  const filteredStudents = useMemo(() => selCohort === 'All' ? students : students.filter(s => s.cohort === selCohort), [students, selCohort])

  const subMap = useMemo(() => {
    const m: Record<string, Submission> = {}
    submissions.forEach(s => { m[`${s.assignment_id}_${s.student_id}`] = s })
    return m
  }, [submissions])

  // Per-student GPA scoped to this week's assignments only
  const studentGPA = useMemo(() => {
    const gpas: Record<string, number | null> = {}
    filteredStudents.forEach(s => {
      const scores: number[] = []
      weekAssignments.forEach(a => {
        if (!a.maxScore) return
        const sub = subMap[`${a.id}_${s.id}`]
        if (!sub || sub.score === null) return
        scores.push((sub.score / a.maxScore) * 4.0)
      })
      gpas[s.id] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : null
    })
    return gpas
  }, [filteredStudents, weekAssignments, subMap])

  async function toggleStatus(assignId: string, studentId: string, current: string) {
    const cycle = ['Assigned', 'Turned In', 'Missing', 'Late', 'Excused']
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setSaving(true)
    const key = `${assignId}_${studentId}`
    const existing = submissions.find(s => s.assignment_id === assignId && s.student_id === studentId)
    if (existing) {
      await supabase.from('at_submissions').update({ status: next }).eq('assignment_id', assignId).eq('student_id', studentId)
    } else {
      await supabase.from('at_submissions').insert({ assignment_id: assignId, student_id: studentId, status: next })
    }
    setSubmissions(prev => {
      const f = prev.filter(s => !(s.assignment_id === assignId && s.student_id === studentId))
      return [...f, { ...subMap[key], assignment_id: assignId, student_id: studentId, status: next, score: subMap[key]?.score ?? null }]
    })
    setSaving(false)
  }

  const iStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <button onClick={() => setWeekOffset(p => p - 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>◀</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', flex: 1, textAlign: 'center' }}>📅 Weekly Grid — {monday} → {friday}</span>
        <button onClick={() => setWeekOffset(p => p + 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>▶</button>
        <button onClick={() => setWeekOffset(0)} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Today</button>
        <select value={selCohort} onChange={e => setSelCohort(e.target.value)} style={iStyle}>
          <option value="All">All Cohorts</option>
          {cohorts.map(c => <option key={c}>{c}</option>)}
        </select>
        {saving && <span style={{ fontSize: 11, color: '#7A92B0' }}>Saving…</span>}
      </div>

      {weekAssignments.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 32 }}>📅</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>No assignments due this week</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E4EAF2' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#1A365E' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, position: 'sticky', left: 0, background: '#1A365E', minWidth: 180 }}>Student</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', minWidth: 80 }}>Week GPA</th>
                {weekAssignments.map(a => {
                  const c = TYPE_HDR_COLORS[a.type] ?? '#CBD5E1'
                  return (
                    <th key={a.id} style={{ padding: '8px 10px', textAlign: 'center', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 100 }}>
                      <div style={{ fontSize: 9, background: c + '30', color: c, padding: '1px 6px', borderRadius: 4, marginBottom: 3, display: 'inline-block' }}>{a.type}</div>
                      <div style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>{a.title}</div>
                      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 8, marginTop: 2 }}>Due: {a.dueDate}{a.maxScore ? ` / ${a.maxScore}` : ''}</div>
                    </th>
                  )
                })}
                <th style={{ padding: '10px 12px', textAlign: 'center', color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 700, minWidth: 80 }}>Done %</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, ri) => {
                const gpa = studentGPA[s.id]
                const gc = gpaColor(gpa)
                const bgRow = ri % 2 === 0 ? '#fff' : '#F9FAFB'
                const initials = s.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
                let doneCount = 0
                return (
                  <tr key={s.id} style={{ background: bgRow }}>
                    <td style={{ padding: '8px 14px', position: 'sticky', left: 0, background: bgRow, borderRight: '1px solid #E4EAF2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{s.fullName}</div>
                          <div style={{ fontSize: 9, color: '#94A3B8' }}>{s.grade || s.cohort}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, background: gc.bg, color: gc.tc, padding: '2px 8px', borderRadius: 6 }}>{gpa !== null ? gpa.toFixed(2) : '—'}</span>
                    </td>
                    {weekAssignments.map(a => {
                      const sub = subMap[`${a.id}_${s.id}`]
                      const status = sub?.status ?? 'Assigned'
                      const sm = STATUS_COLORS[status] ?? STATUS_COLORS.Assigned
                      if (status === 'Turned In') doneCount++
                      const scoreDisplay = sub?.score !== null && sub?.score !== undefined ? `${sub.score}${a.maxScore ? '/' + a.maxScore : ''}` : '—'
                      const subGpa = a.maxScore && sub?.score !== null && sub?.score !== undefined ? (sub.score / a.maxScore) * 4.0 : null
                      const sgc = gpaColor(subGpa)
                      const hasSubContent = !!(sub?.file_url || sub?.link_url)
                      return (
                        <td key={a.id} style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '1px solid #F0F4FA', background: hasSubContent ? '#F0FDF4' : undefined }}>
                          <button
                            onClick={() => toggleStatus(a.id, s.id, status)}
                            title={`Click to cycle: ${status}`}
                            style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, border: 'none', background: sm.bg, color: sm.tc, fontSize: 9, fontWeight: 800, cursor: 'pointer', marginBottom: 2 }}
                          >
                            {status}
                          </button>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#1A365E' }}>{scoreDisplay}</div>
                          {subGpa !== null && <span style={{ fontSize: 9, fontWeight: 800, background: sgc.bg, color: sgc.tc, padding: '1px 5px', borderRadius: 4 }}>{subGpa.toFixed(1)}</span>}
                          {sub?.file_url && <a href={sub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#0369A1', textDecoration: 'none', display: 'block', marginTop: 2 }}>📎 File</a>}
                          {!sub?.file_url && sub?.link_url && <a href={sub.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#0369A1', textDecoration: 'none', display: 'block', marginTop: 2 }}>🔗 Link</a>}
                        </td>
                      )
                    })}
                    {(() => {
                      const donePct = weekAssignments.length ? Math.round(doneCount / weekAssignments.length * 100) : 0
                      const col = donePct >= 80 ? '#1DBD6A' : donePct >= 60 ? '#0EA5E9' : donePct >= 40 ? '#F5A623' : '#D61F31'
                      return <td style={{ padding: '6px 10px', textAlign: 'center' }}><span style={{ fontSize: 11, fontWeight: 800, color: col }}>{donePct}%</span></td>
                    })()}
                  </tr>
                )
              })}
              {filteredStudents.length === 0 && <tr><td colSpan={weekAssignments.length + 3} style={{ textAlign: 'center', padding: 24, color: '#7A92B0', fontSize: 13 }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#7A92B0' }}>Click a status cell to cycle: Assigned → Turned In → Missing → Late → Excused</div>
    </div>
  )
}
