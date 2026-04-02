import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }

const PT_METHODOLOGIES: Record<number, string> = {
  1: 'Global Issues Mapping', 2: 'Design Thinking', 3: 'Systems Thinking', 4: 'Research & Analysis',
  5: 'Problem-Based Learning', 6: 'Community Action', 7: 'Entrepreneurship', 8: 'Innovation Challenge',
  9: 'Service Learning', 10: 'Cultural Exchange', 11: 'Environmental Science', 12: 'Data Science',
  13: 'Creative Arts', 14: 'Digital Media', 15: 'Debate & Persuasion', 16: 'STEM Challenge',
  17: 'Social Enterprise', 18: 'Philosophy & Ethics', 19: 'Global Health', 20: 'Technology & Society',
  21: 'Future Cities', 22: 'Peace & Conflict', 23: 'Economic Justice', 24: 'Bioscience Frontiers',
  25: 'Leadership & Governance', 26: 'Cross-Cultural Communication', 27: 'Capstone Exhibition',
}
const CORE_COMPETENCIES = ['Collaboration', 'Communication', 'Critical Thinking', 'Creativity']
const STATUS_META: Record<string, { bg: string; tc: string }> = {
  'Not Assigned': { bg: '#F3F4F6', tc: '#6B7280' },
  'Assigned': { bg: '#E6F4FF', tc: '#0369A1' },
  'In Progress': { bg: '#FFF3E0', tc: '#B45309' },
  'Work Uploaded': { bg: '#EDE9FE', tc: '#5B21B6' },
  'Under Review': { bg: '#FFF3E0', tc: '#92400E' },
  'Approved': { bg: '#E8FBF0', tc: '#0E6B3B' },
  'Resubmission Required': { bg: '#FEE2E2', tc: '#991B1B' },
}

interface PTAssignment { id: string; methodology_n: number; quarter: string; status: string; due_date: string }
interface PTEvaluation { overall: number; competencies: Record<string, number>; comment: string; mastery: boolean }

export function SPProjectPage() {
  const { session } = useStudentPortal()
  const [assignments, setAssignments] = useState<PTAssignment[]>([])
  const [evaluations, setEvaluations] = useState<Record<string, PTEvaluation>>({})
  const [selQ, setSelQ] = useState('All')

  useEffect(() => {
    if (!session) return
    async function load() {
      const { data: a } = await supabase.from('pt_assignments').select('*').eq('student_id', session!.dbId).order('quarter')
      if (a) {
        setAssignments(a.map((r: Record<string, unknown>) => ({ id: r.id as string, methodology_n: r.methodology_n as number, quarter: r.quarter as string, status: r.status as string, due_date: (r.due_date as string) ?? '' })))
        const ids = a.map((r: Record<string, unknown>) => r.id as string)
        if (ids.length > 0) {
          const { data: ev } = await supabase.from('pt_evaluations').select('*').in('assignment_id', ids)
          if (ev) {
            const m: Record<string, PTEvaluation> = {}
            ev.forEach((e: Record<string, unknown>) => { m[e.assignment_id as string] = { overall: (e.overall as number) ?? 0, competencies: (e.competencies as Record<string, number>) ?? {}, comment: (e.comment as string) ?? '', mastery: (e.mastery as boolean) ?? false } })
            setEvaluations(m)
          }
        }
      }
    }
    load()
  }, [session])

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const filtered = selQ === 'All' ? assignments : assignments.filter(a => a.quarter === selQ)

  const overallStats = {
    total: assignments.length,
    approved: assignments.filter(a => a.status === 'Approved').length,
    mastery: Object.values(evaluations).filter(e => e.mastery).length,
    avgScore: Object.values(evaluations).length > 0
      ? Math.round(Object.values(evaluations).reduce((s, e) => s + e.overall, 0) / Object.values(evaluations).length * 10) / 10
      : null,
  }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>My AWSC-27 Projects</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Track your 27-methodology project journey</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Assigned', value: overallStats.total, color: '#1A365E' },
          { label: 'Approved', value: overallStats.approved, color: '#10B981' },
          { label: 'Mastery', value: overallStats.mastery, color: '#8B5CF6' },
          { label: 'Avg Score', value: overallStats.avgScore !== null ? `${overallStats.avgScore}/4` : '—', color: '#D61F31' },
        ].map(c => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={selQ} onChange={e => setSelQ(e.target.value)} style={iStyle}>
          <option value="All">All Quarters</option>
          {quarters.map(q => <option key={q}>{q}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(a => {
          const sm = STATUS_META[a.status] ?? { bg: '#F3F4F6', tc: '#6B7280' }
          const ev = evaluations[a.id]
          return (
            <div key={a.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ev ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>#{a.methodology_n}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{PT_METHODOLOGIES[a.methodology_n]}</div>
                    <div style={{ fontSize: 12, color: '#7A92B0' }}>{a.quarter}{a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString()}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {ev && <span style={{ fontSize: 14, fontWeight: 800, color: ev.mastery ? '#0E6B3B' : '#7A92B0' }}>{ev.overall}/4</span>}
                  <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.tc }}>{a.status}</span>
                </div>
              </div>

              {ev && (
                <div style={{ paddingTop: 12, borderTop: '1px solid #F0F4F8' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {CORE_COMPETENCIES.map(comp => (
                      <div key={comp} style={{ background: '#F7F9FC', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 2 }}>{comp.split(' ')[0]}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1A365E' }}>{ev.competencies?.[comp] ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                  {ev.comment && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 8, fontStyle: 'italic' }}>"{ev.comment}"</div>}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#7A92B0', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2' }}>No projects assigned yet.</div>}
      </div>
    </div>
  )
}
