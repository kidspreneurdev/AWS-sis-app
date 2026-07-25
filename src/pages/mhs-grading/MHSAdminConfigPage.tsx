import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/lib/toast'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }

interface MhsConfigRow {
  id: string
  mastery_weight_quiz: number
  mastery_weight_discussion: number
  mastery_weight_debate: number
  mastery_weight_omr: number
  mastery_weight_notes: number
  quiz_gate_threshold_pct: number
  quiz_max_attempts: number
  how_diploma_threshold_pct: number | null
  mastery_diploma_threshold_pct: number | null
  honor_roll_how_threshold_pct: number
  dispute_window_school_days: number
}

const WEIGHT_FIELDS: { key: keyof MhsConfigRow; label: string }[] = [
  { key: 'mastery_weight_quiz', label: 'Presentation Quiz' },
  { key: 'mastery_weight_discussion', label: 'Discussion Board' },
  { key: 'mastery_weight_debate', label: 'Socratic Live Debate' },
  { key: 'mastery_weight_omr', label: 'Open-Book OMR Test' },
  { key: 'mastery_weight_notes', label: 'Physical Notes' },
]

/** Admin/Department-Head-only: locks Mastery component weights and diploma
 *  thresholds so individual classroom teachers can't alter them (spec section 4). */
export function MHSAdminConfigPage() {
  const profile = useAuthStore((s) => s.profile)
  const [config, setConfig] = useState<MhsConfigRow | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void supabase.from('mhs_config').select('*').single().then(({ data }) => setConfig(data))
  }, [])

  if (profile?.role !== 'admin') {
    return <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0' }}>⛔ Admin access required.</div>
  }
  if (!config) {
    return <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
  }

  const weightTotal = WEIGHT_FIELDS.reduce((sum, f) => sum + Number(config[f.key] ?? 0), 0)

  function set<K extends keyof MhsConfigRow>(key: K, value: MhsConfigRow[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function save() {
    if (!config || weightTotal !== 100) {
      toast('Mastery weights must add up to exactly 100%.', 'err')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('mhs_config')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', config.id)
    setSaving(false)
    toast(error ? 'Save failed' : 'Config saved', error ? 'err' : 'ok')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>Mastery Component Weights</div>
        <div style={{ fontSize: 11, color: weightTotal === 100 ? '#15803D' : '#DC2626', fontWeight: 700, marginBottom: 10 }}>
          Total: {weightTotal}% {weightTotal !== 100 && '— must equal 100%'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {WEIGHT_FIELDS.map((f) => (
            <div key={f.key}>
              <label style={label}>{f.label}</label>
              <input type="number" value={config[f.key] as number} onChange={(e) => set(f.key, Number(e.target.value) as never)} style={input} />
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>Gates &amp; Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <div>
            <label style={label}>Quiz gate threshold %</label>
            <input type="number" value={config.quiz_gate_threshold_pct} onChange={(e) => set('quiz_gate_threshold_pct', Number(e.target.value))} style={input} />
          </div>
          <div>
            <label style={label}>Quiz max attempts</label>
            <input type="number" value={config.quiz_max_attempts} onChange={(e) => set('quiz_max_attempts', Number(e.target.value))} style={input} />
          </div>
          <div>
            <label style={label}>Honor Roll HOW threshold %</label>
            <input type="number" value={config.honor_roll_how_threshold_pct} onChange={(e) => set('honor_roll_how_threshold_pct', Number(e.target.value))} style={input} />
          </div>
          <div>
            <label style={label}>Mastery GPA diploma threshold % <span style={{ color: '#D97706' }}>(unset = inactive)</span></label>
            <input type="number" value={config.mastery_diploma_threshold_pct ?? ''} placeholder="Not configured" onChange={(e) => set('mastery_diploma_threshold_pct', e.target.value ? Number(e.target.value) : null)} style={input} />
          </div>
          <div>
            <label style={label}>HOW GPA diploma threshold % <span style={{ color: '#D97706' }}>(unset = inactive)</span></label>
            <input type="number" value={config.how_diploma_threshold_pct ?? ''} placeholder="Not configured" onChange={(e) => set('how_diploma_threshold_pct', e.target.value ? Number(e.target.value) : null)} style={input} />
          </div>
          <div>
            <label style={label}>Dispute window (school days)</label>
            <input type="number" value={config.dispute_window_school_days} onChange={(e) => set('dispute_window_school_days', Number(e.target.value))} style={input} />
          </div>
        </div>
      </div>

      <button onClick={() => void save()} disabled={saving} style={{ alignSelf: 'flex-start', padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving…' : 'Save Configuration'}
      </button>
    </div>
  )
}
