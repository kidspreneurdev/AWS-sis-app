import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type CommType = 'Email' | 'Call' | 'SMS' | 'Meeting' | 'Letter'

const COMM_TYPES: CommType[] = ['Email', 'Call', 'SMS', 'Meeting', 'Letter']

const TYPE_META: Record<CommType, { bg: string; tc: string; icon: string }> = {
  Email:   { bg: '#E6F4FF', tc: '#0369A1', icon: '✉️' },
  Call:    { bg: '#E8FBF0', tc: '#0E6B3B', icon: '📞' },
  SMS:     { bg: '#F3EDFF', tc: '#6D28D9', icon: '💬' },
  Meeting: { bg: '#FFF6E0', tc: '#B45309', icon: '🤝' },
  Letter:  { bg: '#F3F4F6', tc: '#374151', icon: '📄' },
}

interface CommRecord {
  id: string
  studentId: string
  studentName: string
  type: CommType
  subject: string
  body: string | null
  sentBy: string | null
  sentAt: string
}

type CommSchema = 'legacy' | 'modern'

const EMPTY_FORM = {
  studentId: '', type: 'Email' as CommType,
  subject: '', body: '', sentBy: '',
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Add Modal ────────��───────────────────────────────────────────────────────
function AddCommModal({ students, onClose, onSave, defaultSentBy }: {
  students: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: typeof EMPTY_FORM) => Promise<boolean>
  defaultSentBy: string
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, sentBy: defaultSentBy })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.studentId || !form.subject) return
    setSaving(true)
    const ok = await onSave(form)
    setSaving(false)
    if (ok) onClose()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Log Communication</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Student</label>
            <select value={form.studentId} onChange={e => set('studentId', e.target.value)} style={inp}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>
                {COMM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Sent By</label><input value={form.sentBy} onChange={e => set('sentBy', e.target.value)} placeholder="Staff name" style={inp} /></div>
          </div>
          <div><label style={lbl}>Subject</label><input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Subject / topic" style={inp} /></div>
          <div><label style={lbl}>Details</label><textarea value={form.body} onChange={e => set('body', e.target.value)} rows={4} placeholder="Summary of the communication…" style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Log'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function CommunicationsPage() {
  const { profile } = useAuthStore()
  const [comms, setComms] = useState<CommRecord[]>([])
  const [commSchema, setCommSchema] = useState<CommSchema>('modern')
  const [stuList, setStuList] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  function normalizeCommType(value: unknown): CommType {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (v === 'email') return 'Email'
    if (v === 'call' || v === 'phone') return 'Call'
    if (v === 'sms' || v === 'text') return 'SMS'
    if (v === 'meeting') return 'Meeting'
    if (v === 'letter' || v === 'mail') return 'Letter'
    return 'Letter'
  }

  async function detectCommSchema(): Promise<CommSchema> {
    const { error } = await supabase.from('communications').select('id,sent_at').limit(1)
    if (!error) return 'modern'
    return (error.message ?? '').toLowerCase().includes('sent_at') ? 'legacy' : 'modern'
  }

  async function load() {
    const schema = await detectCommSchema()
    setCommSchema(schema)

    const [stuRes, commRes] = await Promise.all([
      supabase.from('students').select('id,first_name,last_name'),
      supabase.from('communications').select('*'),
    ])
    if (stuRes.error) {
      toast(stuRes.error.message || 'Failed to load students', 'err')
      return
    }
    if (commRes.error) {
      toast(commRes.error.message || 'Failed to load communications', 'err')
      return
    }
    const stus = (stuRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: `${r.first_name} ${r.last_name}`,
    }))
    setStuList(stus)
    const stuMap = Object.fromEntries(stus.map(s => [s.id, s.name]))
    const mapped = (commRes.data ?? []).map((r: Record<string, unknown>) => {
      const subject = schema === 'modern'
        ? (r.subject as string | undefined)
        : (r.outcome as string | undefined)
      const body = schema === 'modern'
        ? (r.body as string | null | undefined)
        : (r.notes as string | null | undefined)
      const sentBy = schema === 'modern'
        ? (r.sent_by as string | null | undefined)
        : (r.staff_member as string | null | undefined)
      const sentAtRaw = schema === 'modern'
        ? (r.sent_at as string | undefined)
        : (r.date as string | undefined)
      return {
        id: r.id as string,
        studentId: r.student_id as string,
        studentName: stuMap[r.student_id as string] ?? 'Unknown',
        type: normalizeCommType(r.type),
        subject: (subject && subject.trim()) || 'Untitled communication',
        body: body ?? null,
        sentBy: sentBy ?? null,
        sentAt: sentAtRaw || (r.created_at as string) || new Date().toISOString(),
      }
    })
    mapped.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    setComms(mapped)
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => comms.filter(c => {
    if (search && !c.studentName.toLowerCase().includes(search.toLowerCase()) && !c.subject.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType !== 'All' && c.type !== filterType) return false
    return true
  }), [comms, search, filterType])

  async function saveComm(data: typeof EMPTY_FORM): Promise<boolean> {
    const payload = commSchema === 'modern'
      ? {
        student_id: data.studentId,
        type: data.type,
        subject: data.subject,
        body: data.body || null,
        sent_by: data.sentBy || null,
        sent_at: new Date().toISOString(),
      }
      : {
        student_id: data.studentId,
        type: data.type,
        outcome: data.subject,
        notes: data.body || data.subject,
        staff_member: data.sentBy || null,
        date: new Date().toISOString().slice(0, 10),
      }

    const { error } = await supabase.from('communications').insert(payload)
    if (error) {
      toast(error.message || 'Failed to log communication', 'err')
      return false
    }
    await load()
    toast('Communication logged', 'ok')
    return true
  }

  async function deleteComm(id: string) {
    if (!confirm('Delete this communication log?')) return
    const { error } = await supabase.from('communications').delete().eq('id', id)
    if (error) {
      toast(error.message || 'Failed to delete communication', 'err')
      return
    }
    setComms(prev => prev.filter(c => c.id !== id))
    toast('Communication deleted', 'ok')
  }

  const byType = useMemo(() => {
    const map = new Map<CommType, number>()
    comms.forEach(c => map.set(c.type, (map.get(c.type) ?? 0) + 1))
    return map
  }, [comms])

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModalOpen(true)} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Log Communication</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Type summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {COMM_TYPES.map(t => {
          const m = TYPE_META[t]
          const count = byType.get(t) ?? 0
          return (
            <div key={t} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 120 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.tc }}>{count}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student or subject…" style={{ ...iStyle, width: 260 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={iStyle}>
          <option value="All">All Types</option>
          {COMM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} records</span>
      </div>

      {/* Log list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(c => {
          const m = TYPE_META[c.type]
          const isExpanded = expanded === c.id
          return (
            <div key={c.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => setExpanded(isExpanded ? null : c.id)}
              >
                <div style={{ width: 38, height: 38, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1A365E' }}>{c.subject}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 11, fontWeight: 600 }}>{c.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>
                    {c.studentName} {c.sentBy ? `· via ${c.sentBy}` : ''} · {timeAgo(c.sentAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); deleteComm(c.id) }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 11, cursor: 'pointer' }}>Del</button>
                  <span style={{ fontSize: 12, color: '#BDD0E8', alignSelf: 'center' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>
              {isExpanded && c.body && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F0F4F8' }}>
                  <div style={{ paddingTop: 12, fontSize: 13, color: '#4A6480', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  <div style={{ fontSize: 11, color: '#BDD0E8', marginTop: 8 }}>{new Date(c.sentAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>No communications logged yet.</div>
        )}
      </div>

      {modalOpen && (
        <AddCommModal
          students={stuList}
          onClose={() => setModalOpen(false)}
          onSave={saveComm}
          defaultSentBy={profile?.full_name ?? ''}
        />
      )}
    </div></>
  )
}
