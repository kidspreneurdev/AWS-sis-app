// Data model for the SIS-generated "Course Confirmation" document.
// Stored as JSON on the student_records row (record_type = 'course_confirmation').
// The document layout is mostly static template; these fields are the dynamic bits
// the admin fills in (prefilled from the student's SIS record where possible).

export interface CCStep { label: string; detail: string }
export interface CCCourseRow { course: string; subjectArea: string; creditValue: string; duration: string }
export interface CCAuditRow {
  subjectArea: string
  required: string
  earnedPrior: string
  addedThisYear: string
  status: string
  highlight: boolean
}
export interface CCNote { title: string; body: string }
export interface CCContact { name: string; role: string; email: string }

export interface CourseConfirmationData {
  // Header
  title: string            // "Course Confirmation — Grade 12, Senior Year"
  subtitle: string         // "Subject Selection Confirmed — Academic Year 2026–2027"
  studentName: string
  studentIdCode: string
  gradeLevel: string       // "12"
  academicYear: string     // "2026 – 2027"
  firstName: string        // used in the prose

  // Intro
  introParagraph: string

  // Steps completed
  steps: CCStep[]
  stepsFootnote: string

  // Confirmed courses
  coursesIntro: string
  courses: CCCourseRow[]
  totalCredits: string

  // Graduation progress
  gradProgressHeading: string
  gradProgressParagraph: string
  auditIntro: string
  auditRows: CCAuditRow[]
  schedulingNotes: CCNote[]

  // Next steps
  nextSteps: CCNote[]

  // Family confirmation
  familyConfirmationText: string

  // Contact / footer
  contactsIntro: string
  contacts: CCContact[]
  issuedDate: string
  disclaimer: string

  // Bookkeeping
  generatedAt?: string
}

const SENIOR_LABEL: Record<string, string> = {
  '9': 'Freshman Year',
  '10': 'Sophomore Year',
  '11': 'Junior Year',
  '12': 'Senior Year',
}

function durationFromCredits(credits: number | null | undefined): string {
  if (credits != null && credits <= 0.5) return 'One Term (Project)'
  return 'Full Year'
}

export interface CCPrefillInput {
  firstName: string
  lastName: string
  studentIdCode: string
  grade: string | null
  academicYear: string
  courses: { title: string; area: string | null; credits: number | null; term: string | null }[]
}

export function buildDefaultCourseConfirmationData(input: CCPrefillInput): CourseConfirmationData {
  const first = input.firstName || 'the student'
  const grade = (input.grade == null ? '' : String(input.grade)).replace(/[^0-9]/g, '')
  const yearLabel = SENIOR_LABEL[grade] ?? 'Senior Year'
  const ay = input.academicYear || ''

  const courseRows: CCCourseRow[] = input.courses.map(c => ({
    course: c.title ?? '',
    subjectArea: c.area ?? '',
    creditValue: c.credits != null ? c.credits.toFixed(1) : '',
    duration: durationFromCredits(c.credits),
  }))
  const totalCredits = input.courses
    .reduce((sum, c) => sum + (c.credits ?? 0), 0)
    .toFixed(1)

  return {
    title: grade ? `Course Confirmation — Grade ${grade}, ${yearLabel}` : 'Course Confirmation',
    subtitle: ay ? `Subject Selection Confirmed — Academic Year ${ay}` : 'Subject Selection Confirmed',
    studentName: `${input.firstName} ${input.lastName}`.trim(),
    studentIdCode: input.studentIdCode || '',
    gradeLevel: grade,
    academicYear: ay,
    firstName: input.firstName || '',

    introParagraph:
      `We're writing to confirm that ${first} has completed every step needed to finalize ${first}'s course ` +
      `schedule for the ${ay || 'upcoming'} academic year. Below is a summary of what's been completed, the ` +
      `courses selected, and how this year's plan supports ${first}'s progress toward the American High School Diploma.`,

    steps: [
      { label: 'Psychometric Assessment', detail: 'Completed, guided online by our team.' },
      { label: 'Diagnostics Assessment', detail: 'Completed.' },
      { label: 'Subject Selection Meeting', detail: 'Completed — course selections below were confirmed with the family.' },
    ],
    stepsFootnote:
      `With this meeting complete, ${first}'s case now moves into policy sign-off and platform setup — details in ` +
      `"Next Steps" below.`,

    coursesIntro: `The following courses have been finalized for ${first} this year:`,
    courses: courseRows.length ? courseRows : [{ course: '', subjectArea: '', creditValue: '', duration: 'Full Year' }],
    totalCredits,

    gradProgressHeading: `How This Year Supports ${first}'s Graduation Progress`,
    gradProgressParagraph: '',
    auditIntro: "This year's course selection directly addresses both:",
    auditRows: [
      { subjectArea: 'Language Arts', required: '4', earnedPrior: '', addedThisYear: '—', status: 'Met', highlight: false },
      { subjectArea: 'Mathematics', required: '4', earnedPrior: '', addedThisYear: '', status: '', highlight: true },
      { subjectArea: 'Science', required: '3', earnedPrior: '', addedThisYear: '', status: 'Met', highlight: false },
      { subjectArea: 'Social Studies', required: '3', earnedPrior: '', addedThisYear: '—', status: 'Met', highlight: false },
      { subjectArea: 'Fine Arts', required: '1', earnedPrior: '', addedThisYear: '—', status: 'Met', highlight: false },
      { subjectArea: 'PE or Health', required: '1', earnedPrior: '', addedThisYear: '', status: 'Met', highlight: false },
      { subjectArea: 'Free Electives', required: '8', earnedPrior: '', addedThisYear: '', status: 'Met', highlight: false },
    ],
    schedulingNotes: [],

    nextSteps: [
      { title: 'Policy Sign-Off', body: 'AWS will share the required policy documents for signature by both the student and a parent/guardian.' },
      { title: 'School Calendar', body: 'The official school calendar will follow once policies are signed.' },
      { title: 'Portal Setup', body: 'These confirmed subjects will be added to the student’s account on the learning platform.' },
      { title: 'Welcome Session', body: 'A short orientation session will be scheduled to help the student get familiar with the platform before classes begin.' },
    ],

    familyConfirmationText: 'Please sign below to confirm you have reviewed and approve the course selections listed above.',

    contactsIntro: `For any questions about ${first}'s schedule, please contact:`,
    contacts: [
      { name: 'Ms. Radhika Rupini', role: 'High School Success Manager', email: 'radhika@americanworldschool.org' },
      { name: 'Mrs. Lekha Chandri Sreenivasakam', role: 'Principal', email: 'principal@americanworldschool.org' },
    ],
    issuedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    disclaimer: 'This confirms subject selection only. Official academic records remain with the Registrar.',
  }
}

export function isCourseConfirmationData(v: unknown): v is CourseConfirmationData {
  return !!v && typeof v === 'object' && Array.isArray((v as CourseConfirmationData).courses)
}
