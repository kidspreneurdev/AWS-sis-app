import { createClient } from '@supabase/supabase-js'
import { issueStudentToken, requireStudentToken } from './_token.js'
import { checkSimilarity } from './_similarity.js'
import { recomputeAndWriteGrade } from './_rollup.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const DISPUTABLE_COMPONENT_TYPES = ['debate', 'discussion', 'capstone']
const DISPUTABLE_SUBJECT_TYPES = ['debate', 'discussion', 'how', 'capstone']

// LMS Case Study Assignment (7-section revamp of the "+Lesson" assignment block) —
// a separate, unrelated feature from the MHS Grading module above. Fixed rubric lives
// in src/lib/lms/caseStudyRubric.ts; this list is duplicated here (small, stable) since
// this file can't import from src/.
const LMS_SCORE_COMPONENT_TYPES = ['notes', 'discussion', 'debate', 'omr', 'presentation']

// Student Records module — must match src/types/studentRecord.ts (api/ can't import from src/).
const STUDENT_RECORD_TYPES = [
  'course_confirmation', 'weekly_schedule', 'edmentum_credentials', 'assessment_instructions',
  'psychometric', 'stock_market_game',
  'math_diagnostic', 'reading_diagnostic', 'ela_diagnostic', 'diagnostic_summary_s1',
  'math_diagnostic_s2', 'reading_diagnostic_s2', 'ela_diagnostic_s2', 'diagnostic_summary_s2',
  'math_diagnostic_s3', 'reading_diagnostic_s3', 'ela_diagnostic_s3', 'diagnostic_summary_s3',
]
const STUDENT_RECORD_BUCKET = 'student-records'

// Onboarding module — must match src/types/onboarding.ts (api/ can't import from src/).
const ONBOARDING_STEP_KEYS = [
  'A1', 'A2', 'A3', 'A4', 'A18', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
  'A12', 'A13', 'A15',
  'B1', 'B2', 'B3', 'B4', 'B5',
]

// Policy Documents module — must match src/types/policyDocument.ts.
const POLICY_DOC_KEYS = [
  'academic_integrity', 'graduation_requirements', 'repeated_courses',
  'student_attendance', 'transcript_revision',
]

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

function formatStudentGrade(grade) {
  if (grade === null || grade === undefined || grade === '') return ''
  const n = Number(grade)
  if (Number.isNaN(n)) return String(grade)
  if (n === 0) return 'K'
  return String(n)
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

async function login(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!process.env.STUDENT_PORTAL_TOKEN_SECRET) {
    return json(res, 500, { error: 'Server-side student portal configuration is incomplete.' })
  }

  const { studentId, portalPassword } = req.body || {}

  if (typeof studentId !== 'string' || !studentId.trim() || typeof portalPassword !== 'string' || !portalPassword.trim()) {
    return json(res, 400, { error: 'Please enter both Student ID and password.' })
  }

  const normalizedStudentId = studentId.trim().toUpperCase()
  const { data, error: dbError } = await adminClient
    .from('students')
    .select('id,first_name,last_name,student_id,grade,cohort,campus,email,portal_password')
    .eq('student_id', normalizedStudentId)
    .single()

  if (dbError || !data) {
    return json(res, 401, { error: 'Incorrect student ID or password.' })
  }

  if (!data.portal_password || data.portal_password !== portalPassword) {
    return json(res, 401, { error: 'Incorrect student ID or password.' })
  }

  const token = issueStudentToken(data.id)

  return json(res, 200, {
    token,
    session: {
      studentId: data.student_id,
      fullName: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
      grade: formatStudentGrade(data.grade),
      campus: data.campus ?? '',
      cohort: data.cohort ?? '',
      dbId: data.id,
      email: data.email ?? '',
    },
  })
}

/** Lists every lesson component (any type) for this student, across all their
 *  mhs-linked courses, with enough status detail to show late-penalty state
 *  and whether a reflection has already been filed for it. */
async function listMyComponents(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { data: components, error } = await adminClient
    .from('mhs_lesson_components')
    .select('id,lesson_id,component_type,status,raw_score_pct,score_pct,late_penalty_pct,days_late,excused,teacher_verified,mhs_lessons(title,mhs_courses(title))')
    .eq('student_id', studentDbId)
    .order('updated_at', { ascending: false })

  if (error) return json(res, 500, { error: error.message })

  const componentIds = (components ?? []).map((c) => c.id)
  const { data: reflections } = componentIds.length
    ? await adminClient
        .from('mhs_reflections')
        .select('lesson_component_id,status,points_requested,points_awarded')
        .in('lesson_component_id', componentIds)
    : { data: [] }
  const { data: disputes } = componentIds.length
    ? await adminClient
        .from('mhs_grade_disputes')
        .select('lesson_component_id,status,resolution_notes')
        .in('lesson_component_id', componentIds)
    : { data: [] }

  const result = (components ?? []).map((c) => {
    const reflection = reflections?.find((r) => r.lesson_component_id === c.id) ?? null
    const dispute = disputes?.find((d) => d.lesson_component_id === c.id) ?? null
    const needsReview = ['notes', 'discussion', 'omr'].includes(c.component_type) && (c.days_late ?? 0) >= 4 && c.late_penalty_pct === null
    return {
      componentId: c.id,
      lessonId: c.lesson_id,
      componentType: c.component_type,
      lessonTitle: c.mhs_lessons?.title ?? '',
      courseTitle: c.mhs_lessons?.mhs_courses?.title ?? '',
      status: c.status,
      rawScorePct: c.raw_score_pct,
      scorePct: c.score_pct,
      latePenaltyPct: c.late_penalty_pct,
      daysLate: c.days_late,
      excused: c.excused,
      teacherVerified: c.teacher_verified,
      needsReview,
      canReflect: c.late_penalty_pct !== null && c.late_penalty_pct < 100 && !reflection,
      reflection: reflection ? { status: reflection.status, pointsRequested: reflection.points_requested, pointsAwarded: reflection.points_awarded } : null,
      canDispute: DISPUTABLE_COMPONENT_TYPES.includes(c.component_type) && c.status === 'scored' && !dispute,
      dispute: dispute ? { status: dispute.status, resolutionNotes: dispute.resolution_notes } : null,
    }
  })

  return json(res, 200, { components: result })
}

async function submitDiscussionPost(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { editPostId, lessonComponentId, body, parentPostId, referencesStudentId, pasteEventDetected } = req.body || {}

  if (typeof body !== 'string' || !body.trim()) {
    return json(res, 400, { error: 'Post body is required.' })
  }

  // ─── Edit an existing post ────────────────────────────────────────────────
  if (typeof editPostId === 'string' && editPostId) {
    const { data: existing, error: existingError } = await adminClient
      .from('mhs_discussion_posts')
      .select('id,body,edit_history,student_id')
      .eq('id', editPostId)
      .eq('student_id', studentDbId)
      .single()
    if (existingError || !existing) return json(res, 404, { error: 'Post not found for this student.' })

    const wordCount = countWords(body)
    const newHistory = [...(existing.edit_history ?? []), { body: existing.body, editedAt: new Date().toISOString() }]

    const { error: updateError } = await adminClient
      .from('mhs_discussion_posts')
      .update({ body: body.trim(), word_count: wordCount, edited_after_submission: true, edit_history: newHistory, updated_at: new Date().toISOString() })
      .eq('id', editPostId)
    if (updateError) return json(res, 500, { error: 'Failed to save edit.' })

    return json(res, 200, { postId: editPostId, wordCount, edited: true })
  }

  // ─── New post or reply ────────────────────────────────────────────────────
  if (typeof lessonComponentId !== 'string' || !lessonComponentId) {
    return json(res, 400, { error: 'lessonComponentId is required.' })
  }

  const { data: component, error: componentError } = await adminClient
    .from('mhs_lesson_components')
    .select('id,lesson_id,mhs_lessons(min_discussion_words)')
    .eq('id', lessonComponentId)
    .eq('student_id', studentDbId)
    .eq('component_type', 'discussion')
    .single()
  if (componentError || !component) return json(res, 404, { error: 'Discussion component not found for this student.' })

  const minWords = component.mhs_lessons?.min_discussion_words ?? 150
  const wordCount = countWords(body)
  if (wordCount < minWords) {
    return json(res, 400, { error: `This post needs at least ${minWords} words (currently ${wordCount}).` })
  }

  if (parentPostId && (typeof referencesStudentId !== 'string' || !referencesStudentId)) {
    return json(res, 400, { error: 'A reply must reference a specific classmate’s point.' })
  }

  const { data: config } = await adminClient.from('mhs_config').select('discussion_similarity_threshold_pct').single()
  const { similarityScore, similarityFlag } = await checkSimilarity(adminClient, {
    lessonId: component.lesson_id,
    studentId: studentDbId,
    body: body.trim(),
    thresholdPct: config?.discussion_similarity_threshold_pct ?? 60,
  })

  const { data: post, error: insertError } = await adminClient
    .from('mhs_discussion_posts')
    .insert({
      lesson_component_id: lessonComponentId,
      student_id: studentDbId,
      parent_post_id: parentPostId || null,
      body: body.trim(),
      word_count: wordCount,
      references_student_id: referencesStudentId || null,
      paste_event_detected: Boolean(pasteEventDetected),
      similarity_score: similarityScore,
      similarity_flag: similarityFlag,
    })
    .select('id')
    .single()
  if (insertError || !post) return json(res, 500, { error: 'Failed to submit post.' })

  await adminClient
    .from('mhs_lesson_components')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lessonComponentId)

  // Paste/similarity flags are never surfaced to the student — flag, not auto-fail,
  // and reviewed only by the teacher via the moderation panel.
  return json(res, 200, { postId: post.id, wordCount })
}

/** Lists this student's Habits-of-Work rubric scores, one per lesson, for
 *  filing a 'how' dispute (spec section 9 — HOW is one of the four disputable
 *  subjective score types, alongside Debate/Discussion/Capstone). */
async function listMyHowScores(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { data: rows, error } = await adminClient
    .from('mhs_how_scores')
    .select('id,punctuality,preparedness,participation,integrity,mhs_lessons(title)')
    .eq('student_id', studentDbId)
    .order('scored_at', { ascending: false })

  if (error) return json(res, 500, { error: error.message })

  const howScoreIds = (rows ?? []).map((r) => r.id)
  const { data: disputes } = howScoreIds.length
    ? await adminClient.from('mhs_grade_disputes').select('how_score_id,status').in('how_score_id', howScoreIds)
    : { data: [] }

  const result = (rows ?? []).map((r) => {
    const pct = Math.round(((r.punctuality + r.preparedness + r.participation + r.integrity) / 4 / 4) * 10000) / 100
    const dispute = disputes?.find((d) => d.how_score_id === r.id) ?? null
    return {
      howScoreId: r.id,
      lessonTitle: r.mhs_lessons?.title ?? '',
      pct,
      canDispute: !dispute,
      dispute: dispute ? { status: dispute.status } : null,
    }
  })

  return json(res, 200, { howScores: result })
}

/** Returns the full cross-student thread for a lesson's discussion board, plus
 *  this student's own component id (created on first visit, mirroring get-quiz).
 *  Moderation-only fields (paste flag, similarity, edit history) are never sent
 *  to students — only to teachers, via direct RLS reads. */
async function getDiscussionThread(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const lessonId = req.query?.lessonId
  if (typeof lessonId !== 'string' || !lessonId) {
    return json(res, 400, { error: 'lessonId is required.' })
  }

  const { data: lesson, error: lessonError } = await adminClient
    .from('mhs_lessons')
    .select('id,title,min_discussion_words,discussion_due_at')
    .eq('id', lessonId)
    .single()
  if (lessonError || !lesson) return json(res, 404, { error: 'Lesson not found.' })

  let { data: myComponent } = await adminClient
    .from('mhs_lesson_components')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('student_id', studentDbId)
    .eq('component_type', 'discussion')
    .maybeSingle()

  if (!myComponent) {
    const { data: created, error: createError } = await adminClient
      .from('mhs_lesson_components')
      .insert({ lesson_id: lessonId, student_id: studentDbId, component_type: 'discussion', status: 'not_started' })
      .select('id')
      .single()
    if (createError || !created) return json(res, 500, { error: 'Unable to initialize discussion component.' })
    myComponent = created
  }

  const { data: allComponents } = await adminClient
    .from('mhs_lesson_components')
    .select('id,student_id')
    .eq('lesson_id', lessonId)
    .eq('component_type', 'discussion')

  const componentIds = (allComponents ?? []).map((c) => c.id)

  const { data: posts } = await adminClient
    .from('mhs_discussion_posts')
    .select('id,lesson_component_id,student_id,parent_post_id,body,word_count,references_student_id,edited_after_submission,submitted_at')
    .in('lesson_component_id', componentIds.length ? componentIds : ['00000000-0000-0000-0000-000000000000'])
    .order('submitted_at', { ascending: true })

  const studentIds = [...new Set((posts ?? []).map((p) => p.student_id).concat((posts ?? []).map((p) => p.references_student_id).filter(Boolean)))]
  const { data: studentRows } = studentIds.length
    ? await adminClient.from('students').select('id,first_name,last_name').in('id', studentIds)
    : { data: [] }
  const nameOf = (id) => {
    const s = studentRows?.find((r) => r.id === id)
    return s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : 'Classmate'
  }

  const threadPosts = (posts ?? []).map((p) => ({
    id: p.id,
    studentId: p.student_id,
    authorName: p.student_id === studentDbId ? 'You' : nameOf(p.student_id),
    isMine: p.student_id === studentDbId,
    body: p.body,
    wordCount: p.word_count,
    parentPostId: p.parent_post_id,
    referencesStudentName: p.references_student_id ? nameOf(p.references_student_id) : null,
    editedAfterSubmission: p.edited_after_submission,
    submittedAt: p.submitted_at,
  }))

  return json(res, 200, {
    lesson: { id: lesson.id, title: lesson.title, minWords: lesson.min_discussion_words, dueAt: lesson.discussion_due_at },
    myComponentId: myComponent.id,
    classmates: (allComponents ?? [])
      .filter((c) => c.student_id !== studentDbId)
      .map((c) => ({ studentId: c.student_id, name: nameOf(c.student_id) })),
    posts: threadPosts,
  })
}

/** Lists quiz-gated lessons for courses this student is enrolled in (via courses.mhs_course_id). */
async function listQuizzes(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { data: enrollments } = await adminClient
    .from('courses')
    .select('mhs_course_id')
    .eq('student_id', studentDbId)
    .not('mhs_course_id', 'is', null)

  const mhsCourseIds = [...new Set((enrollments ?? []).map((e) => e.mhs_course_id))]
  if (mhsCourseIds.length === 0) return json(res, 200, { lessons: [] })

  const { data: lessons } = await adminClient
    .from('mhs_lessons')
    .select('id,title,mhs_course_id,mhs_courses(title)')
    .in('mhs_course_id', mhsCourseIds)
    .order('sequence')

  const { data: components } = await adminClient
    .from('mhs_lesson_components')
    .select('lesson_id,status,attempt_count,max_attempts')
    .eq('student_id', studentDbId)
    .eq('component_type', 'quiz')
    .in('lesson_id', (lessons ?? []).map((l) => l.id))

  const result = (lessons ?? []).map((l) => {
    const comp = components?.find((c) => c.lesson_id === l.id)
    return {
      lessonId: l.id,
      title: l.title,
      courseTitle: l.mhs_courses?.title ?? '',
      status: comp?.status ?? 'not_started',
      attemptCount: comp?.attempt_count ?? 0,
      maxAttempts: comp?.max_attempts ?? null,
    }
  })

  return json(res, 200, { lessons: result })
}

/** Only subjective scores are disputable per spec section 9 — quiz/notes/OMR
 *  are objective (right/wrong or a directly-entered percentage) and aren't
 *  eligible here. */
async function fileGradeDispute(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { subjectType, lessonComponentId, howScoreId, reason, filedBy } = req.body || {}

  if (!DISPUTABLE_SUBJECT_TYPES.includes(subjectType)) {
    return json(res, 400, { error: 'This score type is not disputable.' })
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return json(res, 400, { error: 'A reason is required.' })
  }

  if (subjectType === 'how') {
    if (typeof howScoreId !== 'string' || !howScoreId) return json(res, 400, { error: 'howScoreId is required.' })
    const { data: howScore, error: howError } = await adminClient
      .from('mhs_how_scores')
      .select('id')
      .eq('id', howScoreId)
      .eq('student_id', studentDbId)
      .single()
    if (howError || !howScore) return json(res, 404, { error: 'HOW score not found for this student.' })
  } else {
    if (typeof lessonComponentId !== 'string' || !lessonComponentId) return json(res, 400, { error: 'lessonComponentId is required.' })
    const { data: component, error: componentError } = await adminClient
      .from('mhs_lesson_components')
      .select('id,status')
      .eq('id', lessonComponentId)
      .eq('student_id', studentDbId)
      .eq('component_type', subjectType)
      .single()
    if (componentError || !component) return json(res, 404, { error: 'Component not found for this student.' })
    if (component.status !== 'scored') return json(res, 409, { error: 'This item has not been scored yet.' })
  }

  // Block a second dispute on the same subject while one is still active — mirrors
  // submit-reflection's duplicate-filing guard. A prior dispute that was already
  // Resolved can be re-filed (e.g. new evidence), but Open/Under Review cannot stack.
  // Uses limit(1) + array-length rather than .maybeSingle(), which errors out (and
  // must not be silently swallowed into "no match") if more than one row qualifies.
  let existingQuery = adminClient.from('mhs_grade_disputes').select('id').eq('student_id', studentDbId).in('status', ['Open', 'Under Review'])
  existingQuery = subjectType === 'how' ? existingQuery.eq('how_score_id', howScoreId) : existingQuery.eq('lesson_component_id', lessonComponentId)
  const { data: existingDisputes, error: existingError } = await existingQuery.limit(1)
  if (existingError) {
    return json(res, 500, { error: existingError.message })
  }
  if (existingDisputes && existingDisputes.length > 0) {
    return json(res, 409, { error: 'A dispute is already open for this item.' })
  }

  const { data: config } = await adminClient.from('mhs_config').select('dispute_window_school_days').single()
  const windowDays = config?.dispute_window_school_days ?? 10
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + windowDays)

  const { data: dispute, error: insertError } = await adminClient
    .from('mhs_grade_disputes')
    .insert({
      student_id: studentDbId,
      subject_type: subjectType,
      lesson_component_id: subjectType === 'how' ? null : lessonComponentId,
      how_score_id: subjectType === 'how' ? howScoreId : null,
      filed_by: typeof filedBy === 'string' && filedBy.trim() ? filedBy.trim() : 'student',
      reason: reason.trim(),
      window_deadline: deadline.toISOString().slice(0, 10),
      status: 'Open',
    })
    .select('id,status,window_deadline')
    .single()

  if (insertError || !dispute) return json(res, 500, { error: 'Failed to file dispute.' })

  return json(res, 200, { dispute })
}

/**
 * Returns quiz content + this student's current gate status for a lesson.
 * Deliberately NOT exposed via RLS: mhs_lessons.quiz_questions carries the answer
 * key (correctIndex), so students must never read that table directly — only
 * this endpoint, which strips answers before responding.
 */
async function getQuiz(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const lessonId = req.query?.lessonId
  if (typeof lessonId !== 'string' || !lessonId) {
    return json(res, 400, { error: 'lessonId is required.' })
  }

  const { data: lesson, error: lessonError } = await adminClient
    .from('mhs_lessons')
    .select('id,title,quiz_gate_threshold_pct,quiz_max_attempts,quiz_questions')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return json(res, 404, { error: 'Lesson not found.' })
  }

  const { data: config } = await adminClient
    .from('mhs_config')
    .select('quiz_gate_threshold_pct,quiz_max_attempts')
    .single()

  let { data: component } = await adminClient
    .from('mhs_lesson_components')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('student_id', studentDbId)
    .eq('component_type', 'quiz')
    .maybeSingle()

  if (!component) {
    const { data: created, error: createError } = await adminClient
      .from('mhs_lesson_components')
      .insert({
        lesson_id: lessonId,
        student_id: studentDbId,
        component_type: 'quiz',
        status: 'not_started',
        max_attempts: lesson.quiz_max_attempts ?? config?.quiz_max_attempts ?? 3,
        due_at: null,
      })
      .select('*')
      .single()
    if (createError || !created) {
      return json(res, 500, { error: 'Unable to initialize quiz component.' })
    }
    component = created
  }

  const sanitizedQuestions = (Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions : []).map((q) => ({
    question: q.question,
    choices: q.choices,
  }))

  return json(res, 200, {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      gateThresholdPct: lesson.quiz_gate_threshold_pct ?? config?.quiz_gate_threshold_pct ?? 60,
      maxAttempts: lesson.quiz_max_attempts ?? config?.quiz_max_attempts ?? 3,
    },
    questions: sanitizedQuestions,
    component: {
      id: component.id,
      status: component.status,
      attemptCount: component.attempt_count,
      maxAttempts: component.max_attempts,
      gatePassed: component.gate_passed,
      gateOverride: component.gate_override,
    },
  })
}

async function submitReflection(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { lessonComponentId, reflectionText } = req.body || {}
  if (typeof lessonComponentId !== 'string' || !lessonComponentId || typeof reflectionText !== 'string' || !reflectionText.trim()) {
    return json(res, 400, { error: 'lessonComponentId and reflectionText are required.' })
  }

  const { data: component, error: componentError } = await adminClient
    .from('mhs_lesson_components')
    .select('id,late_penalty_pct')
    .eq('id', lessonComponentId)
    .eq('student_id', studentDbId) // a student may only reflect on their own component
    .single()

  if (componentError || !component) {
    return json(res, 404, { error: 'Component not found for this student.' })
  }
  if (component.late_penalty_pct === null || component.late_penalty_pct >= 100) {
    return json(res, 409, { error: 'This item has no lost points to recover.' })
  }

  const { data: existing } = await adminClient
    .from('mhs_reflections')
    .select('id')
    .eq('lesson_component_id', lessonComponentId)
    .maybeSingle()
  if (existing) {
    return json(res, 409, { error: 'A reflection has already been filed for this item.' })
  }

  // Cap server-side at 50% of the lost HOW points — never trust a client-supplied amount.
  const lostPoints = 100 - component.late_penalty_pct
  const pointsRequested = Math.round(lostPoints * 0.5 * 100) / 100

  const { data: reflection, error: insertError } = await adminClient
    .from('mhs_reflections')
    .insert({
      lesson_component_id: lessonComponentId,
      student_id: studentDbId,
      reflection_text: reflectionText.trim(),
      points_requested: pointsRequested,
      status: 'Pending',
    })
    .select('id,points_requested,status')
    .single()

  if (insertError || !reflection) {
    return json(res, 500, { error: 'Failed to submit reflection.' })
  }

  return json(res, 200, { reflection })
}

async function submitQuizAttempt(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  // studentDbId comes from the verified token, never the request body — the whole
  // point of Phase 0.5 is that a client-supplied studentId can't be trusted here.
  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { lessonComponentId, answers } = req.body || {}
  if (typeof lessonComponentId !== 'string' || !lessonComponentId || !Array.isArray(answers)) {
    return json(res, 400, { error: 'lessonComponentId and answers are required.' })
  }

  const { data: component, error: componentError } = await adminClient
    .from('mhs_lesson_components')
    .select('*, mhs_lessons(quiz_questions, quiz_gate_threshold_pct, quiz_max_attempts)')
    .eq('id', lessonComponentId)
    .eq('student_id', studentDbId) // a student may only submit against their own component row
    .eq('component_type', 'quiz')
    .single()

  if (componentError || !component) {
    return json(res, 404, { error: 'Quiz component not found for this student.' })
  }

  if (component.status === 'gate_flagged' && !component.gate_override) {
    return json(res, 409, { error: 'This quiz is locked pending teacher review. Ask your teacher to clear the gate.' })
  }

  const nextAttemptNumber = component.attempt_count + 1
  const maxAttempts = component.max_attempts ?? component.mhs_lessons?.quiz_max_attempts ?? 3

  if (nextAttemptNumber > maxAttempts && !component.gate_override) {
    return json(res, 409, { error: 'Attempt cap reached. This is flagged for teacher review.' })
  }

  const { data: config } = await adminClient
    .from('mhs_config')
    .select('quiz_gate_threshold_pct')
    .single()

  const questions = Array.isArray(component.mhs_lessons?.quiz_questions) ? component.mhs_lessons.quiz_questions : []
  const gateThresholdPct = component.mhs_lessons?.quiz_gate_threshold_pct ?? config?.quiz_gate_threshold_pct ?? 60

  const total = questions.length || 1
  const correct = questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0)
  const scorePct = Math.round((correct / total) * 10000) / 100
  const passed = scorePct >= gateThresholdPct

  const { error: attemptError } = await adminClient.from('mhs_quiz_attempts').insert({
    lesson_component_id: lessonComponentId,
    attempt_number: nextAttemptNumber,
    score_pct: scorePct,
    passed,
    answers,
  })
  if (attemptError) {
    // The DB trigger (mhs_enforce_quiz_attempt_cap) rejects a forged 4th attempt —
    // surface that as a 409, not a generic 500.
    return json(res, 409, { error: attemptError.message })
  }

  const isFinalFailedAttempt = !passed && nextAttemptNumber >= maxAttempts
  const nextStatus = passed ? 'scored' : isFinalFailedAttempt ? 'gate_flagged' : 'in_progress'

  const { data: updated, error: updateError } = await adminClient
    .from('mhs_lesson_components')
    .update({
      attempt_count: nextAttemptNumber,
      raw_score_pct: scorePct,
      score_pct: scorePct,
      gate_passed: passed,
      status: nextStatus,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonComponentId)
    .select('status,attempt_count,gate_passed,raw_score_pct')
    .single()

  if (updateError || !updated) {
    return json(res, 500, { error: 'Attempt was recorded but the component could not be updated.' })
  }

  await recomputeAndWriteGrade(adminClient, { lessonId: component.lesson_id, studentId: studentDbId })

  return json(res, 200, {
    scorePct,
    passed,
    attemptNumber: nextAttemptNumber,
    maxAttempts,
    status: updated.status,
    flaggedForTeacher: nextStatus === 'gate_flagged',
  })
}

/** A lms_submissions row counts as this content's Presentation Upload unless its note
 *  is tagged JSON metadata for something else (e.g. a mastery-quiz snapshot). */
function isLmsPresentationRow(row) {
  if (typeof row.note !== 'string') return true
  const t = row.note.trim()
  if (!t.startsWith('{')) return true
  try {
    const parsed = JSON.parse(t)
    return !(parsed && typeof parsed === 'object' && 'kind' in parsed)
  } catch {
    return true
  }
}

/** Bundles everything the student's Case Study panel needs for one lesson: the case
 *  study document, this student's 5 category scores, the full discussion thread (all
 *  students), this student's Presentation Upload submission, and this student's appeals. */
async function lmsGetCaseStudy(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const contentId = req.query?.contentId
  if (typeof contentId !== 'string' || !contentId) {
    return json(res, 400, { error: 'contentId is required.' })
  }

  const { data: content, error: contentError } = await adminClient
    .from('lms_content')
    .select('id,title,extra')
    .eq('id', contentId)
    .single()
  if (contentError || !content) return json(res, 404, { error: 'Lesson not found.' })

  const extra = content.extra || {}

  const [scRes, dpRes, subRes, apRes] = await Promise.all([
    adminClient.from('lms_score_components').select('component_type,criteria_scores,subtotal,feedback,status').eq('content_id', contentId).eq('student_id', studentDbId),
    adminClient.from('lms_discussion_posts').select('id,student_id,parent_post_id,body,created_at').eq('content_id', contentId).order('created_at', { ascending: true }),
    adminClient.from('lms_submissions').select('note,link_url,submitted_at').eq('content_id', contentId).eq('student_id', studentDbId).order('submitted_at', { ascending: false }),
    adminClient.from('lms_grade_appeals').select('id,component_type,message,status,admin_reply').eq('content_id', contentId).eq('student_id', studentDbId),
  ])

  const posts = dpRes.data ?? []
  const posterIds = [...new Set(posts.map((p) => p.student_id))]
  const { data: posterRows } = posterIds.length
    ? await adminClient.from('students').select('id,first_name,last_name').in('id', posterIds)
    : { data: [] }
  const nameOf = (id) => {
    const s = posterRows?.find((r) => r.id === id)
    return s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : 'Classmate'
  }

  const presentationRow = (subRes.data ?? []).find(isLmsPresentationRow) ?? null

  return json(res, 200, {
    lesson: { id: content.id, title: content.title, caseStudyUrl: extra.caseStudyUrl ?? null },
    scores: scRes.data ?? [],
    discussion: {
      myStudentId: studentDbId,
      posts: posts.map((p) => ({
        id: p.id,
        studentId: p.student_id,
        authorName: p.student_id === studentDbId ? 'You' : nameOf(p.student_id),
        isMine: p.student_id === studentDbId,
        body: p.body,
        parentPostId: p.parent_post_id,
        createdAt: p.created_at,
      })),
    },
    presentation: presentationRow ? { note: presentationRow.note, linkUrl: presentationRow.link_url, submittedAt: presentationRow.submitted_at } : null,
    appeals: (apRes.data ?? []).map((a) => ({ id: a.id, componentType: a.component_type, message: a.message, status: a.status, adminReply: a.admin_reply })),
  })
}

async function lmsSubmitDiscussionPost(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { contentId, body, parentPostId } = req.body || {}
  if (typeof contentId !== 'string' || !contentId) return json(res, 400, { error: 'contentId is required.' })
  if (typeof body !== 'string' || !body.trim()) return json(res, 400, { error: 'Post body is required.' })

  const { data: content, error: contentError } = await adminClient.from('lms_content').select('id').eq('id', contentId).single()
  if (contentError || !content) return json(res, 404, { error: 'Lesson not found.' })

  if (parentPostId) {
    const { data: parent, error: parentError } = await adminClient.from('lms_discussion_posts').select('id').eq('id', parentPostId).eq('content_id', contentId).single()
    if (parentError || !parent) return json(res, 404, { error: 'Post being replied to was not found.' })
  }

  const { data: post, error: insertError } = await adminClient
    .from('lms_discussion_posts')
    .insert({ content_id: contentId, student_id: studentDbId, parent_post_id: parentPostId || null, body: body.trim() })
    .select('id,created_at')
    .single()
  if (insertError || !post) return json(res, 500, { error: 'Failed to submit post.' })

  return json(res, 200, { postId: post.id, createdAt: post.created_at })
}

async function lmsSubmitPresentation(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { contentId, fileUrl, note } = req.body || {}
  if (typeof contentId !== 'string' || !contentId) return json(res, 400, { error: 'contentId is required.' })
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) return json(res, 400, { error: 'fileUrl is required.' })

  const { data: content, error: contentError } = await adminClient.from('lms_content').select('id,course_id').eq('id', contentId).single()
  if (contentError || !content) return json(res, 404, { error: 'Lesson not found.' })

  const { data: submission, error: insertError } = await adminClient
    .from('lms_submissions')
    .insert({
      student_id: studentDbId,
      course_id: content.course_id,
      content_id: contentId,
      note: typeof note === 'string' && note.trim() ? note.trim() : null,
      link_url: fileUrl.trim(),
      submitted_at: new Date().toISOString(),
    })
    .select('id,submitted_at')
    .single()
  if (insertError || !submission) return json(res, 500, { error: 'Failed to submit presentation.' })

  return json(res, 200, { submissionId: submission.id, submittedAt: submission.submitted_at })
}

async function lmsFileAppeal(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { contentId, componentType, message } = req.body || {}
  if (typeof contentId !== 'string' || !contentId) return json(res, 400, { error: 'contentId is required.' })
  if (!LMS_SCORE_COMPONENT_TYPES.includes(componentType)) return json(res, 400, { error: 'Invalid component type.' })
  if (typeof message !== 'string' || !message.trim()) return json(res, 400, { error: 'A message is required.' })

  const { data: scoreComponent, error: scoreError } = await adminClient
    .from('lms_score_components')
    .select('id,status')
    .eq('content_id', contentId)
    .eq('student_id', studentDbId)
    .eq('component_type', componentType)
    .single()
  if (scoreError || !scoreComponent || scoreComponent.status !== 'scored') {
    return json(res, 409, { error: 'This item has not been scored yet.' })
  }

  // Block a second open appeal on the same item — mirrors fileGradeDispute's duplicate guard.
  const { data: existingAppeals, error: existingError } = await adminClient
    .from('lms_grade_appeals')
    .select('id')
    .eq('content_id', contentId)
    .eq('student_id', studentDbId)
    .eq('component_type', componentType)
    .eq('status', 'open')
    .limit(1)
  if (existingError) return json(res, 500, { error: existingError.message })
  if (existingAppeals && existingAppeals.length > 0) return json(res, 409, { error: 'An appeal is already open for this item.' })

  const { data: appeal, error: insertError } = await adminClient
    .from('lms_grade_appeals')
    .insert({
      content_id: contentId,
      student_id: studentDbId,
      component_type: componentType,
      score_component_id: scoreComponent.id,
      message: message.trim(),
      status: 'open',
    })
    .select('id,status')
    .single()
  if (insertError || !appeal) return json(res, 500, { error: 'Failed to file appeal.' })

  return json(res, 200, { appeal })
}

async function listMyRecords(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { data: rows, error } = await adminClient
    .from('student_records')
    .select('record_type,source,status,file_name,file_size,uploaded_at,generated_at,storage_path,data,signed_file_url,signed_file_name,signed_submitted_at,signed_status,signed_review_note')
    .eq('student_id', studentDbId)

  if (error) return json(res, 500, { error: error.message })

  const records = (rows ?? []).map((r) => ({
    recordType: r.record_type,
    source: r.source,
    status: r.status,
    fileName: r.file_name,
    fileSize: r.file_size,
    uploadedAt: r.uploaded_at,
    generatedAt: r.generated_at,
    hasFile: !!r.storage_path,
    // Generated documents (course confirmation / weekly schedule) render from this JSON.
    data: r.source === 'generated' ? r.data : undefined,
    // Signed-return flow (course_confirmation / weekly_schedule only).
    signedFileUrl: r.source === 'generated' ? (r.signed_file_url ?? null) : undefined,
    signedFileName: r.source === 'generated' ? (r.signed_file_name ?? null) : undefined,
    signedSubmittedAt: r.source === 'generated' ? (r.signed_submitted_at ?? null) : undefined,
    signedStatus: r.source === 'generated' ? (r.signed_status ?? null) : undefined,
    signedReviewNote: r.source === 'generated' ? (r.signed_review_note ?? null) : undefined,
  }))

  return json(res, 200, { records })
}

const SIGNED_RETURN_RECORD_TYPES = ['course_confirmation', 'weekly_schedule']

async function submitRecordSigned(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { recordType, fileUrl, fileName } = req.body || {}
  if (!SIGNED_RETURN_RECORD_TYPES.includes(recordType)) return json(res, 400, { error: 'This document does not support signed returns.' })
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) return json(res, 400, { error: 'fileUrl is required.' })

  const { data: row, error: rowError } = await adminClient
    .from('student_records')
    .select('id,data,signed_status')
    .eq('student_id', studentDbId)
    .eq('record_type', recordType)
    .maybeSingle()
  if (rowError) return json(res, 500, { error: rowError.message })
  if (!row || !row.data) return json(res, 404, { error: 'This document has not been generated yet.' })
  if (row.signed_status === 'approved') return json(res, 409, { error: 'Your signed copy has already been approved.' })

  const { error: updateError } = await adminClient
    .from('student_records')
    .update({
      signed_file_url: fileUrl.trim(),
      signed_file_name: typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'signed-document.pdf',
      signed_status: 'submitted',
      signed_submitted_at: new Date().toISOString(),
      signed_review_note: null,
      signed_reviewed_by: null,
      signed_reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (updateError) return json(res, 500, { error: updateError.message })

  return json(res, 200, { ok: true })
}

async function recordSignedUrl(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const recordType = req.query?.recordType
  if (!STUDENT_RECORD_TYPES.includes(recordType)) {
    return json(res, 400, { error: 'Unknown record type.' })
  }

  const { data: row, error } = await adminClient
    .from('student_records')
    .select('storage_path,file_name')
    .eq('student_id', studentDbId)
    .eq('record_type', recordType)
    .maybeSingle()

  if (error) return json(res, 500, { error: error.message })
  if (!row || !row.storage_path) {
    return json(res, 404, { error: 'This document is not available yet.' })
  }

  const { data: signed, error: signErr } = await adminClient
    .storage
    .from(STUDENT_RECORD_BUCKET)
    .createSignedUrl(row.storage_path, 3600)

  if (signErr || !signed?.signedUrl) {
    return json(res, 500, { error: signErr?.message || 'Could not generate a link for this document.' })
  }

  return json(res, 200, { url: signed.signedUrl, fileName: row.file_name })
}

async function listMyOnboarding(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const [{ data: stepRows, error: stepError }, { data: metaRow, error: metaError }] = await Promise.all([
    adminClient
      .from('student_onboarding')
      .select('step_key,completed,note,completed_at')
      .eq('student_id', studentDbId),
    adminClient
      .from('student_onboarding_meta')
      .select('transferring_credits')
      .eq('student_id', studentDbId)
      .maybeSingle(),
  ])

  if (stepError) return json(res, 500, { error: stepError.message })
  if (metaError) return json(res, 500, { error: metaError.message })

  const steps = (stepRows ?? [])
    .filter((r) => ONBOARDING_STEP_KEYS.includes(r.step_key))
    .map((r) => ({
      stepKey: r.step_key,
      completed: !!r.completed,
      note: r.note ?? null,
      completedAt: r.completed_at ?? null,
    }))

  return json(res, 200, { steps, transferringCredits: !!metaRow?.transferring_credits })
}

async function listMyPolicyDocuments(req, res, adminClient) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { data: rows, error } = await adminClient
    .from('student_policy_documents')
    .select('policy_key,status,signed_file_url,signed_file_name,submitted_at,review_note,requested_at')
    .eq('student_id', studentDbId)

  if (error) return json(res, 500, { error: error.message })

  const policies = (rows ?? [])
    .filter((r) => POLICY_DOC_KEYS.includes(r.policy_key))
    .map((r) => ({
      policyKey: r.policy_key,
      status: r.status,
      signedFileUrl: r.signed_file_url ?? null,
      signedFileName: r.signed_file_name ?? null,
      submittedAt: r.submitted_at ?? null,
      reviewNote: r.review_note ?? null,
      requestedAt: r.requested_at ?? null,
    }))

  return json(res, 200, { policies })
}

async function submitPolicyDocument(req, res, adminClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { policyKey, fileUrl, fileName } = req.body || {}
  if (!POLICY_DOC_KEYS.includes(policyKey)) return json(res, 400, { error: 'Unknown policy.' })
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) return json(res, 400, { error: 'fileUrl is required.' })

  const { data: row, error: rowError } = await adminClient
    .from('student_policy_documents')
    .select('id,status')
    .eq('student_id', studentDbId)
    .eq('policy_key', policyKey)
    .maybeSingle()
  if (rowError) return json(res, 500, { error: rowError.message })
  if (!row) return json(res, 404, { error: 'This policy has not been requested.' })
  if (row.status === 'approved') return json(res, 409, { error: 'This policy has already been approved.' })

  const { error: updateError } = await adminClient
    .from('student_policy_documents')
    .update({
      signed_file_url: fileUrl.trim(),
      signed_file_name: typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'signed-policy.pdf',
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (updateError) return json(res, 500, { error: updateError.message })

  return json(res, 200, { ok: true })
}

const ACTIONS = {
  login,
  'list-my-records': listMyRecords,
  'record-signed-url': recordSignedUrl,
  'submit-record-signed': submitRecordSigned,
  'list-my-onboarding': listMyOnboarding,
  'list-my-policy-documents': listMyPolicyDocuments,
  'submit-policy-document': submitPolicyDocument,
  'list-my-components': listMyComponents,
  'submit-discussion-post': submitDiscussionPost,
  'list-my-how-scores': listMyHowScores,
  'get-discussion-thread': getDiscussionThread,
  'list-quizzes': listQuizzes,
  'file-grade-dispute': fileGradeDispute,
  'get-quiz': getQuiz,
  'submit-reflection': submitReflection,
  'submit-quiz-attempt': submitQuizAttempt,
  'lms-get-case-study': lmsGetCaseStudy,
  'lms-submit-discussion-post': lmsSubmitDiscussionPost,
  'lms-submit-presentation': lmsSubmitPresentation,
  'lms-file-appeal': lmsFileAppeal,
}

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const action = ACTIONS[req.query?.action]
  if (!action) {
    return json(res, 404, { error: 'Unknown student portal action.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return action(req, res, adminClient)
}
