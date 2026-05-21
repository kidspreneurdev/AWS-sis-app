import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useCampusFilter } from '@/hooks/useCampusFilter'

// ─── Types ────────────────────────────────────────────────────────────────────
const now = new Date()
const AY_START = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
const AY_FULL = `${AY_START}-${AY_START + 1}`           // "2025-2026"
const AY_LABEL = `${AY_START}–${String(AY_START + 1).slice(-2)}`  // "2025–26"

interface Student {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  campus: string | null
  cohort: string | null
}

interface CourseRow {
  studentId: string
  title: string
  type: string
  area: string
  credits: number
  grade: string
  status: string
  term: string
  academicYear: string
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

function letterToGpa(g: string): number | null {
  const map: Record<string, number> = {
    'A+': 4.3, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0,
  }
  return map[g] ?? null
}

function gradeColor(g: string): string {
  if (!g || g === '—') return '#7A92B0'
  const gpa = letterToGpa(g)
  if (gpa === null) return '#1A365E'
  if (gpa >= 3.7) return '#059669'
  if (gpa >= 3.0) return '#0369A1'
  if (gpa >= 2.0) return '#F5A623'
  if (gpa >= 1.0) return '#D97706'
  return '#D61F31'
}

function attendanceRate(records: AttendanceRow[]): number | null {
  if (records.length === 0) return null
  const present = records.filter(r => r.status === 'P' || r.status === 'E' || r.status === 'R').length
  return Math.round((present / records.length) * 100)
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

// ─── Single Report Card ───────────────────────────────────────────────────────
function ReportCard({ student, courses, attendance }: {
  student: Student
  courses: CourseRow[]
  attendance: AttendanceRow[]
}) {
  const rate = attendanceRate(attendance)
  const hs = isHS(student.grade)

  const completedCourses = courses.filter(c => c.grade && c.grade !== '—')
  const gpas = completedCourses
    .map(c => letterToGpa(c.grade))
    .filter((x): x is number => x !== null)
  const avgGpa = gpas.length > 0
    ? Math.min(4.0, gpas.reduce((a, b) => a + b) / gpas.length).toFixed(2)
    : null

  const totalCredits = courses.reduce((s, c) => s + c.credits, 0)

  const thRC: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', textAlign: 'left' }
  const tdRC: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#1A365E', borderBottom: '1px solid #F0F4F8' }

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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 4 }}>{AY_LABEL}</div>
            {hs && avgGpa && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, color: '#9EB3C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GPA</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{avgGpa}</div>
              </div>
            )}
            {totalCredits > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, color: '#9EB3C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Credits</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{totalCredits}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Course table */}
      {courses.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F9FC' }}>
              <th style={thRC}>Course</th>
              <th style={{ ...thRC }}>Area</th>
              <th style={{ ...thRC, textAlign: 'center' }}>Credits</th>
              <th style={{ ...thRC, textAlign: 'center' }}>Term</th>
              <th style={{ ...thRC, textAlign: 'center' }}>Grade</th>
              <th style={{ ...thRC, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c, i) => (
              <tr key={i}>
                <td style={tdRC}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  {c.type && c.type !== 'STD' && (
                    <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 1 }}>{c.type}</div>
                  )}
                </td>
                <td style={{ ...tdRC, color: '#7A92B0' }}>{c.area || '—'}</td>
                <td style={{ ...tdRC, textAlign: 'center' }}>{c.credits}</td>
                <td style={{ ...tdRC, textAlign: 'center', color: '#7A92B0' }}>{c.term || '—'}</td>
                <td style={{ ...tdRC, textAlign: 'center', fontWeight: 700, color: gradeColor(c.grade) }}>{c.grade || '—'}</td>
                <td style={{ ...tdRC, textAlign: 'center' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                    background: c.status === 'Completed' ? '#D1FAE5' : c.status === 'In Progress' ? '#DBEAFE' : '#F3F4F6',
                    color: c.status === 'Completed' ? '#065F46' : c.status === 'In Progress' ? '#1E40AF' : '#7A92B0',
                  }}>{c.status || '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>
          No course records for {AY_LABEL}.
        </div>
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
  const cf = useCampusFilter()
  const [students, setStudents] = useState<Student[]>([])
  const [allCourses, setAllCourses] = useState<CourseRow[]>([])
  const [allAttendance, setAllAttendance] = useState<Array<AttendanceRow & { studentId: string }>>([])
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      let sQuery = supabase.from('students').select('id,first_name,last_name,grade,status,campus,cohort').eq('status', 'Enrolled')
      if (cf) sQuery = sQuery.eq('campus', cf)
      const [stuRes, coursesRes, attRes] = await Promise.all([
        sQuery,
        supabase.from('courses').select('student_id,title,type,area,credits,credits_earned,grade_letter,course_status,term,academic_year'),
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
      if (coursesRes.data) {
        setAllCourses(coursesRes.data.map((r: Record<string, unknown>) => ({
          studentId:    r.student_id as string,
          title:        (r.title as string) ?? '',
          type:         (r.type as string) ?? 'STD',
          area:         (r.area as string) ?? '',
          credits:      Number(r.credits_earned ?? r.credits ?? 1),
          grade:        (r.grade_letter as string) ?? '',
          status:       (r.course_status as string) ?? '',
          term:         (r.term as string) ?? '',
          academicYear: (r.academic_year as string) ?? '',
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
  }, [cf])

  const gradeOptions = useMemo(() => {
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

  function getCourses(stuId: string): CourseRow[] {
    const all = allCourses.filter(c => c.studentId === stuId)
    // Prefer current academic year; fall back to all if none match
    const current = all.filter(c => c.academicYear === AY_FULL)
    return current.length > 0 ? current : all
  }
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
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>View and print student report cards — {AY_LABEL}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Student list */}
        <div style={card}>
          <div style={{ marginBottom: 12 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ ...iStyle, width: '100%', boxSizing: 'border-box', marginTop: 8 }}>
              <option value="All">All Grades</option>
              {gradeOptions.map(g => <option key={g} value={g}>{gradeLevelLabel(g)}</option>)}
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
                  courses={getCourses(selected.id)}
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
