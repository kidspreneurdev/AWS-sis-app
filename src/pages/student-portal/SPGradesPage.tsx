import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'
const SP_GOLD = '#FAC600'
const SP_PURPLE = '#A36CFF'
const emptyState: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 10,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  fontSize: 12,
  color: '#7A92B0',
}

type CourseType = 'STD' | 'HON' | 'AP' | 'IB' | 'DE' | 'EC' | 'CR'

interface GradeRow {
  id: string
  subject: string
  grade: number
  term: string
  course_code: string
  letter_grade: string
}

interface CourseRow {
  id: string
  title: string
  type: CourseType
  area: string
  credits: number
  grade_letter: string | null
  grade_percent: number | null
  ap_score: number | null
  ib_score: number | null
  term: string | null
  academic_year: string
}

interface RemarkRow {
  id: string
  term: string
  academic_year: string
  content: string
  author: string | null
  created_at: string
}

interface TransferRow {
  id: string
  institution: string
  course_title: string
  credits: number
  grade_letter: string | null
  year: string | null
  status: string | null
  type: string | null
  area: string | null
}

interface ECDECreditRow {
  id: string
  type: 'EC' | 'DE'
  institution: string
  course_title: string
  college_credits: number
  hs_credits: number
  grade_letter: string | null
  academic_year: string
}

interface AttendanceRow {
  status: string
}

interface SettingsRow {
  graduation_credits: number | null
  associate_degree_credits_required: number | null
}

interface GraduationRequirement {
  id: string
  key: string
  label: string
  area: string
  required_credits: number
  icon: string | null
  mandatory_note: string | null
  sort_order: number
  mandatory_courses: string[]
}

interface DistinctionRow {
  id: string
  label: string
  icon: string | null
  color: string | null
  weighted_gpa_required: number
  sort_order: number
}

const TYPE_WEIGHT: Record<CourseType, number> = { STD: 0, HON: 0.5, AP: 1, IB: 1, DE: 1, EC: 1, CR: 0 }

function letterGrade(pct: number) {
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 67) return 'D+'
  if (pct >= 65) return 'D'
  return 'F'
}

function gradePoints(letter: string | null) {
  const map: Record<string, number> = {
    'A+': 4, A: 4, 'A-': 3.7,
    'B+': 3.3, B: 3, 'B-': 2.7,
    'C+': 2.3, C: 2, 'C-': 1.7,
    'D+': 1.3, D: 1, 'D-': 0.7,
    F: 0,
  }
  return letter ? (map[letter] ?? 0) : null
}

function weightedPoints(letter: string | null, type: CourseType) {
  const base = gradePoints(letter)
  if (base === null) return null
  if (base <= 1) return base
  return Math.round((base + TYPE_WEIGHT[type]) * 100) / 100
}

function calcGPA(courses: CourseRow[]) {
  let credits = 0
  let points = 0
  courses.forEach((course) => {
    const pts = gradePoints(course.grade_letter)
    if (pts === null) return
    credits += course.credits || 0
    points += pts * (course.credits || 0)
  })
  return credits ? Math.round((points / credits) * 100) / 100 : 0
}

function calcWeightedGPA(courses: CourseRow[]) {
  let credits = 0
  let points = 0
  courses.forEach((course) => {
    const pts = weightedPoints(course.grade_letter, course.type)
    if (pts === null) return
    credits += course.credits || 0
    points += pts * (course.credits || 0)
  })
  return credits ? Math.round((points / credits) * 100) / 100 : 0
}

function gpaColor(gpa: number) {
  return gpa >= 3.5 ? SP_GREEN : gpa >= 2.5 ? SP_GOLD : SP_RED
}

function gradeColor(pct: number) {
  if (pct >= 85) return SP_GREEN
  if (pct >= 70) return SP_GOLD
  return SP_RED
}

function attendanceRate(rows: AttendanceRow[]) {
  if (!rows.length) return null
  const present = rows.filter((row) => row.status === 'Present' || row.status === 'Excused').length
  return Math.round((present / rows.length) * 100)
}

function parseGradeLevel(value: string) {
  const match = value.match(/\d+/)
  if (!match) return null
  const n = Number.parseInt(match[0], 10)
  return Number.isNaN(n) ? null : n
}

function estimateCollegeCreditsFromHsCredits(hsCredits: number) {
  return Math.round(hsCredits * 3 * 10) / 10
}

export function SPGradesPage() {
  const { session } = useStudentPortal()
  const [settings, setSettings] = useState<SettingsRow | null>(null)
  const [requirements, setRequirements] = useState<GraduationRequirement[]>([])
  const [distinctions, setDistinctions] = useState<DistinctionRow[]>([])
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [remarks, setRemarks] = useState<RemarkRow[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [ecdeCredits, setEcdeCredits] = useState<ECDECreditRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [tab, setTab] = useState<'audit' | 'courses' | 'remark'>('remark')
  const [configLoaded, setConfigLoaded] = useState(false)

  if (!session) return null

  const studentName = session.fullName
  const studentPortalId = session.studentId
  const studentGrade = session.grade
  const studentCampus = session.campus
  const studentDbId = session.dbId
  const gradeLevel = parseGradeLevel(session.grade)
  const isHS = gradeLevel !== null && gradeLevel >= 9

  useEffect(() => {
    setTab('audit')
  }, [])

  useEffect(() => {
    async function load() {
      const [
        settingsRes,
        requirementsRes,
        mandatoryCoursesRes,
        distinctionsRes,
        gradesRes,
        coursesRes,
        remarksRes,
        transferRes,
        ecdeRes,
        attendanceRes,
      ] = await Promise.all([
        supabase.from('settings').select('graduation_credits,associate_degree_credits_required').single(),
        supabase.from('graduation_requirements').select('id,key,label,area,required_credits,icon,mandatory_note,sort_order').order('sort_order'),
        supabase.from('graduation_requirement_courses').select('requirement_id,course_title,sort_order').order('sort_order'),
        supabase.from('graduation_distinctions').select('id,label,icon,color,weighted_gpa_required,sort_order').order('sort_order'),
        supabase.from('grades').select('*').eq('student_id', studentDbId),
        supabase.from('courses').select('*').eq('student_id', studentDbId).order('academic_year', { ascending: false }),
        supabase.from('remarks').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
        supabase.from('transfer_credits').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
        supabase.from('ec_de_credits').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
        supabase.from('attendance').select('status').eq('student_id', studentDbId),
      ])

      setSettings((settingsRes.data as SettingsRow | null) ?? null)

      const mandatoryMap = new Map<string, string[]>()
      ;((mandatoryCoursesRes.data as Record<string, unknown>[] | null) ?? []).forEach((row) => {
        const requirementId = row.requirement_id as string
        const list = mandatoryMap.get(requirementId) ?? []
        list.push((row.course_title as string) ?? '')
        mandatoryMap.set(requirementId, list)
      })

      setRequirements((((requirementsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        key: (row.key as string) ?? '',
        label: (row.label as string) ?? '',
        area: (row.area as string) ?? '',
        required_credits: Number(row.required_credits ?? 0),
        icon: (row.icon as string) ?? null,
        mandatory_note: (row.mandatory_note as string) ?? null,
        sort_order: Number(row.sort_order ?? 0),
        mandatory_courses: mandatoryMap.get(row.id as string) ?? [],
      }))))

      setDistinctions((((distinctionsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        label: (row.label as string) ?? '',
        icon: (row.icon as string) ?? null,
        color: (row.color as string) ?? null,
        weighted_gpa_required: Number(row.weighted_gpa_required ?? 0),
        sort_order: Number(row.sort_order ?? 0),
      }))))

      setGrades(((gradesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        subject: (row.subject as string) ?? '',
        grade: Number(row.grade ?? 0),
        term: (row.term as string) ?? '',
        course_code: (row.course_code as string) ?? '',
        letter_grade: (row.letter_grade as string) ?? '',
      })))

      setCourses(((coursesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        type: ((row.type as CourseType) ?? 'STD'),
        area: (row.area as string) ?? '',
        credits: Number(row.credits ?? 0),
        grade_letter: (row.grade_letter as string) ?? null,
        grade_percent: row.grade_percent == null ? null : Number(row.grade_percent),
        ap_score: row.ap_score == null ? null : Number(row.ap_score),
        ib_score: row.ib_score == null ? null : Number(row.ib_score),
        term: (row.term as string) ?? null,
        academic_year: (row.academic_year as string) ?? '',
      })))

      setRemarks(((remarksRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        term: (row.term as string) ?? '',
        academic_year: (row.academic_year as string) ?? '',
        content: (row.content as string) ?? '',
        author: (row.author as string) ?? null,
        created_at: (row.created_at as string) ?? '',
      })))

      setTransfers(((transferRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        institution: (row.institution as string) ?? '',
        course_title: (row.course_title as string) ?? '',
        credits: Number(row.credits ?? 0),
        grade_letter: (row.grade_letter as string) ?? null,
        year: (row.year as string) ?? null,
        status: (row.status as string) ?? null,
        type: (row.type as string) ?? null,
        area: (row.area as string) ?? null,
      })))

      setEcdeCredits(((ecdeRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        type: ((row.type as 'EC' | 'DE') ?? 'DE'),
        institution: (row.institution as string) ?? '',
        course_title: (row.course_title as string) ?? '',
        college_credits: Number(row.college_credits ?? 0),
        hs_credits: Number(row.hs_credits ?? 0),
        grade_letter: (row.grade_letter as string) ?? null,
        academic_year: (row.academic_year as string) ?? '',
      })))

      setAttendance(((attendanceRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        status: (row.status as string) ?? '',
      })))

      setConfigLoaded(true)
    }

    void load()
  }, [studentDbId])

  const avg = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g.grade, 0) / grades.length) : null
  const attRate = attendanceRate(attendance)

  const approvedTransfers = useMemo(() => transfers.filter((transfer) => transfer.status === 'Approved'), [transfers])
  const pendingTransfers = useMemo(() => transfers.filter((transfer) => !transfer.status || transfer.status === 'Pending'), [transfers])

  const creditState = useMemo(() => {
    const result: Record<string, number> = { total: 0 }
    requirements.forEach((req) => { result[req.key] = 0 })

    courses.forEach((course) => {
      const earned = course.grade_letter && course.grade_letter !== 'F' ? (course.credits || 0) : 0
      if (!earned) return
      result.total += earned
      const matched = requirements.find((req) => req.area === course.area)
      result[matched?.key ?? 'ELEC'] += earned
    })

    approvedTransfers.forEach((transfer) => {
      result.total += transfer.credits
      const matched = requirements.find((req) => req.area === transfer.area)
      result[matched?.key ?? 'ELEC'] += transfer.credits
    })

    ecdeCredits.forEach((credit) => {
      result.total += credit.hs_credits
      result.ELEC += credit.hs_credits
    })

    return result
  }, [approvedTransfers, courses, ecdeCredits, requirements])

  const uwGpa = useMemo(() => calcGPA(courses), [courses])
  const wGpa = useMemo(() => calcWeightedGPA(courses), [courses])
  const graduationCreditsRequired = settings?.graduation_credits ?? 0
  const associateDegreeCreditsRequired = settings?.associate_degree_credits_required ?? 0
  const totalEarned = Math.round((creditState.total || 0) * 10) / 10
  const pctDone = graduationCreditsRequired > 0 ? Math.min(100, Math.round((totalEarned / graduationCreditsRequired) * 100)) : 0
  const allMet = requirements.length > 0
    && requirements.every((req) => (creditState[req.key] || 0) >= req.required_credits)
    && graduationCreditsRequired > 0
    && totalEarned >= graduationCreditsRequired
  const distinction = useMemo(
    () => distinctions.find((item) => wGpa >= item.weighted_gpa_required)?.label ?? null,
    [distinctions, wGpa],
  )
  const failedCourses = useMemo(
    () => courses.filter((course) => course.grade_letter === 'F'),
    [courses],
  )
  const mandatoryAlerts = useMemo(
    () => requirements.flatMap((req) => req.mandatory_courses
      .filter((courseName) => !courses.some((course) => course.title.toLowerCase().includes(courseName.toLowerCase()) && course.grade_letter !== 'F'))
      .map((courseName) => ({ requirement: req.label, course: courseName }))),
    [courses, requirements],
  )
  const transferTotal = useMemo(
    () => Math.round(approvedTransfers.reduce((sum, transfer) => sum + transfer.credits, 0) * 10) / 10,
    [approvedTransfers],
  )
  const ecdeHsCredits = useMemo(
    () => Math.round(ecdeCredits.reduce((sum, credit) => sum + credit.hs_credits, 0) * 10) / 10,
    [ecdeCredits],
  )
  const associateDegreeCollegeCredits = useMemo(() => {
    const courseCredits = courses
      .filter((course) => course.type === 'DE' || course.type === 'EC')
      .reduce((sum, course) => sum + estimateCollegeCreditsFromHsCredits(course.credits || 0), 0)
    const transferCredits = approvedTransfers
      .filter((transfer) => transfer.type === 'DE' || transfer.type === 'EC')
      .reduce((sum, transfer) => sum + estimateCollegeCreditsFromHsCredits(transfer.credits || 0), 0)
    const ecdeCreditsTotal = ecdeCredits.reduce((sum, credit) => sum + credit.college_credits, 0)
    return Math.round((courseCredits + transferCredits + ecdeCreditsTotal) * 10) / 10
  }, [approvedTransfers, courses, ecdeCredits])
  const associateDegreePct = associateDegreeCreditsRequired > 0
    ? Math.min(100, Math.round((associateDegreeCollegeCredits / associateDegreeCreditsRequired) * 100))
    : 0

  function handlePrintAudit() {
    const popup = window.open('', '_blank', 'width=980,height=780,scrollbars=yes,resizable=yes')
    if (!popup) return

    const requirementRows = requirements.map((req) => {
      const earned = Math.round((creditState[req.key] || 0) * 10) / 10
      return `
        <tr>
          <td style="padding:8px 10px;border:1px solid #E4EAF2;font-weight:700;color:#1A365E">${req.label}</td>
          <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:center">${earned}</td>
          <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:center">${req.required_credits}</td>
          <td style="padding:8px 10px;border:1px solid #E4EAF2;text-align:center;font-weight:700;color:${earned >= req.required_credits ? SP_GREEN : SP_GOLD}">${earned >= req.required_credits ? 'Met' : 'In Progress'}</td>
        </tr>
      `
    }).join('')

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Graduation Audit - ${studentName}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Poppins, Arial, sans-serif; margin: 0; padding: 28px; color: #1A365E; background: #fff; }
            .toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
            .button { padding: 10px 18px; border-radius: 8px; border: 0; background: #1A365E; color: #fff; font-weight: 700; cursor: pointer; }
            .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-bottom: 20px; font-size: 12px; }
            .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .card { border: 1px solid #E4EAF2; border-radius: 12px; padding: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            @media print { .toolbar { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button class="button" onclick="window.print()">Print / Save PDF</button>
          </div>
          <h1 style="margin:0 0 8px;font-size:28px">Graduation Audit</h1>
          <div style="font-size:13px;color:#64748B;margin-bottom:18px">American World School Student Portal</div>
          <div class="meta">
            <div><strong>Student:</strong> ${studentName}</div>
            <div><strong>Student ID:</strong> ${studentPortalId}</div>
            <div><strong>Grade:</strong> ${studentGrade || '—'}</div>
            <div><strong>Campus:</strong> ${studentCampus || '—'}</div>
          </div>
          <div class="cards">
            <div class="card"><div style="font-size:10px;color:#7A92B0;text-transform:uppercase;font-weight:700">Unweighted GPA</div><div style="font-size:28px;font-weight:900;color:${gpaColor(uwGpa)}">${uwGpa.toFixed(2)}</div></div>
            <div class="card"><div style="font-size:10px;color:#7A92B0;text-transform:uppercase;font-weight:700">Weighted GPA</div><div style="font-size:28px;font-weight:900;color:${SP_PURPLE}">${wGpa.toFixed(2)}</div></div>
            <div class="card"><div style="font-size:10px;color:#7A92B0;text-transform:uppercase;font-weight:700">Credits Earned</div><div style="font-size:28px;font-weight:900;color:${pctDone >= 100 ? SP_GREEN : SP_GOLD}">${totalEarned} / ${graduationCreditsRequired || '—'}</div></div>
            <div class="card"><div style="font-size:10px;color:#7A92B0;text-transform:uppercase;font-weight:700">Status</div><div style="font-size:28px;font-weight:900;color:${allMet ? SP_GREEN : SP_GOLD}">${allMet ? 'On Track' : 'In Progress'}</div></div>
          </div>
          <table>
            <thead>
              <tr style="background:#F8FAFC">
                <th style="padding:8px 10px;border:1px solid #E4EAF2;text-align:left">Requirement</th>
                <th style="padding:8px 10px;border:1px solid #E4EAF2">Earned</th>
                <th style="padding:8px 10px;border:1px solid #E4EAF2">Required</th>
                <th style="padding:8px 10px;border:1px solid #E4EAF2">Status</th>
              </tr>
            </thead>
            <tbody>${requirementRows}</tbody>
          </table>
        </body>
      </html>
    `)
    popup.document.close()
  }

  const bySubject = useMemo(() => {
    const map: Record<string, GradeRow[]> = {}
    grades.forEach((grade) => {
      if (!map[grade.subject]) map[grade.subject] = []
      map[grade.subject].push(grade)
    })
    return map
  }, [grades])

  const tabs = [
    { key: 'audit' as const, label: '🎓 Graduation Audit' },
    { key: 'courses' as const, label: '📚 Course Records' },
    { key: 'remark' as const, label: '📝 Report Card' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY }}>📊 My Grades</div>

      <div style={{ display: 'flex', gap: 0, border: '1.5px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              flex: 1,
              padding: 10,
              border: 'none',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Poppins,sans-serif',
              background: tab === item.key ? SP_NAVY : '#F7F9FC',
              color: tab === item.key ? '#fff' : '#7A92B0',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'audit' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Unweighted GPA', value: uwGpa.toFixed(2), sub: '4.0 scale', color: gpaColor(uwGpa), icon: '📊' },
              { label: 'Weighted GPA', value: wGpa.toFixed(2), sub: distinction || 'No distinction yet', color: SP_PURPLE, icon: '⭐' },
              { label: 'Credits Earned', value: `${totalEarned} / ${graduationCreditsRequired || '—'}`, sub: `${pctDone}% complete`, color: pctDone >= 100 ? SP_GREEN : SP_GOLD, icon: '📚' },
              { label: 'Status', value: allMet ? 'On Track' : 'In Progress', sub: allMet ? 'All requirements met' : 'Keep going!', color: allMet ? SP_GREEN : SP_GOLD, icon: '🎓' },
            ].map((item) => (
              <div key={item.label} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: item.color, marginTop: 8 }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6 }}>{item.sub}</div>
                  </div>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {failedCourses.length > 0 && (
            <div style={{ background: '#FEE2E2', borderLeft: `4px solid ${SP_RED}`, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7F1D1D', marginBottom: 6 }}>
                ⚠️ Failed Course{failedCourses.length > 1 ? 's' : ''} - No Credit Awarded
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {failedCourses.map((course) => (
                  <div key={course.id} style={{ fontSize: 11, color: '#7F1D1D' }}>
                    • {course.title} ({course.academic_year || 'Current Year'}) - Must repeat to earn credit
                  </div>
                ))}
              </div>
            </div>
          )}

          {mandatoryAlerts.length > 0 && (
            <div style={{ background: '#FEF3C7', borderLeft: '4px solid #D97706', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                ⚡ Mandatory Course{mandatoryAlerts.length > 1 ? 's' : ''} Not Yet Completed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {mandatoryAlerts.map((alert) => (
                  <div key={`${alert.requirement}-${alert.course}`} style={{ fontSize: 11, color: '#92400E' }}>
                    • {alert.course} (required for {alert.requirement})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'start' }}>
            <div style={{ ...card, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Graduation Progress</div>
              <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  <circle cx="90" cy="90" r="80" fill="none" stroke="#E4EAF2" strokeWidth="14" />
                  <circle
                    cx="90"
                    cy="90"
                    r="80"
                    fill="none"
                    stroke={allMet ? SP_GREEN : SP_GOLD}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${(2 * Math.PI * 80 * pctDone) / 100} ${2 * Math.PI * 80}`}
                    transform="rotate(-90 90 90)"
                  />
                </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: allMet ? SP_GREEN : SP_GOLD }}>{pctDone}%</div>
                  <div style={{ fontSize: 12, color: '#7A92B0' }}>{totalEarned} of {graduationCreditsRequired || '—'} cr</div>
                </div>
              </div>
              {allMet && <div style={{ fontSize: 12, fontWeight: 800, color: SP_GREEN, marginTop: 6 }}>🎉 Graduation Requirements Met!</div>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requirements.map((req) => {
                const earned = Math.round((creditState[req.key] || 0) * 10) / 10
                const pct = req.required_credits > 0 ? Math.min(100, Math.round((earned / req.required_credits) * 100)) : 0
                const color = pct >= 100 ? SP_GREEN : pct >= 50 ? SP_GOLD : SP_RED
                return (
                  <div key={req.key} style={{ ...card, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{req.icon ?? '•'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{req.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color }}>{earned} / {req.required_credits} cr {pct >= 100 ? '✅' : ''}</span>
                    </div>
                    <div style={{ background: '#E4EAF2', borderRadius: 4, height: 8 }}>
                      <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 4 }} />
                    </div>
                    {req.mandatory_note && <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 4 }}>{req.mandatory_note}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {requirements.length === 0 && configLoaded && (
            <div style={{ ...card, padding: 18, borderLeft: `4px solid ${SP_GOLD}`, background: '#FFFDF5' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 6 }}>Graduation requirements are not configured</div>
              <div style={{ fontSize: 12, color: '#7A92B0' }}>
                The student portal is now reading graduation policy from Supabase. Add requirement records in the database to populate this audit.
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            <div style={{ ...card, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>🏆 Graduation Distinctions</div>
              {distinctions.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {distinctions.map((item) => {
                    const achieved = wGpa >= item.weighted_gpa_required
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: 14,
                          borderRadius: 10,
                          background: achieved ? `${item.color ?? '#E4EAF2'}20` : '#F7F9FC',
                          border: `2px solid ${achieved ? (item.color ?? '#E4EAF2') : '#E4EAF2'}`,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon ?? '🏅'}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: achieved ? SP_NAVY : '#7A92B0' }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 3 }}>WGPA ≥ {item.weighted_gpa_required.toFixed(1)}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: achieved ? SP_GREEN : SP_RED, marginTop: 6 }}>
                          {achieved ? '✅ Achieved' : `Current: ${wGpa.toFixed(2)}`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={emptyState}>No distinction data has been configured in Supabase for this section yet.</div>
              )}
            </div>

            <div style={{ ...card, padding: 18, borderLeft: `4px solid ${SP_PURPLE}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>🎓 Associate Degree Track</div>
                {associateDegreeCreditsRequired > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 12 }}>
                      Students completing {associateDegreeCreditsRequired} college credits earn an Associate Degree alongside the AWS Diploma.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>College Credits</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: SP_PURPLE }}>{associateDegreeCollegeCredits} / {associateDegreeCreditsRequired}</span>
                    </div>
                    <div style={{ background: '#E4EAF2', borderRadius: 6, height: 10 }}>
                      <div style={{ background: SP_PURPLE, width: `${associateDegreePct}%`, height: '100%', borderRadius: 6 }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 8 }}>
                      Includes DE/EC coursework and approved college-credit equivalents.
                    </div>
                  </>
                ) : (
                  <div style={emptyState}>No associate degree credit target has been configured in Supabase for this section yet.</div>
                )}
              </div>
          </div>

          <div style={{ ...card, padding: 18, borderLeft: '4px solid #0A6B64' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 10 }}>🏛️ Transfer & EC Credits</div>

              {approvedTransfers.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: SP_GREEN, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    ✅ Approved ({approvedTransfers.length} record{approvedTransfers.length !== 1 ? 's' : ''})
                  </div>
                  {approvedTransfers.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F0F4FA' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{item.course_title}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0' }}>
                          {item.institution}
                          {item.area ? ` · ${item.area}` : ''}
                          {item.type ? ` · ${item.type}` : ''}
                          {item.year ? ` · ${item.year}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: SP_GREEN }}>{item.credits} cr</div>
                        <div style={{ fontSize: 9, color: SP_GREEN }}>Approved</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 12, fontWeight: 800, color: SP_GREEN }}>
                    Total: {transferTotal} credits
                  </div>
                </div>
              )}

              {ecdeCredits.length > 0 && (
                <div style={{ marginBottom: pendingTransfers.length > 0 ? 12 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: SP_PURPLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    🎓 EC / DE Credit ({ecdeCredits.length} record{ecdeCredits.length !== 1 ? 's' : ''})
                  </div>
                  {ecdeCredits.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F0F4FA' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{item.course_title}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0' }}>{item.institution} · {item.type}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: SP_PURPLE }}>{item.hs_credits} HS</div>
                        <div style={{ fontSize: 10, color: '#7A92B0' }}>{item.college_credits} college</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 12, fontWeight: 800, color: SP_PURPLE }}>
                    Total: {ecdeHsCredits} HS credits
                  </div>
                </div>
              )}

              {pendingTransfers.length > 0 && (
                <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 14px', marginTop: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    ⏳ Pending Approval ({pendingTransfers.length} record{pendingTransfers.length !== 1 ? 's' : ''})
                  </div>
                  <div style={{ fontSize: 11, color: '#7A5100', marginBottom: 8 }}>
                    These credits are not yet counted toward your graduation total. Ask your admin to mark them as approved.
                  </div>
                  {pendingTransfers.map((item) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>{item.course_title}</div>
                        <div style={{ fontSize: 10, color: '#B45309' }}>{item.institution}{item.area ? ` · ${item.area}` : ''}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#B45309' }}>{item.credits} cr pending</div>
                    </div>
                  ))}
                </div>
              )}

              {approvedTransfers.length === 0 && pendingTransfers.length === 0 && ecdeCredits.length === 0 && (
                <div style={emptyState}>No transfer or EC/DE credit data is available from Supabase for this section yet.</div>
              )}
            </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handlePrintAudit}
              style={{
                padding: '10px 22px',
                background: SP_NAVY,
                color: '#fff',
                border: 'none',
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Poppins,sans-serif',
              }}
            >
              🖨 Print Graduation Audit
            </button>
          </div>
        </>
      )}

      {tab === 'courses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.length === 0 ? (
            <div style={{ ...card, padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div style={{ fontWeight: 700, color: SP_NAVY, marginBottom: 6 }}>No course records yet</div>
              <div style={{ fontSize: 12, color: '#7A92B0' }}>Your high school course records will appear here.</div>
            </div>
          ) : (
            courses.map((course) => {
              const pct = course.grade_percent ?? 0
              const color = gradeColor(pct)
              return (
                <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
                  <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #F0F4FA' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: SP_NAVY }}>{course.title}</span>
                          <span style={{ background: `${color}15`, color, padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{course.grade_letter ?? 'IP'}</span>
                          <span style={{ background: '#F7F9FC', color: '#7A92B0', padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{course.type}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#7A92B0' }}>📚 {course.area}</span>
                          <span style={{ fontSize: 11, color: '#7A92B0' }}>🎓 {course.credits} credits</span>
                          {course.term && <span style={{ fontSize: 11, color: '#7A92B0' }}>🗓 {course.term}</span>}
                          <span style={{ fontSize: 11, color: '#7A92B0' }}>🏫 {course.academic_year}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '12px 18px', background: `${color}15`, borderRadius: 10, minWidth: 90, flexShrink: 0 }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color }}>{course.grade_percent != null ? Math.round(course.grade_percent) : '—'}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>{course.grade_percent != null ? '%' : 'No score'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'remark' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isHS && avg !== null && (
            <div style={{ ...card, display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: gradeColor(avg), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{letterGrade(avg).replace('+', '')}</span>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: SP_NAVY }}>{avg}%</div>
                <div style={{ fontSize: 13, color: '#7A92B0' }}>Overall Average · {grades.length} grade{grades.length !== 1 ? 's' : ''} recorded</div>
              </div>
            </div>
          )}

          {grades.length > 0 ? (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F9FC' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Term</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade) => (
                    <tr key={grade.id}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: SP_NAVY, borderBottom: '1px solid #F0F4F8', fontWeight: 700 }}>{grade.subject}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#7A92B0', borderBottom: '1px solid #F0F4F8' }}>{grade.term || '—'}{grade.course_code ? ` · ${grade.course_code}` : ''}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: gradeColor(grade.grade), borderBottom: '1px solid #F0F4F8', textAlign: 'right', fontWeight: 800 }}>{grade.grade}% {grade.letter_grade ? `· ${grade.letter_grade}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No report card grade data is available from Supabase for this section yet.</div>
          )}

          {Object.keys(bySubject).length > 0 && !isHS && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {Object.entries(bySubject).map(([subject, rows]) => {
                const subjectAvg = Math.round(rows.reduce((sum, row) => sum + row.grade, 0) / rows.length)
                return (
                  <div key={subject} style={card}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: SP_NAVY, marginBottom: 6 }}>{subject}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: gradeColor(subjectAvg) }}>{subjectAvg}%</div>
                    <div style={{ fontSize: 11, color: '#7A92B0' }}>{rows.length} grade{rows.length !== 1 ? 's' : ''}</div>
                    <div style={{ marginTop: 8, height: 5, background: '#E4EAF2', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${subjectAvg}%`, background: gradeColor(subjectAvg), borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!isHS && Object.keys(bySubject).length === 0 && (
            <div style={{ ...card, ...emptyState }}>No subject summary data is available from Supabase for this section yet.</div>
          )}

          {remarks.length > 0 ? (
            <div style={{ ...card, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>📝 Teacher Remarks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {remarks.map((remark) => (
                  <div key={remark.id} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${SP_NAVY}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0' }}>{remark.term} · {remark.academic_year}</div>
                      {remark.author && <div style={{ fontSize: 10, color: '#94A3B8' }}>{remark.author}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: '#3D5475', lineHeight: 1.6 }}>{remark.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ ...card, ...emptyState }}>No teacher remarks are available from Supabase for this section yet.</div>
          )}

          <div style={{ ...card, padding: '12px 20px', background: '#F7F9FC', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance Rate</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: attRate !== null ? (attRate >= 90 ? SP_GREEN : attRate >= 80 ? SP_GOLD : SP_RED) : '#7A92B0', marginLeft: 8 }}>
                {attRate !== null ? `${attRate}%` : '—'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Days Recorded</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: SP_NAVY, marginLeft: 8 }}>{attendance.length}</span>
            </div>
            {isHS && (
              <div>
                <span style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weighted GPA</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: gpaColor(wGpa), marginLeft: 8 }}>{wGpa.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
