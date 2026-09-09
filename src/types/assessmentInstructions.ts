// Data model for the SIS-generated "Assessment Instructions" document
// (psychometric assessment procedure + Bodhi login details).
// Stored as JSON on the student_records row (record_type = 'assessment_instructions').

export interface AICategory { title: string; body: string }

export interface AssessmentInstructionsData {
  // Header (optional — the template has no visible title)
  title: string
  subtitle: string
  studentName: string
  studentIdCode: string
  firstName: string

  // Greeting + intro
  greetingLine: string
  introParagraph: string

  // Procedure
  procedureHeading: string
  procedureSteps: string[]

  // Assessment categories
  categoriesHeading: string
  categories: AICategory[]
  browserWarning: string

  // Bodhi login
  loginId: string
  password: string
  status: string

  // Note
  noteHeading: string
  noteParagraph: string
  helpLine: string
  signOff: string

  generatedAt?: string
}

export interface AIPrefillInput {
  firstName: string
  lastName: string
  studentIdCode: string
}

export function buildDefaultAssessmentInstructionsData(input: AIPrefillInput): AssessmentInstructionsData {
  return {
    title: '',
    subtitle: '',
    studentName: `${input.firstName} ${input.lastName}`.trim(),
    studentIdCode: input.studentIdCode || '',
    firstName: input.firstName || '',

    greetingLine: 'Greetings from American World School!',
    introParagraph:
      'Choosing your career path starts with uncovering what makes you stand out! This psychometric assessment ' +
      'will highlight your strengths and identify areas for improvement. For the best results, approach each test ' +
      'honestly and take a moment to read the instructions before you begin.',

    procedureHeading: 'Procedure to take up the test:',
    procedureSteps: [
      'Select a quiet place where you will not be disturbed during the test taking process. Switch off cell phones, MP3 players, TV, etc. which can distract you.',
      'Keep a paper and pen with you.',
      'You need a Broadband connection (minimum speed 2Mbps) to take the tests. In case you have a dialup connection, please move to a different location that has Broadband connection.',
      'Kindly ensure that the browser you are using is Mozilla Firefox or Chrome.',
      'The assessment can only be taken on your desktop & laptop (do not use an iPad or any other tools).',
      'Visit the Bodhi website at http://bodhi.co.in and click on the online test login displayed at the bottom.',
      'A login box will be displayed.',
      'In the text box labeled Login ID, enter your Login ID.',
      'In the text box labeled Password, enter your password.',
      'Click the Login button.',
      'You will be taken to a Registration page, where you have to fill in your personal details. Once finished, click the finish button to complete the registration process. Make sure to include an email ID you currently use.',
      'After filling the registration form, you will be taken to the General Instructions page.',
      'Please read this page carefully.',
      'You will be taken through the tests one at a time and at the end of it, you will be shown a Test Completion screen.',
      'Close this screen and that will be the end of the test.',
    ],

    categoriesHeading: 'The Psychometric Assessment comprises of the following three categories:',
    categories: [
      { title: '1. INTEREST TEST', body: 'Please answer all the questions in this test. There are no time limits to finish this test.' },
      { title: '2. APTITUDE TEST', body: 'There are seven sub-tests in the Aptitude Test. Each sub-test is a timed test. You can see the time remaining on the top right of the screen. At the end of the time, the test will automatically submit and move on to the next test. If you finish the sub-test within the given time, you can press "Finish" and go to the next sub-test. Each sub-test has an instruction page with examples. There is no time limit to read the instructions page. Please have a pen and paper with you to do the calculations. Do NOT use a calculator to make the calculations.' },
      { title: '3. PERSONALITY TEST', body: 'Please answer all the questions in this section. There is no time limit.' },
    ],
    browserWarning:
      'Do not close the browser window until you finish all three parts. At the end of the personality test, you ' +
      'will be taken to a "Test completion" page. After reaching this page, you can close your browser.',

    loginId: '',
    password: '',
    status: 'Active',

    noteHeading: 'NOTE:',
    noteParagraph:
      'Suppose there is a power failure or your computer restarts. Do not panic! Simply go to the website, enter ' +
      'the login ID and password. The test will start exactly where you left off. You have 2 attempts with the ' +
      'Psychometric Assessment.',
    helpLine: 'If you need any help, please feel free to contact your success manager.',
    signOff: 'Warm Regards,\nAmerican World School',
  }
}

export function isAssessmentInstructionsData(v: unknown): v is AssessmentInstructionsData {
  return !!v && typeof v === 'object'
    && Array.isArray((v as AssessmentInstructionsData).procedureSteps)
    && typeof (v as AssessmentInstructionsData).status === 'string'
}
