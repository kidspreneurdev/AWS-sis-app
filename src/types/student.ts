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
  grade: number | null
  status: StudentStatus
  campus: string | null
  cohort: string | null
  studentType: StudentType
  appDate: string | null
  enrollDate: string | null
  yearJoined: string | null
  yearGraduated: string | null
  gradeWhenJoined: number | null
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

export function generateStudentId(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `AWS${year}${rand}`
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
