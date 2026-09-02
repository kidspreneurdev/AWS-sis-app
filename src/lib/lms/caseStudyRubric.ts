// Fixed grading template for the LMS Case Study assignment (7-section revamp of the
// old generic "+Lesson" assignment block). Not admin-editable — single source of truth
// shared by the admin grading panel and the student-facing case study panel so the two
// never disagree on criteria, max points, or the final grade math.

export interface RubricCriterion {
  key: string
  label: string
  max: number
}

export interface RubricCategory {
  weight: number
  label: string
  criteria: RubricCriterion[]
}

export type ScoreComponentType = 'notes' | 'discussion' | 'debate' | 'omr' | 'presentation'

export const CASE_STUDY_RUBRIC: Record<ScoreComponentType, RubricCategory> = {
  notes: {
    weight: 15,
    label: 'Notes Score',
    criteria: [{ key: 'physicalNotes', label: 'Physical Notes', max: 15 }],
  },
  discussion: {
    weight: 15,
    label: 'Discussion Post',
    criteria: [{ key: 'discussionBoard', label: 'Discussion Board', max: 15 }],
  },
  debate: {
    weight: 30,
    label: 'Socratic Debate',
    criteria: [
      { key: 'opening', label: 'Opening', max: 8 },
      { key: 'rebuttal', label: 'Rebuttal', max: 10 },
      { key: 'evidence', label: 'Evidence', max: 7 },
      { key: 'discourse', label: 'Discourse', max: 5 },
    ],
  },
  omr: {
    weight: 25,
    label: 'OMR Test',
    criteria: [
      { key: 'sectionA', label: 'Section A MCQ', max: 40 },
      { key: 'sectionB', label: 'Section B Short Resp.', max: 60 },
    ],
  },
  presentation: {
    weight: 15,
    label: 'Presentation Score',
    criteria: [
      { key: 'problemFraming', label: 'Problem Framing', max: 15 },
      { key: 'useOfEvidence', label: 'Use of Evidence', max: 20 },
      { key: 'qualityOfRecommendation', label: 'Quality of Recommendation', max: 20 },
      { key: 'riskTradeoff', label: 'Risk & Tradeoff', max: 10 },
      { key: 'businessEnglish', label: 'Business English', max: 15 },
      { key: 'delivery', label: 'Delivery', max: 10 },
      { key: 'slides', label: 'Slides', max: 10 },
    ],
  },
}

export const SCORE_COMPONENT_TYPES = Object.keys(CASE_STUDY_RUBRIC) as ScoreComponentType[]

export function categoryMaxPoints(type: ScoreComponentType): number {
  return CASE_STUDY_RUBRIC[type].criteria.reduce((sum, c) => sum + c.max, 0)
}

/** round(earned / criteriaMax * categoryWeight) — the weighted subtotal for one category. */
export function categorySubtotal(type: ScoreComponentType, criteriaScores: Record<string, number>): number {
  const category = CASE_STUDY_RUBRIC[type]
  const maxPts = categoryMaxPoints(type)
  if (!maxPts) return 0
  const earned = category.criteria.reduce((sum, c) => sum + (Number(criteriaScores[c.key]) || 0), 0)
  return Math.round((earned / maxPts) * category.weight)
}

/** Sum of the 5 category subtotals — null unless every category has been scored. */
export function finalGrade(subtotalsByType: Partial<Record<ScoreComponentType, number | null | undefined>>): number | null {
  let total = 0
  for (const type of SCORE_COMPONENT_TYPES) {
    const v = subtotalsByType[type]
    if (v === null || v === undefined || Number.isNaN(v)) return null
    total += v
  }
  return Math.round(total)
}
