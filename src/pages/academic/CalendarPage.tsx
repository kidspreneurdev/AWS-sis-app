import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

const EVENT_TYPES = ['Holiday', 'Exam', 'Meeting', 'Activity', 'Deadline', 'Other']
const TYPE_META: Record<string, { bg: string; tc: string; dot: string }> = {
  Holiday:  { bg: '#E8FBF0', tc: '#0E6B3B', dot: '#1DBD6A' },
  Exam:     { bg: '#FFF0F1', tc: '#D61F31', dot: '#D61F31' },
  Meeting:  { bg: '#E6F4FF', tc: '#0369A1', dot: '#0EA5E9' },
  Activity: { bg: '#F3EDFF', tc: '#6D28D9', dot: '#A36CFF' },
  Deadline: { bg: '#FFF6E0', tc: '#B45309', dot: '#F5A623' },
  Other:    { bg: '#F3F4F6', tc: '#374151', dot: '#7A92B0' },
}
interface CalEvent { id: string; title: string; date: string; endDate: string | null; type: string; description: string | null; campus: string | null }
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function toYMD(d: Date) { return d.toISOString().slice(0, 10) }

function EventModal({ event, onClose, onSave, onDelete }: { event: Partial<CalEvent>; onClose: () => void; onSave: (d: Omit<CalEvent,'id'>, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void> }) {
  const [form, setForm] = useState({ title: event.title ?? '', date: event.date ?? toYMD(new Date()), endDate: event.endDate ?? '', type: event.type ?? 'Activity', description: event.description ?? '', campus: event.campus ?? '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() {
    if (!form.title || !form.date) return; setSaving(true)
    await onSave({ title: form.title, date: form.date, endDate: form.endDate || null, type: form.type, description: form.description || null, campus: form.campus || null }, event.id)
    setSaving(false); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{event.id ? 'Edit Event' : 'Add Event'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>End Date</label><input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Type</label><select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Campus</label><input value={form.campus} onChange={e => set('campus', e.target.value)} placeholder="All campuses" style={inp} /></div>
          </div>
          <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between' }}>
          <div>{event.id && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(event.id!).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; event: Partial<CalEvent> | null }>({ open: false, event: null })
  const todayStr = toYMD(today)

  async function load() {
    const { data } = await supabase.from('calendar').select('*').order('date')
    if (data) setEvents(data.map((r: Record<string,unknown>) => ({ id: r.id as string, title: r.title as string, date: r.date as string, endDate: r.end_date as string | null, type: r.type as string, description: r.description as string | null, campus: r.campus as string | null })))
  }
  useEffect(() => { load() }, [])

  const calDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const last = new Date(viewYear, viewMonth + 1, 0)
    const days: (Date | null)[] = Array(first.getDay()).fill(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewYear, viewMonth, d))
    return days
  }, [viewYear, viewMonth])

  function eventsOn(ymd: string) { return events.filter(e => (!e.endDate ? e.date === ymd : e.date <= ymd && ymd <= e.endDate!)) }
  const sideEvents = selectedDate ? eventsOn(selectedDate) : events.filter(e => e.date >= todayStr).slice(0, 12)

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  async function saveEvent(data: Omit<CalEvent,'id'>, id?: string) {
    const p = { title: data.title, date: data.date, end_date: data.endDate, type: data.type, description: data.description, campus: data.campus }
    if (id) await supabase.from('calendar').update(p).eq('id', id); else await supabase.from('calendar').insert(p)
    await load()
  }
  async function deleteEvent(id: string) { await supabase.from('calendar').delete().eq('id', id); setEvents(prev => prev.filter(e => e.id !== id)) }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, event: { date: selectedDate ?? todayStr } })} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Event</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', cursor: 'pointer', fontSize: 16 }}>‹</button>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E' }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button onClick={nextMonth} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', cursor: 'pointer', fontSize: 16 }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#7A92B0', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>)}
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const ymd = toYMD(day); const de = eventsOn(ymd); const isToday = ymd === todayStr; const isSel = ymd === selectedDate
              return (
                <div key={ymd} onClick={() => setSelectedDate(isSel ? null : ymd)} style={{ minHeight: 52, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', background: isSel ? '#1A365E' : isToday ? '#FFF0F1' : '#fff', border: `1px solid ${isSel ? '#1A365E' : isToday ? '#D61F31' : '#F0F4F8'}`, transition: 'all 0.12s' }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isSel ? '#fff' : isToday ? '#D61F31' : '#1A365E', marginBottom: 3 }}>{day.getDate()}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {de.slice(0, 3).map(e => { const m = TYPE_META[e.type] ?? TYPE_META.Other; return <div key={e.id} style={{ width: 6, height: 6, borderRadius: '50%', background: isSel ? 'rgba(255,255,255,0.7)' : m.dot }} /> })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #F0F4F8' }}>
            {EVENT_TYPES.map(t => { const m = TYPE_META[t]; return <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7A92B0' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot }} />{t}</div> })}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E', marginBottom: 12 }}>{selectedDate ? selectedDate : 'Upcoming Events'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
            {sideEvents.length === 0 && <div style={{ fontSize: 13, color: '#7A92B0', textAlign: 'center', padding: 20 }}>No events.</div>}
            {sideEvents.map(e => {
              const m = TYPE_META[e.type] ?? TYPE_META.Other
              return (
                <div key={e.id} style={{ padding: '10px 12px', borderRadius: 10, background: m.bg, border: `1px solid ${m.dot}33`, cursor: 'pointer' }} onClick={() => setModal({ open: true, event: e })}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{e.title}</div>
                    <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.6)', color: m.tc, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{e.type}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 3 }}>{e.date}{e.endDate && e.endDate !== e.date ? ` → ${e.endDate}` : ''}{e.campus ? ` · ${e.campus}` : ''}</div>
                  {e.description && <div style={{ fontSize: 12, color: '#4A6480', marginTop: 4 }}>{e.description}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {modal.open && modal.event && <EventModal event={modal.event} onClose={() => setModal({ open: false, event: null })} onSave={saveEvent} onDelete={deleteEvent} />}
    </div></>
  )
}
