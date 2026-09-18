import type { SignedReturnStatus } from '@/types/studentRecord'
import type { PolicyDocStatus } from '@/types/policyDocument'

export const REQUIRED_DOCS = ['Passport', 'Visa', 'Birth Certificate', 'Medical Records', 'Immunization Records', 'Emergency Contact Form', 'Photo ID', 'Previous School Records']

export type HubStatus = 'Action needed' | 'Awaiting school' | 'Complete'

export const HUB_STATUS_META: Record<HubStatus, { bg: string; fg: string }> = {
  'Action needed': { bg: '#FEE2E2', fg: '#D61F31' },
  'Awaiting school': { bg: '#FEF3C7', fg: '#B45309' },
  'Complete': { bg: '#DCFCE7', fg: '#0E6B3B' },
}

// student_documents has no upload UI at all today (only the school can add a row),
// so a student can never resolve "Missing" themselves from this hub — it reads as
// "Awaiting school", not "Action needed".
export function mapDocumentStatus(status: string): HubStatus {
  if (status === 'Approved') return 'Complete'
  return 'Awaiting school'
}

export function mapRecordStatus(available: boolean, signedStatus: SignedReturnStatus | null, needsSignature: boolean): HubStatus {
  if (!available) return 'Awaiting school'
  if (!needsSignature) return 'Complete'
  if (signedStatus === 'approved') return 'Complete'
  if (signedStatus === 'submitted') return 'Awaiting school'
  return 'Action needed'
}

export function mapPolicyStatus(status: PolicyDocStatus): HubStatus {
  if (status === 'approved') return 'Complete'
  if (status === 'submitted') return 'Awaiting school'
  return 'Action needed'
}

export function mapOnboardingStatus(completed: boolean): HubStatus {
  return completed ? 'Complete' : 'Action needed'
}
