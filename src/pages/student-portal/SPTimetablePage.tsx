import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, CalendarDays, CalendarClock, Radio, Book, MapPin, Circle, Link2, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)',
  overflow: 'hidden',
}

const SP_NAVY = '#1A365E'
const SP_RED = '#D61F31'
const SP_SLATE = '#7A92B0'

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: 28,
  color: SP_SLATE,
  fontSize: 12,
  background: '#F8FAFC',
  border: '1px dashed #D7E0EA',
  borderRadius: 10,
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERIODS = ['Block 1', 'Block 2', 'Block 3', 'Block 4', 'Block 5', 'Block 6', 'Block 7', 'Block 8']

const BLOCK_BG = ['#EEF3FF', '#D1FAE5', '#EDE9FE', '#FFF6E0', '#E6F4FF', '#FFF0F1']

interface TimetableBlock {
  id: string
  name: string
  day: string
  period: string
  time: string
  subject: string
  room: string
  sessionType: string
  meetLink: string
  coachId: string
  assignedToMe: boolean
}

function fmt12(hhmm: string): string {
  const [hStr, mStr] = (hhmm || '').split(':')
  const h = parseInt(hStr)
  if (Number.isNaN(h)) return hhmm || ''
  const min = parseInt(mStr) || 0
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`
}

function timeRange(time: string): string {
  const parts = (time || '').split('–').map(p => p.trim())
  if (parts.length === 2) return `${fmt12(parts[0])} – ${fmt12(parts[1])}`
  return fmt12(parts[0] || '')
}

function startMinutes(time: string): number {
  const [hStr, mStr] = ((time || '').split('–')[0]?.trim() || '').split(':')
  const h = parseInt(hStr)
  if (Number.isNaN(h)) return 9999
  return h * 60 + (parseInt(mStr) || 0)
}

function todayDayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' })
}

export function SPTimetablePage() {
  const { session } = useStudentPortal()
  const [blocks, setBlocks] = useState<TimetableBlock[]>([])
  const [coachNames, setCoachNames] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('timetable_blocks')
        .select('id,name,day,period,time,subject,room,session_type,meet_link,coach_id,cohort,student_ids')
        .or(`cohort.eq."${session!.cohort ?? ''}",student_ids.cs.{${session!.dbId}}`)
        .order('created_at', { ascending: true })
      if (cancelled) return

      const mapped: TimetableBlock[] = ((data as Record<string, unknown>[] | null) ?? []).map(row => ({
        id: row.id as string,
        name: (row.name as string) ?? '',
        day: (row.day as string) ?? '',
        period: (row.period as string) ?? '',
        time: (row.time as string) ?? '',
        subject: (row.subject as string) ?? '',
        room: (row.room as string) ?? '',
        sessionType: (row.session_type as string) ?? 'Live Session',
        meetLink: (row.meet_link as string) ?? '',
        coachId: (row.coach_id as string) ?? '',
        assignedToMe: Array.isArray(row.student_ids) && (row.student_ids as string[]).length > 0,
      }))
      setBlocks(mapped)
      setLoaded(true)

      const coachIds = [...new Set(mapped.map(b => b.coachId).filter(Boolean))]
      if (coachIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', coachIds)
        if (cancelled) return
        setCoachNames(Object.fromEntries(((profs as Record<string, unknown>[] | null) ?? []).map(p => [p.id as string, (p.full_name as string) || ''])))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [session])

  const today = todayDayName()

  // Which day columns / period rows actually have something — keep the grid compact.
  const activeDays = useMemo(() => {
    const set = new Set(blocks.map(b => b.day))
    return DAYS.filter(d => set.has(d))
  }, [blocks])

  const activePeriods = useMemo(() => {
    const set = new Set(blocks.map(b => b.period))
    return PERIODS.filter(p => set.has(p))
  }, [blocks])

  const colorFor = useMemo(() => {
    const map: Record<string, string> = {}
    const keys = [...new Set(blocks.map(b => b.subject || b.name || b.id))]
    keys.forEach((k, i) => { map[k] = BLOCK_BG[i % BLOCK_BG.length] })
    return map
  }, [blocks])

  const todayBlocks = useMemo(
    () => blocks.filter(b => b.day === today).sort((a, b) => startMinutes(a.time) - startMinutes(b.time)),
    [blocks, today],
  )

  function cellBlocks(day: string, period: string) {
    return blocks
      .filter(b => b.day === day && b.period === period)
      .sort((a, b) => startMinutes(a.time) - startMinutes(b.time))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 8 }}><CalendarRange size={18} /> My Timetable</div>
        <div style={{ fontSize: 12, color: SP_SLATE, marginTop: 2 }}>
          Your weekly class blocks{session?.cohort ? ` · ${session.cohort}` : ''}
        </div>
      </div>

      {/* Today */}
      <div style={{ ...card, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SP_NAVY, display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={13} /> Today · {today}</div>
          <div style={{ fontSize: 10, color: SP_SLATE }}>{todayBlocks.length} {todayBlocks.length === 1 ? 'class' : 'classes'}</div>
        </div>
        {!loaded ? (
          <div style={emptyState}>Loading your timetable…</div>
        ) : todayBlocks.length === 0 ? (
          <div style={emptyState}>No classes scheduled for today.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayBlocks.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 8, borderLeft: `4px solid ${b.sessionType === 'Live Session' ? SP_RED : '#7C3AED'}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: SP_SLATE, minWidth: 120, flexShrink: 0 }}>{timeRange(b.time) || b.period}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: SP_NAVY }}>
                    {b.name || b.subject || 'Class'}
                    {b.assignedToMe && <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', marginLeft: 6 }}>• for you</span>}
                  </div>
                  <div style={{ fontSize: 10, color: SP_SLATE, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {b.sessionType === 'Live Session'
                      ? <><Radio size={10} /> Live Session</>
                      : <><Book size={10} /> Self-Paced Mastery</>}
                    {b.room ? <>· <MapPin size={10} /> {b.room}</> : ''}
                    {coachNames[b.coachId] ? <>· <Circle size={8} fill="#16A34A" color="#16A34A" /> {coachNames[b.coachId]}</> : ''}
                  </div>
                </div>
                {b.sessionType === 'Live Session' && b.meetLink && (
                  <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ fontSize: 9, fontWeight: 800, background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: 6, textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Join</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly grid */}
      <div style={card}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock size={12} /> Weekly Overview</div>
        </div>
        {!loaded ? (
          <div style={{ padding: 18 }}><div style={emptyState}>Loading…</div></div>
        ) : blocks.length === 0 ? (
          <div style={{ padding: 18 }}><div style={emptyState}>You don't have any timetable blocks yet. Check back once your coach sets up your schedule.</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', background: '#F7F9FC', border: '1px solid #E4EAF2', fontSize: 10, color: SP_SLATE, textAlign: 'left', whiteSpace: 'nowrap' }}>Block</th>
                  {activeDays.map(d => (
                    <th key={d} style={{ padding: '8px 10px', background: d === today ? '#EEF3FF' : '#F7F9FC', border: '1px solid #E4EAF2', fontSize: 10, fontWeight: 800, color: d === today ? SP_NAVY : '#3D5475', textAlign: 'center' }}>
                      {d}{d === today ? ' •' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePeriods.map((per, pi) => (
                  <tr key={per} style={{ background: pi % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                    <td style={{ padding: '7px 12px', border: '1px solid #E4EAF2', fontWeight: 700, color: '#3D5475', whiteSpace: 'nowrap', fontSize: 10 }}>{per}</td>
                    {activeDays.map(day => {
                      const cell = cellBlocks(day, per)
                      return (
                        <td key={day} style={{ padding: 4, border: '1px solid #E4EAF2', verticalAlign: 'top', minWidth: 120, background: day === today ? 'rgba(238,243,255,.4)' : undefined }}>
                          {cell.map(b => (
                            <div key={b.id} style={{ background: colorFor[b.subject || b.name || b.id], borderRadius: 6, padding: '6px 8px', marginBottom: 3, border: '1px solid rgba(0,0,0,.06)' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: SP_NAVY }}>{b.name || b.subject || '—'}</div>
                              {b.time && <div style={{ fontSize: 9, color: '#5A6B85', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {timeRange(b.time)}</div>}
                              <div style={{ fontSize: 9, color: b.sessionType === 'Live Session' ? SP_RED : '#7C3AED', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                                {b.sessionType === 'Live Session' ? <><Radio size={9} /> Live</> : <><Book size={9} /> Self-Paced</>}
                              </div>
                              {b.room && <div style={{ fontSize: 9, color: SP_SLATE, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} /> {b.room}</div>}
                              {b.sessionType === 'Live Session' && b.meetLink && (
                                <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ fontSize: 9, fontWeight: 700, color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Link2 size={9} /> Join</a>
                              )}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
