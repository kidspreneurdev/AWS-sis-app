import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const SKILLS = [
  'Critical Thinking', 'Collaboration', 'Communication', 'Creativity',
  'Research', 'Leadership', 'Problem Solving', 'Digital Literacy',
  'Global Awareness', 'Emotional Intelligence',
]

interface SkillScore { skill: string; teacher_score: number; self_score: number }

export function SPSkillsPage() {
  const { session } = useStudentPortal()
  const [scores, setScores] = useState<SkillScore[]>([])
  const [selfScores, setSelfScores] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session) return
    async function load() {
      const [{ data: ts }, { data: ss }] = await Promise.all([
        supabase.from('skill_assessments').select('skill,score').eq('student_id', session!.dbId),
        supabase.from('self_assessments').select('skill,score').eq('student_id', session!.dbId),
      ])
      const tMap: Record<string, number> = {}
      if (ts) ts.forEach((r: Record<string, unknown>) => { tMap[r.skill as string] = r.score as number })
      const sMap: Record<string, number> = {}
      if (ss) ss.forEach((r: Record<string, unknown>) => { sMap[r.skill as string] = r.score as number })
      setSelfScores(sMap)
      setScores(SKILLS.map(s => ({ skill: s, teacher_score: tMap[s] ?? 0, self_score: sMap[s] ?? 3 })))
    }
    load()
  }, [session])

  async function saveSelfScores() {
    setSaving(true)
    const rows = SKILLS.map(skill => ({ student_id: session!.dbId, skill, score: selfScores[skill] ?? 3 }))
    await supabase.from('self_assessments').upsert(rows, { onConflict: 'student_id,skill' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const getColor = (score: number) => score >= 4 ? '#10B981' : score >= 3 ? '#3B82F6' : score >= 2 ? '#F59E0B' : '#D61F31'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Skill Graph</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>360° skill assessment — teacher vs self-evaluation</p></div>
        <button onClick={saveSelfScores} disabled={saving} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: saved ? '#10B981' : '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Self-Assessment'}
        </button>
      </div>

      <div style={{ ...card, padding: '16px 20px', display: 'flex', gap: 20, fontSize: 12, color: '#7A92B0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#1A365E' }} /><span>Teacher Score</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 2, background: '#D61F31' }} /><span>Your Self-Assessment</span></div>
        <span>Scale: 1 (Emerging) → 4 (Mastery)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scores.map(s => (
          <div key={s.skill} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A365E' }}>{s.skill}</span>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {s.teacher_score > 0 && <span style={{ fontSize: 12, color: '#7A92B0' }}>Teacher: <strong style={{ color: getColor(s.teacher_score) }}>{s.teacher_score}/4</strong></span>}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map(v => (
                    <button
                      key={v}
                      onClick={() => setSelfScores(p => ({ ...p, [s.skill]: v }))}
                      style={{ width: 32, height: 28, borderRadius: 6, border: (selfScores[s.skill] ?? 3) === v ? '2px solid #D61F31' : '2px solid #E4EAF2', background: (selfScores[s.skill] ?? 3) === v ? '#FEE2E2' : '#F7F9FC', color: (selfScores[s.skill] ?? 3) === v ? '#D61F31' : '#7A92B0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >{v}</button>
                  ))}
                </div>
              </div>
            </div>
            {s.teacher_score > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, height: 6, background: '#E4EAF2', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(s.teacher_score / 4) * 100}%`, background: '#1A365E', borderRadius: 3 }} />
                </div>
                <div style={{ flex: 1, height: 6, background: '#E4EAF2', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${((selfScores[s.skill] ?? 3) / 4) * 100}%`, background: '#D61F31', borderRadius: 3 }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
