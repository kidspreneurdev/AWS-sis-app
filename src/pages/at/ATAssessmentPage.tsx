import { useEffect, useState, useMemo, useCallback } from 'react'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { supabase } from '@/lib/supabase'

const AT_SUBJECTS = ['Mathematics', 'English Language Arts', 'Reading', 'Science', 'Social Studies']

function getMonday(offset = 0): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7
  const m = new Date(d); m.setDate(diff); m.setHours(0, 0, 0, 0)
  return m.toISOString().slice(0, 10)
}

function perfLabel(pct: number): { l: string; c: string } {
  if (pct >= 90) return { l: 'Excellent', c: '#059669' }
  if (pct >= 75) return { l: 'Proficient', c: '#0369A1' }
  if (pct >= 60) return { l: 'Developing', c: '#D97706' }
  return { l: 'Beginning', c: '#D61F31' }
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

interface AssessRec { id: string; student_id: string; week_start: string; subject: string; raw_score: number | null; max_score: number; status: string }
interface Student { id: string; fullName: string; grade: string; cohort: string }

export function ATAssessmentPage() {
  const cf = useCampusFilter()
  const [records, setRecords] = useState<AssessRec[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selStu, setSelStu] = useState('')
  const [inputs, setInputs] = useState<Record<string, Record<string, { score: string; max: string; status: string }>>>({})

  const monday = useMemo(() => getMonday(weekOffset), [weekOffset])

  const load = useCallback(async () => {
    let sQuery = supabase.from('students').select('id,full_name,grade,cohort').eq('status', 'enrolled').order('full_name')
    if (cf) sQuery = sQuery.eq('campus', cf)
    const [{ data: recs }, { data: st }] = await Promise.all([
      supabase.from('at_assessments').select('*').order('week_start', { ascending: false }),
      sQuery,
    ])
    if (recs) setRecords(recs.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      student_id: r.student_id as string,
      week_start: (r.week_start ?? r.week) as string,
      subject: r.subject as string,
      raw_score: r.raw_score as number | null,
      max_score: (r.max_score as number) ?? 100,
      status: (r.status as string) ?? 'Taken',
    })))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({
      id: r.id as string, fullName: (r.full_name as string) ?? '',
      grade: (r.grade as string) ?? '', cohort: (r.cohort as string) ?? '',
    })))
  }, [cf])

  useEffect(() => { load() }, [load])

  // Initialize inputs when week or records change
  useEffect(() => {
    const init: Record<string, Record<string, { score: string; max: string; status: string }>> = {}
    students.forEach(s => {
      init[s.id] = {}
      AT_SUBJECTS.forEach(subj => {
        const rec = records.find(r => r.student_id === s.id && r.week_start === monday && r.subject === subj)
        init[s.id][subj] = {
          score: rec?.raw_score !== null && rec?.raw_score !== undefined ? String(rec.raw_score) : '',
          max: rec?.max_score ? String(rec.max_score) : '100',
          status: rec?.status ?? 'Taken',
        }
      })
    })
    setInputs(init)
  }, [students, records, monday])

  const filteredStudents = useMemo(() =>
    selStu ? students.filter(s => s.id === selStu) : students,
    [students, selStu]
  )

  async function saveStudent(studentId: string) {
    const stuInputs = inputs[studentId] ?? {}
    const toInsert = AT_SUBJECTS.map(subj => {
      const inp = stuInputs[subj] ?? { score: '', max: '100', status: 'Taken' }
      return {
        student_id: studentId,
        week_start: monday,
        subject: subj,
        raw_score: inp.score !== '' ? parseFloat(inp.score) : null,
        max_score: inp.max ? parseFloat(inp.max) : 100,
        status: inp.status,
      }
    })
    await supabase.from('at_assessments').delete().eq('student_id', studentId).eq('week_start', monday)
    await supabase.from('at_assessments').insert(toInsert)
    await load()
  }

  const iStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 11, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Week nav + student selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <button onClick={() => setWeekOffset(p => p - 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>◀</button>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>📈 Weekly Assessments — {monday}</span>
        <button onClick={() => setWeekOffset(p => p + 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>▶</button>
        <button onClick={() => setWeekOffset(0)} style={{ padding: '5px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>This Week</button>
        <select value={selStu} onChange={e => setSelStu(e.target.value)} style={{ ...iStyle, flex: 1, minWidth: 180 }}>
          <option value="">— All Students —</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
      </div>

      {/* Per-student cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredStudents.map(s => {
          const stuInputs = inputs[s.id] ?? {}
          const gradedSubjs = AT_SUBJECTS.filter(subj => stuInputs[subj]?.score !== '' && stuInputs[subj]?.max)
          const avg = gradedSubjs.length
            ? Math.round(gradedSubjs.reduce((acc, subj) => {
                const inp = stuInputs[subj]
                return acc + (parseFloat(inp.score) / parseFloat(inp.max) * 100)
              }, 0) / gradedSubjs.length)
            : null
          const initials = s.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
          const pl = avg !== null ? perfLabel(avg) : null
          return (
            <div key={s.id} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{s.fullName}</div>
                  {pl && avg !== null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: pl.c, background: pl.c + '18', padding: '2px 8px', borderRadius: 6 }}>
                      Avg: {avg}% — {pl.l}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {AT_SUBJECTS.map(subj => {
                  const inp = stuInputs[subj] ?? { score: '', max: '100', status: 'Taken' }
                  const pct = inp.score !== '' && inp.max ? Math.round(parseFloat(inp.score) / parseFloat(inp.max) * 100) : null
                  const spl = pct !== null ? perfLabel(pct) : { l: '', c: '#94A3B8' }
                  const borderCol = pct !== null ? spl.c + '50' : '#E4EAF2'
                  return (
                    <div key={subj} style={{ padding: 10, background: '#F7F9FC', borderRadius: 10, border: `2px solid ${borderCol}` }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>{subj}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Score</div>
                          <input
                            type="number" min="0"
                            value={inp.score}
                            placeholder="0"
                            onChange={e => setInputs(p => ({ ...p, [s.id]: { ...p[s.id], [subj]: { ...p[s.id]?.[subj], score: e.target.value } } }))}
                            style={{ padding: '4px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>Max</div>
                          <input
                            type="number" min="1"
                            value={inp.max}
                            onChange={e => setInputs(p => ({ ...p, [s.id]: { ...p[s.id], [subj]: { ...p[s.id]?.[subj], max: e.target.value } } }))}
                            style={{ padding: '4px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      <select
                        value={inp.status}
                        onChange={e => setInputs(p => ({ ...p, [s.id]: { ...p[s.id], [subj]: { ...p[s.id]?.[subj], status: e.target.value } } }))}
                        style={{ padding: '3px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 9, width: '100%', marginBottom: 4 }}
                      >
                        {['Taken', 'Not Taken', 'Excused'].map(st => <option key={st}>{st}</option>)}
                      </select>
                      {pct !== null && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: spl.c }}>{pct}% — {spl.l}</div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => saveStudent(s.id)} style={{ padding: '5px 16px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>💾 Save Scores</button>
              </div>
            </div>
          )
        })}
        {filteredStudents.length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>No enrolled students found.</div>
        )}
      </div>

      <div style={{ fontSize: 11, color: '#7A92B0' }}>
        Performance: ≥90% Excellent · ≥75% Proficient · ≥60% Developing · &lt;60% Beginning
      </div>
    </div>
  )
}
