import { useEffect, useState, useMemo, useCallback } from 'react'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { supabase } from '@/lib/supabase'

const EP_SUBJECTS = ['Mathematics', 'Reading', 'Language Arts']
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

interface EPRecord { id: string; student_id: string; week_start: string; subject: string; target_value: number | null; actual_value: number | null; met: boolean; trophies: string[] }
interface Student { id: string; fullName: string; grade: string; cohort: string }


export function ATExactPathPage() {
  const cf = useCampusFilter()
  const [records, setRecords] = useState<EPRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [cohorts, setCohorts] = useState<string[]>([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selCohort, setSelCohort] = useState('All')
  const [inputs, setInputs] = useState<Record<string, Record<string, { target: string; actual: string }>>>({})

  const monday = useMemo(() => getMonday(weekOffset), [weekOffset])
  const friday = useMemo(() => getFriday(monday), [monday])

  const load = useCallback(async () => {
    let sQuery = supabase.from('students').select('id,full_name,grade,cohort').eq('status', 'enrolled').order('full_name')
    if (cf) sQuery = sQuery.eq('campus', cf)
    const [{ data: ep }, { data: st }, { data: settings }] = await Promise.all([
      supabase.from('at_exact_path').select('*').order('week_start', { ascending: false }),
      sQuery,
      supabase.from('settings').select('cohorts').single(),
    ])
    if (ep) setRecords(ep.map((r: Record<string, unknown>) => ({
      id: r.id as string, student_id: r.student_id as string, week_start: (r.week_start ?? r.week) as string,
      subject: r.subject as string, target_value: r.target_value as number | null,
      actual_value: r.actual_value as number | null, met: r.met as boolean ?? false,
      trophies: (r.trophies as string[]) ?? (r.trophy ? [r.trophy as string] : []),
    })))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '', grade: (r.grade as string) ?? '', cohort: (r.cohort as string) ?? '' })))
    if (settings?.cohorts) setCohorts(settings.cohorts as string[])
  }, [cf])

  useEffect(() => { load() }, [load])

  // Initialize inputs when week or students change
  useEffect(() => {
    const init: Record<string, Record<string, { target: string; actual: string }>> = {}
    students.forEach(s => {
      init[s.id] = {}
      EP_SUBJECTS.forEach(subj => {
        const rec = records.find(r => r.student_id === s.id && r.week_start === monday && r.subject === subj)
        init[s.id][subj] = { target: rec?.target_value !== null && rec?.target_value !== undefined ? String(rec.target_value) : '', actual: rec?.actual_value !== null && rec?.actual_value !== undefined ? String(rec.actual_value) : '' }
      })
    })
    setInputs(init)
  }, [students, records, monday])

  const filteredStudents = useMemo(() => selCohort === 'All' ? students : students.filter(s => s.cohort === selCohort), [students, selCohort])

  // Trophy wall: students with trophies this week
  const weekRecords = useMemo(() => records.filter(r => r.week_start === monday), [records, monday])
  const weekTrophyStudents = useMemo(() => {
    return filteredStudents.map(s => {
      const stuWeekRecs = weekRecords.filter(r => r.student_id === s.id)
      const trophies = stuWeekRecs.flatMap(r => r.trophies ?? [])
      const allTimeTrophies = records.filter(r => r.student_id === s.id).flatMap(r => r.trophies ?? [])
      return { student: s, trophies, allTime: allTimeTrophies.length }
    }).filter(x => x.trophies.length > 0)
  }, [filteredStudents, weekRecords, records])

  async function saveStudent(studentId: string) {
    const stuInputs = inputs[studentId] ?? {}
    const prevWeekStart = (() => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })()
    const prevRecs = records.filter(r => r.student_id === studentId && r.week_start === prevWeekStart)

    let allMet = true
    const toUpsert: Record<string, unknown>[] = []

    EP_SUBJECTS.forEach(subj => {
      const tv = stuInputs[subj]?.target ? parseFloat(stuInputs[subj].target) : undefined
      const av = stuInputs[subj]?.actual !== '' ? parseFloat(stuInputs[subj]?.actual ?? '') : undefined
      const met = tv !== undefined && av !== undefined && av >= tv
      if (!met) allMet = false

      // Check improvement vs prev week
      const prevRec = prevRecs.find(r => r.subject === subj)
      const improved = prevRec?.actual_value !== undefined && prevRec.actual_value !== null && av !== undefined && av >= (prevRec.actual_value * 1.1)

      const trophies: string[] = []
      if (met) trophies.push('bronze')
      if (improved && !met) trophies.push('silver')

      toUpsert.push({ student_id: studentId, week_start: monday, subject: subj, target_value: tv ?? null, actual_value: av ?? null, met: met, trophies })
    })

    // Gold if all met
    if (allMet) toUpsert.forEach(r => { (r.trophies as string[]).push('gold') })

    // Check 3-week streak for diamond
    let streak = 0
    for (let wi = 0; wi < 3; wi++) {
      const checkWs = (() => { const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() - wi * 7); return d.toISOString().slice(0, 10) })()
      const checkRecs = wi === 0 ? toUpsert : records.filter(r => r.student_id === studentId && r.week_start === checkWs)
      if (checkRecs.length >= EP_SUBJECTS.length && checkRecs.every(r => (r as Record<string, unknown>).met)) streak++
      else break
    }
    if (streak >= 3) toUpsert.forEach(r => { (r.trophies as string[]).push('diamond') })

    // Delete existing week records for this student and re-insert
    await supabase.from('at_exact_path').delete().eq('student_id', studentId).eq('week_start', monday)
    await supabase.from('at_exact_path').insert(toUpsert)
    await load()
  }

  function bulkSetTargets() {
    const val = prompt('Set target for ALL students across all subjects (e.g. 80):')
    if (!val || isNaN(parseFloat(val))) return
    setInputs(p => {
      const next = { ...p }
      filteredStudents.forEach(s => {
        next[s.id] = { ...next[s.id] }
        EP_SUBJECTS.forEach(subj => {
          next[s.id][subj] = { ...(next[s.id]?.[subj] ?? { actual: '' }), target: val }
        })
      })
      return next
    })
  }

  const iStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <button onClick={() => setWeekOffset(p => p - 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>◀</button>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', flex: 1, textAlign: 'center' }}>🏆 Exact Path Tracker — Week of {monday} → {friday}</span>
        <button onClick={() => setWeekOffset(p => p + 1)} style={{ padding: '5px 10px', background: '#E4EAF2', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>▶</button>
        <button onClick={() => setWeekOffset(0)} style={{ padding: '5px 12px', background: '#B45309', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>This Week</button>
        <button onClick={bulkSetTargets} style={{ padding: '5px 12px', background: '#EEF3FF', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🎯 Set All Targets</button>
        <select value={selCohort} onChange={e => setSelCohort(e.target.value)} style={iStyle}>
          <option value="All">All Cohorts</option>
          {cohorts.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Trophy Wall */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>🏆 Trophy Wall — This Week</div>
        {weekTrophyStudents.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 12 }}>No trophies awarded yet this week. Log results below.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {weekTrophyStudents.map(({ student, trophies, allTime }) => (
              <div key={student.id} style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#FEF9C3,#FFF8DC)', border: '1.5px solid #FDE68A', borderRadius: 12, textAlign: 'center', minWidth: 110 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>{student.fullName}</div>
                <div style={{ fontSize: 20 }}>
                  {trophies.includes('diamond') && '💎'}
                  {trophies.includes('gold') && '🥇'}
                  {trophies.filter(t => t === 'bronze').map((_, i) => <span key={i}>🥉</span>)}
                  {trophies.includes('silver') && '🥈'}
                </div>
                <div style={{ fontSize: 9, color: '#92400E', marginTop: 3 }}>Total: {allTime} all-time</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-student entry cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredStudents.map(s => {
          const stuInputs = inputs[s.id] ?? {}
          const allTimeCount = records.filter(r => r.student_id === s.id).flatMap(r => r.trophies ?? []).length
          const initials = s.fullName.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
          return (
            <div key={s.id} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{s.fullName}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.grade}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 10px', borderRadius: 8 }}>{allTimeCount} 🏆 all-time</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {EP_SUBJECTS.map(subj => {
                  const inp = stuInputs[subj] ?? { target: '', actual: '' }
                  const tv = inp.target ? parseFloat(inp.target) : undefined
                  const av = inp.actual !== '' ? parseFloat(inp.actual) : undefined
                  const met = tv !== undefined && av !== undefined && av >= tv
                  const near = tv !== undefined && av !== undefined && av >= tv * 0.85
                  const borderCol = av !== undefined ? (met ? '#1DBD6A' : near ? '#F59E0B' : '#EF4444') : '#E4EAF2'
                  return (
                    <div key={subj} style={{ padding: 10, background: '#F7F9FC', borderRadius: 10, border: `2px solid ${borderCol}` }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>{subj}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Target</div>
                          <input
                            type="number" min="0"
                            value={inp.target}
                            onChange={e => setInputs(p => ({ ...p, [s.id]: { ...p[s.id], [subj]: { ...p[s.id]?.[subj], target: e.target.value } } }))}
                            placeholder="e.g. 80"
                            style={{ padding: '4px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Actual</div>
                          <input
                            type="number" min="0"
                            value={inp.actual}
                            onChange={e => setInputs(p => ({ ...p, [s.id]: { ...p[s.id], [subj]: { ...p[s.id]?.[subj], actual: e.target.value } } }))}
                            placeholder="Result"
                            style={{ padding: '4px 6px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                      {av !== undefined && tv !== undefined && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: met ? '#059669' : '#D61F31' }}>
                          {met ? '🥉 Target Met' : '📉 Missed'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => saveStudent(s.id)} style={{ padding: '5px 14px', background: '#B45309', color: '#fff', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>💾 Save & Award</button>
              </div>
            </div>
          )
        })}
        {filteredStudents.length === 0 && <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>No enrolled students found.</div>}
      </div>

      <div style={{ fontSize: 11, color: '#7A92B0' }}>
        Trophy logic: 🥉 Bronze = target met · 🥈 Silver = 10%+ improvement · 🥇 Gold = all subjects met · 💎 Diamond = 3-week streak
      </div>
    </div>
  )
}
