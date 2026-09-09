// Data model for the SIS-generated "Weekly Class Schedule & Credit Hour Breakdown"
// document. Stored as JSON on the student_records row (record_type = 'weekly_schedule').
// Mostly static template; the admin fills the dynamic bits, prefilled from the
// student's record + timetable_blocks where possible.

export interface WSNote { title: string; body: string }
export interface WSContact { name: string; role: string; email: string }

export interface WSScheduleRow {
  day: string
  time: string
  subject: string
  teacher: string
  activeTerm: string
  highlight: boolean
}

export interface WSCreditRow {
  subject: string
  term: string
  liveSessions: string
  liveHours: string
  selfPacedHours: string
  totalHours: string
  creditEarned: string
  highlight: boolean
}

export interface WeeklyScheduleData {
  // Header
  title: string
  subtitle: string
  studentName: string
  studentIdCode: string
  gradeLevel: string
  academicYear: string
  firstName: string

  // Intro
  introParagraph: string

  // How credit hours are calculated
  creditHoursHeading: string
  creditHoursIntro: string
  creditParts: WSNote[]
  creditFillIntro: string
  creditTiers: WSNote[]
  termLengthNote: string

  // Weekly schedule
  scheduleHeading: string
  scheduleParagraphs: string[]
  scheduleRows: WSScheduleRow[]

  // Day summaries + notes
  daySummaries: WSNote[]
  chemistryNote: string
  extraNotes: WSNote[]

  // Credit hours by subject
  creditTableHeading: string
  creditTableIntro: string
  creditRows: WSCreditRow[]
  totalCredits: string
  creditTableCaption: string

  // Family confirmation
  familyConfirmationText: string

  // Contact / footer
  contactsIntro: string
  contacts: WSContact[]
  issuedDate: string
  disclaimer: string

  generatedAt?: string
}

const SENIOR_LABEL: Record<string, string> = {
  '9': 'Freshman Year', '10': 'Sophomore Year', '11': 'Junior Year', '12': 'Senior Year',
}

const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
}

function startMinutes(time: string): number {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = (m[3] || '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}

export interface WSPrefillInput {
  firstName: string
  lastName: string
  studentIdCode: string
  grade: string | null
  academicYear: string
  blocks: { day: string; time: string; subject: string; teacher: string }[]
}

export function buildDefaultWeeklyScheduleData(input: WSPrefillInput): WeeklyScheduleData {
  const first = input.firstName || 'the student'
  const grade = (input.grade == null ? '' : String(input.grade)).replace(/[^0-9]/g, '')
  const yearLabel = SENIOR_LABEL[grade] ?? 'Senior Year'
  const ay = input.academicYear || ''

  const scheduleRows: WSScheduleRow[] = [...input.blocks]
    .sort((a, b) => {
      const d = (DAY_ORDER[a.day?.toLowerCase()] ?? 9) - (DAY_ORDER[b.day?.toLowerCase()] ?? 9)
      return d !== 0 ? d : startMinutes(a.time) - startMinutes(b.time)
    })
    .map(b => ({
      day: b.day ?? '',
      time: b.time ?? '',
      subject: b.subject ?? '',
      teacher: b.teacher ?? '',
      activeTerm: 'Full Year',
      highlight: false,
    }))

  const subjects = Array.from(new Set(input.blocks.map(b => b.subject).filter(Boolean)))
  const creditRows: WSCreditRow[] = subjects.map(s => ({
    subject: s,
    term: 'Full Year',
    liveSessions: '38',
    liveHours: '57',
    selfPacedHours: '63',
    totalHours: '120',
    creditEarned: '1.0',
    highlight: false,
  }))
  const totalCredits = creditRows.reduce((sum, r) => sum + (parseFloat(r.creditEarned) || 0), 0).toFixed(1)

  return {
    title: 'Weekly Class Schedule & Credit Hour Breakdown',
    subtitle: `${input.firstName} ${input.lastName}`.trim()
      + (grade ? ` — Grade ${grade}, ${yearLabel}` : '')
      + (ay ? `, Academic Year ${ay}` : ''),
    studentName: `${input.firstName} ${input.lastName}`.trim(),
    studentIdCode: input.studentIdCode || '',
    gradeLevel: grade,
    academicYear: ay,
    firstName: input.firstName || '',

    introParagraph:
      `With ${first}'s subjects and teachers confirmed, this document lays out ${first}'s weekly live-class ` +
      `schedule and how each subject's credit hours are calculated. This is the same credit-hour methodology ` +
      `used across all AWS programmes.`,

    creditHoursHeading: 'How Credit Hours Are Calculated',
    creditHoursIntro:
      'Each subject earns credit based on total learning time, not live class time alone. Total learning time is made up of three parts:',
    creditParts: [
      { title: 'Live class', body: '1.5 hours per week, per subject, with the assigned teacher or Success Coach.' },
      { title: 'Case study work', body: 'applying what was covered in the live class.' },
      { title: 'Assignments', body: 'practice tasks and homework.' },
    ],
    creditFillIntro:
      'Case study work and assignments together fill the remaining hours needed to reach the total for each subject:',
    creditTiers: [
      { title: 'Half credit (0.5)', body: '60 hours of total learning time — completed within one term.' },
      { title: 'Full credit (1.0)', body: '120 hours of total learning time — completed across the full year (both terms).' },
    ],
    termLengthNote:
      'Note: term length is estimated at 19 weeks per term for this calculation — please confirm exact term dates with the Registrar before sharing final term dates with the family.',

    scheduleHeading: `${first}'s Weekly Schedule — Confirmed Teachers & Times`,
    scheduleParagraphs: [
      `${first}'s live classes run Monday through Friday, taught by the assigned teachers below.`,
      `Each live lesson is followed by a subject-based Mastery Work block on the same day — focused, self-paced ` +
      `practice while the material is fresh, with Success Manager support available if needed. The weekly mandatory ` +
      `Success Manager check-in and a subject-specific doubt-clearing session are also included below.`,
    ],
    scheduleRows: scheduleRows.length ? scheduleRows : [
      { day: 'Monday', time: '', subject: '', teacher: '', activeTerm: 'Full Year', highlight: false },
    ],

    daySummaries: [],
    chemistryNote: '',
    extraNotes: [
      { title: 'Doubt-clearing session', body: `a weekly 20-minute session based on ${first}'s specific subject needs, arranged by the Success Manager with whichever Success Coach is best suited that week.` },
      { title: 'Total weekly structured time', body: 'approximately 31.5 hours of live class and Mastery Work combined, plus the weekly Success Manager check-in and doubt-clearing session.' },
    ],

    creditTableHeading: 'Credit Hours by Subject',
    creditTableIntro:
      'The table below shows the minimum live and self-paced hours required for each subject\'s credit. The scheduled Mastery Work blocks meet and exceed these self-paced minimums.',
    creditRows: creditRows.length ? creditRows : [
      { subject: '', term: 'Full Year', liveSessions: '38', liveHours: '57', selfPacedHours: '63', totalHours: '120', creditEarned: '1.0', highlight: false },
    ],
    totalCredits,
    creditTableCaption: '',

    familyConfirmationText:
      `Please sign below to confirm you have reviewed and understand ${first}'s weekly schedule and credit hour plan.`,

    contactsIntro: `For any questions about ${first}'s schedule, please contact:`,
    contacts: [
      { name: 'Ms. Radhika Rupini', role: 'High School Success Manager', email: 'radhika@americanworldschool.org' },
      { name: 'Mrs. Lekha Chandri Sreenivasakam', role: 'Principal', email: 'principal@americanworldschool.org' },
    ],
    issuedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    disclaimer: 'Schedule and times are subject to confirmation before Term 1 begins.',
  }
}

export function isWeeklyScheduleData(v: unknown): v is WeeklyScheduleData {
  return !!v && typeof v === 'object' && Array.isArray((v as WeeklyScheduleData).scheduleRows)
}
