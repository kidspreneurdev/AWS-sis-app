import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type Student, fullName, STATUS_META } from '@/types/student'

// ─── Types ────────────────────────────────────────────────────────────────────

interface S360Data {
  attendance: { date: string; status: string; note: string | null }[]
  behaviour: { id: string; type: string; severity: string; date: string; description: string; action: string | null }[]
  comms: { id: string; type: string; subject: string; direction: string; sentAt: string | null; sentBy: string | null; body: string | null }[]
  fees: { id: string; type: string; amount: number; currency: string; dueDate: string | null; status: string; reference: string | null }[]
  wellness: { id: string; date: string; energy: number; mood: number; stress: number; focus: number; note: string | null }[]
  grades: { id: string; course: string; area: string; credits: number; grade: string; status: string; year: string | null; semester: string | null }[]
  counselorNotes: string | null
}

const TABS = [
  { k: 'overview',   l: 'Overview' },
  { k: 'academic',   l: 'Academic' },
  { k: 'attendance', l: 'Attendance' },
  { k: 'behaviour',  l: 'Behaviour' },
  { k: 'wellness',   l: 'Wellbeing' },
  { k: 'financial',  l: 'Financial' },
  { k: 'comms',      l: 'Comms' },
  { k: 'profile',    l: 'Profile' },
]

const SEV_META: Record<string, { bg: string; tc: string }> = {
  Low:      { bg: '#FEF3C7', tc: '#B45309' },
  Medium:   { bg: '#FFE4B5', tc: '#D97706' },
  High:     { bg: '#FEE2E2', tc: '#D61F31' },
  Critical: { bg: '#450A0A', tc: '#FCA5A5' },
}

const ATT_META: Record<string, { bg: string; tc: string; label: string }> = {
  P: { bg: '#E8FBF0', tc: '#0E6B3B', label: 'Present' },
  A: { bg: '#FFF0F1', tc: '#D61F31', label: 'Absent' },
  T: { bg: '#FFF6E0', tc: '#B45309', label: 'Tardy' },
  E: { bg: '#E6F4FF', tc: '#0369A1', label: 'Excused' },
  R: { bg: '#F3EDFF', tc: '#A36CFF', label: 'Remote' },
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: 11, color: '#7A92B0', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#1A365E', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 6 }}>
      {children}
    </div>
  )
}

// ─── Search Screen ────────────────────────────────────────────────────────────

function SearchScreen({ students, onSelect }: { students: Student[]; onSelect: (s: Student) => void }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    if (!q.trim()) return students
    const lq = q.toLowerCase()
    return students.filter(s =>
      fullName(s).toLowerCase().includes(lq) ||
      s.studentId.toLowerCase().includes(lq) ||
      String(s.grade ?? '').includes(lq) ||
      (s.cohort ?? '').toLowerCase().includes(lq)
    )
  }, [students, q])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Student 360°</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>
          Holistic student view — select a student to explore all their data
        </p>
      </div>
      <div style={{ maxWidth: 480 }}>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name, student ID, grade, cohort…"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #E4EAF2', fontSize: 14, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {filtered.map(s => {
          const initials = [s.firstName, s.lastName].filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
          const meta = STATUS_META[s.status]
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s)}
              style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 14, transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(26,54,94,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(26,54,94,0.06)' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#1A365E,#0369A1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                {initials || '?'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(s)}</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                  {s.grade != null ? `Grade ${s.grade}` : '—'}{s.cohort ? ` · ${s.cohort}` : ''}
                </div>
                <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 10, background: meta.bg, color: meta.tc, fontSize: 10, fontWeight: 700 }}>
                  {s.status}
                </span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#7A92B0', padding: 40, fontSize: 13 }}>
            No students found
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView({ student, data, activeTab, setActiveTab, onBack }: {
  student: Student
  data: S360Data | null
  activeTab: string
  setActiveTab: (t: string) => void
  onBack: () => void
}) {
  const initials = [student.firstName, student.lastName].filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const sMeta = STATUS_META[student.status]

  const attPresent = (data?.attendance ?? []).filter(a => a.status === 'P' || a.status === 'E' || a.status === 'R').length
  const attTotal = (data?.attendance ?? []).length
  const attRate = attTotal ? Math.round((attPresent / attTotal) * 100) : null

  const totalFees = (data?.fees ?? []).reduce((s, f) => s + f.amount, 0)
  const paidFees = (data?.fees ?? []).filter(f => f.status === 'Paid').reduce((s, f) => s + f.amount, 0)
  const outstanding = (data?.fees ?? []).filter(f => f.status !== 'Paid' && f.status !== 'Waived').reduce((s, f) => s + f.amount, 0)

  const avgWellness = (data?.wellness ?? []).length
    ? (data!.wellness.reduce((s, w) => s + (w.mood + w.energy + w.focus) / 3, 0) / data!.wellness.length).toFixed(1)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#0F2240,#1A365E)', color: '#fff', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>
            {initials || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{fullName(student)}</div>
              <span style={{ padding: '3px 12px', borderRadius: 20, background: sMeta.bg, color: sMeta.tc, fontSize: 12, fontWeight: 700 }}>{student.status}</span>
            </div>
            <div style={{ fontSize: 13, color: '#9EB3C8', marginTop: 4 }}>
              {student.studentId}
              {student.grade != null ? ` · Grade ${student.grade}` : ''}
              {student.cohort ? ` · ${student.cohort}` : ''}
              {student.campus ? ` · ${student.campus}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                🔍 Search
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Attendance', val: attRate != null ? `${attRate}%` : '—', color: attRate != null && attRate < 80 ? '#F87171' : '#86EFAC' },
              { label: 'Behaviour', val: String((data?.behaviour ?? []).length), color: '#FCD34D' },
              { label: 'Wellness', val: avgWellness ?? '—', color: '#93C5FD' },
              { label: 'Outstanding', val: outstanding > 0 ? `$${outstanding.toLocaleString()}` : '$0', color: outstanding > 0 ? '#F87171' : '#86EFAC' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', minWidth: 80 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                <div style={{ fontSize: 10, color: '#9EB3C8', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {!data && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ fontSize: 14, color: '#7A92B0' }}>Loading student data…</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {data && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '2px solid #E4EAF2', paddingBottom: 0 }}>
            {TABS.map(t => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                style={{
                  padding: '8px 14px', borderRadius: '8px 8px 0 0', border: 'none',
                  background: activeTab === t.k ? '#1A365E' : 'transparent',
                  color: activeTab === t.k ? '#fff' : '#7A92B0',
                  fontWeight: activeTab === t.k ? 700 : 400, fontSize: 13,
                  cursor: 'pointer', marginBottom: -2, borderBottom: activeTab === t.k ? '2px solid #1A365E' : '2px solid transparent',
                }}
              >
                {t.l}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {/* Overview */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.counselorNotes && (
                  <div style={card}>
                    <SectionTitle>Counselor Notes</SectionTitle>
                    <div style={{ fontSize: 13, color: '#1A365E', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.counselorNotes}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  <div style={card}>
                    <SectionTitle>Recent Behaviour</SectionTitle>
                    {data.behaviour.slice(0, 4).map(b => {
                      const sm = SEV_META[b.severity] ?? { bg: '#F3F4F6', tc: '#6B7280' }
                      return (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F0F4F8' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1A365E' }}>{b.type}</div>
                            <div style={{ fontSize: 11, color: '#7A92B0' }}>{b.date}</div>
                          </div>
                          <span style={{ padding: '2px 8px', borderRadius: 8, background: sm.bg, color: sm.tc, fontSize: 10, fontWeight: 700 }}>{b.severity}</span>
                        </div>
                      )
                    })}
                    {data.behaviour.length === 0 && <div style={{ fontSize: 12, color: '#7A92B0', padding: '8px 0' }}>No incidents on record</div>}
                  </div>
                  <div style={card}>
                    <SectionTitle>Recent Communications</SectionTitle>
                    {data.comms.slice(0, 4).map(c => (
                      <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #F0F4F8' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A365E' }}>{c.subject || '(No subject)'}</div>
                        <div style={{ fontSize: 11, color: '#7A92B0' }}>{c.type} · {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</div>
                      </div>
                    ))}
                    {data.comms.length === 0 && <div style={{ fontSize: 12, color: '#7A92B0', padding: '8px 0' }}>No communications on record</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Academic */}
            {activeTab === 'academic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #E4EAF2', fontWeight: 700, color: '#1A365E' }}>Grades & Courses</div>
                  {data.grades.length === 0 ? (
                    <div style={{ padding: 24, color: '#7A92B0', fontSize: 13 }}>No grade records found</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#F7F9FC' }}>
                        <th style={th}>Course</th><th style={th}>Area</th><th style={th}>Credits</th>
                        <th style={th}>Grade</th><th style={th}>Status</th><th style={th}>Year</th>
                      </tr></thead>
                      <tbody>
                        {data.grades.map((g, i) => (
                          <tr key={g.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{g.course}</td>
                            <td style={{ ...td, color: '#7A92B0' }}>{g.area || '—'}</td>
                            <td style={td}>{g.credits}</td>
                            <td style={{ ...td, fontWeight: 700, color: parseFloat(g.grade) >= 3 ? '#059669' : parseFloat(g.grade) >= 2 ? '#B45309' : '#D61F31' }}>{g.grade}</td>
                            <td style={td}>{g.status || '—'}</td>
                            <td style={{ ...td, color: '#7A92B0' }}>{g.year || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Attendance */}
            {activeTab === 'attendance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(ATT_META).map(([k, v]) => {
                    const count = data.attendance.filter(a => a.status === k).length
                    return (
                      <div key={k} style={{ ...card, flex: 1, minWidth: 100, background: v.bg, border: 'none' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: v.tc, textTransform: 'uppercase' }}>{v.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: v.tc, marginTop: 4 }}>{count}</div>
                      </div>
                    )
                  })}
                  {attRate != null && (
                    <div style={{ ...card, flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#1A365E', textTransform: 'uppercase' }}>Rate</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: attRate >= 80 ? '#059669' : '#D61F31', marginTop: 4 }}>{attRate}%</div>
                    </div>
                  )}
                </div>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #E4EAF2', fontWeight: 700, color: '#1A365E' }}>Attendance Log</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F7F9FC' }}>
                      <th style={th}>Date</th><th style={th}>Status</th><th style={th}>Note</th>
                    </tr></thead>
                    <tbody>
                      {data.attendance.slice(0, 50).map((a, i) => {
                        const am = ATT_META[a.status] ?? { bg: '#F3F4F6', tc: '#6B7280', label: a.status }
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <td style={td}>{a.date}</td>
                            <td style={td}>
                              <span style={{ padding: '2px 10px', borderRadius: 10, background: am.bg, color: am.tc, fontSize: 11, fontWeight: 700 }}>{am.label}</span>
                            </td>
                            <td style={{ ...td, color: '#7A92B0' }}>{a.note || '—'}</td>
                          </tr>
                        )
                      })}
                      {data.attendance.length === 0 && (
                        <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 24 }}>No attendance records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Behaviour */}
            {activeTab === 'behaviour' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { label: 'Total', val: data.behaviour.length, col: '#1A365E' },
                    { label: 'Serious', val: data.behaviour.filter(b => b.severity === 'High' || b.severity === 'Critical').length, col: '#D61F31' },
                  ].map(c => (
                    <div key={c.label} style={{ ...card, flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: c.col, marginTop: 6 }}>{c.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F7F9FC' }}>
                      <th style={th}>Date</th><th style={th}>Type</th><th style={th}>Severity</th>
                      <th style={th}>Description</th><th style={th}>Action</th>
                    </tr></thead>
                    <tbody>
                      {data.behaviour.map((b, i) => {
                        const sm = SEV_META[b.severity] ?? { bg: '#F3F4F6', tc: '#6B7280' }
                        return (
                          <tr key={b.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{b.date}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{b.type}</td>
                            <td style={td}>
                              <span style={{ padding: '2px 8px', borderRadius: 8, background: sm.bg, color: sm.tc, fontSize: 11, fontWeight: 700 }}>{b.severity}</span>
                            </td>
                            <td style={{ ...td, color: '#7A92B0', maxWidth: 260 }}>{b.description}</td>
                            <td style={{ ...td, color: '#7A92B0' }}>{b.action || '—'}</td>
                          </tr>
                        )
                      })}
                      {data.behaviour.length === 0 && (
                        <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 24 }}>No incidents on record</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Wellness */}
            {activeTab === 'wellness' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.wellness.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {(['energy', 'mood', 'stress', 'focus'] as const).map(dim => {
                      const avg = (data.wellness.reduce((s, w) => s + w[dim], 0) / data.wellness.length).toFixed(1)
                      return (
                        <div key={dim} style={{ ...card, flex: 1, minWidth: 100 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase' }}>{dim}</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#1A365E', marginTop: 4 }}>{avg}<span style={{ fontSize: 12, color: '#7A92B0' }}>/5</span></div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F7F9FC' }}>
                      <th style={th}>Date</th><th style={th}>Energy</th><th style={th}>Mood</th>
                      <th style={th}>Stress</th><th style={th}>Focus</th><th style={th}>Note</th>
                    </tr></thead>
                    <tbody>
                      {data.wellness.map((w, i) => (
                        <tr key={w.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                          <td style={td}>{w.date}</td>
                          {(['energy', 'mood', 'stress', 'focus'] as const).map(dim => (
                            <td key={dim} style={{ ...td, fontWeight: 700, color: w[dim] >= 4 ? '#059669' : w[dim] >= 3 ? '#B45309' : '#D61F31' }}>{w[dim]}</td>
                          ))}
                          <td style={{ ...td, color: '#7A92B0' }}>{w.note || '—'}</td>
                        </tr>
                      ))}
                      {data.wellness.length === 0 && (
                        <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 24 }}>No wellness records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial */}
            {activeTab === 'financial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total Billed', val: `$${totalFees.toLocaleString()}`, col: '#1A365E' },
                    { label: 'Paid', val: `$${paidFees.toLocaleString()}`, col: '#059669' },
                    { label: 'Outstanding', val: `$${outstanding.toLocaleString()}`, col: outstanding > 0 ? '#D61F31' : '#059669' },
                  ].map(c => (
                    <div key={c.label} style={{ ...card, flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.col, marginTop: 6 }}>{c.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F7F9FC' }}>
                      <th style={th}>Type</th><th style={th}>Amount</th><th style={th}>Due Date</th>
                      <th style={th}>Status</th><th style={th}>Reference</th>
                    </tr></thead>
                    <tbody>
                      {data.fees.map((f, i) => {
                        const overdue = f.dueDate && new Date(f.dueDate) < new Date() && f.status !== 'Paid' && f.status !== 'Waived'
                        return (
                          <tr key={f.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <td style={{ ...td, fontWeight: 600 }}>{f.type}</td>
                            <td style={td}>{f.currency} {f.amount.toLocaleString()}</td>
                            <td style={{ ...td, color: overdue ? '#D61F31' : '#7A92B0' }}>{f.dueDate ?? '—'}{overdue ? ' ⚠️' : ''}</td>
                            <td style={td}>
                              <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                background: f.status === 'Paid' ? '#E8FBF0' : f.status === 'Waived' ? '#F3EDFF' : '#FEE2E2',
                                color: f.status === 'Paid' ? '#0E6B3B' : f.status === 'Waived' ? '#7C3AED' : '#D61F31',
                              }}>{f.status}</span>
                            </td>
                            <td style={{ ...td, color: '#7A92B0' }}>{f.reference || '—'}</td>
                          </tr>
                        )
                      })}
                      {data.fees.length === 0 && (
                        <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 24 }}>No fee records</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Comms */}
            {activeTab === 'comms' && (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#F7F9FC' }}>
                    <th style={th}>Date</th><th style={th}>Type</th><th style={th}>Subject</th>
                    <th style={th}>Direction</th><th style={th}>Sent by</th><th style={th}>Body</th>
                  </tr></thead>
                  <tbody>
                    {data.comms.map((c, i) => (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                        <td style={td}>{c.type}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{c.subject || '—'}</td>
                        <td style={td}>
                          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            background: c.direction === 'Outbound' ? '#E6F4FF' : '#E8FBF0',
                            color: c.direction === 'Outbound' ? '#0369A1' : '#0E6B3B',
                          }}>{c.direction || '—'}</span>
                        </td>
                        <td style={{ ...td, color: '#7A92B0' }}>{c.sentBy || '—'}</td>
                        <td style={{ ...td, color: '#7A92B0', maxWidth: 240 }}>{c.body ? c.body.slice(0, 100) + (c.body.length > 100 ? '…' : '') : '—'}</td>
                      </tr>
                    ))}
                    {data.comms.length === 0 && (
                      <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 24 }}>No communications on record</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Profile */}
            {activeTab === 'profile' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div style={card}>
                  <SectionTitle>Personal</SectionTitle>
                  <InfoRow label="Student ID" value={student.studentId} />
                  <InfoRow label="Date of Birth" value={student.dob} />
                  <InfoRow label="Gender" value={student.gender} />
                  <InfoRow label="Nationality" value={student.nationality} />
                  <InfoRow label="Language" value={student.lang} />
                  <InfoRow label="Blood Group" value={student.bloodGroup} />
                  <InfoRow label="Address" value={student.address} />
                </div>
                <div style={card}>
                  <SectionTitle>Academic</SectionTitle>
                  <InfoRow label="Grade" value={student.grade != null ? String(student.grade) : null} />
                  <InfoRow label="Cohort" value={student.cohort} />
                  <InfoRow label="Campus" value={student.campus} />
                  <InfoRow label="Status" value={student.status} />
                  <InfoRow label="Student Type" value={student.studentType} />
                  <InfoRow label="Enroll Date" value={student.enrollDate} />
                  <InfoRow label="Year Joined" value={student.yearJoined} />
                  <InfoRow label="Grade Joined" value={student.gradeWhenJoined != null ? String(student.gradeWhenJoined) : null} />
                  <InfoRow label="Prev. School" value={student.prevSchool} />
                  <InfoRow label="Prior GPA" value={student.priorGpa} />
                  <InfoRow label="IEP" value={student.iep} />
                </div>
                <div style={card}>
                  <SectionTitle>Family & Contact</SectionTitle>
                  <InfoRow label="Parent/Guardian" value={student.parent} />
                  <InfoRow label="Relation" value={student.relation} />
                  <InfoRow label="Email" value={student.email} />
                  <InfoRow label="Phone" value={student.phone} />
                  <InfoRow label="EC Contact" value={student.ecName} />
                  <InfoRow label="EC Phone" value={student.ecPhone} />
                </div>
                {(student.allergy || student.meds || student.physician || student.healthNotes) && (
                  <div style={card}>
                    <SectionTitle>Health</SectionTitle>
                    <InfoRow label="Allergies" value={student.allergy} />
                    <InfoRow label="Medications" value={student.meds} />
                    <InfoRow label="Physician" value={student.physician} />
                    <InfoRow label="Physician Phone" value={student.physicianPhone} />
                    <InfoRow label="Health Notes" value={student.healthNotes} />
                  </div>
                )}
                {student.status === 'Alumni' && (
                  <div style={card}>
                    <SectionTitle>Alumni</SectionTitle>
                    <InfoRow label="Year Graduated" value={student.yearGraduated} />
                    <InfoRow label="Post-Secondary" value={student.postSecondary} />
                    <InfoRow label="Distinction" value={student.gradDistinction} />
                    <InfoRow label="Alumni Notes" value={student.alumniNotes} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Student360Page() {
  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student | null>(null)
  const [data, setData] = useState<S360Data | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Load enrolled+alumni students once
  useState(() => {
    supabase.from('students').select('*').in('status', ['Enrolled', 'Alumni']).order('first_name')
      .then(({ data: rows }) => {
        if (rows) setStudents(rows.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          studentId: (r.student_id as string) ?? '',
          firstName: (r.first_name as string) ?? '',
          lastName: (r.last_name as string) ?? '',
          dob: typeof r.dob === 'string' ? r.dob : null,
          gender: (r.gender as Student['gender']) ?? null,
          nationality: (r.nationality as string) ?? null,
          lang: (r.lang as string) ?? null,
          grade: typeof r.grade === 'number' ? r.grade : null,
          status: (r.status as Student['status']) ?? 'Enrolled',
          campus: (r.campus as string) ?? null,
          cohort: (r.cohort as string) ?? null,
          studentType: (r.student_type as Student['studentType']) ?? 'Existing',
          appDate: typeof r.app_date === 'string' ? r.app_date : null,
          enrollDate: typeof r.enroll_date === 'string' ? r.enroll_date : null,
          yearJoined: typeof r.year_joined === 'string' ? r.year_joined : null,
          yearGraduated: typeof r.year_graduated === 'string' ? r.year_graduated : null,
          gradeWhenJoined: typeof r.grade_when_joined === 'number' ? r.grade_when_joined : null,
          priority: (r.priority as Student['priority']) ?? 'Normal',
          prevSchool: (r.prev_school as string) ?? null,
          priorGpa: (r.prior_gpa as string) ?? null,
          iep: (r.iep as string) ?? null,
          email: (r.email as string) ?? null,
          phone: (r.phone as string) ?? null,
          parent: (r.parent as string) ?? null,
          relation: (r.relation as string) ?? null,
          ecName: (r.ec_name as string) ?? null,
          ecPhone: (r.ec_phone as string) ?? null,
          address: (r.address as string) ?? null,
          bloodGroup: (r.blood_group as string) ?? null,
          allergy: (r.allergy as string) ?? null,
          meds: (r.meds as string) ?? null,
          physician: (r.physician as string) ?? null,
          physicianPhone: (r.physician_phone as string) ?? null,
          healthNotes: (r.health_notes as string) ?? null,
          notes: (r.notes as string) ?? null,
          counselorNotes: (r.counselor_notes as string) ?? null,
          documents: Array.isArray(r.documents) ? r.documents as string[] : [],
          intDate: typeof r.int_date === 'string' ? r.int_date : null,
          intTime: typeof r.int_time === 'string' ? r.int_time : null,
          intViewer: (r.int_viewer as string) ?? null,
          intScore: typeof r.int_score === 'number' ? r.int_score : null,
          intNotes: (r.int_notes as string) ?? null,
          intCommittee: (r.int_committee as string) ?? null,
          decDate: typeof r.dec_date === 'string' ? r.dec_date : null,
          decNotes: (r.dec_notes as string) ?? null,
          postSecondary: (r.post_secondary as string) ?? null,
          gradDistinction: (r.grad_distinction as string) ?? null,
          alumniNotes: (r.alumni_notes as string) ?? null,
          createdAt: (r.created_at as string) ?? '',
          updatedAt: (r.updated_at as string) ?? '',
        })))
        setLoading(false)
      })
  })

  async function loadStudentData(s: Student) {
    setSelected(s)
    setData(null)
    setActiveTab('overview')

    const [attRes, bhRes, comRes, feeRes, welRes, graRes] = await Promise.all([
      supabase.from('attendance').select('date,status,note').eq('student_id', s.id).order('date', { ascending: false }).limit(120),
      supabase.from('behaviour_log').select('id,type,severity,date,description,action_taken').eq('student_id', s.id).order('date', { ascending: false }).limit(50),
      supabase.from('communications').select('id,type,subject,direction,sent_at,sent_by,body').eq('student_id', s.id).order('sent_at', { ascending: false }).limit(50),
      supabase.from('fees').select('id,type,amount,currency,due_date,status,reference').eq('student_id', s.id).order('due_date', { ascending: false }),
      supabase.from('wellness').select('id,date,energy,mood,stress,focus,note').eq('student_id', s.id).order('date', { ascending: false }).limit(30),
      supabase.from('student_grades').select('id,course,area,credits,grade,status,year,semester').eq('student_id', s.id),
    ])

    setData({
      attendance: (attRes.data ?? []).map((r: Record<string, unknown>) => ({
        date: (r.date as string) ?? '', status: (r.status as string) ?? 'P', note: (r.note as string) ?? null,
      })),
      behaviour: (bhRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, type: (r.type as string) ?? '', severity: (r.severity as string) ?? 'Low',
        date: (r.date as string) ?? '', description: (r.description as string) ?? '', action: (r.action_taken as string) ?? null,
      })),
      comms: (comRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, type: (r.type as string) ?? '', subject: (r.subject as string) ?? '',
        direction: (r.direction as string) ?? '', sentAt: (r.sent_at as string) ?? null,
        sentBy: (r.sent_by as string) ?? null, body: (r.body as string) ?? null,
      })),
      fees: (feeRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, type: (r.type as string) ?? '', amount: typeof r.amount === 'number' ? r.amount : 0,
        currency: (r.currency as string) ?? 'USD', dueDate: (r.due_date as string) ?? null,
        status: (r.status as string) ?? 'Pending', reference: (r.reference as string) ?? null,
      })),
      wellness: (welRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, date: (r.date as string) ?? '',
        energy: typeof r.energy === 'number' ? r.energy : 0,
        mood: typeof r.mood === 'number' ? r.mood : 0,
        stress: typeof r.stress === 'number' ? r.stress : 0,
        focus: typeof r.focus === 'number' ? r.focus : 0,
        note: (r.note as string) ?? null,
      })),
      grades: (graRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, course: (r.course as string) ?? '', area: (r.area as string) ?? '',
        credits: typeof r.credits === 'number' ? r.credits : 0, grade: String(r.grade ?? ''),
        status: (r.status as string) ?? '', year: (r.year as string) ?? null, semester: (r.semester as string) ?? null,
      })),
      counselorNotes: s.counselorNotes,
    })
  }

  // Auto-select from ?id= URL param (set by global search)
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && !selected && students.length > 0) {
      const s = students.find(st => st.id === id)
      if (s) loadStudentData(s)
    }
  }, [searchParams, students, selected])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!selected) {
    return <SearchScreen students={students} onSelect={loadStudentData} />
  }

  return (
    <ProfileView
      student={selected}
      data={data}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onBack={() => { setSelected(null); setData(null) }}
    />
  )
}
