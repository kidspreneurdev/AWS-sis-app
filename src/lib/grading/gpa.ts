/**
 * High-school transcript GPA.
 *
 * This is the credit-weighted GPA derived from `courses.grade_letter` (plus any
 * approved `transfer_credits`). It is the number shown on the student Grades page
 * and must stay identical wherever GPA is surfaced (e.g. the portal dashboard).
 */

export type CourseType = 'STD' | 'HON' | 'AP' | 'IB' | 'DE' | 'EC' | 'CR'

export const TYPE_WEIGHT: Record<CourseType, number> = { STD: 0, HON: 0.5, AP: 1, IB: 1, DE: 1, EC: 1, CR: 0 }

export interface GpaCourse {
  grade_letter: string | null
  type: CourseType
  credits: number
}

export interface GpaTransfer {
  grade_letter: string | null
  type?: string | null
  credits: number
  status: string | null
}

const GRADE_PTS: Record<string, number> = {
  'A+': 4, A: 4, 'A-': 3.7,
  'B+': 3.3, B: 3, 'B-': 2.7,
  'C+': 2.3, C: 2, 'C-': 1.7,
  'D+': 1.3, D: 1, 'D-': 0.7,
  F: 0,
}

export function gradePoints(letter: string | null): number | null {
  return letter ? (GRADE_PTS[letter] ?? 0) : null
}

export function weightedPoints(letter: string | null, type: CourseType): number | null {
  const base = gradePoints(letter)
  if (base === null) return null
  if (base <= 1) return base
  return Math.round((base + (TYPE_WEIGHT[type] ?? 0)) * 100) / 100
}

export function calcGPA(courses: GpaCourse[], transfers: GpaTransfer[] = []): number {
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

export function calcWeightedGPA(courses: GpaCourse[], transfers: GpaTransfer[] = []): number {
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
