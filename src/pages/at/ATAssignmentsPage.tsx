import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { useCohorts } from '@/hooks/useCohorts'
import { RubricBuilder, rubricParse, rubricMaxPoints, rubricComputeScore, rubricScale, type Rubric } from '@/components/shared/RubricBuilder'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const AT_TYPES = ['Homework', 'Classwork', 'Project', 'Quiz', 'Assessment', 'Worksheet', 'Lab', 'Reading', 'Correction', 'Custom']
const AT_SUBJECTS = ['Mathematics', 'English Language Arts', 'Reading', 'Science', 'Social Studies', 'Entrepreneurship', 'Art', 'World Language', 'Physical Education', 'Computer Science', 'Other']
const AT_DIVISIONS = ['Elementary', 'Middle School', 'High School', 'All']
const AT_STATUS = ['Assigned', 'Turned In', 'Missing', 'Late', 'Incomplete', 'Resubmit', 'Resubmitted', 'Excused']
const AT_GRADING_SCALES = ['Points', 'Letter Grade', 'GPA (4.0)', 'Percentage']

const TYPE_COLORS: Record<string, string> = {
  Homework: '#3B82F6', Classwork: '#8B5CF6', Quiz: '#EF4444', Assessment: '#D97706',
  Project: '#0891B2', Lab: '#059669', Worksheet: '#6366F1',
}
const STATUS_COLORS: Record<string, string> = {
  'Assigned': '#94A3B8', 'Turned In': '#059669', 'Missing': '#D61F31',
  'Late': '#D97706', 'Incomplete': '#6366F1', 'Resubmit': '#0891B2', 'Resubmitted': '#7C3AED', 'Excused': '#6B7280',
}

function gpaColor(g: number | null): { bg: string; tc: string } {
  if (g === null) return { bg: '#F0F4FA', tc: '#7A92B0' }
  if (g >= 3.5) return { bg: '#FEF9C3', tc: '#92400E' }
  if (g >= 3.0) return { bg: '#DCFCE7', tc: '#14532D' }
  if (g >= 2.5) return { bg: '#DBEAFE', tc: '#1E3A8A' }
  if (g >= 2.0) return { bg: '#FFEDD5', tc: '#9A3412' }
  return { bg: '#FEE2E2', tc: '#7F1D1D' }
}

const EMPTY_FORM = {
  title: '', type: 'Homework', subject: 'Mathematics', division: 'All', cohort: '',
  gradingScale: 'Points', maxScore: '',
  dateAssigned: new Date().toISOString().slice(0, 10), dueDate: '', dueTime: '',
  instructions: '', rubric: '',
}

// ── RubricScoringModal ────────────────────────────────────────────────────────
function RubricScoringModal({ rubric, assignMax, studentName, existingScores, onClose, onSave }: {
  rubric: Rubric; assignMax: number; studentName: string
  existingScores: Record<string, number>
  onClose: () => void
  onSave: (score: number, selMap: Record<string, number>) => void
}) {
  const [sel, setSel] = useState<Record<string, number>>(existingScores)
  const rubMax = rubricMaxPoints(rubric)
  const raw = rubricComputeScore(rubric, sel)
  const scaled = rubricScale(raw, rubMax, assignMax)

  function pick(cid: string, pts: number) {
    setSel(p => ({ ...p, [cid]: pts }))
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '14px 20px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>📐 Rubric Scoring — {studentName}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>Max: {assignMax} pts · Rubric max: {rubMax} pts</div>
          </div>
          <button onClick={onClose} style={{ padding: '4px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rubric.criteria.map(c => {
            const maxPts = c.levels.reduce((m, l) => Math.max(m, l.points), 0)
            const curPts = sel[c.id]
            const ptsColor = curPts !== undefined ? (curPts >= maxPts * 0.75 ? '#059669' : curPts >= maxPts * 0.5 ? '#D97706' : '#D61F31') : '#94A3B8'
            const selLv = c.levels.find(l => l.points === curPts)
            return (
              <div key={c.id} style={{ background: '#F7F9FC', borderRadius: 9, padding: '10px 12px', border: '1px solid #E4EAF2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>{c.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: ptsColor }}>{curPts !== undefined ? curPts : '—'} / {maxPts} pts</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 4 }}>
                  {c.levels.map(lv => {
                    const isSelected = sel[c.id] === lv.points
                    return (
                      <button key={lv.points} onClick={() => pick(c.id, lv.points)} title={lv.description} style={{ padding: '5px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `2px solid ${isSelected ? '#1A365E' : '#E4EAF2'}`, background: isSelected ? '#1A365E' : '#fff', color: isSelected ? '#fff' : '#3D5475', textAlign: 'left', transition: 'all .12s' }}>
                        <span style={{ display: 'block', fontSize: 9, fontWeight: 800, color: isSelected ? 'rgba(255,255,255,.7)' : '#7A92B0' }}>{lv.points} pts</span>
                        {lv.label}
                      </button>
                    )
                  })}
                </div>
                {selLv?.description && <div style={{ marginTop: 5, fontSize: 10, color: '#5A7290', fontStyle: 'italic' }}>{selLv.description}</div>}
              </div>
            )
          })}
          <div style={{ background: raw > 0 ? '#EEF3FF' : '#F7F9FC', borderRadius: 9, padding: '10px 14px', border: `1px solid ${raw > 0 ? '#C4D4E8' : '#E4EAF2'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>Total Rubric Score</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>{raw}</span>
              <span style={{ fontSize: 11, color: '#7A92B0' }}> / {rubMax} pts</span>
              {assignMax !== rubMax && <div style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>→ {scaled} / {assignMax} (scaled)</div>}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(scaled, sel)} style={{ padding: '8px 20px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💾 Apply Score ({scaled} / {assignMax})</button>
        </div>
      </div>
    </div>
  )
}

interface Assignment {
  id: string; title: string; type: string; subject: string; division: string; cohort: string
  gradingScale: string; maxScore: number | null; dateAssigned: string; dueDate: string; dueTime: string
  instructions: string; rubric: string
}
interface Submission { id: string; assignment_id: string; student_id: string; status: string; score: number | null; teacher_note: string; file_url: string; link_url: string; student_note: string; submitted_date: string }
interface Student { id: string; fullName: string; grade: string }

// ── AssignModal ───────────────────────────────────────────────────────────────
function AssignModal({ item, cohorts, onClose, onSave }: {
  item: Assignment | null
  cohorts: string[]
  onClose: () => void
  onSave: (f: typeof EMPTY_FORM, id?: string) => Promise<void>
}) {
  const [form, setForm] = useState(item ? {
    title: item.title, type: item.type, subject: item.subject, division: item.division,
    cohort: item.cohort ?? '', gradingScale: item.gradingScale ?? 'Points',
    maxScore: item.maxScore ? String(item.maxScore) : '',
    dateAssigned: item.dateAssigned, dueDate: item.dueDate, dueTime: item.dueTime ?? '',
    instructions: item.instructions, rubric: item.rubric ?? '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }

  async function handleSave() {
    if (!form.title || !form.dueDate) { alert('Title and due date are required'); return }
    setSaving(true); await onSave(form, item?.id); setSaving(false); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 720, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 22px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>📝 {item ? 'Edit' : 'New'} Assignment</div>
          <button onClick={onClose} style={{ padding: '4px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          {/* Row 1: Title */}
          <div><label style={lbl}>Assignment Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} placeholder="e.g. Chapter 5 Homework" /></div>

          {/* Row 2: Type + Subject */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Type</label><select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>{AT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Subject</label><select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>{AT_SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>

          {/* Row 3: Division + Cohort */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Division</label><select value={form.division} onChange={e => set('division', e.target.value)} style={inp}>{AT_DIVISIONS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div>
              <label style={lbl}>Cohort</label>
              <select value={form.cohort} onChange={e => set('cohort', e.target.value)} style={inp}>
                <option value="">All Cohorts</option>
                {cohorts.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Grading Scale + Max Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Grading Scale</label><select value={form.gradingScale} onChange={e => set('gradingScale', e.target.value)} style={inp}>{AT_GRADING_SCALES.map(g => <option key={g}>{g}</option>)}</select></div>
            <div><label style={lbl}>Max Score</label><input type="number" value={form.maxScore} onChange={e => set('maxScore', e.target.value)} style={inp} placeholder="Leave blank = ungraded" /></div>
          </div>

          {/* Row 5: Date Assigned + Due Date + Due Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Date Assigned</label><input type="date" value={form.dateAssigned} onChange={e => set('dateAssigned', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Due Date *</label><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Due Time</label><input type="time" value={form.dueTime} onChange={e => set('dueTime', e.target.value)} style={inp} /></div>
          </div>

          {/* Row 6: Instructions */}
          <div><label style={lbl}>Instructions / Notes</label><textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Full task description..." /></div>

          {/* Row 7: Rubric Builder */}
          <div>
            <label style={{ ...lbl, marginBottom: 6 }}>Rubric (optional)</label>
            <RubricBuilder value={form.rubric} onChange={v => set('rubric', v)} />
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : '💾 Save Assignment'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ATAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const cohorts = useCohorts()
  const [filterType, setFilterType] = useState('All')
  const [filterSubject, setFilterSubject] = useState('All')
  const [filterCohort, setFilterCohort] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; item: Assignment | null }>({ open: false, item: null })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [localSubs, setLocalSubs] = useState<Record<string, { status: string; score: string; note: string }>>({})
  const [rubricModal, setRubricModal] = useState<{ assignId: string; studentId: string; studentName: string; rubric: Rubric; assignMax: number; existingScores: Record<string, number> } | null>(null)

  const load = useCallback(async () => {
    const [{ data: a }, { data: sub }, { data: st }] = await Promise.all([
      supabase.from('at_assignments').select('*').order('due_date'),
      supabase.from('at_submissions').select('*'),
      supabase.from('students').select('id,first_name,last_name,grade').eq('status', 'Enrolled').order('last_name'),
    ])
    if (a) setAssignments(a.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string,
      type: (r.type as string) ?? 'Homework',
      subject: (r.subject as string) ?? '',
      division: (r.division as string) ?? 'All',
      cohort: (r.cohort as string) ?? '',
      gradingScale: (r.grading_scale as string) ?? 'Points',
      maxScore: r.max_score as number | null,
      dateAssigned: (r.date_assigned as string) ?? (r.created_at as string ?? '').slice(0, 10),
      dueDate: (r.due_date as string) ?? '',
      dueTime: (r.due_time as string) ?? '',
      instructions: (r.instructions as string) ?? (r.description as string) ?? '',
      rubric: (r.rubric as string) ?? '',
    })))
    if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      assignment_id: r.assignment_id as string,
      student_id: r.student_id as string,
      status: r.status as string,
      score: r.score as number | null,
      teacher_note: (r.teacher_note as string) ?? '',
      file_url: (r.file_url as string) ?? '',
      link_url: (r.link_url as string) ?? '',
      student_note: (r.student_note as string) ?? '',
      submitted_date: (r.submitted_date as string) ?? '',
    })))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      fullName: `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim(),
      grade: String(r.grade ?? ''),
    })))
  }, [])

  useEffect(() => { load() }, [load])

  const subMap = useMemo(() => {
    const m: Record<string, Submission> = {}
    submissions.forEach(s => { m[`${s.assignment_id}_${s.student_id}`] = s })
    return m
  }, [submissions])

  const filtered = useMemo(() => assignments.filter(a => {
    if (filterType !== 'All' && a.type !== filterType) return false
    if (filterSubject !== 'All' && a.subject !== filterSubject) return false
    if (filterCohort !== 'All' && a.cohort !== filterCohort) return false
    return true
  }), [assignments, filterType, filterSubject, filterCohort])

  async function saveAssignment(form: typeof EMPTY_FORM, id?: string) {
    const payload: Record<string, unknown> = {
      title: form.title, type: form.type, subject: form.subject, division: form.division,
      cohort: form.cohort || null,
      grading_scale: form.gradingScale,
      max_score: form.maxScore ? parseFloat(form.maxScore) : null,
      date_assigned: form.dateAssigned || null,
      due_date: form.dueDate || null,
      due_time: form.dueTime || null,
      instructions: form.instructions,
      rubric: form.rubric || null,
    }
    if (id) await supabase.from('at_assignments').update(payload).eq('id', id)
    else {
      const year = new Date().getFullYear()
      payload.academic_year = `${year}-${year + 1}`
      await supabase.from('at_assignments').insert(payload)
    }
    await load()
  }

  async function deleteAssignment(id: string) {
    if (!confirm('Delete this assignment?')) return
    await supabase.from('at_assignments').delete().eq('id', id)
    setAssignments(p => p.filter(a => a.id !== id))
  }

  function openGrades(assignId: string) {
    if (expandedId === assignId) { setExpandedId(null); return }
    setExpandedId(assignId)
    const init: Record<string, { status: string; score: string; note: string }> = {}
    students.forEach(s => {
      const sub = subMap[`${assignId}_${s.id}`]
      init[s.id] = { status: sub?.status ?? 'Assigned', score: sub?.score !== null && sub?.score !== undefined ? String(sub.score) : '', note: sub?.teacher_note ?? '' }
    })
    setLocalSubs(init)
  }

  async function saveGrades(assign: Assignment) {
    const today = new Date().toISOString().slice(0, 10)
    const isOverdue = assign.dueDate && today > assign.dueDate

    for (const s of students) {
      const ls = localSubs[s.id]
      if (!ls) continue
      const key = `${assign.id}_${s.id}`

      // Auto-detect Late: if overdue and still "Assigned" → mark Late
      let finalStatus = ls.status
      if (isOverdue && ls.status === 'Assigned') finalStatus = 'Late'

      const payload = {
        assignment_id: assign.id, student_id: s.id,
        status: finalStatus,
        score: ls.score ? parseFloat(ls.score) : null,
        teacher_note: ls.note,
      }
      const existing = subMap[key]
      if (existing) await supabase.from('at_submissions').update(payload).eq('id', existing.id)
      else await supabase.from('at_submissions').insert(payload)
    }
    await load()
    alert('Grades saved ✓')
  }

  const totalSubmissions = submissions.length

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, item: null })} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ New Assignment</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={iStyle}><option value="All">All Types</option>{AT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={iStyle}><option value="All">All Subjects</option>{AT_SUBJECTS.map(s => <option key={s}>{s}</option>)}</select>
        <select value={filterCohort} onChange={e => setFilterCohort(e.target.value)} style={iStyle}>
          <option value="All">All Cohorts</option>
          {cohorts.map(c => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#7A92B0', alignSelf: 'center', flex: 1 }}>
          {filtered.length} assignment{filtered.length !== 1 ? 's' : ''} · {totalSubmissions} submission record{totalSubmissions !== 1 ? 's' : ''}
        </span>
        <button onClick={() => load()} style={{ padding: '7px 14px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {filtered.length === 0 && (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 36 }}>📝</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>No assignments yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create your first assignment above.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(a => {
          const submCount = submissions.filter(s => s.assignment_id === a.id && s.status === 'Turned In').length
          const missCount = submissions.filter(s => s.assignment_id === a.id && s.status === 'Missing').length
          const totalSubsForAssign = submissions.filter(s => s.assignment_id === a.id).length
          const pct = students.length ? Math.round(submCount / students.length * 100) : 0
          const typeCol = TYPE_COLORS[a.type] ?? '#6B7280'
          const isOpen = expandedId === a.id
          const isOverdue = a.dueDate && new Date().toISOString().slice(0, 10) > a.dueDate

          return (
            <div key={a.id} style={{ ...card, padding: '14px 16px', borderLeft: `4px solid ${typeCol}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, background: typeCol + '18', color: typeCol, padding: '2px 7px', borderRadius: 5 }}>{a.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{a.title}</span>
                    {isOverdue && <span style={{ fontSize: 9, fontWeight: 800, background: '#FEE2E2', color: '#D61F31', padding: '2px 7px', borderRadius: 5 }}>OVERDUE</span>}
                    {a.rubric && rubricParse(a.rubric) && <span style={{ fontSize: 9, fontWeight: 800, background: '#F5F3FF', color: '#7C3AED', padding: '2px 7px', borderRadius: 5 }}>📐 Rubric</span>}
                    <span style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'monospace' }}>#{a.id.slice(0, 8)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#7A92B0', flexWrap: 'wrap' }}>
                    <span>📚 {a.subject}</span>
                    <span>🏫 {a.division}</span>
                    {a.cohort && <span>👥 {a.cohort}</span>}
                    {a.dateAssigned && <span>📅 Assigned: {a.dateAssigned}</span>}
                    <span>⏰ Due: {a.dueDate}{a.dueTime ? ` at ${a.dueTime}` : ''}</span>
                    {a.maxScore && <span>🎯 Max: {a.maxScore}pts ({a.gradingScale})</span>}
                    <span style={{ color: '#94A3B8' }}>{totalSubsForAssign} records</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center', padding: '6px 10px', background: '#F0FDF4', borderRadius: 8, minWidth: 48 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#059669' }}>{pct}%</div>
                    <div style={{ fontSize: 8, color: '#059669' }}>submitted</div>
                  </div>
                  {missCount > 0 && (
                    <div style={{ textAlign: 'center', padding: '6px 10px', background: '#FEE2E2', borderRadius: 8, minWidth: 40 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#D61F31' }}>{missCount}</div>
                      <div style={{ fontSize: 8, color: '#D61F31' }}>missing</div>
                    </div>
                  )}
                  <button onClick={() => openGrades(a.id)} style={{ padding: '6px 12px', background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{isOpen ? '▲ Hide' : '▼ Grades'}</button>
                  <button onClick={() => setModal({ open: true, item: a })} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #DDE6F0', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✏️</button>
                  <button onClick={() => deleteAssignment(a.id)} style={{ padding: '6px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>

              {/* Grade entry panel */}
              {isOpen && (
                <div style={{ marginTop: 12, borderTop: '1px solid #E4EAF2', paddingTop: 12 }}>
                  {isOverdue && (
                    <div style={{ marginBottom: 8, padding: '6px 10px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 7, fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                      ⚠️ Assignment is overdue — students still on "Assigned" will be auto-marked <strong>Late</strong> on save.
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Student Submissions & Grades</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 8 }}>
                    {students.map(s => {
                      const ls = localSubs[s.id] ?? { status: 'Assigned', score: '', note: '' }
                      const sc = STATUS_COLORS[ls.status] ?? '#94A3B8'
                      const initials = s.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
                      const gpa = a.maxScore && ls.score ? (parseFloat(ls.score) / a.maxScore) * 4.0 : null
                      const gc = gpaColor(gpa)
                      const existingSub = subMap[`${a.id}_${s.id}`]
                      const hasSubContent = !!(existingSub?.file_url || existingSub?.link_url || existingSub?.student_note)
                      return (
                        <div key={s.id} style={{ padding: '10px 12px', background: hasSubContent ? '#F0FDF4' : '#F7F9FC', borderRadius: 10, border: `1px solid ${hasSubContent ? '#BBF7D0' : '#E4EAF2'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{initials}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{s.fullName}</div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: sc }}>{ls.status}</span>
                              {existingSub?.submitted_date && <span style={{ fontSize: 8, color: '#94A3B8', marginLeft: 6 }}>Submitted: {existingSub.submitted_date}</span>}
                            </div>
                            {gpa !== null && <span style={{ fontSize: 10, fontWeight: 800, background: gc.bg, color: gc.tc, padding: '2px 6px', borderRadius: 5 }}>{gpa.toFixed(2)}</span>}
                          </div>
                          {hasSubContent && (
                            <div style={{ marginBottom: 6, padding: '6px 8px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#1D4ED8' }}>📄 Submission</div>
                              {existingSub?.file_url && <a href={existingSub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', textDecoration: 'none' }}>📎 View uploaded file</a>}
                              {existingSub?.link_url && <a href={existingSub.link_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, fontWeight: 700, color: '#0369A1', textDecoration: 'none' }}>🔗 {existingSub.link_url.length > 50 ? existingSub.link_url.slice(0, 50) + '…' : existingSub.link_url}</a>}
                              {existingSub?.student_note && <div style={{ fontSize: 10, color: '#374151', fontStyle: 'italic' }}>💬 "{existingSub.student_note}"</div>}
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: a.rubric ? 5 : 0 }}>
                            <select
                              value={ls.status}
                              onChange={e => setLocalSubs(p => ({ ...p, [s.id]: { ...p[s.id], status: e.target.value } }))}
                              style={{ padding: '4px 5px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 10 }}
                            >
                              {AT_STATUS.map(st => <option key={st}>{st}</option>)}
                            </select>
                            <input
                              type="number"
                              placeholder="Score"
                              value={ls.score}
                              onChange={e => setLocalSubs(p => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value } }))}
                              style={{ padding: '4px 5px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 10, width: '100%', boxSizing: 'border-box' }}
                            />
                            <input
                              type="text"
                              placeholder="Feedback"
                              value={ls.note}
                              onChange={e => setLocalSubs(p => ({ ...p, [s.id]: { ...p[s.id], note: e.target.value } }))}
                              style={{ padding: '4px 5px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 10, width: '100%', boxSizing: 'border-box' }}
                            />
                          </div>
                          {a.rubric && rubricParse(a.rubric) && (
                            <button onClick={() => {
                              const parsed = rubricParse(a.rubric)!
                              let existing: Record<string, number> = {}
                              try { const rs = (existingSub as unknown as Record<string, unknown>)?.rubric_scores; if (rs) existing = typeof rs === 'string' ? JSON.parse(rs) : rs as Record<string, number> } catch { /* empty */ }
                              setRubricModal({ assignId: a.id, studentId: s.id, studentName: s.fullName, rubric: parsed, assignMax: a.maxScore || 100, existingScores: existing })
                            }} style={{ padding: '3px 9px', background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer', width: '100%' }}>📐 Rubric Score</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => saveGrades(a)} style={{ padding: '7px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>💾 Save All Grades</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal.open && <AssignModal item={modal.item} cohorts={cohorts} onClose={() => setModal({ open: false, item: null })} onSave={saveAssignment} />}
      {rubricModal && (
        <RubricScoringModal
          rubric={rubricModal.rubric}
          assignMax={rubricModal.assignMax}
          studentName={rubricModal.studentName}
          existingScores={rubricModal.existingScores}
          onClose={() => setRubricModal(null)}
          onSave={async (score, selMap) => {
            setLocalSubs(p => ({ ...p, [rubricModal.studentId]: { ...p[rubricModal.studentId], score: String(score) } }))
            await supabase.from('at_submissions').upsert({
              assignment_id: rubricModal.assignId, student_id: rubricModal.studentId,
              score, rubric_scores: JSON.stringify(selMap), status: 'Turned In',
            }, { onConflict: 'assignment_id,student_id' })
            setRubricModal(null)
            await load()
          }}
        />
      )}
    </div></>
  )
}
