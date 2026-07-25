import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/**
 * Returns quiz content + this student's current gate status for a lesson.
 * Deliberately NOT exposed via RLS: mhs_lessons.quiz_questions carries the answer
 * key (correctIndex), so students must never read that table directly — only
 * this endpoint, which strips answers before responding.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const lessonId = req.query?.lessonId
  if (typeof lessonId !== 'string' || !lessonId) {
    return json(res, 400, { error: 'lessonId is required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
