import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const TYPE_COLORS: Record<string, string> = {
  Homework: '#3B82F6', Classwork: '#8B5CF6', Quiz: '#EF4444', Assessment: '#D97706',
  Project: '#0891B2', Lab: '#059669', Worksheet: '#6366F1',
}

function gpaColor(g: number | null): { bg: string; tc: string } {
  if (g === null || isNaN(g)) return { bg: '#F0F4FA', tc: '#7A92B0' }
  if (g >= 3.5) return { bg: '#FEF9C3', tc: '#92400E' }
  if (g >= 3.0) return { bg: '#DCFCE7', tc: '#14532D' }
  if (g >= 2.5) return { bg: '#DBEAFE', tc: '#1E3A8A' }
  if (g >= 2.0) return { bg: '#FFEDD5', tc: '#9A3412' }
  return { bg: '#FEE2E2', tc: '#7F1D1D' }
}

function completionColor(pct: number) {
  if (pct >= 80) return '#1DBD6A'
  if (pct >= 60) return '#0EA5E9'
  return '#D61F31'
}

function getMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff); d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
function getFriday(monday: string): string {
  const d = new Date(monday + 'T00:00:00')
  d.setDate(d.getDate() + 4)
  return d.toISOString().slice(0, 10)
}

interface Assignment { id: string; title: string; type: string; subject: string; dueDate: string; maxScore: number | null }
interface Submission { assignment_id: string; student_id: string; status: string; score: number | null }
interface Student { id: string; fullName: string; grade: string }
interface Correction { id: string; status: string; deadline: string }

export function ATDashboardPage() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: sub }, { data: st }, { data: corr }] = await Promise.all([
        supabase.from('at_assignments').select('id,title,type,subject,due_date,max_score').order('due_date'),
        supabase.from('at_submissions').select('assignment_id,student_id,status,score'),
        supabase.from('students').select('id,full_name,grade').eq('status', 'enrolled').order('full_name'),
        supabase.from('at_corrections').select('id,status,deadline'),
      ])
      if (a) setAssignments(a.map((r: Record<string, unknown>) => ({ id: r.id as string, title: r.title as string, type: (r.type as string) ?? 'Homework', subject: (r.subject as string) ?? '', dueDate: (r.due_date as string) ?? '', maxScore: r.max_score as number | null })))
      if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({ assignment_id: r.assignment_id as string, student_id: r.student_id as string, status: r.status as string, score: r.score as number | null })))
      if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', grade: (r.grade as string) ?? '' })))
      if (corr) setCorrections(corr.map((r: Record<string, unknown>) => ({ id: r.id as string, status: (r.status as string) ?? '', deadline: (r.deadline as string) ?? '' })))
    }
    load()
  }, [])

  const monday = getMonday()
  const friday = getFriday(monday)
  const today = new Date().toISOString().slice(0, 10)

  const subMap = useMemo(() => {
    const m: Record<string, Submission> = {}
    submissions.forEach(s => { m[`${s.assignment_id}_${s.student_id}`] = s })
    return m
  }, [submissions])

  const studentGPA = useMemo(() => {
    const gpas: Record<string, number | null> = {}
    students.forEach(s => {
      const scores: number[] = []
      assignments.forEach(a => {
        if (!a.maxScore) return
        const sub = subMap[`${a.id}_${s.id}`]
        if (!sub || sub.score === null || sub.score === undefined) return
        scores.push((sub.score / a.maxScore) * 4.0)
      })
      gpas[s.id] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : null
    })
    return gpas
  }, [students, assignments, subMap])

  // Week-scoped GPA for leaderboard (only this week's assignments)
  const studentWeekGPA = useMemo(() => {
    const gpas: Record<string, number | null> = {}
    const weekAssigns = assignments.filter(a => a.dueDate >= monday && a.dueDate <= friday)
    students.forEach(s => {
      const scores: number[] = []
      weekAssigns.forEach(a => {
        if (!a.maxScore) return
        const sub = subMap[`${a.id}_${s.id}`]
        if (!sub || sub.score === null || sub.score === undefined) return
        scores.push((sub.score / a.maxScore) * 4.0)
      })
      gpas[s.id] = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : null
    })
    return gpas
  }, [students, assignments, subMap, monday, friday])

  const totalSubs = submissions.length
  const turnedIn = submissions.filter(s => s.status === 'Turned In').length
  const missing = submissions.filter(s => s.status === 'Missing').length
  const late = submissions.filter(s => s.status === 'Late').length
  const compPct = totalSubs ? Math.round(turnedIn / totalSubs * 100) : 0

  const atRisk = students.filter(s => {
    const g = studentGPA[s.id]
    const hasMissing = submissions.some(sub => sub.student_id === s.id && sub.status === 'Missing')
    return (g !== null && g < 2.0) || hasMissing
  })

  const overdueCorr = corrections.filter(c => c.status !== 'Verified Complete' && c.deadline && c.deadline < today).length
  const lateThisWeek = submissions.filter(s => {
    const a = assignments.find(a => a.id === s.assignment_id)
    return s.status === 'Late' && a && a.dueDate >= monday && a.dueDate <= friday
  }).length

  const gpaLeaderboard = students
    .map(s => ({ student: s, gpa: studentWeekGPA[s.id] }))
    .sort((a, b) => (b.gpa ?? -1) - (a.gpa ?? -1))
    .slice(0, 8)

  const recentAssignments = [...assignments].reverse().slice(0, 6)

  const alerts: { col: string; bg: string; text: string }[] = []
  if (atRisk.length) alerts.push({ col: '#D61F31', bg: '#FEE2E2', text: `⚠️ ${atRisk.length} student${atRisk.length > 1 ? 's' : ''} at risk (GPA below 2.0 or missing assignments)` })
  if (overdueCorr) alerts.push({ col: '#B45309', bg: '#FEF3C7', text: `⏰ ${overdueCorr} correction task${overdueCorr > 1 ? 's' : ''} overdue` })
  if (lateThisWeek) alerts.push({ col: '#0369A1', bg: '#DBEAFE', text: `📋 ${lateThisWeek} late submission${lateThisWeek > 1 ? 's' : ''} this week` })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header banner */}
      <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E,#0369A1)', borderRadius: 16, padding: '22px 26px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>ASSIGNMENT TRACKER · SUCCESS COACH DASHBOARD</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Week of {monday} — {friday}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{students.length} enrolled students · {assignments.length} active assignments</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{ v: `${compPct}%`, l: 'Completion', c: '#1FD6C4' }, { v: turnedIn, l: 'Submitted', c: '#4ADE80' }, { v: missing, l: 'Missing', c: '#F87171' }, { v: late, l: 'Late', c: '#FCD34D' }].map(k => (
            <div key={k.l} style={{ textAlign: 'center', padding: '10px 14px', background: 'rgba(255,255,255,.08)', borderRadius: 12, minWidth: 64 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert strip */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: a.bg, borderLeft: `4px solid ${a.col}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: a.col }}>{a.text}</div>
          ))}
        </div>
      )}

      {/* Main 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* GPA Leaderboard */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏅 Student GPA Leaderboard (This Week)</span>
            <button onClick={() => navigate('/at/weekly')} style={{ fontSize: 10, background: 'none', border: 'none', color: '#D61F31', cursor: 'pointer', fontWeight: 700 }}>View grid →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {gpaLeaderboard.map((row, i) => {
              const gc = gpaColor(row.gpa)
              const initials = row.student.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
              return (
                <div key={row.student.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#F7F9FC', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', width: 16 }}>{i + 1}</div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1A365E' }}>{row.student.fullName}</div>
                  <span style={{ fontSize: 11, fontWeight: 800, background: gc.bg, color: gc.tc, padding: '2px 8px', borderRadius: 6 }}>{row.gpa !== null ? row.gpa.toFixed(2) : '—'}</span>
                </div>
              )
            })}
            {gpaLeaderboard.length === 0 && <div style={{ color: '#7A92B0', fontSize: 12, textAlign: 'center', padding: 16 }}>No graded submissions yet.</div>}
          </div>
        </div>

        {/* Active Assignments */}
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📝 Active Assignments This Week</span>
            <button onClick={() => navigate('/at/assignments')} style={{ fontSize: 10, background: 'none', border: 'none', color: '#D61F31', cursor: 'pointer', fontWeight: 700 }}>All →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {recentAssignments.map(a => {
              const submCount = submissions.filter(s => s.assignment_id === a.id && s.status === 'Turned In').length
              const missCount = submissions.filter(s => s.assignment_id === a.id && s.status === 'Missing').length
              const pct = students.length ? Math.round(submCount / students.length * 100) : 0
              const typeCol = TYPE_COLORS[a.type] ?? '#6B7280'
              return (
                <div key={a.id} style={{ padding: '9px 12px', border: '1.5px solid #E4EAF2', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, background: typeCol + '18', color: typeCol, padding: '2px 7px', borderRadius: 5 }}>{a.type}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', flex: 1 }}>{a.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: '#7A92B0' }}>
                    <span>📅 Due: {a.dueDate}</span>
                    <span style={{ color: completionColor(pct), fontWeight: 700 }}>{pct}% submitted</span>
                    {missCount > 0 && <span style={{ color: '#D61F31', fontWeight: 700 }}>{missCount} missing</span>}
                  </div>
                </div>
              )
            })}
            {recentAssignments.length === 0 && <div style={{ color: '#7A92B0', fontSize: 12, textAlign: 'center', padding: 16 }}>No assignments yet.</div>}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>⚡ Quick Actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: '+ New Assignment', col: '#1A365E', bg: '#EEF3FF', path: '/at/assignments' },
            { label: '📅 Open Weekly Grid', col: '#059669', bg: '#F0FDF4', path: '/at/weekly' },
            { label: '🏆 Log Exact Path', col: '#B45309', bg: '#FEF3C7', path: '/at/exactpath' },
            { label: '📈 Enter Assessment Scores', col: '#7C3AED', bg: '#F5F3FF', path: '/at/assessment' },
            { label: '📒 Log Class Note', col: '#0369A1', bg: '#EFF6FF', path: '/at/notes' },
            { label: '📄 Generate Report', col: '#D61F31', bg: '#FFF0F1', path: '/at/reports' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.path)} style={{ padding: '8px 14px', background: a.bg, color: a.col, border: `1.5px solid ${a.bg}`, borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
