import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/** Lists every lesson component (any type) for this student, across all their
 *  mhs-linked courses, with enough status detail to show late-penalty state
 *  and whether a reflection has already been filed for it. */
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

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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

  const DISPUTABLE_TYPES = ['debate', 'discussion', 'capstone']

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
      canDispute: DISPUTABLE_TYPES.includes(c.component_type) && c.status === 'scored' && !dispute,
      dispute: dispute ? { status: dispute.status, resolutionNotes: dispute.resolution_notes } : null,
    }
  })

  return json(res, 200, { components: result })
}
