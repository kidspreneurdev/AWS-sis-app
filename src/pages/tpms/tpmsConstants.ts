// ── TPMS Shared Constants ──────────────────────────────────────────────────────

export const TPMS_SUBJECTS = [
  'English Language Arts', 'Mathematics', 'Science', 'Social Studies',
  'World Languages', 'Physical Education', 'Visual & Performing Arts',
  'Computer Science', 'Elective', 'Advisory / PSHE', 'Other',
]

export const TPMS_GRADES = [
  'Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11', 'Grade 12',
]

export const TPMS_LESSON_STATUS = ['Draft', 'Ready for Review', 'Published', 'Archived']
export const TPMS_UNIT_STATUS = ['Planning', 'Active', 'Completed', 'On Hold']
export const TPMS_PACING_STATUS = ['On Track', 'Behind', 'Significantly Behind', 'Ahead']

export const TPMS_EVENT_TYPES = [
  'Holiday', 'School Day', 'Professional Development', 'Assessment',
  'Field Trip', 'Parent Conference', 'School Event', 'Department Meeting',
  'Deadline', 'Other',
]

export const TPMS_EVENT_COLORS: Record<string, string> = {
  'Holiday': '#D61F31',
  'School Day': '#1DBD6A',
  'Professional Development': '#7C3AED',
  'Assessment': '#D97706',
  'Field Trip': '#0EA5E9',
  'Parent Conference': '#059669',
  'School Event': '#EC4899',
  'Department Meeting': '#6366F1',
  'Deadline': '#EF4444',
  'Other': '#6B7280',
}

// Standards Bank (abbreviated key standards per framework)
export const STANDARDS_BANK: Record<string, string[]> = {
  'AERO ELA': [
    'AERO.ELA.K.RF.1 — Print concepts', 'AERO.ELA.1.RF.3 — Phonics and word recognition',
    'AERO.ELA.2.RI.1 — Key ideas in informational text', 'AERO.ELA.3.RL.3 — Character & setting analysis',
    'AERO.ELA.4.W.1 — Opinion/argument writing', 'AERO.ELA.5.SL.4 — Presentations',
    'AERO.ELA.6.RI.6 — Author purpose', 'AERO.ELA.7.W.2 — Informative writing',
    'AERO.ELA.8.RL.9 — Cross-textual analysis', 'AERO.ELA.9-10.RI.1 — Textual evidence',
    'AERO.ELA.11-12.W.1 — Argumentative writing', 'AERO.ELA.11-12.L.3 — Language conventions',
  ],
  'AERO Mathematics': [
    'AERO.Math.K.CC.1 — Count to 100', 'AERO.Math.1.OA.1 — Addition & subtraction word problems',
    'AERO.Math.2.NBT.7 — Multi-digit addition/subtraction', 'AERO.Math.3.NF.1 — Fraction understanding',
    'AERO.Math.4.MD.3 — Area and perimeter', 'AERO.Math.5.NF.7 — Division of fractions',
    'AERO.Math.6.RP.1 — Ratios and proportional relationships', 'AERO.Math.7.NS.1 — Rational number operations',
    'AERO.Math.8.EE.5 — Linear equations', 'AERO.Math.HS.A-REI.4 — Quadratic equations',
    'AERO.Math.HS.F-IF.7 — Graph functions', 'AERO.Math.HS.S-ID.1 — Statistical data display',
  ],
  'AERO Science': [
    'AERO.Sci.K-2.PS1 — Matter and its properties', 'AERO.Sci.3-5.LS1 — From molecules to organisms',
    'AERO.Sci.6-8.ESS2 — Earth systems', 'AERO.Sci.9-12.PS3 — Energy',
    'AERO.Sci.9-12.LS4 — Biological evolution', 'AERO.Sci.6-8.ETS1 — Engineering design',
  ],
  'AERO Social Studies': [
    'AERO.SS.K-2.H1 — Historical thinking', 'AERO.SS.3-5.G1 — Geographic concepts',
    'AERO.SS.6-8.C1 — Civic and political institutions', 'AERO.SS.9-12.E1 — Economic decision-making',
    'AERO.SS.9-12.H3 — Historical analysis', 'AERO.SS.6-8.SS1 — Social and cultural practices',
  ],
  'CCSS ELA': [
    'CCSS.ELA-LITERACY.RL.9-10.1 — Cite textual evidence', 'CCSS.ELA-LITERACY.RI.11-12.6 — Author purpose',
    'CCSS.ELA-LITERACY.W.7.1 — Write arguments', 'CCSS.ELA-LITERACY.SL.8.4 — Present information',
    'CCSS.ELA-LITERACY.L.6.1 — Grammar conventions', 'CCSS.ELA-LITERACY.RH.9-10.2 — Central ideas',
  ],
  'CCSS Mathematics': [
    'CCSS.MATH.HSA-APR.B.3 — Factor and roots of polynomials', 'CCSS.MATH.HSF-TF.A.1 — Radian measure',
    'CCSS.MATH.HSS-MD.A.1 — Probability distributions', '6.RP.A.1 — Understand ratio concepts',
    '8.G.B.7 — Pythagorean theorem', 'K.CC.A.1 — Count to 100 by ones and tens',
  ],
  'NGSS': [
    'NGSS.MS-PS1-1 — Properties of matter', 'NGSS.MS-LS1-1 — Cell structure and function',
    'NGSS.HS-PS2-1 — Newtons laws of motion', 'NGSS.HS-LS3-1 — DNA and inheritance',
    'NGSS.MS-ESS1-1 — Earths place in the universe', 'NGSS.HS-ETS1-1 — Engineering design',
  ],
  'IB MYP': [
    'IB.MYP.Lang.A.1 — Analyzing language', 'IB.MYP.Lang.A.2 — Organizing ideas',
    'IB.MYP.Math.1 — Knowing and understanding', 'IB.MYP.Math.4 — Applying mathematics in real-world contexts',
    'IB.MYP.Sci.1 — Knowing and understanding science', 'IB.MYP.Sci.4 — Reflecting on science',
    'IB.MYP.Indv.1 — Knowing and understanding the world', 'IB.MYP.Arts.1 — Knowing and understanding the arts',
  ],
  'AWS Custom': [
    'AWS.SEL.1 — Self-awareness and emotional regulation', 'AWS.SEL.2 — Social awareness and empathy',
    'AWS.SEL.3 — Responsible decision making', 'AWS.21C.1 — Critical thinking and problem solving',
    'AWS.21C.2 — Creativity and innovation', 'AWS.21C.3 — Communication skills',
    'AWS.21C.4 — Collaboration and teamwork', 'AWS.GC.1 — Global citizenship',
    'AWS.GC.2 — Cultural competence', 'AWS.PT.1 — Project methodology mastery',
  ],
}

export const TPMS_STANDARDS_FLAT: string[] = Object.values(STANDARDS_BANK).flat()

// ── TypeScript interfaces ─────────────────────────────────────────────────────

export interface TpmsLesson {
  id: string
  title: string
  subject: string
  grade: string
  date: string
  lessonNum: number
  unitId: string
  status: string
  objectives: string
  standards: string[]
  langObjective: string
  resources: string
  tech: string
  room: string
  hook: string
  direct: string
  guided: string
  independent: string
  closure: string
  formative: string
  successCriteria: string
  homework: string
  extension: string
  support: string
  iep: string
  reflection: string
  engagement: string
  carryForward: string
  coachId: string
  createdAt: string
}

export interface TpmsUnit {
  id: string
  title: string
  subject: string
  grade: string
  startDate: string
  endDate: string
  status: string
  pacing: string
  weeks: string
  standards: string[]
  essentialQuestions: string
  enduringUnderstandings: string
  transferGoals: string
  stage2Evidence: string
  stage2Tasks: string
  stage3Plan: string
  notes: string
  coachId: string
  managerId: string
  diff: string
  resources: string
  crossCurricular: string
  reflection: string
}

export interface TpmsEvent {
  id: string
  title: string
  date: string
  endDate: string
  type: string
  layer: string
  description: string
}

export interface TpmsBlock {
  id: string
  name: string
  day: string
  period: string
  time: string
  duration: number
  subject: string
  cohort: string
  coachId: string
  managerId: string
  room: string
  maxStudents: number
  notes: string
}

export interface TpmsPd {
  id: string
  title: string
  type: string
  date: string
  hours: number
  provider: string
  notes: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapLesson(r: Record<string, unknown>): TpmsLesson {
  let c: Record<string, unknown> = {}
  try { c = JSON.parse((r.content as string) || '{}') } catch {/**/}
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    subject: (c.subject as string) ?? '',
    grade: (c.grade as string) ?? '',
    date: (r.date as string) ?? '',
    lessonNum: (c.lessonNum as number) ?? 1,
    unitId: (c.unitId as string) ?? '',
    status: (r.status as string) ?? 'Draft',
    objectives: (c.objectives as string) ?? '',
    standards: (c.standards as string[]) ?? [],
    langObjective: (c.langObjective as string) ?? '',
    resources: (c.resources as string) ?? '',
    tech: (c.tech as string) ?? '',
    room: (c.room as string) ?? '',
    hook: (c.hook as string) ?? '',
    direct: (c.direct as string) ?? '',
    guided: (c.guided as string) ?? '',
    independent: (c.independent as string) ?? '',
    closure: (c.closure as string) ?? '',
    formative: (c.formative as string) ?? '',
    successCriteria: (c.successCriteria as string) ?? '',
    homework: (c.homework as string) ?? '',
    extension: (c.extension as string) ?? '',
    support: (c.support as string) ?? '',
    iep: (c.iep as string) ?? '',
    reflection: (c.reflection as string) ?? '',
    engagement: (c.engagement as string) ?? '',
    carryForward: (c.carryForward as string) ?? '',
    coachId: (c.coachId as string) ?? '',
    createdAt: (r.created_at as string) ?? '',
  }
}

export function mapUnit(r: Record<string, unknown>): TpmsUnit {
  let c: Record<string, unknown> = {}
  try { c = JSON.parse((r.content as string) || '{}') } catch {/**/}
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    subject: (c.subject as string) ?? '',
    grade: (c.grade as string) ?? '',
    startDate: (c.startDate as string) ?? '',
    endDate: (c.endDate as string) ?? '',
    status: (r.status as string) ?? 'Planning',
    pacing: (c.pacing as string) ?? 'On Track',
    weeks: (c.weeks as string) ?? '',
    standards: (c.standards as string[]) ?? [],
    essentialQuestions: (c.essentialQuestions as string) ?? '',
    enduringUnderstandings: (c.enduringUnderstandings as string) ?? '',
    transferGoals: (c.transferGoals as string) ?? '',
    stage2Evidence: (c.stage2Evidence as string) ?? '',
    stage2Tasks: (c.stage2Tasks as string) ?? '',
    stage3Plan: (c.stage3Plan as string) ?? '',
    notes: (c.notes as string) ?? '',
    coachId: (c.coachId as string) ?? '',
    managerId: (c.managerId as string) ?? '',
    diff: (c.diff as string) ?? '',
    resources: (c.resources as string) ?? '',
    crossCurricular: (c.crossCurricular as string) ?? '',
    reflection: (c.reflection as string) ?? '',
  }
}

export function mapEvent(r: Record<string, unknown>): TpmsEvent {
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    date: (r.date as string) ?? '',
    endDate: (r.end_date as string) ?? '',
    type: (r.type as string) ?? 'Other',
    layer: (r.layer as string) ?? 'school',
    description: (r.description as string) ?? '',
  }
}

export function mapPd(r: Record<string, unknown>): TpmsPd {
  let c: Record<string, unknown> = {}
  try { c = JSON.parse((r.content as string) || '{}') } catch {/**/}
  return {
    id: r.id as string,
    title: (r.title as string) ?? '',
    type: (c.pdType as string) ?? 'Workshop',
    date: (r.date as string) ?? '',
    hours: (c.hours as number) ?? 1,
    provider: (c.provider as string) ?? '',
    notes: (c.notes as string) ?? '',
  }
}

export const LESSON_STATUS_META: Record<string, { bg: string; tc: string }> = {
  'Draft':           { bg: '#F3F4F6', tc: '#7A92B0' },
  'Ready for Review':{ bg: '#FEF3C7', tc: '#92400E' },
  'Published':       { bg: '#D1FAE5', tc: '#065F46' },
  'Archived':        { bg: '#FFF6E0', tc: '#B45309' },
}

export const UNIT_STATUS_META: Record<string, { bg: string; tc: string }> = {
  'Planning':  { bg: '#EDE9FE', tc: '#6D28D9' },
  'Active':    { bg: '#D1FAE5', tc: '#065F46' },
  'Completed': { bg: '#DBEAFE', tc: '#1E40AF' },
  'On Hold':   { bg: '#FEE2E2', tc: '#991B1B' },
}

export const PACING_META: Record<string, { bg: string; tc: string }> = {
  'On Track':           { bg: '#D1FAE5', tc: '#065F46' },
  'Behind':             { bg: '#FEF3C7', tc: '#92400E' },
  'Significantly Behind':{ bg: '#FEE2E2', tc: '#991B1B' },
  'Ahead':              { bg: '#DBEAFE', tc: '#1E40AF' },
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const PERIODS = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8']
