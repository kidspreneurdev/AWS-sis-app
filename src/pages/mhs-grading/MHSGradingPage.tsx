import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { applyGradeOverride } from '@/lib/grading/mhsRollup'
import { MHSGateOverridePanel } from './MHSGateOverridePanel'
import { MHSHowScorer } from './MHSHowScorer'
import { MHSNotesScorer } from './MHSNotesScorer'
import { MHSDiscussionScorer } from './MHSDiscussionScorer'
import { MHSDiscussionModerationPanel } from './MHSDiscussionModerationPanel'
import { MHSDebateScorer } from './MHSDebateScorer'
import { MHSOmrScorer } from './MHSOmrScorer'
import { MHSCapstoneRoster } from './MHSCapstoneRoster'
import { MHSReflectionQueue } from './MHSReflectionQueue'
import { MHSDisputeQueue } from './MHSDisputeQueue'
import { MHSQuizAnswersPanel } from './MHSQuizAnswersPanel'
import { toast } from '@/lib/toast'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }

type ComponentTab = 'quiz' | 'notes' | 'discussion' | 'debate' | 'omr'
type PrimaryTab = 'quiz' | 'notes' | 'share' | 'omr'

const PRIMARY_TABS: { key: PrimaryTab; label: string }[] = [
  { key: 'quiz', label: 'Quiz' },
  { key: 'notes', label: 'Do it' },
  { key: 'share', label: 'Share it' },
  { key: 'omr', label: 'Prove it' },
]

function primaryTabFor(tab: ComponentTab): PrimaryTab {
  return tab === 'discussion' || tab === 'debate' ? 'share' : tab
}

interface MhsCourse { id: string; title: string; catalog_code: string | null; academic_year: string; term: string | null }
interface MhsLesson { id: string; title: string; quiz_gate_threshold_pct: number | null; quiz_max_attempts: number | null; quiz_questions: QuizQuestion[]; notes_due_at: string | null; omr_answer_key: string | null }
interface QuizQuestion { question: string; choices: string[]; correctIndex: number }
interface CatalogRow { code: string; title: string }
interface RosterComponent {
  id: string
  status: string
  attemptCount: number
  maxAttempts: number
  rawScorePct: number | null
  scorePct: number | null
  latePenaltyPct: number | null
  daysLate: number | null
  excused: boolean
  teacherVerified: boolean
  spotcheckFlag: boolean
  recordingUrl: string | null
  recordingType: 'audio' | 'video' | null
  accommodated: boolean
  debateAbsenceFlag: boolean
  makeupScheduledFor: string | null
  makeupDeadline: string | null
}
interface RosterRow {
  courseId: string
  studentId: string
  studentName: string
  gradeLetter: string | null
  masteryPct: number | null
  howPct: number | null
  gradeOverride: boolean
  component: RosterComponent | null
}

const STATUS_META: Record<string, { bg: string; tc: string; label: string }> = {
  not_started: { bg: '#F1F5F9', tc: '#64748B', label: 'Not started' },
  in_progress: { bg: '#DBEAFE', tc: '#1D4ED8', label: 'In progress' },
  submitted: { bg: '#DBEAFE', tc: '#1D4ED8', label: 'Submitted' },
  gate_flagged: { bg: '#FEE2E2', tc: '#B91C1C', label: 'Gate flagged' },
  gate_cleared: { bg: '#FEF3C7', tc: '#92400E', label: 'Gate cleared' },
  scored: { bg: '#DCFCE7', tc: '#15803D', label: 'Passed' },
  excused: { bg: '#F1F5F9', tc: '#64748B', label: 'Excused' },
}

export function MHSGradingPage() {
  const profile = useAuthStore((s) => s.profile)
  const [courses, setCourses] = useState<MhsCourse[]>([])
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [lessons, setLessons] = useState<MhsLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)
  const [rosterStudentId, setRosterStudentId] = useState<string | null>(null)
  const [viewAnswersStudentId, setViewAnswersStudentId] = useState<string | null>(null)
  const [overrideStudentId, setOverrideStudentId] = useState<string | null>(null)
  const [componentTab, setComponentTab] = useState<ComponentTab>('quiz')
  const [showReflectionQueue, setShowReflectionQueue] = useState(false)
  const [showModerationPanel, setShowModerationPanel] = useState(false)
  const [showDisputeQueue, setShowDisputeQueue] = useState(false)
  const [showCapstoneView, setShowCapstoneView] = useState(false)

  const [showNewCourse, setShowNewCourse] = useState(false)
  const [newCourse, setNewCourse] = useState({ catalogCode: '', academicYear: '' })
  const [academicYears, setAcademicYears] = useState<string[]>([])

  const [showNewLesson, setShowNewLesson] = useState(false)
  const [newLesson, setNewLesson] = useState({ title: '', gateThreshold: '', maxAttempts: '', notesDueAt: '', discussionDueAt: '', minDiscussionWords: '', omrAnswerKey: '' })
  const [newQuestions, setNewQuestions] = useState<QuizQuestion[]>([{ question: '', choices: ['', '', '', ''], correctIndex: 0 }])

  const loadCourses = useCallback(async () => {
    const [{ data: c }, { data: cat }, { data: yearsRows }] = await Promise.all([
      supabase.from('mhs_courses').select('id,title,catalog_code,academic_year,term').order('created_at', { ascending: false }),
      supabase.from('catalog').select('code,title').order('title'),
      supabase.from('courses').select('academic_year'),
    ])
    setCourses(c ?? [])
    setCatalog(cat ?? [])
    // Pulled from the real courses table (not typed in) so a course can only ever
    // be linked using a year that actually exists in student enrollments — the
    // free-text version of this field let "2025-26" silently match zero rows
    // against real data stored as "2025-2026".
    setAcademicYears([...new Set((yearsRows ?? []).map((r) => r.academic_year).filter(Boolean))].sort().reverse())
  }, [])

  useEffect(() => { void loadCourses() }, [loadCourses])

  const loadLessons = useCallback(async (courseId: string) => {
    const { data } = await supabase
      .from('mhs_lessons')
      .select('id,title,quiz_gate_threshold_pct,quiz_max_attempts,quiz_questions,notes_due_at,omr_answer_key')
      .eq('mhs_course_id', courseId)
      .order('sequence')
    setLessons(data ?? [])
  }, [])

  useEffect(() => {
    if (selectedCourseId) void loadLessons(selectedCourseId)
    else setLessons([])
  }, [selectedCourseId, loadLessons])

  const loadRoster = useCallback(async (courseId: string, lessonId: string | null, componentType: ComponentTab) => {
    const { data: enrolled } = await supabase
      .from('courses')
      .select('id,student_id,grade_letter,mhs_mastery_pct,mhs_how_pct,mhs_grade_override,students(first_name,last_name)')
      .eq('mhs_course_id', courseId)

    // A student can have more than one `courses` row linked to the same mhs_course_id
    // (duplicate/legacy enrollment records — mhsRollup.ts already accounts for this when
    // recomputing grades). For the roster display, show each student once — keep their
    // first enrollment row for override actions rather than listing them twice.
    const seenStudentIds = new Set<string>()
    const rows: RosterRow[] = []
    for (const c of enrolled ?? []) {
      if (seenStudentIds.has(c.student_id)) continue
      seenStudentIds.add(c.student_id)
      const s = c.students as unknown as { first_name: string | null; last_name: string | null } | null
      rows.push({
        courseId: c.id,
        studentId: c.student_id,
        studentName: `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.trim() || '(unnamed student)',
        gradeLetter: c.grade_letter,
        masteryPct: c.mhs_mastery_pct,
        howPct: c.mhs_how_pct,
        gradeOverride: c.mhs_grade_override,
        component: null,
      })
    }

    if (lessonId && rows.length > 0) {
      let { data: components } = await supabase
        .from('mhs_lesson_components')
        .select('id,student_id,status,attempt_count,max_attempts,raw_score_pct,score_pct,late_penalty_pct,days_late,excused,teacher_verified,spotcheck_flag,recording_url,recording_type,accommodated,debate_absence_flag,makeup_scheduled_for,makeup_deadline')
        .eq('lesson_id', lessonId)
        .eq('component_type', componentType)
        .in('student_id', rows.map((r) => r.studentId))

      // Notes/Discussion are teacher-viewable even before a student has acted —
      // create a placeholder row up front so there's something to score. This
      // can race with the student's own auto-create (get-discussion-thread.js
      // does the same for Discussion) — a unique-index conflict fails the
      // whole batch, so the insert is best-effort; the re-fetch below still
      // picks up whatever rows exist either way.
      if (componentType !== 'quiz') {
        const missingStudentIds = rows.map((r) => r.studentId).filter((sid) => !components?.some((c) => c.student_id === sid))
        if (missingStudentIds.length > 0) {
          // Result intentionally ignored — best-effort, see comment above.
          await supabase.from('mhs_lesson_components').insert(
            missingStudentIds.map((studentId) => ({ lesson_id: lessonId, student_id: studentId, component_type: componentType, status: 'not_started' }))
          )
          const { data: refreshed } = await supabase
            .from('mhs_lesson_components')
            .select('id,student_id,status,attempt_count,max_attempts,raw_score_pct,score_pct,late_penalty_pct,days_late,excused,teacher_verified,spotcheck_flag,recording_url,recording_type,accommodated,debate_absence_flag,makeup_scheduled_for,makeup_deadline')
            .eq('lesson_id', lessonId)
            .eq('component_type', componentType)
            .in('student_id', rows.map((r) => r.studentId))
          components = refreshed
        }
      }

      for (const row of rows) {
        const comp = components?.find((c) => c.student_id === row.studentId)
        row.component = comp
          ? {
              id: comp.id,
              status: comp.status,
              attemptCount: comp.attempt_count,
              maxAttempts: comp.max_attempts,
              rawScorePct: comp.raw_score_pct,
              scorePct: comp.score_pct,
              latePenaltyPct: comp.late_penalty_pct,
              daysLate: comp.days_late,
              excused: comp.excused,
              teacherVerified: comp.teacher_verified,
              spotcheckFlag: comp.spotcheck_flag,
              recordingUrl: comp.recording_url,
              recordingType: comp.recording_type,
              accommodated: comp.accommodated,
              debateAbsenceFlag: comp.debate_absence_flag,
              makeupScheduledFor: comp.makeup_scheduled_for,
              makeupDeadline: comp.makeup_deadline,
            }
          : null
      }
    }
    setRoster(rows)
  }, [])

  useEffect(() => {
    if (selectedCourseId) void loadRoster(selectedCourseId, selectedLessonId, componentTab)
  }, [selectedCourseId, selectedLessonId, componentTab, loadRoster])

  useEffect(() => {
    setRosterStudentId(null)
  }, [selectedLessonId])

  const visibleRoster = useMemo(
    () => (rosterStudentId ? roster.filter((r) => r.studentId === rosterStudentId) : roster),
    [roster, rosterStudentId]
  )

  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId) ?? null, [courses, selectedCourseId])
  const selectedLesson = useMemo(() => lessons.find((l) => l.id === selectedLessonId) ?? null, [lessons, selectedLessonId])

  async function createCourse() {
    const cat = catalog.find((c) => c.code === newCourse.catalogCode)
    if (!cat || !newCourse.academicYear) return
    const { data, error } = await supabase
      .from('mhs_courses')
      .insert({
        catalog_code: cat.code,
        title: cat.title,
        academic_year: newCourse.academicYear,
        teacher_id: profile?.id ?? null,
      })
      .select('id')
      .single()
    if (error || !data) return

    // Link every existing student enrollment for this catalog course + year. The year
    // comes from the dropdown above (sourced from real `courses` rows), so a format
    // mismatch against real enrollment data is no longer possible here.
    const { data: linked, error: linkError } = await supabase
      .from('courses')
      .update({ mhs_course_id: data.id })
      .eq('catalog_code', cat.code)
      .eq('academic_year', newCourse.academicYear)
      .select('id')

    if (linkError) {
      toast(`Course created, but linking enrollments failed: ${linkError.message}`, 'err')
    } else if (!linked || linked.length === 0) {
      toast(`Course created, but no student enrollments matched catalog code "${cat.code}" + academic year "${newCourse.academicYear}".`, 'err')
    } else {
      toast(`Linked ${linked.length} student enrollment(s) to this course.`, 'ok')
    }

    setNewCourse({ catalogCode: '', academicYear: '' })
    setShowNewCourse(false)
    await loadCourses()
    setSelectedCourseId(data.id)
  }

  function updateQuestion(idx: number, patch: Partial<QuizQuestion>) {
    setNewQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)))
  }
  function updateChoice(qIdx: number, cIdx: number, value: string) {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, choices: q.choices.map((c, j) => (j === cIdx ? value : c)) } : q))
    )
  }

  async function createLesson() {
    if (!selectedCourseId || !newLesson.title.trim()) return
    const cleanQuestions = newQuestions.filter((q) => q.question.trim() && q.choices.every((c) => c.trim()))
    await supabase.from('mhs_lessons').insert({
      mhs_course_id: selectedCourseId,
      title: newLesson.title.trim(),
      quiz_gate_threshold_pct: newLesson.gateThreshold ? Number(newLesson.gateThreshold) : null,
      quiz_max_attempts: newLesson.maxAttempts ? Number(newLesson.maxAttempts) : null,
      quiz_questions: cleanQuestions,
      notes_due_at: newLesson.notesDueAt || null,
      discussion_due_at: newLesson.discussionDueAt || null,
      min_discussion_words: newLesson.minDiscussionWords ? Number(newLesson.minDiscussionWords) : 150,
      omr_answer_key: newLesson.omrAnswerKey.trim().toUpperCase().replace(/[^A-Z]/g, '') || null,
      created_by: profile?.id ?? null,
    })
    setNewLesson({ title: '', gateThreshold: '', maxAttempts: '', notesDueAt: '', discussionDueAt: '', minDiscussionWords: '', omrAnswerKey: '' })
    setNewQuestions([{ question: '', choices: ['', '', '', ''], correctIndex: 0 }])
    setShowNewLesson(false)
    await loadLessons(selectedCourseId)
  }

  async function refreshRoster() {
    if (selectedCourseId) await loadRoster(selectedCourseId, selectedLessonId, componentTab)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>MS/HS Gated Grading</div>
          <select value={selectedCourseId ?? ''} onChange={(e) => { setSelectedCourseId(e.target.value || null); setSelectedLessonId(null) }} style={{ ...input, width: 'auto', minWidth: 220 }}>
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} · {c.academic_year}{c.term ? ` · ${c.term}` : ''}</option>
            ))}
          </select>
          <button onClick={() => setShowNewCourse((v) => !v)} style={{ ...btnPrimary, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}>
            {showNewCourse ? 'Cancel' : '+ New Course'}
          </button>
        </div>

        {showNewCourse && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={label}>Catalog course</label>
              <select value={newCourse.catalogCode} onChange={(e) => setNewCourse((p) => ({ ...p, catalogCode: e.target.value }))} style={input}>
                <option value="">Select…</option>
                {catalog.map((c) => <option key={c.code} value={c.code}>{c.title} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Academic year</label>
              <select value={newCourse.academicYear} onChange={(e) => setNewCourse((p) => ({ ...p, academicYear: e.target.value }))} style={input}>
                <option value="">Select…</option>
                {academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={() => void createCourse()} style={btnPrimary}>Create</button>
          </div>
        )}
      </div>

      {selectedCourse && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowCapstoneView((v) => !v)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E4EAF2', background: showCapstoneView ? '#1A365E' : '#fff', color: showCapstoneView ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {showCapstoneView ? '← Back to Lessons' : 'Module Capstones →'}
          </button>
        </div>
      )}

      {selectedCourse && showCapstoneView && <MHSCapstoneRoster mhsCourseId={selectedCourse.id} />}

      {selectedCourse && !showCapstoneView && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8, textTransform: 'uppercase' }}>Lessons</div>
              {lessons.length === 0 && <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>No lessons yet.</div>}
              {lessons.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLessonId(l.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: `1.5px solid ${selectedLessonId === l.id ? '#1A365E' : '#E4EAF2'}`, background: selectedLessonId === l.id ? '#1A365E' : '#F7F9FC', color: selectedLessonId === l.id ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {l.title}
                </button>
              ))}
              <button onClick={() => setShowNewLesson(true)} style={{ ...btnPrimary, width: '100%', marginTop: 8, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}>
                + New Lesson
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {PRIMARY_TABS.map(({ key, label }) => {
                const active = primaryTabFor(componentTab) === key
                return (
                  <button
                    key={key}
                    onClick={() => setComponentTab(key === 'share' ? (componentTab === 'discussion' || componentTab === 'debate' ? componentTab : 'discussion') : key)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${active ? '#1A365E' : '#E4EAF2'}`, background: active ? '#1A365E' : '#fff', color: active ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                )
              })}
              {primaryTabFor(componentTab) === 'share' && (
                <div style={{ display: 'flex', gap: 4, borderLeft: '1.5px solid #E4EAF2', paddingLeft: 8, marginLeft: 2 }}>
                  {(['discussion', 'debate'] as ComponentTab[]).map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setComponentTab(sub)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${componentTab === sub ? '#1A365E' : '#E4EAF2'}`, background: componentTab === sub ? '#EAF0FA' : '#fff', color: '#1A365E', fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {componentTab === 'discussion' && (
                  <button
                    onClick={() => setShowModerationPanel((v) => !v)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E4EAF2', background: showModerationPanel ? '#1A365E' : '#fff', color: showModerationPanel ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {showModerationPanel ? 'Hide Flags' : 'Moderation Flags'}
                  </button>
                )}
                <button
                  onClick={() => setShowReflectionQueue((v) => !v)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E4EAF2', background: showReflectionQueue ? '#1A365E' : '#fff', color: showReflectionQueue ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {showReflectionQueue ? 'Hide Reflections' : 'Reflection Queue'}
                </button>
                <button
                  onClick={() => setShowDisputeQueue((v) => !v)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E4EAF2', background: showDisputeQueue ? '#1A365E' : '#fff', color: showDisputeQueue ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {showDisputeQueue ? 'Hide Disputes' : 'Dispute Queue'}
                </button>
              </div>
            </div>

            {showReflectionQueue && <MHSReflectionQueue onResolved={refreshRoster} />}
            {showDisputeQueue && <MHSDisputeQueue />}
            {showModerationPanel && componentTab === 'discussion' && selectedLesson && <MHSDiscussionModerationPanel lessonId={selectedLesson.id} />}

            {selectedLesson && roster.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...label, marginBottom: 0 }}>Student</label>
                <select value={rosterStudentId ?? ''} onChange={(e) => setRosterStudentId(e.target.value || null)} style={{ ...input, width: 'auto', minWidth: 220 }}>
                  <option value="">All students ({roster.length})</option>
                  {roster.map((r) => (
                    <option key={r.studentId} value={r.studentId}>{r.studentName}</option>
                  ))}
                </select>
              </div>
            )}

            {!selectedLesson ? (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>Select a lesson to see the roster and gate status.</div>
            ) : (
              visibleRoster.map((row) => {
                const statusMeta = row.component ? STATUS_META[row.component.status] : STATUS_META.not_started
                return (
                  <div key={row.courseId} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{row.studentName}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, background: statusMeta.bg, color: statusMeta.tc, padding: '3px 8px', borderRadius: 6 }}>{statusMeta.label}</span>
                      {componentTab === 'quiz' && row.component && (
                        <span style={{ fontSize: 10, color: '#7A92B0' }}>
                          Attempt {row.component.attemptCount}/{row.component.maxAttempts}
                          {row.component.rawScorePct !== null ? ` · ${row.component.rawScorePct}%` : ''}
                        </span>
                      )}
                      {(componentTab === 'notes' || componentTab === 'discussion' || componentTab === 'omr') && row.component && (
                        <span style={{ fontSize: 10, color: '#7A92B0' }}>
                          {row.component.rawScorePct !== null ? `${componentTab === 'notes' ? 'Accuracy' : componentTab === 'omr' ? 'Score' : 'Content'} ${row.component.rawScorePct}%` : 'Not yet scored'}
                          {row.component.latePenaltyPct !== null ? ` · ${row.component.latePenaltyPct}% on-time credit` : ' · needs review (4+ days late)'}
                        </span>
                      )}
                      {componentTab === 'debate' && row.component && (
                        <span style={{ fontSize: 10, color: '#7A92B0' }}>
                          {row.component.rawScorePct !== null ? `Score ${row.component.rawScorePct}%` : 'Not yet scored'}
                          {row.component.accommodated ? ' · accommodated' : row.component.recordingUrl ? ' · recorded' : ''}
                          {row.component.debateAbsenceFlag ? ' · makeup pending' : ''}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#1A365E' }}>
                        Grade: {row.gradeLetter ?? '—'} {row.gradeOverride && <span style={{ color: '#D97706' }}>(overridden)</span>}
                      </span>
                      <span style={{ fontSize: 10, color: '#7A92B0' }}>
                        Mastery {row.masteryPct ?? '—'}% · HOW {row.howPct ?? '—'}%
                      </span>
                      {componentTab === 'quiz' && row.component && row.component.attemptCount > 0 && (
                        <button
                          onClick={() => setViewAnswersStudentId((v) => (v === row.studentId ? null : row.studentId))}
                          style={{ ...btnPrimary, padding: '5px 10px', fontSize: 10, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}
                        >
                          {viewAnswersStudentId === row.studentId ? 'Hide Answers' : 'View Answers'}
                        </button>
                      )}
                      <button onClick={() => setExpandedStudentId((v) => (v === row.studentId ? null : row.studentId))} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 10 }}>
                        {expandedStudentId === row.studentId ? 'Hide HOW' : 'Score HOW'}
                      </button>
                      <button onClick={() => setOverrideStudentId((v) => (v === row.studentId ? null : row.studentId))} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 10, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}>
                        Override Grade
                      </button>
                    </div>

                    {componentTab === 'notes' && row.component && (
                      <div style={{ marginTop: 10 }}>
                        <MHSNotesScorer component={row.component} studentId={row.studentId} onSaved={refreshRoster} />
                      </div>
                    )}

                    {componentTab === 'discussion' && row.component && (
                      <div style={{ marginTop: 10 }}>
                        <MHSDiscussionScorer component={row.component} studentId={row.studentId} onSaved={refreshRoster} />
                      </div>
                    )}

                    {componentTab === 'debate' && row.component && (
                      <div style={{ marginTop: 10 }}>
                        <MHSDebateScorer component={row.component} studentId={row.studentId} onSaved={refreshRoster} />
                      </div>
                    )}

                    {componentTab === 'omr' && row.component && (
                      <div style={{ marginTop: 10 }}>
                        <MHSOmrScorer component={row.component} studentId={row.studentId} answerKey={selectedLesson.omr_answer_key} onSaved={refreshRoster} />
                      </div>
                    )}

                    {componentTab === 'quiz' && viewAnswersStudentId === row.studentId && row.component && (
                      <div style={{ marginTop: 10 }}>
                        <MHSQuizAnswersPanel componentId={row.component.id} questions={selectedLesson.quiz_questions} />
                      </div>
                    )}

                    {row.component?.status === 'gate_flagged' && (
                      <div style={{ marginTop: 10 }}>
                        <MHSGateOverridePanel lessonComponentId={row.component.id} studentId={row.studentId} onDone={refreshRoster} />
                      </div>
                    )}

                    {expandedStudentId === row.studentId && (
                      <div style={{ marginTop: 10 }}>
                        <MHSHowScorer
                          lessonId={selectedLesson.id}
                          studentId={row.studentId}
                          onSaved={() => { setExpandedStudentId(null); void refreshRoster() }}
                        />
                      </div>
                    )}

                    {overrideStudentId === row.studentId && (
                      <GradeOverrideInline
                        courseId={row.courseId}
                        studentId={row.studentId}
                        onDone={() => { setOverrideStudentId(null); void refreshRoster() }}
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {showNewLesson && (
        <div
          onClick={() => setShowNewLesson(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}
          >
            <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Lesson</div>
              <button onClick={() => setShowNewLesson(false)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              <div>
                <label style={label}>Lesson title</label>
                <input value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} style={input} />
              </div>

              <div>
                <div style={sectionLabel}>Quiz Gate</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Gate threshold %</label>
                    <input value={newLesson.gateThreshold} onChange={(e) => setNewLesson((p) => ({ ...p, gateThreshold: e.target.value }))} placeholder="60" style={input} />
                  </div>
                  <div>
                    <label style={label}>Max attempts</label>
                    <input value={newLesson.maxAttempts} onChange={(e) => setNewLesson((p) => ({ ...p, maxAttempts: e.target.value }))} placeholder="3" style={input} />
                  </div>
                </div>
              </div>

              <div>
                <div style={sectionLabel}>Due Dates</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Notes due date</label>
                    <input type="date" value={newLesson.notesDueAt} onChange={(e) => setNewLesson((p) => ({ ...p, notesDueAt: e.target.value }))} style={input} />
                  </div>
                  <div>
                    <label style={label}>Discussion due date</label>
                    <input type="date" value={newLesson.discussionDueAt} onChange={(e) => setNewLesson((p) => ({ ...p, discussionDueAt: e.target.value }))} style={input} />
                  </div>
                </div>
              </div>

              <div>
                <div style={sectionLabel}>Discussion &amp; OMR</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Min. discussion words</label>
                    <input value={newLesson.minDiscussionWords} onChange={(e) => setNewLesson((p) => ({ ...p, minDiscussionWords: e.target.value }))} placeholder="150" style={input} />
                  </div>
                  <div>
                    <label style={label}>OMR answer key</label>
                    <input value={newLesson.omrAnswerKey} onChange={(e) => setNewLesson((p) => ({ ...p, omrAnswerKey: e.target.value }))} placeholder="ABCAD…" style={{ ...input, fontFamily: 'monospace' }} />
                  </div>
                </div>
              </div>

              <div>
                <div style={sectionLabel}>Quiz Questions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newQuestions.map((q, qi) => (
                    <div key={qi} style={{ padding: 10, background: '#F7F9FC', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} placeholder={`Question ${qi + 1}`} style={input} />
                      {q.choices.map((c, ci) => (
                        <div key={ci} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="radio" checked={q.correctIndex === ci} onChange={() => updateQuestion(qi, { correctIndex: ci })} />
                          <input value={c} onChange={(e) => updateChoice(qi, ci, e.target.value)} placeholder={`Choice ${ci + 1}`} style={input} />
                        </div>
                      ))}
                    </div>
                  ))}
                  <button onClick={() => setNewQuestions((p) => [...p, { question: '', choices: ['', '', '', ''], correctIndex: 0 }])} style={{ ...btnPrimary, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}>+ Add question</button>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setShowNewLesson(false)} style={{ padding: '8px 16px', background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void createLesson()} style={btnPrimary}>Save Lesson</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GradeOverrideInline({ courseId, studentId, onDone }: { courseId: string; studentId: string; onDone: () => void }) {
  const profile = useAuthStore((s) => s.profile)
  const [letter, setLetter] = useState('A')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!reason.trim() || !profile) return
    setSaving(true)
    await applyGradeOverride(courseId, studentId, letter, reason.trim(), profile.id, profile.role)
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ marginTop: 10, padding: 10, background: '#FFF7ED', border: '1.5px solid #FDBA74', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={label}>Letter grade</label>
        <select value={letter} onChange={(e) => setLetter(e.target.value)} style={input}>
          {['A', 'B', 'B-', 'C', 'D', 'F', 'P', 'W', 'I', 'IP'].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <label style={label}>Reason (required, logged permanently)</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} style={input} />
      </div>
      <button onClick={() => void submit()} disabled={!reason.trim() || saving} style={{ padding: '7px 14px', background: reason.trim() ? '#D97706' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>
        {saving ? 'Saving…' : 'Apply Override'}
      </button>
    </div>
  )
}
