import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, GraduationCap, BookOpen, ArrowRight, type LucideIcon } from 'lucide-react'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { toLegacyStudentGradeValue } from '@/types/student'
import { K5GradesPage } from '@/pages/student-portal/K5GradesPage'
import { SPCourseGradesSection } from '@/pages/student-portal/SPCourseGradesSection'
import { card, SP_NAVY, portalPrefix } from './gradesShared'

export function SPGradesPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const gradeNum = session ? toLegacyStudentGradeValue(session.grade) : null

  if (!session) return null

  if (gradeNum !== null && gradeNum <= 5) return <K5GradesPage />

  const navButtons: { key: string; label: string; icon: LucideIcon; color: string; path: string }[] = [
    { key: 'audit', label: 'Graduation Audit', icon: GraduationCap, color: '#1A365E', path: `${prefix}/grades/audit` },
    { key: 'courses', label: 'Course Records', icon: BookOpen, color: '#0A6B64', path: `${prefix}/grades/courses` },
    // Report Card — temporarily disabled, not currently offered to students.
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} /> My Grades</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {navButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => navigate(btn.path)}
            style={{
              ...card,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              borderLeft: `4px solid ${btn.color}`,
              fontFamily: 'Poppins,sans-serif',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(26,54,94,0.13)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(26,54,94,0.06)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: `${btn.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: btn.color, flexShrink: 0 }}>
                <btn.icon size={17} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY }}>{btn.label}</span>
            </span>
            <ArrowRight size={14} color="#94A3B8" />
          </button>
        ))}
      </div>

      <SPCourseGradesSection />
    </div>
  )
}
