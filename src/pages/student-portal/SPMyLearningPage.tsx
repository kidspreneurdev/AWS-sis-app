import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { TYPE_ICONS, TYPE_COLORS, SUBJECT_COLORS, isActiveBool, type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress } from '@/pages/lms/lmsStore'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 6px rgba(26,54,94,.06)' }
const emptyState: React.CSSProperties = { padding: '16px 18px', borderRadius: 10, background: '#F8FAFC', border: '1px dashed #D7E0EA', fontSize: 12, color: '#7A92B0' }
const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'

function getLessonTimerKey(studentId: string, lessonId: string) {
  return `sp_learning_started_${studentId}_${lessonId}`
}

function getEmbedUrl(url: string): string {
  if (url.includes('docs.google.com/presentation')) {
    const base = url.replace(/\/pub(\?.*)?$/, '').replace(/\/edit(\?.*)?$/, '').replace(/\/embed(\?.*)?$/, '')
    return `${base}/embed?start=false&loop=false&rm=minimal`
  }
  const driveMatch = url.match(/\/file\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
  return url
}

function lessonElapsedMs(studentId: string | undefined, lessonId: string, openedAtMap: Record<string, number>) {
  const startedAt = studentId ? openedAtMap[lessonId] : undefined
  if (!startedAt) return 0
  return Math.max(0, Date.now() - startedAt)
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function paceMeta(progressPct: number, enrolment?: LMSEnrolment | null) {
  if (enrolment?.dueDate && enrolment.assignedAt) {
    const now = Date.now()
    const start = new Date(enrolment.assignedAt).getTime()
    const end = new Date(enrolment.dueDate).getTime()
    const totalDays = (end - start) / 86400000
    const daysPassed = (now - start) / 86400000
    const expectedPct = totalDays > 0 ? Math.min(100, Math.round((daysPassed / totalDays) * 100)) : 0
    const paceDiff = progressPct - expectedPct
    if (progressPct === 100) return { label: 'Complete', icon: '✅', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (daysPassed < 0) return { label: 'Not Started', icon: '○', color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
    if (paceDiff >= 10) return { label: 'Ahead of Pace', icon: '🏃‍♂️', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
    if (paceDiff >= -10) return { label: 'On Pace', icon: '🚶‍♂️', color: '#2563EB', bg: '#DBEAFE', bucket: 'on' as const }
    return { label: 'Off Pace', icon: '🐢', color: SP_RED, bg: '#FEE2E2', bucket: 'off' as const }
  }
  if (progressPct === 100) return { label: 'Complete', icon: '✅', color: SP_GREEN, bg: '#DCFCE7', bucket: 'ahead' as const }
  if (progressPct === 0) return { label: 'Not Started', icon: '○', color: '#64748B', bg: '#F1F5F9', bucket: 'not_started' as const }
  return { label: 'In Progress', icon: '⏳', color: '#0891B2', bg: '#E0F2FE', bucket: 'on' as const }
}

function contentStatus(item: LMSContent, progress: LMSProgress | undefined, passMark: number) {
  const completed = progress?.status === 'completed'
  const masteryPassed = progress?.masteryPassed === true || progress?.masteryPassed === 'TRUE'
  const hasMastery = item.hasMastery === true || item.hasMastery === 'TRUE'
  const hasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
  const assignScore = progress?.assignScore != null && !Number.isNaN(Number(progress.assignScore)) ? Number(progress.assignScore) : null

  if (hasAssignment && assignScore !== null) {
    return {
      text: `📋 ${assignScore}%`,
      color: assignScore >= passMark ? SP_GREEN : SP_RED,
    }
  }
  if (hasAssignment && progress?.assignStatus === 'submitted') {
    return { text: '📋 Awaiting score', color: '#D97706' }
  }
  if (hasAssignment) {
    return { text: '📋 Assignment due', color: '#64748B' }
  }
  if (hasMastery && masteryPassed) {
    return { text: `✓ Mastery${progress?.masteryScore != null ? ` · ${progress.masteryScore}%` : ''}`, color: SP_GREEN }
  }
  if (hasMastery) {
    return { text: '🎯 Mastery test', color: '#D97706' }
  }
  if (completed) {
    return { text: '✅ Completed', color: SP_GREEN }
  }
  return null
}

function LessonPreviewContent({
  item,
}: {
  item: LMSContent
}) {
  const [slideIdx, setSlideIdx] = useState(0)

  function renderContent() {
    const url = item.url || ''

    if (item.type === 'video') {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
      if (ytMatch) {
        return (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
            <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
          </div>
        )
      }
      return url
        ? (
          <div style={{ padding: 20 }}>
            <iframe src={url} style={{ width: '100%', height: 520, border: '1.5px solid #E4EAF2', borderRadius: 10 }} title={item.title} loading="lazy" />
          </div>
        )
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
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#1A1A2E', height: 390 }}>
            <div style={{ position: 'relative', width: '100%', transform: `translateY(-${slideIdx * SLIDE_H}px)`, transition: 'transform .3s ease' }}>
              <iframe src={embedUrl} style={{ width: '100%', height: slideCount * SLIDE_H + 100, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" allowFullScreen title={item.title} loading="lazy" />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'transparent' }} />
          </div>
          <div style={{ background: '#F0F4FA', padding: '10px 16px 12px', border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
            <div style={{ position: 'relative', height: 6, background: '#DDE6F0', borderRadius: 3, marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1A365E', borderRadius: 3, transition: 'width .2s' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSlideIdx((p) => Math.max(0, p - 1))} disabled={isFirst} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isFirst ? 'not-allowed' : 'pointer', background: isFirst ? '#E4EAF2' : '#1A365E', color: isFirst ? '#94A3B8' : '#fff' }}>◀ Prev</button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
              <button onClick={() => setSlideIdx((p) => Math.min(slideCount - 1, p + 1))} disabled={isLast} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isLast ? 'not-allowed' : 'pointer', background: isLast ? '#E4EAF2' : '#1A365E', color: isLast ? '#94A3B8' : '#fff' }}>Next ▶</button>
            </div>
          </div>
        </div>
      )
    }

    if (item.type === 'file' && url) {
      const driveMatch = url.match(/\/file\/d\/([^/]+)/)
      const previewUrl = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : url
      return <iframe src={previewUrl} style={{ width: '100%', height: 560, border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
    }

    if (item.type === 'link' && url) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Loading external content inline...</div>
          <iframe src={url} style={{ width: '100%', height: 500, border: '1.5px solid #E4EAF2', borderRadius: 10 }} sandbox="allow-scripts allow-same-origin allow-forms" loading="lazy" title={item.title} />
        </div>
      )
    }

    if (item.type === 'quiz') {
      let questions: Array<{ q: string; opts?: string[]; ans?: number }> = []
      try { questions = JSON.parse(item.quizJson || '[]') } catch { /* empty */ }
      if (!questions.length) return <div style={{ padding: 20, color: '#94A3B8' }}>No quiz questions defined yet.</div>
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
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

  return (
    <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F0F4FA', background: '#F7F9FC' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{item.unitTitle || 'Lesson Content'}</span>
        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#1A365E', fontWeight: 700 }}>↗ Open externally</a> : null}
      </div>
      {renderContent()}
    </div>
  )
}

export function SPMyLearningPage() {
  const { session } = useStudentPortal()
  const [courses, setCourses] = useState<LMSCourse[]>([])
  const [content, setContent] = useState<LMSContent[]>([])
  const [progress, setProgress] = useState<LMSProgress[]>([])
  const [enrolments, setEnrolments] = useState<LMSEnrolment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [openedAtMap, setOpenedAtMap] = useState<Record<string, number>>({})
  const [, setTimerNow] = useState(Date.now())

  useEffect(() => {
    if (!session) return
    void load()
  }, [session])

  useEffect(() => {
    if (!session) return
    try {
      const next: Record<string, number> = {}
      content.forEach((item) => {
        const raw = localStorage.getItem(getLessonTimerKey(session.dbId, item.id))
        if (raw) {
          const parsed = Number(raw)
          if (!Number.isNaN(parsed) && parsed > 0) next[item.id] = parsed
        }
      })
      setOpenedAtMap(next)
    } catch {
      setOpenedAtMap({})
    }
  }, [content, session])

  useEffect(() => {
    const id = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  async function load() {
    if (!session) return
    setLoading(true)

    const { data: enrolData } = await supabase.from('lms_enrolments').select('*')
    const allEnrolments: LMSEnrolment[] = (enrolData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      courseId: r.course_id as string,
      targetType: r.target_type as LMSEnrolment['targetType'],
      targetValue: r.target_value as string,
      assignedAt: (r.assigned_at as string) ?? '',
      paceType: (r.pace_type as string) ?? '',
      dueDate: (r.due_date as string) ?? '',
      active: r.active as boolean,
    }))

    const matched = allEnrolments.filter((entry) => {
      if (!isActiveBool(entry.active)) return false
      if (entry.targetType === 'student') return entry.targetValue === session.dbId
      if (entry.targetType === 'cohort') return entry.targetValue === session.cohort
      if (entry.targetType === 'grade') return entry.targetValue === session.grade || entry.targetValue === `Grade ${session.grade}`
      return false
    })

    setEnrolments(matched)

    if (!matched.length) {
      setCourses([])
      setContent([])
      setProgress([])
      setLoading(false)
      return
    }

    const courseIds = [...new Set(matched.map((entry) => entry.courseId))]
    const [{ data: cData }, { data: coData }, { data: prData }] = await Promise.all([
      supabase.from('lms_courses').select('*').in('id', courseIds),
      supabase.from('lms_content').select('*').in('course_id', courseIds).order('module_order').order('unit_order').order('order_idx'),
      supabase.from('lms_progress').select('*').eq('student_id', session.dbId),
    ])

    const mappedCourses: LMSCourse[] = (cData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: (r.title as string) ?? '',
      subject: (r.subject as string) ?? '',
      gradeLevel: (r.grade_level as string) ?? '',
      description: (r.description as string) ?? '',
      passMark: Number(r.pass_mark ?? 70),
      creditHours: Number(r.credit_hours ?? 0),
      requiredHours: Number(r.required_hours ?? 0),
      status: (r.status as LMSCourse['status']) ?? 'Draft',
      announcement: (r.announcement as string) ?? '',
    }))

    const publishedCourses = mappedCourses.filter((course) => course.status?.toLowerCase() === 'published')

    const mappedContent: LMSContent[] = (coData ?? []).map((r: Record<string, unknown>) => {
      const extra = (() => {
        try { return JSON.parse(((r.extra as string) || '{}')) as Record<string, unknown> } catch { return (r.extra as Record<string, unknown>) ?? {} }
      })()
      return {
        id: r.id as string,
        courseId: r.course_id as string,
        title: (r.title as string) ?? '',
        type: (r.type as LMSContent['type']) ?? 'article',
        url: (extra.url as string) ?? '',
        body: (extra.body as string) ?? '',
        unitTitle: (r.unit_title as string) ?? '',
        unitOrder: Number(r.unit_order ?? 0),
        order: Number(r.order_idx ?? 0),
        estimatedMins: Number(extra.estimatedMins ?? 0) || undefined,
        moduleTitle: (r.module_title as string) ?? '',
        moduleOrder: Number(r.module_order ?? 0) || undefined,
        hasMastery: extra.hasMastery as boolean | 'TRUE' | undefined,
        masteryPassMark: Number(extra.masteryPassMark ?? 0) || undefined,
        hasAssignment: extra.hasAssignment as boolean | 'TRUE' | undefined,
      }
    })

    const mappedProgress: LMSProgress[] = (prData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      studentId: r.student_id as string,
      courseId: r.course_id as string,
      contentId: r.content_id as string,
      status: (r.status as LMSProgress['status']) ?? 'not_started',
      masteryScore: r.mastery_score as number | null,
      masteryPassed: r.mastery_passed === true,
      assignScore: r.assign_score as number | null,
      assignStatus: (r.assign_status as string) ?? undefined,
      timeSpentMins: Number(r.time_spent_mins ?? 0),
    }))

    setCourses(publishedCourses.length ? publishedCourses : mappedCourses)
    setContent(mappedContent)
    setProgress(mappedProgress)
    setLoading(false)
  }

  async function markComplete(item: LMSContent) {
    if (!session) return
    const existing = progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId)
    const next = existing?.status === 'completed' ? 'in_progress' : 'completed'
    await supabase.from('lms_progress').upsert({
      id: existing?.id ?? `${session.dbId}_${item.id}`,
      student_id: session.dbId,
      course_id: item.courseId,
      content_id: item.id,
      status: next,
      completed_at: next === 'completed' ? new Date().toISOString() : null,
    }, { onConflict: 'student_id,content_id' })

    setProgress((prev) => {
      const filtered = prev.filter((entry) => !(entry.contentId === item.id && entry.studentId === session.dbId))
      return [...filtered, { ...existing, studentId: session.dbId, courseId: item.courseId, contentId: item.id, status: next }]
    })
  }

  function openLesson(item: LMSContent) {
    if (!session) {
      setActiveLessonId(item.id)
      return
    }
    const existing = openedAtMap[item.id]
    if (!existing) {
      const startedAt = Date.now()
      setOpenedAtMap((prev) => ({ ...prev, [item.id]: startedAt }))
      try {
        localStorage.setItem(getLessonTimerKey(session.dbId, item.id), String(startedAt))
      } catch {
        // ignore storage failures
      }
    }
    setActiveLessonId(item.id)
  }

  const subjects = useMemo(() => {
    const values = [...new Set(courses.map((course) => course.subject).filter(Boolean))]
    return ['All', ...values]
  }, [courses])

  const courseProgress = (courseId: string) => {
    const items = content.filter((item) => item.courseId === courseId)
    if (!items.length || !session) return 0
    const done = items.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId && entry.status === 'completed')).length
    return Math.round((done / items.length) * 100)
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (subjectFilter !== 'All' && course.subject !== subjectFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return course.title.toLowerCase().includes(q) || course.subject.toLowerCase().includes(q) || course.description.toLowerCase().includes(q)
    })
  }, [courses, search, subjectFilter])

  const paceSummary = useMemo(() => {
    let ahead = 0
    let on = 0
    let off = 0
    let notStarted = 0

    courses.forEach((course) => {
      const enrolment = enrolments.find((entry) => entry.courseId === course.id)
      const pct = courseProgress(course.id)
      const meta = paceMeta(pct, enrolment)
      if (meta.bucket === 'ahead') ahead += 1
      else if (meta.bucket === 'on') on += 1
      else if (meta.bucket === 'off') off += 1
      else notStarted += 1
    })

    return { ahead, on, off, notStarted }
  }, [courses, enrolments, content, progress, session])

  const selectedCourse = activeCourse ? courses.find((course) => course.id === activeCourse) ?? null : null
  const selectedEnrolment = selectedCourse ? enrolments.find((entry) => entry.courseId === selectedCourse.id) ?? null : null
  const courseItems = useMemo(() => {
    if (!selectedCourse) return []
    return content
      .filter((item) => item.courseId === selectedCourse.id)
      .sort((a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.unitOrder ?? 0) - (b.unitOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
  }, [content, selectedCourse])

  const groupedModules = useMemo(() => {
    const modules = new Map<string, { label: string; units: Map<string, LMSContent[]> }>()
    courseItems.forEach((item) => {
      const moduleKey = item.moduleTitle || '__default__'
      if (!modules.has(moduleKey)) modules.set(moduleKey, { label: item.moduleTitle || '', units: new Map() })
      const module = modules.get(moduleKey)!
      const unitKey = item.unitTitle || 'Lessons'
      if (!module.units.has(unitKey)) module.units.set(unitKey, [])
      module.units.get(unitKey)!.push(item)
    })
    return [...modules.values()]
  }, [courseItems])
  const activeLesson = activeLessonId ? courseItems.find((item) => item.id === activeLessonId) ?? null : null

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: '#7A92B0', fontSize: 13 }}>Loading your courses…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>📚 My Learning</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{courses.length} course{courses.length !== 1 ? 's' : ''} assigned to you</div>
        </div>
        {!selectedCourse && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            style={{ padding: '8px 12px', border: '1.5px solid #E4EAF2', borderRadius: 9, fontSize: 12, minWidth: 190, outline: 'none', fontFamily: 'Poppins,sans-serif' }}
          />
        )}
      </div>

      {!selectedCourse && (
        <>
          {subjects.length > 2 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              {subjects.map((subject) => {
                const active = subjectFilter === subject
                return (
                  <button
                    key={subject}
                    onClick={() => setSubjectFilter(subject)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? SP_NAVY : '#E4EAF2'}`,
                      background: active ? SP_NAVY : '#fff',
                      color: active ? '#fff' : '#5A7290',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Poppins,sans-serif',
                    }}
                  >
                    {subject}
                  </button>
                )
              })}
            </div>
          )}

          {courses.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {paceSummary.ahead > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DCFCE7', borderRadius: 10, border: '1px solid #059669' }}><span style={{ fontSize: 16 }}>🏃‍♂️</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>{paceSummary.ahead}</div><div style={{ fontSize: 9, color: '#059669' }}>Ahead of Pace</div></div></div>}
              {paceSummary.on > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#DBEAFE', borderRadius: 10, border: '1px solid #2563EB' }}><span style={{ fontSize: 16 }}>🚶‍♂️</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#2563EB' }}>{paceSummary.on}</div><div style={{ fontSize: 9, color: '#2563EB' }}>On Pace</div></div></div>}
              {paceSummary.off > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEE2E2', borderRadius: 10, border: '1px solid #D61F31' }}><span style={{ fontSize: 16 }}>🐢</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#D61F31' }}>{paceSummary.off}</div><div style={{ fontSize: 9, color: '#D61F31' }}>Off Pace</div></div></div>}
              {paceSummary.notStarted > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F1F5F9', borderRadius: 10, border: '1px solid #94A3B8' }}><span style={{ fontSize: 16 }}>○</span><div><div style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>{paceSummary.notStarted}</div><div style={{ fontSize: 9, color: '#64748B' }}>Not Started</div></div></div>}
            </div>
          )}

          {courses.length === 0 ? (
            <div style={{ ...card, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No courses assigned yet</div>
              <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 6 }}>No learning data is available from Supabase for this section yet.</div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={{ ...card, ...emptyState, textAlign: 'center' }}>No courses match your search right now.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
              {filteredCourses.map((course) => {
                const pct = courseProgress(course.id)
                const enrolment = enrolments.find((entry) => entry.courseId === course.id) ?? null
                const pace = paceMeta(pct, enrolment)
                const subjectCol = SUBJECT_COLORS[course.subject] || '#1A365E'
                const courseContent = content.filter((item) => item.courseId === course.id)
                const doneCount = courseContent.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId && entry.status === 'completed')).length
                const pendingAssignments = courseContent.filter((item) => {
                  const hasAssignment = item.hasAssignment === true || item.hasAssignment === 'TRUE'
                  if (!hasAssignment || !session) return false
                  const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session.dbId)
                  const assignScore = itemProgress?.assignScore != null && !Number.isNaN(Number(itemProgress.assignScore)) ? Number(itemProgress.assignScore) : null
                  return itemProgress && assignScore === null
                }).length

                return (
                  <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setActiveCourse(course.id)}>
                    <div style={{ height: 6, background: subjectCol }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>{course.title}</div>
                      <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 10 }}>{course.subject}{course.gradeLevel ? ` · ${course.gradeLevel}` : ''}</div>
                      <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 10, lineHeight: 1.5 }}>{course.description ? `${course.description.slice(0, 80)}${course.description.length > 80 ? '…' : ''}` : 'No course description available yet.'}</div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: '#7A92B0' }}>{doneCount}/{courseContent.length} lessons</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : SP_NAVY }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? SP_GREEN : pct >= 40 ? '#D97706' : subjectCol, borderRadius: 3, transition: 'width .5s' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#7A92B0', flexWrap: 'wrap' }}>
                          <span>📄 {courseContent.length} lessons</span>
                          {enrolment?.dueDate && <span>📅 Due: {enrolment.dueDate}</span>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: pace.color, background: pace.bg, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', border: `1px solid ${pace.color}33` }}>
                          {pace.icon} {pace.label}
                        </span>
                      </div>
                      {pendingAssignments > 0 && (
                        <div style={{ marginBottom: 6, padding: '5px 10px', background: '#FEF3C7', borderRadius: 7, fontSize: 10, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📋</span><span>{pendingAssignments} assignment{pendingAssignments !== 1 ? 's' : ''} need attention</span>
                        </div>
                      )}
                      {course.announcement?.trim() ? (
                        <div style={{ marginBottom: 8, padding: '7px 10px', background: '#1A365E0D', borderLeft: '3px solid #1A365E', borderRadius: '0 7px 7px 0', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>📢</span>
                          <div style={{ fontSize: 10, color: '#1A365E', lineHeight: 1.5 }}>{course.announcement.length > 80 ? `${course.announcement.slice(0, 80)}…` : course.announcement}</div>
                        </div>
                      ) : (
                        <div style={{ ...emptyState, marginBottom: 8, padding: '8px 10px' }}>No course announcement posted yet.</div>
                      )}
                      <div style={{ marginTop: 8, padding: '8px 12px', background: subjectCol, color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                        {pct === 0 ? '▶ Start Course' : pct === 100 ? '🔁 Review' : '▶ Continue'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedCourse && !activeLesson && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedCourse.announcement?.trim() ? (
            <div style={{ background: 'linear-gradient(135deg,#1A365E,#0F2240)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>📢</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Course Announcement</div>
                <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>{selectedCourse.announcement}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course announcement has been posted for this course yet.</div>
          )}

          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ height: 6, background: SUBJECT_COLORS[selectedCourse.subject] || SP_NAVY }} />
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setActiveCourse(null)} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>{selectedCourse.title}</div>
                <div style={{ fontSize: 11, color: '#7A92B0' }}>{selectedCourse.subject || 'No subject'} · Pass: {selectedCourse.passMark || 80}%</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>
                {courseItems.filter((item) => progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId && entry.status === 'completed')).length} / {courseItems.length} lessons completed
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: courseProgress(selectedCourse.id) === 100 ? SP_GREEN : courseProgress(selectedCourse.id) >= 50 ? '#D97706' : SP_NAVY }}>{courseProgress(selectedCourse.id)}%</div>
            </div>
            <div style={{ height: 8, background: '#F0F4FA', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${courseProgress(selectedCourse.id)}%`, background: courseProgress(selectedCourse.id) === 100 ? SP_GREEN : courseProgress(selectedCourse.id) >= 50 ? '#D97706' : SP_NAVY, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Average mastery</strong><br />
                {(() => {
                  const mastery = progress.filter((entry) => entry.courseId === selectedCourse.id && entry.studentId === session?.dbId && entry.masteryScore != null)
                  return mastery.length ? `${Math.round(mastery.reduce((sum, entry) => sum + Number(entry.masteryScore ?? 0), 0) / mastery.length)}%` : 'No mastery data available'
                })()}
              </div>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Time requirement</strong><br />
                {selectedCourse.requiredHours > 0 ? `${selectedCourse.requiredHours} hrs required` : 'No time requirement set'}
              </div>
              <div style={{ ...emptyState, padding: '10px 12px' }}>
                <strong style={{ color: '#1A365E' }}>Due date</strong><br />
                {selectedEnrolment?.dueDate || 'No due date set'}
              </div>
            </div>
          </div>

          {selectedCourse.description ? (
            <div style={{ ...card, padding: '14px 16px', fontSize: 12, color: '#5A7290', lineHeight: 1.6 }}>{selectedCourse.description}</div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No course description is available from Supabase for this course yet.</div>
          )}

          {courseItems.length === 0 ? (
            <div style={{ ...card, ...emptyState }}>No lessons or learning content are available from Supabase for this course yet.</div>
          ) : (
            groupedModules.map((module, moduleIdx) => (
              <div key={`${module.label || 'default'}-${moduleIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {module.label ? <div style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>🗂 {module.label}</div> : null}
                {[...module.units.entries()].map(([unit, items]) => (
                  <div key={unit} style={{ ...card, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', background: '#F7F9FC', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 800, color: '#1A365E' }}>
                      📂 {unit}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {items.map((item, idx) => {
                        const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === session?.dbId)
                        const done = itemProgress?.status === 'completed'
                        const typeColor = TYPE_COLORS[item.type] || '#6B7280'
                        const badge = contentStatus(item, itemProgress, selectedCourse.passMark || 80)
                        const elapsedMs = lessonElapsedMs(session?.dbId, item.id, openedAtMap)
                        const requiredMs = (item.estimatedMins ?? 0) * 60 * 1000
                        const canMarkDone = !item.estimatedMins || elapsedMs >= requiredMs
                        const remainingMs = Math.max(0, requiredMs - elapsedMs)
                        return (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: idx < items.length - 1 ? '1px solid #F0F4FA' : 'none' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${typeColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                              {TYPE_ICONS[item.type] || '📄'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{item.title}</div>
                              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#7A92B0', marginTop: 2, flexWrap: 'wrap' }}>
                                <span>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
                                {item.estimatedMins ? <span>⏱ {item.estimatedMins} min</span> : <span>⏱ No estimate</span>}
                                {badge ? <span style={{ color: badge.color, fontWeight: 700 }}>{badge.text}</span> : <span>No progress yet</span>}
                                {item.estimatedMins ? (
                                  <span style={{ color: canMarkDone ? '#059669' : '#D97706', fontWeight: 700 }}>
                                    {canMarkDone ? 'Timer complete' : `Remaining ${formatRemaining(remainingMs)}`}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <button onClick={() => openLesson(item)} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              {item.estimatedMins ? 'Start Lesson' : 'Open Lesson'}
                            </button>
                            <button disabled={!done && !canMarkDone} onClick={() => void markComplete(item)} style={{ padding: '5px 12px', background: done ? '#DCFCE7' : canMarkDone ? '#F0F4FA' : '#F8FAFC', color: done ? '#059669' : canMarkDone ? '#5A7290' : '#94A3B8', border: `1px solid ${done ? '#86EFAC' : canMarkDone ? '#E4EAF2' : '#E5E7EB'}`, borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: done || canMarkDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              {done ? '✓ Done' : 'Mark done'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Course Discussion</div>
            <div style={emptyState}>Course discussion is not yet wired in this React page, so no discussion data is available here yet.</div>
          </div>
        </div>
      )}
      {selectedCourse && activeLesson && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 11, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setActiveLessonId(null)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.22)', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Course</button>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{activeLesson.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.78)' }}>{activeLesson.type}{activeLesson.estimatedMins ? ` · ${activeLesson.estimatedMins} min` : ''}</div>
              </div>
            </div>
            {activeLesson.url ? <a href={activeLesson.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>↗ Open externally</a> : null}
          </div>

          <LessonPreviewContent item={activeLesson} />

          <div style={{ ...card, padding: 16 }}>
            {(() => {
              const itemProgress = progress.find((entry) => entry.contentId === activeLesson.id && entry.studentId === session?.dbId)
              const done = itemProgress?.status === 'completed'
              const elapsedMs = lessonElapsedMs(session?.dbId, activeLesson.id, openedAtMap)
              const requiredMs = (activeLesson.estimatedMins ?? 0) * 60 * 1000
              const canMarkDone = !activeLesson.estimatedMins || elapsedMs >= requiredMs
              const remainingMs = Math.max(0, requiredMs - elapsedMs)
              const badge = contentStatus(activeLesson, itemProgress, selectedCourse.passMark || 80)
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>Lesson Progress</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#7A92B0' }}>
                      <span>{activeLesson.type.charAt(0).toUpperCase() + activeLesson.type.slice(1)}</span>
                      {activeLesson.estimatedMins ? <span>⏱ {activeLesson.estimatedMins} min required</span> : <span>⏱ No minimum time</span>}
                      {badge ? <span style={{ color: badge.color, fontWeight: 700 }}>{badge.text}</span> : null}
                      {activeLesson.estimatedMins ? (
                        <span style={{ color: canMarkDone ? '#059669' : '#D97706', fontWeight: 700 }}>
                          {canMarkDone ? 'Timer complete' : `Remaining ${formatRemaining(remainingMs)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button disabled={!done && !canMarkDone} onClick={() => void markComplete(activeLesson)} style={{ padding: '9px 16px', background: done ? '#DCFCE7' : canMarkDone ? '#1A365E' : '#E5E7EB', color: done ? '#059669' : canMarkDone ? '#fff' : '#94A3B8', border: `1px solid ${done ? '#86EFAC' : canMarkDone ? '#1A365E' : '#E5E7EB'}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: done || canMarkDone ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {done ? '✓ Done' : 'Mark done'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
