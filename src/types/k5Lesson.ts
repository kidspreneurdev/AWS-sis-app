export type SlideType = 'intro' | 'four' | 'journey' | 'parts' | 'give' | 'ready'

interface SlideBase { bg: string; title: string; type: SlideType }

export interface IntroSlide extends SlideBase {
  type: 'intro'
  body: string
  emoji: string
}

export interface FourSlide extends SlideBase {
  type: 'four'
  label: string
  items: Array<{ e: string; l: string; bg: string; tc: string }>
}

export interface JourneySlide extends SlideBase {
  type: 'journey'
  label: string
  steps: string[]
}

export interface PartsSlide extends SlideBase {
  type: 'parts'
  label: string
  items: Array<{ e: string; l: string; s: string }>
}

export interface GiveSlide extends SlideBase {
  type: 'give'
  label: string
  items: Array<{ e: string; l: string }>
}

export interface ReadySlide extends SlideBase {
  type: 'ready'
  body: string
}

export type K5Slide = IntroSlide | FourSlide | JourneySlide | PartsSlide | GiveSlide | ReadySlide

export interface K5Question {
  q: string
  e?: string
  opts: string[]
  ok: number
  /** @deprecated legacy single feedback field, kept for lessons saved before the correct/incorrect split */
  fb?: string
  fbCorrect?: string
  fbIncorrect?: string
}

export interface K5Lesson {
  id: string
  title: string
  subject: string
  gradeLevels: string[]
  slides: K5Slide[]
  quiz: K5Question[]
  badgeName: string
  estimatedMins: number
  status: 'Draft' | 'Published'
  slidesFileUrl: string | null
  slidesFileType: string | null
}

export interface K5ProgressRecord {
  lessonId: string
  status: 'not_started' | 'in_progress' | 'completed'
  starsEarned: number | null
  completedAt: string | null
}
