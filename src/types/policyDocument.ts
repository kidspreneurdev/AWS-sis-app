// Policy Documents module — the 5 fixed school policy PDFs students must read,
// sign and return. Blank PDFs live in public/Policy/. Progress rows live in the
// `student_policy_documents` table keyed by `policy_key`; a row exists only once
// the admin has sent the request.
//
// NOTE: api/student-portal/[action].js keeps a duplicate of the key list + labels
// (it can't import from src/). Keep the two in sync.

export interface PolicyDoc {
  key: string
  label: string
  /** Path to the blank PDF under public/ — contains spaces, wrap in encodeURI() for hrefs. */
  file: string
}

export const POLICY_DOCS: PolicyDoc[] = [
  { key: 'academic_integrity',      label: 'Academic Integrity Policy',  file: '/Policy/Academic Integrity Policy.pdf' },
  { key: 'graduation_requirements', label: 'Graduation Requirements',    file: '/Policy/Graduation Requirements.pdf' },
  { key: 'repeated_courses',        label: 'Repeated Courses Policy',    file: '/Policy/Repeated Courses Policy.pdf' },
  { key: 'student_attendance',      label: 'Student Attendance Policy',  file: '/Policy/Student Attendance Policy.pdf' },
  { key: 'transcript_revision',     label: 'Transcript Revision Policy', file: '/Policy/Transcript Revision Policy .pdf' },
]

export const POLICY_DOC_KEYS: string[] = POLICY_DOCS.map(d => d.key)

export const POLICY_DOC_LABELS: Record<string, string> = Object.fromEntries(
  POLICY_DOCS.map(d => [d.key, d.label]),
)

export const POLICY_DOC_BY_KEY: Record<string, PolicyDoc> = Object.fromEntries(
  POLICY_DOCS.map(d => [d.key, d]),
)

export type PolicyDocStatus = 'requested' | 'submitted' | 'approved' | 'rejected'

export interface PolicyDocRow {
  policyKey: string
  status: PolicyDocStatus
  signedFileUrl: string | null
  signedFileName: string | null
  submittedAt: string | null
  reviewNote: string | null
  requestedAt: string | null
}

export const POLICY_STATUS_META: Record<PolicyDocStatus, { label: string; bg: string; fg: string }> = {
  requested: { label: 'Requested',  bg: '#FFF4E5', fg: '#9A5B00' },
  submitted: { label: 'Submitted',  bg: '#E6F4FF', fg: '#0369A1' },
  approved:  { label: 'Approved',   bg: '#E8FBF0', fg: '#0E6B3B' },
  rejected:  { label: 'Rejected',   bg: '#FEE2E2', fg: '#991B1B' },
}
