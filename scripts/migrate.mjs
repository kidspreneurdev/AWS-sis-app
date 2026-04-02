/**
 * AWSC SIS — Data Migration Script
 * Reads AWSC.SIS.data.xlsx and pushes data into Supabase.
 *
 * Usage:
 *   node scripts/migrate.mjs <SERVICE_ROLE_KEY>
 *
 * Get your service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 * The service role key bypasses RLS so inserts work without auth.
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://bhlcfydwjiegjozbedtb.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node scripts/migrate.mjs <SERVICE_ROLE_KEY>')
  console.error('Get your service_role key from Supabase → Project Settings → API')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const XLSX_PATH = path.join(__dirname, '../public/AWSC.SIS.data.xlsx')

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readSheet(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws) { console.warn(`  ⚠ Sheet "${name}" not found — skipping`); return [] }
  return XLSX.utils.sheet_to_json(ws, { defval: null })
}

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  const s = String(val).trim()
  if (!s || s === 'null') return null
  // Handle Excel serial numbers
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(parseInt(s))
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch { /**/ }
  return null
}

function parseGrade(val) {
  if (!val) return null
  const s = String(val).replace(/grade\s*/i, '').trim()
  const n = parseInt(s)
  return isNaN(n) ? null : n
}

function str(val) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s === '' || s === 'null' || s === 'undefined' ? null : s
}

function bool(val) {
  if (!val) return false
  return val === true || val === 1 || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes'
}

const ATTEND_MAP = { P: 'Present', A: 'Absent', T: 'Late', E: 'Excused', R: 'Excused', Present: 'Present', Absent: 'Absent', Late: 'Late', Excused: 'Excused' }

async function insert(table, rows, { onConflict } = {}) {
  if (!rows.length) { console.log(`  (no rows)`); return }
  const CHUNK = 200
  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const q = onConflict
      ? supabase.from(table).upsert(chunk, { onConflict })
      : supabase.from(table).insert(chunk)
    const { error } = await q
    if (error) { console.error(`  ✗ ${table} chunk ${i}: ${error.message}`); }
    else { total += chunk.length }
  }
  console.log(`  ✓ ${total} rows → ${table}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📂 Reading Excel file…')
  const wb = XLSX.readFile(XLSX_PATH)
  console.log(`   Sheets found: ${wb.SheetNames.length}`)

  // ── 1. Settings ────────────────────────────────────────────────────────────
  console.log('\n⚙️  Settings…')
  const settingsRows = readSheet(wb, 'Settings')
  const settingsMap = Object.fromEntries(settingsRows.map(r => [r.key, r.value]))
  const academicYear = settingsMap.academicYear ?? '2025-2026'
  const campuses = settingsMap.campuses ? (typeof settingsMap.campuses === 'string' ? settingsMap.campuses.split(',').map(s => s.trim()).filter(Boolean) : []) : []
  const cohorts = settingsMap.cohorts ? (typeof settingsMap.cohorts === 'string' ? settingsMap.cohorts.split(',').map(s => s.trim()).filter(Boolean) : []) : []
  const { data: existingSettings } = await supabase.from('settings').select('id').single()
  if (existingSettings) {
    await supabase.from('settings').update({ academic_year: academicYear, campuses, cohorts }).eq('id', existingSettings.id)
    console.log('  ✓ settings updated')
  }

  // ── 2. Students ────────────────────────────────────────────────────────────
  console.log('\n👥 Students…')
  const studentRows = readSheet(wb, 'Students')

  // Build rows for Supabase — deduplicate by studentId (keep last occurrence)
  const studentDeduped = [...new Map(
    studentRows.filter(r => r.studentId && r.firstName && r.lastName)
      .map(r => [str(r.studentId), r])
  ).values()]

  const studentPayloads = studentDeduped
    .map(r => ({
      student_id:        str(r.studentId),
      first_name:        str(r.firstName),
      last_name:         str(r.lastName),
      email:             str(r.email),
      phone:             str(r.phone),
      date_of_birth:     parseDate(r.dob),
      nationality:       str(r.nationality),
      grade:             parseGrade(r.grade),
      cohort:            str(r.cohort),
      campus:            str(r.campus),
      status:            str(r.status) ?? 'Inquiry',
      enroll_date:       parseDate(r.enrollDate),
      application_date:  parseDate(r.appDate),
      year_joined:       str(r.yearJoined),
      year_graduated:    str(r.yearGraduated),
      grade_when_joined: parseGrade(r.gradeJoined),
      parent:            str(r.parent),
      iep:               bool(r.iep),
      priority:          str(r.priority),
    }))

  await insert('students', studentPayloads, { onConflict: 'student_id' })

  // Build old-numeric-id → UUID map
  console.log('  Building ID map…')
  const { data: insertedStudents } = await supabase.from('students').select('id, student_id')

  // Excel rows have both numeric `id` (100, 101…) and text `studentId` ('AWS-2026-003')
  // We need both mappings
  const studentsByStudentId = new Map(insertedStudents?.map(s => [s.student_id, s.id]) ?? [])

  // Map numeric id → UUID (for tables that reference students by numeric id)
  const numericToUUID = new Map()
  studentRows.forEach(r => {
    const numId = r.id ? Math.round(Number(r.id)) : null
    const uuid = studentsByStudentId.get(str(r.studentId))
    if (numId && uuid) numericToUUID.set(numId, uuid)
    // Also map by studentId text for tables that use it
    if (str(r.studentId) && uuid) numericToUUID.set(str(r.studentId), uuid)
  })
  console.log(`  ID map: ${numericToUUID.size} entries`)

  function resolveStudentUUID(val) {
    if (!val) return null
    const numId = Math.round(Number(val))
    return numericToUUID.get(numId) ?? numericToUUID.get(str(val)) ?? null
  }

  // ── 3. Attendance ──────────────────────────────────────────────────────────
  console.log('\n📋 Attendance…')
  const attendRows = readSheet(wb, 'Attendance')
  const attendRaw = attendRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      const date = parseDate(r.date)
      const status = ATTEND_MAP[str(r.status)] ?? 'Present'
      if (!studentUUID || !date) return null
      return { student_id: studentUUID, date, status, note: str(r.note) }
    })
    .filter(Boolean)
  // Deduplicate by (student_id, date) — keep last
  const attendPayloads = [...new Map(attendRaw.map(r => [`${r.student_id}_${r.date}`, r])).values()]
  await insert('attendance', attendPayloads, { onConflict: 'student_id,date' })

  // ── 4. Interviews ──────────────────────────────────────────────────────────
  console.log('\n🎤 Interviews…')
  const interviewRows = readSheet(wb, 'Interviews')
  const interviewPayloads = interviewRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      const date = parseDate(r.date)
      if (!studentUUID || !date) return null
      return {
        student_id:  studentUUID,
        date,
        interviewer: str(r.interviewer),
        notes:       str(r.notes),
        outcome:     str(r.recommendation) ?? str(r.outcome),
      }
    })
    .filter(Boolean)
  await insert('interviews', interviewPayloads)

  // ── 5. Fees ────────────────────────────────────────────────────────────────
  console.log('\n💰 Fees…')
  const feeRows = readSheet(wb, 'Fees')
  const feePayloads = feeRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      if (!studentUUID) return null
      const amount = Number(r.amount) || 0
      const currency = str(r.currency) ?? 'USD'
      const type = str(r.type) ?? 'Fee'
      const paid = str(r.status) === 'Paid' || bool(r.paid)
      return {
        student_id: studentUUID,
        type,
        amount,
        currency,
        paid,
        paid_date:  parseDate(r.paidDate),
        note:       str(r.notes),
      }
    })
    .filter(Boolean)
  await insert('fees', feePayloads)

  // ── 6. Communications ──────────────────────────────────────────────────────
  console.log('\n💬 Communications…')
  const commsRows = readSheet(wb, 'Communications')
  const commsPayloads = commsRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      const date = parseDate(r.date)
      if (!studentUUID || !date) return null
      return {
        student_id:   studentUUID,
        date,
        type:         str(r.channel) ?? str(r.direction) ?? 'Other',
        outcome:      str(r.outcome),
        notes:        str(r.body) ?? str(r.subject),
        staff_member: str(r.sentBy),
      }
    })
    .filter(Boolean)
  await insert('communications', commsPayloads)

  // ── 7. Health Records ──────────────────────────────────────────────────────
  console.log('\n🏥 Health Records…')
  const healthRows = readSheet(wb, 'HealthRecords')
  const healthPayloads = healthRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      if (!studentUUID) return null
      return {
        student_id:    studentUUID,
        allergies:     str(r.allergy),
        medications:   str(r.meds),
        conditions:    str(r.conditions),
        immunizations: str(r.vaccines),
        notes:         [str(r.blood) ? `Blood: ${r.blood}` : null, str(r.diet) ? `Diet: ${r.diet}` : null, str(r.notes)].filter(Boolean).join(' | ') || null,
      }
    })
    .filter(Boolean)
  await insert('health_records', healthPayloads, { onConflict: 'student_id' })

  // ── 8. Behaviour Log ───────────────────────────────────────────────────────
  console.log('\n⚠️  Behaviour Log…')
  const behavRows = readSheet(wb, 'BehaviourLog')
  const behavPayloads = behavRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      const date = parseDate(r.date)
      if (!studentUUID || !date) return null
      return {
        student_id:   studentUUID,
        date,
        type:         str(r.type) ?? 'Other',
        description:  str(r.description),
        action_taken: str(r.action),
        staff_member: str(r.recordedBy),
      }
    })
    .filter(Boolean)
  await insert('behaviour_log', behavPayloads)

  // ── 9. Timetable Blocks ────────────────────────────────────────────────────
  console.log('\n🗓  Timetable Blocks…')
  const blockRows = readSheet(wb, 'Blocks')
  const CURRENT_YEAR = new Date().getFullYear().toString()
  // Derive a period number from startTime (e.g. 08:00→1, 09:00→2…) or use sequence
  const blockPayloads = blockRows
    .filter(r => str(r.day) && str(r.subject))
    .map((r, i) => {
      let period = i + 1
      if (r.startTime) {
        const t = String(r.startTime).trim()
        const hour = parseInt(t.split(':')[0])
        if (!isNaN(hour)) period = Math.max(1, hour - 7)
      }
      return {
        day:         str(r.day),
        period,
        subject:     str(r.subject),
        teacher:     str(r.teacher),
        cohort:      str(r.cohort),
        room:        str(r.room),
        school_year: CURRENT_YEAR,
      }
    })
  await insert('timetable_blocks', blockPayloads)

  // ── 10. Staff ──────────────────────────────────────────────────────────────
  console.log('\n👔 Staff…')
  const staffRows = readSheet(wb, 'Staff')
  const staffPayloads = staffRows
    .filter(r => r.firstName || r.lastName)
    .map(r => ({
      full_name:  [str(r.firstName), str(r.lastName)].filter(Boolean).join(' '),
      email:      str(r.email) ?? `staff-${Date.now()}-${Math.random().toString(36).slice(2)}@placeholder.local`,
      role:       str(r.role) ?? 'Teacher',
      department: str(r.department),
      campus:     str(r.campus),
      phone:      str(r.phone),
      notes:      str(r.notes),
    }))
  await insert('staff', staffPayloads)

  // ── 11. Calendar ───────────────────────────────────────────────────────────
  console.log('\n📅 Calendar…')
  const calRows = readSheet(wb, 'Calendar')
  const calPayloads = calRows
    .filter(r => str(r.title) && parseDate(r.date))
    .map(r => ({
      title:       str(r.title),
      date:        parseDate(r.date),
      end_date:    parseDate(r.endDate),
      type:        str(r.type) ?? 'Event',
      description: str(r.description),
      campus:      str(r.campus),
    }))
  await insert('calendar', calPayloads)

  // ── 12. TPMS — Lessons ─────────────────────────────────────────────────────
  console.log('\n📖 Lessons…')
  const lessonRows = readSheet(wb, 'Lessons')
  const lessonPayloads = lessonRows
    .filter(r => str(r.title))
    .map(r => ({
      type:    'lesson',
      title:   str(r.title),
      date:    parseDate(r.date),
      status:  str(r.status),
      content: JSON.stringify({
        subject: str(r.subject), grade: str(r.grade),
        objectives: str(r.objectives), standards: str(r.standards),
        notes: str(r.reflection),
      }),
    }))
  await insert('tpms', lessonPayloads)

  // ── 13. TPMS — Units ───────────────────────────────────────────────────────
  console.log('\n📚 Units…')
  const unitRows = readSheet(wb, 'Units')
  const unitPayloads = unitRows
    .filter(r => str(r.title))
    .map(r => ({
      type:    'unit',
      title:   str(r.title),
      date:    parseDate(r.startDate),
      status:  str(r.status),
      content: JSON.stringify({
        subject: str(r.subject), grade: str(r.grade),
        startDate: parseDate(r.startDate), endDate: parseDate(r.endDate),
        objectives: str(r.understandings), standards: str(r.essentialQuestions),
        notes: str(r.reflection),
      }),
    }))
  await insert('tpms', unitPayloads)

  // ── 14. TPMS — PD ──────────────────────────────────────────────────────────
  console.log('\n🎓 Professional Development…')
  const pdRows = readSheet(wb, 'PD')
  const pdPayloads = pdRows
    .filter(r => str(r.title))
    .map(r => ({
      type:    'pd',
      title:   str(r.title),
      date:    parseDate(r.date),
      status:  str(r.status),
      content: JSON.stringify({
        provider: str(r.facilitator), hours: Number(r.duration) || 0,
        category: str(r.type), staff: str(r.attendees),
        notes: str(r.description) ?? str(r.outcome),
      }),
    }))
  await insert('tpms', pdPayloads)

  // ── 15. Assignment Tracker ─────────────────────────────────────────────────
  console.log('\n📝 AT Assignments…')
  const atRows = readSheet(wb, 'AT_Assignments')
  const atPayloads = atRows
    .filter(r => str(r.title))
    .map(r => ({
      title:         str(r.title),
      cohort:        str(r.cohort),
      subject:       str(r.subject),
      due_date:      parseDate(r.dueDate),
      max_score:     Number(r.maxScore) || 100,
      academic_year: str(r.division) ?? CURRENT_YEAR,
    }))
  await insert('at_assignments', atPayloads)

  // ── 16. PT Projects ────────────────────────────────────────────────────────
  console.log('\n🏆 PT Projects…')
  const ptRows = readSheet(wb, 'PT_Assignments')
  const ptPayloads = ptRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.sid)
      if (!studentUUID || !str(r.title)) return null
      return {
        title:      str(r.title),
        student_id: studentUUID,
        cohort:     null,
        due_date:   parseDate(r.due),
        status:     str(r.status) ?? 'Not Started',
        score:      r.score ? Number(r.score) : null,
        feedback:   str(r.cnotes) ?? str(r.reflect),
      }
    })
    .filter(Boolean)
  await insert('pt_projects', ptPayloads)

  // ── 17. Courses ────────────────────────────────────────────────────────────
  console.log('\n📊 Courses…')
  const courseRows = readSheet(wb, 'Courses')
  const coursePayloads = courseRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      if (!studentUUID || !str(r.title)) return null
      return {
        student_id:    studentUUID,
        title:         str(r.title),
        area:          str(r.area) ?? 'Other',
        type:          ['STD','HON','AP','IB','DE','EC','CR'].includes(str(r.type)) ? str(r.type) : 'STD',
        credits:       Number(r.creditsAttempted) || 1,
        grade_letter:  str(r.grade),
        academic_year: str(r.year) ?? CURRENT_YEAR,
        term:          str(r.semester),
      }
    })
    .filter(Boolean)
  await insert('courses', coursePayloads)

  // ── 18. Transfer Credits ───────────────────────────────────────────────────
  console.log('\n🔄 Transfer Credits…')
  const transferRows = readSheet(wb, 'Transfer')
  const transferPayloads = transferRows
    .map(r => {
      const studentUUID = resolveStudentUUID(r.studentId)
      if (!studentUUID || !str(r.origTitle)) return null
      return {
        student_id:   studentUUID,
        institution:  str(r.sourceSchool) ?? 'Unknown',
        course_title: str(r.origTitle),
        credits:      Number(r.creditsAwarded) || 0,
        grade_letter: str(r.origGrade),
        year:         str(r.year),
      }
    })
    .filter(Boolean)
  await insert('transfer_credits', transferPayloads)

  console.log('\n✅ Migration complete!\n')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
