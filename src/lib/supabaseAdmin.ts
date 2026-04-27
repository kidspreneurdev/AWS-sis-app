import { createClient } from '@supabase/supabase-js'

// Admin client using service role key — server-side operations only (user creation)
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
