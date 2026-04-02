import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const STATUS_META: Record<string, { bg: string; tc: string; label: string }> = {
  Present: { bg: '#E8FBF0', tc: '#0E6B3B', label: 'P' },
  Absent:  { bg: '#FEE2E2', tc: '#991B1B', label: 'A' },
  Late:    { bg: '#FFF3E0', tc: '#B45309', label: 'L' },
  Excused: { bg: '#E6F4FF', tc: '#0369A1', label: 'E' },
}

interface AttRecord { id: string; date: string; status: string }

export function SPAttendancePage() {
  const { session } = useStudentPortal()
  const [records, setRecords] = useState<AttRecord[]>([])

  useEffect(() => {
    if (!session) return
    supabase.from('attendance').select('id,date,status').eq('student_id', session.dbId).order('date', { ascending: false }).then(({ data }) => {
      if (data) setRecords(data.map((r: Record<string, unknown>) => ({ id: r.id as string, date: r.date as string, status: r.status as string })))
    })
  }, [session])

  const stats = useMemo(() => {
    const total = records.length
    const present = records.filter(r => r.status === 'Present').length
    const absent = records.filter(r => r.status === 'Absent').length
    const late = records.filter(r => r.status === 'Late').length
    const excused = records.filter(r => r.status === 'Excused').length
    const pct = total > 0 ? Math.round((present / total) * 100) : 0
    return { total, present, absent, late, excused, pct }
  }, [records])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Attendance</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Your attendance record for this academic year</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'Attendance Rate', value: `${stats.pct}%`, color: stats.pct >= 90 ? '#10B981' : stats.pct >= 75 ? '#F59E0B' : '#D61F31' },
          { label: 'Present', value: stats.present, color: '#10B981' },
          { label: 'Absent', value: stats.absent, color: '#D61F31' },
          { label: 'Late', value: stats.late, color: '#F59E0B' },
        ].map(c => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Overall Attendance</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: stats.pct >= 90 ? '#10B981' : '#F59E0B' }}>{stats.pct}%</span>
        </div>
        <div style={{ height: 10, background: '#E4EAF2', borderRadius: 5 }}>
          <div style={{ height: '100%', width: `${stats.pct}%`, background: stats.pct >= 90 ? '#10B981' : stats.pct >= 75 ? '#F59E0B' : '#D61F31', borderRadius: 5, transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 6 }}>
          {stats.total} school days recorded · Goal: 90%+
        </div>
      </div>

      {/* Log */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', fontSize: 14, fontWeight: 700, color: '#1A365E' }}>Attendance Log</div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F7F9FC' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', borderBottom: '1px solid #E4EAF2' }}>Date</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', borderBottom: '1px solid #E4EAF2' }}>Day</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', borderBottom: '1px solid #E4EAF2' }}>Status</th>
            </tr></thead>
            <tbody>
              {records.map(r => {
                const m = STATUS_META[r.status] ?? { bg: '#F3F4F6', tc: '#6B7280', label: r.status }
                const d = new Date(r.date)
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '8px 16px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ padding: '8px 16px', fontSize: 13, color: '#7A92B0', borderBottom: '1px solid #F0F4F8' }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px solid #F0F4F8' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: m.bg, color: m.tc }}>{r.status}</span>
                    </td>
                  </tr>
                )
              })}
              {records.length === 0 && <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
