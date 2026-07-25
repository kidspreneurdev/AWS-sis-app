import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

const CREATE_ALLOWED_ROLES = ['admin', 'staff', 'teacher', 'principal', 'partner', 'coach', 'viewer', 'parent']
const UPDATE_ALLOWED_ROLES = ['admin', 'staff', 'teacher', 'principal', 'partner', 'coach', 'viewer']

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

function getSchemaGuidance(error) {
  const message = error?.message || ''

  if (message.includes('column profiles.active does not exist')) {
    return 'The profiles table is missing the active column. Run the latest Supabase migration and retry.'
  }

  if (message.includes('invalid input value for enum user_role')) {
    return 'The profiles role enum is outdated. Run the latest Supabase migration so staff roles match the app.'
  }

  return null
}

/** Verifies the bearer token belongs to an active admin. Sends the response and
 *  returns null on failure; otherwise returns the authenticated user. */
async function requireAdmin(req, res, adminClient, authClient, forbiddenMessage) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    json(res, 401, { error: 'Missing authorization token.' })
    return null
  }

  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) {
    json(res, 401, { error: 'Invalid or expired session.' })
    return null
  }

  const { data: actorProfile, error: actorError } = await adminClient
    .from('profiles')
    .select('role,active')
    .eq('id', authData.user.id)
    .single()

  const actorSchemaGuidance = getSchemaGuidance(actorError)
  if (actorSchemaGuidance) {
    json(res, 500, { error: actorSchemaGuidance })
    return null
  }

  if (actorError || !actorProfile) {
    json(res, 403, { error: 'Unable to verify admin permissions. Make sure your signed-in account has a matching profiles row.' })
    return null
  }

  if (actorProfile.active === false || actorProfile.role !== 'admin') {
    json(res, 403, { error: forbiddenMessage })
    return null
  }

  return authData.user
}

async function createUser(req, res, adminClient, authClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const actor = await requireAdmin(req, res, adminClient, authClient, 'Only active admins can create staff users.')
  if (!actor) return

  const { email, password, fullName, role, campus, linkedStudentIds } = req.body || {}

  if (typeof email !== 'string' || !email.trim()) {
    return json(res, 400, { error: 'Email is required.' })
  }

  if (typeof password !== 'string' || password.length < 8) {
    return json(res, 400, { error: 'Password must be at least 8 characters.' })
  }

  if (typeof role !== 'undefined' && !CREATE_ALLOWED_ROLES.includes(role)) {
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

  if (safeRole === 'parent' && Array.isArray(linkedStudentIds) && linkedStudentIds.length > 0) {
    const { error: linkError } = await adminClient
      .from('parent_students')
      .insert(linkedStudentIds.map((studentId) => ({ parent_id: newUser.id, student_id: studentId })))
    if (linkError) {
      return json(res, 500, { error: `Account created, but linking students failed: ${linkError.message}` })
    }
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

async function updateUser(req, res, adminClient, authClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const actor = await requireAdmin(req, res, adminClient, authClient, 'Only active admins can update staff users.')
  if (!actor) return

  const { userId, fullName, role, campus, active } = req.body || {}

  if (typeof userId !== 'string' || !userId.trim()) {
    return json(res, 400, { error: 'User ID is required.' })
  }

  if (typeof role !== 'string' || !UPDATE_ALLOWED_ROLES.includes(role)) {
    return json(res, 400, { error: 'Invalid staff role.' })
  }

  const update = {
    full_name: typeof fullName === 'string' ? fullName.trim() : '',
    role,
    campus: typeof campus === 'string' && campus.trim() ? campus.trim() : null,
    active: active !== false,
  }

  const { error: updateError } = await adminClient
    .from('profiles')
    .update(update)
    .eq('id', userId)

  if (updateError) {
    return json(res, 500, { error: updateError.message || 'Failed to update user.' })
  }

  return json(res, 200, { success: true })
}

async function deleteUser(req, res, adminClient, authClient) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const actor = await requireAdmin(req, res, adminClient, authClient, 'Only active admins can remove staff users.')
  if (!actor) return

  const { userId } = req.body || {}

  if (typeof userId !== 'string' || !userId.trim()) {
    return json(res, 400, { error: 'User ID is required.' })
  }

  if (userId === actor.id) {
    return json(res, 400, { error: 'You cannot remove your own account.' })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

  if (deleteError) {
    return json(res, 500, { error: deleteError.message || 'Failed to remove account.' })
  }

  return json(res, 200, { success: true })
}

const ACTIONS = {
  'create-user': createUser,
  'update-user': updateUser,
  'delete-user': deleteUser,
}

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const action = ACTIONS[req.query?.action]
  if (!action) {
    return json(res, 404, { error: 'Unknown admin action.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return action(req, res, adminClient, authClient)
}
