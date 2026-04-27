import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useCampusFilter } from '@/hooks/useCampusFilter'

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_LEVELS: Record<string, { label: string; col: string; bg: string }> = {
  '4': { label: 'Exceeds',      col: '#1DBD6A', bg: '#DCFCE7' },
  '3': { label: 'Meets',        col: '#0EA5E9', bg: '#DBEAFE' },
  '2': { label: 'Approaching',  col: '#FAC600', bg: '#FFFBEA' },
  '1': { label: 'Beginning',    col: '#D61F31', bg: '#FFF0F1' },
  '0': { label: 'Not Assessed', col: '#7A92B0', bg: '#F7F9FC' },
}

const LS_MS_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'P', 'I']
const LS_EFFORT    = ['4 - Excellent', '3 - Good', '2 - Satisfactory', '1 - Needs Improvement']

const LS_GRADE_LABELS: Record<string, string> = {
  '-1': 'Pre-K', '0': 'Kindergarten', '1': 'Grade 1', '2': 'Grade 2',
  '3': 'Grade 3', '4': 'Grade 4', '5': 'Grade 5',
  '6': 'Grade 6', '7': 'Grade 7', '8': 'Grade 8',
}
const LS_ELEM_VALUES = ['-1', '0', '1', '2', '3', '4', '5']
const LS_MS_VALUES   = ['6', '7', '8']
const ALL_LS_VALUES  = [...LS_ELEM_VALUES, ...LS_MS_VALUES]

const LS_PREK_DOMAINS = [
  'Social-Emotional Development', 'Language & Communication', 'Literacy Readiness',
  'Math & Logical Thinking', 'Science & Discovery', 'Physical Development', 'Creative Arts',
]
const LS_ELEM_SUBJ = [
  'Reading', 'Writing', 'Math', 'Science', 'Social Studies',
  'Social-Emotional Learning', 'Physical Education', 'Art', 'Music',
]
const LS_MS_SUBJ = [
  'Language Arts', 'Math', 'Science', 'Social Studies',
  'Spanish', 'PE', 'Advisory', 'Elective',
]
const SKILL_DOMAINS = [
  'Reading', 'Writing', 'Mathematics', 'Science', 'Social Studies',
  'Social-Emotional', 'Arts', 'PE',
]

const LS_TERMS = ['Term 1', 'Term 2', 'Term 3', 'Term 4']

const SKILL_STATES = ['not_started', 'in_progress', 'mastered'] as const
type SkillState = typeof SKILL_STATES[number]
const SKILL_META: Record<SkillState, { label: string; bg: string; col: string }> = {
  not_started: { label: 'Not Started', bg: '#F7F9FC', col: '#7A92B0' },
  in_progress:  { label: 'In Progress',  bg: '#DBEAFE', col: '#0EA5E9' },
  mastered:     { label: 'Mastered',     bg: '#DCFCE7', col: '#1DBD6A' },
}

type GradeRec = { elem_grades: Record<string,string>; ms_grades: Record<string,string>; narrative: Record<string,string>; skill_mastery: Record<string,string> }

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { id: string; name: string; grade: string }

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}
const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em',
  borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '9px 14px', fontSize: 13, color: '#1A365E',
  borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle',
}
const btnPrimary: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#0F2240,#1A365E)', color: '#fff',
  fontSize: 13, fontWeight: 600,
}
const inputStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
  fontSize: 13, color: '#1A365E', background: '#fff', outline: 'none',
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#1A365E,#2D5A8E)',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{initials}</div>
  )
}

// ─── Progress Modal (K-5) ────────────────────────────────────────────────────
function ProgressModal({
  student, term, onClose, initialData, onSaved,
}: { student: Student; term: string; onClose: () => void; initialData: Record<string,string>; onSaved: (data: Record<string,string>) => void }) {
  const domains = student.grade === '-1' ? LS_PREK_DOMAINS : LS_ELEM_SUBJ
  const [data, setData] = useState<Record<string, string>>(initialData)

  async function save() {
    await supabase.from('ls_grade_records').upsert(
      { student_id: student.id, term, elem_grades: data },
      { onConflict: 'student_id,term' }
    )
    onSaved(data)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Progress Report — {term}</div>
            <div style={{ color: '#BDD0E8', fontSize: 12, marginTop: 2 }}>{student.name} · {LS_GRADE_LABELS[student.grade]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#BDD0E8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, maxHeight: '65vh', overflowY: 'auto' }}>
          {domains.map(domain => (
            <div key={domain} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', marginBottom: 6 }}>{domain}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(LS_LEVELS).reverse().map(([val, meta]) => (
                  <button
                    key={val}
                    onClick={() => setData(d => ({ ...d, [domain]: val }))}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `2px solid ${data[domain] === val ? meta.col : 'transparent'}`,
                      background: data[domain] === val ? meta.bg : '#F7F9FC',
                      color: data[domain] === val ? meta.col : '#7A92B0',
                    }}
                  >
                    {val} — {meta.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...inputStyle, cursor: 'pointer', padding: '7px 16px' }}>Cancel</button>
          <button onClick={save} style={btnPrimary}>Save Progress Report</button>
        </div>
      </div>
    </div>
  )
}

// ─── MS Grades Modal (6-8) ───────────────────────────────────────────────────
function MSModal({
  student, term, onClose, initialData, onSaved,
}: { student: Student; term: string; onClose: () => void; initialData: Record<string,string>; onSaved: (data: Record<string,string>) => void }) {
  const [data, setData] = useState<Record<string, string>>(initialData)

  async function save() {
    await supabase.from('ls_grade_records').upsert(
      { student_id: student.id, term, ms_grades: data },
      { onConflict: 'student_id,term' }
    )
    onSaved(data)
    onClose()
  }

  function gradeColor(g: string) {
    if (!g) return '#1A365E'
    if (g.startsWith('A')) return '#1DBD6A'
    if (g.startsWith('B')) return '#0EA5E9'
    if (g === 'C' || g.startsWith('C')) return '#FAC600'
    return '#D61F31'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>MS Grades — {term}</div>
            <div style={{ color: '#BDD0E8', fontSize: 12, marginTop: 2 }}>{student.name} · {LS_GRADE_LABELS[student.grade]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#BDD0E8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, maxHeight: '65vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, paddingLeft: 0 }}>Subject</th>
                <th style={th}>Grade</th>
                <th style={th}>Effort</th>
              </tr>
            </thead>
            <tbody>
              {LS_MS_SUBJ.map(subj => {
                const gKey = `${subj}_g`
                const eKey = `${subj}_e`
                const g = data[gKey] ?? ''
                return (
                  <tr key={subj}>
                    <td style={{ ...td, paddingLeft: 0 }}>{subj}</td>
                    <td style={td}>
                      <select
                        value={g}
                        onChange={e => setData(d => ({ ...d, [gKey]: e.target.value }))}
                        style={{ ...inputStyle, padding: '4px 8px', color: gradeColor(g), fontWeight: 700, width: 80 }}
                      >
                        <option value="">—</option>
                        {LS_MS_GRADES.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <select
                        value={data[eKey] ?? ''}
                        onChange={e => setData(d => ({ ...d, [eKey]: e.target.value }))}
                        style={{ ...inputStyle, padding: '4px 8px', minWidth: 160 }}
                      >
                        <option value="">— Select —</option>
                        {LS_EFFORT.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...inputStyle, cursor: 'pointer', padding: '7px 16px' }}>Cancel</button>
          <button onClick={save} style={{ ...btnPrimary, background: 'linear-gradient(135deg,#6A0DAD,#A36CFF)' }}>Save MS Grades</button>
        </div>
      </div>
    </div>
  )
}

// ─── Narrative Modal ──────────────────────────────────────────────────────────
function NarrModal({
  student, term, onClose, initialData, onSaved,
}: { student: Student; term: string; onClose: () => void; initialData: Record<string,string>; onSaved: (data: Record<string,string>) => void }) {
  const [data, setData] = useState<{ general: string; strengths: string; growth: string; goals: string }>({
    general: initialData.general ?? '',
    strengths: initialData.strengths ?? '',
    growth: initialData.growth ?? '',
    goals: initialData.goals ?? '',
  })

  async function save() {
    await supabase.from('ls_grade_records').upsert(
      { student_id: student.id, term, narrative: data },
      { onConflict: 'student_id,term' }
    )
    onSaved(data as Record<string,string>)
    onClose()
  }

  const fields: Array<{ key: keyof typeof data; label: string; placeholder: string }> = [
    { key: 'general',   label: 'General Comments',      placeholder: 'Overall observations about the student...' },
    { key: 'strengths', label: 'Strengths',              placeholder: 'Academic and personal strengths...' },
    { key: 'growth',    label: 'Areas for Growth',       placeholder: 'Skills and areas requiring attention...' },
    { key: 'goals',     label: 'Goals for Next Term',    placeholder: 'Specific goals for the upcoming term...' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Narrative Report — {term}</div>
            <div style={{ color: '#BDD0E8', fontSize: 12, marginTop: 2 }}>{student.name} · {LS_GRADE_LABELS[student.grade]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#BDD0E8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <textarea
                value={data[f.key]}
                onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                rows={3}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...inputStyle, cursor: 'pointer', padding: '7px 16px' }}>Cancel</button>
          <button onClick={save} style={btnPrimary}>Save Narrative</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function GradesLSPage() {
  const cf = useCampusFilter()
  const [students, setStudents]         = useState<Student[]>([])
  const [tab, setTab]                   = useState<'overview' | 'progress' | 'ms_grades' | 'narratives' | 'skills'>('overview')
  const [activeTerm, setActiveTerm]     = useState('Term 1')
  const [gradeStore, setGradeStore]     = useState<Record<string, GradeRec>>({})
  const [filterGrade, setFilterGrade]   = useState('All')
  const [modal, setModal]               = useState<{ type: 'progress' | 'ms' | 'narr'; student: Student } | null>(null)

  const refresh = useCallback(() => { setModal(null) }, [])

  useEffect(() => {
    let q = supabase.from('students')
      .select('id,first_name,last_name,grade')
      .eq('status', 'Enrolled')
      .in('grade', ALL_LS_VALUES)
    if (cf) q = q.eq('campus', cf)
    q.then(({ data }) => {
        if (data) setStudents(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: `${r.first_name} ${r.last_name}`,
          grade: String(r.grade),
        })))
      })
  }, [cf])

  useEffect(() => {
    supabase.from('ls_grade_records').select('*')
      .then(({ data }) => {
        if (!data) return
        const store: Record<string, GradeRec> = {}
        data.forEach((r: Record<string,unknown>) => {
          const key = `${r.student_id}_${r.term}`
          store[key] = {
            elem_grades: (r.elem_grades as Record<string,string>) ?? {},
            ms_grades: (r.ms_grades as Record<string,string>) ?? {},
            narrative: (r.narrative as Record<string,string>) ?? {},
            skill_mastery: (r.skill_mastery as Record<string,string>) ?? {},
          }
        })
        setGradeStore(store)
      })
  }, [])

  const elemStudents = useMemo(() => students.filter(s => LS_ELEM_VALUES.includes(s.grade)), [students])
  const msStudents   = useMemo(() => students.filter(s => LS_MS_VALUES.includes(s.grade)),   [students])

  const filteredElem = useMemo(() => filterGrade === 'All' ? elemStudents : elemStudents.filter(s => s.grade === filterGrade), [elemStudents, filterGrade])
  const filteredMS   = useMemo(() => filterGrade === 'All' ? msStudents   : msStudents.filter(s => s.grade === filterGrade),   [msStudents,   filterGrade])

  // Helper: get records from gradeStore
  function getElemRec(sid: string, term: string) { return gradeStore[`${sid}_${term}`]?.elem_grades ?? null }
  function getMSRec(sid: string, term: string) { return gradeStore[`${sid}_${term}`]?.ms_grades ?? null }
  function getNarrRec(sid: string, term: string) { return gradeStore[`${sid}_${term}`]?.narrative ?? null }

  async function cycleSkill(sid: string, domain: string) {
    const key = `${sid}_${activeTerm}`
    const cur = (gradeStore[key]?.skill_mastery?.[domain] as SkillState) ?? 'not_started'
    const next = SKILL_STATES[(SKILL_STATES.indexOf(cur) + 1) % SKILL_STATES.length]
    const newMastery = { ...(gradeStore[key]?.skill_mastery ?? {}), [domain]: next }
    const newRec = { ...(gradeStore[key] ?? { elem_grades: {}, ms_grades: {}, narrative: {} }), skill_mastery: newMastery }
    setGradeStore(prev => ({ ...prev, [key]: newRec }))
    await supabase.from('ls_grade_records').upsert(
      { student_id: sid, term: activeTerm, ...newRec },
      { onConflict: 'student_id,term' }
    )
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, background: 'transparent',
    fontWeight: active ? 700 : 500,
    color: active ? '#D61F31' : '#7A92B0',
    borderBottom: active ? '2px solid #D61F31' : '2px solid transparent',
    whiteSpace: 'nowrap',
  })

  // ── Overview ────────────────────────────────────────────────────────────────
  function renderOverview() {
    const elemEntered = elemStudents.filter(s => getElemRec(s.id, activeTerm) !== null).length
    const msEntered   = msStudents.filter(s => getMSRec(s.id, activeTerm) !== null).length
    const narrEntered = students.filter(s => getNarrRec(s.id, activeTerm) !== null).length

    const statCards = [
      { label: 'Total LS Students', value: students.length, color: '#1A365E', sub: 'Enrolled' },
      { label: 'Elementary (K-5)',  value: elemStudents.length, color: '#1DBD6A', sub: 'Pre-K through Grade 5' },
      { label: 'Middle School (6-8)', value: msStudents.length, color: '#A36CFF', sub: 'Grades 6-8' },
      { label: 'Active Term', value: activeTerm, color: '#FAC600', sub: 'Current reporting period' },
    ]

    const gradeGroups = ALL_LS_VALUES.map(g => {
      const sts = students.filter(s => s.grade === g)
      const entered = sts.filter(s =>
        LS_ELEM_VALUES.includes(g) ? getElemRec(s.id, activeTerm) : getMSRec(s.id, activeTerm)
      ).length
      return { grade: g, total: sts.length, entered }
    }).filter(g => g.total > 0)

    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14 }}>
          {statCards.map(c => (
            <div key={c.label} style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Completion table */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 14 }}>Report Completion — {activeTerm}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={th}>Grade</th>
                <th style={th}>Students</th>
                <th style={th}>Reports Entered</th>
                <th style={{ ...th, minWidth: 200 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {gradeGroups.map(g => {
                const pct = g.total === 0 ? 0 : Math.round((g.entered / g.total) * 100)
                return (
                  <tr key={g.grade} style={{ cursor: 'default' }} onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{LS_GRADE_LABELS[g.grade]}</span></td>
                    <td style={{ ...td, color: '#7A92B0' }}>{g.total}</td>
                    <td style={td}>{g.entered} / {g.total}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#1DBD6A' : '#0EA5E9', borderRadius: 4, transition: 'width .3s' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#1DBD6A' : '#1A365E', minWidth: 32 }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Narrative + Skills summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', marginBottom: 10 }}>Narratives — {activeTerm}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1DBD6A' }}>{narrEntered}<span style={{ fontSize: 14, color: '#7A92B0', fontWeight: 500, marginLeft: 6 }}>/ {students.length}</span></div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4 }}>Reports with narrative comments</div>
          </div>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', marginBottom: 10 }}>Progress Reports — {activeTerm}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0EA5E9' }}>{elemEntered + msEntered}<span style={{ fontSize: 14, color: '#7A92B0', fontWeight: 500, marginLeft: 6 }}>/ {students.length}</span></div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4 }}>K-8 academic records entered</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Progress Reports (K-5) ─────────────────────────────────────────────────
  function renderProgress() {
    // Per-student summary: show levels for first 4 subjects
    const previewSubjects = ['Reading', 'Writing', 'Math', 'Science']

    return (
      <div style={{ padding: 20 }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {Object.entries(LS_LEVELS).reverse().map(([v, m]) => (
            <span key={v} style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.col, fontSize: 11, fontWeight: 700 }}>{v} — {m.label}</span>
          ))}
        </div>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={inputStyle}>
            <option value="All">All Elementary Grades</option>
            {LS_ELEM_VALUES.map(g => <option key={g} value={g}>{LS_GRADE_LABELS[g]}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filteredElem.length} students</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 180 }}>Student</th>
                <th style={th}>Grade</th>
                {previewSubjects.map(s => <th key={s} style={{ ...th, textAlign: 'center' }}>{s}</th>)}
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
                <th style={{ ...th, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredElem.map(stu => {
                const rec = getElemRec(stu.id, activeTerm) ?? {}
                const entered = Object.values(rec).filter(Boolean).length > 0
                return (
                  <tr key={stu.id} onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={stu.name} size={28} />
                        <span style={{ fontWeight: 500 }}>{stu.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0' }}>{LS_GRADE_LABELS[stu.grade]}</td>
                    {previewSubjects.map(s => {
                      const v = rec[s]
                      const m = v ? LS_LEVELS[v] : null
                      return (
                        <td key={s} style={{ ...td, textAlign: 'center' }}>
                          {m ? (
                            <span style={{ padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.col, fontSize: 12, fontWeight: 700 }}>{v}</span>
                          ) : (
                            <span style={{ color: '#BDD0E8', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )
                    })}
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: entered ? '#DCFCE7' : '#F7F9FC', color: entered ? '#1DBD6A' : '#7A92B0' }}>
                        {entered ? 'Entered' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button
                        onClick={() => setModal({ type: 'progress', student: stu })}
                        style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: entered ? '#DBEAFE' : 'linear-gradient(135deg,#0F2240,#1A365E)', color: entered ? '#0EA5E9' : '#fff' }}
                      >
                        {entered ? 'Edit' : 'Enter'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredElem.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No elementary students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── MS Grades (6-8) ────────────────────────────────────────────────────────
  function renderMSGrades() {
    const previewSubjects = ['Language Arts', 'Math', 'Science', 'Social Studies']

    function gradeColor(g: string) {
      if (!g) return '#7A92B0'
      if (g.startsWith('A')) return '#1DBD6A'
      if (g.startsWith('B')) return '#0EA5E9'
      if (g === 'C' || g.startsWith('C')) return '#FAC600'
      return '#D61F31'
    }

    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={inputStyle}>
            <option value="All">All MS Grades</option>
            {LS_MS_VALUES.map(g => <option key={g} value={g}>{LS_GRADE_LABELS[g]}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filteredMS.length} students</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 180 }}>Student</th>
                <th style={th}>Grade</th>
                {previewSubjects.map(s => <th key={s} style={{ ...th, textAlign: 'center', minWidth: 90 }}>{s}</th>)}
                <th style={{ ...th, textAlign: 'center' }}>Status</th>
                <th style={{ ...th, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMS.map(stu => {
                const rec = getMSRec(stu.id, activeTerm) ?? {}
                const entered = Object.values(rec).filter(Boolean).length > 0
                return (
                  <tr key={stu.id} onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={stu.name} size={28} />
                        <span style={{ fontWeight: 500 }}>{stu.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0' }}>{LS_GRADE_LABELS[stu.grade]}</td>
                    {previewSubjects.map(s => {
                      const g = rec[`${s}_g`]
                      const e = rec[`${s}_e`]
                      return (
                        <td key={s} style={{ ...td, textAlign: 'center' }}>
                          {g ? (
                            <div>
                              <span style={{ fontWeight: 700, color: gradeColor(g), fontSize: 13 }}>{g}</span>
                              {e && <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 1 }}>{e.split(' - ')[0]}</div>}
                            </div>
                          ) : <span style={{ color: '#BDD0E8', fontSize: 12 }}>—</span>}
                        </td>
                      )
                    })}
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: entered ? '#F3E8FF' : '#F7F9FC', color: entered ? '#A36CFF' : '#7A92B0' }}>
                        {entered ? 'Entered' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button
                        onClick={() => setModal({ type: 'ms', student: stu })}
                        style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: entered ? '#F3E8FF' : 'linear-gradient(135deg,#6A0DAD,#A36CFF)', color: entered ? '#A36CFF' : '#fff' }}
                      >
                        {entered ? 'Edit' : 'Enter'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filteredMS.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No middle school students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Narratives ─────────────────────────────────────────────────────────────
  function renderNarratives() {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: '#7A92B0' }}>Narrative reports for all students — {activeTerm}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 180 }}>Student</th>
                <th style={th}>Grade</th>
                <th style={th}>General Comments Preview</th>
                <th style={{ ...th, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map(stu => {
                const narr = getNarrRec(stu.id, activeTerm)
                const filled = !!narr?.general
                return (
                  <tr key={stu.id} onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={stu.name} size={28} />
                        <span style={{ fontWeight: 500 }}>{stu.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0' }}>{LS_GRADE_LABELS[stu.grade]}</td>
                    <td style={{ ...td, maxWidth: 280 }}>
                      {narr?.general ? (
                        <span style={{ color: '#1A365E', fontSize: 12 }}>{narr.general.slice(0, 80)}{narr.general.length > 80 ? '…' : ''}</span>
                      ) : (
                        <span style={{ color: '#BDD0E8', fontSize: 12, fontStyle: 'italic' }}>No narrative entered</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button
                        onClick={() => setModal({ type: 'narr', student: stu })}
                        style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: filled ? '#E0F5FF' : 'linear-gradient(135deg,#0F2240,#1A365E)', color: filled ? '#0A527A' : '#fff' }}
                      >
                        {filled ? 'Edit' : 'Write'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {students.length === 0 && (
                <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Skills Mastery ─────────────────────────────────────────────────────────
  function renderSkills() {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {(SKILL_STATES).map(s => {
            const m = SKILL_META[s]
            return (
              <span key={s} style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.col, fontSize: 11, fontWeight: 700 }}>
                {m.label}
              </span>
            )
          })}
          <span style={{ fontSize: 12, color: '#7A92B0', marginLeft: 4 }}>Click to cycle status</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ ...th, minWidth: 180, position: 'sticky', left: 0, background: '#F7F9FC', zIndex: 1 }}>Student</th>
                <th style={th}>Grade</th>
                {SKILL_DOMAINS.map(d => <th key={d} style={{ ...th, textAlign: 'center', minWidth: 110 }}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {students.map(stu => {
                return (
                  <tr key={stu.id} onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FC')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ ...td, position: 'sticky', left: 0, background: 'inherit', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={stu.name} size={26} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{stu.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: '#7A92B0', fontSize: 12 }}>{LS_GRADE_LABELS[stu.grade]}</td>
                    {SKILL_DOMAINS.map(domain => {
                      const state = (gradeStore[`${stu.id}_${activeTerm}`]?.skill_mastery?.[domain] as SkillState) ?? 'not_started'
                      const m = SKILL_META[state]
                      return (
                        <td key={domain} style={{ ...td, textAlign: 'center' }}>
                          <button
                            onClick={() => cycleSkill(stu.id, domain)}
                            style={{
                              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                              background: m.bg, color: m.col, fontSize: 11, fontWeight: 700,
                              transition: 'all .15s',
                            }}
                          >
                            {state === 'not_started' ? '—' : state === 'in_progress' ? 'In Progress' : 'Mastered'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {students.length === 0 && (
                <tr><td colSpan={SKILL_DOMAINS.length + 2} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No students found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const tabs: Array<{ v: typeof tab; l: string }> = [
    { v: 'overview',   l: 'Overview' },
    { v: 'progress',   l: 'Progress Reports (K-5)' },
    { v: 'ms_grades',  l: 'MS Grades (6-8)' },
    { v: 'narratives', l: 'Narratives' },
    { v: 'skills',     l: 'Skills Mastery' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Grades — Elementary & Middle School</h1>
          <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Pre-K through Grade 8 · Academic Records & Progress Reports</p>
        </div>
        {/* Term selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {LS_TERMS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTerm(t)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #E4EAF2', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: activeTerm === t ? 'linear-gradient(135deg,#0F2240,#1A365E)' : '#fff',
                color: activeTerm === t ? '#fff' : '#1A365E',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E4EAF2', padding: '0 8px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.v} style={tabStyle(tab === t.v)} onClick={() => { setTab(t.v); setFilterGrade('All') }}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'overview'   && renderOverview()}
        {tab === 'progress'   && renderProgress()}
        {tab === 'ms_grades'  && renderMSGrades()}
        {tab === 'narratives' && renderNarratives()}
        {tab === 'skills'     && renderSkills()}
      </div>

      {/* Modals */}
      {modal?.type === 'progress' && (
        <ProgressModal
          student={modal.student}
          term={activeTerm}
          onClose={refresh}
          initialData={getElemRec(modal.student.id, activeTerm) ?? {}}
          onSaved={(data) => {
            setGradeStore(prev => {
              const k = `${modal.student.id}_${activeTerm}`
              return { ...prev, [k]: { ...(prev[k] ?? { ms_grades: {}, narrative: {}, skill_mastery: {} }), elem_grades: data } }
            })
            setModal(null)
          }}
        />
      )}
      {modal?.type === 'ms' && (
        <MSModal
          student={modal.student}
          term={activeTerm}
          onClose={refresh}
          initialData={getMSRec(modal.student.id, activeTerm) ?? {}}
          onSaved={(data) => {
            setGradeStore(prev => {
              const k = `${modal.student.id}_${activeTerm}`
              return { ...prev, [k]: { ...(prev[k] ?? { elem_grades: {}, narrative: {}, skill_mastery: {} }), ms_grades: data } }
            })
            setModal(null)
          }}
        />
      )}
      {modal?.type === 'narr' && (
        <NarrModal
          student={modal.student}
          term={activeTerm}
          onClose={refresh}
          initialData={getNarrRec(modal.student.id, activeTerm) ?? {}}
          onSaved={(data) => {
            setGradeStore(prev => {
              const k = `${modal.student.id}_${activeTerm}`
              return { ...prev, [k]: { ...(prev[k] ?? { elem_grades: {}, ms_grades: {}, skill_mastery: {} }), narrative: data } }
            })
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
