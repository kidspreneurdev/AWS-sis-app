import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/** Lists this student's Habits-of-Work rubric scores, one per lesson, for
 *  filing a 'how' dispute (spec section 9 — HOW is one of the four disputable
 *  subjective score types, alongside Debate/Discussion/Capstone). */
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
