import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)',
  padding: 20,
}

const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_GREEN = '#1DBD6A'
const SP_GOLD = '#FAC600'
const SP_BLUE = '#0EA5E9'
const SP_SLATE = '#7A92B0'

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: 20,
  color: SP_SLATE,
  fontSize: 12,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  borderRadius: 10,
}

interface AttRecord {
  id: string
  date: string
  status: string
}

function statusCode(status: string) {
  if (status === 'Present') return 'P'
  if (status === 'Remote') return 'R'
  if (status === 'Absent') return 'A'
  if (status === 'Late') return 'T'
  if (status === 'Excused') return 'E'
  return ''
}

function attendanceColor(rate: number) {
  return rate >= 95 ? SP_GREEN : rate >= 85 ? SP_GOLD : SP_RED
}

export function SPAttendancePage() {
  const { session } = useStudentPortal()
  const [records, setRecords] = useState<AttRecord[]>([])

  useEffect(() => {
    if (!session) return
    supabase
      .from('attendance')
      .select('id,date,status')
      .eq('student_id', session.dbId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setRecords(
            data.map((row: Record<string, unknown>) => ({
              id: row.id as string,
              date: (row.date as string) ?? '',
              status: (row.status as string) ?? '',
            })),
          )
        }
      })
  }, [session])

  const stats = useMemo(() => {
    const present = records.filter((row) => row.status === 'Present' || row.status === 'Remote').length
    const absent = records.filter((row) => row.status === 'Absent').length
    const tardy = records.filter((row) => row.status === 'Late').length
    const excused = records.filter((row) => row.status === 'Excused').length
    const rate = records.length ? Math.round((present / records.length) * 100) : 0
    return { present, absent, tardy, excused, rate, total: records.length }
  }, [records])

  const byMonth = useMemo(() => {
    const grouped: Record<string, Record<string, string>> = {}
    records.forEach((row) => {
      if (!row.date) return
      const monthKey = row.date.slice(0, 7)
      if (!grouped[monthKey]) grouped[monthKey] = {}
      grouped[monthKey][row.date] = statusCode(row.status)
    })
    return grouped
  }, [records])

  const months = useMemo(() => Object.keys(byMonth).sort().slice(-3), [byMonth])

  const statCols: Record<string, string> = {
    P: SP_GREEN,
    R: SP_BLUE,
    A: SP_RED,
    T: SP_GOLD,
    E: SP_SLATE,
    '': '#F0F4FA',
  }

  const statLabels: Record<string, string> = {
    P: 'Present',
    R: 'Remote',
    A: 'Absent',
    T: 'Tardy',
    E: 'Excused',
    '': 'Not Recorded',
  }

  const rateColor = attendanceColor(stats.rate)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const fill = (circumference * stats.rate) / 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY }}>📅 My Attendance</div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: SP_SLATE, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Attendance Rate
          </div>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="#E4EAF2" strokeWidth="12" />
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={rateColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${fill.toFixed(1)} ${circumference.toFixed(1)}`}
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="74" textAnchor="middle" fontSize="28" fontWeight="900" fill={rateColor} fontFamily="Arial">
              {stats.rate}%
            </text>
            <text x="80" y="92" textAnchor="middle" fontSize="11" fill={SP_SLATE} fontFamily="Arial">
              {stats.total} days recorded
            </text>
          </svg>
          {stats.rate < 90 && (
            <div style={{ fontSize: 10, color: SP_RED, fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
              ⚠️ Below 90% threshold
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
          {[
            { label: 'Present', value: stats.present, color: SP_GREEN, icon: '✅' },
            { label: 'Absent', value: stats.absent, color: SP_RED, icon: '❌' },
            { label: 'Tardy', value: stats.tardy, color: SP_GOLD, icon: '⏰' },
            { label: 'Excused', value: stats.excused, color: SP_SLATE, icon: '📋' },
          ].map((item) => (
            <div key={item.label} style={{ ...card, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: SP_SLATE, fontWeight: 600 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {months.length === 0 ? (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>📅 Attendance Calendar</div>
          <div style={emptyState}>No attendance records are available from Supabase for this section yet.</div>
        </div>
      ) : (
        months.map((monthKey) => {
          const monthData = byMonth[monthKey]
          const label = new Date(`${monthKey}-02`).toLocaleString('en-US', { month: 'long', year: 'numeric' })
          const firstDay = new Date(`${monthKey}-01`).getDay()
          const daysInMonth = new Date(Number.parseInt(monthKey.slice(0, 4), 10), Number.parseInt(monthKey.slice(5, 7), 10), 0).getDate()

          return (
            <div key={monthKey} style={{ ...card, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, marginBottom: 12 }}>📅 {label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: SP_SLATE, padding: '4px 0' }}>
                    {day}
                  </div>
                ))}

                {Array.from({ length: firstDay }).map((_, index) => <div key={`pad-${monthKey}-${index}`} />)}

                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const dayNumber = index + 1
                  const dateStr = `${monthKey}-${String(dayNumber).padStart(2, '0')}`
                  const status = monthData[dateStr] || ''
                  const color = statCols[status] || '#F0F4FA'
                  const isWeekend = [0, 6].includes(new Date(dateStr).getDay())

                  if (isWeekend) {
                    return (
                      <div key={dateStr} style={{ textAlign: 'center', padding: '6px 0' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: '#F7F9FC', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#C0C0C0' }}>
                          {dayNumber}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={dateStr} title={`${dateStr}${status ? ` — ${statLabels[status]}` : ''}`} style={{ textAlign: 'center', padding: '6px 0' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: color, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: status ? '#fff' : '#9EB3C8' }}>
                        {dayNumber}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {Object.keys(statLabels).filter((key) => key).map((key) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: statCols[key] }} />
                    <span style={{ fontSize: 9, color: SP_SLATE }}>{statLabels[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
