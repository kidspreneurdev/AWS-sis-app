import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type AStatus = 'P' | 'A' | 'T' | 'E' | 'R'

const ASTAT: Record<AStatus, { label: string; bg: string; tc: string; activeBg: string }> = {
  P: { label: 'Present', bg: '#E8FBF0', tc: '#1DBD6A', activeBg: '#1DBD6A' },
  A: { label: 'Absent',  bg: '#FFF0F1', tc: '#D61F31', activeBg: '#D61F31' },
  T: { label: 'Tardy',   bg: '#FFF6E0', tc: '#F5A623', activeBg: '#F5A623' },
  E: { label: 'Excused', bg: '#E6F4FF', tc: '#0EA5E9', activeBg: '#0EA5E9' },
  R: { label: 'Remote',  bg: '#F3EDFF', tc: '#A36CFF', activeBg: '#A36CFF' },
}

interface Stu {
  id: string
  first_name: string
  last_name: string
  grade: string
  cohort: string | null
}

interface AttendanceRecord {
  id: string
  student_id: string
  date: string
  status: AStatus
  note: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return toISODate(new Date())
}

function initials(s: Stu) {
  return (s.first_name[0] + (s.last_name[0] ?? '')).toUpperCase()
}

function fullName(s: Stu) {
  return `${s.first_name} ${s.last_name}`
}

function rate30(records: AttendanceRecord[], studentId: string, upToDate: string): number | null {
  const cutoff = toISODate(new Date(new Date(upToDate).getTime() - 30 * 24 * 60 * 60 * 1000))
  const recs = records.filter(r => r.student_id === studentId && r.date >= cutoff && r.date <= upToDate)
  if (recs.length === 0) return null
  const present = recs.filter(r => r.status === 'P' || r.status === 'R' || r.status === 'E').length
  return Math.round((present / recs.length) * 100)
}

function rateColor(r: number | null) {
  if (r === null) return '#7A92B0'
  if (r >= 95) return '#1DBD6A'
  if (r >= 90) return '#F5A623'
  return '#D61F31'
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase',
  letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8',
}

// ─── Status Buttons ───────────────────────────────────────────────────────────
function StatusButtons({
  current,
  onChange,
}: {
  current: AStatus | null
  onChange: (s: AStatus) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(Object.keys(ASTAT) as AStatus[]).map(s => {
        const m = ASTAT[s]
        const active = current === s
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: active ? m.activeBg : m.bg,
              color: active ? '#fff' : m.tc,
              transition: 'all 0.12s',
            }}
          >
            {s}
          </button>
        )
      })}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#1A365E', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AttendancePage() {
  const [students, setStudents] = useState<Stu[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [tab, setTab] = useState<'daily' | 'cohort' | 'monthly'>('daily')
  const [date, setDate] = useState(todayStr())
  const [cohortDate, setCohortDate] = useState(todayStr())
  const [selectedCohort, setSelectedCohort] = useState<string>('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const [stuRes, attRes] = await Promise.all([
        supabase.from('students').select('id,first_name,last_name,grade,cohort').eq('status', 'Enrolled'),
        supabase.from('attendance').select('*'),
      ])
      if (stuRes.data) setStudents(stuRes.data)
      if (attRes.data) setRecords(attRes.data)
    }
    load()
  }, [])

  useEffect(() => {
    const map: Record<string, string> = {}
    records.forEach(r => {
      const key = `${r.student_id}__${r.date}`
      if (r.note) map[key] = r.note
    })
    setNotes(map)
  }, [records])

  const cohorts = useMemo(() => {
    const set = new Set<string>()
    students.forEach(s => { if (s.cohort) set.add(s.cohort) })
    return Array.from(set).sort()
  }, [students])

  useEffect(() => {
    if (!selectedCohort && cohorts.length > 0) setSelectedCohort(cohorts[0])
  }, [cohorts, selectedCohort])

  function getStatus(studentId: string, d: string): AStatus | null {
    const r = records.find(r => r.student_id === studentId && r.date === d)
    return r ? r.status : null
  }

  async function setStatus(studentId: string, d: string, status: AStatus) {
    const existing = records.find(r => r.student_id === studentId && r.date === d)
    const key = `${studentId}__${d}`
    let updated: AttendanceRecord | null = null
    if (existing) {
      const { data } = await supabase.from('attendance')
        .update({ status, note: notes[key] ?? null })
        .eq('id', existing.id)
        .select()
        .single()
      updated = data
    } else {
      const { data } = await supabase.from('attendance')
        .insert({ student_id: studentId, date: d, status, note: notes[key] ?? null })
        .select()
        .single()
      updated = data
    }
    if (updated) {
      setRecords(prev => {
        const filtered = prev.filter(r => !(r.student_id === studentId && r.date === d))
        return [...filtered, updated!]
      })
    }
  }

  async function saveNote(studentId: string, d: string) {
    const key = `${studentId}__${d}`
    const existing = records.find(r => r.student_id === studentId && r.date === d)
    if (!existing) return
    await supabase.from('attendance').update({ note: notes[key] ?? null }).eq('id', existing.id)
  }

  async function markAllPresent(sIds: string[], d: string) {
    for (const id of sIds) {
      await setStatus(id, d, 'P')
    }
  }

  const today = todayStr()
  const enrolled = students.length
  const presentToday = records.filter(r => r.date === today && (r.status === 'P' || r.status === 'R' || r.status === 'E')).length
  const absentToday = records.filter(r => r.date === today && r.status === 'A').length
  const chronicAbsent = students.filter(s => {
    const r = rate30(records, s.id, today)
    return r !== null && r < 90
  }).length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? '#D61F31' : '#7A92B0',
    background: 'transparent',
    borderBottom: active ? '2px solid #D61F31' : '2px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Attendance</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Track daily student attendance</p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="Enrolled" value={enrolled} />
        <StatCard label="Present Today" value={presentToday} color="#1DBD6A" />
        <StatCard label="Absent Today" value={absentToday} color={absentToday > 0 ? '#D61F31' : '#1A365E'} />
        <StatCard
          label="Chronic Absent"
          value={chronicAbsent}
          color={chronicAbsent > 0 ? '#D61F31' : '#1A365E'}
          sub="< 90% rate, 30 days"
        />
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #E4EAF2', padding: '0 8px' }}>
          <button style={tabStyle(tab === 'daily')} onClick={() => setTab('daily')}>Daily Entry</button>
          <button style={tabStyle(tab === 'cohort')} onClick={() => setTab('cohort')}>By Cohort</button>
          <button style={tabStyle(tab === 'monthly')} onClick={() => setTab('monthly')}>Monthly Report</button>
        </div>
        <div style={{ padding: 20 }}>
          {tab === 'daily' && (
            <DailyTab
              students={students}
              records={records}
              date={date}
              setDate={setDate}
              notes={notes}
              setNotes={setNotes}
              getStatus={getStatus}
              setStatus={setStatus}
              saveNote={saveNote}
              markAllPresent={markAllPresent}
            />
          )}
          {tab === 'cohort' && (
            <CohortTab
              students={students}
              records={records}
              cohorts={cohorts}
              selectedCohort={selectedCohort}
              setSelectedCohort={setSelectedCohort}
              cohortDate={cohortDate}
              setCohortDate={setCohortDate}
              notes={notes}
              setNotes={setNotes}
              getStatus={getStatus}
              setStatus={setStatus}
              saveNote={saveNote}
              markAllPresent={markAllPresent}
            />
          )}
          {tab === 'monthly' && (
            <MonthlyTab students={students} records={records} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Daily Tab ────────────────────────────────────────────────────────────────
function DailyTab({
  students, records, date, setDate, notes, setNotes,
  getStatus, setStatus, saveNote, markAllPresent,
}: {
  students: Stu[]
  records: AttendanceRecord[]
  date: string
  setDate: (d: string) => void
  notes: Record<string, string>
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  getStatus: (id: string, d: string) => AStatus | null
  setStatus: (id: string, d: string, s: AStatus) => Promise<void>
  saveNote: (id: string, d: string) => Promise<void>
  markAllPresent: (ids: string[], d: string) => Promise<void>
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
            fontSize: 13, color: '#1A365E', background: '#fff',
          }}
        />
        <button
          onClick={() => markAllPresent(students.map(s => s.id), date)}
          style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#1DBD6A', color: '#fff', fontWeight: 600, fontSize: 13,
          }}
        >
          ✓ Mark All Present
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F9FC' }}>
              <th style={th}>Student</th>
              <th style={th}>Grade</th>
              <th style={th}>Status</th>
              <th style={th}>30-Day Rate</th>
              <th style={th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              const key = `${s.id}__${date}`
              const status = getStatus(s.id, date)
              const r = rate30(records, s.id, date)
              return (
                <tr key={s.id}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'linear-gradient(135deg,#1A365E,#2D5A8E)',
                        color: '#fff', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {initials(s)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{fullName(s)}</span>
                    </div>
                  </td>
                  <td style={td}>{s.grade}</td>
                  <td style={td}>
                    <StatusButtons current={status} onChange={st => setStatus(s.id, date, st)} />
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: rateColor(r) }}>
                    {r !== null ? `${r}%` : '—'}
                  </td>
                  <td style={td}>
                    <input
                      value={notes[key] ?? ''}
                      onChange={e => setNotes(prev => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => saveNote(s.id, date)}
                      placeholder="Add note…"
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid #E4EAF2',
                        fontSize: 12, width: 160, color: '#1A365E',
                      }}
                    />
                  </td>
                </tr>
              )
            })}
            {students.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No enrolled students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Cohort Tab ───────────────────────────────────────────────────────────────
function CohortTab({
  students, records, cohorts, selectedCohort, setSelectedCohort,
  cohortDate, setCohortDate, notes, setNotes,
  getStatus, setStatus, saveNote, markAllPresent,
}: {
  students: Stu[]
  records: AttendanceRecord[]
  cohorts: string[]
  selectedCohort: string
  setSelectedCohort: (c: string) => void
  cohortDate: string
  setCohortDate: (d: string) => void
  notes: Record<string, string>
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  getStatus: (id: string, d: string) => AStatus | null
  setStatus: (id: string, d: string, s: AStatus) => Promise<void>
  saveNote: (id: string, d: string) => Promise<void>
  markAllPresent: (ids: string[], d: string) => Promise<void>
}) {
  const cohortStudents = students.filter(s => s.cohort === selectedCohort)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={selectedCohort}
          onChange={e => setSelectedCohort(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
            fontSize: 13, color: '#1A365E', background: '#fff',
          }}
        >
          {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
          {cohorts.length === 0 && <option value="">No cohorts</option>}
        </select>
        <input
          type="date"
          value={cohortDate}
          onChange={e => setCohortDate(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
            fontSize: 13, color: '#1A365E', background: '#fff',
          }}
        />
        <button
          onClick={() => markAllPresent(cohortStudents.map(s => s.id), cohortDate)}
          style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#1DBD6A', color: '#fff', fontWeight: 600, fontSize: 13,
          }}
        >
          ✓ All Present
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {cohortStudents.map(s => {
          const key = `${s.id}__${cohortDate}`
          const status = getStatus(s.id, cohortDate)
          const r = rate30(records, s.id, cohortDate)
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#1A365E,#2D5A8E)',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {initials(s)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{fullName(s)}</div>
                  <div style={{ fontSize: 11, color: '#7A92B0' }}>
                    {s.grade} &nbsp;·&nbsp;
                    <span style={{ fontWeight: 600, color: rateColor(r) }}>
                      {r !== null ? `${r}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
              <StatusButtons current={status} onChange={st => setStatus(s.id, cohortDate, st)} />
              <input
                value={notes[key] ?? ''}
                onChange={e => setNotes(prev => ({ ...prev, [key]: e.target.value }))}
                onBlur={() => saveNote(s.id, cohortDate)}
                placeholder="Add note…"
                style={{
                  marginTop: 10, padding: '5px 8px', borderRadius: 6,
                  border: '1px solid #E4EAF2', fontSize: 12, width: '100%',
                  boxSizing: 'border-box', color: '#1A365E',
                }}
              />
            </div>
          )
        })}
        {cohortStudents.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', padding: 32, textAlign: 'center', color: '#7A92B0', gridColumn: '1/-1' }}>
            {cohorts.length === 0 ? 'No cohorts exist yet.' : 'No students in this cohort.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Monthly Tab ──────────────────────────────────────────────────────────────
function MonthlyTab({ students, records }: { students: Stu[]; records: AttendanceRecord[] }) {
  const months = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>()
    records.forEach(r => {
      const m = r.date.slice(0, 7)
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(r)
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [records])

  const [open, setOpen] = useState<Set<string>>(() => new Set(months[0] ? [months[0][0]] : []))

  function toggle(m: string) {
    setOpen(prev => {
      const n = new Set(prev)
      if (n.has(m)) n.delete(m)
      else n.add(m)
      return n
    })
  }

  function monthLabel(m: string) {
    const [year, month] = m.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1)
    return d.toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  if (months.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', padding: 40, textAlign: 'center', color: '#7A92B0' }}>
        No attendance records yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {months.map(([month, recs]) => {
        const stuIds = Array.from(new Set(recs.map(r => r.student_id)))
        const stuList = students.filter(s => stuIds.includes(s.id))
        let totalP = 0, totalA = 0, totalT = 0, totalE = 0, totalR = 0
        stuList.forEach(s => {
          const sRecs = recs.filter(r => r.student_id === s.id)
          totalP += sRecs.filter(r => r.status === 'P').length
          totalA += sRecs.filter(r => r.status === 'A').length
          totalT += sRecs.filter(r => r.status === 'T').length
          totalE += sRecs.filter(r => r.status === 'E').length
          totalR += sRecs.filter(r => r.status === 'R').length
        })

        return (
          <div key={month} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
            <button
              onClick={() => toggle(month)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', background: '#F7F9FC', border: 'none', cursor: 'pointer',
                borderBottom: open.has(month) ? '1px solid #E4EAF2' : 'none',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{monthLabel(month)}</span>
              <span style={{ fontSize: 12, color: '#7A92B0' }}>
                {stuList.length} student{stuList.length !== 1 ? 's' : ''} &nbsp; {open.has(month) ? '▲' : '▼'}
              </span>
            </button>
            {open.has(month) && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F9FC' }}>
                    <th style={th}>Student</th>
                    <th style={{ ...th, color: ASTAT.P.tc }}>Present</th>
                    <th style={{ ...th, color: ASTAT.A.tc }}>Absent</th>
                    <th style={{ ...th, color: ASTAT.T.tc }}>Tardy</th>
                    <th style={{ ...th, color: ASTAT.E.tc }}>Excused</th>
                    <th style={{ ...th, color: ASTAT.R.tc }}>Remote</th>
                    <th style={th}>Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {stuList.map(s => {
                    const sRecs = recs.filter(r => r.student_id === s.id)
                    const p = sRecs.filter(r => r.status === 'P').length
                    const a = sRecs.filter(r => r.status === 'A').length
                    const t = sRecs.filter(r => r.status === 'T').length
                    const e = sRecs.filter(r => r.status === 'E').length
                    const re = sRecs.filter(r => r.status === 'R').length
                    const total = sRecs.length
                    const rate = total > 0 ? Math.round(((p + e + re) / total) * 100) : null
                    return (
                      <tr key={s.id}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: 'linear-gradient(135deg,#1A365E,#2D5A8E)',
                              color: '#fff', fontSize: 10, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              {initials(s)}
                            </div>
                            {fullName(s)}
                          </div>
                        </td>
                        <td style={{ ...td, color: ASTAT.P.tc, fontWeight: 600 }}>{p}</td>
                        <td style={{ ...td, color: ASTAT.A.tc, fontWeight: 600 }}>{a}</td>
                        <td style={{ ...td, color: ASTAT.T.tc, fontWeight: 600 }}>{t}</td>
                        <td style={{ ...td, color: ASTAT.E.tc, fontWeight: 600 }}>{e}</td>
                        <td style={{ ...td, color: ASTAT.R.tc, fontWeight: 600 }}>{re}</td>
                        <td style={{ ...td, fontWeight: 700, color: rateColor(rate) }}>
                          {rate !== null ? `${rate}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#F7F9FC' }}>
                    <td style={{ ...td, fontWeight: 700 }}>Month Total</td>
                    <td style={{ ...td, color: ASTAT.P.tc, fontWeight: 700 }}>{totalP}</td>
                    <td style={{ ...td, color: ASTAT.A.tc, fontWeight: 700 }}>{totalA}</td>
                    <td style={{ ...td, color: ASTAT.T.tc, fontWeight: 700 }}>{totalT}</td>
                    <td style={{ ...td, color: ASTAT.E.tc, fontWeight: 700 }}>{totalE}</td>
                    <td style={{ ...td, color: ASTAT.R.tc, fontWeight: 700 }}>{totalR}</td>
                    <td style={td}>—</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
