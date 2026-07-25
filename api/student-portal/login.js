import { createClient } from '@supabase/supabase-js'
import { issueStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!supabaseUrl || !supabaseServiceKey || !process.env.STUDENT_PORTAL_TOKEN_SECRET) {
    return json(res, 500, { error: 'Server-side student portal configuration is incomplete.' })
  }

  const { studentId, portalPassword } = req.body || {}

  if (typeof studentId !== 'string' || !studentId.trim() || typeof portalPassword !== 'string' || !portalPassword.trim()) {
    return json(res, 400, { error: 'Please enter both Student ID and password.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

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
