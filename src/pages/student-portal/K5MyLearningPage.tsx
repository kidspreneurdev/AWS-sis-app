import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { K5LessonPlayer } from '@/components/k5/K5LessonPlayer'
import type { K5Lesson, K5ProgressRecord } from '@/types/k5Lesson'

const NAVY = '#1A365E'
const RED  = '#D61F31'
const GOLD = '#FAC600'
const GREEN = '#16A34A'

const CARD_COLORS = [
  { bg: '#DBEAFE', border: '#3B82F6' },
  { bg: '#DCFCE7', border: '#22C55E' },
  { bg: '#EDE9FE', border: '#A78BFA' },
  { bg: '#FEF3C7', border: '#FAC600' },
  { bg: '#FEE2E2', border: '#F87171' },
  { bg: '#E0F2FE', border: '#38BDF8' },
]

function rowToLesson(r: Record<string, unknown>): K5Lesson {
  return {
    id:             r.id as string,
    title:          (r.title as string) ?? '',
    subject:        (r.subject as string) ?? '',
    gradeLevels:    (r.grade_levels as string[]) ?? [],
    slides:         (r.slides_json as K5Lesson['slides']) ?? [],
    quiz:           (r.quiz_json as K5Lesson['quiz']) ?? [],
    badgeName:      (r.badge_name as string) ?? '',
    estimatedMins:  (r.estimated_mins as number) ?? 12,
    status:         (r.status as 'Draft' | 'Published') ?? 'Draft',
    slidesFileUrl:  (r.slides_file_url as string | null) ?? null,
    slidesFileType: (r.slides_file_type as string | null) ?? null,
  }
}

function rowToProgress(r: Record<string, unknown>): K5ProgressRecord {
  return {
    lessonId:    r.lesson_id as string,
    status:      (r.status as K5ProgressRecord['status']) ?? 'not_started',
    starsEarned: r.stars_earned as number | null,
    completedAt: r.completed_at as string | null,
  }
}

export function K5MyLearningPage() {
  const { session } = useStudentPortal()
  const [lessons,  setLessons]  = useState<K5Lesson[]>([])
  const [progress, setProgress] = useState<Map<string, K5ProgressRecord>>(new Map())
  const [loading,  setLoading]  = useState(true)
  const [activeLesson, setActiveLesson] = useState<K5Lesson | null>(null)

  async function load() {
    if (!session) return
    setLoading(true)

    const [lessonsRes, progressRes] = await Promise.all([
      supabase
        .from('k5_lessons')
        .select('id,title,subject,grade_levels,slides_json,quiz_json,badge_name,estimated_mins,status,slides_file_url,slides_file_type')
        .eq('status', 'Published')
        .order('created_at', { ascending: true }),
      supabase
        .from('k5_progress')
        .select('lesson_id,status,stars_earned,completed_at')
        .eq('student_id', session.dbId),
    ])

    const allLessons = (lessonsRes.data ?? []) as Record<string, unknown>[]
    const studentGrade = session.grade

    const filtered = allLessons
      .map(rowToLesson)
      .filter(l => l.gradeLevels.includes(studentGrade))

    const progressMap = new Map<string, K5ProgressRecord>()
    for (const row of (progressRes.data ?? []) as Record<string, unknown>[]) {
      const p = rowToProgress(row)
      progressMap.set(p.lessonId, p)
    }

    setLessons(filtered)
    setProgress(progressMap)
    setLoading(false)
  }

  useEffect(() => { void load() }, [session])

  async function handleComplete(starsEarned: number) {
    if (!session || !activeLesson) return
    await supabase.rpc('complete_k5_lesson', {
      p_student_id:   session.dbId,
      p_lesson_id:    activeLesson.id,
      p_stars_earned: starsEarned,
      p_badge_name:   activeLesson.badgeName,
      p_badge_emoji:  '🏅',
      p_lesson_title: activeLesson.title,
    })
  }

  function closePlayer() {
    setActiveLesson(null)
    void load()
  }

  if (activeLesson) {
    return (
      <K5LessonPlayer
        lesson={activeLesson}
        studentName={session?.fullName ?? ''}
        grade={session?.grade ?? ''}
        onClose={closePlayer}
        onComplete={handleComplete}
      />
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius:16, padding:'20px 22px' }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:4 }}>📚 My Lessons</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>Pick a lesson and start learning!</div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:`3px solid #E4EAF2`, borderTopColor:RED, animation:'spin 0.7s linear infinite' }} />
        </div>
      ) : lessons.length === 0 ? (
        <div style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, padding:'32px 20px', textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>📖</div>
          <div style={{ fontSize:15, fontWeight:800, color:NAVY, marginBottom:6 }}>No lessons assigned yet</div>
          <div style={{ fontSize:12, color:'#64748B', lineHeight:1.7 }}>
            Your teacher will add lessons soon. Check back here to start learning!
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {lessons.map((lesson, i) => {
            const col  = CARD_COLORS[i % CARD_COLORS.length]
            const prog = progress.get(lesson.id)
            const done = prog?.status === 'completed'

            return (
              <div key={lesson.id} style={{
                background:'#fff',
                border:`1.5px solid ${done ? '#22C55E' : '#E2E8F0'}`,
                borderRadius:14,
                padding:16,
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14 }}>
                  <div style={{
                    width:54, height:54, borderRadius:14,
                    background: col.bg,
                    border:`2px solid ${col.border}40`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:28, flexShrink:0,
                  }}>
                    📚
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:NAVY }}>{lesson.title}</div>
                      {done && (
                        <span style={{ fontSize:10, fontWeight:800, background:'#DCFCE7', color:GREEN, padding:'2px 8px', borderRadius:10 }}>
                          Done ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:'#64748B' }}>
                      {lesson.subject} · {lesson.slides.length} slides · {lesson.quiz.length} questions · {lesson.estimatedMins} min
                    </div>
                    {done && prog?.starsEarned !== null && prog?.starsEarned !== undefined && (
                      <div style={{ fontSize:11, color:GOLD, marginTop:3, fontWeight:700 }}>
                        {'⭐'.repeat(prog.starsEarned)} {prog.starsEarned}/{lesson.quiz.length} stars
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setActiveLesson(lesson)}
                  style={{
                    width:'100%',
                    padding:'10px 14px',
                    borderRadius:10,
                    border: done ? `2px solid ${GREEN}40` : 'none',
                    background: done ? '#F0FDF4' : `linear-gradient(135deg,${NAVY},#2A4A7E)`,
                    color: done ? GREEN : '#fff',
                    fontSize:13,
                    fontWeight:800,
                    cursor:'pointer',
                    fontFamily:'inherit',
                  }}
                >
                  {done ? '🔁 Review lesson' : '▶ Start lesson'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
