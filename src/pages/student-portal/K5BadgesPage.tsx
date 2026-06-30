import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const NAVY = '#1A365E'
const GOLD = '#FAC600'

const BADGE_PALETTES = [
  { bg: '#FEF3C7', border: '#FAC600', text: '#92400E' },
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
  { bg: '#EDE9FE', border: '#A78BFA', text: '#5B21B6' },
  { bg: '#FEE2E2', border: '#F87171', text: '#991B1B' },
  { bg: '#E0F2FE', border: '#38BDF8', text: '#0369A1' },
]

interface BadgeAward {
  id: string
  name: string
  description: string
  criteria: string
  earned_at: string
  category: string
}

function starLevel(count: number): { label: string; color: string; icon: string } {
  if (count >= 20) return { label: 'Platinum', color: '#7C3AED', icon: '💎' }
  if (count >= 10) return { label: 'Gold', color: '#FAC600', icon: '🥇' }
  if (count >= 5)  return { label: 'Silver', color: '#94A3B8', icon: '🥈' }
  return { label: 'Bronze', color: '#B45309', icon: '🥉' }
}

export function K5BadgesPage() {
  const { session } = useStudentPortal()
  const [badges, setBadges] = useState<BadgeAward[]>([])

  useEffect(() => {
    if (!session) return
    supabase
      .from('badge_awards')
      .select('id,name,description,criteria,earned_at,category')
      .eq('student_id', session.dbId)
      .order('earned_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setBadges(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            name: (r.name as string) ?? '',
            description: (r.description as string) ?? '',
            criteria: (r.criteria as string) ?? '',
            earned_at: (r.earned_at as string) ?? '',
            category: (r.category as string) ?? 'General',
          })))
        }
      })
  }, [session])

  const level = starLevel(badges.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius: 16, padding: '22px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⭐</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: GOLD, marginBottom: 4 }}>{badges.length}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 12 }}>
          {badges.length === 1 ? 'badge earned' : 'badges earned'}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: '6px 16px', border: `1.5px solid ${level.color}` }}>
          <span style={{ fontSize: 18 }}>{level.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: level.color }}>{level.label} Level</span>
        </div>
      </div>

      {/* Progress to next level */}
      {badges.length < 20 && (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          {(() => {
            const next = badges.length < 5 ? { need: 5, label: 'Silver', icon: '🥈' }
              : badges.length < 10 ? { need: 10, label: 'Gold', icon: '🥇' }
              : { need: 20, label: 'Platinum', icon: '💎' }
            const pct = Math.round((badges.length / next.need) * 100)
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>
                    Next: {next.icon} {next.label} Level
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{badges.length} / {next.need}</div>
                </div>
                <div style={{ background: '#E2E8F0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${GOLD},#FFD700)`, borderRadius: 6, transition: 'width .4s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 5 }}>
                  {next.need - badges.length} more badge{next.need - badges.length !== 1 ? 's' : ''} to go!
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Badge grid */}
      <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 14 }}>🏅 All My Badges</div>

        {badges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6 }}>No badges yet!</div>
            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
              Complete your lessons and quizzes to start earning badges and stars.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {badges.map((b, i) => {
              const pal = BADGE_PALETTES[i % BADGE_PALETTES.length]
              return (
                <div key={b.id} style={{ background: pal.bg, border: `2px solid ${pal.border}`, borderRadius: 14, padding: '16px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🏅</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, lineHeight: 1.4, marginBottom: 4 }}>{b.name}</div>
                  {b.description && (
                    <div style={{ fontSize: 10, color: pal.text, lineHeight: 1.4, marginBottom: 5 }}>{b.description}</div>
                  )}
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>
                    {new Date(b.earned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stars breakdown */}
      {badges.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '2px solid #FAC600', borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🌟 Keep it up, {session?.fullName.split(' ')[0]}!</div>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7 }}>
            You've earned <strong>{badges.length}</strong> badge{badges.length !== 1 ? 's' : ''} so far.
            {badges.length < 5 ? ` Earn ${5 - badges.length} more to reach Silver level!` :
             badges.length < 10 ? ` Earn ${10 - badges.length} more to reach Gold level!` :
             badges.length < 20 ? ` Earn ${20 - badges.length} more to reach Platinum level!` :
             ' You\'ve reached the top — amazing work!'}
          </div>
        </div>
      )}

    </div>
  )
}
