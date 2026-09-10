// Onboarding module — the fixed "Student Enrollment Checklist" from AWS.
// Section A (17 steps) applies to every student; Section B (5 steps) only shows
// when an admin flags the student as transferring high-school credits.
// Progress rows live in the `student_onboarding` table keyed by `step_key`;
// the transfer flag lives in `student_onboarding_meta.transferring_credits`.
//
// NOTE: api/student-portal/[action].js keeps a duplicate of the step-key list
// (it can't import from src/). Keep the two in sync.

export interface OnboardingStep {
  key: string
  /** Display number from the printed sheet, e.g. "1" or "T1". */
  num: string
  task: string
  owner: string
}

export interface OnboardingSection {
  id: 'A' | 'B'
  title: string
  subtitle?: string
  /** Section B only renders when the student is flagged as a transfer case. */
  transferOnly?: boolean
  steps: OnboardingStep[]
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    id: 'A',
    title: 'Section A — Full Enrollment Process',
    subtitle: 'Every step is completed before a student is considered fully onboarded.',
    steps: [
      { key: 'A1',  num: '1',  task: 'Application submitted',                              owner: 'Family' },
      { key: 'A2',  num: '2',  task: 'Documents verified',                                 owner: 'AWS Admissions' },
      { key: 'A3',  num: '3',  task: 'Offer letter issued',                                owner: 'AWS Admissions' },
      { key: 'A4',  num: '4',  task: 'Offer accepted & fees paid',                         owner: 'Family' },
      { key: 'A18', num: '5',  task: 'Graduation Audit is issued',                         owner: 'Academic Registrar' },
      { key: 'A5',  num: '6',  task: 'Psychometric assessment scheduled',                  owner: 'AWS Admissions' },
      { key: 'A6',  num: '7',  task: 'Counselling session completed',                      owner: 'Counsellor' },
      { key: 'A7',  num: '8',  task: 'Exact Path diagnostic completed',                    owner: 'Student' },
      { key: 'A8',  num: '9',  task: 'Subject selection documents shared',                 owner: 'AWS Admissions' },
      { key: 'A9',  num: '10', task: 'Final subject choices meeting held',                 owner: 'Student Success Consultant' },
      { key: 'A10', num: '11', task: 'Policies signed (student & family)',                 owner: 'Family / Student' },
      { key: 'A12', num: '12', task: 'Subjects added on portal',                           owner: 'AWS Onboarding Team' },
      { key: 'A13', num: '13', task: 'Student welcome session held',                       owner: 'Success Coach' },
      { key: 'A15', num: '14', task: 'First live class attended',                          owner: 'Student' },
    ],
  },
  {
    id: 'B',
    title: 'Section B — High School Transfer Credits',
    subtitle: 'Runs alongside Steps 2 and 8–9. Only applies to transfer cases.',
    transferOnly: true,
    steps: [
      { key: 'B1', num: 'T1', task: 'Flagged as transfer case at Document Verification',                   owner: 'AWS Admissions' },
      { key: 'B2', num: 'T2', task: 'Transcripts collected from all previous schools',                     owner: 'AWS Admissions' },
      { key: 'B3', num: 'T3', task: 'Credit transfer fee (Rs. 75,000) applied to invoice',                 owner: 'AWS Admissions / Finance' },
      { key: 'B4', num: 'T4', task: 'Credit evaluation completed; Graduation Audit Report generated',      owner: 'Academic Registrar' },
      { key: 'B5', num: 'T5', task: 'Graduation Audit Report shared with family (before Step 9)',           owner: 'Student Success Consultant' },
    ],
  },
]

export const ONBOARDING_STEP_KEYS: string[] = ONBOARDING_SECTIONS.flatMap(s => s.steps.map(st => st.key))

export interface OnboardingProgress {
  stepKey: string
  completed: boolean
  note: string | null
  completedAt: string | null
}

/** Steps visible for a student given their transfer status. */
export function visibleOnboardingSections(transferringCredits: boolean): OnboardingSection[] {
  return ONBOARDING_SECTIONS.filter(s => !s.transferOnly || transferringCredits)
}

export function visibleOnboardingStepKeys(transferringCredits: boolean): string[] {
  return visibleOnboardingSections(transferringCredits).flatMap(s => s.steps.map(st => st.key))
}
