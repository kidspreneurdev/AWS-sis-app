import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { K5CertificateFrame } from '@/components/k5/K5Certificate'
import { downloadCertificateImage } from '@/lib/downloadCertificate'

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

function certProps(l: CompletedLesson) {
  const scorePct = l.totalQ > 0 ? Math.round((l.starsEarned / l.totalQ) * 100) : 100
  const dateStr  = l.completedAt
    ? new Date(l.completedAt).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : ''
  return { scorePct, dateStr }
}

export function K5CertificatesPage() {
  const { session } = useStudentPortal()
  const [lessons,  setLessons]  = useState<CompletedLesson[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<CompletedLesson | null>(null)
  const [downloading, setDownloading] = useState(false)
  const modalCertRef = useRef<HTMLDivElement>(null)

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

  const handleDownload = async () => {
    const node = modalCertRef.current
    if (!node || !expanded || downloading) return
    setDownloading(true)
    try {
      await downloadCertificateImage(node, `${studentName.replace(/\s+/g, '_')}-${expanded.title.replace(/\s+/g, '_')}-certificate.png`)
    } finally {
      setDownloading(false)
    }
  }

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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:18 }}>
          {lessons.map(l => {
            const { scorePct, dateStr } = certProps(l)

            return (
              <div
                key={l.lessonId}
                onClick={() => setExpanded(l)}
                style={{ maxWidth:420, margin:'0 auto', width:'100%', cursor:'pointer' }}
              >
                <K5CertificateFrame
                  studentName={studentName}
                  subject={l.subject}
                  lessonTitle={l.title}
                  scorePct={scorePct}
                  starsEarned={l.starsEarned}
                  date={dateStr}
                  badgeName={l.badgeName}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Expanded certificate modal ── */}
      {expanded && (() => {
        const { scorePct, dateStr } = certProps(expanded)
        return (
          <div
            onClick={() => setExpanded(null)}
            style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(15,23,42,.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:28 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:900, background:'#fff', borderRadius:20, padding:24, position:'relative', boxShadow:'0 24px 64px rgba(0,0,0,.4)' }}
            >
              <button
                onClick={() => setExpanded(null)}
                style={{ position:'absolute', top:-14, right:-14, width:32, height:32, borderRadius:'50%', border:'none', background:'#d2d2d2ff', color:NAVY, fontSize:16, fontWeight:800, cursor:'pointer', zIndex:1 }}
              >
                ✕
              </button>

              <K5CertificateFrame
                ref={modalCertRef}
                studentName={studentName}
                subject={expanded.subject}
                lessonTitle={expanded.title}
                scorePct={scorePct}
                starsEarned={expanded.starsEarned}
                date={dateStr}
                badgeName={expanded.badgeName}
              />

              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{ width:'100%', marginTop:16, background:GOLD, color:NAVY, border:'none', borderRadius:10, padding:'12px 22px', fontSize:14, fontWeight:800, cursor: downloading ? 'default' : 'pointer', fontFamily:'inherit', opacity: downloading ? 0.7 : 1 }}
              >
                {downloading ? 'Preparing…' : '📥 Download certificate'}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
