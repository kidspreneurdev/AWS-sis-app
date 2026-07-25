import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/** Lists quiz-gated lessons for courses this student is enrolled in (via courses.mhs_course_id). */
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
