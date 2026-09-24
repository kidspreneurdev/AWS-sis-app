import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import {
  card, emptyState, SP_NAVY, SP_GREEN, SP_GOLD, SP_RED, portalPrefix,
  calcWeightedGPA, gpaColor, gradeColor, letterGrade, attendanceRate, parseGradeLevel,
  type GradeRow, type RemarkRow, type AttendanceRow, type CourseRow, type TransferRow,
} from './gradesShared'

export function SPReportCardPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const [grades, setGrades] = useState<GradeRow[]>([])
  const [remarks, setRemarks] = useState<RemarkRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])

  const studentDbId = session?.dbId ?? ''
  const gradeLevel = session ? parseGradeLevel(session.grade) : null
  const isHS = gradeLevel !== null && gradeLevel >= 9

  useEffect(() => {
    if (!session) return
    async function load() {
      const [gradesRes, remarksRes, attendanceRes, coursesRes, transferRes] = await Promise.all([
        supabase.from('grades').select('*').eq('student_id', studentDbId),
        supabase.from('remarks').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('status').eq('student_id', studentDbId),
        supabase.from('courses').select('*').eq('student_id', studentDbId).order('academic_year', { ascending: false }),
        supabase.from('transfer_credits').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
      ])

      setGrades(((gradesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        subject: (row.subject as string) ?? '',
        grade: Number(row.grade ?? 0),
        term: (row.term as string) ?? '',
        course_code: (row.course_code as string) ?? '',
        letter_grade: (row.letter_grade as string) ?? '',
      })))

      setRemarks(((remarksRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        term: (row.term as string) ?? '',
        academic_year: (row.academic_year as string) ?? '',
        content: (row.content as string) ?? '',
        author: (row.author as string) ?? null,
        created_at: (row.created_at as string) ?? '',
      })))

      setAttendance(((attendanceRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        status: (row.status as string) ?? '',
      })))

      setCourses(((coursesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        type: ((row.type as CourseRow['type']) ?? 'STD'),
        area: (row.area as string) ?? '',
        credits: Number(row.credits ?? 0),
        credits_earned: Number(row.credits_earned ?? row.credits ?? 0),
        course_status: (row.course_status as string) ?? null,
        grade_letter: (row.grade_letter as string) ?? null,
        grade_percent: row.grade_percent == null ? null : Number(row.grade_percent),
        ap_score: row.ap_score == null ? null : Number(row.ap_score),
        ib_score: row.ib_score == null ? null : Number(row.ib_score),
        term: (row.term as string) ?? null,
        academic_year: (row.academic_year as string) ?? '',
      })))

      setTransfers(((transferRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        institution: (row.institution as string) ?? (row.source_school as string) ?? '',
        course_title: (row.course_title as string) ?? (row.orig_title as string) ?? '',
        credits: Number(row.credits_awarded ?? row.credits ?? 0),
        grade_letter: (row.grade_letter as string) ?? (row.orig_grade as string) ?? null,
        year: (row.year as string) ?? null,
        status: (row.status as string) ?? null,
        type: (row.type as string) ?? (row.kind as string) ?? null,
        area: (row.area as string) ?? null,
      })))
    }
    void load()
  }, [session, studentDbId])

  const avg = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g.grade, 0) / grades.length) : null
  const attRate = attendanceRate(attendance)
  const wGpa = useMemo(() => calcWeightedGPA(courses, transfers), [courses, transfers])

  const bySubject = useMemo(() => {
    const map: Record<string, GradeRow[]> = {}
    grades.forEach((grade) => {
      if (!map[grade.subject]) map[grade.subject] = []
      map[grade.subject].push(grade)
    })
    return map
  }, [grades])

  if (!session) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(`${prefix}/grades`)}
          style={{ background: '#F0F4F8', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 16, fontWeight: 700, color: SP_NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={13} /> Back to My Grades
        </button>
        <div style={{ fontSize: 20, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} /> Report Card</div>
      </div>

      {!isHS && avg !== null && (
        <div style={{ ...card, display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: gradeColor(avg), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{letterGrade(avg).replace('+', '')}</span>
          </div>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, color: SP_NAVY }}>{avg}%</div>
            <div style={{ fontSize: 16, color: '#7A92B0' }}>Overall Average · {grades.length} grade{grades.length !== 1 ? 's' : ''} recorded</div>
          </div>
        </div>
      )}

      {grades.length > 0 ? (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 15, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 15, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Term</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade) => (
                <tr key={grade.id}>
                  <td style={{ padding: '10px 14px', fontSize: 16, color: SP_NAVY, borderBottom: '1px solid #F0F4F8', fontWeight: 700 }}>{grade.subject}</td>
                  <td style={{ padding: '10px 14px', fontSize: 16, color: '#7A92B0', borderBottom: '1px solid #F0F4F8' }}>{grade.term || '—'}{grade.course_code ? ` · ${grade.course_code}` : ''}</td>
                  <td style={{ padding: '10px 14px', fontSize: 16, color: gradeColor(grade.grade), borderBottom: '1px solid #F0F4F8', textAlign: 'right', fontWeight: 800 }}>{grade.grade}% {grade.letter_grade ? `· ${grade.letter_grade}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...card, ...emptyState }}>No report card grades have been published yet.</div>
      )}

      {Object.keys(bySubject).length > 0 && !isHS && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {Object.entries(bySubject).map(([subject, rows]) => {
            const subjectAvg = Math.round(rows.reduce((sum, row) => sum + row.grade, 0) / rows.length)
            return (
              <div key={subject} style={card}>
                <div style={{ fontSize: 17, fontWeight: 700, color: SP_NAVY, marginBottom: 6 }}>{subject}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: gradeColor(subjectAvg) }}>{subjectAvg}%</div>
                <div style={{ fontSize: 15, color: '#7A92B0' }}>{rows.length} grade{rows.length !== 1 ? 's' : ''}</div>
                <div style={{ marginTop: 8, height: 5, background: '#E4EAF2', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${subjectAvg}%`, background: gradeColor(subjectAvg), borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isHS && Object.keys(bySubject).length === 0 && (
        <div style={{ ...card, ...emptyState }}>No subject summaries are available yet.</div>
      )}

      {remarks.length > 0 ? (
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={13} /> Teacher Remarks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {remarks.map((remark) => (
              <div key={remark.id} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${SP_NAVY}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#7A92B0' }}>{remark.term} · {remark.academic_year}</div>
                  {remark.author && <div style={{ fontSize: 14, color: '#94A3B8' }}>{remark.author}</div>}
                </div>
                <div style={{ fontSize: 16, color: '#3D5475', lineHeight: 1.6 }}>{remark.content}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...card, ...emptyState }}>No teacher remarks have been added yet.</div>
      )}

      <div style={{ ...card, padding: '12px 20px', background: '#F7F9FC', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 15, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance Rate</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: attRate !== null ? (attRate >= 90 ? SP_GREEN : attRate >= 80 ? SP_GOLD : SP_RED) : '#7A92B0', marginLeft: 8 }}>
            {attRate !== null ? `${attRate}%` : '—'}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 15, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Days Recorded</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: SP_NAVY, marginLeft: 8 }}>{attendance.length}</span>
        </div>
        {isHS && (
          <div>
            <span style={{ fontSize: 15, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weighted GPA</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: gpaColor(wGpa), marginLeft: 8 }}>{wGpa.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
