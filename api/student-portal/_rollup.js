// Server-side (service-role) mirror of the Mastery/HOW rollup math in
// src/lib/grading/mhsRollup.ts. Needed here because this project's Vercel
// functions run as plain JS with no TS build step, so the browser-side
// TS module can't be imported directly. Keep the two in sync if the
// weighting/letter-mapping logic changes.

const COMPONENT_WEIGHT_KEY = {
  quiz: 'mastery_weight_quiz',
  discussion: 'mastery_weight_discussion',
  debate: 'mastery_weight_debate',
  omr: 'mastery_weight_omr',
  notes: 'mastery_weight_notes',
}

function average(nums) {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function computeWeightedAverage(scoresByType, config) {
  const entries = Object.entries(scoresByType)
  if (entries.length === 0) return null
  const totalWeight = entries.reduce((sum, [type]) => sum + Number(config[COMPONENT_WEIGHT_KEY[type]] || 0), 0)
  if (totalWeight === 0) return null
  const weightedSum = entries.reduce((sum, [type, score]) => sum + score * Number(config[COMPONENT_WEIGHT_KEY[type]] || 0), 0)
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

function percentToLetter(pct, cutoffs) {
  if (pct === null) return null
  const ordered = Object.entries(cutoffs).sort((a, b) => b[1] - a[1])
  for (const [letter, min] of ordered) {
    if (pct >= min) return letter
  }
  return ordered.length ? ordered[ordered.length - 1][0] : null
}

/** Recomputes Mastery/HOW GPA for one student's enrollment in the course that owns `lessonId`,
 *  and writes the result into mhs_gpa_strands + courses.grade_letter (unless overridden). */
export async function recomputeAndWriteGrade(adminClient, { lessonId, studentId }) {
  const { data: lesson } = await adminClient.from('mhs_lessons').select('mhs_course_id').eq('id', lessonId).single()
  if (!lesson) return

  // A student can have more than one `courses` row linked to the same mhs_course_id
  // (duplicate/legacy enrollment records) — recompute for every matching enrollment
  // rather than assuming uniqueness, so none of them are left showing a stale grade.
  const { data: courses } = await adminClient
    .from('courses')
    .select('id,mhs_grade_override')
    .eq('student_id', studentId)
    .eq('mhs_course_id', lesson.mhs_course_id)
  if (!courses || courses.length === 0) return // student has no matching course enrollment linked yet — nothing to write into

  const { data: config } = await adminClient.from('mhs_config').select('*').single()
  if (!config) return

  const { data: lessons } = await adminClient.from('mhs_lessons').select('id').eq('mhs_course_id', lesson.mhs_course_id)
  const lessonIds = (lessons ?? []).map((l) => l.id)

  // Mastery reads raw_score_pct (content accuracy) — never score_pct, which is
  // late-penalty-adjusted and belongs to HOW only (spec section 6).
  const { data: components } = await adminClient
    .from('mhs_lesson_components')
    .select('component_type,raw_score_pct')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
    .not('raw_score_pct', 'is', null)

  const scoresByType = {}
  for (const c of components ?? []) {
    if (c.component_type === 'capstone') continue
    scoresByType[c.component_type] = scoresByType[c.component_type] ?? []
    scoresByType[c.component_type].push(c.raw_score_pct)
  }
  const averaged = {}
  const breakdown = {}
  for (const [type, scores] of Object.entries(scoresByType)) {
    const avg = average(scores)
    if (avg !== null) {
      averaged[type] = avg
      breakdown[type] = Math.round(avg * 100) / 100
    }
  }
  const masteryPct = computeWeightedAverage(averaged, config)
  const masteryLetter = percentToLetter(masteryPct, config.percent_to_letter)

  // HOW combines the 1-4 rubric (Punctuality/Preparedness/Participation/Integrity)
  // with late_penalty_pct on Notes/Discussion/OMR (timeliness, not accuracy — Debate
  // is exempt). A null late_penalty_pct (4+ days late, unresolved) is excluded rather
  // than counted as zero, matching mhsRollup.ts's computeHowGpa.
  const howSignals = []
  const { data: howRows } = await adminClient
    .from('mhs_how_scores')
    .select('punctuality,preparedness,participation,integrity')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
  for (const r of howRows ?? []) {
    howSignals.push(((r.punctuality + r.preparedness + r.participation + r.integrity) / 4 / 4) * 100)
  }
  const { data: lateComponents } = await adminClient
    .from('mhs_lesson_components')
    .select('late_penalty_pct')
    .in('lesson_id', lessonIds)
    .eq('student_id', studentId)
    .in('component_type', ['notes', 'discussion', 'omr'])
    .not('late_penalty_pct', 'is', null)
  for (const c of lateComponents ?? []) {
    howSignals.push(c.late_penalty_pct)
  }
  const howAvg = average(howSignals)
  const howPct = howAvg === null ? null : Math.round(howAvg * 100) / 100

  const diplomaMasteryMet =
    config.mastery_diploma_threshold_pct !== null && masteryPct !== null
      ? masteryPct >= config.mastery_diploma_threshold_pct
      : null
  const diplomaHowMet =
    config.how_diploma_threshold_pct !== null && howPct !== null ? howPct >= config.how_diploma_threshold_pct : null

  for (const course of courses) {
    await adminClient.from('mhs_gpa_strands').upsert(
      {
        course_id: course.id,
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

    const courseUpdate = { mhs_mastery_pct: masteryPct, mhs_how_pct: howPct }
    if (!course.mhs_grade_override && masteryLetter) {
      courseUpdate.grade_letter = masteryLetter
    }
    await adminClient.from('courses').update(courseUpdate).eq('id', course.id)
  }
}
