import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/lib/toast'

interface AuditRow {
  id: string
  timestamp: string
  actor: string
  actorRole: string
  module: string
  entityLabel: string
  entityType: string
  entityId: string
  action: string
  changeType: string
  before: string
  after: string
}

interface AuditFilter {
  module: string
  actor: string
  change: string
  search: string
  from: string
  to: string
}

const PAGE_SIZE = 50
const CHANGE_TYPES = ['', 'create', 'update', 'delete', 'login', 'logout', 'access']

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,.06)',
}

function asString(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try { return JSON.stringify(v) } catch { return '' }
}

function normalizeAuditRow(r: Record<string, unknown>): AuditRow {
  return {
    id: asString(r.id || r.log_id || `${asString(r.timestamp || r.created_at)}-${asString(r.actor || r.user_email)}`),
    timestamp: asString(r.timestamp || r.created_at || ''),
    actor: asString(r.actor || r.user_email || r.username || ''),
    actorRole: asString(r.actorRole || r.actor_role || r.user_role || ''),
    module: asString(r.module || r.module_name || ''),
    entityLabel: asString(r.entityLabel || r.entity_label || r.record_label || ''),
    entityType: asString(r.entityType || r.entity_type || r.table_name || ''),
    entityId: asString(r.entityId || r.entity_id || r.record_id || ''),
    action: asString(r.action || r.operation || ''),
    changeType: asString(r.changeType || r.change_type || r.type || ''),
    before: asString(r.before || r.before_data || r.old_values || ''),
    after: asString(r.after || r.after_data || r.new_values || ''),
  }
}

function moduleIcon(mod: string) {
  const icons: Record<string, string> = {
    Students: '👤',
    Grades: '📊',
    Health: '🏥',
    Behaviour: '⚠️',
    Fees: '💰',
    Auth: '🔐',
    Users: '👥',
    Documents: '📄',
    LMS: '📚',
    AssignmentTracker: '📋',
    Communications: '💬',
    Attendance: '📅',
    Badges: '🏆',
    Goals: '🎯',
    AuditLog: '🔍',
    Students360: '👁️',
  }
  return icons[mod] ?? '📂'
}

function changeColor(ct: string) {
  return ct === 'delete' ? '#D61F31'
    : ct === 'create' ? '#059669'
      : ct === 'login' || ct === 'logout' ? '#7C3AED'
        : ct === 'access' ? '#0891B2'
          : '#D97706'
}

function changeBg(ct: string) {
  return ct === 'delete' ? '#FEE2E2'
    : ct === 'create' ? '#DCFCE7'
      : ct === 'login' || ct === 'logout' ? '#EDE9FE'
        : ct === 'access' ? '#E0F2FE'
          : '#FEF3C7'
}

function fmtTimestamp(ts: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
}

function fmtJsonPreview(v: string, max = 120) {
  const t = v.trim()
  if (!t || t === '{}' || t === 'null') return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

async function fetchAuditRows() {
  const fromAuditLog = await supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(1000)
  if (!fromAuditLog.error) return fromAuditLog.data ?? []
  const fromAuditLogs = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(1000)
  if (!fromAuditLogs.error) return fromAuditLogs.data ?? []
  throw fromAuditLogs.error ?? fromAuditLog.error
}

export function AuditLogPage() {
  const profile = useAuthStore(s => s.profile)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState<AuditFilter>({ module: '', actor: '', change: '', search: '', from: '', to: '' })

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter(prev => ({ ...prev, search: searchInput }))
      setPage(0)
    }, 280)
    return () => clearTimeout(timer)
  }, [searchInput])

  async function load() {
    setBusy(true)
    try {
      const data = await fetchAuditRows()
      setRows((data as Record<string, unknown>[]).map(normalizeAuditRow))
      setTableMissing(false)
    } catch {
      setRows([])
      setTableMissing(true)
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const modules = useMemo(() => {
    const vals = Array.from(new Set(rows.map(r => r.module).filter(Boolean)))
    return ['', ...vals.sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const actors = useMemo(() => {
    const vals = Array.from(new Set(rows.map(r => r.actor).filter(Boolean)))
    return ['', ...vals.sort((a, b) => a.localeCompare(b))]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter.module && r.module !== filter.module) return false
      if (filter.actor && r.actor !== filter.actor) return false
      if (filter.change && r.changeType !== filter.change) return false
      if (filter.from) {
        const t = new Date(r.timestamp).getTime()
        if (Number.isNaN(t) || t < new Date(filter.from).getTime()) return false
      }
      if (filter.to) {
        const t = new Date(r.timestamp).getTime()
        if (Number.isNaN(t) || t > new Date(`${filter.to}T23:59:59`).getTime()) return false
      }
      if (filter.search) {
        const q = filter.search.toLowerCase()
        return r.actor.toLowerCase().includes(q)
          || r.action.toLowerCase().includes(q)
          || r.entityLabel.toLowerCase().includes(q)
          || r.entityType.toLowerCase().includes(q)
          || r.module.toLowerCase().includes(q)
          || r.after.toLowerCase().includes(q)
      }
      return true
    })
  }, [rows, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayCount = rows.filter(r => r.timestamp.slice(0, 10) === todayStr).length
  const deleteCount = filtered.filter(r => r.changeType === 'delete').length
  const uniqueActors = new Set(rows.map(r => r.actor).filter(Boolean)).size

  const activeFilters = [
    filter.module ? { key: 'module' as const, label: `Module: ${filter.module}` } : null,
    filter.actor ? { key: 'actor' as const, label: `Actor: ${filter.actor}` } : null,
    filter.change ? { key: 'change' as const, label: `Type: ${filter.change}` } : null,
    filter.search ? { key: 'search' as const, label: `Search: "${filter.search}"` } : null,
    filter.from ? { key: 'from' as const, label: `From: ${filter.from}` } : null,
    filter.to ? { key: 'to' as const, label: `To: ${filter.to}` } : null,
  ].filter(Boolean) as { key: keyof AuditFilter; label: string }[]

  function setFilterField<K extends keyof AuditFilter>(key: K, value: AuditFilter[K]) {
    setFilter(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }

  function clearAll() {
    setFilter({ module: '', actor: '', change: '', search: '', from: '', to: '' })
    setSearchInput('')
    setPage(0)
  }

  async function refresh() {
    await load()
    if (!tableMissing) toast('Audit log refreshed', 'ok')
  }

  if (profile?.role !== 'admin') {
    return <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0' }}>⛔ Admin access required.</div>
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#7A92B0' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>Loading Audit Log…</div>
    </div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>🔍 Audit Log</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Complete tamper-evident trail of every change — WASC / FERPA compliant</div>
        </div>
        <button onClick={() => void refresh()} disabled={busy} style={{ padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'Total Records', val: rows.length.toLocaleString(), col: '#1A365E', bg: '#EEF3FF' },
          { label: "Today's Events", val: todayCount, col: '#059669', bg: '#DCFCE7' },
          { label: 'Active Users', val: uniqueActors, col: '#7C3AED', bg: '#EDE9FE' },
          { label: 'Deletions (filtered)', val: deleteCount, col: '#D61F31', bg: '#FEE2E2' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.col }}>{k.val}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: k.col, textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Search</label>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="actor, action, entity…" style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Module</label>
            <select value={filter.module} onChange={e => setFilterField('module', e.target.value)} style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12 }}>
              {modules.map(m => <option key={m} value={m}>{m || 'All modules'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Actor</label>
            <select value={filter.actor} onChange={e => setFilterField('actor', e.target.value)} style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12 }}>
              {actors.map(a => <option key={a} value={a}>{a || 'All actors'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>Type</label>
            <select value={filter.change} onChange={e => setFilterField('change', e.target.value)} style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12 }}>
              {CHANGE_TYPES.map(ch => <option key={ch} value={ch}>{ch || 'All types'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>From</label>
            <input type="date" value={filter.from} onChange={e => setFilterField('from', e.target.value)} style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 4 }}>To</label>
            <input type="date" value={filter.to} onChange={e => setFilterField('to', e.target.value)} style={{ width: '100%', padding: '7px 8px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#7A92B0', fontWeight: 700 }}>ACTIVE:</span>
            {activeFilters.map(af => (
              <button key={af.key} onClick={() => {
                if (af.key === 'search') setSearchInput('')
                setFilterField(af.key, '')
              }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EEF3FF', color: '#1A365E', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                {af.label} ✕
              </button>
            ))}
            <button onClick={clearAll} style={{ fontSize: 10, color: '#D61F31', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '3px 6px', fontFamily: 'inherit' }}>Clear all</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#7A92B0' }}>
          <strong style={{ color: '#1A365E' }}>{filtered.length.toLocaleString()}</strong> records · showing page {safePage + 1} of {totalPages}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {safePage > 0 && <button onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>}
          {safePage < totalPages - 1 && <button onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>}
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>
          {tableMissing ? 'Audit log table is not configured in Supabase yet.' : 'No audit records match the current filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E4EAF2', borderRadius: 13, background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#F0F4FA' }}>
                {['Timestamp', 'Actor', 'Role', 'Module', 'Entity', 'Action', 'Type', 'Before / After'].map((col, ci) => {
                  const w = ci === 7 ? '28%' : ci === 0 ? '13%' : ci === 4 ? '16%' : 'auto'
                  return (
                    <th key={col} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: '.7px', borderBottom: '2px solid #E4EAF2', whiteSpace: 'nowrap', width: w }}>
                      {col}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => {
                const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
                const ctCol = changeColor(r.changeType)
                const ctBg = changeBg(r.changeType)
                const afterStr = fmtJsonPreview(r.after, 120)
                const beforeStr = fmtJsonPreview(r.before, 100)

                let diff: React.ReactNode = <span style={{ color: '#7A92B0', fontSize: 10 }}>—</span>
                if (r.changeType === 'login' || r.changeType === 'logout' || r.changeType === 'access') {
                  diff = <span style={{ color: '#7A92B0', fontSize: 10 }}>—</span>
                } else if (afterStr) {
                  if (beforeStr && r.changeType === 'delete') {
                    diff = <div style={{ background: '#FEE2E2', borderRadius: 4, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', color: '#9B1C1C' }}>− {beforeStr}</div>
                  } else if (beforeStr) {
                    diff = <div style={{ background: '#DCFCE7', borderRadius: 4, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', color: '#065F46' }}>+ {afterStr}</div>
                  } else {
                    diff = <span style={{ fontSize: 10, color: '#1A365E', fontFamily: 'monospace', wordBreak: 'break-all' }}>{afterStr}</span>
                  }
                } else if (beforeStr) {
                  diff = <span style={{ fontSize: 10, color: '#9B1C1C', fontFamily: 'monospace', wordBreak: 'break-all' }}>{beforeStr}</span>
                }

                return (
                  <tr key={r.id + idx} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10, color: '#5A7290' }}>{fmtTimestamp(r.timestamp)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap' }}>{r.actor || '—'}</td>
                    <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#F0F4FA', color: '#5A7290', fontWeight: 700 }}>{r.actorRole || '—'}</span></td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><span style={{ fontSize: 13, marginRight: 4 }}>{moduleIcon(r.module)}</span><span style={{ color: '#3D5475', fontSize: 11 }}>{r.module || '—'}</span></td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{r.entityLabel || '—'}</div>
                      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{r.entityType || '—'}{r.entityId ? ` · ${r.entityId.slice(0, 16)}` : ''}</div>
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, color: '#3D5475' }}>{r.action || '—'}</td>
                    <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 5, background: ctBg, color: ctCol }}>{r.changeType || '—'}</span></td>
                    <td style={{ padding: '8px 12px', maxWidth: 280 }}>{diff}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '10px 14px', background: '#F7F9FC', borderRadius: 10, fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🔒</span>
        <span>Audit log is <strong>append-only</strong>. Records cannot be edited or deleted. Each entry is timestamped on the server and visible to admins only.</span>
      </div>
    </div>
  )
}
