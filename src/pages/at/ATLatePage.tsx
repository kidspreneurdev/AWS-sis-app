import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

const AT_LATE_REASONS = ['Absent', 'Technical Issues', 'Family Circumstance', 'Medical', 'Forgot', 'No Reason Given', 'Other']

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 14 }

interface Assignment { id: string; title: string; subject: string; due_date: string; max_score: number | null }
interface Submission { id: string; assignment_id: string; student_id: string; status: string; score: number | null; late_reason: string; penalty_applied: boolean; penalty_waived: boolean; file_url: string; link_url: string; student_note: string; submitted_date: string }
interface Student { id: string; fullName: string }

interface LateRecord { assign: Assignment; student: Student; sub: Submission; daysLate: number }

export function ATLatePage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [filterStu, setFilterStu] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])
  const assignMap = useMemo(() => Object.fromEntries(assignments.map(a => [a.id, a])), [assignments])

  async function load() {
    const [{ data: a }, { data: sub }, { data: st }] = await Promise.all([
      supabase.from('at_assignments').select('id,title,subject,due_date,max_score').order('due_date'),
      supabase.from('at_submissions').select('id,assignment_id,student_id,status,score,late_reason,penalty_applied,penalty_waived').in('status', ['Late', 'Missing']),
      supabase.from('students').select('id,full_name').eq('status', 'enrolled').order('full_name'),
    ])
    if (a) setAssignments(a.map((r: Record<string, unknown>) => ({
      id: r.id as string, title: r.title as string, subject: (r.subject as string) ?? '',
      due_date: (r.due_date as string) ?? '', max_score: r.max_score as number | null,
    })))
    if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({
      id: r.id as string, assignment_id: r.assignment_id as string, student_id: r.student_id as string,
      status: r.status as string, score: r.score as number | null,
      late_reason: (r.late_reason as string) ?? '', penalty_applied: (r.penalty_applied as boolean) ?? false,
      penalty_waived: (r.penalty_waived as boolean) ?? false,
      file_url: (r.file_url as string) ?? '', link_url: (r.link_url as string) ?? '',
      student_note: (r.student_note as string) ?? '', submitted_date: (r.submitted_date as string) ?? '',
    })))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '' })))
  }
  useEffect(() => { load() }, [])

  const lateRecords = useMemo((): LateRecord[] => {
    const recs: LateRecord[] = []
    submissions.forEach(sub => {
      const assign = assignMap[sub.assignment_id]
      const student = studentMap[sub.student_id]
      if (!assign || !student) return
      const daysLate = sub.status === 'Missing'
        ? Math.max(0, Math.round((new Date(today).getTime() - new Date(assign.due_date + 'T00:00:00').getTime()) / 86400000))
        : sub.submitted_date
          ? Math.max(0, Math.round((new Date(sub.submitted_date + 'T00:00:00').getTime() - new Date(assign.due_date + 'T00:00:00').getTime()) / 86400000))
          : 0
      recs.push({ assign, student, sub, daysLate })
    })
    const filtered = filterStu ? recs.filter(r => r.student.id === filterStu) : recs
    return filtered.sort((a, b) => b.daysLate - a.daysLate)
  }, [submissions, assignMap, studentMap, filterStu, today])

  const missCount = useMemo(() => lateRecords.filter(r => r.sub.status === 'Missing').length, [lateRecords])
  const lateCount = useMemo(() => lateRecords.filter(r => r.sub.status === 'Late').length, [lateRecords])
  const penalCount = useMemo(() => lateRecords.filter(r => r.sub.penalty_applied && !r.sub.penalty_waived).length, [lateRecords])

  async function applyPenalty(subId: string) {
    setSaving(subId)
    await supabase.from('at_submissions').update({ penalty_applied: true, penalty_waived: false }).eq('id', subId)
    await load()
    setSaving(null)
  }

  async function waivePenalty(subId: string) {
    const reason = prompt('Enter reason for waiving penalty:')
    if (!reason) return
    setSaving(subId)
    await supabase.from('at_submissions').update({ penalty_waived: true, waiver_reason: reason, waived_at: new Date().toISOString() }).eq('id', subId)
    await load()
    setSaving(null)
  }

  async function saveReason(subId: string, reason: string) {
    setSaving(subId)
    await supabase.from('at_submissions').update({ late_reason: reason }).eq('id', subId)
    setSubmissions(p => p.map(s => s.id === subId ? { ...s, late_reason: reason } : s))
    setSaving(null)
  }

  const iStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11, background: '#fff', color: '#1A365E' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>⏰ Late Submission Management</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{lateRecords.length} late/missing records</div>
        </div>
        <button onClick={() => load()} style={{ padding: '7px 14px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[{ v: lateCount, l: 'Late', c: '#D97706', bg: '#FEF3C7' }, { v: missCount, l: 'Missing', c: '#D61F31', bg: '#FEE2E2' }, { v: penalCount, l: 'Penalised', c: '#7C3AED', bg: '#F5F3FF' }].map(chip => (
          <div key={chip.l} style={{ padding: '10px 16px', background: chip.bg, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: chip.c }}>{chip.v}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: chip.c }}>{chip.l}</div>
          </div>
        ))}
      </div>

      {/* Student filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <select value={filterStu} onChange={e => setFilterStu(e.target.value)} style={{ ...iStyle, flex: 1 }}>
          <option value="">All Students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
      </div>

      {lateRecords.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 36 }}>✅</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>No late or missing submissions</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lateRecords.map(r => {
            const isMissing = r.sub.status === 'Missing'
            const borderCol = isMissing ? '#D61F31' : r.daysLate > 3 ? '#D97706' : '#F59E0B'
            const penalty = r.sub.penalty_applied && !r.sub.penalty_waived
            const penalisedScore = penalty && r.sub.score !== null && r.assign.max_score
              ? Math.max(0, r.sub.score - (r.daysLate * 0.1 * r.assign.max_score))
              : null

            return (
              <div key={`${r.assign.id}_${r.student.id}`} style={{ ...card, borderLeft: `4px solid ${borderCol}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, background: borderCol + '20', color: borderCol, padding: '2px 8px', borderRadius: 5 }}>{r.sub.status}</span>
                      {r.daysLate > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: borderCol }}>{r.daysLate} day{r.daysLate > 1 ? 's' : ''} overdue</span>}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{r.student.fullName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#3D5475', marginBottom: 3 }}>📝 {r.assign.title}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>📚 {r.assign.subject}  ·  Due: {r.assign.due_date}{r.sub.submitted_date ? `  ·  Submitted: ${r.sub.submitted_date}` : ''}</div>
                    {(r.sub.file_url || r.sub.link_url || r.sub.student_note) && (
                      <div style={{ marginTop: 5, padding: '6px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8' }}>📄 Submission</div>
                        {r.sub.file_url && <a href={r.sub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', textDecoration: 'none' }}>📎 View uploaded file</a>}
                        {r.sub.link_url && <a href={r.sub.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', textDecoration: 'none' }}>🔗 {r.sub.link_url.length > 55 ? r.sub.link_url.slice(0, 55) + '…' : r.sub.link_url}</a>}
                        {r.sub.student_note && <div style={{ fontSize: 10, color: '#374151', fontStyle: 'italic' }}>💬 "{r.sub.student_note}"</div>}
                      </div>
                    )}
                    {r.sub.score !== null && r.sub.score !== undefined && (
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                        Score: {r.sub.score}{r.assign.max_score ? `/${r.assign.max_score}` : ''}
                        {penalty && penalisedScore !== null && <> → Penalised: <span style={{ color: '#D61F31', fontWeight: 700 }}>{penalisedScore.toFixed(1)}</span></>}
                        {r.sub.penalty_waived && <span style={{ color: '#059669', fontWeight: 700 }}> (Penalty Waived)</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    {!r.sub.penalty_applied && r.sub.status === 'Late' && r.sub.score !== null && (
                      <button onClick={() => applyPenalty(r.sub.id)} disabled={saving === r.sub.id} style={{ padding: '5px 10px', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Apply Penalty</button>
                    )}
                    {r.sub.penalty_applied && !r.sub.penalty_waived && (
                      <button onClick={() => waivePenalty(r.sub.id)} disabled={saving === r.sub.id} style={{ padding: '5px 10px', background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Waive Penalty</button>
                    )}
                    <select
                      value={r.sub.late_reason || ''}
                      onChange={e => saveReason(r.sub.id, e.target.value)}
                      style={{ padding: '4px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 9 }}
                    >
                      <option value="">Reason...</option>
                      {AT_LATE_REASONS.map(reason => <option key={reason}>{reason}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
