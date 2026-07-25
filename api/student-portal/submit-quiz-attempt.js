import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'
import { recomputeAndWriteGrade } from './_rollup.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  // studentDbId comes from the verified token, never the request body — the whole
  // point of Phase 0.5 is that a client-supplied studentId can't be trusted here.
  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { lessonComponentId, answers } = req.body || {}
  if (typeof lessonComponentId !== 'string' || !lessonComponentId || !Array.isArray(answers)) {
    return json(res, 400, { error: 'lessonComponentId and answers are required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
