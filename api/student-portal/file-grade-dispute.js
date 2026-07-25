import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const DISPUTABLE_TYPES = ['debate', 'discussion', 'how', 'capstone']

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/** Only subjective scores are disputable per spec section 9 — quiz/notes/OMR
 *  are objective (right/wrong or a directly-entered percentage) and aren't
 *  eligible here. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { subjectType, lessonComponentId, howScoreId, reason, filedBy } = req.body || {}

  if (!DISPUTABLE_TYPES.includes(subjectType)) {
    return json(res, 400, { error: 'This score type is not disputable.' })
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    return json(res, 400, { error: 'A reason is required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
  // submit-reflection.js's duplicate-filing guard. A prior dispute that was already
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
