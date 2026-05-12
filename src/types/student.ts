export type StudentStatus =
  | 'Inquiry' | 'Applied' | 'Under Review' | 'Accepted'
  | 'Enrolled' | 'Waitlisted' | 'Denied' | 'Withdrawn' | 'Alumni'

export type StudentType = 'New' | 'Existing' | 'Alumni'
export type Priority = 'Urgent' | 'High' | 'Normal' | 'Low'

export interface Student {
  id: string
  studentId: string
  firstName: string
  lastName: string
  dob: string | null
  gender: 'Male' | 'Female' | 'Other' | null
  nationality: string | null
  lang: string | null
  grade: string | null
  status: StudentStatus
  campus: string | null
  cohort: string | null
  studentType: StudentType
  appDate: string | null
  enrollDate: string | null
  yearJoined: string | null
  yearGraduated: string | null
  gradeWhenJoined: string | null
  priority: Priority
  prevSchool: string | null
  priorGpa: string | null
  iep: string | null
  email: string | null
  phone: string | null
  parent: string | null
  relation: string | null
  ecName: string | null
  ecPhone: string | null
  address: string | null
  bloodGroup: string | null
  allergy: string | null
  meds: string | null
  physician: string | null
  physicianPhone: string | null
  healthNotes: string | null
  notes: string | null
  counselorNotes: string | null
  documents: string[]
  intDate: string | null
  intTime: string | null
  intViewer: string | null
  intScore: number | null
  intNotes: string | null
  intCommittee: string | null
  decDate: string | null
  decNotes: string | null
  postSecondary: string | null
  gradDistinction: string | null
  alumniNotes: string | null
  createdAt: string
  updatedAt: string
}

export type StudentInsert = Omit<Student, 'id' | 'createdAt' | 'updatedAt'>

// ─── Constants ───────────────────────────────────────────────────────────────

export const STATUSES: StudentStatus[] = [
  'Inquiry', 'Applied', 'Under Review', 'Accepted',
  'Enrolled', 'Waitlisted', 'Denied', 'Withdrawn', 'Alumni',
]

export const STATUS_META: Record<StudentStatus, { dot: string; bg: string; tc: string }> = {
  Inquiry:       { dot: '#7040CC', bg: '#EDE6FB', tc: '#5B2DB0' },
  Applied:       { dot: '#0EA5E9', bg: '#E6F4FF', tc: '#0369A1' },
  'Under Review':{ dot: '#F5A623', bg: '#FEF3C7', tc: '#92400E' },
  Accepted:      { dot: '#1DBD6A', bg: '#E8FBF0', tc: '#0E6B3B' },
  Enrolled:      { dot: '#0369A1', bg: '#E0F5FF', tc: '#0A527A' },
  Waitlisted:    { dot: '#1FD6C4', bg: '#E6FDFB', tc: '#0A6B64' },
  Denied:        { dot: '#D61F31', bg: '#FEE2E2', tc: '#991B1B' },
  Withdrawn:     { dot: '#7A92B0', bg: '#F3F4F6', tc: '#6B7280' },
  Alumni:        { dot: '#FAC600', bg: '#FFFBE6', tc: '#856404' },
}

export const PRIORITY_META: Record<Priority, { bg: string; tc: string }> = {
  Urgent: { bg: '#D61F31', tc: '#fff' },
  High:   { bg: '#F5A623', tc: '#fff' },
  Normal: { bg: '#0EA5E9', tc: '#fff' },
  Low:    { bg: '#7A92B0', tc: '#fff' },
}

export const GRADES = [
  'Pre-K', 'K', '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10', '11', '12',
]

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']

export const IEP_OPTIONS = ['', 'GT', 'ELL', 'ELL Level 2', '504', 'IEP', 'Other']

export const DOCUMENT_TYPES = [
  'Birth Certificate',
  'Immunization Records',
  'Prior School Transcript',
  'Medical Form',
  'Passport / ID Copy',
  'Recommendation Letter',
]

export const PRIORITIES: Priority[] = ['Urgent', 'High', 'Normal', 'Low']

export const STUDENT_TYPES: StudentType[] = ['New', 'Existing', 'Alumni']

export function fullName(s: Student) {
  return [s.firstName, s.lastName].filter(v => v && v.trim()).join(' ')
}

export function normalizeStudentGrade(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') {
    if (value === -1) return 'Pre-K'
    if (value === 0) return 'K'
    return String(value)
  }

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  if (trimmed === '-1' || lower === 'pre-k' || lower === 'prek' || lower === 'pre k') return 'Pre-K'
  if (trimmed === '0' || lower === 'k' || lower === 'kindergarten') return 'K'

  const parsed = Number(trimmed)
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) return String(parsed)
  return trimmed
}

export function formatStudentGrade(grade: unknown): string {
  return normalizeStudentGrade(grade) ?? ''
}

export function studentGradeSortIndex(grade: unknown): number {
  const normalized = normalizeStudentGrade(grade)
  if (!normalized) return Number.POSITIVE_INFINITY
  const order = GRADES.indexOf(normalized)
  return order === -1 ? Number.POSITIVE_INFINITY : order
}

export function compareStudentGrades(a: unknown, b: unknown): number {
  return studentGradeSortIndex(a) - studentGradeSortIndex(b)
}

export function toLegacyStudentGradeValue(grade: unknown): number | null {
  const normalized = normalizeStudentGrade(grade)
  if (!normalized) return null
  if (normalized === 'Pre-K') return -1
  if (normalized === 'K') return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function isLegacyStudentGradeSchemaError(message: string | undefined | null): boolean {
  const text = (message ?? '').toLowerCase()
  return text.includes('invalid input syntax for type integer')
    || text.includes('column "grade" is of type integer')
    || text.includes('column "grade_when_joined" is of type integer')
}

export function generateStudentId(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(10000 + Math.random() * 90000)
  return `AWS${year}-${rand}`
}

export const EMPTY_STUDENT: StudentInsert = {
  studentId: '',
  firstName: '',
  lastName: '',
  dob: null,
  gender: null,
  nationality: null,
  lang: null,
  grade: null,
  status: 'Inquiry',
  campus: null,
  cohort: null,
  studentType: 'New',
  appDate: new Date().toISOString().slice(0, 10),
  enrollDate: null,
  yearJoined: null,
  yearGraduated: null,
  gradeWhenJoined: null,
  priority: 'Normal',
  prevSchool: null,
  priorGpa: null,
  iep: null,
  email: null,
  phone: null,
  parent: null,
  relation: null,
  ecName: null,
  ecPhone: null,
  address: null,
  bloodGroup: null,
  allergy: null,
  meds: null,
  physician: null,
  physicianPhone: null,
  healthNotes: null,
  notes: null,
  counselorNotes: null,
  documents: [],
  intDate: null,
  intTime: null,
  intViewer: null,
  intScore: null,
  intNotes: null,
  intCommittee: null,
  decDate: null,
  decNotes: null,
  postSecondary: null,
  gradDistinction: null,
  alumniNotes: null,
}
