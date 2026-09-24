import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, CalendarDays, School } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import {
  card, SP_NAVY, portalPrefix, weightedPts, letterGradeColor, gradeColor, STATUS_STYLE,
  type CourseRow,
} from './gradesShared'

export function SPCourseRecordsPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const [courses, setCourses] = useState<CourseRow[]>([])
  const studentDbId = session?.dbId ?? ''

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data } = await supabase.from('courses').select('*').eq('student_id', studentDbId).order('academic_year', { ascending: false })
      setCourses(((data as Record<string, unknown>[] | null) ?? []).map((row) => ({
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
    }
    void load()
  }, [session, studentDbId])

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
        <div style={{ fontSize: 20, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} /> Course Records</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {courses.length === 0 ? (
          <div style={{ ...card, padding: 30, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: '#94A3B8' }}><BookOpen size={32} /></div>
            <div style={{ fontWeight: 700, color: SP_NAVY, marginBottom: 6 }}>No course records yet</div>
            <div style={{ fontSize: 16, color: '#7A92B0' }}>Your high school course records will appear here.</div>
          </div>
        ) : (
          courses.map((course) => {
            const color = course.grade_letter
              ? letterGradeColor(course.grade_letter)
              : gradeColor(course.grade_percent ?? 0)
            const creditsDisplay = course.credits_earned || course.credits || 0
            const wPts = weightedPts(course.grade_letter, course.type)
            const status = course.course_status ?? 'In Progress'
            const ss = STATUS_STYLE[status] ?? STATUS_STYLE['In Progress']
            return (
              <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
                <div style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: SP_NAVY }}>{course.title}</span>
                        <span style={{ background: '#F7F9FC', color: '#7A92B0', padding: '2px 8px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>{course.type}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, color: '#7A92B0', display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} /> {course.area}</span>
                        {course.term && <span style={{ fontSize: 15, color: '#7A92B0', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={11} /> {course.term}</span>}
                        <span style={{ fontSize: 15, color: '#7A92B0', display: 'inline-flex', alignItems: 'center', gap: 4 }}><School size={11} /> {course.academic_year}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, borderLeft: '1px solid #F0F4F8' }}>
                      {[
                        { label: 'CR.', value: creditsDisplay },
                        { label: 'GRADE', value: course.grade_letter ?? '—', valueColor: color },
                        { label: 'WTD PTS', value: wPts != null ? wPts.toFixed(1) : '—' },
                      ].map(col => (
                        <div key={col.label} style={{ textAlign: 'center', padding: '6px 16px', borderRight: '1px solid #F0F4F8' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{col.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: (col as {valueColor?: string}).valueColor ?? SP_NAVY }}>{col.value}</div>
                        </div>
                      ))}
                      <div style={{ textAlign: 'center', padding: '6px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>STATUS</div>
                        <span style={{ background: ss.bg, color: ss.color, padding: '3px 10px', borderRadius: 20, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ss.icon size={11} /> {status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
