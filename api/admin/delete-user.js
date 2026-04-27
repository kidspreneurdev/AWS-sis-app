import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return json(res, 401, { error: 'Missing authorization token.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) {
    return json(res, 401, { error: 'Invalid or expired session.' })
  }

  const { data: actorProfile, error: actorError } = await adminClient
    .from('profiles')
    .select('role,active')
    .eq('id', authData.user.id)
    .single()

  if (actorError || !actorProfile) {
    return json(res, 403, { error: 'Unable to verify admin permissions. Make sure your signed-in account has a matching profiles row.' })
  }

  if (actorProfile.active === false || actorProfile.role !== 'admin') {
    return json(res, 403, { error: 'Only active admins can remove staff users.' })
  }

  const { userId } = req.body || {}

  if (typeof userId !== 'string' || !userId.trim()) {
    return json(res, 400, { error: 'User ID is required.' })
  }

  if (userId === authData.user.id) {
    return json(res, 400, { error: 'You cannot remove your own account.' })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

  if (deleteError) {
    return json(res, 500, { error: deleteError.message || 'Failed to remove account.' })
  }

  return json(res, 200, { success: true })
}
