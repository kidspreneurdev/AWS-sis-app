import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const NAVY = '#1A365E'
const RED = '#D61F31'
const GOLD = '#FAC600'
const GREEN = '#16A34A'

const SUBJECT_EMOJI: Record<string, string> = {
  maths: '🔢', math: '🔢', mathematics: '🔢',
  english: '📖', 'language arts': '📖', reading: '📖',
  science: '🔬',
  art: '🎨',
  pe: '⚽', 'physical education': '⚽',
  music: '🎵',
  'social studies': '🌍',
}

function subjectEmoji(s: string) {
  return SUBJECT_EMOJI[s.toLowerCase()] ?? '📚'
}

const TILE_COLORS = [
  { bg: '#DBEAFE', accent: '#3B82F6' },
  { bg: '#DCFCE7', accent: '#22C55E' },
  { bg: '#EDE9FE', accent: '#A78BFA' },
  { bg: '#FEF3C7', accent: '#FAC600' },
  { bg: '#FEE2E2', accent: '#F87171' },
  { bg: '#E0F2FE', accent: '#38BDF8' },
]

function gradeColor(pct: number) {
  if (pct >= 90) return GREEN
  if (pct >= 80) return '#0EA5E9'
  if (pct >= 70) return GOLD
  if (pct >= 60) return '#F97316'
  return RED
}

function letterFromPct(pct: number) {
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A−'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B−'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C−'
  return 'D'
}

function gradeEmoji(pct: number) {
  if (pct >= 90) return '🌟'
  if (pct >= 80) return '😊'
  if (pct >= 70) return '👍'
  return '💪'
}

interface GradeRow { id: string; subject: string; grade: number; letter_grade: string; term: string }
interface RemarkRow { id: string; term: string; content: string; author: string }

export function K5GradesPage() {
  const { session } = useStudentPortal()
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [remarks, setRemarks] = useState<RemarkRow[]>([])
  const [selectedTerm, setSelectedTerm] = useState<string>('')

  useEffect(() => {
    if (!session) return
    void Promise.all([
      supabase.from('grades').select('id,subject,grade,letter_grade,term').eq('student_id', session.dbId).order('subject'),
      supabase.from('grade_remarks').select('id,term,content,author').eq('student_id', session.dbId).order('created_at', { ascending: false }),
    ]).then(([gr, re]) => {
      const gradeData = (gr.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        subject: (r.subject as string) ?? '',
        grade: Number(r.grade ?? 0),
        letter_grade: (r.letter_grade as string) ?? '',
        term: (r.term as string) ?? '',
      }))
      setGrades(gradeData)
      setRemarks((re.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        term: (r.term as string) ?? '',
        content: (r.content as string) ?? '',
        author: (r.author as string) ?? '',
      })))
      // Default to the first term found
      const terms = [...new Set(gradeData.map(g => g.term).filter(Boolean))]
      if (terms.length) setSelectedTerm(terms[0])
    })
  }, [session])

  const terms = useMemo(() => [...new Set(grades.map(g => g.term).filter(Boolean))], [grades])

  const filteredGrades = useMemo(() => (
    selectedTerm ? grades.filter(g => g.term === selectedTerm) : grades
  ), [grades, selectedTerm])

  const termRemarks = useMemo(() => (
    selectedTerm ? remarks.filter(r => r.term === selectedTerm) : remarks
  ), [remarks, selectedTerm])

  const avgPct = useMemo(() => {
    if (!filteredGrades.length) return null
    return Math.round(filteredGrades.reduce((s, g) => s + g.grade, 0) / filteredGrades.length)
  }, [filteredGrades])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},#2A4A7E)`, borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📊 My Grades</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>How you are doing in each subject</div>
        {avgPct !== null && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.1)', borderRadius: 12, padding: '8px 16px' }}>
            <span style={{ fontSize: 22 }}>{gradeEmoji(avgPct)}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>{avgPct}%</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>Overall average</div>
            </div>
          </div>
        )}
      </div>

      {/* Term selector */}
      {terms.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {terms.map(t => (
            <button key={t} onClick={() => setSelectedTerm(t)} style={{
              padding: '6px 16px', borderRadius: 20, border: '1.5px solid',
              borderColor: selectedTerm === t ? NAVY : '#E2E8F0',
              background: selectedTerm === t ? NAVY : '#fff',
              color: selectedTerm === t ? '#fff' : '#64748B',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Subject tiles */}
      {filteredGrades.length === 0 ? (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>No grade data available yet.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {filteredGrades.map((g, i) => {
            const col = TILE_COLORS[i % TILE_COLORS.length]
            const letter = g.letter_grade || letterFromPct(g.grade)
            const pct = g.grade
            return (
              <div key={g.id} style={{ background: col.bg, border: `2px solid ${col.accent}40`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {subjectEmoji(g.subject)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{g.subject}</div>
                    {g.term && <div style={{ fontSize: 10, color: '#64748B' }}>{g.term}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: gradeColor(pct) }}>{letter}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{pct}%</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,.6)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: gradeColor(pct), borderRadius: 6, transition: 'width .4s' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#64748B', textAlign: 'right' }}>{gradeEmoji(pct)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Teacher notes */}
      {termRemarks.length > 0 && (
        <div style={{ background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12 }}>💬 Teacher Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {termRemarks.map(r => (
              <div key={r.id} style={{ background: '#F0F7FF', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
                {r.author && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>{r.author}</div>
                )}
                <div style={{ fontSize: 12, color: '#1E3A5F', lineHeight: 1.7 }}>{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grade key */}
      <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Grade Guide</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { range: '90–100%', letter: 'A', color: GREEN, emoji: '🌟' },
            { range: '80–89%', letter: 'B', color: '#0EA5E9', emoji: '😊' },
            { range: '70–79%', letter: 'C', color: GOLD, emoji: '👍' },
            { range: 'Below 70%', letter: 'D/F', color: RED, emoji: '💪' },
          ].map(g => (
            <div key={g.letter} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 14 }}>{g.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: g.color }}>{g.letter}</span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>{g.range}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
