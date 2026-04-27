import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const hasSupabaseServiceEnv = Boolean(supabaseUrl && supabaseServiceKey)

// Service-role clients should not run in the browser. Guard this so missing env
// does not crash the entire app at startup.
export const supabaseAdmin = hasSupabaseServiceEnv
  ? createClient(
      supabaseUrl as string,
      supabaseServiceKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  : null
