// Data model for the SIS-generated "Edmentum Courseware Portal — Login Credentials"
// document. Stored as JSON on the student_records row (record_type = 'edmentum_credentials').
// Mostly static template; the dynamic bits are prefilled from the student's record.

export interface ECNote { title: string; body: string }
export interface ECContact { name: string; role: string; email: string }

export interface EdmentumCredentialsData {
  // Header
  title: string
  subtitle: string
  studentName: string
  studentIdCode: string
  gradeLevel: string
  firstName: string

  // Intro
  welcomeParagraph: string

  // Credentials block
  credentialsHeading: string
  portalUrl: string
  accountLogin: string
  username: string
  password: string
  securityNote: string

  // Logging in for the first time
  firstTimeHeading: string
  firstTimeSteps: ECNote[]

  // What to do next
  nextStepsHeading: string
  nextSteps: ECNote[]

  // Trouble logging in
  troubleHeading: string
  troubleParagraph: string

  // Contact / footer
  contactsIntro: string
  contacts: ECContact[]
  issuedDate: string
  disclaimer: string

  generatedAt?: string
}

export interface ECPrefillInput {
  firstName: string
  lastName: string
  studentIdCode: string
  grade: string | null
}

export function buildDefaultEdmentumCredentialsData(input: ECPrefillInput): EdmentumCredentialsData {
  const first = input.firstName || 'the student'
  const grade = (input.grade == null ? '' : String(input.grade)).replace(/[^0-9]/g, '')

  return {
    title: 'Your Edmentum Courseware Portal — Login Credentials',
    subtitle: 'American World School — Online Programme',
    studentName: `${input.firstName} ${input.lastName}`.trim(),
    studentIdCode: input.studentIdCode || '',
    gradeLevel: grade,
    firstName: input.firstName || '',

    welcomeParagraph:
      `Welcome to American World School! ${first}'s account on Edmentum, our courseware portal, is now ` +
      `ready. Edmentum is where ${first} will access course materials, complete Mastery Block assignments, ` +
      `track progress against target dates, and join scheduled Live Blocks.`,

    credentialsHeading: 'EDMENTUM COURSEWARE PORTAL — LOGIN CREDENTIALS',
    portalUrl: 'https://auth.edmentum.com/elf/login',
    accountLogin: 'AWSI',
    username: input.firstName || '',
    password: input.studentIdCode || '',
    securityNote:
      `Keep these credentials secure and do not share them with anyone outside your family — this login ` +
      `gives access to ${first}'s coursework, grades, and personal account.`,

    firstTimeHeading: 'Logging In for the First Time',
    firstTimeSteps: [
      { title: 'Go to the portal', body: 'visit the Portal URL above using a laptop or desktop browser for the best experience.' },
      { title: 'Sign in', body: 'enter the Account Login, Username and Password exactly as shown above.' },
      { title: 'Explore the dashboard', body: `you'll see ${first}'s enrolled courses, upcoming target dates, and current pacing status.` },
    ],

    nextStepsHeading: 'What to Do Next',
    nextSteps: [
      { title: 'Check the weekly schedule', body: 'confirm Live Block days and times against the Weekly Class Schedule already shared with you.' },
      { title: 'Review course materials', body: 'each enrolled course will show its syllabus, assignments, and target dates on Edmentum Coursewares.' },
      { title: 'Join the first Live Block', body: 'your Success Coach will share the video call link separately ahead of the first scheduled session.' },
      { title: 'Reach out if anything looks wrong', body: "if a course is missing, a target date looks off, or the login doesn't work, contact your Success Manager right away." },
    ],

    troubleHeading: 'Trouble Logging In?',
    troubleParagraph:
      "If you don't receive access, forget your password, or run into any technical issue, please contact your " +
      'Success Manager — do not attempt to create a new account, as this can cause duplicate records.',

    contactsIntro: 'For any questions about Edmentum access, please contact:',
    contacts: [
      { name: 'Ms. Radhika Rupini', role: 'High School Success Manager', email: 'radhika@americanworldschool.org' },
    ],
    issuedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    disclaimer: 'Do not attempt to create a new Edmentum account — contact your Success Manager to avoid duplicate records.',
  }
}

export function isEdmentumCredentialsData(v: unknown): v is EdmentumCredentialsData {
  return !!v && typeof v === 'object'
    && typeof (v as EdmentumCredentialsData).portalUrl === 'string'
    && Array.isArray((v as EdmentumCredentialsData).firstTimeSteps)
}
