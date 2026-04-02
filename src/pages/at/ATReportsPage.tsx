import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

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
function fmtWeekRange(ws: string, we: string): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const d1 = new Date(ws + 'T00:00:00'), d2 = new Date(we + 'T00:00:00')
  return `${months[d1.getMonth()]} ${d1.getDate()} – ${d2.getDate()}, ${d1.getFullYear()}`
}

interface Assignment { id: string; title: string; subject: string; due_date: string; max_score: number | null }
interface Submission { assignment_id: string; student_id: string; status: string; score: number | null; teacher_note: string }
interface Student { id: string; fullName: string; grade: string; cohort: string }
interface AssessRec { student_id: string; subject: string; raw_score: number | null; max_score: number; week_start: string; status: string }
interface AttendRec { student_id: string; date: string; status: string }

export function ATReportsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [assessments, setAssessments] = useState<AssessRec[]>([])
  const [attendance, setAttendance] = useState<AttendRec[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selStu, setSelStu] = useState('')
  const [coachNote, setCoachNote] = useState('')
  const [coachName, setCoachName] = useState('Success Coach')
  const [preview, setPreview] = useState(false)

  const monday = useMemo(() => getMonday(weekOffset), [weekOffset])
  const friday = useMemo(() => getFriday(monday), [monday])

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: sub }, { data: st }, { data: assess }, { data: att }] = await Promise.all([
        supabase.from('at_assignments').select('id,title,subject,due_date,max_score').order('due_date'),
        supabase.from('at_submissions').select('assignment_id,student_id,status,score,teacher_note'),
        supabase.from('students').select('id,full_name,grade,cohort').eq('status', 'enrolled').order('full_name'),
        supabase.from('at_assessments').select('student_id,subject,raw_score,max_score,week_start'),
        supabase.from('attendance').select('student_id,date,status'),
      ])
      if (a) setAssignments(a.map((r: Record<string, unknown>) => ({ id: r.id as string, title: r.title as string, subject: (r.subject as string) ?? '', due_date: (r.due_date as string) ?? '', max_score: r.max_score as number | null })))
      if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({ assignment_id: r.assignment_id as string, student_id: r.student_id as string, status: r.status as string, score: r.score as number | null, teacher_note: (r.teacher_note as string) ?? '' })))
      if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', grade: (r.grade as string) ?? '', cohort: (r.cohort as string) ?? '' })))
      if (assess) setAssessments(assess.map((r: Record<string, unknown>) => ({ student_id: r.student_id as string, subject: r.subject as string, raw_score: r.raw_score as number | null, max_score: (r.max_score as number) ?? 100, week_start: (r.week_start ?? r.week) as string, status: (r.status as string) ?? 'Taken' })))
      if (att) setAttendance(att.map((r: Record<string, unknown>) => ({ student_id: r.student_id as string, date: r.date as string, status: r.status as string })))
    }
    load()
  }, [])

  const subMap = useMemo(() => {
    const m: Record<string, Submission> = {}
    submissions.forEach(s => { m[`${s.assignment_id}_${s.student_id}`] = s })
    return m
  }, [submissions])

  const weekAssigns = useMemo(() => assignments.filter(a => a.due_date >= monday && a.due_date <= friday), [assignments, monday, friday])

  const selStudent = useMemo(() => students.find(s => s.id === selStu) ?? null, [students, selStu])

  // Attendance for selected student this week
  const weekDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + i)
      dates.push(d.toISOString().slice(0, 10))
    }
    return dates
  }, [monday])

  const attRow = useMemo(() => {
    if (!selStu) return []
    return weekDates.map(dt => attendance.find(a => a.student_id === selStu && a.date === dt) ?? { student_id: selStu, date: dt, status: '—' })
  }, [selStu, weekDates, attendance])

  const absences = attRow.filter(a => a.status === 'A').length
  const tardies = attRow.filter(a => a.status === 'T' || a.status === 'L').length

  function getStudentReport(stuId: string) {
    const doneCount = weekAssigns.filter(a => { const sub = subMap[`${a.id}_${stuId}`]; return sub && (sub.status === 'Turned In' || sub.status === 'Late') }).length
    const missingCount = weekAssigns.filter(a => { const sub = subMap[`${a.id}_${stuId}`]; return !sub || sub.status === 'Missing' || sub.score === null || sub.score === undefined }).length
    const compPct = weekAssigns.length ? Math.round(doneCount / weekAssigns.length * 100) : 0
    const stuAssess = assessments.filter(r => r.student_id === stuId && r.week_start === monday)
    const mathAssess = stuAssess.find(r => r.subject === 'Mathematics')
    const mbAssess = stuAssess.find(r => r.subject === 'Mind & Body' || r.subject === 'Physical Education')
    const firstNote = weekAssigns.map(a => subMap[`${a.id}_${stuId}`]?.teacher_note).find(n => n) ?? ''
    return { doneCount, missingCount, compPct, mathAssess, mbAssess, firstNote }
  }

  function generateAllStudents() {
    if (!coachNote.trim()) { alert('Add a coach note first.'); return }
    const weekLabel = fmtWeekRange(monday, friday)
    let body = ''
    students.forEach((stu, stuIdx) => {
      const stuNum = `#${String(stuIdx + 1).padStart(2, '0')}`
      const stuAttRow = weekDates.map(dt => attendance.find(a => a.student_id === stu.id && a.date === dt) ?? { student_id: stu.id, date: dt, status: '—' })
      const stuAbsences = stuAttRow.filter(a => a.status === 'A').length
      const stuTardies = stuAttRow.filter(a => (a.status === 'T' || a.status === 'L')).length
      const { doneCount, missingCount, compPct, mathAssess, mbAssess, firstNote } = getStudentReport(stu.id)
      const overallSt = (stuAbsences >= 2 || compPct < 50) ? 'Needs Focus' : (compPct >= 80 && stuAbsences === 0) ? 'On Track' : 'Developing'
      const stColor = overallSt === 'Needs Focus' ? '#D61F31' : overallSt === 'On Track' ? '#059669' : '#D97706'
      const stTxt = overallSt === 'Needs Focus' ? 'Needs Focus ■■' : overallSt === 'On Track' ? 'On Track ■■■' : 'Developing ■■'
      const mathScore = (mathAssess?.raw_score !== null && mathAssess?.raw_score !== undefined) ? mathAssess.raw_score : null
      const mathPct = (mathAssess?.max_score && mathScore !== null) ? Math.round(mathScore / mathAssess.max_score * 100) : mathScore
      const mathNeedsFocus = mathPct !== null && mathPct < 80

      const attCells = stuAttRow.map(a => {
        const st = a.status ?? '—'
        const tc = st === 'A' ? '#D61F31' : (st === 'T' || st === 'L') ? '#B45309' : st === 'P' ? '#1A365E' : '#94A3B8'
        return `<td style="text-align:center;padding:10px 4px;font-size:16px;font-weight:900;color:${tc}">${st}</td>`
      }).join('')

      const assignRows = weekAssigns.length === 0
        ? `<tr><td colspan="6" style="padding:16px;text-align:center;color:#94A3B8;font-size:11px">No assignments due this week</td></tr>`
        : weekAssigns.map((a, ai) => {
            const sub = subMap[`${a.id}_${stu.id}`]
            const submitted = sub && (sub.status === 'Turned In' || sub.status === 'Late') ? 1 : 0
            const isMissing = !sub || sub.status === 'Missing'
            const bg = ai % 2 ? '#F0F4FA' : '#fff'
            return `<tr style="background:${bg}"><td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#1A365E">${ai + 1}</td><td style="padding:8px 10px;font-size:11px;font-weight:700;color:#1A365E">${a.title}</td><td style="padding:8px 10px;font-size:11px;color:#1A365E">${a.subject}</td><td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#1A365E">1</td><td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#1A365E">${submitted}</td><td style="padding:8px 10px;text-align:center"><span style="color:${isMissing ? '#D61F31' : '#059669'};font-weight:700;font-size:11px">■ ${isMissing ? 'Missing' : sub?.status ?? 'Submitted'}</span></td></tr>`
          }).join('')

      const mathSection = (mathAssess && mathPct !== null) ? `
        <div style="background:#1A365E;padding:6px 24px 0"><div style="display:inline-block;background:#C5A028;color:#0F2240;font-size:9px;font-weight:900;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">■ MATH ASSESSMENT</div></div>
        <div style="background:#EAF2FB;padding:14px"><div style="background:#fff;border:1px solid #DDE6F0;border-radius:4px;padding:14px;display:flex;align-items:center;gap:20px"><div style="font-size:36px;font-weight:900;color:${mathNeedsFocus ? '#D61F31' : '#059669'};min-width:70px">${mathPct}%</div><div style="flex:1"><div style="font-size:10px;color:#7A92B0">Math Assessment Score</div><div style="font-size:12px;font-weight:900;color:${mathNeedsFocus ? '#D61F31' : '#059669'};margin-top:4px">${mathNeedsFocus ? 'Needs Focus ■■' : 'On Track ■■■'}</div></div><span style="font-size:10px;font-weight:700;color:#D61F31;background:#FEE2E2;padding:4px 10px;border-radius:4px">■ Target: 80%+</span></div></div>` : ''

      const mbSection = (mbAssess && mbAssess.raw_score !== null) ? `
        <div style="background:#1A365E;padding:6px 24px 0"><div style="display:inline-block;background:#C5A028;color:#0F2240;font-size:9px;font-weight:900;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">■ MIND &amp; BODY</div></div>
        <div style="background:#EAF2FB;padding:14px"><div style="background:#fff;border:1px solid #DDE6F0;border-radius:4px;padding:14px;display:flex;align-items:center;gap:20px"><div style="font-size:36px;font-weight:900;color:#059669;min-width:70px">${mbAssess.max_score ? Math.round(mbAssess.raw_score / mbAssess.max_score * 100) + '%' : mbAssess.raw_score}</div><div><div style="font-size:10px;color:#7A92B0">Mind &amp; Body / PE Assessment Score</div><div style="font-size:11px;color:#94A3B8;margin-top:2px">Status: ${mbAssess.status}</div></div></div></div>` : ''

      const note = (coachNote || firstNote).replace(/"/g, '&quot;').replace(/'/g, '&#39;')

      body += `<div class="report">
        <div style="background:#0F2240;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="background:#fff;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:900;color:#0F2240;letter-spacing:1px">AWS</div>
            <div>
              <div style="font-size:16px;font-weight:900;color:#fff;letter-spacing:0.5px">AMERICAN WORLD SCHOOL</div>
              <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:2px">Weekly Student Progress Report</div>
              <div style="font-size:10px;color:rgba(255,255,255,.5)">Week of ${weekLabel}</div>
            </div>
          </div>
          <div style="text-align:right"><div style="font-size:9px;font-weight:700;color:#C5A028;text-transform:uppercase;letter-spacing:1px">SUCCESS COACH</div><div style="font-size:12px;font-weight:700;color:#fff">${coachName || 'Success Coach'}</div></div>
        </div>
        <div style="background:#1A365E;padding:12px 24px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="font-size:28px;font-weight:900;color:#C5A028;min-width:52px">${stuNum}</div>
            <div><div style="font-size:18px;font-weight:900;color:#fff">${stu.fullName}</div><div style="font-size:10px;color:rgba(255,255,255,.55)">American World School · ${stu.grade}</div></div>
          </div>
          <div style="display:inline-block;background:${stColor};color:#fff;font-size:10px;font-weight:900;padding:4px 12px;border-radius:4px;letter-spacing:0.5px">${stTxt}</div>
        </div>
        <div style="background:#1A365E;padding:6px 24px 0"><div style="display:inline-block;background:#C5A028;color:#0F2240;font-size:9px;font-weight:900;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">■ ATTENDANCE</div></div>
        <div style="background:#EAF2FB;padding:0 24px 14px"><table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr>${['Mon','Tue','Wed','Thu','Fri','Absences','Tardies'].map(c => `<th style="background:#1A365E;color:#fff;padding:8px 4px;font-size:10px;font-weight:700;text-align:center">${c}</th>`).join('')}</tr></thead><tbody><tr style="background:#fff">${attCells}<td style="text-align:center;padding:10px 4px;font-size:16px;font-weight:900;color:${stuAbsences > 0 ? '#D61F31' : '#1A365E'}">${stuAbsences}</td><td style="text-align:center;padding:10px 4px;font-size:16px;font-weight:900;color:${stuTardies > 0 ? '#B45309' : '#1A365E'}">${stuTardies}</td></tr></tbody></table></div>
        <div style="background:#1A365E;padding:6px 24px 0"><div style="display:inline-block;background:#C5A028;color:#0F2240;font-size:9px;font-weight:900;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">■ ASSIGNMENTS</div></div>
        <div style="background:#EAF2FB;padding:0 24px 14px"><table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr style="background:#1A365E">${['#','Assignment','Subject','Due','In','Status'].map(h => `<th style="padding:8px 10px;text-align:${h==='#'?'center':'left'};color:#fff;font-size:10px;font-weight:700">${h}</th>`).join('')}</tr></thead><tbody>${assignRows}<tr style="background:#1A365E"><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:900;color:#fff">TOTAL</td><td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:900;color:#fff">${weekAssigns.length}</td><td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:900;color:#fff">${doneCount}</td><td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:900;color:${compPct >= 80 ? '#4ADE80' : compPct >= 60 ? '#FCD34D' : '#F87171'}">${compPct}% complete</td></tr></tbody></table><div style="font-size:11px;color:#7A92B0;margin-top:6px">${missingCount} missing assignment${missingCount !== 1 ? 's' : ''}</div></div>
        ${mathSection}${mbSection}
        <div style="background:#1A365E;padding:6px 24px 0"><div style="display:inline-block;background:#C5A028;color:#0F2240;font-size:9px;font-weight:900;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">■ COACH'S PERSONAL NOTE</div></div>
        <div style="background:#FFF8E8;border-left:4px solid #C5A028;padding:16px 24px"><div style="font-size:12px;line-height:1.8;color:#2D3A4F;font-style:italic">"${note}" <span style="font-size:14px">■</span></div></div>
        <div style="background:#1A365E;padding:10px 24px;display:flex;justify-content:space-between;align-items:center"><div style="font-size:9px;color:rgba(255,255,255,.5)">American World School · Weekly Progress Report · ${weekLabel}</div><div style="font-size:9px;color:rgba(255,255,255,.5)">Confidential · For family use only</div></div>
      </div>`
    })

    const win = window.open('', '_blank')
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this site.'); return }
    win.document.write(`<!DOCTYPE html><html><head><title>Weekly Reports — ${weekLabel}</title><style>
      *{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial,sans-serif;background:#f0f0f0}
      .report{max-width:800px;margin:0 auto 32px;border:2.5px solid #1A365E;background:#fff}
      @media print{body{background:#fff;padding:0}.report{border:2.5px solid #1A365E;page-break-after:always;margin:0}.report:last-child{page-break-after:avoid}}
    </style></head><body>${body}<script>window.onload=function(){window.print()}<\/script></body></html>`)
    win.document.close()
  }

  const iStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff' }

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const ATT_CFG: Record<string, { bg: string; tc: string }> = { P: { bg: '#DCFCE7', tc: '#15803D' }, A: { bg: '#FEE2E2', tc: '#D61F31' }, T: { bg: '#FEF3C7', tc: '#B45309' }, L: { bg: '#FEF3C7', tc: '#B45309' }, '—': { bg: '#F1F5F9', tc: '#94A3B8' } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📄 Weekly Progress Report Generator</div>

      {/* Controls card */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 14 }}>⚙️ Report Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Week</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => { setWeekOffset(p => p - 1); setPreview(false) }} style={{ padding: '5px 9px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>◀</button>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', flex: 1, textAlign: 'center' }}>{monday}</span>
              <button onClick={() => { setWeekOffset(p => p + 1); setPreview(false) }} style={{ padding: '5px 9px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>▶</button>
              <button onClick={() => { setWeekOffset(0); setPreview(false) }} style={{ padding: '5px 10px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>This Week</button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Student</label>
            <select value={selStu} onChange={e => { setSelStu(e.target.value); setPreview(false) }} style={{ ...iStyle, width: '100%' }}>
              <option value="">— Select Student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }}>Coach Name</label>
          <input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '8px 10px', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }}>
            ✍️ Coach's Personal Note <span style={{ color: '#D61F31', fontWeight: 400 }}>*required before generating</span>
          </label>
          <textarea
            value={coachNote}
            onChange={e => setCoachNote(e.target.value)}
            rows={4}
            placeholder="Write your personalised note here — this appears on the report sent to the family..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        {/* Attendance preview */}
        {selStu && selStudent && (
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>📋 Attendance Preview</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {DAYS.map((day, i) => {
                const st = attRow[i]?.status ?? '—'
                const cfg = ATT_CFG[st] ?? ATT_CFG['—']
                return (
                  <div key={day} style={{ textAlign: 'center', minWidth: 44 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', marginBottom: 3 }}>{day}</div>
                    <div style={{ padding: '6px 4px', background: cfg.bg, color: cfg.tc, borderRadius: 6, fontSize: 13, fontWeight: 900 }}>{st}</div>
                  </div>
                )
              })}
              <div style={{ marginLeft: 12, display: 'flex', gap: 8 }}>
                <div style={{ textAlign: 'center', padding: '6px 12px', background: '#FEE2E2', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#D61F31' }}>{absences}</div>
                  <div style={{ fontSize: 9, color: '#D61F31', fontWeight: 700 }}>Absences</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 12px', background: '#FEF3C7', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#B45309' }}>{tardies}</div>
                  <div style={{ fontSize: 9, color: '#B45309', fontWeight: 700 }}>Tardies</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { if (!selStu || !coachNote.trim()) { alert('Select a student and add a coach note first.'); return } setPreview(true) }}
            style={{ padding: '9px 18px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >👁 Preview Report</button>
          <button
            onClick={() => window.print()}
            style={{ padding: '9px 22px', background: '#D61F31', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >📥 Download PDF</button>
          <button
            onClick={generateAllStudents}
            style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >📦 Generate All Students</button>
        </div>
      </div>

      {/* Student overview grid (shown when no student selected or not in preview) */}
      {!preview && !selStu && students.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {students.map(s => {
            const { doneCount, compPct, missingCount } = getStudentReport(s.id)
            const initials = s.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
            const col = compPct >= 80 ? '#059669' : compPct >= 60 ? '#D97706' : '#D61F31'
            return (
              <div key={s.id} onClick={() => { setSelStu(s.id); setPreview(false) }} style={{ padding: '12px 14px', background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 12, cursor: 'pointer', boxShadow: '0 1px 4px rgba(26,54,94,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{initials}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', flex: 1 }}>{s.fullName}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', background: col + '18', borderRadius: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: col }}>{compPct}%</div>
                    <div style={{ fontSize: 8, color: col, fontWeight: 700 }}>Done</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', background: '#F0FDF4', borderRadius: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#059669' }}>{doneCount}</div>
                    <div style={{ fontSize: 8, color: '#059669', fontWeight: 700 }}>In</div>
                  </div>
                  {missingCount > 0 && (
                    <div style={{ flex: 1, textAlign: 'center', padding: '4px 6px', background: '#FEE2E2', borderRadius: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#D61F31' }}>{missingCount}</div>
                      <div style={{ fontSize: 8, color: '#D61F31', fontWeight: 700 }}>Missing</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Report Preview */}
      {preview && selStudent && (() => {
        const { doneCount, missingCount, compPct, mathAssess, mbAssess, firstNote } = getStudentReport(selStudent.id)
        const overallSt = (absences >= 2 || compPct < 50) ? 'Needs Focus' : (compPct >= 80 && absences === 0) ? 'On Track' : 'Developing'
        const stCfg: Record<string, { bg: string; txt: string }> = { 'Needs Focus': { bg: '#D61F31', txt: 'Needs Focus ■■' }, 'On Track': { bg: '#059669', txt: 'On Track ■■■' }, 'Developing': { bg: '#D97706', txt: 'Developing ■■' } }
        const mathScore = mathAssess?.raw_score !== null && mathAssess?.raw_score !== undefined ? mathAssess.raw_score : null
        const mathPct = mathAssess?.max_score && mathScore !== null ? Math.round(mathScore / mathAssess.max_score * 100) : mathScore
        const mathNeedsFocus = mathPct !== null && mathPct < 80
        const stuIdx = students.findIndex(s => s.id === selStudent.id)
        const stuNum = `#${String(stuIdx + 1).padStart(2, '0')}`

        return (
          <div id="rpt-preview-panel" style={{ border: '2.5px solid #1A365E', borderRadius: 4, overflow: 'hidden', background: '#fff', fontFamily: 'Arial,sans-serif', maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ background: '#0F2240', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 900, color: '#0F2240', letterSpacing: 1 }}>AWS</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>AMERICAN WORLD SCHOOL</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>Weekly Student Progress Report</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>Week of {fmtWeekRange(monday, friday)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#C5A028', textTransform: 'uppercase', letterSpacing: 1 }}>SUCCESS COACH</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{coachName || 'Success Coach'}</div>
              </div>
            </div>

            {/* Student band */}
            <div style={{ background: '#1A365E', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#C5A028', minWidth: 52 }}>{stuNum}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{selStudent.fullName}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>American World School · {selStudent.grade}</div>
                </div>
              </div>
              <div style={{ display: 'inline-block', background: stCfg[overallSt].bg, color: '#fff', fontSize: 10, fontWeight: 900, padding: '4px 12px', borderRadius: 4, letterSpacing: 0.5 }}>{stCfg[overallSt].txt}</div>
            </div>

            {/* Attendance */}
            <div style={{ background: '#1A365E', padding: '6px 24px 0' }}>
              <div style={{ display: 'inline-block', background: '#C5A028', color: '#0F2240', fontSize: 9, fontWeight: 900, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>■ ATTENDANCE</div>
            </div>
            <div style={{ background: '#EAF2FB', padding: '0 24px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead><tr>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Absences', 'Tardies'].map(col => (
                    <th key={col} style={{ background: '#1A365E', color: '#fff', padding: '8px 4px', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{col}</th>
                  ))}
                </tr></thead>
                <tbody><tr style={{ background: '#fff' }}>
                  {attRow.map((a, i) => {
                    const st = a.status ?? '—'
                    const tc = st === 'A' ? '#D61F31' : st === 'T' || st === 'L' ? '#B45309' : st === 'P' ? '#1A365E' : '#94A3B8'
                    return <td key={i} style={{ textAlign: 'center', padding: '10px 4px', fontSize: 16, fontWeight: 900, color: tc }}>{st}</td>
                  })}
                  <td style={{ textAlign: 'center', padding: '10px 4px', fontSize: 16, fontWeight: 900, color: absences > 0 ? '#D61F31' : '#1A365E' }}>{absences}</td>
                  <td style={{ textAlign: 'center', padding: '10px 4px', fontSize: 16, fontWeight: 900, color: tardies > 0 ? '#B45309' : '#1A365E' }}>{tardies}</td>
                </tr></tbody>
              </table>
            </div>

            {/* Assignments */}
            <div style={{ background: '#1A365E', padding: '6px 24px 0' }}>
              <div style={{ display: 'inline-block', background: '#C5A028', color: '#0F2240', fontSize: 9, fontWeight: 900, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>■ ASSIGNMENTS</div>
            </div>
            <div style={{ background: '#EAF2FB', padding: '0 24px 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                <thead><tr style={{ background: '#1A365E' }}>
                  {['#', 'Assignment', 'Subject', 'Due', 'In', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' ? 'center' : 'left', color: '#fff', fontSize: 10, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {weekAssigns.map((a, ai) => {
                    const sub = subMap[`${a.id}_${selStudent.id}`]
                    const submitted = sub && (sub.status === 'Turned In' || sub.status === 'Late') ? 1 : 0
                    const isMissing = !sub || sub.status === 'Missing'
                    return (
                      <tr key={a.id} style={{ background: ai % 2 ? '#F0F4FA' : '#fff' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{ai + 1}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{a.title}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: '#1A365E' }}>{a.subject}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>1</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{submitted}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ color: isMissing ? '#D61F31' : '#059669', fontWeight: 700, fontSize: 11 }}>■ {isMissing ? 'Missing' : sub?.status ?? 'Submitted'}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {weekAssigns.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 11 }}>No assignments due this week</td></tr>}
                  <tr style={{ background: '#1A365E' }}>
                    <td colSpan={3} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 900, color: '#fff' }}>TOTAL</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>{weekAssigns.length}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>{doneCount}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: compPct >= 80 ? '#4ADE80' : compPct >= 60 ? '#FCD34D' : '#F87171' }}>{compPct}% complete</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6 }}>{missingCount} missing assignment{missingCount !== 1 ? 's' : ''}</div>
            </div>

            {/* Math assessment */}
            {mathAssess && mathPct !== null && (
              <>
                <div style={{ background: '#1A365E', padding: '6px 24px 0' }}>
                  <div style={{ display: 'inline-block', background: '#C5A028', color: '#0F2240', fontSize: 9, fontWeight: 900, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>■ MATH ASSESSMENT</div>
                </div>
                <div style={{ background: '#EAF2FB', padding: 14 }}>
                  <div style={{ background: '#fff', border: '1px solid #DDE6F0', borderRadius: 4, padding: 14, display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: mathNeedsFocus ? '#D61F31' : '#059669', minWidth: 70 }}>{mathPct}%</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>Math Assessment Score</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: mathNeedsFocus ? '#D61F31' : '#059669', marginTop: 4 }}>{mathNeedsFocus ? 'Needs Focus ■■' : 'On Track ■■■'}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#D61F31', background: '#FEE2E2', padding: '4px 10px', borderRadius: 4 }}>■ Target: 80%+</span>
                  </div>
                </div>
              </>
            )}

            {/* Mind & Body assessment */}
            {mbAssess && mbAssess.raw_score !== null && (
              <>
                <div style={{ background: '#1A365E', padding: '6px 24px 0' }}>
                  <div style={{ display: 'inline-block', background: '#C5A028', color: '#0F2240', fontSize: 9, fontWeight: 900, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>■ MIND & BODY</div>
                </div>
                <div style={{ background: '#EAF2FB', padding: 14 }}>
                  <div style={{ background: '#fff', border: '1px solid #DDE6F0', borderRadius: 4, padding: 14, display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#059669', minWidth: 70 }}>
                      {mbAssess.max_score ? Math.round(mbAssess.raw_score / mbAssess.max_score * 100) + '%' : mbAssess.raw_score}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>Mind & Body / PE Assessment Score</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Status: {mbAssess.status}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Coach's note */}
            <div style={{ background: '#1A365E', padding: '6px 24px 0' }}>
              <div style={{ display: 'inline-block', background: '#C5A028', color: '#0F2240', fontSize: 9, fontWeight: 900, padding: '3px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>■ COACH'S PERSONAL NOTE</div>
            </div>
            <div style={{ background: '#FFF8E8', borderLeft: '4px solid #C5A028', padding: '16px 24px' }}>
              <div style={{ fontSize: 12, lineHeight: 1.8, color: '#2D3A4F', fontStyle: 'italic' }}>"{coachNote || firstNote}" <span style={{ fontSize: 14 }}>■</span></div>
            </div>

            {/* Footer */}
            <div style={{ background: '#1A365E', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>American World School · Weekly Progress Report · {fmtWeekRange(monday, friday)}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>Confidential · For family use only</div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
