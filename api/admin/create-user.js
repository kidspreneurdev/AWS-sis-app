import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const ALLOWED_ROLES = ['admin', 'staff', 'teacher', 'principal', 'partner', 'coach', 'viewer']

function getSchemaGuidance(error) {
  const message = error?.message || ''

  if (message.includes("column profiles.active does not exist")) {
    return 'The profiles table is missing the active column. Run the latest Supabase migration and retry.'
  }

  if (message.includes('invalid input value for enum user_role')) {
    return 'The profiles role enum is outdated. Run the latest Supabase migration so staff roles match the app.'
  }

  return null
}

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

  const actorSchemaGuidance = getSchemaGuidance(actorError)
  if (actorSchemaGuidance) {
    return json(res, 500, { error: actorSchemaGuidance })
  }

  if (actorError || !actorProfile) {
    return json(res, 403, { error: 'Unable to verify admin permissions. Make sure your signed-in account has a matching profiles row.' })
  }

  if (actorProfile.active === false || actorProfile.role !== 'admin') {
    return json(res, 403, { error: 'Only active admins can create staff users.' })
  }

  const {
    email,
    password,
    fullName,
    role,
    campus,
  } = req.body || {}

  if (typeof email !== 'string' || !email.trim()) {
    return json(res, 400, { error: 'Email is required.' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return json(res, 400, { error: 'Password must be at least 8 characters.' })
  }

  if (typeof role !== 'undefined' && !ALLOWED_ROLES.includes(role)) {
    return json(res, 400, { error: 'Invalid staff role.' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const safeFullName = typeof fullName === 'string' ? fullName.trim() : ''
  const safeRole = typeof role === 'string' && role.trim() ? role.trim() : 'staff'
  const safeCampus = typeof campus === 'string' && campus.trim() ? campus.trim() : null

  const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
  })

  const newUser = newUserData?.user
  if (createError || !newUser) {
    return json(res, 400, { error: createError?.message || 'Failed to create account.' })
  }

  const profilePayload = {
    id: newUser.id,
    email: normalizedEmail,
    full_name: safeFullName,
    role: safeRole,
    campus: safeCampus,
    active: true,
  }

  // Supabase may already create the profile row via an auth trigger.
  // Use upsert so this endpoint works with either bootstrap path.
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUser.id)
    return json(res, 500, { error: getSchemaGuidance(profileError) || profileError.message || 'Failed to create profile.' })
  }

  return json(res, 200, {
    user: {
      id: newUser.id,
      email: normalizedEmail,
      fullName: safeFullName,
      role: safeRole,
      campus: safeCampus,
      active: true,
    },
  })
}
