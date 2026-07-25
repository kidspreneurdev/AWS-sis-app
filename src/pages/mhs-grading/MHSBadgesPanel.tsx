import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface Badge { id: string; badge_key: string; label: string; icon: string | null; awarded_at: string }

interface MHSBadgesPanelProps {
  studentId: string
}

/** Positive-reinforcement badges — on-time streaks, debate excellence, HOW
 *  improvement (spec section 12). Reads mhs_badges; awarding rules are a
 *  teacher/admin action (or a future automated job), not built here. */
export function MHSBadgesPanel({ studentId }: MHSBadgesPanelProps) {
  const [badges, setBadges] = useState<Badge[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('mhs_badges').select('id,badge_key,label,icon,awarded_at').eq('student_id', studentId).order('awarded_at', { ascending: false })
      if (!cancelled) setBadges(data ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [studentId])

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>MS/HS Badges</div>
      {badges.length === 0 ? (
        <div style={{ fontSize: 12, color: '#7A92B0' }}>No badges awarded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {badges.map((b) => (
            <div key={b.id} style={{ width: 110, textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: '#F7F9FC', border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 28 }}>{b.icon ?? '🏅'}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginTop: 6 }}>{b.label}</div>
              <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{new Date(b.awarded_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
