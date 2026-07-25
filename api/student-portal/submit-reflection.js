import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

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

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { lessonComponentId, reflectionText } = req.body || {}
  if (typeof lessonComponentId !== 'string' || !lessonComponentId || typeof reflectionText !== 'string' || !reflectionText.trim()) {
    return json(res, 400, { error: 'lessonComponentId and reflectionText are required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
