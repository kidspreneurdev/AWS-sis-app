// LMS Data Store — Supabase-backed
import { supabase } from '@/lib/supabase'

export interface LMSCourse {
  id: string
  title: string
  subject: string
  gradeLevel: string
  description: string
  passMark: number
  creditHours: number
  requiredHours: number
  status: 'Draft' | 'Published'
  announcement?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface LMSQuestion {
  q: string
  opts?: string[]
  ans?: number
  type?: 'mcq' | 'short'
}

export interface LMSContent {
  id: string
  courseId: string
  title: string
  type: 'video' | 'article' | 'link' | 'file' | 'quiz' | 'presentation'
  lessonSubType?: string
  url?: string
  body?: string
  unitTitle?: string
  unitOrder?: number
  order?: number
  estimatedMins?: number
  moduleTitle?: string
  moduleOrder?: number
  slideCount?: number
  hasMastery?: boolean | 'TRUE'
  masteryPassMark?: number
  masteryRetakes?: number
  masteryBrief?: string
  masteryTimeLimit?: number
  masteryShuffleQuestions?: boolean | 'TRUE'
  masteryQuizJson?: string
  quizJson?: string
  hasAssignment?: boolean | 'TRUE'
  assignInstructions?: string
  assignMaxScore?: number
  assignDueDays?: number
  assignSubType?: string
  assignWeight?: number
  masteryWeight?: number
  assignRubric?: string
  assignments?: string
}

export interface LMSEnrolment {
  id: string
  courseId: string
  targetType: 'cohort' | 'student' | 'grade'
  targetValue: string
  assignedBy?: string
  assignedAt?: string
  paceType?: string
  paceDaysPerLesson?: number
  paceStartDate?: string
  dueDate?: string
  active?: boolean | 'TRUE'
}

export interface LMSProgress {
  id?: string
  studentId: string
  courseId: string
  contentId: string
  status: 'not_started' | 'in_progress' | 'completed'
  masteryScore?: number | null
  masteryPassed?: boolean | 'TRUE'
  masteryAttempts?: number
  assignScore?: number | null
  assignStatus?: string
  timeSpentMins?: number
}

export interface LMSStore {
  courses: LMSCourse[]
  content: LMSContent[]
  enrolments: LMSEnrolment[]
  progress: LMSProgress[]
}

// ─── Row mappers ──────────────────────────────────────────────────────────────
function rowToLMSCourse(r: Record<string, unknown>): LMSCourse {
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    subject: (r.subject as string) ?? '',
    gradeLevel: (r.grade_level as string) ?? '',
    description: (r.description as string) ?? '',
    passMark: Number(r.pass_mark ?? 70),
    creditHours: Number(r.credit_hours ?? 1),
    requiredHours: Number(r.required_hours ?? 0),
    status: ((r.status as string) ?? 'Draft') as 'Draft' | 'Published',
    announcement: (r.announcement as string) ?? '',
    createdBy: (r.created_by as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
    updatedAt: (r.updated_at as string) ?? '',
  }
}

function rowToLMSContent(r: Record<string, unknown>): LMSContent {
  const extra = (r.extra as Record<string, unknown>) ?? {}
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    title: (r.title as string) ?? '',
    type: (r.type as LMSContent['type']) ?? 'article',
    unitTitle: (r.unit_title as string) ?? '',
    unitOrder: r.unit_order as number | undefined,
    moduleTitle: (r.module_title as string) ?? '',
    moduleOrder: r.module_order as number | undefined,
    order: r.order_idx as number | undefined,
    lessonSubType: extra.lessonSubType as string | undefined,
    url: extra.url as string | undefined,
    body: extra.body as string | undefined,
    estimatedMins: extra.estimatedMins as number | undefined,
    slideCount: extra.slideCount as number | undefined,
    hasMastery: extra.hasMastery as boolean | 'TRUE' | undefined,
    masteryPassMark: extra.masteryPassMark as number | undefined,
    masteryRetakes: extra.masteryRetakes as number | undefined,
    masteryBrief: extra.masteryBrief as string | undefined,
    masteryTimeLimit: extra.masteryTimeLimit as number | undefined,
    masteryShuffleQuestions: extra.masteryShuffleQuestions as boolean | 'TRUE' | undefined,
    masteryQuizJson: extra.masteryQuizJson as string | undefined,
    quizJson: extra.quizJson as string | undefined,
    hasAssignment: extra.hasAssignment as boolean | 'TRUE' | undefined,
    assignInstructions: extra.assignInstructions as string | undefined,
    assignMaxScore: extra.assignMaxScore as number | undefined,
    assignDueDays: extra.assignDueDays as number | undefined,
    assignSubType: extra.assignSubType as string | undefined,
    assignWeight: extra.assignWeight as number | undefined,
    masteryWeight: extra.masteryWeight as number | undefined,
    assignRubric: extra.assignRubric as string | undefined,
    assignments: extra.assignments as string | undefined,
  }
}

function rowToLMSEnrolment(r: Record<string, unknown>): LMSEnrolment {
  return {
    id: r.id as string,
    courseId: r.course_id as string,
    targetType: (r.target_type as LMSEnrolment['targetType']) ?? 'cohort',
    targetValue: (r.target_value as string) ?? '',
    assignedBy: (r.assigned_by as string) ?? '',
    assignedAt: (r.assigned_at as string) ?? '',
    paceType: (r.pace_type as string) ?? '',
    paceDaysPerLesson: r.pace_days_per_lesson as number | undefined,
    paceStartDate: (r.pace_start_date as string) ?? '',
    dueDate: (r.due_date as string) ?? '',
    active: r.active === true,
  }
}

function rowToLMSProgress(r: Record<string, unknown>): LMSProgress {
  return {
    id: r.id as string,
    studentId: r.student_id as string,
    courseId: r.course_id as string,
    contentId: r.content_id as string,
    status: (r.status as LMSProgress['status']) ?? 'not_started',
    masteryScore: r.mastery_score as number | null,
    masteryPassed: r.mastery_passed === true,
    masteryAttempts: Number(r.mastery_attempts ?? 0),
    assignScore: r.assign_score as number | null,
    assignStatus: r.assign_status as string | undefined,
    timeSpentMins: Number(r.time_spent_mins ?? 0),
  }
}

// ─── Load from Supabase ───────────────────────────────────────────────────────
export async function loadLMSFromDB(): Promise<LMSStore> {
  const [cr, co, en, pr] = await Promise.all([
    supabase.from('lms_courses').select('*').order('created_at'),
    supabase.from('lms_content').select('*').order('unit_order').order('order_idx'),
    supabase.from('lms_enrolments').select('*').order('created_at'),
    supabase.from('lms_progress').select('*'),
  ])
  if (cr.error) console.error('lms_courses load error:', cr.error)
  if (co.error) console.error('lms_content load error:', co.error)
  if (en.error) console.error('lms_enrolments load error:', en.error)
  if (pr.error) console.error('lms_progress load error:', pr.error)
  console.log('LMS load — courses:', cr.data?.length, 'content:', co.data?.length, 'enrolments:', en.data?.length)
  return {
    courses: (cr.data ?? []).map(r => rowToLMSCourse(r as Record<string, unknown>)),
    content: (co.data ?? []).map(r => rowToLMSContent(r as Record<string, unknown>)),
    enrolments: (en.data ?? []).map(r => rowToLMSEnrolment(r as Record<string, unknown>)),
    progress: (pr.data ?? []).map(r => rowToLMSProgress(r as Record<string, unknown>)),
  }
}

// Keep sync stub so existing useState(loadLMS) call doesn't break at startup
export function loadLMS(): LMSStore {
  return { courses: [], content: [], enrolments: [], progress: [] }
}

// ─── Save to Supabase ─────────────────────────────────────────────────────────
export async function saveLMS(store: LMSStore): Promise<string | null> {
  if (store.courses.length) {
    const { error } = await supabase.from('lms_courses').upsert(
      store.courses.map(c => ({
        id: c.id, title: c.title, subject: c.subject, grade_level: c.gradeLevel,
        description: c.description, pass_mark: c.passMark, credit_hours: c.creditHours,
        required_hours: c.requiredHours || null, status: c.status,
        announcement: c.announcement ?? null, created_by: c.createdBy ?? null,
      })),
      { onConflict: 'id' }
    )
    if (error) { console.error('lms_courses save error:', error); return error.message }
  }
  if (store.content.length) {
    const { error } = await supabase.from('lms_content').upsert(
      store.content.map(c => ({
        id: c.id, course_id: c.courseId, title: c.title, type: c.type,
        unit_title: c.unitTitle ?? null, unit_order: c.unitOrder ?? null,
        module_title: c.moduleTitle ?? null, module_order: c.moduleOrder ?? null,
        order_idx: c.order ?? null,
        extra: {
          lessonSubType: c.lessonSubType, url: c.url, body: c.body,
          estimatedMins: c.estimatedMins, slideCount: c.slideCount,
          hasMastery: c.hasMastery, masteryPassMark: c.masteryPassMark,
          masteryRetakes: c.masteryRetakes, masteryBrief: c.masteryBrief,
          masteryTimeLimit: c.masteryTimeLimit, masteryShuffleQuestions: c.masteryShuffleQuestions,
          masteryQuizJson: c.masteryQuizJson, quizJson: c.quizJson,
          hasAssignment: c.hasAssignment, assignInstructions: c.assignInstructions,
          assignMaxScore: c.assignMaxScore, assignDueDays: c.assignDueDays,
          assignSubType: c.assignSubType, assignWeight: c.assignWeight,
          masteryWeight: c.masteryWeight, assignRubric: c.assignRubric,
          assignments: c.assignments,
        },
      })),
      { onConflict: 'id' }
    )
    if (error) { console.error('lms_content save error:', error); return error.message }
  }
  if (store.enrolments.length) {
    const { error } = await supabase.from('lms_enrolments').upsert(
      store.enrolments.map(e => ({
        id: e.id, course_id: e.courseId, target_type: e.targetType, target_value: e.targetValue,
        assigned_by: e.assignedBy ?? null, assigned_at: e.assignedAt ? e.assignedAt : null,
        pace_type: e.paceType ?? null, pace_days_per_lesson: e.paceDaysPerLesson ?? null,
        pace_start_date: e.paceStartDate || null, due_date: e.dueDate || null,
        active: e.active === true || e.active === 'TRUE',
      })),
      { onConflict: 'id' }
    )
    if (error) { console.error('lms_enrolments save error:', error); return error.message }
  }
  if (store.progress.length) {
    const { error } = await supabase.from('lms_progress').upsert(
      store.progress.map(p => ({
        student_id: p.studentId, course_id: p.courseId, content_id: p.contentId,
        status: p.status,
        mastery_score: p.masteryScore ?? null,
        mastery_passed: p.masteryPassed === true || p.masteryPassed === 'TRUE',
        mastery_attempts: p.masteryAttempts ?? 0,
        assign_score: p.assignScore ?? null,
        assign_status: p.assignStatus ?? null,
        time_spent_mins: p.timeSpentMins ?? 0,
      })),
      { onConflict: 'student_id,content_id' }
    )
    if (error) { console.error('lms_progress save error:', error); return error.message }
  }
  return null
}

// ─── Individual deletes ───────────────────────────────────────────────────────
export async function deleteLMSCourse(id: string) {
  // cascade deletes content and enrolments
  await supabase.from('lms_courses').delete().eq('id', id)
}
export async function deleteLMSContent(id: string) {
  await supabase.from('lms_content').delete().eq('id', id)
}
export async function deleteLMSEnrolment(id: string) {
  await supabase.from('lms_enrolments').delete().eq('id', id)
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function lmsId(): string {
  return 'L' + Date.now().toString(36).toUpperCase() + (Math.floor(Math.random() * 999))
}

export function fmtTime(mins: number): string {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':00'
}

export function hasMasteryBool(v: boolean | 'TRUE' | undefined): boolean {
  return v === true || v === 'TRUE'
}

export function hasAssignBool(v: boolean | 'TRUE' | undefined): boolean {
  return v === true || v === 'TRUE'
}

export function isActiveBool(v: boolean | 'TRUE' | undefined): boolean {
  return v === true || v === 'TRUE'
}

export function lmsCompositeScore(
  prog: LMSProgress | undefined,
  item: LMSContent,
  _passMark: number
): number | null {
  if (!prog) return null
  const hm = hasMasteryBool(item.hasMastery)
  const ha = hasAssignBool(item.hasAssignment)
  if (!hm && !ha) return null
  const mw = item.masteryWeight ?? 60
  const aw = item.assignWeight ?? 40
  const ms = prog.masteryScore != null && !isNaN(Number(prog.masteryScore)) ? Number(prog.masteryScore) : null
  const as_ = prog.assignScore != null && !isNaN(Number(prog.assignScore)) ? Number(prog.assignScore) : null
  if (hm && ha && ms !== null && as_ !== null) return Math.round((ms * mw + as_ * aw) / (mw + aw))
  if (hm && ms !== null) return ms
  if (ha && as_ !== null) return as_
  return null
}

export function lmsCourseComposite(
  progArr: LMSProgress[],
  content: LMSContent[],
  passMark: number
): number | null {
  const scores: number[] = []
  content.forEach(item => {
    const prog = progArr.find(p => p.contentId === item.id)
    const cs = lmsCompositeScore(prog, item, passMark)
    if (cs !== null) scores.push(cs)
  })
  if (!scores.length) return null
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

export const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': '#3B82F6',
  'English Language Arts': '#8B5CF6',
  'Reading': '#8B5CF6',
  'Science': '#059669',
  'Social Studies': '#D97706',
  'Entrepreneurship': '#D61F31',
  'Art': '#EC4899',
  'World Language': '#0891B2',
  'Physical Education': '#16A34A',
  'Computer Science': '#7C3AED',
  'Other': '#6B7280',
}

export const SUBJECTS = [
  'Mathematics', 'English Language Arts', 'Reading', 'Science',
  'Social Studies', 'Entrepreneurship', 'Art', 'World Language',
  'Physical Education', 'Computer Science', 'Other'
]

export const GRADE_LEVELS = [
  'All Grades', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
]

export const TYPE_ICONS: Record<string, string> = {
  video: '🎬', article: '📝', link: '🔗', file: '📎', quiz: '❓', presentation: '🖥️'
}

export const TYPE_COLORS: Record<string, string> = {
  video: '#3B82F6', article: '#8B5CF6', link: '#0891B2',
  file: '#D97706', quiz: '#059669', presentation: '#7C3AED'
}

export function gradeLabel(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (v >= 90) return 'A'
  if (v >= 80) return 'B'
  if (v >= 70) return 'C'
  if (v >= 60) return 'D'
  return 'F'
}
