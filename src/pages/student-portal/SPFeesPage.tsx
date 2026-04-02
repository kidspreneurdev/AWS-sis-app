import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

interface Fee { id: string; description: string; amount: number; due_date: string; paid: boolean; paid_date: string }

export function SPFeesPage() {
  const { session } = useStudentPortal()
  const [fees, setFees] = useState<Fee[]>([])

  useEffect(() => {
    if (!session) return
    supabase.from('fees').select('*').eq('student_id', session.dbId).order('due_date').then(({ data }) => {
      if (data) setFees(data.map((r: Record<string, unknown>) => ({ id: r.id as string, description: (r.description as string) ?? '', amount: (r.amount as number) ?? 0, due_date: (r.due_date as string) ?? '', paid: (r.paid as boolean) ?? false, paid_date: (r.paid_date as string) ?? '' })))
    })
  }, [session])

  const stats = useMemo(() => {
    const total = fees.reduce((s, f) => s + f.amount, 0)
    const paid = fees.filter(f => f.paid).reduce((s, f) => s + f.amount, 0)
    const outstanding = total - paid
    return { total, paid, outstanding }
  }, [fees])

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My Fees</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Fee balances and payment history</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Total Fees', value: fmt(stats.total), color: '#1A365E' },
          { label: 'Paid', value: fmt(stats.paid), color: '#10B981' },
          { label: 'Outstanding', value: fmt(stats.outstanding), color: stats.outstanding > 0 ? '#D61F31' : '#7A92B0' },
        ].map(c => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Description</th><th style={th}>Amount</th><th style={th}>Due Date</th><th style={th}>Status</th>
          </tr></thead>
          <tbody>
            {fees.map(f => (
              <tr key={f.id}>
                <td style={{ ...td, fontWeight: 600 }}>{f.description}</td>
                <td style={td}>{fmt(f.amount)}</td>
                <td style={{ ...td, color: !f.paid && f.due_date && new Date(f.due_date) < new Date() ? '#D61F31' : '#7A92B0' }}>
                  {f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}
                </td>
                <td style={td}>
                  {f.paid
                    ? <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#E8FBF0', color: '#0E6B3B' }}>Paid {f.paid_date ? `· ${new Date(f.paid_date).toLocaleDateString()}` : ''}</span>
                    : <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#FEE2E2', color: '#991B1B' }}>Unpaid</span>
                  }
                </td>
              </tr>
            ))}
            {fees.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No fee records found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
