import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear().toString()

interface Student {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  campus: string | null
  cohort: string | null
}

interface GradeRow {
  subject: string
  schoolType: 'hs' | 'ls'
  q1: string | null
  q2: string | null
  q3: string | null
  q4: string | null
  finalGrade: string | null
}

interface AttendanceRow {
  date: string
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeLevelLabel(g: string | null): string {
  if (!g) return '—'
  if (g === '-1') return 'Pre-K'
  if (g === '0') return 'K'
  return `Grade ${g}`
}

function isHS(g: string | null): boolean {
  const n = parseInt(g ?? '')
  return n >= 9 && n <= 12
}

function scoreToGpa(q: string | null): number | null {
  if (!q) return null
  const n = parseFloat(q)
  if (isNaN(n)) return null
  if (n >= 90) return 4.0
  if (n >= 80) return 3.0
  if (n >= 70) return 2.0
  if (n >= 60) return 1.0
  return 0.0
}

function attendanceRate(records: AttendanceRow[]): number | null {
  if (records.length === 0) return null
  const present = records.filter(r => r.status === 'P' || r.status === 'E' || r.status === 'R').length
  return Math.round((present / records.length) * 100)
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

// ─── Single Report Card ───────────────────────────────────────────────────────
function ReportCard({ student, grades, attendance }: {
  student: Student
  grades: GradeRow[]
  attendance: AttendanceRow[]
}) {
  const rate = attendanceRate(attendance)
  const hs = isHS(student.grade)

  // GPA (HS only)
  const gpas = hs
    ? grades.map(g => scoreToGpa(g.finalGrade)).filter((x): x is number => x !== null)
    : []
  const avgGpa = gpas.length > 0 ? (gpas.reduce((a, b) => a + b) / gpas.length).toFixed(2) : null

  const thRC: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', textAlign: 'left' }
  const tdRC: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#1A365E', borderBottom: '1px solid #F0F4F8' }

  const quarter = (v: string | null) => v ?? '—'
  const gpaLabel = (gpa: number | null) => {
    if (gpa === null) return { text: '—', color: '#7A92B0' }
    if (gpa >= 3.5) return { text: gpa.toFixed(1), color: '#1DBD6A' }
    if (gpa >= 2.0) return { text: gpa.toFixed(1), color: '#0369A1' }
    if (gpa >= 1.0) return { text: gpa.toFixed(1), color: '#F5A623' }
    return { text: gpa.toFixed(1), color: '#D61F31' }
  }

  const lsGradeColor = (v: string | null) => {
    if (v === 'O') return '#1DBD6A'
    if (v === 'S') return '#0369A1'
    if (v === 'NI') return '#F5A623'
    if (v === 'U') return '#D61F31'
    return '#7A92B0'
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', overflow: 'hidden', pageBreakInside: 'avoid' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#9EB3C8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>American World School</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 4 }}>{student.firstName} {student.lastName}</div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 4 }}>
              {gradeLevelLabel(student.grade)}
              {student.campus ? ` · ${student.campus}` : ''}
              {student.cohort ? ` · ${student.cohort}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9EB3C8', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Academic Year</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 4 }}>{CURRENT_YEAR}–{String(parseInt(CURRENT_YEAR) + 1).slice(-2)}</div>
            {avgGpa && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, color: '#9EB3C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GPA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{avgGpa}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grades */}
      {grades.length > 0 ? (
        <div style={{ padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={thRC}>Subject</th>
                <th style={{ ...thRC, textAlign: 'center' }}>Q1</th>
                <th style={{ ...thRC, textAlign: 'center' }}>Q2</th>
                <th style={{ ...thRC, textAlign: 'center' }}>Q3</th>
                <th style={{ ...thRC, textAlign: 'center' }}>Q4</th>
                <th style={{ ...thRC, textAlign: 'center' }}>{hs ? 'Final / GPA' : 'Final'}</th>
              </tr>
            </thead>
            <tbody>
              {grades.map(g => {
                const gpa = hs ? scoreToGpa(g.finalGrade) : null
                const gl = gpaLabel(gpa)
                return (
                  <tr key={g.subject}>
                    <td style={tdRC}>{g.subject}</td>
                    {hs ? (
                      <>
                        {([g.q1, g.q2, g.q3, g.q4] as (string | null)[]).map((v, i) => (
                          <td key={i} style={{ ...tdRC, textAlign: 'center', color: '#7A92B0' }}>{quarter(v)}</td>
                        ))}
                        <td style={{ ...tdRC, textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#1A365E' }}>{g.finalGrade ?? '—'}</span>
                          {gpa !== null && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, color: gl.color }}>({gl.text})</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        {([g.q1, g.q2, g.q3, g.q4] as (string | null)[]).map((v, i) => (
                          <td key={i} style={{ ...tdRC, textAlign: 'center', fontWeight: v ? 700 : 400, color: lsGradeColor(v) }}>{v ?? '—'}</td>
                        ))}
                        <td style={{ ...tdRC, textAlign: 'center', color: '#7A92B0' }}>—</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No grade data for this year.</div>
      )}

      {/* Attendance summary */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', background: '#F7F9FC', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance Rate</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: rate !== null ? (rate >= 90 ? '#1DBD6A' : rate >= 80 ? '#F5A623' : '#D61F31') : '#7A92B0', marginLeft: 8 }}>
            {rate !== null ? `${rate}%` : '—'}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Days Recorded</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1A365E', marginLeft: 8 }}>{attendance.length}</span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', marginLeft: 8 }}>{student.status}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ReportCardsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [allGrades, setAllGrades] = useState<Array<GradeRow & { studentId: string }>>([])
  const [allAttendance, setAllAttendance] = useState<Array<AttendanceRow & { studentId: string }>>([])
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const [stuRes, gradesRes, attRes] = await Promise.all([
        supabase.from('students').select('id,first_name,last_name,grade,status,campus,cohort').eq('status', 'Enrolled'),
        supabase.from('grades').select('*').eq('school_year', CURRENT_YEAR),
        supabase.from('attendance').select('student_id,date,status'),
      ])
      if (stuRes.data) {
        setStudents(stuRes.data.map((r: Record<string, unknown>) => ({
          id:        r.id as string,
          firstName: (r.first_name as string) ?? '',
          lastName:  (r.last_name as string) ?? '',
          grade:     r.grade != null ? String(r.grade) : null,
          status:    (r.status as string) ?? '',
          campus:    (r.campus as string) ?? null,
          cohort:    (r.cohort as string) ?? null,
        })))
      }
      if (gradesRes.data) {
        setAllGrades(gradesRes.data.map((r: Record<string, unknown>) => ({
          studentId:   r.student_id as string,
          subject:     r.subject as string,
          schoolType:  r.school_type as 'hs' | 'ls',
          q1:          r.q1 as string | null,
          q2:          r.q2 as string | null,
          q3:          r.q3 as string | null,
          q4:          r.q4 as string | null,
          finalGrade:  r.final_grade as string | null,
        })))
      }
      if (attRes.data) {
        setAllAttendance(attRes.data.map((r: Record<string, unknown>) => ({
          studentId: r.student_id as string,
          date:      r.date as string,
          status:    r.status as string,
        })))
      }
    }
    load()
  }, [])

  const grades = useMemo(() => {
    const set = new Set<string>()
    students.forEach(s => { if (s.grade) set.add(s.grade) })
    return Array.from(set).sort((a, b) => parseInt(a) - parseInt(b))
  }, [students])

  const filtered = useMemo(() => students.filter(s => {
    if (search && !`${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())) return false
    if (filterGrade !== 'All' && s.grade !== filterGrade) return false
    return true
  }), [students, search, filterGrade])

  const selected = selectedId ? students.find(s => s.id === selectedId) ?? null : null

  function getGrades(stuId: string) { return allGrades.filter(g => g.studentId === stuId) }
  function getAttendance(stuId: string) { return allAttendance.filter(a => a.studentId === stuId) }

  function handlePrint() {
    if (!selected) return
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Report Card — ${selected.firstName} ${selected.lastName}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1A365E; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #E4EAF2; font-size: 12px; }
        th { background: #F7F9FC; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; color: #7A92B0; }
        @media print { @page { margin: 16mm; } }
      </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.print()
  }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Report Cards</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>View and print student report cards — {CURRENT_YEAR}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Student list */}
        <div style={card}>
          <div style={{ marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ ...iStyle, width: '100%', boxSizing: 'border-box', marginTop: 8 }}>
              <option value="All">All Grades</option>
              {grades.map(g => <option key={g} value={g}>{gradeLevelLabel(g)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
            {filtered.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: selectedId === s.id ? '#D61F31' : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: selectedId === s.id ? 'rgba(255,255,255,0.25)' : 'linear-gradient(135deg,#1A365E,#2D5A8E)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.firstName[0]}{s.lastName[0]}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selectedId === s.id ? '#fff' : '#1A365E' }}>{s.firstName} {s.lastName}</div>
                  <div style={{ fontSize: 11, color: selectedId === s.id ? 'rgba(255,255,255,0.7)' : '#7A92B0' }}>{gradeLevelLabel(s.grade)}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No students found.</div>}
          </div>
        </div>

        {/* Report card display */}
        <div>
          {selected ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={handlePrint} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🖨 Print / Export PDF
                </button>
              </div>
              <div ref={printRef}>
                <ReportCard
                  student={selected}
                  grades={getGrades(selected.id)}
                  attendance={getAttendance(selected.id)}
                />
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: 60, textAlign: 'center', color: '#7A92B0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Select a student</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Choose a student from the list to view their report card.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
