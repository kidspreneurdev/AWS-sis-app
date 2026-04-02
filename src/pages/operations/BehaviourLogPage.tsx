import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

const TYPES = [
  'Positive Recognition', 'Tardiness', 'Disruption', 'Conflict', 'Academic Concern',
  'Attendance', 'Policy Violation', 'Bullying/Harassment', 'Parent Contact',
  'Counselor Referral', 'Admin Referral', 'Suspension', 'Other',
]
const TYPE_META: Record<string, { bg: string; tc: string }> = {
  'Positive Recognition': { bg: '#E8FBF0', tc: '#0E6B3B' },
  'Tardiness':            { bg: '#FFF6E0', tc: '#B45309' },
  'Disruption':           { bg: '#FEF3C7', tc: '#92400E' },
  'Conflict':             { bg: '#FFF0F1', tc: '#D61F31' },
  'Academic Concern':     { bg: '#E6F4FF', tc: '#0369A1' },
  'Attendance':           { bg: '#F3EDFF', tc: '#6D28D9' },
  'Policy Violation':     { bg: '#FFF0F1', tc: '#991B1B' },
  'Bullying/Harassment':  { bg: '#FEE2E2', tc: '#7F1D1D' },
  'Parent Contact':       { bg: '#E8FBF0', tc: '#065F46' },
  'Counselor Referral':   { bg: '#E0F2FE', tc: '#0369A1' },
  'Admin Referral':       { bg: '#F1F0FF', tc: '#4338CA' },
  'Suspension':           { bg: '#1A365E', tc: '#fff' },
  'Other':                { bg: '#F3F4F6', tc: '#6B7280' },
}

interface BehaviourEntry {
  id: string; studentId: string; studentName: string; grade: string
  date: string; time: string; location: string; type: string; description: string
  actionTaken: string; followUp: boolean; staffMember: string; notes: string
}
interface Student { id: string; name: string; grade: string }

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const EMPTY = { studentId: '', date: new Date().toISOString().slice(0, 10), time: '', location: '', type: 'Disruption', description: '', actionTaken: '', followUp: false, staffMember: '', notes: '' }

function BehaviourModal({ entry, students, onClose, onSave, onDelete }: {
  entry: BehaviourEntry | null; students: Student[]
  onClose: () => void; onSave: (f: typeof EMPTY, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(entry ? { studentId: entry.studentId, date: entry.date, time: entry.time, location: entry.location, type: entry.type, description: entry.description, actionTaken: entry.actionTaken, followUp: entry.followUp, staffMember: entry.staffMember, notes: entry.notes } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.studentId || !form.description) return; setSaving(true); await onSave(form, entry?.id); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{entry ? 'Edit Entry' : 'Log Behaviour'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Student</label>
              <select value={form.studentId} onChange={e => set('studentId', e.target.value)} style={inp}>
                <option value="">Select…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Type</label><select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Time</label><input type="time" value={form.time} onChange={e => set('time', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Classroom 3B" style={inp} /></div>
          </div>
          <div><label style={lbl}>Description <span style={{ color: '#D61F31' }}>*</span></label><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div><label style={lbl}>Action Taken</label><textarea value={form.actionTaken} onChange={e => set('actionTaken', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Recorded By</label><input value={form.staffMember} onChange={e => set('staffMember', e.target.value)} style={inp} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#1A365E', fontWeight: 600 }}>
                <input type="checkbox" checked={form.followUp} onChange={e => set('followUp', e.target.checked)} style={{ width: 16, height: 16 }} />
                Follow-up Required
              </label>
            </div>
          </div>
          <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>{entry && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(entry.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BehaviourLogPage() {
  const [entries, setEntries] = useState<BehaviourEntry[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState(''); const [filterType, setFilterType] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; entry: BehaviourEntry | null }>({ open: false, entry: null })

  async function load() {
    const [{ data: logs }, { data: studs }] = await Promise.all([
      supabase.from('behaviour_log').select('*').order('date', { ascending: false }),
      supabase.from('students').select('id,first_name,last_name,grade').eq('status', 'Enrolled'),
    ])
    if (studs) setStudents(studs.map((s: Record<string, unknown>) => ({ id: s.id as string, name: `${s.first_name} ${s.last_name}`, grade: s.grade as string })))
    if (logs && studs) {
      const sMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, `${s.first_name} ${s.last_name}` as string]))
      const gMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, s.grade as string]))
      setEntries(logs.map((r: Record<string, unknown>) => ({
        id: r.id as string, studentId: r.student_id as string,
        studentName: sMap.get(r.student_id as string) ?? '—',
        grade: gMap.get(r.student_id as string) ?? '—',
        date: (r.date as string) ?? '', time: (r.time as string) ?? '',
        location: (r.location as string) ?? '',
        type: (r.type as string) ?? 'Disruption',
        description: (r.description as string) ?? '', actionTaken: (r.action_taken as string) ?? '',
        followUp: (r.follow_up as boolean) ?? false,
        staffMember: (r.staff_member as string) ?? '', notes: (r.notes as string) ?? '',
      })))
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter(e => {
      if (filterType !== 'All' && e.type !== filterType) return false
      if (q && !e.studentName.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, search, filterType])

  const thisMonth = useMemo(() => {
    const key = new Date().toISOString().slice(0, 7)
    return entries.filter(e => e.date.startsWith(key)).length
  }, [entries])
  const uniqueStudents = useMemo(() => new Set(entries.map(e => e.studentId)).size, [entries])

  async function saveEntry(form: typeof EMPTY, id?: string) {
    const payload = { student_id: form.studentId, date: form.date, time: form.time || null, location: form.location || null, type: form.type, description: form.description, action_taken: form.actionTaken, follow_up: form.followUp, staff_member: form.staffMember, notes: form.notes }
    if (id) { await supabase.from('behaviour_log').update(payload).eq('id', id); toast('Entry updated', 'ok') }
    else { await supabase.from('behaviour_log').insert(payload); toast('Entry logged', 'ok') }
    await load()
  }
  async function deleteEntry(id: string) { await supabase.from('behaviour_log').delete().eq('id', id); setEntries(prev => prev.filter(e => e.id !== id)); toast('Entry deleted', 'ok') }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, entry: null })} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Log Entry</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Entries', value: entries.length, color: '#1A365E' },
          { label: 'This Month', value: thisMonth, color: '#D61F31' },
          { label: 'Unique Students', value: uniqueStudents, color: '#0EA5E9' },
          { label: 'Follow-up Pending', value: entries.filter(e => e.followUp).length, color: '#D97706' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or description…" style={{ ...iStyle, width: 260 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={iStyle}><option value="All">All Types</option>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} entries</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Date</th><th style={th}>Student</th><th style={th}>Grade</th>
            <th style={th}>Type</th><th style={th}>Description</th><th style={th}>Action Taken</th><th style={th}>Follow-up</th><th style={th}>Staff</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((e, i) => { const m = TYPE_META[e.type] ?? TYPE_META['Other']; return (
              <tr key={e.id}
                onClick={() => setModal({ open: true, entry: e })}
                style={{ cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                onMouseEnter={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                onMouseLeave={ev => { (ev.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC' }}
              >
                <td style={{ ...td, color: '#7A92B0' }}>{e.date}{e.time ? ` ${e.time}` : ''}</td>
                <td style={{ ...td, fontWeight: 600 }}>{e.studentName}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{e.grade}</td>
                <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 12, fontWeight: 600 }}>{e.type}</span></td>
                <td style={{ ...td, color: '#7A92B0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                <td style={{ ...td, color: '#7A92B0', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.actionTaken || '—'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{e.followUp ? <span style={{ color: '#D97706', fontWeight: 700, fontSize: 12 }}>⚠ Yes</span> : <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{e.staffMember || '—'}</td>
                <td style={td} onClick={ev => ev.stopPropagation()}><button onClick={() => setModal({ open: true, entry: e })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            )})}
            {filtered.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No behaviour entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && <BehaviourModal entry={modal.entry} students={students} onClose={() => setModal({ open: false, entry: null })} onSave={saveEntry} onDelete={deleteEntry} />}
    </div></>
  )
}
