import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────
interface AlertItem {
  id: string
  category: 'critical' | 'urgent' | 'info'
  icon: string
  title: string
  body: string
  action?: string
  actionLabel?: string
  studentId?: string
}

interface StudentRow {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  status: string
  campus: string | null
  studentId: string | null
  priority: string
  appDate: string | null
  documents: string[]
  intDate: string | null
  intScore: number | null
  cohort: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)',
}

const CATEGORY_META = {
  critical: { bg: '#FFF0F1', border: '#FFC8CC', tc: '#D61F31', label: 'Critical' },
  urgent:   { bg: '#FFF6E0', border: '#FFE4A0', tc: '#B45309', label: 'Urgent' },
  info:     { bg: '#E6F4FF', border: '#BFDBFE', tc: '#0369A1', label: 'Info' },
}

const DISMISSED_KEY = 'aws_notif_dismissed'
const DOC_TYPES = ['Birth Certificate', 'Immunization Records', 'Prior School Transcript', 'Passport / ID Copy', 'Medical Form', 'Recommendation Letter', 'Emergency Contact Form', 'Technology Agreement']

function daysSince(dateStr: string | null) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function AlertsPage() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showDismissed, setShowDismissed] = useState(false)

  // Load dismissed from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY)
      if (raw) setDismissed(new Set(JSON.parse(raw)))
    } catch { /* */ }
  }, [])

  useEffect(() => {
    supabase.from('students').select('id,first_name,last_name,grade,status,campus,student_id,priority,application_date,notes,cohort').then(({ data }) => {
      if (data) {
        setStudents(data.map((r: Record<string, unknown>) => {
          let ext: Record<string, unknown> = {}
          try { ext = JSON.parse((r.notes as string) || '{}') } catch { /* */ }
          return {
            id: r.id as string,
            firstName: r.first_name as string ?? '',
            lastName: r.last_name as string ?? '',
            grade: r.grade != null ? String(r.grade) : null,
            status: (r.status as string) ?? '',
            campus: r.campus as string ?? null,
            studentId: r.student_id as string ?? null,
            priority: (r.priority as string) ?? 'Normal',
            appDate: r.application_date as string ?? null,
            documents: (ext.documents as string[]) ?? [],
            intDate: ext.intDate as string ?? null,
            intScore: ext.intScore != null ? Number(ext.intScore) : null,
            cohort: r.cohort as string ?? null,
          }
        }))
      }
      setLoading(false)
    })
  }, [])

  const alerts = useMemo((): AlertItem[] => {
    const items: AlertItem[] = []

    // 1. Enrolled missing Student ID (critical)
    students.filter(s => s.status === 'Enrolled' && !s.studentId).forEach(s => {
      items.push({
        id: `no-id-${s.id}`,
        category: 'critical',
        icon: '🆔',
        title: 'Missing Student ID',
        body: `${s.firstName} ${s.lastName} is enrolled but has no Student ID assigned.`,
        action: `/students`,
        actionLabel: 'Assign Now',
        studentId: s.id,
      })
    })

    // 2. Missing documents (urgent) — fewer than 3 docs
    students.filter(s => ['Applied', 'Under Review', 'Waitlisted', 'Accepted', 'Enrolled'].includes(s.status) && s.documents.length < 3).forEach(s => {
      const missing = DOC_TYPES.filter(d => !s.documents.includes(d)).slice(0, 3)
      const moreCount = DOC_TYPES.filter(d => !s.documents.includes(d)).length - 3
      items.push({
        id: `docs-${s.id}`,
        category: 'urgent',
        icon: '📄',
        title: 'Missing Documents',
        body: `${s.firstName} ${s.lastName} is missing: ${missing.join(', ')}${moreCount > 0 ? ` +${moreCount} more` : ''}.`,
        action: `/students`,
        actionLabel: 'View Profile',
        studentId: s.id,
      })
    })

    // 3. Under Review for more than 7 days (info)
    students.filter(s => s.status === 'Under Review').forEach(s => {
      const days = daysSince(s.appDate)
      items.push({
        id: `review-${s.id}`,
        category: 'info',
        icon: '🔍',
        title: 'Under Review',
        body: `${s.firstName} ${s.lastName} (Grade ${s.grade ?? '?'}, ${s.campus ?? '—'}) has been under review for ${days} day${days !== 1 ? 's' : ''}.`,
        action: `/applications`,
        actionLabel: 'Make Decision',
        studentId: s.id,
      })
    })

    // 4. Waitlisted students (info)
    students.filter(s => s.status === 'Waitlisted').forEach(s => {
      items.push({
        id: `wait-${s.id}`,
        category: 'info',
        icon: '⏳',
        title: 'Student on Waitlist',
        body: `${s.firstName} ${s.lastName} (Grade ${s.grade ?? '?'}, ${s.campus ?? '—'}) is waitlisted.`,
        action: `/waitlist`,
        actionLabel: 'Promote to Accepted',
        studentId: s.id,
      })
    })

    // 5. Interview scheduled in next 7 days (urgent)
    const today = new Date().toISOString().slice(0, 10)
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    students.filter(s => s.intDate && s.intDate >= today && s.intDate <= in7).forEach(s => {
      items.push({
        id: `int-${s.id}`,
        category: 'urgent',
        icon: '🗓',
        title: 'Interview Upcoming',
        body: `${s.firstName} ${s.lastName} has an interview on ${s.intDate}.`,
        action: `/interviews`,
        actionLabel: 'View Profile',
        studentId: s.id,
      })
    })

    // 6. Enrolled without cohort (info) — batch
    const noCohort = students.filter(s => s.status === 'Enrolled' && !s.cohort)
    if (noCohort.length > 0) {
      items.push({
        id: 'no-cohort',
        category: 'info',
        icon: '👥',
        title: 'Students Without Cohort',
        body: `${noCohort.length} enrolled student${noCohort.length !== 1 ? 's are' : ' is'} not assigned to any cohort.`,
        action: `/cohorts`,
        actionLabel: 'Assign to Cohort',
      })
    }

    // 7. Accepted but not enrolled (>7 days) (info)
    students.filter(s => s.status === 'Accepted' && daysSince(s.appDate) > 7).forEach(s => {
      const days = daysSince(s.appDate)
      items.push({
        id: `acc-${s.id}`,
        category: 'info',
        icon: '✅',
        title: 'Accepted — Not Yet Enrolled',
        body: `${s.firstName} ${s.lastName} was accepted ${days} days ago but has not been enrolled.`,
        action: `/applications`,
        actionLabel: 'View Student',
        studentId: s.id,
      })
    })

    // 8. Unscored completed interviews (urgent)
    students.filter(s => s.intDate && s.intDate < today && s.intScore === null).forEach(s => {
      items.push({
        id: `score-${s.id}`,
        category: 'urgent',
        icon: '📊',
        title: 'Unscored Interview',
        body: `${s.firstName} ${s.lastName} had an interview on ${s.intDate} with no score recorded.`,
        action: `/interviews`,
        actionLabel: 'Score Interview',
        studentId: s.id,
      })
    })

    // 9. Urgent/High priority applicants (urgent)
    students.filter(s => s.status === 'Applied' && (s.priority === 'Urgent' || s.priority === 'High')).forEach(s => {
      items.push({
        id: `pri-${s.id}`,
        category: s.priority === 'Urgent' ? 'critical' : 'urgent',
        icon: '⚡',
        title: `${s.priority} Priority Application`,
        body: `${s.firstName} ${s.lastName} applied ${daysSince(s.appDate)} days ago with ${s.priority} priority.`,
        action: `/applications`,
        actionLabel: 'Review Now',
        studentId: s.id,
      })
    })

    return items
  }, [students])

  const visible = useMemo(() => {
    if (showDismissed) return alerts
    return alerts.filter(a => !dismissed.has(a.id))
  }, [alerts, dismissed, showDismissed])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]))
  }

  function dismissAll() {
    const next = new Set(alerts.map(a => a.id))
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]))
  }

  function restoreDismissed() {
    setDismissed(new Set())
    localStorage.removeItem(DISMISSED_KEY)
  }

  const criticalCount = alerts.filter(a => !dismissed.has(a.id) && a.category === 'critical').length
  const urgentCount = alerts.filter(a => !dismissed.has(a.id) && a.category === 'urgent').length
  const infoCount = alerts.filter(a => !dismissed.has(a.id) && a.category === 'info').length
  const activeCount = criticalCount + urgentCount + infoCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>🔔 Alerts & Notifications</h1>
          <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Auto-generated alerts based on student and admission data</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {dismissed.size > 0 && (
            <button onClick={restoreDismissed} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, cursor: 'pointer' }}>
              Restore {dismissed.size} dismissed
            </button>
          )}
          {activeCount > 0 && (
            <button onClick={dismissAll} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>
              Dismiss All
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total Active', val: activeCount, col: '#1A365E', bg: '#EEF3FF' },
          { label: 'Critical', val: criticalCount, col: '#D61F31', bg: '#FFF0F1' },
          { label: 'Urgent', val: urgentCount, col: '#B45309', bg: '#FFF6E0' },
          { label: 'Info', val: infoCount, col: '#0369A1', bg: '#E6F4FF' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px', background: s.bg, border: `1px solid ${s.col}22` }}>
            <div style={{ fontSize: 11, color: s.col, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: s.col, marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div style={{ ...card, padding: 48, textAlign: 'center', color: '#9EB3C8' }}>Analysing data…</div>
      ) : visible.length === 0 ? (
        <div style={{ ...card, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E' }}>All clear!</div>
          <div style={{ fontSize: 13, color: '#7A92B0', marginTop: 4 }}>No active alerts at this time.</div>
          {dismissed.size > 0 && (
            <button onClick={() => setShowDismissed(v => !v)} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>
              {showDismissed ? 'Hide dismissed' : `Show ${dismissed.size} dismissed`}
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(a => {
              const m = CATEGORY_META[a.category]
              const isDismissed = dismissed.has(a.id)
              return (
                <div key={a.id} style={{ ...card, padding: 0, overflow: 'hidden', opacity: isDismissed ? 0.5 : 1, background: m.bg, border: `1px solid ${m.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{a.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1A365E' }}>{a.title}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.7)', color: m.tc, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#4A6480', lineHeight: 1.5 }}>{a.body}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' }}>
                      {a.actionLabel && (
                        <button style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: m.tc, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {a.actionLabel}
                        </button>
                      )}
                      <button onClick={() => dismiss(a.id)} title="Dismiss" style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#7A92B0', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {dismissed.size > 0 && (
            <button onClick={() => setShowDismissed(v => !v)} style={{ alignSelf: 'center', padding: '8px 16px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>
              {showDismissed ? 'Hide dismissed' : `Show ${dismissed.size} dismissed alert${dismissed.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
