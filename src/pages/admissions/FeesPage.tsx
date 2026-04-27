import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type FeeStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Waived'

const FEE_TYPES = ['Tuition', 'Registration', 'Activity', 'Transport', 'Uniform', 'Other']
const CURRENT_YEAR = new Date().getFullYear().toString()

const FEE_STATUS_META: Record<FeeStatus, { bg: string; tc: string }> = {
  Paid:    { bg: '#E8FBF0', tc: '#0E6B3B' },
  Partial: { bg: '#FFF6E0', tc: '#B45309' },
  Unpaid:  { bg: '#FFF0F1', tc: '#D61F31' },
  Waived:  { bg: '#F3F4F6', tc: '#7A92B0' },
}

interface FeeRecord {
  id: string
  studentId: string
  studentName: string
  grade: string | null
  feeType: string
  amount: number
  amountPaid: number
  dueDate: string | null
  status: FeeStatus
  notes: string | null
  schoolYear: string
}

interface AddFeeForm {
  studentId: string
  feeType: string
  amount: string
  amountPaid: string
  dueDate: string
  status: FeeStatus
  notes: string
}

const EMPTY_FORM: AddFeeForm = {
  studentId: '', feeType: 'Tuition', amount: '', amountPaid: '0',
  dueDate: '', status: 'Unpaid', notes: '',
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function FeeModal({ students, fee, onClose, onSave }: {
  students: { id: string; name: string }[]
  fee: FeeRecord | null
  onClose: () => void
  onSave: (data: AddFeeForm, id?: string) => Promise<void>
}) {
  const [form, setForm] = useState<AddFeeForm>(fee ? {
    studentId: fee.studentId, feeType: fee.feeType,
    amount: String(fee.amount), amountPaid: String(fee.amountPaid),
    dueDate: fee.dueDate ?? '', status: fee.status, notes: fee.notes ?? '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof AddFeeForm, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.studentId || !form.amount) return
    setSaving(true)
    await onSave(form, fee?.id)
    setSaving(false); onClose()
  }

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{fee ? 'Edit Fee Record' : 'Add Fee Record'}</div>
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
              <label style={lbl}>Fee Type</label>
              <select value={form.feeType} onChange={e => set('feeType', e.target.value)} style={inp}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as FeeStatus)} style={inp}>
                {(Object.keys(FEE_STATUS_META) as FeeStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Amount Due ($)</label><input type="number" min={0} value={form.amount} onChange={e => set('amount', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Amount Paid ($)</label><input type="number" min={0} value={form.amountPaid} onChange={e => set('amountPaid', e.target.value)} style={inp} /></div>
          </div>
          <div><label style={lbl}>Due Date</label><input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional note" style={inp} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function FeesPage() {
  const cf = useCampusFilter()
  const [fees, setFees] = useState<FeeRecord[]>([])
  const [stuList, setStuList] = useState<{ id: string; name: string; grade: string | null }[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FeeRecord | null>(null)

  async function load() {
    let sQuery = supabase.from('students').select('id,first_name,last_name,grade').eq('status', 'Enrolled')
    if (cf) sQuery = sQuery.eq('campus', cf)
    const [stuRes, feesRes] = await Promise.all([
      sQuery,
      supabase.from('fees').select('*').eq('school_year', CURRENT_YEAR),
    ])
    const stus = (stuRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: `${r.first_name} ${r.last_name}`,
      grade: r.grade != null ? String(r.grade) : null,
    }))
    setStuList(stus)
    const stuMap = Object.fromEntries(stus.map(s => [s.id, s]))
    setFees((feesRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:         r.id as string,
      studentId:  r.student_id as string,
      studentName: stuMap[r.student_id as string]?.name ?? 'Unknown',
      grade:      stuMap[r.student_id as string]?.grade ?? null,
      feeType:    r.fee_type as string,
      amount:     Number(r.amount),
      amountPaid: Number(r.amount_paid),
      dueDate:    r.due_date as string | null,
      status:     r.status as FeeStatus,
      notes:      r.notes as string | null,
      schoolYear: r.school_year as string,
    })))
  }

  useEffect(() => { load() }, [cf])

  const filtered = useMemo(() => fees.filter(f => {
    if (search && !f.studentName.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'All' && f.status !== filterStatus) return false
    if (filterType !== 'All' && f.feeType !== filterType) return false
    return true
  }), [fees, search, filterStatus, filterType])

  const totalDue = fees.reduce((s, f) => s + f.amount, 0)
  const totalPaid = fees.reduce((s, f) => s + f.amountPaid, 0)
  const outstanding = totalDue - totalPaid
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0

  async function saveFee(data: AddFeeForm, id?: string) {
    const payload = {
      student_id: data.studentId, fee_type: data.feeType,
      amount: parseFloat(data.amount) || 0,
      amount_paid: parseFloat(data.amountPaid) || 0,
      due_date: data.dueDate || null, status: data.status,
      notes: data.notes || null, school_year: CURRENT_YEAR,
    }
    if (id) {
      await supabase.from('fees').update(payload).eq('id', id)
      toast('Fee record updated', 'ok')
    } else {
      await supabase.from('fees').insert(payload)
      toast('Fee record added', 'ok')
    }
    await load()
  }

  async function deleteFee(id: string) {
    if (!confirm('Delete this fee record?')) return
    await supabase.from('fees').delete().eq('id', id)
    setFees(prev => prev.filter(f => f.id !== id))
    toast('Fee record deleted', 'ok')
  }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }
  const headerPortal = useHeaderActions(
    <button onClick={() => { setEditing(null); setModalOpen(true) }} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Fee</button>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Due', value: fmt(totalDue) },
          { label: 'Collected', value: fmt(totalPaid), color: '#1DBD6A' },
          { label: 'Outstanding', value: fmt(outstanding), color: outstanding > 0 ? '#D61F31' : '#1A365E' },
          { label: 'Collection Rate', value: `${collectionRate}%`, color: collectionRate >= 80 ? '#1DBD6A' : '#F5A623' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color ?? '#1A365E', marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" style={{ ...iStyle, width: 220 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={iStyle}>
          <option value="All">All Statuses</option>
          {(Object.keys(FEE_STATUS_META) as FeeStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={iStyle}>
          <option value="All">All Types</option>
          {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} records</span>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F7F9FC' }}>
              <th style={th}>Student</th><th style={th}>Type</th>
              <th style={{ ...th, textAlign: 'right' }}>Due</th>
              <th style={{ ...th, textAlign: 'right' }}>Paid</th>
              <th style={{ ...th, textAlign: 'right' }}>Balance</th>
              <th style={th}>Due Date</th><th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => {
              const balance = f.amount - f.amountPaid
              const m = FEE_STATUS_META[f.status]
              return (
                <tr key={f.id}
                  onClick={() => { setEditing(f); setModalOpen(true) }}
                  style={{ cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#1A365E,#2D5A8E)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {f.studentName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{f.studentName}</div>
                        {f.grade && <div style={{ fontSize: 11, color: '#7A92B0' }}>Grade {f.grade}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: '#7A92B0' }}>{f.feeType}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(f.amount)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#1DBD6A', fontWeight: 600 }}>{fmt(f.amountPaid)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: balance > 0 ? '#D61F31' : '#1DBD6A' }}>{fmt(balance)}</td>
                  <td style={{ ...td, color: '#7A92B0' }}>{f.dueDate ?? '—'}</td>
                  <td style={td}><span style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 12, fontWeight: 600 }}>{f.status}</span></td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditing(f); setModalOpen(true) }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteFee(f.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}>Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No fee records found.</td></tr>}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <FeeModal
          students={stuList}
          fee={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={saveFee}
        />
      )}
    </div>
    </>
  )
}
