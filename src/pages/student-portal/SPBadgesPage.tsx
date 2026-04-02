import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const BADGE_COLORS = ['#EDE9FE', '#E6F4FF', '#E8FBF0', '#FFF3E0', '#FEE2E2', '#F3F4F6']
const BADGE_TEXT = ['#5B21B6', '#0369A1', '#0E6B3B', '#B45309', '#991B1B', '#374151']

interface BadgeAward { id: string; name: string; description: string; criteria: string; earned_at: string; category: string }

export function SPBadgesPage() {
  const { session } = useStudentPortal()
  const [badges, setBadges] = useState<BadgeAward[]>([])

  useEffect(() => {
    if (!session) return
    supabase.from('badge_awards').select('*').eq('student_id', session.dbId).order('earned_at', { ascending: false }).then(({ data }) => {
      if (data) setBadges(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name as string) ?? '', description: (r.description as string) ?? '', criteria: (r.criteria as string) ?? '', earned_at: (r.earned_at as string) ?? '', category: (r.category as string) ?? 'General' })))
    })
  }, [session])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My Badges</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Achievements and recognition earned throughout your journey</p>
      </div>

      {badges.length > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🏅</div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1A365E' }}>{badges.length}</div>
            <div style={{ fontSize: 13, color: '#7A92B0' }}>badge{badges.length !== 1 ? 's' : ''} earned</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {badges.map((b, i) => {
          const bg = BADGE_COLORS[i % BADGE_COLORS.length]
          const tc = BADGE_TEXT[i % BADGE_TEXT.length]
          return (
            <div key={b.id} style={{ ...card, background: bg, border: `1px solid ${tc}30` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: tc, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏅</div>
                <span style={{ fontSize: 11, color: tc, fontWeight: 600 }}>{new Date(b.earned_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>{b.name}</div>
              {b.description && <p style={{ fontSize: 12, color: '#7A92B0', margin: 0 }}>{b.description}</p>}
              {b.criteria && <div style={{ marginTop: 8, fontSize: 11, color: tc, fontStyle: 'italic' }}>Criteria: {b.criteria}</div>}
            </div>
          )
        })}
        {badges.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>No badges earned yet. Keep up the great work!</div>}
      </div>
    </div>
  )
}
