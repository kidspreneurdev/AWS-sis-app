import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCohorts } from '@/hooks/useCohorts'
import {
  loadLMS, saveLMS, loadLMSFromDB, deleteLMSCourse, deleteLMSContent, deleteLMSEnrolment,
  lmsId, fmtTime, hasMasteryBool, hasAssignBool, isActiveBool,
  lmsCompositeScore, lmsCourseComposite, gradeLabel,
  SUBJECT_COLORS, SUBJECTS, GRADE_LEVELS, TYPE_ICONS, TYPE_COLORS,
  type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress, type LMSStore
} from './lmsStore'

interface Student { id: string; lastName: string; firstName: string; fullName: string; cohort: string; grade: string }

const card: React.CSSProperties = { background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }
const iStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', fontFamily: 'inherit', outline: 'none', background: '#fff' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#5A7290', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { ...inputStyle }
const taStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' as const }

const TAB_PATHS: Record<string, string> = {
  '/lms/manage': 'manage',
  '/lms/courses': 'courses',
  '/lms/content': 'content',
  '/lms/assign': 'assign',
  '/lms/gradebook': 'gradebook',
  '/lms/section': 'section',
  '/lms/progress': 'progress',
}

const TABS = [
  { v: 'manage', path: '/lms/manage', l: '📋 Manage' },
  { v: 'courses', path: '/lms/courses', l: '📘 Courses' },
  { v: 'content', path: '/lms/content', l: '📄 Content' },
  { v: 'assign', path: '/lms/assign', l: '👥 Assign' },
  { v: 'gradebook', path: '/lms/gradebook', l: '📊 Gradebook' },
  { v: 'section', path: '/lms/section', l: '📋 Section' },
  { v: 'progress', path: '/lms/progress', l: '📈 Progress' },
]

// ─── ENROL MODAL (top-level to prevent remount on parent re-render) ──────────
interface EnrolModalProps {
  courses: LMSCourse[]
  students: { id: string; fullName: string; cohort: string; grade: string }[]
  cohorts: string[]
  onSave: (enrolment: LMSEnrolment) => void
  onClose: () => void
}
function EnrolModal({ courses, students, cohorts, onSave, onClose }: EnrolModalProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [targetType, setTargetType] = useState<'cohort' | 'student' | 'grade'>('cohort')
  const [cohort, setCohort] = useState(cohorts[0] ?? '')
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [grade, setGrade] = useState('Grade 6')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paceType, setPaceType] = useState('self')
  const [paceDays, setPaceDays] = useState('3')
  const save = () => {
    if (!courseId) { alert('Select a course'); return }
    const targetValue = targetType === 'cohort' ? cohort : targetType === 'grade' ? grade : studentId
    if (!targetValue) { alert('Select a target'); return }
    const enrolment: LMSEnrolment = {
      id: lmsId(), courseId, targetType, targetValue,
      assignedBy: 'Admin',
      assignedAt: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      paceType, paceDaysPerLesson: parseInt(paceDays) || 3,
      paceStartDate: startDate,
      dueDate,
      active: true
    }
    onSave(enrolment)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>👥 Assign Course</div>
        </div>
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Course *</label><select value={courseId} onChange={e => setCourseId(e.target.value)} style={selectStyle}>{courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}</select></div>
          <div><label style={labelStyle}>Assign to</label>
            <select value={targetType} onChange={e => setTargetType(e.target.value as 'cohort' | 'student' | 'grade')} style={selectStyle}>
              <option value="cohort">Cohort</option>
              <option value="student">Individual Student</option>
              <option value="grade">Grade Level</option>
            </select>
          </div>
          {targetType === 'cohort' && <div><label style={labelStyle}>Cohort</label><select value={cohort} onChange={e => setCohort(e.target.value)} style={selectStyle}>{cohorts.map(c => <option key={c}>{c}</option>)}</select></div>}
          {targetType === 'student' && (
            <div>
              <label style={labelStyle}>Student ({students.length} loaded)</label>
              <select value={studentId} onChange={e => setStudentId(e.target.value)} style={selectStyle}>
                {students.length === 0 && <option value="">No students found</option>}
                {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
          )}
          {targetType === 'grade' && <div><label style={labelStyle}>Grade Level</label><select value={grade} onChange={e => setGrade(e.target.value)} style={selectStyle}>{GRADE_LEVELS.filter(g => g !== 'All Grades').map(g => <option key={g}>{g}</option>)}</select></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Start Date</label><input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>Due Date (optional)</label><input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" style={inputStyle} /></div>
          </div>
          <div style={{ borderTop: '1px solid #E4EAF2', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>📅 Course Pace (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>Pace Type</label>
                <select value={paceType} onChange={e => setPaceType(e.target.value)} style={selectStyle}>
                  <option value="self">Self-paced (no schedule)</option>
                  <option value="fixed">Fixed pace (generates calendar)</option>
                </select>
              </div>
              <div><label style={labelStyle}>Days per Lesson</label><input value={paceDays} onChange={e => setPaceDays(e.target.value)} type="number" min={1} max={30} style={inputStyle} /></div>
            </div>
            <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 4 }}>Fixed pace auto-generates a lesson due-date calendar for enrolled students based on their start date.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Assign</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LMSPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = TAB_PATHS[location.pathname] || 'manage'

  const [store, setStore] = useState<LMSStore>(loadLMS)
  const [students, setStudents] = useState<Student[]>([])
  const cohorts = useCohorts()

  // Per-tab UI state
  const [manageSearch, setManageSearch] = useState('')
  const [manageTabFilter, setManageTabFilter] = useState<'active' | 'inactive'>('active')
  const [manageTypeFilter, setManageTypeFilter] = useState('')
  const [manageExpanded, setManageExpanded] = useState<Record<string, boolean>>({})
  const [activeCourseId, setActiveCourseId] = useState('')
  const [gbCourseId, setGbCourseId] = useState('')
  const [gbSubjectFilter, setGbSubjectFilter] = useState('')
  const [sectionCourseId, setSectionCourseId] = useState('')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [sectionStudentTab, setSectionStudentTab] = useState<'gradebook' | 'curriculum'>('gradebook')
  const [progFilterCourse, setProgFilterCourse] = useState('')
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editCourseIdx, setEditCourseIdx] = useState<number | null>(null)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [editLessonIdx, setEditLessonIdx] = useState<number | null>(null)
  const [prefillUnit, setPrefillUnit] = useState<string | null>(null)
  const [showEnrolModal, setShowEnrolModal] = useState(false)
  const [previewItem, setPreviewItem] = useState<LMSContent | null>(null)
  const [scoreModal, setScoreModal] = useState<{ studentId: string; contentId: string; courseId: string; currentScore: string; lessonTitle: string; maxScore: number; instructions: string; submNote: string; submLink: string } | null>(null)

  useEffect(() => { loadLMSFromDB().then(setStore) }, [])

  useEffect(() => {
    supabase.from('students').select('id,first_name,last_name,cohort,grade').eq('status', 'Enrolled').order('last_name').then(({ data, error }) => {
      if (error) { console.error('LMS students load error:', error); return }
      if (data) {
        const mapped = data.map((r: Record<string, unknown>) => {
          const firstName = (r.first_name as string) ?? ''
          const lastName = (r.last_name as string) ?? ''
          return {
            id: r.id as string,
            fullName: `${firstName} ${lastName}`.trim() || 'Unknown',
            firstName,
            lastName,
            cohort: (r.cohort as string) ?? '',
            grade: String(r.grade ?? ''),
          }
        })
        setStudents(mapped)
      }
    })
  }, [])

  const persist = useCallback(async (updated: LMSStore) => {
    setStore(updated)
    const err = await saveLMS(updated)
    if (err) alert('Save failed: ' + err)
  }, [])

  function navTab(tab: string) {
    const t = TABS.find(x => x.v === tab)
    if (t) navigate(t.path)
  }

  // ─── TAB NAV ────────────────────────────────────────────────────────────────
  function renderNav() {
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: '#F0F4FA', padding: 8, borderRadius: 12, marginBottom: 14 }}>
        {TABS.map(t => {
          const active = activeTab === t.v
          return (
            <button key={t.v} onClick={() => navTab(t.v)}
              style={{ padding: '6px 13px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: active ? '#1A365E' : 'transparent', color: active ? '#fff' : '#5A7290', fontFamily: 'inherit' }}>
              {t.l}
            </button>
          )
        })}
      </div>
    )
  }

  // ─── COURSES TAB ────────────────────────────────────────────────────────────
  function renderCourses() {
    const courses = store.courses
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📘 LMS Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{courses.length} courses · Self-paced learning</div>
          </div>
          <button onClick={() => { setEditCourseIdx(null); setShowCourseModal(true) }}
            style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New Course
          </button>
        </div>
        {renderNav()}
        {!courses.length ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No courses yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Create your first course to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {courses.map((course, idx) => {
              const col = SUBJECT_COLORS[course.subject] || '#6B7280'
              const contentItems = store.content.filter(x => x.courseId === course.id)
              const unitSet = new Set(contentItems.map(x => x.unitTitle).filter(Boolean))
              const statusCol = course.status === 'Published' ? '#059669' : '#D97706'
              return (
                <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: 8, background: col }} />
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', flex: 1, marginRight: 8 }}>{course.title}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: statusCol, background: statusCol + '18', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{course.status || 'Draft'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>{course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''}</div>
                    {course.description && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 10, lineHeight: 1.5 }}>{course.description.substring(0, 100)}{course.description.length > 100 ? '…' : ''}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#7A92B0', marginBottom: 12 }}>
                      <span>📂 {unitSet.size} unit{unitSet.size !== 1 ? 's' : ''}</span>
                      <span>📄 {contentItems.length} lesson{contentItems.length !== 1 ? 's' : ''}</span>
                      <span>🎯 Pass: {course.passMark || 80}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditCourseIdx(idx); setShowCourseModal(true) }}
                        style={{ flex: 1, padding: 7, background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Edit</button>
                      <button onClick={() => { setActiveCourseId(course.id); navTab('content') }}
                        style={{ flex: 1, padding: 7, background: '#E8FBF0', color: '#059669', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📄 Content</button>
                      <button onClick={async () => {
                        if (!confirm('Delete this course and all its content?')) return
                        await deleteLMSCourse(course.id)
                        const updated = { ...store, courses: store.courses.filter((_, i) => i !== idx), content: store.content.filter(x => x.courseId !== course.id) }
                        setStore(updated)
                      }} style={{ padding: '7px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── CONTENT TAB ────────────────────────────────────────────────────────────
  function renderContent() {
    const courseId = activeCourseId || (store.courses[0]?.id ?? '')
    const course = store.courses.find(x => x.id === courseId)
    const items = store.content.filter(x => x.courseId === courseId)
      .sort((a, b) => ((a.unitOrder ?? 0) - (b.unitOrder ?? 0)) || ((a.order ?? 0) - (b.order ?? 0)))
    const units: string[] = []
    const unitMap: Record<string, LMSContent[]> = {}
    items.forEach(item => {
      const ut = item.unitTitle || 'Default Unit'
      if (!unitMap[ut]) { unitMap[ut] = []; units.push(ut) }
      unitMap[ut].push(item)
    })
    const courseOpts = store.courses.map(co => ({ value: co.id, label: co.title }))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📄 Content Library</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{items.length} lesson{items.length !== 1 ? 's' : ''} · {units.length} unit{units.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={courseId} onChange={e => setActiveCourseId(e.target.value)} style={iStyle}>
              {courseOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => {
              const ut = prompt('Unit title:')
              if (!ut?.trim()) return
              setPrefillUnit(ut.trim()); setEditLessonIdx(null); setShowLessonModal(true)
            }} style={{ padding: '9px 14px', background: '#EEF3FF', color: '#1A365E', border: '1px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Unit</button>
            <button onClick={() => { setPrefillUnit(null); setEditLessonIdx(null); setShowLessonModal(true) }}
              style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Lesson</button>
          </div>
        </div>
        {renderNav()}
        {!store.courses.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Create a course first before adding content.</div>
        ) : !items.length ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No content yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Add a unit then add lessons inside it</div>
          </div>
        ) : units.map(unitTitle => {
          const unitItems = unitMap[unitTitle]
          return (
            <div key={unitTitle} style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ background: '#F7F9FC', padding: '10px 16px', borderBottom: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>📂 {unitTitle}</div>
                <span style={{ fontSize: 10, color: '#7A92B0' }}>{unitItems.length} lesson{unitItems.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ padding: 8 }}>
                {unitItems.map((item, i) => {
                  const realIdx = store.content.indexOf(item)
                  const typeCol = TYPE_COLORS[item.type] || '#6B7280'
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: i % 2 === 0 ? '#fff' : '#FAFBFF', border: '1px solid #F0F4FA', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || 'Untitled'}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#7A92B0', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ color: typeCol, fontWeight: 700 }}>{item.type}</span>
                          {item.estimatedMins && <span>⏱ {item.estimatedMins} min</span>}
                          {hasMasteryBool(item.hasMastery) && <span style={{ color: '#059669', fontWeight: 700 }}>✓ Mastery test</span>}
                          {hasAssignBool(item.hasAssignment) && <span style={{ background: '#EEF3FF', color: '#1A365E', fontWeight: 700, fontSize: 9, padding: '2px 7px', borderRadius: 4, border: '1px solid #C7D9FF' }}>📋 Assignment{item.assignMaxScore ? ' · Max: ' + item.assignMaxScore : ''}{item.assignSubType ? ' · ' + item.assignSubType : ''}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setPreviewItem(item)} title="Preview as student" style={{ padding: '5px 10px', background: '#F0FFF4', color: '#1DBD6A', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>👁</button>
                        <button onClick={() => { setEditLessonIdx(realIdx); setPrefillUnit(null); setShowLessonModal(true) }}
                          style={{ padding: '5px 10px', background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                        <button onClick={async () => {
                          if (!confirm('Delete this lesson?')) return
                          await deleteLMSContent(item.id)
                          const updated = { ...store, content: store.content.filter((_, j) => j !== realIdx) }
                          setStore(updated)
                        }} style={{ padding: '5px 8px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {(course?.announcement) && (
          <div style={{ background: '#FFF9F0', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
            📢 <strong>Announcement:</strong> {course.announcement}
          </div>
        )}
      </div>
    )
  }

  // ─── ASSIGN TAB ─────────────────────────────────────────────────────────────
  function renderAssign() {
    const enrolments = store.enrolments
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>👥 Assign Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{enrolments.length} active enrolment{enrolments.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setShowEnrolModal(true)}
            style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Assign Course
          </button>
        </div>
        {renderNav()}
        {!enrolments.length ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No assignments yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Assign courses to cohorts or individual students</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enrolments.map((en, idx) => {
              const course = store.courses.find(x => x.id === en.courseId)
              const enrolStart = en.assignedAt ? new Date(en.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
              const active = isActiveBool(en.active)
              return (
                <div key={en.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{course?.title || 'Unknown Course'}</div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                      {en.targetType === 'cohort' ? '🏫 Cohort: ' : '👤 Student: '}{en.targetValue}
                      {enrolStart ? ' · Start: ' + enrolStart : ''}
                      {en.dueDate ? ' · Due: ' + en.dueDate : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#059669' : '#94A3B8', background: active ? '#DCFCE7' : '#F1F5F9', padding: '2px 8px', borderRadius: 5 }}>{active ? 'Active' : 'Inactive'}</span>
                  <button onClick={async () => {
                    if (!confirm('Remove this assignment?')) return
                    await deleteLMSEnrolment(en.id)
                    const updated = { ...store, enrolments: store.enrolments.filter((_, i) => i !== idx) }
                    setStore(updated)
                  }} style={{ padding: '6px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── PROGRESS TAB ───────────────────────────────────────────────────────────
  function renderProgress() {
    const prog = store.progress
    const filtered = progFilterCourse ? prog.filter(p => p.courseId === progFilterCourse) : prog
    const grouped: Record<string, { studentId: string; courseId: string; items: LMSProgress[] }> = {}
    filtered.forEach(p => {
      const key = p.studentId + '_' + p.courseId
      if (!grouped[key]) grouped[key] = { studentId: p.studentId, courseId: p.courseId, items: [] }
      grouped[key].items.push(p)
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📈 LMS Progress Reports</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{prog.length} progress record{prog.length !== 1 ? 's' : ''}</div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <select value={progFilterCourse} onChange={e => setProgFilterCourse(e.target.value)} style={iStyle}>
            <option value="">All Courses</option>
            {store.courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
          </select>
        </div>
        {!Object.keys(grouped).length ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No progress data yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Progress appears here as students engage with LMS content</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(grouped).map(g => {
              const course = store.courses.find(x => x.id === g.courseId)
              const stu = students.find(s => s.id === g.studentId)
              const total = store.content.filter(x => x.courseId === g.courseId).length
              const completed = g.items.filter(p => p.status === 'completed').length
              const pct = total ? Math.round(completed / total * 100) : 0
              const pCol = pct >= 80 ? '#059669' : pct >= 40 ? '#D97706' : '#D61F31'
              const initials = stu ? (stu.firstName[0] || '') + (stu.lastName[0] || '') : g.studentId.substring(0, 2)
              return (
                <div key={g.studentId + '_' + g.courseId} style={{ ...card, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{stu ? stu.fullName : g.studentId}</div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>{course?.title || g.courseId}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: pCol }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>{completed}/{total} lessons</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 6, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: pCol, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── MANAGE TAB ─────────────────────────────────────────────────────────────
  function renderManage() {
    const allCourses = store.courses
    let filtered = allCourses.filter(co => manageTabFilter === 'active' ? co.status === 'Published' : co.status !== 'Published')
    if (manageSearch) {
      const q = manageSearch.toLowerCase()
      filtered = filtered.filter(co => co.title.toLowerCase().includes(q) || (co.subject || '').toLowerCase().includes(q))
    }
    if (manageTypeFilter) filtered = filtered.filter(co => co.subject === manageTypeFilter)
    const subjects = [...new Set(allCourses.map(co => co.subject).filter(Boolean))]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Manage Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Data as of {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', pointerEvents: 'none' }}>🔍</span>
              <input value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="Search Courses or Sections..." style={{ ...iStyle, paddingLeft: 28, paddingRight: manageSearch ? 28 : 10, width: 240 }} />
              {manageSearch && (
                <button onClick={() => setManageSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94A3B8', fontFamily: 'inherit' }}>✕</button>
              )}
            </div>
            <button onClick={() => navTab('courses')} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⊕ NEW SECTION</button>
          </div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E4EAF2' }}>
            {(['active', 'inactive'] as const).map(tab => (
              <button key={tab} onClick={() => setManageTabFilter(tab)}
                style={{ padding: '8px 18px', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: manageTabFilter === tab ? '#1A365E' : '#94A3B8', borderBottom: manageTabFilter === tab ? '2px solid #1A365E' : '2px solid transparent', marginBottom: -2, textTransform: 'capitalize', fontFamily: 'inherit' }}>
                {tab === 'active' ? 'Active Sections' : 'Inactive Sections'}
              </button>
            ))}
          </div>
          <select value={manageTypeFilter} onChange={e => setManageTypeFilter(e.target.value)} style={iStyle}>
            <option value="">All Course Types</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 80px', padding: '8px 16px', borderBottom: '1px solid #E4EAF2', gap: 8 }}>
            {['Course', 'Enrollments', 'Time on Task', 'Credits Earned', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>
          {!filtered.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{manageSearch ? 'No courses match your search' : 'No ' + manageTabFilter + ' courses'}</div>
            </div>
          ) : filtered.map((co, idx) => {
            const enrols = store.enrolments.filter(en => en.courseId === co.id && isActiveBool(en.active))
            const enrolledIds = new Set<string>()
            enrols.forEach(en => {
              if (en.targetType === 'student') enrolledIds.add(en.targetValue)
              else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
            })
            const enrollCount = enrolledIds.size
            const courseProg = store.progress.filter(p => p.courseId === co.id)
            const totalTimeMins = courseProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
            const content = store.content.filter(x => x.courseId === co.id)
            const creditsEarned = [...enrolledIds].reduce((sum, sid) => {
              const myProg = courseProg.filter(p => p.studentId === sid)
              const comp = myProg.filter(p => p.status === 'completed').length
              const pct = content.length ? Math.round(comp / content.length * 100) : 0
              return sum + (pct >= 100 ? (co.creditHours || 1) : 0)
            }, 0)
            const subjectCol = SUBJECT_COLORS[co.subject] || '#1A365E'
            const isExpanded = !!manageExpanded[co.id]
            const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
            const stuList = [...enrolledIds].map(sid => students.find(s => s.id === sid)).filter(Boolean) as Student[]
            return (
              <div key={co.id} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 80px', padding: '12px 16px', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setManageExpanded(prev => ({ ...prev, [co.id]: !prev[co.id] }))}
                      style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid #E4EAF2', background: '#F7F9FC', cursor: 'pointer', fontSize: 11, color: '#5A7290', flexShrink: 0, fontFamily: 'inherit' }}>
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: subjectCol + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 16 }}>📘</span></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{co.title}</div>
                      <div style={{ fontSize: 11, color: '#7A92B0' }}>{co.subject}{co.gradeLevel ? ' · ' + co.gradeLevel : ''} · <span style={{ background: '#EEF3FF', color: '#1A365E', fontWeight: 800, padding: '1px 7px', borderRadius: 10, fontSize: 10 }}>👥 {enrollCount} enrolled</span></div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>{enrollCount > 0 ? <div style={{ fontSize: 20, fontWeight: 900, color: '#1A365E' }}>{enrollCount}</div> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ textAlign: 'center' }}>{totalTimeMins > 0 ? <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{fmtTime(totalTimeMins)}</div> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ textAlign: 'center' }}>{enrollCount > 0 ? <><div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>{creditsEarned}</div><div style={{ fontSize: 9, color: '#7A92B0' }}>of {co.creditHours || 1} cr per student</div></> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setGbCourseId(co.id); setSectionCourseId(co.id); navTab('section') }}
                      title="View Section" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #E4EAF2', background: '#EEF3FF', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>📊</button>
                    <button onClick={() => { setActiveCourseId(co.id); navTab('content') }}
                      title="Manage Content" style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #E4EAF2', background: '#F7F9FC', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>📝</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ background: '#F7F9FC', borderTop: '1px solid #E4EAF2', padding: '0 16px 12px 56px' }}>
                    {!stuList.length ? (
                      <div style={{ padding: '12px 0', fontSize: 12, color: '#94A3B8' }}>No students enrolled in this course.</div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 80px', gap: 8, padding: '8px 0 6px 0', borderBottom: '1px solid #E4EAF2', marginBottom: 4 }}>
                          {['Student', 'Progress', 'Time on Task', 'Avg Mastery', 'Credits'].map(hd => (
                            <div key={hd} style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.7px' }}>{hd}</div>
                          ))}
                        </div>
                        {stuList.map(stu => {
                          const sid = stu.id
                          const myProg = store.progress.filter(p => p.courseId === co.id && p.studentId === sid)
                          const comp = myProg.filter(p => p.status === 'completed').length
                          const pct = content.length ? Math.round(comp / content.length * 100) : 0
                          const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
                          const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
                          const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
                          const credEarned = pct >= 100 ? (co.creditHours || 1) : 0
                          const pCol = pct >= 100 ? '#059669' : pct > 0 ? '#D97706' : '#94A3B8'
                          const mCol = avgMastery !== null ? (avgMastery >= (co.passMark || 80) ? '#059669' : '#D61F31') : '#94A3B8'
                          return (
                            <div key={sid} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 100px 80px', gap: 8, padding: '7px 0', borderBottom: '1px solid #F0F4FA', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{(stu.firstName[0] || '?')}{(stu.lastName[0] || '?')}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{stu.lastName}{stu.firstName ? ', ' + stu.firstName : ''}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: pCol, fontWeight: 700, marginBottom: 3 }}>{pct}%</div>
                                <div style={{ height: 5, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: pCol, borderRadius: 3 }} /></div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{fmtTime(timeMins)}</div>
                              <div style={{ textAlign: 'center' }}>{avgMastery !== null ? <span style={{ fontSize: 12, fontWeight: 900, color: mCol }}>{avgMastery}%</span> : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>}</div>
                              <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 900, color: credEarned > 0 ? '#059669' : '#94A3B8' }}>{credEarned}</div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── GRADEBOOK TAB ──────────────────────────────────────────────────────────
  function renderGradebook() {
    const allCourses = store.courses.filter(co => co.status === 'Published' || co.status === 'Draft')
    const subjects = [...new Set(allCourses.map(co => co.subject).filter(Boolean))]
    const courses = gbSubjectFilter ? allCourses.filter(co => co.subject === gbSubjectFilter) : allCourses
    const cid = (courses.find(co => co.id === gbCourseId) ? gbCourseId : '') || (courses[0]?.id ?? '')
    const course = courses.find(co => co.id === cid) || courses[0]
    if (!course) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>📊 Gradebook</div>
        {renderNav()}
        <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No courses yet.</div>
      </div>
    )
    const content = store.content.filter(x => x.courseId === course.id)
      .sort((a, b) => ((a.unitOrder ?? 0) - (b.unitOrder ?? 0)) || ((a.order ?? 0) - (b.order ?? 0)))
    const enrolments = store.enrolments.filter(en => en.courseId === course.id && isActiveBool(en.active))
    const enrolledIds = new Set<string>()
    enrolments.forEach(en => {
      if (en.targetType === 'student') enrolledIds.add(en.targetValue)
      else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
    })
    const enrolled = students.filter(s => enrolledIds.has(s.id)).sort((a, b) => a.lastName.localeCompare(b.lastName))
    const allProg = store.progress
    const passMark = course.passMark || 80
    const creditHours = course.creditHours || 1
    const enrol0 = enrolments[0] || {}

    // Stats
    let ahead = 0, onP = 0, off = 0, done = 0, needsScoring = 0, atRisk = 0
    enrolled.forEach(s => {
      const sid = s.id
      const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
      const comp = myProg.filter(p => p.status === 'completed').length
      const pct = content.length ? Math.round(comp / content.length * 100) : 0
      if (pct === 100) { done++; return }
      if (enrol0.assignedAt && enrol0.dueDate) {
        const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
        const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
        const diff = pct - expPct
        if (diff >= 10) ahead++; else if (diff >= -10) onP++; else off++
      }
      content.forEach(item => {
        if (!hasAssignBool(item.hasAssignment)) return
        const p = myProg.find(pp => pp.contentId === item.id)
        if (p && p.assignStatus === 'submitted' && (p.assignScore == null || isNaN(Number(p.assignScore)))) needsScoring++
      })
      const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
      const avgM = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
      if (pct < 50 && enrol0.assignedAt && enrol0.dueDate) {
        const _n = Date.now(), _s = new Date(enrol0.assignedAt).getTime(), _e = new Date(enrol0.dueDate).getTime()
        if (_e > _s && pct < Math.min(100, Math.round((_n - _s) / (_e - _s) * 100)) - 10) atRisk++
      }
      if (avgM !== null && avgM < passMark && mastRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0) atRisk++
    })

    const unitGroups: string[] = []
    const unitMap: Record<string, LMSContent[]> = {}
    content.forEach(item => {
      const ut = item.unitTitle || 'Lessons'
      if (!unitMap[ut]) { unitMap[ut] = []; unitGroups.push(ut) }
      unitMap[ut].push(item)
    })

    const exportCSV = () => {
      const hdr = ['Student', 'Grade', 'Cohort', 'Completion %', 'Avg Mastery %', 'Avg Assignment %', 'Composite %', 'Time (mins)', 'Credits', 'At Risk', ...content.map(c => c.title + ' (Composite)')]
      const rows = enrolled.map(s => {
        const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === s.id)
        const comp = myProg.filter(p => p.status === 'completed').length
        const pctV = content.length ? Math.round(comp / content.length * 100) : 0
        const mRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
        const aRows = myProg.filter(p => p.assignScore != null && !isNaN(Number(p.assignScore)))
        const avgM = mRows.length ? Math.round(mRows.reduce((acc, p) => acc + Number(p.masteryScore), 0) / mRows.length) : null
        const avgA = aRows.length ? Math.round(aRows.reduce((acc, p) => acc + Number(p.assignScore), 0) / aRows.length) : null
        const compV = lmsCourseComposite(myProg, content, passMark)
        const timeMins = Math.round(myProg.reduce((acc, p) => acc + (p.timeSpentMins || 0), 0))
        const cred = (pctV >= 100 && (avgM === null || avgM >= passMark)) ? creditHours : 0
        let atRisk = 'No'
        if (pctV < 50 && enrol0.assignedAt && enrol0.dueDate) {
          const _n = Date.now(), _s = new Date(enrol0.assignedAt).getTime(), _e = new Date(enrol0.dueDate).getTime()
          if (_e > _s && pctV < Math.min(100, Math.round((_n - _s) / (_e - _s) * 100)) - 10) atRisk = 'Yes'
        }
        if (avgM !== null && avgM < passMark && mRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0) atRisk = 'Yes'
        const lessonCells = content.map(item => { const p = myProg.find(pp => pp.contentId === item.id); const cs = p ? lmsCompositeScore(p, item, passMark) : null; return cs !== null ? cs + '%' : '' })
        return [s.lastName + ', ' + s.firstName, s.grade || '', s.cohort || '', pctV + '%', avgM !== null ? avgM + '%' : '', avgA !== null ? avgA + '%' : '', compV !== null ? compV + '%' : '', timeMins, cred, atRisk, ...lessonCells].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
      })
      const csv = [hdr.map(v => '"' + v.replace(/"/g, '""') + '"').join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'Gradebook_' + (course.title || 'export').replace(/[^a-z0-9]/gi, '_') + '_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); URL.revokeObjectURL(url)
    }

    const openScoreModal = (studentId: string, contentId: string, currentScore: string, lessonTitle: string) => {
      const lessonItem = store.content.find(x => x.id === contentId)
      const progRec = store.progress.find(p => p.studentId === studentId && p.contentId === contentId)
      setScoreModal({
        studentId, contentId, courseId: course.id, currentScore, lessonTitle,
        maxScore: lessonItem?.assignMaxScore || 100,
        instructions: lessonItem?.assignInstructions || '',
        submNote: ((progRec as unknown) as Record<string, unknown>)?.assignNote as string || '',
        submLink: ((progRec as unknown) as Record<string, unknown>)?.assignLink as string || '',
      })
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>📊 Gradebook</div>
            {course && <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{course.title} · {course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''} · Pass: {course.passMark || 80}%</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {subjects.length > 1 && (
              <select value={gbSubjectFilter} onChange={e => { setGbSubjectFilter(e.target.value); setGbCourseId('') }} style={iStyle}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {courses.length > 1 && (
              <select value={cid} onChange={e => setGbCourseId(e.target.value)} style={iStyle}>
                {courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
              </select>
            )}
            <button onClick={() => navTab('section')} style={{ padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Section View</button>
            <button onClick={exportCSV} style={{ padding: '7px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Export CSV</button>
          </div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ icon: '👥', label: 'All', val: enrolled.length, col: '#1A365E', bg: '#EEF3FF' }, { icon: '✅', label: 'Done', val: done, col: '#059669', bg: '#DCFCE7' }, { icon: '🏃', label: 'Ahead', val: ahead, col: '#059669', bg: '#D1FAE5' }, { icon: '🚶', label: 'On Pace', val: onP, col: '#D97706', bg: '#FEF3C7' }, { icon: '⚠️', label: 'Behind', val: off, col: '#D61F31', bg: '#FEE2E2' }, { icon: '📋', label: 'To Score', val: needsScoring, col: '#7C3AED', bg: '#EDE9FE' }, { icon: '🚨', label: 'At Risk', val: atRisk, col: '#D61F31', bg: '#FFF0F0' }].map(st => (
            <div key={st.label} style={{ padding: '10px 14px', background: st.bg, borderRadius: 10, textAlign: 'center', minWidth: 76 }}>
              <div style={{ fontSize: 16 }}>{st.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: st.col }}>{st.val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: st.col, textTransform: 'uppercase' }}>{st.label}</div>
            </div>
          ))}
        </div>
        {(!content.length || !enrolled.length) ? (
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>{!content.length ? 'No lessons yet.' : 'No students enrolled.'}</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #E4EAF2', borderRadius: 13, background: '#fff', boxShadow: '0 2px 8px rgba(26,54,94,.06)' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F0F4FA' }}>
                  {[{ l: 'Student', w: '200px' }, { l: 'On-Target', w: '80px' }, { l: 'Mastery Grade', w: '90px' }, { l: 'Assign Grade', w: '90px' }, { l: '⭐ Composite', w: '90px' }, { l: 'Course %', w: '80px' }, { l: 'Time', w: '76px' }, { l: 'Credits', w: '66px' }].map((fh, i) => (
                    <th key={fh.l} rowSpan={2} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: `8px ${i === 0 ? '14' : '8'}px`, textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 800, color: '#1A365E', borderBottom: '2px solid #E4EAF2', borderRight: i === 7 ? '2px solid #D0D7E4' : '1px solid #E4EAF2', whiteSpace: 'nowrap', minWidth: fh.w }}>{fh.l}</th>
                  ))}
                  {unitGroups.map(ut => (
                    <th key={ut} colSpan={unitMap[ut].length} style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#1A365E', borderBottom: '1px solid #E4EAF2', borderLeft: '2px solid #D0D7E4', background: '#F7F9FC', whiteSpace: 'nowrap' }}>📂 {ut.substring(0, 28)}{ut.length > 28 ? '…' : ''}</th>
                  ))}
                </tr>
                <tr style={{ background: '#F7F9FC' }}>
                  {content.map((item, ci) => {
                    const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #E4EAF2'
                    return (
                      <th key={item.id} style={{ padding: '4px 3px', textAlign: 'center', borderBottom: '2px solid #E4EAF2', borderLeft: borderL, width: 56, verticalAlign: 'bottom' }}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9.5, fontWeight: 600, color: '#3D5475', maxHeight: 100, overflow: 'hidden', padding: '3px 1px', lineHeight: 1.3 }} title={item.title}>{item.title.substring(0, 35)}</div>
                        <div style={{ fontSize: 11, marginTop: 3 }}>{TYPE_ICONS[item.type] || '📄'}</div>
                        {hasMasteryBool(item.hasMastery) && <div style={{ fontSize: 8, color: '#059669', fontWeight: 800 }}>🎯</div>}
                        {hasAssignBool(item.hasAssignment) && <div style={{ fontSize: 8, color: '#1A365E', fontWeight: 800 }}>📋</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {enrolled.map((s, rowIdx) => {
                  const sid = s.id
                  const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
                  const comp = myProg.filter(p => p.status === 'completed').length
                  const pct = content.length ? Math.round(comp / content.length * 100) : 0
                  const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
                  const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
                  const assignRows = myProg.filter(p => p.assignScore != null && !isNaN(Number(p.assignScore)))
                  const avgAssign = assignRows.length ? Math.round(assignRows.reduce((s, p) => s + Number(p.assignScore), 0) / assignRows.length) : null
                  const composite = lmsCourseComposite(myProg, content, passMark)
                  const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
                  const credEarned = pct >= 100 && (avgMastery === null || avgMastery >= passMark) ? creditHours : 0
                  let paceLabel = '—'; let paceCol = '#94A3B8'
                  if (pct === 100) { paceLabel = '✅ Done'; paceCol = '#059669' }
                  else if (enrol0.assignedAt && enrol0.dueDate) {
                    const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
                    const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
                    const diff = pct - expPct
                    if (diff >= 10) { paceLabel = '🏃 Ahead'; paceCol = '#059669' } else if (diff >= -10) { paceLabel = '🚶 On Pace'; paceCol = '#D97706' } else { paceLabel = '⚠️ Behind'; paceCol = '#D61F31' }
                  }
                  const _atRisk = pct < 50 && enrol0.assignedAt && enrol0.dueDate
                    ? (() => { const _n = Date.now(), _s0 = new Date(enrol0.assignedAt).getTime(), _e0 = new Date(enrol0.dueDate).getTime(); return _e0 > _s0 && pct < Math.min(100, Math.round((_n - _s0) / (_e0 - _s0) * 100)) - 10 })()
                    : (avgMastery !== null && avgMastery < passMark && mastRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0)
                  const rowBg = rowIdx % 2 === 0 ? '#fff' : '#FAFBFF'
                  const mCol = avgMastery !== null ? (avgMastery >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const aCol = avgAssign !== null ? (avgAssign >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const ccCol = composite !== null ? (composite >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const crsCol = pct >= passMark ? '#059669' : pct > 0 ? '#D97706' : '#94A3B8'
                  const sticky: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: rowBg }
                  return (
                    <tr key={sid} style={{ background: rowBg }}>
                      <td style={{ ...sticky, padding: '9px 14px', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{(s.firstName[0] || '?')}{(s.lastName[0] || '?')}</div>
                          <div>
                            <div onClick={() => navigate(`/lms/student?sid=${s.id}&cid=${cid}`)} style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', cursor: 'pointer', textDecoration: 'underline' }}>{s.lastName}, {s.firstName}</div>
                            <div style={{ fontSize: 9, color: '#7A92B0' }}>{s.grade}{s.cohort ? ' · ' + s.cohort : ''}</div>
                            {_atRisk && <div style={{ marginTop: 3 }}><span style={{ fontSize: 9, fontWeight: 800, color: '#D61F31', background: '#FEE2E2', padding: '2px 7px', borderRadius: 4 }}>⚠️ At Risk</span></div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', fontSize: 10, fontWeight: 700, color: paceCol }}>{paceLabel}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>{avgMastery !== null ? <><div style={{ fontSize: 13, fontWeight: 900, color: mCol }}>{avgMastery}%</div><div style={{ fontSize: 9, fontWeight: 700, color: mCol }}>{gradeLabel(avgMastery)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>{avgAssign !== null ? <><div style={{ fontSize: 13, fontWeight: 900, color: aCol }}>{avgAssign}%</div><div style={{ fontSize: 9, fontWeight: 700, color: aCol }}>{gradeLabel(avgAssign)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, background: composite !== null ? (composite >= passMark ? '#F0FDF4' : '#FFF9F9') : rowBg, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '2px solid #D0D7E4' }}>{composite !== null ? <><div style={{ fontSize: 14, fontWeight: 900, color: ccCol }}>{composite}%</div><div style={{ fontSize: 9, fontWeight: 800, color: ccCol }}>{gradeLabel(composite)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: crsCol }}>{pct}%</div>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 44, marginInline: 'auto' }}><div style={{ height: '100%', width: pct + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{fmtTime(timeMins)}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '2px solid #D0D7E4', fontSize: 14, fontWeight: 900, color: credEarned > 0 ? '#059669' : '#94A3B8' }}>{credEarned}</td>
                      {content.map((item, ci) => {
                        const prog = myProg.find(p => p.contentId === item.id)
                        const status = prog?.status || 'not_started'
                        const hm = hasMasteryBool(item.hasMastery)
                        const ha = hasAssignBool(item.hasAssignment)
                        const ms = prog && prog.masteryScore != null && !isNaN(Number(prog.masteryScore)) ? Number(prog.masteryScore) : null
                        const as_ = prog && prog.assignScore != null && !isNaN(Number(prog.assignScore)) ? Number(prog.assignScore) : null
                        const cs = lmsCompositeScore(prog, item, passMark)
                        const assignSt = prog?.assignStatus || ''
                        const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #F0F4FA'
                        return (
                          <td key={item.id} onClick={ha && status !== 'not_started' ? (e) => { e.stopPropagation(); openScoreModal(sid, item.id, String(as_ ?? ''), item.title) } : undefined} style={{ padding: '5px 3px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderLeft: borderL, width: 56, cursor: ha && status !== 'not_started' ? 'pointer' : 'default' }} title={ha ? 'Click to score assignment' : ''}>
                            {status === 'not_started' ? <span style={{ color: '#D0D7E4', fontSize: 13 }}>—</span>
                              : status === 'in_progress' ? <div style={{ background: '#FEF3C7', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#D97706' }}>⏳</div></div>
                              : ha && cs !== null ? (
                                <div style={{ background: cs >= passMark ? '#DCFCE7' : '#FEE2E2', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}>
                                  <div style={{ fontSize: 11, fontWeight: 900, color: cs >= passMark ? '#059669' : '#D61F31' }}>{cs}</div>
                                  {ms !== null && <div style={{ fontSize: 8, color: cs >= passMark ? '#059669' : '#D61F31', opacity: .8 }}>M:{ms}</div>}
                                  {as_ !== null ? <div style={{ fontSize: 8, color: cs >= passMark ? '#059669' : '#D61F31', opacity: .8 }}>A:{as_}</div>
                                    : assignSt === 'submitted' ? <div style={{ fontSize: 8, fontWeight: 700, color: '#7C3AED' }}>📋⏳</div>
                                    : <div style={{ fontSize: 8, color: '#94A3B8' }}>📋+</div>}
                                </div>
                              ) : hm && ms !== null ? (
                                <div style={{ background: prog?.masteryPassed === true || prog?.masteryPassed === 'TRUE' ? '#DCFCE7' : '#FEE2E2', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}>
                                  <div style={{ fontSize: 12, fontWeight: 900, color: prog?.masteryPassed === true || prog?.masteryPassed === 'TRUE' ? '#059669' : '#D61F31' }}>{ms}</div>
                                  {ha && <div style={{ fontSize: 8, fontWeight: 700, color: assignSt === 'submitted' ? '#7C3AED' : '#94A3B8' }}>{assignSt === 'submitted' ? '📋⏳' : '📋+'}</div>}
                                </div>
                              ) : <div style={{ background: '#DCFCE7', borderRadius: 5, padding: '4px 5px', display: 'inline-block' }}><div style={{ fontSize: 13, color: '#059669' }}>✓</div></div>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F0F4FA' }}>
                  <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '8px 14px', fontSize: 10, fontWeight: 800, color: '#1A365E', borderTop: '2px solid #E4EAF2' }}>CLASS AVERAGES</td>
                  {(() => {
                    let totM = 0, cntM = 0, totA = 0, cntA = 0, totC = 0, cntC = 0
                    enrolled.forEach(s => {
                      const sid = s.id
                      const mr = allProg.filter(p => p.courseId === course.id && p.studentId === sid && p.masteryScore != null && !isNaN(Number(p.masteryScore)))
                      if (mr.length) { totM += Math.round(mr.reduce((s, p) => s + Number(p.masteryScore), 0) / mr.length); cntM++ }
                      const ar = allProg.filter(p => p.courseId === course.id && p.studentId === sid && p.assignScore != null && !isNaN(Number(p.assignScore)))
                      if (ar.length) { totA += Math.round(ar.reduce((s, p) => s + Number(p.assignScore), 0) / ar.length); cntA++ }
                      const myP = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
                      const cv = lmsCourseComposite(myP, content, passMark)
                      if (cv !== null) { totC += cv; cntC++ }
                    })
                    const avgComp = cntC ? Math.round(totC / cntC) : null
                    return <>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 12, fontWeight: 900, color: '#1A365E' }}>{cntM ? Math.round(totM / cntM) + '%' : '—'}</td>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 12, fontWeight: 900, color: '#1A365E' }}>{cntA ? Math.round(totA / cntA) + '%' : '—'}</td>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 13, fontWeight: 900, color: avgComp !== null && avgComp >= passMark ? '#059669' : '#94A3B8' }}>{avgComp !== null ? avgComp + '%' : '—'}</td>
                      <td colSpan={4} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', borderTop: '2px solid #E4EAF2' }} />
                    </>
                  })()}
                  {content.map((item, ci) => {
                    const lessonProgs = allProg.filter(p => p.courseId === course.id && p.contentId === item.id)
                    const csArr = lessonProgs.map(p => lmsCompositeScore(p, item, passMark)).filter(v => v !== null) as number[]
                    const avgCS = csArr.length ? Math.round(csArr.reduce((s, v) => s + v, 0) / csArr.length) : null
                    const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #E4EAF2'
                    return <td key={item.id} style={{ padding: '7px 3px', textAlign: 'center', borderTop: '2px solid #E4EAF2', borderLeft: borderL, fontSize: 11, fontWeight: 900, color: avgCS !== null ? (avgCS >= passMark ? '#059669' : '#D61F31') : '#94A3B8' }}>{avgCS !== null ? avgCS + '%' : '—'}</td>
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: '#F7F9FC', borderRadius: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', alignSelf: 'center' }}>LEGEND:</span>
          {[{ bg: '#DCFCE7', col: '#059669', l: `Pass (≥${passMark}%)` }, { bg: '#FEE2E2', col: '#D61F31', l: `Fail (<${passMark}%)` }, { bg: '#FEF3C7', col: '#D97706', l: 'In Progress' }, { bg: '#F0F4FA', col: '#94A3B8', l: 'Not Started' }].map(lg => (
            <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: lg.bg }} />
              <span style={{ fontSize: 10, color: '#3D5475' }}>{lg.l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10 }}>🎯 Mastery</span>
            <span style={{ fontSize: 10 }}>📋 Assignment</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>⭐ = Composite</span>
          </div>
          <div style={{ fontSize: 10, color: '#7A92B0' }}>Click any assignment cell to score</div>
        </div>

        {/* Course Discussion Board */}
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Course Discussion Board <span style={{ fontSize: 10, color: '#7A92B0', fontWeight: 400 }}>{course.title}</span></div>
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Share your thoughts or ask a question</div>
            <textarea rows={3} placeholder="What's on your mind about this course?" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Peer reviews and questions welcome 👋</span>
              <button style={{ padding: '7px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🚀 Post</button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 10, color: '#94A3B8', fontSize: 12 }}>No posts yet. Start the discussion! 🎯</div>
        </div>
      </div>
    )
  }

  // ─── SECTION TAB ────────────────────────────────────────────────────────────
  function renderSection() {
    const courses = store.courses.filter(co => co.status === 'Published' || co.status === 'Draft')
    if (!courses.length) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {renderNav()}
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No courses yet.</div>
      </div>
    )
    const cid = sectionCourseId || courses[0].id
    const course = courses.find(co => co.id === cid) || courses[0]
    const content = store.content.filter(x => x.courseId === course.id)
    const allProg = store.progress
    const enrolRows = store.enrolments.filter(en => en.courseId === course.id && isActiveBool(en.active))
    const enrolledIds = new Set<string>()
    enrolRows.forEach(en => {
      if (en.targetType === 'student') enrolledIds.add(en.targetValue)
      else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
    })
    const enrolled = students.filter(s => enrolledIds.has(s.id)).sort((a, b) => a.lastName.localeCompare(b.lastName))
    const total = enrolled.length
    const passMark = course.passMark || 80
    const enrol0 = enrolRows[0] || {}
    const subjectCol = SUBJECT_COLORS[course.subject] || '#0F5699'

    interface StuStat {
      sid: string; pct: number; avgMastery: number | null; timeMins: number
      paceKey: string; paceLabel: string; paceIcon: string; paceColor: string
      comp: number; total: number; lockedCount: number; readyToScore: number; onTargetGrade: number
    }
    function calcStats(s: Student): StuStat {
      const sid = s.id
      const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
      const comp = myProg.filter(p => p.status === 'completed').length
      const pct = content.length ? Math.round(comp / content.length * 100) : 0
      const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
      const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
      const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
      let paceKey = 'none', paceLabel = '—', paceIcon = '—', paceColor = '#94A3B8'
      if (pct === 100) { paceKey = 'done'; paceLabel = 'Done'; paceIcon = '✅'; paceColor = '#059669' }
      else if (enrol0.assignedAt && enrol0.dueDate) {
        const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
        const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
        const diff = pct - expPct
        if (diff >= 15) { paceKey = 'ahead'; paceLabel = 'Ahead of Pace'; paceIcon = '🏃'; paceColor = '#059669' }
        else if (diff >= 5) { paceKey = 'onpace'; paceLabel = 'On Pace'; paceIcon = '🚶'; paceColor = '#16A34A' }
        else if (diff >= -10) { paceKey = 'slightlyoff'; paceLabel = 'Slightly Off Pace'; paceIcon = '🚶'; paceColor = '#D97706' }
        else { paceKey = 'off'; paceLabel = 'Off Pace'; paceIcon = '🏃'; paceColor = '#D61F31' }
      }
      const lockedCount = myProg.filter(p => {
        const it = content.find(x => x.id === p.contentId)
        if (!it || !hasMasteryBool(it.hasMastery)) return false
        const maxR = it.masteryRetakes || 3
        return (p.masteryAttempts || 0) >= maxR && p.masteryPassed !== true && p.masteryPassed !== 'TRUE'
      }).length
      const readyToScore = myProg.filter(p => {
        const it = content.find(x => x.id === p.contentId)
        return it && it.type === 'quiz' && p.status === 'completed' && (p.masteryScore == null)
      }).length
      const onTargetGrade = enrol0.assignedAt && enrol0.dueDate
        ? Math.min(100, Math.round((Date.now() - new Date(enrol0.assignedAt).getTime()) / (new Date(enrol0.dueDate).getTime() - new Date(enrol0.assignedAt).getTime()) * 100))
        : pct
      return { sid, pct, avgMastery, timeMins, paceKey, paceLabel, paceIcon, paceColor, comp, total: content.length, lockedCount, readyToScore, onTargetGrade }
    }

    const stuStats = enrolled.map(s => ({ s, stat: calcStats(s) }))
    const buckets = { all: total, off: 0, slightlyoff: 0, onpace: 0, ahead: 0, locked: 0, readyToScore: 0 }
    stuStats.forEach(x => {
      const pk = x.stat.paceKey
      if (pk === 'off') buckets.off++
      else if (pk === 'slightlyoff') buckets.slightlyoff++
      else if (pk === 'onpace' || pk === 'done') buckets.onpace++
      else if (pk === 'ahead') buckets.ahead++
      buckets.locked += x.stat.lockedCount
      buckets.readyToScore += x.stat.readyToScore
    })

    let filtered = stuStats
    if (sectionFilter !== 'all') {
      filtered = stuStats.filter(x => {
        if (sectionFilter === 'off') return x.stat.paceKey === 'off'
        if (sectionFilter === 'slightlyoff') return x.stat.paceKey === 'slightlyoff'
        if (sectionFilter === 'onpace') return x.stat.paceKey === 'onpace' || x.stat.paceKey === 'done'
        if (sectionFilter === 'ahead') return x.stat.paceKey === 'ahead'
        if (sectionFilter === 'locked') return false // lockedNoAttempts — not yet computed
        if (sectionFilter === 'lockedRetakes') return x.stat.lockedCount > 0
        if (sectionFilter === 'readytoscore') return x.stat.readyToScore > 0
        return true
      })
    }

    const pills = [
      { k: 'all', label: 'All Students', icon: '👥', col: '#1A365E', bg: '#EEF3FF', count: buckets.all },
      { k: 'off', label: 'Off Pace', icon: '🏃', col: '#D61F31', bg: '#FEE2E2', count: buckets.off },
      { k: 'slightlyoff', label: 'Slightly Off Pace', icon: '🚶', col: '#D97706', bg: '#FEF3C7', count: buckets.slightlyoff },
      { k: 'onpace', label: 'On Pace', icon: '🚶', col: '#16A34A', bg: '#DCFCE7', count: buckets.onpace },
      { k: 'ahead', label: 'Ahead of Pace', icon: '🏃', col: '#059669', bg: '#D1FAE5', count: buckets.ahead },
      { k: 'locked', label: 'Locked (No Attempts)', icon: '🔐', col: '#9333EA', bg: '#F3E8FF', count: 0 },
      { k: 'lockedRetakes', label: 'Locked', icon: '🔒', col: '#6B7280', bg: '#F1F5F9', count: buckets.locked },
      { k: 'readytoscore', label: 'Ready to Score', icon: '⏰', col: '#DC2626', bg: '#FEF2F2', count: buckets.readyToScore },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Course header banner */}
        <div style={{ background: `linear-gradient(135deg,${subjectCol},${subjectCol}CC)`, borderRadius: 14, padding: '16px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 32 }}>📘</span></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.75)', marginBottom: 2 }}>{course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{course.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>{total} student{total !== 1 ? 's' : ''}{enrol0.dueDate ? ' · End Date: ' + enrol0.dueDate.substring(0, 10) : ''}</div>
          </div>
          {courses.length > 1 && (
            <select value={cid} onChange={e => setSectionCourseId(e.target.value)} style={{ padding: '7px 12px', border: 'none', borderRadius: 9, fontSize: 12, color: '#1A365E', fontWeight: 600, fontFamily: 'inherit' }}>
              {courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
            </select>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>End Date</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{enrol0.dueDate ? enrol0.dueDate.substring(0, 10) : '—'}</div>
          </div>
        </div>

        {/* Tab bar + NAV */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 0, background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
            {([{ k: 'gradebook', l: '📊 GRADEBOOK' }, { k: 'curriculum', l: '🔍 CURRICULUM' }] as const).map(tab => {
              const a = sectionStudentTab === tab.k
              return <button key={tab.k} onClick={() => setSectionStudentTab(tab.k)} style={{ padding: '9px 18px', border: 'none', background: a ? '#1A365E' : 'transparent', color: a ? '#fff' : '#5A7290', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '.5px', fontFamily: 'inherit' }}>{tab.l}</button>
            })}
          </div>
          {renderNav()}
        </div>

        {/* Pace filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {pills.map(p => {
            const a = sectionFilter === p.k
            return (
              <button key={p.k} onClick={() => setSectionFilter(p.k)}
                style={{ padding: '12px 16px', borderRadius: 12, border: `2px solid ${a ? p.col : 'transparent'}`, background: a ? p.bg : '#fff', cursor: 'pointer', textAlign: 'center', minWidth: 90, boxShadow: '0 1px 4px rgba(0,0,0,.08)', flexShrink: 0, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: p.col, lineHeight: 1 }}>{p.count}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: p.col, textTransform: 'uppercase', letterSpacing: '.3px', marginTop: 3, lineHeight: 1.2, maxWidth: 80 }}>{p.label}</div>
              </button>
            )
          })}
        </div>

        {/* Student table */}
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #E4EAF2', background: '#FAFBFF' }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{course.title}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '2px solid #E4EAF2' }}>
                  <th style={{ width: 36, padding: '10px 8px', textAlign: 'center' }}></th>
                  <th style={{ width: 40, padding: '10px 6px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>PACE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>STUDENT ▾</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>ON-TARGET GRADE ⓘ</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>CURRENT GRADE ⓘ</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>COURSE GRADE ⓘ</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>ACTIVITIES COMPLETED</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>TIME ON TASK</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>TASKS</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>No students match this filter.</td></tr>
                ) : filtered.map(({ s, stat }, idx) => {
                  const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
                  const onTgtCol = stat.onTargetGrade >= passMark ? '#059669' : '#D61F31'
                  const curMCol = stat.avgMastery !== null ? (stat.avgMastery >= passMark ? '#059669' : '#D61F31') : '#7A92B0'
                  const crsCol = stat.pct >= passMark ? '#059669' : stat.pct > 0 ? '#D97706' : '#94A3B8'
                  const hasCourseAssign = content.some(it => hasAssignBool(it.hasAssignment))
                  const compSec = hasCourseAssign ? lmsCourseComposite(allProg.filter(p => p.courseId === course.id && p.studentId === stat.sid), content, passMark) : null
                  return (
                    <tr key={stat.sid} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}><span style={{ fontSize: 16 }} title={stat.paceLabel}>{stat.paceIcon}</span></td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{s.lastName}, {s.firstName}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0' }}>{s.grade}{s.cohort ? ' · ' + s.cohort : ''}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: onTgtCol }}>{stat.onTargetGrade}%</span>{' '}
                        <span style={{ fontSize: 10, color: onTgtCol }}>({gradeLabel(stat.onTargetGrade)})</span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {compSec !== null ? <><span style={{ fontSize: 12, fontWeight: 800, color: compSec >= passMark ? '#059669' : '#D61F31' }}>⭐{compSec}%</span>{' '}<span style={{ fontSize: 10, color: compSec >= passMark ? '#059669' : '#D61F31' }}>({gradeLabel(compSec)})</span></>
                          : stat.avgMastery !== null ? <><span style={{ fontSize: 12, fontWeight: 700, color: curMCol }}>{stat.avgMastery}%</span>{' '}<span style={{ fontSize: 10, color: curMCol }}>({gradeLabel(stat.avgMastery)})</span></>
                          : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: crsCol }}>{stat.pct}%</span>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 50, marginInline: 'auto' }}><div style={{ height: '100%', width: stat.pct + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#1A365E' }}>{stat.comp} / {stat.total} completed</div>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 80 }}><div style={{ height: '100%', width: (stat.total ? stat.pct : 0) + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{fmtTime(stat.timeMins)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {(() => {
                          const taskCount = stat.readyToScore + stat.lockedCount
                          return taskCount > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 14 }}>⏰</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: '#D61F31' }}>{taskCount}</span>
                            </div>
                          ) : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
                        })()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8', fontFamily: 'inherit' }}>•••</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── COURSE MODAL ───────────────────────────────────────────────────────────
  function CourseModal() {
    const course = editCourseIdx !== null ? store.courses[editCourseIdx] : undefined
    const isNew = editCourseIdx === null
    const [title, setTitle] = useState(course?.title ?? '')
    const [subject, setSubject] = useState(course?.subject ?? SUBJECTS[0])
    const [gradeLevel, setGradeLevel] = useState(course?.gradeLevel ?? GRADE_LEVELS[0])
    const [description, setDescription] = useState(course?.description ?? '')
    const [passMark, setPassMark] = useState(String(course?.passMark ?? 80))
    const [creditHours, setCreditHours] = useState(String(course?.creditHours ?? 1))
    const [requiredHours, setRequiredHours] = useState(String(course?.requiredHours ?? ''))
    const [status, setStatus] = useState<'Draft' | 'Published'>(course?.status ?? 'Draft')
    const [announcement, setAnnouncement] = useState(course?.announcement ?? '')
    const save = () => {
      if (!title.trim()) { alert('Title is required'); return }
      const obj: LMSCourse = {
        id: course?.id ?? lmsId(),
        title: title.trim(), subject, gradeLevel, description: description.trim(),
        passMark: parseInt(passMark) || 80,
        creditHours: parseFloat(creditHours) || 1,
        requiredHours: parseFloat(requiredHours) || 0,
        status, announcement: announcement.trim(),
        createdBy: 'Admin',
        createdAt: course?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      const courses = [...store.courses]
      if (isNew) courses.push(obj); else courses[editCourseIdx!] = obj
      persist({ ...store, courses })
      setShowCourseModal(false)
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowCourseModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📘 {isNew ? 'New Course' : 'Edit Course'}</div>
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Course Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Entrepreneurship" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Subject</label><select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={labelStyle}>Grade Level</label><select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} style={selectStyle}>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></div>
            </div>
            <div><label style={labelStyle}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What will students learn in this course?" style={taStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Pass Mark (%)</label><input value={passMark} onChange={e => setPassMark(e.target.value)} type="number" min={1} max={100} style={inputStyle} /></div>
              <div><label style={labelStyle}>Credit Hours</label><input value={creditHours} onChange={e => setCreditHours(e.target.value)} type="number" min={0} max={10} step={0.5} style={inputStyle} /></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Required Study Hours (optional)</label>
                <input value={requiredHours} onChange={e => setRequiredHours(e.target.value)} type="number" min={0} step={0.5} placeholder="e.g. 60" style={inputStyle} />
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>Leave blank for no time requirement. If set, the certificate will only be issued after the student has spent this many hours on the course.</div>
              </div>
              <div><label style={labelStyle}>Status</label><select value={status} onChange={e => setStatus(e.target.value as 'Draft' | 'Published')} style={selectStyle}><option>Draft</option><option>Published</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>📢 Announcement <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
                <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={2} placeholder="e.g. Quiz rescheduled to Friday…" style={{ ...taStyle, fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 1 }}>
                <button onClick={() => setShowCourseModal(false)} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Course</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── LESSON MODAL ───────────────────────────────────────────────────────────
  function LessonModal() {
    const courseId = activeCourseId || (store.courses[0]?.id ?? '')
    const item = editLessonIdx !== null ? store.content[editLessonIdx] : undefined
    const isNew = editLessonIdx === null
    const existingUnits = [...new Set(store.content.filter(x => x.courseId === courseId).map(x => x.unitTitle).filter(Boolean))] as string[]
    if (prefillUnit && !existingUnits.includes(prefillUnit)) existingUnits.push(prefillUnit)
    const [title, setTitle] = useState(item?.title ?? '')
    const [unitTitle, setUnitTitle] = useState(item?.unitTitle ?? prefillUnit ?? existingUnits[0] ?? '')
    const [type, setType] = useState(item?.type ?? 'video' as LMSContent['type'])
    const [lessonSubType, setLessonSubType] = useState(item?.lessonSubType ?? '')
    const [url, setUrl] = useState(item?.url ?? item?.body ?? '')
    const [estimatedMins, setEstimatedMins] = useState(String(item?.estimatedMins ?? ''))
    const [order, setOrder] = useState(String(item?.order ?? ''))
    const [hasMastery, setHasMastery] = useState(hasMasteryBool(item?.hasMastery))
    const [masteryPassMark, setMasteryPassMark] = useState(String(item?.masteryPassMark ?? 80))
    const [masteryRetakes, setMasteryRetakes] = useState(String(item?.masteryRetakes ?? 3))
    const [masteryBrief, setMasteryBrief] = useState(item?.masteryBrief ?? '')
    const [masteryTimeLimit, setMasteryTimeLimit] = useState(String(item?.masteryTimeLimit ?? ''))
    const [masteryShuffleQuestions, setMasteryShuffleQuestions] = useState(item?.masteryShuffleQuestions === true || item?.masteryShuffleQuestions === 'TRUE')
    const [masteryWeight, setMasteryWeight] = useState(String(item?.masteryWeight ?? 60))
    const [moduleTitle, setModuleTitle] = useState(item?.moduleTitle ?? '')
    const [moduleOrder, setModuleOrder] = useState(String(item?.moduleOrder ?? 1))
    const [slideCount, setSlideCount] = useState(String(item?.slideCount ?? ''))
    const [hasAssignment, setHasAssignment] = useState(hasAssignBool(item?.hasAssignment))
    const [assignInstructions, setAssignInstructions] = useState(item?.assignInstructions ?? '')
    const [assignMaxScore, setAssignMaxScore] = useState(String(item?.assignMaxScore ?? 100))
    const [assignDueDays, setAssignDueDays] = useState(String(item?.assignDueDays ?? ''))
    const [assignSubType, setAssignSubType] = useState(item?.assignSubType ?? 'both')
    const [assignWeight, setAssignWeight] = useState(String(item?.assignWeight ?? 40))

    const save = () => {
      if (!title.trim()) { alert('Title is required'); return }
      let finalUnit = unitTitle
      if (unitTitle === '__new__') {
        const ut = prompt('New unit title:')
        if (!ut?.trim()) return
        finalUnit = ut.trim()
      }
      const obj: LMSContent = {
        id: item?.id ?? lmsId(),
        courseId,
        title: title.trim(),
        unitTitle: finalUnit,
        type,
        lessonSubType,
        url: url.trim(),
        estimatedMins: parseInt(estimatedMins) || undefined,
        order: parseInt(order) || undefined,
        hasMastery,
        masteryPassMark: parseInt(masteryPassMark) || 80,
        masteryRetakes: parseInt(masteryRetakes) || 3,
        masteryBrief: masteryBrief.trim(),
        masteryTimeLimit: parseInt(masteryTimeLimit) || undefined,
        masteryShuffleQuestions,
        masteryWeight: parseInt(masteryWeight) || 60,
        moduleTitle: moduleTitle.trim() || undefined,
        moduleOrder: parseInt(moduleOrder) || 1,
        slideCount: parseInt(slideCount) || undefined,
        hasAssignment,
        assignInstructions: assignInstructions.trim(),
        assignMaxScore: parseInt(assignMaxScore) || 100,
        assignDueDays: parseInt(assignDueDays) || undefined,
        assignSubType,
        assignWeight: parseInt(assignWeight) || 40,
      }
      const content = [...store.content]
      if (isNew) content.push(obj); else content[editLessonIdx!] = obj
      persist({ ...store, content })
      setShowLessonModal(false)
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowLessonModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📄 {isNew ? 'New Lesson' : 'Edit Lesson'}</div>
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Lesson Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Ratios" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <select value={unitTitle} onChange={e => setUnitTitle(e.target.value)} style={selectStyle}>
                  {existingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  <option value="__new__">+ New unit...</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Content Type</label>
                <select value={type} onChange={e => setType(e.target.value as LMSContent['type'])} style={selectStyle}>
                  {['video', 'article', 'link', 'file', 'quiz', 'presentation'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Lesson Role</label>
                <select value={lessonSubType} onChange={e => setLessonSubType(e.target.value)} style={selectStyle}>
                  <option value="">Standard Lesson</option>
                  <option value="pretest">📋 Pre-Test</option>
                  <option value="posttest">📊 Post-Test</option>
                  <option value="tutorial">📖 Tutorial</option>
                  <option value="practice">✏️ Practice</option>
                </select>
              </div>
            </div>
            <div><label style={labelStyle}>Content URL / Body</label><textarea value={url} onChange={e => setUrl(e.target.value)} rows={3} placeholder="YouTube URL, Google Slides URL, Google Drive file link, or paste article text..." style={taStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Est. Minutes</label><input value={estimatedMins} onChange={e => setEstimatedMins(e.target.value)} type="number" min={1} placeholder="15" style={inputStyle} /></div>
              <div><label style={labelStyle}>Lesson Order</label><input value={order} onChange={e => setOrder(e.target.value)} type="number" min={1} style={inputStyle} /></div>
              <div><label style={labelStyle}>Module (optional)</label><input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g. Module 1: Foundations" style={inputStyle} /></div>
              <div><label style={labelStyle}>Module Order</label><input value={moduleOrder} onChange={e => setModuleOrder(e.target.value)} type="number" min={1} style={inputStyle} /></div>
              <div><label style={labelStyle}>Slide Count (presentations)</label><input value={slideCount} onChange={e => setSlideCount(e.target.value)} type="number" min={1} placeholder="e.g. 15" style={inputStyle} /></div>
            </div>
            {/* Mastery + Assignment section */}
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>📋 Mastery Test & Assignment</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#3D5475', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasMastery} onChange={e => setHasMastery(e.target.checked)} /> Enable Mastery Test
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#3D5475', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasAssignment} onChange={e => setHasAssignment(e.target.checked)} /> 📋 Include Assignment
                </label>
              </div>
              {hasMastery && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={labelStyle}>Pass Mark (%)</label><input value={masteryPassMark} onChange={e => setMasteryPassMark(e.target.value)} type="number" min={1} max={100} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Max Retakes</label><input value={masteryRetakes} onChange={e => setMasteryRetakes(e.target.value)} type="number" min={1} max={10} style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>📋 Assessment Brief <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional — shown to student before the test)</span></label><textarea value={masteryBrief} onChange={e => setMasteryBrief(e.target.value)} rows={3} placeholder="Explain what this assessment is testing, what the student should focus on, or any instructions before they begin..." style={{ ...taStyle, fontSize: 11 }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={labelStyle}>⏱ Time Limit (minutes)</label><input value={masteryTimeLimit} onChange={e => setMasteryTimeLimit(e.target.value)} type="number" min={1} max={180} placeholder="e.g. 30 — leave blank for unlimited" style={inputStyle} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A365E' }}>
                        <input type="checkbox" checked={masteryShuffleQuestions} onChange={e => setMasteryShuffleQuestions(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} /> 🔀 Shuffle Question Order
                      </label>
                    </div>
                  </div>
                  <div style={{ padding: 10, background: '#EEF3FF', borderRadius: 8, border: '1px solid #C7D9FF' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>⚖️ Grade Weighting</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><label style={labelStyle}>Mastery Weight (%)</label><input value={masteryWeight} onChange={e => setMasteryWeight(e.target.value)} type="number" min={0} max={100} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Assignment Weight (%)</label><input value={assignWeight} onChange={e => setAssignWeight(e.target.value)} type="number" min={0} max={100} style={inputStyle} /></div>
                    </div>
                    <div style={{ fontSize: 10, color: '#5A7290', marginTop: 6 }}>Composite Grade = (Mastery × weight) + (Assignment × weight). Weights must total 100%.</div>
                  </div>
                </div>
              )}
              {hasAssignment && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, padding: 12, background: '#FFF9F0', borderRadius: 10, border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>📋 Assignment Definition</div>
                  <div><label style={labelStyle}>Assignment Instructions</label><textarea value={assignInstructions} onChange={e => setAssignInstructions(e.target.value)} rows={3} placeholder="Describe what students need to do..." style={taStyle} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={labelStyle}>Max Score</label><input value={assignMaxScore} onChange={e => setAssignMaxScore(e.target.value)} type="number" min={1} max={100} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Due (days after enrol)</label><input value={assignDueDays} onChange={e => setAssignDueDays(e.target.value)} type="number" min={1} placeholder="e.g. 7" style={inputStyle} /></div>
                    <div>
                      <label style={labelStyle}>Submission Type</label>
                      <select value={assignSubType} onChange={e => setAssignSubType(e.target.value)} style={selectStyle}>
                        <option value="text">Text / Notes</option>
                        <option value="link">Link (Google Doc)</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setShowLessonModal(false)} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Lesson</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 32px 0' }}>
      {activeTab === 'manage' && renderManage()}
      {activeTab === 'courses' && renderCourses()}
      {activeTab === 'content' && renderContent()}
      {activeTab === 'assign' && renderAssign()}
      {activeTab === 'gradebook' && renderGradebook()}
      {activeTab === 'section' && renderSection()}
      {activeTab === 'progress' && renderProgress()}
      {showCourseModal && <CourseModal />}
      {showLessonModal && <LessonModal />}
      {showEnrolModal && <EnrolModal courses={store.courses} students={students} cohorts={cohorts} onSave={enrolment => persist({ ...store, enrolments: [...store.enrolments, enrolment] })} onClose={() => setShowEnrolModal(false)} />}
      {previewItem && <LessonPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
      {scoreModal && <GBScoreModal data={scoreModal} onClose={() => setScoreModal(null)} onSave={(score, _note) => {
        const key = scoreModal.studentId + '_' + scoreModal.contentId
        persist({ ...store, progress: store.progress.map(p => p.studentId === scoreModal.studentId && p.contentId === scoreModal.contentId ? { ...p, assignScore: score, assignStatus: 'scored' } : p).concat(store.progress.find(p => p.studentId === scoreModal.studentId && p.contentId === scoreModal.contentId) ? [] : [{ studentId: scoreModal.studentId, courseId: scoreModal.courseId, contentId: scoreModal.contentId, status: 'in_progress' as const, assignScore: score, assignStatus: 'scored', id: key }]) })
        setScoreModal(null)
      }} />}
    </div>
  )
}

function GBScoreModal({ data, onClose, onSave }: {
  data: { studentId: string; contentId: string; lessonTitle: string; maxScore: number; currentScore: string; instructions: string; submNote: string; submLink: string }
  onClose: () => void
  onSave: (score: number, note: string) => void
}) {
  const [score, setScore] = useState(data.currentScore)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  function save() {
    const v = parseInt(score)
    if (isNaN(v) || v < 0 || v > data.maxScore) return
    setSaving(true)
    onSave(v, note)
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E', marginBottom: 4 }}>📋 Score Assignment</div>
        <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 14 }}>{data.lessonTitle} · Max: {data.maxScore} pts</div>
        {data.instructions && (
          <div style={{ background: '#EEF3FF', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Assignment Instructions</div>
            <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap' }}>{data.instructions}</div>
          </div>
        )}
        {(data.submNote || data.submLink) ? (
          <div style={{ background: '#F7F9FC', borderRadius: 8, padding: '10px 12px', marginBottom: 10, borderLeft: '3px solid #1A365E' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Student Submission</div>
            {data.submNote && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{data.submNote}</div>}
            {data.submLink && <a href={data.submLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, wordBreak: 'break-all' }}>🔗 {data.submLink}</a>}
          </div>
        ) : (
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#92400E' }}>⏳ No text submission — student may have worked offline.</div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#5A7290', display: 'block', marginBottom: 4 }}>Assignment Score (0–{data.maxScore})</label>
          <input type="number" min={0} max={data.maxScore} value={score} onChange={e => setScore(e.target.value)} placeholder={`0–${data.maxScore}`} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#5A7290', display: 'block', marginBottom: 4 }}>Teacher Feedback (optional)</label>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Feedback visible to student..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Score</button>
        </div>
      </div>
    </div>
  )
}

function LessonPreviewModal({ item, onClose }: { item: LMSContent; onClose: () => void }) {
  const noteKey = `lms_note_${item.id}`
  const [noteOpen, setNoteOpen] = useState(() => { try { return !!localStorage.getItem(noteKey) } catch { return false } })
  const [noteText, setNoteText] = useState(() => { try { return localStorage.getItem(noteKey) || '' } catch { return '' } })
  const [slideIdx, setSlideIdx] = useState(0)
  const [discText, setDiscText] = useState('')

  const contentTypeLabels: Record<string, string> = { video: '🎬 Video', article: '📝 Article', link: '🔗 Web Link', file: '📎 File', quiz: '❓ Quiz', presentation: '🖥️ Presentation' }
  const passMark = item.masteryPassMark ?? 80
  const maxRetakes = item.masteryRetakes ?? 3

  let masteryQuestions: Array<{ q: string; opts?: string[]; ans?: number }> = []
  try { masteryQuestions = JSON.parse(item.masteryQuizJson || item.quizJson || '[]') } catch { /* empty */ }

  let extraAssignments: Array<{ instructions?: string; maxScore?: number; dueDays?: number; subType?: string }> = []
  try { extraAssignments = JSON.parse(item.assignments || '[]') } catch { /* empty */ }

  function getEmbedUrl(url: string): string {
    if (url.includes('docs.google.com/presentation')) {
      const base = url.replace(/\/pub(\?.*)?$/, '').replace(/\/edit(\?.*)?$/, '').replace(/\/embed(\?.*)?$/, '')
      return base + '/embed?start=false&loop=false&rm=minimal'
    }
    const driveMatch = url.match(/\/file\/d\/([^/]+)/)
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    return url
  }

  function renderContent() {
    const url = item.url || ''

    if (item.type === 'video') {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
      if (ytMatch) {
        return (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
            <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
          </div>
        )
      }
      return url
        ? <div style={{ padding: '20px', textAlign: 'center' }}><a href={url} target="_blank" rel="noreferrer" style={{ color: '#1A365E', fontWeight: 700 }}>▶ Watch Video</a></div>
        : <div style={{ padding: 20, color: '#94A3B8' }}>No video URL provided.</div>
    }

    if (item.type === 'article') {
      const content = item.body || item.url || ''
      return content
        ? <div style={{ padding: 20, lineHeight: 1.7, fontSize: 13, color: '#1A365E', whiteSpace: 'pre-wrap' }}>{content}</div>
        : <div style={{ padding: 20, color: '#94A3B8' }}>No article content.</div>
    }

    if (item.type === 'presentation' && url) {
      const slideCount = item.slideCount || 20
      const slideM = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
      const slideId = slideM ? slideM[1] : null
      const embedUrl = slideId
        ? `https://docs.google.com/presentation/d/${slideId}/embed?rm=minimal&start=false&loop=false&delayms=99999`
        : getEmbedUrl(url)
      const SLIDE_H = 500
      const pct = Math.round(slideIdx / Math.max(1, slideCount - 1) * 100)
      const isFirst = slideIdx === 0
      const isLast = slideIdx === slideCount - 1
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Clipped slide window */}
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#1A1A2E', height: 390 }}>
            <div style={{ position: 'relative', width: '100%', transform: `translateY(-${slideIdx * SLIDE_H}px)`, transition: 'transform .3s ease' }}>
              <iframe src={embedUrl} style={{ width: '100%', height: slideCount * SLIDE_H + 100, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" allowFullScreen title={item.title} loading="lazy" />
            </div>
            {/* Transparent overlay blocks iframe interaction */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'default', background: 'transparent' }} title="Use ◀ Prev and ▶ Next buttons to navigate slides" />
          </div>
          {/* Navigation bar */}
          <div style={{ background: '#F0F4FA', padding: '10px 16px 12px', border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
            {/* Progress bar with dots */}
            <div style={{ position: 'relative', height: 6, background: '#DDE6F0', borderRadius: 3, marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1A365E', borderRadius: 3, transition: 'width .2s' }} />
              {Array.from({ length: Math.min(slideCount, 20) }).map((_, ti) => {
                const tpct = Math.round(ti / Math.max(1, slideCount - 1) * 100)
                return (
                  <div key={ti} onClick={() => setSlideIdx(ti)} style={{ position: 'absolute', top: -3, left: `${tpct}%`, width: 12, height: 12, borderRadius: '50%', background: ti <= slideIdx ? '#1A365E' : '#fff', border: `2px solid ${ti < slideIdx ? '#1A365E' : '#DDE6F0'}`, transform: 'translateX(-50%)', cursor: 'pointer', transition: 'all .2s' }} title={`Slide ${ti + 1}`} />
                )
              })}
            </div>
            {/* Nav row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSlideIdx(p => Math.max(0, p - 1))} disabled={isFirst} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isFirst ? 'not-allowed' : 'pointer', background: isFirst ? '#E4EAF2' : '#1A365E', color: isFirst ? '#94A3B8' : '#fff' }}>◀ Prev</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
                {slideCount <= 20 && (
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    {Array.from({ length: slideCount }).map((_, di) => (
                      <div key={di} onClick={() => setSlideIdx(di)} style={{ width: di === slideIdx ? 18 : 6, height: 6, borderRadius: 3, background: di === slideIdx ? '#1A365E' : di < slideIdx ? '#7A92B0' : '#DDE6F0', cursor: 'pointer', transition: 'all .2s' }} />
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setSlideIdx(p => Math.min(slideCount - 1, p + 1))} disabled={isLast} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isLast ? 'not-allowed' : 'pointer', background: isLast ? '#E4EAF2' : '#1A365E', color: isLast ? '#94A3B8' : '#fff' }}>Next ▶</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{pct}% through presentation</div>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#1A365E', fontWeight: 700 }}>↗ Open in Google Slides</a>
            </div>
          </div>
        </div>
      )
    }

    if (item.type === 'file' && url) {
      const driveMatch = url.match(/\/file\/d\/([^/]+)/)
      const previewUrl = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : url
      return (
        <>
          <div style={{ position: 'relative', paddingBottom: '75%', height: 0, overflow: 'hidden' }}>
            <iframe src={previewUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
          </div>
          <div style={{ padding: '8px 16px', textAlign: 'right' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700 }}>↗ Open in Drive</a>
          </div>
        </>
      )
    }

    if (item.type === 'link' && url) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Loading external content inline...</div>
          <iframe src={url} style={{ width: '100%', height: 500, border: '1.5px solid #E4EAF2', borderRadius: 10 }} sandbox="allow-scripts allow-same-origin allow-forms" loading="lazy" title={item.title} />
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '10px 24px', background: '#1A365E', color: '#fff', borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>🔗 Open Link</a>
          </div>
        </div>
      )
    }

    if (item.type === 'quiz') {
      let questions: Array<{ q: string; opts?: string[]; ans?: number }> = []
      try { questions = JSON.parse(item.quizJson || '[]') } catch { /* empty */ }
      if (!questions.length) return <div style={{ padding: '20px', color: '#94A3B8' }}>No quiz questions defined yet.</div>
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>📝 Practice Quiz</div>
          {questions.map((q, qi) => (
            <div key={qi} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              {q.opts && q.opts.map((opt, oi) => (
                <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400 }}>
                  {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? ' ✓' : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    return <div style={{ padding: 20, color: '#94A3B8' }}>No content available.</div>
  }

  function renderAssignPanel(aItem: { instructions?: string; maxScore?: number; dueDays?: number; subType?: string; rubric?: string }, idx?: number) {
    return (
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
        {idx !== undefined && <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', marginBottom: 6 }}>📋 Assignment {idx + 2}</div>}
        {!idx && <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', marginBottom: 8 }}>📋 Assignment</div>}
        {aItem.instructions && <div style={{ fontSize: 12, color: '#2D3F5E', lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{aItem.instructions}</div>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#1D4ED8', marginBottom: aItem.rubric ? 8 : 0 }}>
          {aItem.maxScore !== undefined && aItem.maxScore !== null && <span>Max Score: <strong>{aItem.maxScore}</strong></span>}
          {aItem.dueDays !== undefined && aItem.dueDays !== null && <span>Due in: <strong>{aItem.dueDays} days</strong></span>}
          {aItem.subType && <span>Submission: <strong>{aItem.subType}</strong></span>}
        </div>
        {aItem.rubric && (
          <div style={{ background: '#F0F4FA', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#1A365E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>📐 Rubric</div>
            <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{aItem.rubric}</div>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', marginBottom: 4 }}>Student Submission (Preview)</div>
          <textarea disabled rows={3} placeholder="Student would enter notes here…" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #BFDBFE', borderRadius: 8, fontSize: 11, resize: 'none', boxSizing: 'border-box', background: '#F7FBFF', color: '#7A92B0', fontFamily: 'inherit' }} />
          <input disabled type="text" placeholder="Or paste a link here…" style={{ width: '100%', marginTop: 6, padding: '7px 10px', border: '1.5px solid #BFDBFE', borderRadius: 8, fontSize: 11, boxSizing: 'border-box', background: '#F7FBFF', color: '#7A92B0', fontFamily: 'inherit' }} />
          <button disabled style={{ marginTop: 6, padding: '8px 16px', background: '#BFDBFE', color: '#94A3B8', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'not-allowed', width: '100%' }}>📤 Submit Assignment (Preview)</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, margin: '0 auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'linear-gradient(135deg,#059669,#047857)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>{item.type}{item.estimatedMins ? ` · ${item.estimatedMins} min` : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,.2)', color: '#fff', padding: '3px 10px', borderRadius: 6 }}>👁 Teacher Preview</span>
            <button onClick={onClose} style={{ padding: '4px 12px', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Metadata bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.lessonSubType && <span style={{ fontSize: 10, fontWeight: 700, background: '#F0F4FA', color: '#1A365E', padding: '3px 9px', borderRadius: 5 }}>{item.lessonSubType}</span>}
            {item.unitTitle && <span style={{ fontSize: 10, color: '#7A92B0' }}>📂 {item.unitTitle}</span>}
          </div>

          {/* Content area */}
          <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F0F4FA', background: '#F7F9FC' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{contentTypeLabels[item.type] ?? '📄 Content'}</span>
              <span style={{ padding: '4px 10px', background: '#EEF3FF', color: '#1A365E', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>⛶ Fullscreen</span>
            </div>
            {renderContent()}
          </div>

          {/* Mark as complete (preview - disabled) */}
          {!hasMasteryBool(item.hasMastery) && (
            <button disabled style={{ padding: 12, background: '#D1FAE5', color: '#6EE7B7', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'not-allowed', width: '100%' }}>✅ Mark as Complete (Preview)</button>
          )}

          {/* Mastery test section */}
          {hasMasteryBool(item.hasMastery) && (
            <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>🎯 Mastery Test</div>
              <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 12 }}>Pass with {passMark}% to unlock the next lesson · {maxRetakes} attempt{maxRetakes !== 1 ? 's' : ''} max</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#92400E', marginBottom: item.masteryBrief ? 12 : 4 }}>
                {item.masteryTimeLimit && <span style={{ background: '#FFF7ED', padding: '3px 8px', borderRadius: 5 }}>⏱ {item.masteryTimeLimit} min limit</span>}
                {(item.masteryShuffleQuestions === true || item.masteryShuffleQuestions === 'TRUE') && <span style={{ background: '#FFF7ED', padding: '3px 8px', borderRadius: 5 }}>🔀 Shuffle On</span>}
              </div>
              {item.masteryBrief && (
                <div style={{ background: '#EEF3FF', border: '1px solid #C4D4E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📋</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Assessment Brief</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#2D3F5E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.masteryBrief}</div>
                </div>
              )}
              {masteryQuestions.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                    {masteryQuestions.map((q, qi) => (
                      <div key={qi} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
                        {q.opts && q.opts.map((opt, oi) => (
                          <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400 }}>
                            {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? ' ✓' : ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <button disabled style={{ padding: 10, background: '#C7D2FE', color: '#6366F1', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'not-allowed', width: '100%' }}>Submit Mastery Test ({masteryQuestions.length} question{masteryQuestions.length !== 1 ? 's' : ''}) — Preview Only</button>
                </>
              ) : (
                <div style={{ padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>⚠️ No mastery questions configured yet.</div>
              )}
            </div>
          )}

          {/* Assignment panel — locked if mastery required (preview = never passed) */}
          {hasAssignBool(item.hasAssignment) && (
            hasMasteryBool(item.hasMastery)
              ? (
                <div style={{ marginTop: 4, padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🔒</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#7A92B0' }}>Assignment Locked</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Pass the mastery test first to unlock this assignment.</div>
                  </div>
                </div>
              )
              : renderAssignPanel({
                instructions: item.assignInstructions,
                maxScore: item.assignMaxScore,
                dueDays: item.assignDueDays,
                subType: item.assignSubType,
                rubric: item.assignRubric,
              })
          )}

          {/* Additional assignments */}
          {extraAssignments.map((ea, eai) => (
            <div key={eai} style={{ borderTop: '1px dashed #E4EAF2', paddingTop: 8 }}>
              {renderAssignPanel({ instructions: ea.instructions, maxScore: ea.maxScore, dueDays: ea.dueDays, subType: ea.subType }, eai)}
            </div>
          ))}

          {/* Discussion board */}
          <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Lesson Discussion & Peer Review</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Discussion (0 posts)</div>
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2', marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Share your thoughts or ask a question</div>
              <textarea
                value={discText}
                onChange={e => setDiscText(e.target.value)}
                rows={3}
                placeholder="What's on your mind about this lesson?"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff', lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Peer reviews and questions welcome 👋</span>
                <button onClick={() => setDiscText('')} style={{ padding: '7px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚀 Post</button>
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', color: '#94A3B8', fontSize: 12 }}>No posts yet. Start the discussion! 🎯</div>
          </div>

          {/* Private notepad */}
          <div style={{ background: '#FFFBEA', border: '1px solid #FDE68A', borderRadius: 13, overflow: 'hidden' }}>
            <button onClick={() => setNoteOpen(p => !p)} style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: '#92400E', textAlign: 'left' }}>
              <span style={{ fontSize: 16 }}>📝</span>
              My Notes
              <span style={{ fontSize: 10, fontWeight: 400, color: '#B45309', marginLeft: 'auto' }}>Private — only you can see these</span>
              <span style={{ color: '#B45309' }}>{noteOpen ? '▼' : '▶'}</span>
            </button>
            {noteOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <textarea
                  rows={5}
                  placeholder="Jot your thoughts, questions, or key takeaways here…"
                  value={noteText}
                  onChange={e => {
                    setNoteText(e.target.value)
                    try { localStorage.setItem(noteKey, e.target.value) } catch { /* empty */ }
                  }}
                  style={{ width: '100%', padding: 10, border: '1.5px solid #FDE68A', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#B45309' }}>Auto-saved as you type</span>
                  <button onClick={() => { setNoteText(''); try { localStorage.removeItem(noteKey) } catch { /* empty */ } }} style={{ padding: '4px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #FFD0D3', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
