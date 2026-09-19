// Data model for the SIS-generated "Stock Market Game — Login Details" letter.
// Stored as JSON on the student_records row (record_type = 'stock_market_game').

export interface StockMarketGameData {
  // Header
  title: string
  subtitle: string
  studentName: string
  studentIdCode: string
  gradeLevel: string
  firstName: string

  // Letter body
  introParagraph: string
  attachingLine: string

  // Credentials block
  credentialsHeading: string
  username: string
  password: string
  loginUrl: string

  // Training videos
  videosIntro: string
  videosUrl: string

  // Closing
  signOff: string

  generatedAt?: string
}

export interface SMGPrefillInput {
  firstName: string
  lastName: string
  studentIdCode: string
  grade: string | null
}

export function buildDefaultStockMarketGameData(input: SMGPrefillInput): StockMarketGameData {
  const grade = (input.grade == null ? '' : String(input.grade)).replace(/[^0-9]/g, '')

  return {
    title: 'The Stock Market Game — Login Details',
    subtitle: 'American World School',
    studentName: `${input.firstName} ${input.lastName}`.trim(),
    studentIdCode: input.studentIdCode || '',
    gradeLevel: grade,
    firstName: input.firstName || '',

    introParagraph:
      'Greetings! The Stock Market Game is a prestigious program of American World School where all of our ' +
      'students receive $100,000 in their accounts to invest in real-time stocks. Schools from all over the ' +
      'world are selected to participate in this exclusive program, with world wide rankings published on a ' +
      'daily basis, and the game actively reflecting fluctuations in the US Stock Market. We would recommend ' +
      'you to use AI (wisely) to research different companies, when to invest, when to sell, and understand ' +
      'different industries.',
    attachingLine: "I'm attaching the login details, along with where to login.",

    credentialsHeading: 'STOCK MARKET GAME — LOGIN CREDENTIALS',
    username: '',
    password: '',
    loginUrl: 'https://www.stockmarketgame.org/login.html',

    videosIntro:
      'There is a series of videos to help you navigate the platform, understand how to use the tools, and ' +
      'what it means to be a serious investor. Please find the videos through the link below.',
    videosUrl: 'https://www.youtube.com/watch?v=Wr_CM1IFZBI&list=PLJUvV25FAJfk2mjHRd3y4rpVuYd6SCcjn',

    signOff: 'Best Regards,\nAmerican World School',
  }
}

export function isStockMarketGameData(v: unknown): v is StockMarketGameData {
  return !!v && typeof v === 'object'
    && typeof (v as StockMarketGameData).loginUrl === 'string'
    && typeof (v as StockMarketGameData).username === 'string'
}
