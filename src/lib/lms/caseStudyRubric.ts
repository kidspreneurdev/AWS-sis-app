// Grading template for the LMS Case Study assignment (7-section revamp of the old
// generic "+Lesson" assignment block). CASE_STUDY_RUBRIC below is the DEFAULT template;
// a module (case-study content item) can override any category's criteria/weight via
// its `rubricOverrides` field (see getEffectiveRubric) — admins edit that per module in
// each section's popup (Show It / Prove It / Master It), the default is the fallback.

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

// Master It's assignment brief instructions — the same for every module by default, but
// each module's SectionModal can override it (stored on that module's presentationBrief
// field; the student page falls back to this text whenever that field is empty).
export const DEFAULT_PRESENTATION_BRIEF = 'Each student is assigned one question/perspective below. Working independently, read this module’s case study, research your assigned problem using evidence from the case, and prepare an individual presentation proposing a solution (see the companion Presentation Content Guide for structure). Every recommendation must be supported by specific evidence — section numbers, data points, or direct references to stakeholder memos —from the case study document'

export const SCORE_COMPONENT_TYPES = Object.keys(CASE_STUDY_RUBRIC) as ScoreComponentType[]

// Discussion Post is parked pending future exploration — its rubric definition stays
// above for when it's re-enabled, but it's excluded from the active flow and grade math.
export const ACTIVE_SCORE_COMPONENT_TYPES = SCORE_COMPONENT_TYPES.filter((t) => t !== 'discussion')

// Per-module custom rubric, keyed the same as CASE_STUDY_RUBRIC. Stored on a case-study
// content item's `rubricOverrides` field. A type with no override (or an empty criteria
// list) falls back to the default template.
export type RubricOverrides = Partial<Record<ScoreComponentType, RubricCategory>>

/** The rubric category actually in effect for one module + type — its custom override,
 *  or the default template if it hasn't customized this one. */
export function getEffectiveRubric(overrides: RubricOverrides | undefined, type: ScoreComponentType): RubricCategory {
  const custom = overrides?.[type]
  if (custom && custom.criteria.length > 0) return custom
  return CASE_STUDY_RUBRIC[type]
}

export function categoryMaxPointsOf(category: RubricCategory): number {
  return category.criteria.reduce((sum, c) => sum + c.max, 0)
}

/** round(earned / criteriaMax * categoryWeight) — the weighted subtotal for one category. */
export function categorySubtotalOf(category: RubricCategory, criteriaScores: Record<string, number>): number {
  const maxPts = categoryMaxPointsOf(category)
  if (!maxPts) return 0
  const earned = category.criteria.reduce((sum, c) => sum + (Number(criteriaScores[c.key]) || 0), 0)
  return Math.round((earned / maxPts) * category.weight)
}

/** Sum of the active category subtotals — null unless every active category has been scored.
 *  Discussion is excluded while parked (see ACTIVE_SCORE_COMPONENT_TYPES). */
export function finalGrade(subtotalsByType: Partial<Record<ScoreComponentType, number | null | undefined>>): number | null {
  let total = 0
  for (const type of ACTIVE_SCORE_COMPONENT_TYPES) {
    const v = subtotalsByType[type]
    if (v === null || v === undefined || Number.isNaN(v)) return null
    total += v
  }
  return Math.round(total)
}
