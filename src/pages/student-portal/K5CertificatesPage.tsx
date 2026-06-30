import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const NAVY = '#1A365E'
const GOLD = '#FAC600'
const RED  = '#D61F31'

interface CompletedLesson {
  lessonId:    string
  title:       string
  subject:     string
  starsEarned: number
  totalQ:      number
  completedAt: string
  badgeName:   string
}

export function K5CertificatesPage() {
  const { session } = useStudentPortal()
  const [lessons,  setLessons]  = useState<CompletedLesson[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!session) return
    async function load() {
      setLoading(true)

      const { data: progress } = await supabase
        .from('k5_progress')
        .select('lesson_id,stars_earned,completed_at')
        .eq('student_id', session!.dbId)
        .eq('status', 'completed')

      if (!progress || progress.length === 0) { setLoading(false); return }

      const lessonIds = progress.map((r: Record<string, unknown>) => r.lesson_id as string)
      const { data: lessonRows } = await supabase
        .from('k5_lessons')
        .select('id,title,subject,quiz_json,badge_name')
        .in('id', lessonIds)

      const lessonMap = new Map<string, Record<string, unknown>>()
      for (const l of (lessonRows ?? []) as Record<string, unknown>[]) {
        lessonMap.set(l.id as string, l)
      }

      const result: CompletedLesson[] = (progress as Record<string, unknown>[]).map(p => {
        const l = lessonMap.get(p.lesson_id as string)
        const quiz = (l?.quiz_json as unknown[]) ?? []
        return {
          lessonId:    p.lesson_id as string,
          title:       (l?.title as string) ?? 'Lesson',
          subject:     (l?.subject as string) ?? '',
          starsEarned: (p.stars_earned as number) ?? 0,
          totalQ:      quiz.length,
          completedAt: (p.completed_at as string) ?? '',
          badgeName:   (l?.badge_name as string) ?? '',
        }
      })

      setLessons(result)
      setLoading(false)
    }
    void load()
  }, [session])

  const studentName = session?.fullName ?? ''
  const grade       = session?.grade ?? ''

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, fontFamily:'Poppins, sans-serif' }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius:16, padding:'20px 22px' }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:4 }}>🏆 My Certificates</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>Certificates you've earned by completing lessons</div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid #E4EAF2', borderTopColor:RED, animation:'spin 0.7s linear infinite' }} />
        </div>
      ) : lessons.length === 0 ? (
        <div style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, padding:'40px 20px', textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>📜</div>
          <div style={{ fontSize:15, fontWeight:800, color:NAVY, marginBottom:6 }}>No certificates yet</div>
          <div style={{ fontSize:12, color:'#64748B', lineHeight:1.7 }}>
            Complete a lesson and pass the quiz to earn your first certificate!
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {lessons.map(l => {
            const scorePct = l.totalQ > 0 ? Math.round((l.starsEarned / l.totalQ) * 100) : 100
            const dateStr  = l.completedAt
              ? new Date(l.completedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
              : ''
            const shortDate = l.completedAt
              ? new Date(l.completedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
              : ''
            const isPerfect = l.starsEarned === l.totalQ

            return (
              <div key={l.lessonId} style={{ borderRadius:16, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,.12)' }}>

                {/* Red header bar */}
                <div style={{ background:RED, padding:'8px 18px', display:'flex', alignItems:'center', gap:8 }}>
                  <img src="/Logo_w.png" alt="AWS" style={{ height:26, width:'auto', objectFit:'contain' }} />
                  <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>American World School</span>
                </div>

                {/* Certificate body */}
                <div style={{ background:NAVY, padding:'22px', textAlign:'center' }}>

                  {/* Seal */}
                  <div style={{ width:68, height:68, borderRadius:'50%', background:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 12px', border:'3px solid rgba(255,255,255,.25)' }}>
                    📜
                  </div>

                  <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                    Certificate of Achievement
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:GOLD, marginBottom:4 }}>
                    {studentName}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', marginBottom:14, lineHeight:1.5 }}>
                    successfully completed <strong style={{ color:GOLD }}>{l.title}</strong>
                    {isPerfect ? ' with a perfect score' : ''}
                  </div>

                  {/* Stats */}
                  <div style={{ display:'flex', justifyContent:'center', gap:22, marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{scorePct}%</div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Score</div>
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{'⭐'.repeat(Math.min(l.starsEarned, 5))}</div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Stars earned</div>
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{shortDate}</div>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Date</div>
                    </div>
                  </div>

                  <div style={{ fontSize:9, color:'rgba(255,255,255,.25)', marginBottom:14, fontStyle:'italic' }}>
                    WASC Accredited · American World School · Grade {grade} · 2025–26
                  </div>

                  <button
                    onClick={() => window.print()}
                    style={{ background:GOLD, color:NAVY, border:'none', borderRadius:10, padding:'9px 22px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    📥 Download certificate
                  </button>
                </div>

                {/* Footer strip */}
                {l.badgeName && (
                  <div style={{ background:'rgba(250,198,0,.12)', borderTop:`1px solid ${GOLD}30`, padding:'10px 18px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>🏅</span>
                    <div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', fontWeight:600 }}>Badge earned</div>
                      <div style={{ fontSize:13, fontWeight:800, color:GOLD }}>{l.badgeName}</div>
                    </div>
                    <div style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,.3)' }}>{dateStr}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
