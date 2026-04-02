import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const STATUS_META: Record<string, { bg: string; tc: string }> = {
  'Turned In': { bg: '#E8FBF0', tc: '#0E6B3B' },
  'Missing':   { bg: '#FEE2E2', tc: '#991B1B' },
  'Late':      { bg: '#FFF3E0', tc: '#B45309' },
  'Assigned':  { bg: '#F3F4F6', tc: '#6B7280' },
}

interface Assignment { id: string; title: string; type: string; subject: string; dueDate: string; description: string; cohort: string }
interface Submission { assignment_id: string; status: string; submitted_date: string; late_reason: string }

export function SPAssignmentsPage() {
  const { session } = useStudentPortal()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!session) return
    async function load() {
      const [{ data: a }, { data: sub }] = await Promise.all([
        supabase.from('at_assignments').select('*').or(`cohort.eq.${session!.cohort},cohort.is.null`).order('due_date'),
        supabase.from('at_submissions').select('assignment_id,status,submitted_date,late_reason').eq('student_id', session!.dbId),
      ])
      if (a) setAssignments(a.map((r: Record<string, unknown>) => ({ id: r.id as string, title: r.title as string, type: (r.type as string) ?? '', subject: (r.subject as string) ?? '', dueDate: (r.due_date as string) ?? '', description: (r.description as string) ?? '', cohort: (r.cohort as string) ?? '' })))
      if (sub) setSubmissions(sub.map((r: Record<string, unknown>) => ({ assignment_id: r.assignment_id as string, status: r.status as string, submitted_date: (r.submitted_date as string) ?? '', late_reason: (r.late_reason as string) ?? '' })))
    }
    load()
  }, [session])

  const subMap = useMemo(() => Object.fromEntries(submissions.map(s => [s.assignment_id, s])), [submissions])

  const enriched = useMemo(() => assignments.map(a => ({ ...a, submission: subMap[a.id] ?? null, status: subMap[a.id]?.status ?? 'Assigned' })), [assignments, subMap])

  const filtered = useMemo(() => {
    let list = enriched
    if (filter !== 'All') list = list.filter(a => a.status === filter)
    if (search) list = list.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.subject.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [enriched, filter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    enriched.forEach(a => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [enriched])

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }
  const STATUSES = ['All', 'Assigned', 'Turned In', 'Missing', 'Late']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Assignments</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Your assignments and submission status</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total', value: enriched.length, color: '#1A365E' },
          { label: 'Submitted', value: counts['Turned In'] ?? 0, color: '#10B981' },
          { label: 'Pending', value: counts['Assigned'] ?? 0, color: '#3B82F6' },
          { label: 'Missing', value: (counts['Missing'] ?? 0) + (counts['Late'] ?? 0), color: '#D61F31' },
        ].map(c => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...iStyle, width: 180 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 12px', borderRadius: 7, border: filter === s ? '2px solid #1A365E' : '1.5px solid #E4EAF2', background: filter === s ? '#EEF3FF' : '#fff', color: filter === s ? '#1A365E' : '#7A92B0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(a => {
          const sm = STATUS_META[a.status] ?? STATUS_META.Assigned
          const d = new Date(a.dueDate)
          const overdue = d < new Date() && a.status === 'Assigned'
          return (
            <div key={a.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1A365E' }}>{a.title}</span>
                  <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: '#EEF3FF', color: '#1A365E' }}>{a.type}</span>
                </div>
                <div style={{ fontSize: 12, color: '#7A92B0' }}>{a.subject} · Due {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                {a.description && <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 4 }}>{a.description.slice(0, 80)}{a.description.length > 80 ? '…' : ''}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.tc }}>{a.status}</span>
                {overdue && <span style={{ fontSize: 10, color: '#D61F31', fontWeight: 600 }}>OVERDUE</span>}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>No assignments found.</div>}
      </div>
    </div>
  )
}
