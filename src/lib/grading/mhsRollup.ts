import { supabase } from '@/lib/supabase'

export type MhsComponentType = 'quiz' | 'notes' | 'discussion' | 'debate' | 'omr' | 'capstone'

export interface MhsConfig {
  mastery_weight_quiz: number
  mastery_weight_discussion: number
  mastery_weight_debate: number
  mastery_weight_omr: number
  mastery_weight_notes: number
  quiz_gate_threshold_pct: number
  quiz_max_attempts: number
  how_diploma_threshold_pct: number | null
  mastery_diploma_threshold_pct: number | null
  honor_roll_how_threshold_pct: number
  percent_to_letter: Record<string, number>
}

const COMPONENT_WEIGHT_KEY: Record<Exclude<MhsComponentType, 'capstone'>, keyof MhsConfig> = {
  quiz: 'mastery_weight_quiz',
  discussion: 'mastery_weight_discussion',
  debate: 'mastery_weight_debate',
  omr: 'mastery_weight_omr',
  notes: 'mastery_weight_notes',
}

export async function getMhsConfig(): Promise<MhsConfig> {
  const { data, error } = await supabase.from('mhs_config').select('*').single()
  if (error || !data) throw new Error(error?.message ?? 'mhs_config is not seeded.')
  return data as MhsConfig
}

/**
 * Renormalizes weights over whichever component types actually have a scored
 * record yet, so a course with only a quiz live (Phase 1) correctly yields
 * Mastery = quiz score at 100% weight, rather than treating missing
 * components as zeros.
 */
export function computeWeightedAverage(
  scoresByType: Partial<Record<Exclude<MhsComponentType, 'capstone'>, number>>,
  config: MhsConfig
): number | null {
  const entries = Object.entries(scoresByType) as [Exclude<MhsComponentType, 'capstone'>, number][]
  if (entries.length === 0) return null
  const totalWeight = entries.reduce((sum, [type]) => sum + (config[COMPONENT_WEIGHT_KEY[type]] as number), 0)
  if (totalWeight === 0) return null
  const weightedSum = entries.reduce((sum, [type, score]) => sum + score * (config[COMPONENT_WEIGHT_KEY[type]] as number), 0)
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

export function percentToLetter(pct: number | null, cutoffs: Record<string, number>): string | null {
  if (pct === null) return null
  const ordered = Object.entries(cutoffs).sort((a, b) => b[1] - a[1])
  for (const [letter, min] of ordered) {
    if (pct >= min) return letter
  }
  return ordered.length ? ordered[ordered.length - 1][0] : null
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export async function computeMasteryGpa(mhsCourseId: string, studentId: string, config: MhsConfig) {
  const { data: lessons } = await supabase.from('mhs_lessons').select('id').eq('mhs_course_id', mhsCourseId)
  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id)
  if (lessonIds.length === 0) return { masteryPct: null, breakdown: {} as Record<string, number> }

  // Mastery reads raw_score_pct (content accuracy) — never score_pct, which is
  // late-penalty-adjusted and belongs to HOW only (spec section 6).
  const { data: components } = await supabase
    .from('mhs_lesson_components')
    .select('component_type,raw_score_pct,lesson_id')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
    .not('raw_score_pct', 'is', null)

  const scoresByType: Partial<Record<Exclude<MhsComponentType, 'capstone'>, number[]>> = {}
  for (const c of components ?? []) {
    if (c.component_type === 'capstone') continue
    const type = c.component_type as Exclude<MhsComponentType, 'capstone'>
    scoresByType[type] = scoresByType[type] ?? []
    scoresByType[type]!.push(c.raw_score_pct as number)
  }

  const averaged: Partial<Record<Exclude<MhsComponentType, 'capstone'>, number>> = {}
  const breakdown: Record<string, number> = {}
  for (const [type, scores] of Object.entries(scoresByType) as [Exclude<MhsComponentType, 'capstone'>, number[]][]) {
    const avg = average(scores)
    if (avg !== null) {
      averaged[type] = avg
      breakdown[type] = Math.round(avg * 100) / 100
    }
  }

  const masteryPct = computeWeightedAverage(averaged, config)
  return { masteryPct, breakdown }
}

/**
 * HOW GPA combines two kinds of signal, both expressed as 0-100:
 * - the standardized 1-4 rubric (Punctuality/Preparedness/Participation/Integrity),
 *   one row per lesson per student in mhs_how_scores;
 * - late_penalty_pct on Notes/Discussion/OMR components (Debate is exempt — spec
 *   section 6) — the percent of on-time credit retained, i.e. timeliness itself,
 *   NOT content accuracy (that's raw_score_pct, feeding Mastery only, above).
 * A component still awaiting teacher resolution (4+ days late) has a null
 * late_penalty_pct and is excluded rather than counted as zero (spec: "flagged
 * for teacher review — not auto-zero").
 */
export async function computeHowGpa(mhsCourseId: string, studentId: string): Promise<number | null> {
  const { data: lessons } = await supabase.from('mhs_lessons').select('id').eq('mhs_course_id', mhsCourseId)
  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id)
  if (lessonIds.length === 0) return null

  const signals: number[] = []

  const { data: rubricRows } = await supabase
    .from('mhs_how_scores')
    .select('punctuality,preparedness,participation,integrity')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
  for (const r of rubricRows ?? []) {
    signals.push(((r.punctuality + r.preparedness + r.participation + r.integrity) / 4 / 4) * 100)
  }

  const { data: lateComponents } = await supabase
    .from('mhs_lesson_components')
    .select('late_penalty_pct')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
    .in('component_type', ['notes', 'discussion', 'omr'])
    .not('late_penalty_pct', 'is', null)
  for (const c of lateComponents ?? []) {
    signals.push(c.late_penalty_pct as number)
  }

  const overallAvg = average(signals)
  return overallAvg === null ? null : Math.round(overallAvg * 100) / 100
}

/**
 * Orchestrates both strands for one (mhs) course + student, writes mhs_gpa_strands,
 * and — unless the teacher has set a manual override — writes the resulting letter
 * into the existing courses.grade_letter field plus the denormalized cache columns
 * GradesHSPage already reads.
 */
export async function computeStrandGpa(courseId: string, mhsCourseId: string, studentId: string) {
  const config = await getMhsConfig()
  const { masteryPct, breakdown } = await computeMasteryGpa(mhsCourseId, studentId, config)
  const howPct = await computeHowGpa(mhsCourseId, studentId)
  const masteryLetter = percentToLetter(masteryPct, config.percent_to_letter)

  const diplomaMasteryMet =
    config.mastery_diploma_threshold_pct !== null && masteryPct !== null
      ? masteryPct >= config.mastery_diploma_threshold_pct
      : null
  const diplomaHowMet =
    config.how_diploma_threshold_pct !== null && howPct !== null ? howPct >= config.how_diploma_threshold_pct : null

  await supabase.from('mhs_gpa_strands').upsert(
    {
      course_id: courseId,
      student_id: studentId,
      mastery_pct: masteryPct,
      mastery_letter: masteryLetter,
      how_pct: howPct,
      mastery_component_breakdown: breakdown,
      diploma_mastery_met: diplomaMasteryMet,
      diploma_how_met: diplomaHowMet,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'course_id' }
  )

  const { data: course } = await supabase.from('courses').select('mhs_grade_override').eq('id', courseId).single()

  const courseUpdate: Record<string, unknown> = {
    mhs_mastery_pct: masteryPct,
    mhs_how_pct: howPct,
  }
  if (!course?.mhs_grade_override && masteryLetter) {
    courseUpdate.grade_letter = masteryLetter
  }
  await supabase.from('courses').update(courseUpdate).eq('id', courseId)

  return { masteryPct, masteryLetter, howPct }
}

/** Convenience wrapper for callers that only know a lesson + student (e.g. the
 *  HOW scorer) — resolves the mhs_course_id and matching `courses` enrollment
 *  row, then delegates to computeStrandGpa. No-ops if the student has no
 *  courses row linked to this lesson's course shell yet. */
export async function recomputeGradeForLesson(lessonId: string, studentId: string) {
  const { data: lesson } = await supabase.from('mhs_lessons').select('mhs_course_id').eq('id', lessonId).single()
  if (!lesson) return null

  // A student can have more than one `courses` row linked to the same mhs_course_id
  // (duplicate/legacy enrollment records) — update every matching enrollment rather
  // than assuming uniqueness, so none of them are left showing a stale grade.
  const { data: courses } = await supabase
    .from('courses')
    .select('id')
    .eq('student_id', studentId)
    .eq('mhs_course_id', lesson.mhs_course_id)
  if (!courses || courses.length === 0) return null

  const results = await Promise.all(courses.map((c) => computeStrandGpa(c.id, lesson.mhs_course_id, studentId)))
  return results[0] ?? null
}

export interface LatePenaltyResult {
  retainedPct: number | null
  needsReview: boolean
}

/** Spec section 6: on time=100%, 1 day=90%, 2-3 days=75%, 4+ days=flagged for
 *  teacher review (never auto-zeroed). Excused or gate-delay-caused lateness
 *  is always fully waived — a gate delay must never itself cause a penalty. */
export function computeLatePenaltyPct(daysLate: number, excused: boolean, gateDelayCaused: boolean): LatePenaltyResult {
  if (excused || gateDelayCaused) return { retainedPct: 100, needsReview: false }
  if (daysLate <= 0) return { retainedPct: 100, needsReview: false }
  if (daysLate === 1) return { retainedPct: 90, needsReview: false }
  if (daysLate <= 3) return { retainedPct: 75, needsReview: false }
  return { retainedPct: null, needsReview: true }
}

export interface ComponentScoreInput {
  rawScorePct: number | null
  daysLate: number
  excused: boolean
  gateDelayCaused: boolean
  teacherVerified: boolean
  spotcheckFlag: boolean
}

/** Teacher-entered scoring shared by any late-penalty-eligible component
 *  (Notes, Discussion, OMR): content accuracy (raw_score_pct, feeds Mastery)
 *  and lateness (late_penalty_pct, feeds HOW) are recorded separately, then
 *  the course's strand GPAs are recomputed so the roster/transcript reflect
 *  it immediately. teacherVerified/spotcheckFlag are Notes-specific (spec
 *  section 7) and simply stay at their default for other component types. */
export async function applyComponentScore(lessonComponentId: string, studentId: string, input: ComponentScoreInput, actorId: string) {
  const { retainedPct } = computeLatePenaltyPct(input.daysLate, input.excused, input.gateDelayCaused)
  const scorePct =
    input.rawScorePct !== null && retainedPct !== null ? Math.round(input.rawScorePct * (retainedPct / 100) * 100) / 100 : null

  const { data: component } = await supabase
    .from('mhs_lesson_components')
    .update({
      raw_score_pct: input.rawScorePct,
      score_pct: scorePct,
      days_late: input.daysLate,
      excused: input.excused,
      late_penalty_pct: retainedPct,
      teacher_verified: input.teacherVerified,
      spotcheck_flag: input.spotcheckFlag,
      status: input.rawScorePct !== null ? 'scored' : 'submitted',
      scored_by: actorId,
      scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)
    .select('lesson_id')
    .single()

  if (component?.lesson_id) await recomputeGradeForLesson(component.lesson_id, studentId)
}

export interface DebateScoreInput {
  rawScorePct: number
  recordingUrl: string | null
  recordingType: 'audio' | 'video' | null
  accommodated: boolean
}

/** Debate is exempt from the late-penalty table (spec section 6) — score_pct
 *  always equals raw_score_pct, so it feeds Mastery only, never HOW. The DB
 *  trigger mhs_enforce_debate_recording is the real guard for "recording or
 *  accommodated required"; this just matches the same shape the UI expects. */
export async function applyDebateScore(lessonComponentId: string, studentId: string, input: DebateScoreInput, actorId: string) {
  const { data: component } = await supabase
    .from('mhs_lesson_components')
    .update({
      raw_score_pct: input.rawScorePct,
      score_pct: input.rawScorePct,
      recording_url: input.recordingUrl,
      recording_type: input.recordingType,
      accommodated: input.accommodated,
      status: 'scored',
      scored_by: actorId,
      scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)
    .select('lesson_id')
    .single()

  if (component?.lesson_id) await recomputeGradeForLesson(component.lesson_id, studentId)
}

/** Absence never zeroes or skips the debate — schedules a makeup instead
 *  (default: absence date + 5 school days, simplified here to calendar days). */
export async function scheduleMakeupDebate(
  lessonComponentId: string,
  studentId: string,
  absenceDate: string,
  actorId: string,
  actorRole: string
) {
  const deadline = new Date(absenceDate)
  deadline.setDate(deadline.getDate() + 5)
  const deadlineStr = deadline.toISOString().slice(0, 10)

  await supabase
    .from('mhs_lesson_components')
    .update({
      debate_absence_flag: true,
      makeup_scheduled_for: absenceDate,
      makeup_deadline: deadlineStr,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)

  await supabase.from('mhs_grade_change_log').insert({
    student_id: studentId,
    lesson_component_id: lessonComponentId,
    change_type: 'makeup_scheduled',
    reason: `Debate makeup scheduled for ${absenceDate} (deadline ${deadlineStr})`,
    old_value: null,
    new_value: { makeup_scheduled_for: absenceDate, makeup_deadline: deadlineStr },
    actor_id: actorId,
    actor_role: actorRole,
  })
}

/** Capstone is a module-level checkpoint, not one of the five weighted Mastery
 *  components (spec section 4's 15/15/30/25/15 table has no capstone row) —
 *  computeMasteryGpa already excludes component_type='capstone' from the
 *  weighted average, so scoring it doesn't change Mastery/HOW and needs no
 *  GPA recompute; it's tracked and displayed as its own checkpoint score. */
export async function applyCapstoneScore(lessonComponentId: string, rawScorePct: number, actorId: string) {
  await supabase
    .from('mhs_lesson_components')
    .update({
      raw_score_pct: rawScorePct,
      score_pct: rawScorePct,
      status: 'scored',
      scored_by: actorId,
      scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)
}

/**
 * Snapshots one student's HOW GPA for one grading period, across every mhs-
 * tracked course in the given academic year — a point-in-time close, matching
 * spec's "computed at the close of each grading period." The HOW threshold is
 * captured at compute time so a later policy change never rewrites history.
 */
export async function computeHonorRollStatus(studentId: string, academicYear: string, gradingPeriod: string) {
  const config = await getMhsConfig()

  const { data: enrollments } = await supabase
    .from('courses')
    .select('id,mhs_course_id')
    .eq('student_id', studentId)
    .not('mhs_course_id', 'is', null)
  const mhsCourseIds = [...new Set((enrollments ?? []).map((e) => e.mhs_course_id as string))]

  const { data: mhsCourses } = mhsCourseIds.length
    ? await supabase.from('mhs_courses').select('id,academic_year').in('id', mhsCourseIds)
    : { data: [] }
  const matchingMhsCourseIds = new Set((mhsCourses ?? []).filter((c) => c.academic_year === academicYear).map((c) => c.id))
  const relevantCourseIds = (enrollments ?? []).filter((e) => matchingMhsCourseIds.has(e.mhs_course_id)).map((e) => e.id)

  const { data: strands } = relevantCourseIds.length
    ? await supabase.from('mhs_gpa_strands').select('mastery_pct,how_pct').in('course_id', relevantCourseIds)
    : { data: [] }

  const howVals = (strands ?? []).map((s) => s.how_pct).filter((v): v is number => v !== null)
  const masteryVals = (strands ?? []).map((s) => s.mastery_pct).filter((v): v is number => v !== null)
  const periodHowPct = average(howVals)
  const periodMasteryPct = average(masteryVals)
  const honorRollMet = periodHowPct !== null && periodHowPct >= config.honor_roll_how_threshold_pct

  await supabase.from('mhs_period_snapshots').upsert(
    {
      student_id: studentId,
      academic_year: academicYear,
      grading_period: gradingPeriod,
      mastery_pct: periodMasteryPct,
      how_pct: periodHowPct,
      how_threshold_pct: config.honor_roll_how_threshold_pct,
      honor_roll_met: honorRollMet,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,academic_year,grading_period' }
  )

  return { periodHowPct, periodMasteryPct, honorRollMet }
}

/** Runs computeHonorRollStatus for every student enrolled in an mhs-tracked
 *  course during the given academic year — the "Close Grading Period" action. */
export async function closeGradingPeriodForAllStudents(academicYear: string, gradingPeriod: string) {
  const { data: mhsCourses } = await supabase.from('mhs_courses').select('id').eq('academic_year', academicYear)
  const mhsCourseIds = (mhsCourses ?? []).map((c) => c.id)
  if (mhsCourseIds.length === 0) return []

  const { data: enrollments } = await supabase.from('courses').select('student_id').in('mhs_course_id', mhsCourseIds)
  const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id as string))]

  const results = []
  for (const studentId of studentIds) {
    results.push({ studentId, ...(await computeHonorRollStatus(studentId, academicYear, gradingPeriod)) })
  }
  return results
}

/** Restores up to the reflection's requested points into late_penalty_pct
 *  (capped at 100), never automatically — only when a teacher approves. */
export async function approveReflection(reflectionId: string, pointsAwarded: number, actorId: string, actorRole: string) {
  const { data: reflection } = await supabase
    .from('mhs_reflections')
    .select('lesson_component_id,student_id,points_requested')
    .eq('id', reflectionId)
    .single()
  if (!reflection) return

  const { data: component } = await supabase
    .from('mhs_lesson_components')
    .select('lesson_id,late_penalty_pct,raw_score_pct')
    .eq('id', reflection.lesson_component_id)
    .single()
  if (!component) return

  const priorRetainedPct = component.late_penalty_pct ?? 0
  const newRetainedPct = Math.min(100, priorRetainedPct + pointsAwarded)
  const newScorePct = component.raw_score_pct !== null ? Math.round(component.raw_score_pct * (newRetainedPct / 100) * 100) / 100 : null

  await supabase
    .from('mhs_reflections')
    .update({ status: 'Approved', points_awarded: pointsAwarded, reviewed_by: actorId, reviewed_at: new Date().toISOString() })
    .eq('id', reflectionId)

  await supabase
    .from('mhs_lesson_components')
    .update({ late_penalty_pct: newRetainedPct, score_pct: newScorePct, updated_at: new Date().toISOString() })
    .eq('id', reflection.lesson_component_id)

  await supabase.from('mhs_grade_change_log').insert({
    student_id: reflection.student_id,
    lesson_component_id: reflection.lesson_component_id,
    change_type: 'reflection_approval',
    reason: `Reflection approved: +${pointsAwarded} HOW points restored`,
    old_value: { late_penalty_pct: priorRetainedPct },
    new_value: { late_penalty_pct: newRetainedPct },
    actor_id: actorId,
    actor_role: actorRole,
  })

  await recomputeGradeForLesson(component.lesson_id, reflection.student_id)
}

/** Denies a reflection without restoring any points — still leaves an audit trail. */
export async function denyReflection(reflectionId: string, actorId: string, reviewNote: string) {
  await supabase
    .from('mhs_reflections')
    .update({ status: 'Denied', reviewed_by: actorId, reviewed_at: new Date().toISOString(), review_note: reviewNote })
    .eq('id', reflectionId)
}

export interface ResolveDisputeInput {
  resolutionNotes: string
  scoreChanged: boolean
  newScore: number | null
}

/** Second-reviewer resolution for a filed dispute. Always logs an outcome to
 *  mhs_grade_change_log, even when the score doesn't change (spec section 9).
 *  For debate/discussion/capstone (a single raw_score_pct), a score change is
 *  applied directly. For 'how' disputes, the outcome is recorded here but the
 *  actual 4-axis rescoring happens through the normal HOW scoring UI — there's
 *  no single field to overwrite, and the reviewer's number alone can't say
 *  which of the four axes it corresponds to. */
export async function resolveDispute(disputeId: string, actorId: string, actorRole: string, input: ResolveDisputeInput) {
  const { data: dispute } = await supabase
    .from('mhs_grade_disputes')
    .select('id,student_id,subject_type,lesson_component_id,how_score_id')
    .eq('id', disputeId)
    .single()
  if (!dispute) return

  let oldScore: number | null = null

  if (dispute.subject_type !== 'how' && dispute.lesson_component_id) {
    const { data: component } = await supabase
      .from('mhs_lesson_components')
      .select('lesson_id,raw_score_pct,late_penalty_pct')
      .eq('id', dispute.lesson_component_id)
      .single()
    oldScore = component?.raw_score_pct ?? null

    if (input.scoreChanged && input.newScore !== null && component) {
      const retainedPct = component.late_penalty_pct ?? 100
      const scorePct = Math.round(input.newScore * (retainedPct / 100) * 100) / 100
      await supabase
        .from('mhs_lesson_components')
        .update({ raw_score_pct: input.newScore, score_pct: scorePct, updated_at: new Date().toISOString() })
        .eq('id', dispute.lesson_component_id)
      if (component.lesson_id) await recomputeGradeForLesson(component.lesson_id, dispute.student_id)
    }
  } else if (dispute.subject_type === 'how' && dispute.how_score_id) {
    const { data: howScore } = await supabase
      .from('mhs_how_scores')
      .select('punctuality,preparedness,participation,integrity')
      .eq('id', dispute.how_score_id)
      .single()
    if (howScore) {
      oldScore = Math.round(((howScore.punctuality + howScore.preparedness + howScore.participation + howScore.integrity) / 4 / 4) * 10000) / 100
    }
  }

  await supabase
    .from('mhs_grade_disputes')
    .update({
      status: 'Resolved',
      second_reviewer_id: actorId,
      resolution_notes: input.resolutionNotes,
      score_changed: input.scoreChanged,
      old_score: oldScore,
      new_score: input.scoreChanged ? input.newScore : oldScore,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId)

  await supabase.from('mhs_grade_change_log').insert({
    student_id: dispute.student_id,
    lesson_component_id: dispute.lesson_component_id,
    change_type: 'dispute_resolution',
    reason: input.resolutionNotes,
    old_value: { score: oldScore },
    new_value: { score: input.scoreChanged ? input.newScore : oldScore, scoreChanged: input.scoreChanged },
    actor_id: actorId,
    actor_role: actorRole,
  })
}

export async function applyGradeOverride(
  courseId: string,
  studentId: string,
  letter: string,
  reason: string,
  actorId: string,
  actorRole: string
) {
  const { data: prior } = await supabase.from('courses').select('grade_letter').eq('id', courseId).single()

  await supabase
    .from('courses')
    .update({
      grade_letter: letter,
      mhs_grade_override: true,
      mhs_grade_override_reason: reason,
      mhs_grade_override_by: actorId,
      mhs_grade_override_at: new Date().toISOString(),
    })
    .eq('id', courseId)

  await supabase.from('mhs_grade_change_log').insert({
    student_id: studentId,
    course_id: courseId,
    change_type: 'grade_override',
    reason,
    old_value: { grade_letter: prior?.grade_letter ?? null },
    new_value: { grade_letter: letter },
    actor_id: actorId,
    actor_role: actorRole,
  })
}

export async function applyGateOverride(
  lessonComponentId: string,
  studentId: string,
  reason: string,
  actorId: string,
  actorRole: string
) {
  const { data: prior } = await supabase
    .from('mhs_lesson_components')
    .select('status,gate_override')
    .eq('id', lessonComponentId)
    .single()

  await supabase
    .from('mhs_lesson_components')
    .update({
      status: 'gate_cleared',
      gate_override: true,
      gate_override_reason: reason,
      gate_override_by: actorId,
      gate_override_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)

  await supabase.from('mhs_grade_change_log').insert({
    student_id: studentId,
    lesson_component_id: lessonComponentId,
    change_type: 'gate_override',
    reason,
    old_value: { status: prior?.status ?? null, gate_override: prior?.gate_override ?? false },
    new_value: { status: 'gate_cleared', gate_override: true },
    actor_id: actorId,
    actor_role: actorRole,
  })
}
