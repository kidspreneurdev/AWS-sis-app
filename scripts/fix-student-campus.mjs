/**
 * AWSC SIS — Student Campus Data Fix
 * Normalizes legacy student campus values to the canonical "Chennai".
 *
 * Usage:
 *   node scripts/fix-student-campus.mjs <SERVICE_ROLE_KEY>
 *   VITE_SUPABASE_SERVICE_KEY=<key> node scripts/fix-student-campus.mjs
 *
 * Optional:
 *   VITE_SUPABASE_URL=<url> VITE_SUPABASE_SERVICE_KEY=<key> node scripts/fix-student-campus.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bhlcfydwjiegjozbedtb.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2] || process.env.VITE_SUPABASE_SERVICE_KEY
const LEGACY_CAMPUSES = ['main campus', 'Main Campus']
const TARGET_CAMPUS = 'Chennai'

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node scripts/fix-student-campus.mjs <SERVICE_ROLE_KEY>')
  console.error('   or: VITE_SUPABASE_SERVICE_KEY=<key> node scripts/fix-student-campus.mjs')
  console.error('Get your service_role key from Supabase → Project Settings → API')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function updateCampus(fromCampus) {
  const { data: rows, error: fetchError } = await supabase
    .from('students')
    .select('id,student_id,first_name,last_name,campus')
    .eq('campus', fromCampus)

  if (fetchError) {
    throw new Error(`Failed to read students for "${fromCampus}": ${fetchError.message}`)
  }

  if (!rows?.length) {
    console.log(`  • No students found with campus "${fromCampus}"`)
    return 0
  }

  const ids = rows.map(row => row.id)
  const label = rows
    .map(row => row.student_id || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.id)
    .join(', ')

  const { error: updateError } = await supabase
    .from('students')
    .update({ campus: TARGET_CAMPUS })
    .in('id', ids)

  if (updateError) {
    throw new Error(`Failed to update students for "${fromCampus}": ${updateError.message}`)
  }

  console.log(`  ✓ Updated ${rows.length} student(s) from "${fromCampus}" to "${TARGET_CAMPUS}"`)
  console.log(`    ${label}`)
  return rows.length
}

async function main() {
  console.log(`\n🏫 Normalizing student campus values in ${SUPABASE_URL}`)
  let total = 0

  for (const legacyCampus of LEGACY_CAMPUSES) {
    total += await updateCampus(legacyCampus)
  }

  console.log(`\nDone. ${total} student(s) now use campus "${TARGET_CAMPUS}".`)
}

main().catch(error => {
  console.error(`\n✗ ${error.message}`)
  process.exit(1)
})
