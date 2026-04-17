import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawStudent {
  id: string
  status: string
  grade: string | null
  campus: string | null
  app_date: string | null
  created_at: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

const STATUS_COLORS: Record<string, string> = {
  Inquiry:       '#7040CC',
  Applied:       '#0EA5E9',
  'Under Review':'#F5A623',
  Accepted:      '#1DBD6A',
  Enrolled:      '#0369A1',
  Waitlisted:    '#1FD6C4',
  Denied:        '#D61F31',
  Withdrawn:     '#7A92B0',
  Alumni:        '#FAC600',
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, color }: { data: { label: string; value: number; color?: string }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: '#7A92B0', textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, height: 22, background: '#F0F4F8', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 6,
              width: `${(d.value / max) * 100}%`,
              background: d.color ?? color ?? '#1A365E',
              transition: 'width 0.4s ease',
              minWidth: d.value > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: '#1A365E', flexShrink: 0 }}>{d.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Donut ────────────────────────────────────────────────────────────────────
function DonutChart({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0
  const dash = pct * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="#E4EAF2" strokeWidth={12} />
        <circle
          cx={50} cy={50} r={r} fill="none"
          stroke={color} strokeWidth={12}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={50} textAnchor="middle" dy="0.35em" fontSize={16} fontWeight={800} fill="#1A365E">
          {total > 0 ? `${Math.round(pct * 100)}%` : '—'}
        </text>
      </svg>
      <div style={{ fontSize: 12, color: '#7A92B0', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#1A365E', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const [students, setStudents] = useState<RawStudent[]>([])

  useEffect(() => {
    supabase.from('students')
      .select('id,status,grade,campus,app_date,created_at')
      .then(({ data, error }) => {
        if (!error && data) { setStudents(data); return }
        // Fallback: app_date column may not exist yet
        void supabase.from('students')
          .select('id,status,grade,campus,created_at')
          .then(({ data: d2 }) => {
            if (d2) setStudents(d2.map(r => ({ ...r, app_date: null })))
          })
      })
  }, [])

  // Status distribution (normalize display label)
  const byStatus = useMemo(() => {
    const map = new Map<string, number>()
    students.forEach(s => {
      const raw = s.status ?? 'Unknown'
      // Capitalize for consistent display
      const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      map.set(label, (map.get(label) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? '#7A92B0' }))
      .sort((a, b) => b.value - a.value)
  }, [students])

  // Grade distribution
  const byGrade = useMemo(() => {
    const map = new Map<string, number>()
    students.forEach(s => { if (s.grade) map.set(String(s.grade), (map.get(String(s.grade)) ?? 0) + 1) })
    return Array.from(map.entries())
      .sort((a, b) => {
        const order = ['-1', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
        return order.indexOf(a[0]) - order.indexOf(b[0])
      })
      .map(([label, value]) => ({ label: label === '-1' ? 'Pre-K' : label === '0' ? 'K' : `G${label}`, value }))
  }, [students])

  // Campus distribution
  const byCampus = useMemo(() => {
    const map = new Map<string, number>()
    students.forEach(s => map.set(s.campus ?? 'Unknown', (map.get(s.campus ?? 'Unknown') ?? 0) + 1))
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [students])

  // Monthly applications (last 12 months)
  const monthlyApps = useMemo(() => {
    const now = new Date()
    const months: { label: string; key: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) })
    }
    const map = new Map<string, number>()
    students.forEach(s => {
      const m = (s.app_date ?? s.created_at ?? '').slice(0, 7)
      map.set(m, (map.get(m) ?? 0) + 1)
    })
    return months.map(({ key, label }) => ({ label, value: map.get(key) ?? 0 }))
  }, [students])

  // KPIs (case-insensitive status matching)
  const norm = (s: string | null) => (s ?? '').toLowerCase().trim()
  const total = students.length
  const enrolled = students.filter(s => norm(s.status) === 'enrolled').length
  const accepted = students.filter(s => norm(s.status) === 'accepted' || norm(s.status) === 'enrolled').length
  const applied = students.filter(s => norm(s.status) !== 'inquiry').length
  const acceptRate = applied > 0 ? Math.round((accepted / applied) * 100) : 0
  const enrollRate = accepted > 0 ? Math.round((enrolled / accepted) * 100) : 0
  const inReview = students.filter(s => norm(s.status) === 'under review' || norm(s.status) === 'applied').length
  const waitlisted = students.filter(s => norm(s.status) === 'waitlisted').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Admissions Analytics</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Overview of the admissions pipeline</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard label="Total Applications" value={total} />
        <StatCard label="Enrolled" value={enrolled} color="#0369A1" />
        <StatCard label="Acceptance Rate" value={`${acceptRate}%`} color="#1DBD6A" />
        <StatCard label="Enrollment Rate" value={`${enrollRate}%`} color="#1DBD6A" sub="of accepted" />
        <StatCard label="In Review" value={inReview} color="#F5A623" />
        <StatCard label="Waitlisted" value={waitlisted} color="#1FD6C4" />
      </div>

      {/* Donuts row */}
      <div style={{ ...card }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 20 }}>Pipeline Rates</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'space-around' }}>
          <DonutChart value={accepted} total={applied} color="#1DBD6A" label="Acceptance Rate" />
          <DonutChart value={enrolled} total={accepted} color="#0369A1" label="Enrollment Rate" />
          <DonutChart value={students.filter(s => s.status === 'Denied').length} total={applied} color="#D61F31" label="Denial Rate" />
          <DonutChart value={waitlisted} total={applied} color="#1FD6C4" label="Waitlist Rate" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* By Status */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Applications by Status</div>
          <BarChart data={byStatus} />
        </div>

        {/* By Grade */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Applications by Grade</div>
          <BarChart data={byGrade} color="#1A365E" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Monthly trend */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>Monthly Applications (Last 12 Months)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
            {monthlyApps.map(m => {
              const max = Math.max(...monthlyApps.map(x => x.value), 1)
              const h = Math.round((m.value / max) * 120)
              return (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: '#1A365E', fontWeight: 600 }}>{m.value || ''}</div>
                  <div style={{
                    width: '100%', height: h || 3, background: m.value > 0 ? '#D61F31' : '#E4EAF2',
                    borderRadius: '4px 4px 0 0', transition: 'height 0.3s',
                  }} />
                  <div style={{ fontSize: 9, color: '#7A92B0', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Campus */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }}>By Campus</div>
          <BarChart data={byCampus} color="#D61F31" />
          {byCampus.length === 0 && <div style={{ color: '#7A92B0', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No data</div>}
        </div>
      </div>
    </div>
  )
}
