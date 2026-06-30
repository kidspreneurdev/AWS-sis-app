import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const NAVY = '#1A365E'
const RED = '#D61F31'
const GOLD = '#FAC600'
const GREEN = '#16A34A'

interface AttRow { id: string; date: string; status: string }

function attColor(status: string) {
  if (status === 'Present' || status === 'Remote') return { bg: '#DCFCE7', border: '#22C55E', text: GREEN, icon: '✅' }
  if (status === 'Absent') return { bg: '#FEE2E2', border: '#F87171', text: RED, icon: '❌' }
  if (status === 'Late') return { bg: '#FEF3C7', border: '#FAC600', text: '#92400E', icon: '⏰' }
  if (status === 'Excused') return { bg: '#E0F2FE', border: '#38BDF8', text: '#0369A1', icon: '📋' }
  return { bg: '#F1F5F9', border: '#CBD5E1', text: '#64748B', icon: '—' }
}

function rateColor(rate: number) {
  if (rate >= 95) return GREEN
  if (rate >= 85) return GOLD
  return RED
}

function rateMessage(rate: number) {
  if (rate >= 95) return { text: 'Outstanding! Keep it up! 🌟', bg: '#DCFCE7', color: '#166534' }
  if (rate >= 85) return { text: 'Good job! Try to come every day! 😊', bg: '#FEF3C7', color: '#92400E' }
  return { text: 'We miss you in class! 💪', bg: '#FEE2E2', color: '#991B1B' }
}

function buildCalendar(year: number, month: number, records: AttRow[]) {
  const dateMap = Object.fromEntries(records.map(r => [r.date, r.status]))
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: Array<{ day: number | null; status: string | null; isToday: boolean; isFuture: boolean }> = []

  // Fill leading blanks (Mon = 0, shift from Sun-first to Mon-first)
  const startOffset = (firstDay + 6) % 7
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, status: null, isToday: false, isFuture: false })

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(year, month, d).getDay()
    const isWeekend = dow === 0 || dow === 6
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
    const isFuture = new Date(year, month, d) > today
    cells.push({ day: d, status: isWeekend ? 'Weekend' : (dateMap[dateStr] ?? (isFuture ? null : null)), isToday, isFuture })
  }

  return cells
}

export function K5AttendancePage() {
  const { session } = useStudentPortal()
  const [records, setRecords] = useState<AttRow[]>([])
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  useEffect(() => {
    if (!session) return
    supabase
      .from('attendance')
      .select('id,date,status')
      .eq('student_id', session.dbId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setRecords(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            date: (r.date as string) ?? '',
            status: (r.status as string) ?? '',
          })))
        }
      })
  }, [session])

  const stats = useMemo(() => {
    const present = records.filter(r => r.status === 'Present' || r.status === 'Remote').length
    const absent = records.filter(r => r.status === 'Absent').length
    const late = records.filter(r => r.status === 'Late').length
    const rate = records.length ? Math.round((present / records.length) * 100) : 0
    return { present, absent, late, rate }
  }, [records])

  const calendarCells = useMemo(() => buildCalendar(viewYear, viewMonth, records), [viewYear, viewMonth, records])

  const recentRecords = records.slice(0, 8)
  const msg = rateMessage(stats.rate)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    const now = new Date()
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📅 Attendance</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 14 }}>How often you come to school</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Rate', value: `${stats.rate}%`, color: rateColor(stats.rate) },
            { label: 'Days Present', value: String(stats.present), color: GREEN },
            { label: 'Days Absent', value: String(stats.absent), color: stats.absent > 0 ? RED : GREEN },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Encouragement message */}
      <div style={{ background: msg.bg, borderRadius: 12, padding: '12px 16px', border: `1.5px solid ${rateColor(stats.rate)}40` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: msg.color }}>{msg.text}</div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>◀</button>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{monthName}</div>
          <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 14 }}>▶</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
          {['M', 'T', 'W', 'T', 'F', 'Sa', 'Su'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#94A3B8', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {calendarCells.map((cell, i) => {
            if (!cell.day) return <div key={i} />
            const isWeekend = cell.status === 'Weekend'
            const col = cell.status && !isWeekend ? attColor(cell.status) : null
            return (
              <div key={i} style={{
                aspectRatio: '1',
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                background: cell.isToday ? NAVY : col ? col.bg : isWeekend ? '#F1F5F9' : '#FAFAFA',
                color: cell.isToday ? '#fff' : col ? col.text : '#CBD5E1',
                border: cell.isToday ? `2px solid ${NAVY}` : col ? `1px solid ${col.border}40` : '1px solid transparent',
              }}>
                {cell.day}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {[
            { label: 'Present', bg: '#DCFCE7', border: '#22C55E' },
            { label: 'Absent', bg: '#FEE2E2', border: '#F87171' },
            { label: 'Late', bg: '#FEF3C7', border: '#FAC600' },
            { label: 'Weekend', bg: '#F1F5F9', border: '#CBD5E1' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1px solid ${l.border}` }} />
              <span style={{ fontSize: 10, color: '#64748B' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent records */}
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>Recent Attendance</div>
        {recentRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94A3B8', fontSize: 12 }}>No attendance records yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentRecords.map(r => {
              const col = attColor(r.status)
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: col.bg, borderRadius: 9 }}>
                  <span style={{ fontSize: 16 }}>{col.icon}</span>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: NAVY }}>
                    {new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: col.text }}>{r.status}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
