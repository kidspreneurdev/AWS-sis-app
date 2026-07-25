import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface PeriodPoint { grading_period: string; mastery_pct: number | null; how_pct: number | null }

interface MHSTrendChartProps {
  studentId: string
}

/** Hand-rolled SVG line chart (matching SkillRadar's style, no new charting
 *  dependency) plotting Mastery and HOW trend as separate lines across the
 *  year's closed grading periods — spec section 12's Skill Graph addition. */
export function MHSTrendChart({ studentId }: MHSTrendChartProps) {
  const [points, setPoints] = useState<PeriodPoint[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('mhs_period_snapshots')
        .select('grading_period,mastery_pct,how_pct,computed_at')
        .eq('student_id', studentId)
        .order('computed_at', { ascending: true })
      if (!cancelled) setPoints(data ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [studentId])

  if (points.length === 0) {
    return <div style={{ ...card, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No grading periods closed yet for MS/HS gated courses.</div>
  }

  const W = 520, H = 200, padL = 36, padR = 16, padT = 16, padB = 28
  const plotW = W - padL - padR, plotH = H - padT - padB
  const n = points.length
  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const yAt = (pct: number) => padT + plotH * (1 - pct / 100)

  function linePath(key: 'mastery_pct' | 'how_pct') {
    const coords = points.map((p, i) => ({ x: xAt(i), y: p[key] !== null ? yAt(p[key] as number) : null }))
    const segments: string[] = []
    let started = false
    coords.forEach((c) => {
      if (c.y === null) { started = false; return }
      segments.push(`${started ? 'L' : 'M'} ${c.x} ${c.y}`)
      started = true
    })
    return segments.join(' ')
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>MS/HS Mastery &amp; HOW Trend</div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 11 }}>
        <span style={{ color: '#1A365E', fontWeight: 700 }}>● Mastery</span>
        <span style={{ color: '#D97706', fontWeight: 700 }}>● Habits of Work</span>
      </div>
      <svg width={W} height={H}>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke="#F1F5F9" strokeWidth={1} />
            <text x={padL - 8} y={yAt(g) + 3} fontSize={9} fill="#94A3B8" textAnchor="end">{g}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.grading_period} x={xAt(i)} y={H - 8} fontSize={9} fill="#7A92B0" textAnchor="middle">{p.grading_period}</text>
        ))}
        <path d={linePath('mastery_pct')} fill="none" stroke="#1A365E" strokeWidth={2} />
        <path d={linePath('how_pct')} fill="none" stroke="#D97706" strokeWidth={2} />
        {points.map((p, i) => (
          <g key={`pts-${p.grading_period}`}>
            {p.mastery_pct !== null && <circle cx={xAt(i)} cy={yAt(p.mastery_pct)} r={3.5} fill="#1A365E" />}
            {p.how_pct !== null && <circle cx={xAt(i)} cy={yAt(p.how_pct)} r={3.5} fill="#D97706" />}
          </g>
        ))}
      </svg>
    </div>
  )
}
