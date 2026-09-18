import { Check, RotateCw, ClipboardList, Circle, X, type LucideIcon } from 'lucide-react'

export const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

export const SP_NAVY = '#1A365E'
export const SP_RED = '#D61F31'
export const SP_GREEN = '#1DBD6A'
export const SP_GOLD = '#FAC600'
export const SP_PURPLE = '#A36CFF'

export const emptyState: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 10,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  fontSize: 12,
  color: '#7A92B0',
}

export type CourseType = 'STD' | 'HON' | 'AP' | 'IB' | 'DE' | 'EC' | 'CR'

export interface GradeRow {
  id: string
  subject: string
  grade: number
  term: string
  course_code: string
  letter_grade: string
}

export interface CourseRow {
  id: string
  title: string
  type: CourseType
  area: string
  credits: number
  credits_earned: number
  course_status: string | null
  grade_letter: string | null
  grade_percent: number | null
  ap_score: number | null
  ib_score: number | null
  term: string | null
  academic_year: string
}

export interface RemarkRow {
  id: string
  term: string
  academic_year: string
  content: string
  author: string | null
  created_at: string
}

export interface TransferRow {
  id: string
  institution: string
  course_title: string
  credits: number
  grade_letter: string | null
  year: string | null
  status: string | null
  type: string | null
  area: string | null
}

export interface ECDECreditRow {
  id: string
  type: 'EC' | 'DE'
  institution: string
  course_title: string
  college_credits: number
  hs_credits: number
  grade_letter: string | null
  academic_year: string
}

export interface AttendanceRow {
  status: string
}

export interface SettingsRow {
  graduation_credits: number | null
  associate_degree_credits_required: number | null
}

export interface GraduationRequirement {
  id: string
  key: string
  label: string
  area: string
  required_credits: number
  icon: string | null
  sort_order: number
}

export interface DistinctionRow {
  id: string
  label: string
  icon: string | null
  color: string | null
  weighted_gpa_required: number
  sort_order: number
}

export const TYPE_WEIGHT: Record<CourseType, number> = { STD: 0, HON: 0.5, AP: 1, IB: 1, DE: 1, EC: 1, CR: 0 }

export const GRADE_PTS: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0,
}

export function weightedPts(grade: string | null, type: CourseType): number | null {
  if (!grade || !(grade in GRADE_PTS)) return null
  const base = GRADE_PTS[grade]
  return Math.min(base + (TYPE_WEIGHT[type] ?? 0), 5)
}

export const STATUS_STYLE: Record<string, { bg: string; color: string; icon: LucideIcon }> = {
  'Completed':   { bg: '#DCFCE7', color: '#166534', icon: Check },
  'In Progress': { bg: '#DBEAFE', color: '#1E40AF', icon: RotateCw },
  'Assigned':    { bg: '#FEF9C3', color: '#854D0E', icon: ClipboardList },
  'Not Started': { bg: '#F1F5F9', color: '#64748B', icon: Circle },
  'Withdrawn':   { bg: '#FEE2E2', color: '#991B1B', icon: X },
}

export function letterGrade(pct: number) {
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 67) return 'D+'
  if (pct >= 65) return 'D'
  return 'F'
}

export function gradePoints(letter: string | null) {
  const map: Record<string, number> = {
    'A+': 4, A: 4, 'A-': 3.7,
    'B+': 3.3, B: 3, 'B-': 2.7,
    'C+': 2.3, C: 2, 'C-': 1.7,
    'D+': 1.3, D: 1, 'D-': 0.7,
    F: 0,
  }
  return letter ? (map[letter] ?? 0) : null
}

export function weightedPoints(letter: string | null, type: CourseType) {
  const base = gradePoints(letter)
  if (base === null) return null
  if (base <= 1) return base
  return Math.round((base + TYPE_WEIGHT[type]) * 100) / 100
}

export interface GpaCourseInput {
  grade_letter: string | null
  type: CourseType
  credits: number
}

export interface GpaTransferInput {
  grade_letter: string | null
  type?: string | null
  credits: number
  status: string | null
}

export function calcGPA(courses: GpaCourseInput[], transfers: GpaTransferInput[] = []) {
  let credits = 0
  let points = 0
  courses.forEach((course) => {
    const pts = gradePoints(course.grade_letter)
    if (pts === null) return
    credits += course.credits || 0
    points += pts * (course.credits || 0)
  })
  transfers.forEach((transfer) => {
    if (transfer.status !== 'Approved') return
    const pts = gradePoints(transfer.grade_letter)
    if (pts === null) return
    credits += transfer.credits || 0
    points += pts * (transfer.credits || 0)
  })
  return credits ? Math.round((points / credits) * 100) / 100 : 0
}

export function calcWeightedGPA(courses: GpaCourseInput[], transfers: GpaTransferInput[] = []) {
  let credits = 0
  let points = 0
  courses.forEach((course) => {
    const pts = weightedPoints(course.grade_letter, course.type)
    if (pts === null) return
    credits += course.credits || 0
    points += pts * (course.credits || 0)
  })
  transfers.forEach((transfer) => {
    if (transfer.status !== 'Approved') return
    const pts = weightedPoints(transfer.grade_letter, (transfer.type as CourseType) ?? 'STD')
    if (pts === null) return
    credits += transfer.credits || 0
    points += pts * (transfer.credits || 0)
  })
  return credits ? Math.round((points / credits) * 100) / 100 : 0
}

export function gpaColor(gpa: number) {
  return gpa >= 3.5 ? SP_GREEN : gpa >= 2.5 ? SP_GOLD : SP_RED
}

export function gradeColor(pct: number) {
  if (pct >= 85) return SP_GREEN
  if (pct >= 70) return SP_GOLD
  return SP_RED
}

export function letterGradeColor(letter: string | null) {
  if (!letter) return '#94A3B8'
  const l = letter.toUpperCase()
  if (l.startsWith('A')) return SP_GREEN
  if (l.startsWith('B')) return '#3B82F6'
  if (l.startsWith('C')) return SP_GOLD
  if (l.startsWith('D')) return '#F97316'
  if (l === 'F') return SP_RED
  if (l === 'IP') return '#94A3B8'
  return SP_NAVY
}

export function attendanceRate(rows: AttendanceRow[]) {
  if (!rows.length) return null
  const present = rows.filter((row) => row.status === 'Present' || row.status === 'Excused').length
  return Math.round((present / rows.length) * 100)
}

export function parseGradeLevel(value: string) {
  const match = value.match(/\d+/)
  if (!match) return null
  const n = Number.parseInt(match[0], 10)
  return Number.isNaN(n) ? null : n
}

export function estimateCollegeCreditsFromHsCredits(hsCredits: number) {
  return Math.round(hsCredits * 3 * 10) / 10
}

export function portalPrefix(pathname: string) {
  return pathname.startsWith('/parent') ? '/parent' : '/portal'
}

export function isOverdue(dueDate: string, rawStatus: string, todayIso: string): boolean {
  return Boolean(dueDate && dueDate < todayIso && !['Turned In', 'Late', 'Resubmitted'].includes(rawStatus))
}

export interface CreditEarningCourse {
  grade_letter: string | null
  credits_earned: number
}

export interface CreditEarningTransfer {
  credits: number
  status: string | null
}

export interface CreditEarningECDE {
  hs_credits: number
}

export function creditProgress(
  courses: CreditEarningCourse[],
  transfers: CreditEarningTransfer[],
  graduationCredits: number | null,
  ecdeCredits: CreditEarningECDE[] = [],
): { totalEarned: number; required: number; pct: number } {
  let total = 0
  courses.forEach((course) => {
    if (course.grade_letter === 'F' || !course.grade_letter || course.grade_letter === 'IP') return
    total += course.credits_earned || 0
  })
  transfers.forEach((transfer) => {
    if (transfer.status !== 'Approved') return
    total += transfer.credits || 0
  })
  ecdeCredits.forEach((credit) => { total += credit.hs_credits || 0 })

  const required = graduationCredits ?? 24
  const totalEarned = Math.round(total * 10) / 10
  const pct = required > 0 ? Math.min(100, Math.round((totalEarned / required) * 100)) : 0
  return { totalEarned, required, pct }
}
