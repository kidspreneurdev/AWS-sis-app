import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const MOODS = [
  { level: 5, emoji: '😄', label: 'Great' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 3, emoji: '😐', label: 'Okay' },
  { level: 2, emoji: '😔', label: 'Low' },
  { level: 1, emoji: '😢', label: 'Struggling' },
]
const CATEGORIES = ['Physical Health', 'Mental Wellbeing', 'Social', 'Sleep', 'Stress', 'Nutrition', 'Other']

interface WellnessLog { id: string; date: string; mood: number; category: string; notes: string }

export function SPWellnessPage() {
  const { session } = useStudentPortal()
  const [logs, setLogs] = useState<WellnessLog[]>([])
  const [mood, setMood] = useState(3)
  const [category, setCategory] = useState('Mental Wellbeing')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function load() {
    if (!session) return
    const { data } = await supabase.from('wellness_logs').select('*').eq('student_id', session.dbId).order('date', { ascending: false }).limit(30)
    if (data) setLogs(data as WellnessLog[])
  }
  useEffect(() => { load() }, [session])

  async function checkin() {
    setSaving(true)
    await supabase.from('wellness_logs').insert({ student_id: session!.dbId, date: new Date().toISOString().slice(0, 10), mood, category, notes })
    setNotes(''); setSaved(true); setTimeout(() => setSaved(false), 2000)
    await load(); setSaving(false)
  }

  const avgMood = logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.mood, 0) / logs.length * 10) / 10 : null
  const moodEmoji = MOODS.find(m => m.level === Math.round(avgMood ?? 3))

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Wellness</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Daily check-ins and wellbeing tracker</p>
      </div>

      {avgMood !== null && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 40 }}>{moodEmoji?.emoji}</span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1A365E' }}>{avgMood}/5</div>
            <div style={{ fontSize: 13, color: '#7A92B0' }}>Average mood over {logs.length} check-in{logs.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {/* Check-in */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 14 }}>Today's Check-In</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7A92B0', marginBottom: 8 }}>How are you feeling?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {MOODS.map(m => (
              <button key={m.level} onClick={() => setMood(m.level)} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: mood === m.level ? '2px solid #D61F31' : '2px solid #E4EAF2', background: mood === m.level ? '#FEE2E2' : '#F7F9FC', cursor: 'pointer', fontSize: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {m.emoji}
                <span style={{ fontSize: 10, color: mood === m.level ? '#D61F31' : '#7A92B0', fontWeight: 600 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} style={inp} placeholder="How's your day going?" />
          </div>
        </div>
        <button onClick={checkin} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: saved ? '#10B981' : '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {saved ? '✓ Logged!' : saving ? 'Saving…' : 'Log Check-In'}
        </button>
      </div>

      {/* Log */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', fontSize: 14, fontWeight: 700, color: '#1A365E' }}>Recent Check-Ins</div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {logs.map(l => {
            const m = MOODS.find(m => m.level === l.mood)
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid #F0F4F8' }}>
                <span style={{ fontSize: 24 }}>{m?.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{m?.label} · {l.category}</div>
                  <div style={{ fontSize: 11, color: '#7A92B0' }}>{new Date(l.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  {l.notes && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>{l.notes}</div>}
                </div>
              </div>
            )
          })}
          {logs.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No check-ins yet.</div>}
        </div>
      </div>
    </div>
  )
}
