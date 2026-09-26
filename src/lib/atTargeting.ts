import { normalizeStudentGrade } from '@/types/student'

// Grade bands behind the Assignment Tracker's "Division" targeting option.
export const AT_DIVISION_BANDS: Record<string, string[]> = {
  'Elementary': ['Pre-K', 'K', '1', '2', '3', '4', '5'],
  'Middle School': ['6', '7', '8'],
  'High School': ['9', '10', '11', '12'],
}

export interface AtTargetCriteria {
  /** A specific division band, or null/'All' if this criterion isn't active. */
  division: string | null
  /** A specific cohort name, or null if this criterion isn't active. */
  cohort: string | null
  /** A specific list of student ids, or null/empty if this criterion isn't active. */
  studentIds: string[] | null
}

/**
 * Union/OR targeting: an assignment reaches a student if ANY active criterion matches.
 * With no active criteria at all, it reaches every student (the historical default).
 */
export function atAssignmentIsTargeted(
  criteria: AtTargetCriteria,
  student: { id: string; grade?: unknown; cohort?: string | null },
): boolean {
  const hasDivision = !!criteria.division && criteria.division !== 'All'
  const hasCohort = !!criteria.cohort
  const hasStudents = !!(criteria.studentIds && criteria.studentIds.length)

  if (!hasDivision && !hasCohort && !hasStudents) return true

  if (hasDivision) {
    const band = AT_DIVISION_BANDS[criteria.division as string]
    if (band?.includes(normalizeStudentGrade(student.grade) ?? '')) return true
  }
  if (hasCohort && student.cohort && student.cohort === criteria.cohort) return true
  if (hasStudents && criteria.studentIds!.includes(student.id)) return true
  return false
}
