// Student Records module — per-student documents, grouped into four categories.
// Most are admin-uploaded PDFs; four (course_confirmation, weekly_schedule,
// edmentum_credentials, assessment_instructions) are SIS-generated from a form.
// Diagnostics run across three semesters — the semester is encoded in record_type.

export type StudentRecordType =
  // Diagnostics — Semester 1 (existing keys, not renamed)
  | 'math_diagnostic'
  | 'reading_diagnostic'
  | 'ela_diagnostic'
  | 'diagnostic_summary_s1'
  // Diagnostics — Semester 2
  | 'math_diagnostic_s2'
  | 'reading_diagnostic_s2'
  | 'ela_diagnostic_s2'
  | 'diagnostic_summary_s2'
  // Diagnostics — Semester 3
  | 'math_diagnostic_s3'
  | 'reading_diagnostic_s3'
  | 'ela_diagnostic_s3'
  | 'diagnostic_summary_s3'
  // Psychometric Assessment Details
  | 'assessment_instructions'
  | 'psychometric'
  // Learning Resources
  | 'edmentum_credentials'
  | 'stock_market_game'
  // Course (acknowledged by the families)
  | 'course_confirmation'
  | 'weekly_schedule'

export type StudentRecordSource = 'upload' | 'generated'
export type StudentRecordStatus = 'pending' | 'available' | 'coming_soon'

export type RecordCategory = 'diagnostics' | 'psychometric' | 'learning_resources' | 'course'

export const RECORD_CATEGORIES: { key: RecordCategory; label: string; note?: string }[] = [
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'psychometric', label: 'Psychometric Assessment Details' },
  { key: 'learning_resources', label: 'Learning Resources' },
  { key: 'course', label: 'Course', note: 'Needs to be acknowledged by the families' },
]

// Signed-return flow — only course_confirmation & weekly_schedule support it.
export type SignedReturnStatus = 'submitted' | 'approved' | 'rejected'

export const SIGNED_RETURN_RECORD_TYPES: StudentRecordType[] = [
  'course_confirmation',
  'weekly_schedule',
]

export function recordSupportsSignedReturn(type: StudentRecordType): boolean {
  return SIGNED_RETURN_RECORD_TYPES.includes(type)
}

export const SIGNED_STATUS_META: Record<SignedReturnStatus, { label: string; bg: string; fg: string }> = {
  submitted: { label: 'Signed copy submitted', bg: '#E6F4FF', fg: '#0369A1' },
  approved:  { label: 'Signed copy approved',  bg: '#E8FBF0', fg: '#0E6B3B' },
  rejected:  { label: 'Signed copy rejected',  bg: '#FEE2E2', fg: '#991B1B' },
}

export interface StudentRecord {
  id: string
  studentId: string
  recordType: StudentRecordType
  source: StudentRecordSource
  status: StudentRecordStatus
  storagePath: string | null
  fileName: string | null
  fileSize: number | null
  mimeType: string
  data: Record<string, unknown> | null
  uploadedBy: string | null
  uploadedAt: string | null
  generatedAt: string | null
  signedFileUrl: string | null
  signedFileName: string | null
  signedSubmittedAt: string | null
  signedStatus: SignedReturnStatus | null
  signedReviewNote: string | null
}

export interface StudentRecordDef {
  type: StudentRecordType
  label: string
  source: StudentRecordSource
  description: string
  category: RecordCategory
  /** Diagnostics only — 1, 2 or 3. */
  semester?: 1 | 2 | 3
}

// ─── Diagnostic slots ─────────────────────────────────────────────────────────
// Semester 1 reuses the original keys; 2 & 3 get a suffix.
const DIAGNOSTIC_SEMESTERS: { semester: 1 | 2 | 3; math: StudentRecordType; reading: StudentRecordType; ela: StudentRecordType; summary: StudentRecordType }[] = [
  { semester: 1, math: 'math_diagnostic',    reading: 'reading_diagnostic',    ela: 'ela_diagnostic',    summary: 'diagnostic_summary_s1' },
  { semester: 2, math: 'math_diagnostic_s2', reading: 'reading_diagnostic_s2', ela: 'ela_diagnostic_s2', summary: 'diagnostic_summary_s2' },
  { semester: 3, math: 'math_diagnostic_s3', reading: 'reading_diagnostic_s3', ela: 'ela_diagnostic_s3', summary: 'diagnostic_summary_s3' },
]

const diagnosticDefs: StudentRecordDef[] = DIAGNOSTIC_SEMESTERS.flatMap(s => [
  { type: s.math,    label: 'Math',    source: 'upload' as const, category: 'diagnostics' as const, semester: s.semester, description: `Mathematics diagnostic report — Semester ${s.semester}.` },
  { type: s.reading, label: 'Reading', source: 'upload' as const, category: 'diagnostics' as const, semester: s.semester, description: `Reading diagnostic report — Semester ${s.semester}.` },
  { type: s.ela,     label: 'ELA',     source: 'upload' as const, category: 'diagnostics' as const, semester: s.semester, description: `English Language Arts diagnostic report — Semester ${s.semester}.` },
  { type: s.summary, label: 'Summary', source: 'upload' as const, category: 'diagnostics' as const, semester: s.semester, description: `Diagnostic summary — Semester ${s.semester}.` },
])

export const STUDENT_RECORD_DEFS: StudentRecordDef[] = [
  ...diagnosticDefs,

  {
    type: 'assessment_instructions',
    label: 'Psychometric Assessment Login Information',
    source: 'generated',
    category: 'psychometric',
    description: 'Psychometric assessment instructions and Bodhi login details.',
  },
  {
    type: 'psychometric',
    label: 'Psychometric Assessment Results',
    source: 'upload',
    category: 'psychometric',
    description: 'Results of the guided online psychometric assessment.',
  },

  {
    type: 'edmentum_credentials',
    label: 'Edmentum Portal',
    source: 'generated',
    category: 'learning_resources',
    description: 'Edmentum login credentials for online-programme students.',
  },
  {
    type: 'stock_market_game',
    label: 'Stock Market Game Details',
    source: 'upload',
    category: 'learning_resources',
    description: 'Access details for the Stock Market Game.',
  },

  {
    type: 'course_confirmation',
    label: 'Course Confirmation',
    source: 'generated',
    category: 'course',
    description: 'Generated by the SIS from the confirmed subject selection.',
  },
  {
    type: 'weekly_schedule',
    label: 'Weekly Course Schedule',
    source: 'generated',
    category: 'course',
    description: 'Generated by the SIS from the student’s timetable blocks.',
  },
]

export const STUDENT_RECORD_LABELS: Record<StudentRecordType, string> = Object.fromEntries(
  STUDENT_RECORD_DEFS.map(d => [d.type, d.label]),
) as Record<StudentRecordType, string>

export function recordDefsForCategory(cat: RecordCategory): StudentRecordDef[] {
  return STUDENT_RECORD_DEFS.filter(d => d.category === cat)
}

/** Diagnostics grouped by semester, each ordered Math → Reading → ELA → Summary. */
export function diagnosticDefsBySemester(): Record<1 | 2 | 3, StudentRecordDef[]> {
  return {
    1: STUDENT_RECORD_DEFS.filter(d => d.category === 'diagnostics' && d.semester === 1),
    2: STUDENT_RECORD_DEFS.filter(d => d.category === 'diagnostics' && d.semester === 2),
    3: STUDENT_RECORD_DEFS.filter(d => d.category === 'diagnostics' && d.semester === 3),
  }
}

export const MAX_RECORD_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export function sanitizeRecordFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
}

export function rowToStudentRecord(r: Record<string, unknown>): StudentRecord {
  return {
    id: r.id as string,
    studentId: (r.student_id as string) ?? '',
    recordType: r.record_type as StudentRecordType,
    source: ((r.source as string) ?? 'upload') as StudentRecordSource,
    status: ((r.status as string) ?? 'pending') as StudentRecordStatus,
    storagePath: (r.storage_path as string | null) ?? null,
    fileName: (r.file_name as string | null) ?? null,
    fileSize: r.file_size == null ? null : Number(r.file_size),
    mimeType: (r.mime_type as string) ?? 'application/pdf',
    data: (r.data as Record<string, unknown> | null) ?? null,
    uploadedBy: (r.uploaded_by as string | null) ?? null,
    uploadedAt: (r.uploaded_at as string | null) ?? null,
    generatedAt: (r.generated_at as string | null) ?? null,
    signedFileUrl: (r.signed_file_url as string | null) ?? null,
    signedFileName: (r.signed_file_name as string | null) ?? null,
    signedSubmittedAt: (r.signed_submitted_at as string | null) ?? null,
    signedStatus: (r.signed_status as SignedReturnStatus | null) ?? null,
    signedReviewNote: (r.signed_review_note as string | null) ?? null,
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
