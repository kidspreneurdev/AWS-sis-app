import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, CheckCircle2, ClipboardList, Hourglass, XCircle, Circle, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { isActiveBool, type LMSContent, type LMSCourse, type LMSEnrolment, type LMSProgress } from '@/pages/lms/lmsStore'
import { getEffectiveRubric } from '@/lib/lms/caseStudyRubric'
import { card, emptyState, SP_NAVY, SP_GREEN, SP_RED } from './gradesShared'

interface CSScoreData { componentType: string; criteriaScores: Record<string, number>; subtotal: number | null; feedback: string | null; status: 'not_scored' | 'scored' }
interface MySubmission { contentId: string; kind: string; submittedAt: string }

async function studentPortalFetch(token: string | null, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error || 'Request failed.')
  return body
}

const STATUS_META: Record<string, { bg: string; color: string; icon: LucideIcon }> = {
  Scored: { bg: '#DCFCE7', color: '#1DBD6A', icon: CheckCircle2 },
  Passed: { bg: '#DCFCE7', color: '#1DBD6A', icon: CheckCircle2 },
  Submitted: { bg: '#DBEAFE', color: '#1E40AF', icon: ClipboardList },
  Pending: { bg: '#FEF3C7', color: '#B45309', icon: Hourglass },
  'Not Submitted': { bg: '#FEE2E2', color: '#D61F31', icon: XCircle },
  Failed: { bg: '#FEE2E2', color: '#D61F31', icon: XCircle },
  'Not Started': { bg: '#F1F5F9', color: '#64748B', icon: Circle },
}

interface ModuleGroup { unit: string; carrierItem: LMSContent | null; lessonItems: LMSContent[] }

function groupIntoModules(items: LMSContent[]): ModuleGroup[] {
  const units = new Map<string, LMSContent[]>()
  items.forEach((item) => {
    const unitKey = item.unitTitle || 'Lessons'
    if (!units.has(unitKey)) units.set(unitKey, [])
    units.get(unitKey)!.push(item)
  })
  return [...units.entries()].map(([unit, unitItems]) => {
    const carrierItem = unitItems.find((i) => isActiveBool(i.hasAssignment)) ?? null
    return { unit, carrierItem, lessonItems: unitItems.filter((i) => i !== carrierItem) }
  })
}

interface GradeRow { id: string; name: string; sectionLabel: string; due: string; submitted: string; status: keyof typeof STATUS_META; score: string; scoreGood: boolean | null; achieved: number | null; max: number | null }

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function buildModuleRows(
  module: ModuleGroup,
  course: LMSCourse,
  scoreByType: Record<string, CSScoreData | undefined>,
  submissionsByContentKind: Map<string, MySubmission>,
  progress: LMSProgress[],
  studentId: string,
): GradeRow[] {
  const { carrierItem, lessonItems, unit } = module
  const rows: GradeRow[] = []

  if (carrierItem) {
    const notesRubric = getEffectiveRubric(carrierItem.rubricOverrides, 'notes')
    const notesScore = scoreByType.notes
    const caseStudyNotesSub = submissionsByContentKind.get(`${carrierItem.id}::case_study_notes`)
    const lessonNotesSubs = lessonItems.map((item) => submissionsByContentKind.get(`${item.id}::lesson_notes`)).filter(Boolean) as MySubmission[]
    const anyNotesSubmitted = Boolean(caseStudyNotesSub) || lessonNotesSubs.length > 0
    const latestNotesDate = [caseStudyNotesSub, ...lessonNotesSubs]
      .filter(Boolean)
      .map((s) => new Date((s as MySubmission).submittedAt).getTime())
      .sort((a, b) => b - a)[0]
    const notesStatus: GradeRow['status'] = notesScore?.status === 'scored' ? 'Scored' : anyNotesSubmitted ? 'Submitted' : 'Not Submitted'
    rows.push({
      id: `${unit}::notes`,
      name: 'Notes Score',
      sectionLabel: 'Learn It',
      due: '—',
      submitted: latestNotesDate ? formatDate(new Date(latestNotesDate).toISOString()) : '—',
      status: notesStatus,
      score: notesScore?.status === 'scored' && notesScore.subtotal != null ? `${notesScore.subtotal}/${notesRubric.weight}` : '—',
      scoreGood: notesScore?.status === 'scored' && notesScore.subtotal != null ? notesScore.subtotal / notesRubric.weight >= 0.7 : null,
      achieved: notesScore?.status === 'scored' && notesScore.subtotal != null ? notesScore.subtotal : null,
      max: notesRubric.weight,
    })
  }

  lessonItems.forEach((item, idx) => {
    if (!isActiveBool(item.hasMastery)) return
    const itemProgress = progress.find((entry) => entry.contentId === item.id && entry.studentId === studentId)
    const masteryScore = itemProgress?.masteryScore != null && !Number.isNaN(Number(itemProgress.masteryScore)) ? Number(itemProgress.masteryScore) : null
    const passMark = item.masteryPassMark ?? course.passMark
    const status: GradeRow['status'] = masteryScore === null ? 'Not Started' : masteryScore >= passMark ? 'Passed' : 'Failed'
    rows.push({
      id: `${unit}::mastery::${item.id}`,
      name: `Lesson ${idx + 1}: ${item.title} — Mastery Test`,
      sectionLabel: 'Do It',
      due: '—',
      submitted: '—',
      status,
      score: masteryScore !== null ? `${masteryScore}%` : '—',
      scoreGood: masteryScore !== null ? masteryScore >= passMark : null,
      achieved: masteryScore,
      max: masteryScore !== null ? 100 : null,
    })
  })

  if (carrierItem) {
    const debateRubric = getEffectiveRubric(carrierItem.rubricOverrides, 'debate')
    const debateScore = scoreByType.debate
    rows.push({
      id: `${unit}::debate`,
      name: 'Socratic Debate Score',
      sectionLabel: 'Show It',
      due: carrierItem.socraticDate || '—',
      submitted: '—',
      status: debateScore?.status === 'scored' ? 'Scored' : 'Pending',
      score: debateScore?.status === 'scored' && debateScore.subtotal != null ? `${debateScore.subtotal}/${debateRubric.weight}` : '—',
      scoreGood: debateScore?.status === 'scored' && debateScore.subtotal != null ? debateScore.subtotal / debateRubric.weight >= 0.7 : null,
      achieved: debateScore?.status === 'scored' && debateScore.subtotal != null ? debateScore.subtotal : null,
      max: debateRubric.weight,
    })

    const omrRubric = getEffectiveRubric(carrierItem.rubricOverrides, 'omr')
    const omrScore = scoreByType.omr
    rows.push({
      id: `${unit}::omr`,
      name: 'OMR Test Score',
      sectionLabel: 'Prove It',
      due: '—',
      submitted: '—',
      status: omrScore?.status === 'scored' ? 'Scored' : 'Pending',
      score: omrScore?.status === 'scored' && omrScore.subtotal != null ? `${omrScore.subtotal}/${omrRubric.weight}` : '—',
      scoreGood: omrScore?.status === 'scored' && omrScore.subtotal != null ? omrScore.subtotal / omrRubric.weight >= 0.7 : null,
      achieved: omrScore?.status === 'scored' && omrScore.subtotal != null ? omrScore.subtotal : null,
      max: omrRubric.weight,
    })

    const presentationRubric = getEffectiveRubric(carrierItem.rubricOverrides, 'presentation')
    const presentationScore = scoreByType.presentation
    const presentationSub = submissionsByContentKind.get(`${carrierItem.id}::presentation`)
    const presentationStatus: GradeRow['status'] = presentationScore?.status === 'scored' ? 'Scored' : presentationSub ? 'Submitted' : 'Not Submitted'
    rows.push({
      id: `${unit}::presentation`,
      name: 'Final Presentation Score',
      sectionLabel: 'Master It',
      due: '—',
      submitted: presentationSub ? formatDate(presentationSub.submittedAt) : '—',
      status: presentationStatus,
      score: presentationScore?.status === 'scored' && presentationScore.subtotal != null ? `${presentationScore.subtotal}/${presentationRubric.weight}` : '—',
      scoreGood: presentationScore?.status === 'scored' && presentationScore.subtotal != null ? presentationScore.subtotal / presentationRubric.weight >= 0.7 : null,
      achieved: presentationScore?.status === 'scored' && presentationScore.subtotal != null ? presentationScore.subtotal : null,
      max: presentationRubric.weight,
    })
  }

  return rows
}

export function SPCourseGradesSection() {
  const { session, getToken } = useStudentPortal()
  const [courses, setCourses] = useState<LMSCourse[]>([])
  const [content, setContent] = useState<LMSContent[]>([])
  const [progress, setProgress] = useState<LMSProgress[]>([])
  const [scoresByContentId, setScoresByContentId] = useState<Record<string, CSScoreData[]>>({})
  const [submissions, setSubmissions] = useState<MySubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function load() {
    if (!session) return
    setLoading(true)

    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const sessionGradeNorm = norm(session.grade)
    const sessionCohortNorm = norm(session.cohort)

    const { data: enrolData } = await supabase.from('lms_enrolments').select('*')
    const allEnrolments: LMSEnrolment[] = (enrolData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      courseId: r.course_id as string,
      targetType: r.target_type as LMSEnrolment['targetType'],
      targetValue: r.target_value as string,
      active: r.active as boolean,
    }))
    const matched = allEnrolments.filter((entry) => {
      if (!isActiveBool(entry.active)) return false
      const targetType = norm(entry.targetType)
      const targetValueNorm = norm(entry.targetValue)
      if (targetType === 'student') return targetValueNorm === norm(session.dbId)
      if (targetType === 'cohort') return targetValueNorm === sessionCohortNorm
      if (targetType === 'grade') return targetValueNorm === sessionGradeNorm || targetValueNorm === norm(`Grade ${session.grade}`)
      return false
    })

    if (!matched.length) {
      setCourses([]); setContent([]); setProgress([]); setScoresByContentId({}); setSubmissions([]); setLoading(false)
      return
    }

    const courseIds = [...new Set(matched.map((entry) => entry.courseId))]
    const [{ data: cData }, { data: prData }] = await Promise.all([
      supabase.from('lms_courses').select('*').in('id', courseIds),
      supabase.from('lms_progress').select('*').eq('student_id', session.dbId),
    ])

    const groupIds = [...new Set((cData ?? []).map((r: Record<string, unknown>) => (r.group_id as string) ?? (r.id as string)).filter(Boolean))]
    const { data: coData } = await supabase.from('lms_content').select('*')
      .in('course_id', groupIds).order('unit_order').order('module_order').order('order_idx')

    const mappedCourses: LMSCourse[] = (cData ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      groupId: (r.group_id as string) ?? null,
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
    const publishedCourses = mappedCourses.filter((c) => c.status?.toLowerCase() === 'published')

    const mappedContent: LMSContent[] = (coData ?? []).map((r: Record<string, unknown>) => {
      const extra = (() => {
        try { return JSON.parse(((r.extra as string) || '{}')) as Record<string, unknown> } catch { return (r.extra as Record<string, unknown>) ?? {} }
      })()
      return {
        id: r.id as string,
        courseId: r.course_id as string,
        title: (r.title as string) ?? '',
        type: (r.type as LMSContent['type']) ?? 'article',
        unitTitle: (r.unit_title as string) ?? '',
        unitOrder: r.unit_order == null ? undefined : Number(r.unit_order),
        order: Number(r.order_idx ?? 0),
        moduleTitle: (r.module_title as string) ?? '',
        moduleOrder: Number(r.module_order ?? 0) || undefined,
        hasMastery: extra.hasMastery as boolean | 'TRUE' | undefined,
        masteryPassMark: Number(extra.masteryPassMark ?? 0) || undefined,
        hasAssignment: extra.hasAssignment as boolean | 'TRUE' | undefined,
        caseStudyUrl: (extra.caseStudyUrl as string) ?? undefined,
        socraticDate: (extra.socraticDate as string) ?? undefined,
        rubricOverrides: extra.rubricOverrides as LMSContent['rubricOverrides'],
      }
    })

    const unitOrderByKey = new Map<string, number>()
    mappedContent.forEach((c) => { if (c.unitOrder !== undefined) unitOrderByKey.set(`${c.courseId}::${c.unitTitle}`, c.unitOrder) })
    const backfilledContent = mappedContent.map((c) => (
      c.unitOrder === undefined ? { ...c, unitOrder: unitOrderByKey.get(`${c.courseId}::${c.unitTitle}`) ?? 0 } : c
    ))

    const mappedProgress: LMSProgress[] = (prData ?? []).map((r: Record<string, unknown>) => ({
      studentId: r.student_id as string,
      courseId: r.course_id as string,
      contentId: r.content_id as string,
      status: (r.status as LMSProgress['status']) ?? 'not_started',
      masteryScore: r.mastery_score as number | null,
    }))

    setCourses(publishedCourses.length ? publishedCourses : mappedCourses)
    setContent(backfilledContent)
    setProgress(mappedProgress)

    const token = getToken()
    const carrierIds = [...new Set(backfilledContent.filter((i) => isActiveBool(i.hasAssignment)).map((i) => i.id))]
    const [bundles, subsData] = await Promise.all([
      Promise.all(carrierIds.map(async (contentId) => {
        try {
          const data = await studentPortalFetch(token, `/api/student-portal/lms-get-case-study?contentId=${contentId}`)
          return [contentId, (data as { scores: CSScoreData[] }).scores ?? []] as const
        } catch {
          return [contentId, []] as const
        }
      })),
      studentPortalFetch(token, '/api/student-portal/lms-get-my-submissions').catch(() => ({ submissions: [] })),
    ])
    setScoresByContentId(Object.fromEntries(bundles))
    setSubmissions((subsData as { submissions: MySubmission[] }).submissions ?? [])

    setLoading(false)
  }

  const courseModules = useMemo(() => {
    return courses.map((course) => {
      const items = content
        .filter((item) => item.courseId === (course.groupId ?? course.id))
        .sort((a, b) => (a.unitOrder ?? 0) - (b.unitOrder ?? 0) || (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
      return { course, modules: groupIntoModules(items) }
    }).filter((entry) => entry.modules.length > 0)
  }, [courses, content])

  const courseIdsWithModules = useMemo(() => courseModules.map((entry) => entry.course.id), [courseModules])
  const activeCourseId = selectedCourseId && courseIdsWithModules.includes(selectedCourseId) ? selectedCourseId : (courseIdsWithModules[0] ?? null)
  const activeEntry = activeCourseId ? courseModules.find((entry) => entry.course.id === activeCourseId) ?? null : null

  const submissionsByContentKind = useMemo(() => {
    return new Map(submissions.map((s) => [`${s.contentId}::${s.kind}`, s]))
  }, [submissions])

  const rows = useMemo(() => {
    if (!activeEntry || !session) return []
    return activeEntry.modules.flatMap((module) => {
      const scores = module.carrierItem ? scoresByContentId[module.carrierItem.id] ?? [] : []
      const scoreByType = Object.fromEntries(scores.map((s) => [s.componentType, s])) as Record<string, CSScoreData | undefined>
      return buildModuleRows(module, activeEntry.course, scoreByType, submissionsByContentKind, progress, session.dbId).map((row) => ({ ...row, unit: module.unit }))
    })
  }, [activeEntry, scoresByContentId, submissionsByContentKind, progress, session])

  const totals = useMemo(() => {
    let achieved = 0
    let max = 0
    rows.forEach((row) => {
      if (row.achieved != null && row.max != null) {
        achieved += row.achieved
        max += row.max
      }
    })
    return { achieved, max, pct: max > 0 ? Math.round((achieved / max) * 100) : null }
  }, [rows])

  if (!session) return null
  if (loading) return <div style={{ ...card, ...emptyState, textAlign: 'center' }}>Loading course grades…</div>
  if (courseModules.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={16} /> Course Grades</div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <BookOpen size={15} color={SP_NAVY} />
          <span style={{ fontSize: 16, fontWeight: 700, color: SP_NAVY, flexShrink: 0 }}>Course</span>
          <select
            value={activeCourseId ?? ''}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 17, fontWeight: 700,
              color: SP_NAVY, background: '#fff', fontFamily: 'Poppins,sans-serif', cursor: 'pointer', minWidth: 220,
            }}
          >
            {courseModules.map(({ course }) => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <span style={{ fontSize: 15, color: '#7A92B0' }}>{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#F7F9FC' }}>
                {['Name', 'Due', 'Submitted', 'Status', 'Score'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '9px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 15, fontWeight: 700,
                      color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', fontSize: 16, color: '#7A92B0' }}>No graded coursework for this course yet.</td>
                </tr>
              ) : (
                activeEntry?.modules.flatMap((module) => {
                  const moduleRows = rows.filter((row) => row.unit === module.unit)
                  if (!moduleRows.length) return []
                  return [
                    <tr key={`${module.unit}-header`}>
                      <td colSpan={5} style={{ padding: '10px 14px', background: '#F0F4FA', fontSize: 16, fontWeight: 800, color: SP_NAVY, borderBottom: '1px solid #E4EAF2' }}>
                        {module.unit}
                      </td>
                    </tr>,
                    ...moduleRows.map((row) => {
                      const meta = STATUS_META[row.status]
                      return (
                        <tr key={row.id}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', verticalAlign: 'top' }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: SP_NAVY }}>{row.name}</div>
                            <div style={{ fontSize: 15, color: '#94A3B8', marginTop: 2 }}>{row.sectionLabel}</div>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 16, color: '#3D5475', whiteSpace: 'nowrap' }}>{row.due}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 16, color: '#3D5475', whiteSpace: 'nowrap' }}>{row.submitted}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8' }}>
                            <span style={{ background: meta.bg, color: meta.color, padding: '3px 10px', borderRadius: 20, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <meta.icon size={10} /> {row.status}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #F0F4F8', fontSize: 17, fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap', color: row.scoreGood === null ? SP_NAVY : row.scoreGood ? SP_GREEN : SP_RED }}>
                            {row.score}
                          </td>
                        </tr>
                      )
                    }),
                  ]
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ padding: '12px 14px', fontSize: 17, fontWeight: 900, color: SP_NAVY, borderTop: `2px solid ${SP_NAVY}` }}>TOTAL</td>
                  <td style={{ borderTop: `2px solid ${SP_NAVY}` }} />
                  <td style={{ borderTop: `2px solid ${SP_NAVY}` }} />
                  <td style={{ padding: '12px 14px', borderTop: `2px solid ${SP_NAVY}`, textAlign: 'right' }}>
                    {totals.pct !== null ? (
                      <span style={{ background: totals.pct >= 70 ? '#DCFCE7' : '#FEE2E2', color: totals.pct >= 70 ? SP_GREEN : SP_RED, padding: '3px 10px', borderRadius: 20, fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {totals.pct}%
                      </span>
                    ) : (
                      <span style={{ fontSize: 15, color: '#94A3B8' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', borderTop: `2px solid ${SP_NAVY}`, textAlign: 'right', fontSize: 17, fontWeight: 900, color: SP_NAVY, whiteSpace: 'nowrap' }}>
                    {totals.max > 0 ? `${totals.achieved}/${totals.max}` : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
