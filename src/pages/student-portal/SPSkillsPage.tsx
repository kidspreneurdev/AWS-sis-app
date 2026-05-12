import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const COMPETENCIES = {
  entrepreneurial: [
    { key: 'opportunity', label: 'Opportunity Recognition' },
    { key: 'risk', label: 'Risk Assessment' },
    { key: 'resourcefulness', label: 'Resourcefulness' },
    { key: 'pitching', label: 'Pitching & Persuasion' },
    { key: 'financialLiteracy', label: 'Financial Literacy' },
  ],
  academic: [
    { key: 'criticalAnalysis', label: 'Critical Analysis' },
    { key: 'quantReasoning', label: 'Quantitative Reasoning' },
    { key: 'scientificMethod', label: 'Scientific Method' },
    { key: 'communication', label: 'Communication' },
    { key: 'research', label: 'Research Skills' },
  ],
  leadership: [
    { key: 'decisionMaking', label: 'Decision Making' },
    { key: 'teamCollab', label: 'Team Collaboration' },
    { key: 'conflictResolution', label: 'Conflict Resolution' },
    { key: 'empathy', label: 'Empathy' },
    { key: 'influence', label: 'Influence & Leadership' },
  ],
  global: [
    { key: 'crossCultural', label: 'Cross-Cultural Communication' },
    { key: 'systemsThinking', label: 'Systems Thinking' },
    { key: 'ethicalReasoning', label: 'Ethical Reasoning' },
    { key: 'digitalFluency', label: 'Digital Fluency' },
    { key: 'sustainability', label: 'Sustainability Mindset' },
  ],
}

const CAT_LABELS: Record<string, string> = {
  entrepreneurial: 'Entrepreneurial',
  academic: 'Academic',
  leadership: 'Leadership',
  global: 'Global Citizenship',
}

const COMP_COLORS: Record<string, string> = {
  entrepreneurial: '#FAC600',
  academic: '#1A365E',
  leadership: '#D61F31',
  global: '#0A6B64',
}

const SKILL_LABELS = ['Not Assessed', 'Beginning', 'Developing', 'Proficient', 'Advanced', 'Expert']

const ALL_COMPS = [
  ...COMPETENCIES.entrepreneurial,
  ...COMPETENCIES.academic,
  ...COMPETENCIES.leadership,
  ...COMPETENCIES.global,
]

type Scores = Record<string, number>

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

// ─── Dual Radar Chart ─────────────────────────────────────────────────────────

function ComparisonRadar({ teacher, self: selfS }: { teacher: Scores; self: Scores }) {
  const n = ALL_COMPS.length
  const cx = 175, cy = 175, maxR = 130, levels = 5
  const angle = (i: number) => (2 * Math.PI * i / n) - Math.PI / 2
  const pt = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) })

  const gridPolygons = Array.from({ length: levels }, (_, li) => {
    const r = maxR * (li + 1) / levels
    return ALL_COMPS.map((_, j) => { const p = pt(j, r); return `${p.x},${p.y}` }).join(' ')
  })

  const teacherPoly = ALL_COMPS.map((c, j) => {
    const r = maxR * Math.max(0, teacher[c.key] || 0) / 5
    const p = pt(j, r)
    return `${p.x},${p.y}`
  }).join(' ')

  const selfPoly = ALL_COMPS.map((c, j) => {
    const r = maxR * Math.max(0, selfS[c.key] || 0) / 5
    const p = pt(j, r)
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <svg width="350" height="350" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#E4EAF2" strokeWidth={i === levels - 1 ? 1.5 : 0.75} />
      ))}
      {ALL_COMPS.map((_, j) => {
        const p = pt(j, maxR)
        return <line key={j} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E4EAF2" strokeWidth={0.5} />
      })}
      <polygon points={teacherPoly} fill="rgba(26,54,94,0.15)" stroke="#1A365E" strokeWidth={2.5} strokeLinejoin="round" />
      <polygon points={selfPoly} fill="rgba(214,31,49,0.12)" stroke="#D61F31" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6,3" />
      {[1, 2, 3, 4, 5].map(lvl => (
        <text key={lvl} x={cx + 4} y={cy - maxR * lvl / 5 - 2} fontSize={8} fill="#BDD0E8">{lvl}</text>
      ))}
      {ALL_COMPS.map((c, j) => {
        const p = pt(j, maxR + 18)
        const anchor = p.x < cx - 4 ? 'end' : p.x > cx + 4 ? 'start' : 'middle'
        return (
          <text key={j} x={p.x} y={p.y + 3} fontSize={8} fill="#7A92B0" textAnchor={anchor}>
            {c.label.split(' ')[0]}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SPSkillsPage() {
  const { session } = useStudentPortal()
  const [teacherScores, setTeacherScores] = useState<Scores>({})
  const [selfScores, setSelfScores] = useState<Scores>({})
  const [savedSelfScores, setSavedSelfScores] = useState<Scores | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session) return
    async function load() {
      const [{ data: ts }, { data: ss }] = await Promise.all([
        supabase.from('hs_skill_scores').select('scores').eq('student_id', session!.dbId).single(),
        supabase.from('hs_self_assessments').select('scores').eq('student_id', session!.dbId).single(),
      ])
      if (ts?.scores) setTeacherScores(ts.scores as Scores)
      if (ss?.scores) {
        setSelfScores(ss.scores as Scores)
        setSavedSelfScores(ss.scores as Scores)
      }
    }
    load()
  }, [session])

  async function saveSelfScores() {
    if (!session) return
    setSaving(true)
    await supabase.from('hs_self_assessments').upsert(
      { student_id: session.dbId, scores: selfScores, updated_at: new Date().toISOString() },
      { onConflict: 'student_id' }
    )
    setSavedSelfScores({ ...selfScores })
    setSaving(false)
    setSaved(true)
  }

  const hasTeacher = Object.values(teacherScores).some(v => v > 0)
  const hasComparison = savedSelfScores !== null && hasTeacher

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Skill Graph</h1>
          <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>
            Rate yourself on each competency — your self-assessment will be compared against your teacher's evaluation.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {savedSelfScores !== null && (
            <button
              onClick={() => { setSelfScores({}); setSavedSelfScores(null); setSaved(false) }}
              style={{
                padding: '9px 16px', borderRadius: 8, border: '1.5px solid #E4EAF2',
                background: '#fff', color: '#1A365E', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              ↺ Retake
            </button>
          )}
          <button
            onClick={saveSelfScores}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: saved ? '#10B981' : '#D61F31',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Self-Assessment'}
          </button>
        </div>
      </div>

      {/* Scale legend */}
      <div style={{ ...card, padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scale:</span>
        {SKILL_LABELS.slice(1).map((lbl, i) => (
          <span key={lbl} style={{ fontSize: 12, color: '#1A365E' }}>
            <strong>{i + 1}</strong> — {lbl}
          </span>
        ))}
      </div>

      {/* Self-assessment form grouped by category */}
      {(Object.entries(COMPETENCIES) as [string, { key: string; label: string }[]][]).map(([cat, comps]) => (
        <div key={cat} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COMP_COLORS[cat], flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{CAT_LABELS[cat]}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {comps.map(c => {
              const val = selfScores[c.key] || 0
              const tVal = teacherScores[c.key] || 0
              return (
                <div key={c.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{c.label}</span>
                      {val > 0 && (
                        <span style={{ fontSize: 11, color: COMP_COLORS[cat], fontWeight: 600 }}>
                          {SKILL_LABELS[val]}
                        </span>
                      )}
                    </div>
                    {tVal > 0 && (
                      <span style={{ fontSize: 11, color: '#7A92B0' }}>
                        Teacher: <strong style={{ color: '#1A365E' }}>{SKILL_LABELS[tVal]}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => { setSaved(false); setSelfScores(p => ({ ...p, [c.key]: lvl })) }}
                        style={{
                          flex: 1, height: 32, borderRadius: 7, border: 'none',
                          background: lvl <= val ? COMP_COLORS[cat] : '#F0F4F8',
                          color: lvl <= val ? '#fff' : '#94A3B8',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          transition: 'all 0.12s',
                        }}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Prompt to save before comparison appears */}
      {!hasComparison && Object.keys(selfScores).length > 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '18px 20px', color: '#7A92B0', fontSize: 13 }}>
          Press <strong style={{ color: '#D61F31' }}>Save Self-Assessment</strong> to see your comparison graph.
        </div>
      )}

      {/* Comparison section */}
      {hasComparison && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Radar chart */}
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A365E', marginBottom: 2 }}>Comparison Graph</div>
            <p style={{ fontSize: 12, color: '#7A92B0', margin: '0 0 16px' }}>
              Your self-assessment vs. your teacher's evaluation
            </p>
            <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="28" height="4"><rect width="28" height="4" rx="2" fill="#1A365E" /></svg>
                <span style={{ fontSize: 12, color: '#7A92B0' }}>Teacher Assessment</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="28" height="4">
                  <line x1="0" y1="2" x2="28" y2="2" stroke="#D61F31" strokeWidth="3" strokeDasharray="6,3" />
                </svg>
                <span style={{ fontSize: 12, color: '#7A92B0' }}>Your Self-Assessment</span>
              </div>
            </div>
            <ComparisonRadar teacher={teacherScores} self={savedSelfScores} />
          </div>

          {/* Per-skill bar breakdown */}
          {(Object.entries(COMPETENCIES) as [string, { key: string; label: string }[]][]).map(([cat, comps]) => (
            <div key={cat} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: COMP_COLORS[cat] }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{CAT_LABELS[cat]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {comps.map(c => {
                  const tVal = teacherScores[c.key] || 0
                  const sVal = savedSelfScores[c.key] || 0
                  const diff = sVal - tVal
                  return (
                    <div key={c.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{c.label}</span>
                        {tVal > 0 && sVal > 0 && (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: diff > 0 ? '#F59E0B' : diff < 0 ? '#D61F31' : '#10B981',
                          }}>
                            {diff > 0 ? `+${diff} self-rated higher` : diff < 0 ? `${Math.abs(diff)} below teacher` : '✓ Aligned'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#7A92B0', width: 52, flexShrink: 0 }}>Teacher</span>
                          <div style={{ flex: 1, height: 8, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(tVal / 5) * 100}%`, background: '#1A365E', borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', width: 24, textAlign: 'right' }}>
                            {tVal > 0 ? tVal : '–'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#7A92B0', width: 52, flexShrink: 0 }}>You</span>
                          <div style={{ flex: 1, height: 8, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(sVal / 5) * 100}%`, background: '#D61F31', borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#D61F31', width: 24, textAlign: 'right' }}>
                            {sVal > 0 ? sVal : '–'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No teacher scores yet */}
      {!hasTeacher && (
        <div style={{ ...card, textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>Awaiting Teacher Assessment</div>
          <div style={{ fontSize: 12, color: '#7A92B0' }}>
            Once your teacher submits your competency scores, the comparison graph will appear here.
          </div>
        </div>
      )}
    </div>
  )
}
