import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, GraduationCap, BarChart3, BookOpen, AlertTriangle, CheckCircle2,
  PartyPopper, Trophy, Medal, Landmark, Hourglass, Printer, Star, ArrowRight, Circle, X,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import {
  card, emptyState, SP_NAVY, SP_RED, SP_GREEN, SP_GOLD, SP_PURPLE, portalPrefix,
  calcGPA, calcWeightedGPA, gpaColor, estimateCollegeCreditsFromHsCredits, creditProgress,
  type CourseRow, type TransferRow, type ECDECreditRow, type SettingsRow,
  type GraduationRequirement, type DistinctionRow,
} from './gradesShared'

export function SPGraduationAuditPage() {
  const { session } = useStudentPortal()
  const navigate = useNavigate()
  const location = useLocation()
  const prefix = portalPrefix(location.pathname)

  const [settings, setSettings] = useState<SettingsRow | null>(null)
  const [requirements, setRequirements] = useState<GraduationRequirement[]>([])
  const [distinctions, setDistinctions] = useState<DistinctionRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [ecdeCredits, setEcdeCredits] = useState<ECDECreditRow[]>([])
  const [breakdownReq, setBreakdownReq] = useState<GraduationRequirement | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const studentDbId = session?.dbId ?? ''
  const studentName = session?.fullName ?? ''
  const studentPortalId = session?.studentId ?? ''
  const studentGrade = session?.grade ?? ''
  const studentCampus = session?.campus ?? ''

  useEffect(() => {
    if (!session) return
    async function load() {
      const [settingsRes, requirementsRes, distinctionsRes, coursesRes, transferRes, ecdeRes] = await Promise.all([
        supabase.from('settings').select('graduation_credits,associate_degree_credits_required').single(),
        supabase.from('graduation_requirements').select('id,key,label,area,required_credits,icon,sort_order').order('sort_order'),
        supabase.from('graduation_distinctions').select('id,label,icon,color,weighted_gpa_required,sort_order').order('sort_order'),
        supabase.from('courses').select('*').eq('student_id', studentDbId).order('academic_year', { ascending: false }),
        supabase.from('transfer_credits').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
        supabase.from('ec_de_credits').select('*').eq('student_id', studentDbId).order('created_at', { ascending: false }),
      ])

      setSettings((settingsRes.data as SettingsRow | null) ?? null)

      setRequirements((((requirementsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        key: (row.key as string) ?? '',
        label: (row.label as string) ?? '',
        area: (row.area as string) ?? '',
        required_credits: Number(row.required_credits ?? 0),
        icon: (row.icon as string) ?? null,
        sort_order: Number(row.sort_order ?? 0),
      }))))

      setDistinctions((((distinctionsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        label: (row.label as string) ?? '',
        icon: (row.icon as string) ?? null,
        color: (row.color as string) ?? null,
        weighted_gpa_required: Number(row.weighted_gpa_required ?? 0),
        sort_order: Number(row.sort_order ?? 0),
      }))))

      setCourses(((coursesRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? '',
        type: ((row.type as CourseRow['type']) ?? 'STD'),
        area: (row.area as string) ?? '',
        credits: Number(row.credits ?? 0),
        credits_earned: Number(row.credits_earned ?? row.credits ?? 0),
        course_status: (row.course_status as string) ?? null,
        grade_letter: (row.grade_letter as string) ?? null,
        grade_percent: row.grade_percent == null ? null : Number(row.grade_percent),
        ap_score: row.ap_score == null ? null : Number(row.ap_score),
        ib_score: row.ib_score == null ? null : Number(row.ib_score),
        term: (row.term as string) ?? null,
        academic_year: (row.academic_year as string) ?? '',
      })))

      setTransfers(((transferRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
        id: row.id as string,
        institution: (row.institution as string) ?? (row.source_school as string) ?? '',
        course_title: (row.course_title as string) ?? (row.orig_title as string) ?? '',
        credits: Number(row.credits_awarded ?? row.credits ?? 0),
        grade_letter: (row.grade_letter as string) ?? (row.orig_grade as string) ?? null,
        year: (row.year as string) ?? null,
        status: (row.status as string) ?? null,
        type: (row.type as string) ?? (row.kind as string) ?? null,
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

      setConfigLoaded(true)
    }
    void load()
  }, [session, studentDbId])

  const approvedTransfers = useMemo(() => transfers.filter((transfer) => transfer.status === 'Approved'), [transfers])
  const pendingTransfers = useMemo(() => transfers.filter((transfer) => !transfer.status || transfer.status === 'Pending'), [transfers])

  const creditState = useMemo(() => {
    const result: Record<string, number> = { total: 0, awsCredits: 0, transferCredits: 0 }
    requirements.forEach((req) => { result[req.key] = 0 })

    courses.forEach((course) => {
      if (course.grade_letter === 'F') return
      const isPending = !course.grade_letter || course.grade_letter === 'IP'
      if (isPending) return
      const earned = course.credits_earned || 0
      if (!earned) return
      result.total += earned
      result.awsCredits += earned
      const matched = requirements.find((req) => req.area === course.area)
      result[matched?.key ?? 'ELEC'] += earned
    })

    approvedTransfers.forEach((transfer) => {
      result.total += transfer.credits
      result.transferCredits += transfer.credits
      const matched = requirements.find((req) => req.area === transfer.area)
      result[matched?.key ?? 'ELEC'] += transfer.credits
    })

    ecdeCredits.forEach((credit) => {
      result.total += credit.hs_credits
      result.awsCredits += credit.hs_credits
      result.ELEC += credit.hs_credits
    })

    return result
  }, [approvedTransfers, courses, ecdeCredits, requirements])

  const uwGpa = useMemo(() => calcGPA(courses, transfers), [courses, transfers])
  const wGpa = useMemo(() => calcWeightedGPA(courses, transfers), [courses, transfers])
  const associateDegreeCreditsRequired = settings?.associate_degree_credits_required ?? 0
  const { totalEarned, required: graduationCreditsRequired, pct: pctDone } = useMemo(
    () => creditProgress(courses, transfers, settings?.graduation_credits ?? null, ecdeCredits),
    [courses, transfers, settings, ecdeCredits],
  )
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
  const transferTotal = useMemo(
    () => Math.round(approvedTransfers.reduce((sum, transfer) => sum + transfer.credits, 0) * 10) / 10,
    [approvedTransfers],
  )
  const awsResidencyCredits = Math.round(graduationCreditsRequired * 0.25 * 10) / 10
  const awsCreditsEarned = Math.round((creditState.awsCredits || 0) * 10) / 10
  const transferCreditsEarned = Math.round((creditState.transferCredits || 0) * 10) / 10
  const hasTransferCredits = transferCreditsEarned > 0
  const residencyMet = awsCreditsEarned >= awsResidencyCredits
  const residencyRemaining = Math.max(0, Math.round((awsResidencyCredits - awsCreditsEarned) * 10) / 10)
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

    const svg = (paths: string, color: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${paths}</svg>`
    const iconCheckCircle = (color: string) => svg('<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>', color)
    const iconAlertTriangle = (color: string) => svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', color)

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

    const residencyBox = hasTransferCredits ? `
      <div style="margin-top:16px;border-radius:8px;padding:12px 16px;border-left:4px solid ${residencyMet ? SP_GREEN : '#D97706'};background:${residencyMet ? '#F0FDF4' : '#FEF3C7'}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          <div style="font-size:12px;font-weight:700;color:${residencyMet ? '#166534' : '#92400E'}">${residencyMet ? iconCheckCircle('#166534') : iconAlertTriangle('#92400E')} American World School Credit Requirement</div>
          <div style="font-size:11px;font-weight:700;color:#7A92B0">${awsCreditsEarned} / ${awsResidencyCredits} cr required at AWS</div>
        </div>
        <div style="font-size:11px;color:#3D5475">
          <strong>${awsCreditsEarned} cr</strong> earned directly through American World School coursework &middot; <strong>${transferCreditsEarned} cr</strong> from external transfer credit
        </div>
        <div style="font-size:11px;margin-top:4px;color:${residencyMet ? '#166534' : '#92400E'};font-weight:${residencyMet ? 400 : 600}">
          ${residencyMet
            ? `At least 25% of the ${graduationCreditsRequired}-credit diploma (${awsResidencyCredits} credits) has been completed through American World School, satisfying WASC (Western Association of Schools and Colleges) accreditation requirements.`
            : `To satisfy WASC (Western Association of Schools and Colleges) accreditation requirements, a student must complete at least 25% of their credits with us — at least ${awsResidencyCredits} credits must be earned in our school. ${residencyRemaining} more AWS credit${residencyRemaining === 1 ? '' : 's'} needed.`}
        </div>
      </div>
    ` : ''

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
          <div style="font-size:13px;color:#64748B;margin-bottom:18px">American World School</div>
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
          ${residencyBox}
        </body>
      </html>
    `)
    popup.document.close()
  }

  // ─── Breakdown modal data ───────────────────────────────────────────────────
  const breakdownData = breakdownReq ? (() => {
    const req = breakdownReq
    const earned = Math.round((creditState[req.key] || 0) * 10) / 10
    const stillNeeded = Math.max(0, Math.round((req.required_credits - earned) * 10) / 10)

    type BreakdownRow = { title: string; source: string; area: string; grade: string; credits: number }
    const rows: BreakdownRow[] = []

    courses.forEach((c) => {
      if (c.grade_letter === 'F' || !c.grade_letter || c.grade_letter === 'IP') return
      const matched = requirements.find((r) => r.area === c.area)
      if ((matched?.key ?? 'ELEC') !== req.key) return
      rows.push({ title: c.title, source: 'Course', area: c.area, grade: c.grade_letter, credits: c.credits_earned || 0 })
    })

    approvedTransfers.forEach((t) => {
      const matched = requirements.find((r) => r.area === t.area)
      if ((matched?.key ?? 'ELEC') !== req.key) return
      rows.push({ title: t.course_title || 'Transfer Credit', source: `Transfer${t.type ? ` (${t.type})` : ''}`, area: t.area ?? '', grade: t.grade_letter ?? '—', credits: t.credits })
    })

    if (req.key === 'ELEC') {
      ecdeCredits.forEach((c) => {
        rows.push({ title: c.course_title, source: c.type, area: c.institution, grade: c.grade_letter ?? '—', credits: c.hs_credits })
      })
    }

    return { req, earned, stillNeeded, rows }
  })() : null

  if (!session) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ─── Credit Breakdown Modal ─────────────────────────────────────── */}
      {breakdownData && (
        <div
          onClick={() => setBreakdownReq(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,25,50,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: SP_NAVY }}>
                  {breakdownData.req.label} Credit Breakdown
                </div>
                <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 3 }}>
                  Required: {breakdownData.req.required_credits} cr · Earned: {breakdownData.earned} cr · Still Needed: {breakdownData.stillNeeded} cr
                </div>
              </div>
              <button
                onClick={() => setBreakdownReq(null)}
                style={{ background: '#F0F4F8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#7A92B0', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              ><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px 20px' }}>
              {[
                { label: 'REQUIRED', value: breakdownData.req.required_credits, color: SP_NAVY },
                { label: 'EARNED', value: breakdownData.earned, color: SP_GREEN },
                { label: 'STILL NEEDED', value: breakdownData.stillNeeded, color: breakdownData.stillNeeded > 0 ? SP_RED : SP_GREEN },
              ].map(s => (
                <div key={s.label} style={{ background: s.label === 'EARNED' ? '#F0FDF4' : '#F7F9FC', borderRadius: 10, padding: '14px 16px', border: `1px solid ${s.label === 'EARNED' ? '#BBF7D0' : '#E4EAF2'}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {breakdownData.rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#7A92B0', fontSize: 13 }}>
                  No completed credits recorded for this requirement yet.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: SP_NAVY, marginBottom: 10 }}>
                    Completed Credits ({breakdownData.rows.length})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E4EAF2' }}>
                        {['Course / Credit', 'Source', 'Area', 'Grade', 'Credits Counted'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownData.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F0F4F8' }}>
                          <td style={{ padding: '10px', fontSize: 13, fontWeight: 600, color: SP_NAVY }}>{row.title}</td>
                          <td style={{ padding: '10px', fontSize: 12, color: '#7A92B0' }}>{row.source}</td>
                          <td style={{ padding: '10px', fontSize: 12, color: '#7A92B0' }}>{row.area}</td>
                          <td style={{ padding: '10px', fontSize: 12, color: SP_NAVY }}>{row.grade}</td>
                          <td style={{ padding: '10px', fontSize: 13, fontWeight: 700, color: SP_GREEN }}>{row.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate(`${prefix}/grades`)}
          style={{ background: '#F0F4F8', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: SP_NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={13} /> Back to My Grades
        </button>
        <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><GraduationCap size={18} /> Graduation Audit</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {([
          { label: 'Unweighted GPA', value: uwGpa.toFixed(2), sub: '4.0 scale', color: gpaColor(uwGpa), icon: BarChart3 },
          { label: 'Weighted GPA', value: wGpa.toFixed(2), sub: distinction || 'No distinction yet', color: SP_PURPLE, icon: Star },
          { label: 'Credits Earned', value: `${totalEarned} / ${graduationCreditsRequired || '—'}`, sub: `${pctDone}% complete`, color: pctDone >= 100 ? SP_GREEN : SP_GOLD, icon: BookOpen },
          { label: 'Status', value: allMet ? 'On Track' : 'In Progress', sub: allMet ? 'All requirements met' : 'Keep going!', color: allMet ? SP_GREEN : SP_GOLD, icon: GraduationCap },
        ] as { label: string; value: string; sub: string; color: string; icon: LucideIcon }[]).map((item) => (
          <div key={item.label} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: item.color, marginTop: 8 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 6 }}>{item.sub}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}><item.icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      {failedCourses.length > 0 && (
        <div style={{ background: '#FEE2E2', borderLeft: `4px solid ${SP_RED}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7F1D1D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={12} /> Failed Course{failedCourses.length > 1 ? 's' : ''} - No Credit Awarded
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

      {hasTransferCredits && (
        <div style={{ background: residencyMet ? '#F0FDF4' : '#FEF3C7', borderLeft: `4px solid ${residencyMet ? SP_GREEN : '#D97706'}`, borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: residencyMet ? '#166534' : '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
              {residencyMet ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} American World School Credit Requirement
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0' }}>{awsCreditsEarned} / {awsResidencyCredits} cr required at AWS</div>
          </div>
          <div style={{ background: '#E4EAF2', borderRadius: 4, height: 8 }}>
            <div style={{ background: residencyMet ? SP_GREEN : '#D97706', width: `${Math.min(100, Math.round((awsCreditsEarned / awsResidencyCredits) * 100))}%`, height: '100%', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 11, color: '#3D5475', marginTop: 8 }}>
            <strong>{awsCreditsEarned} cr</strong> earned directly through American World School coursework · <strong>{transferCreditsEarned} cr</strong> from external transfer credit
          </div>
          {residencyMet ? (
            <div style={{ fontSize: 11, color: '#166534', marginTop: 4 }}>
              At least 25% of the {graduationCreditsRequired}-credit diploma ({awsResidencyCredits} credits) has been completed through American World School, satisfying WASC (Western Association of Schools and Colleges) accreditation requirements.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 4, fontWeight: 600 }}>
              To satisfy WASC (Western Association of Schools and Colleges) accreditation requirements, a student must complete at least 25% of their credits with us — at least {awsResidencyCredits} credits must be earned in our school. {residencyRemaining} more AWS credit{residencyRemaining === 1 ? '' : 's'} needed.
            </div>
          )}
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
          {allMet && <div style={{ fontSize: 12, fontWeight: 800, color: SP_GREEN, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><PartyPopper size={13} /> Graduation Requirements Met!</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requirements.map((req) => {
            const earned = Math.round((creditState[req.key] || 0) * 10) / 10
            const pct = req.required_credits > 0 ? Math.min(100, Math.round((earned / req.required_credits) * 100)) : 0
            const color = pct >= 100 ? SP_GREEN : pct >= 50 ? SP_GOLD : SP_RED
            return (
              <div
                key={req.key}
                onClick={() => setBreakdownReq(req)}
                style={{ ...card, padding: '12px 16px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#C7D7EA')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E4EAF2')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {req.icon ? <span style={{ fontSize: 16 }}>{req.icon}</span> : <Circle size={8} fill="#94A3B8" color="#94A3B8" />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>{req.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{earned} / {req.required_credits} cr {pct >= 100 ? <CheckCircle2 size={12} /> : null}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 3 }}>View breakdown <ArrowRight size={10} /></span>
                  </div>
                </div>
                <div style={{ background: '#E4EAF2', borderRadius: 4, height: 8 }}>
                  <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {requirements.length === 0 && configLoaded && (
        <div style={{ ...card, padding: 18, borderLeft: `4px solid ${SP_GOLD}`, background: '#FFFDF5' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 6 }}>Graduation requirements are not configured</div>
          <div style={{ fontSize: 12, color: '#7A92B0' }}>
            Graduation requirements have not been set up yet. Once they are configured, this audit will populate automatically.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} /> Graduation Distinctions</div>
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
                    <div style={{ fontSize: 24, marginBottom: 6, display: 'flex', justifyContent: 'center', color: achieved ? (item.color ?? SP_NAVY) : '#7A92B0' }}>{item.icon ?? <Medal size={24} />}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: achieved ? SP_NAVY : '#7A92B0' }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 3 }}>WGPA ≥ {item.weighted_gpa_required.toFixed(1)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: achieved ? SP_GREEN : SP_RED, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {achieved ? <><CheckCircle2 size={11} /> Achieved</> : `Current: ${wGpa.toFixed(2)}`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={emptyState}>No graduation distinctions have been configured yet.</div>
          )}
        </div>

        <div style={{ ...card, padding: 18, borderLeft: `4px solid ${SP_PURPLE}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={13} /> Associate Degree Track</div>
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
              <div style={emptyState}>No associate degree credit target has been configured yet.</div>
            )}
          </div>
      </div>

      <div style={{ ...card, padding: 18, borderLeft: '4px solid #0A6B64' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Landmark size={13} /> Transfer &amp; EC Credits</div>

          {approvedTransfers.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: SP_GREEN, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> Approved ({approvedTransfers.length} record{approvedTransfers.length !== 1 ? 's' : ''})
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
              <div style={{ fontSize: 10, fontWeight: 700, color: SP_PURPLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <GraduationCap size={11} /> EC / DE Credit ({ecdeCredits.length} record{ecdeCredits.length !== 1 ? 's' : ''})
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
              <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Hourglass size={11} /> Pending Approval ({pendingTransfers.length} record{pendingTransfers.length !== 1 ? 's' : ''})
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
            <div style={emptyState}>No transfer or EC/DE credits have been recorded yet.</div>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Printer size={13} /> Print Graduation Audit</span>
        </button>
      </div>
    </div>
  )
}
