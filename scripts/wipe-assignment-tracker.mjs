/**
 * AWSC SIS — Wipe Assignment Tracker data for a fresh rollout.
 *
 * Deletes ALL rows from the at_* tracker tables, children first:
 *   at_submissions → at_corrections → at_notes → at_reports
 *   → at_assessments → at_exact_path → at_assignments
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from .env.local.
 *
 * Usage:
 *   node scripts/wipe-assignment-tracker.mjs            # dry run: just counts rows
 *   node scripts/wipe-assignment-tracker.mjs --delete   # actually delete
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env.local')
  process.exit(1)
}

const DO_DELETE = process.argv.includes('--delete')

// Order matters: children before parents.
const TABLES = [
  'at_submissions',
  'at_corrections',
  'at_notes',
  'at_reports',
  'at_assessments',
  'at_exact_path',
  'at_assignments',
]

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function count(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return `ERR: ${error.message}`
  return count
}

async function run() {
  console.log(`\n${DO_DELETE ? 'DELETING' : 'DRY RUN - counts only'}\n`)
  for (const table of TABLES) {
    const before = await count(table)
    if (!DO_DELETE) {
      console.log(`  ${table.padEnd(18)} ${before} rows`)
      continue
    }
    // supabase-js requires a filter on delete; this matches every row.
    const { error } = await supabase.from(table).delete().not('id', 'is', null)
    const after = await count(table)
    console.log(`  ${table.padEnd(18)} ${before} -> ${after}${error ? `  (error: ${error.message})` : ''}`)
  }
  console.log('')
}

run()
