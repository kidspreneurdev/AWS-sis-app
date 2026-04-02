import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

interface Goal {
  id: string
  studentId: string
  studentName: string
  grade: number | null
  term: string | null
  status: string
  category: string
  objective: string
  progress: number
  keyResults: { text: string; done: boolean }[]
  reflection: string | null
  updatedAt: string | null
}

interface Student {
  id: string
  firstName: string
  lastName: string
  grade: number | null
}

const STATUS_META: Record<string, { bg: string; tc: string }> = {
  'On Track':  { bg: '#DCFCE7', tc: '#059669' },
  'At Risk':   { bg: '#FEE2E2', tc: '#D61F31' },
  'Achieved':  { bg: '#EDE9FE', tc: '#7C3AED' },
  'Paused':    { bg: '#F3F4F6', tc: '#94A3B8' },
  'Not Started': { bg: '#FEF3C7', tc: '#B45309' },
}

const PROG_COLOR = (p: number) => p >= 75 ? '#059669' : p >= 40 ? '#F59E0B' : '#D61F31'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

export function StudentGoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterCategory, setFilterCategory] = useState('All')

  async function load() {
    setLoading(true)
    const [{ data: gData }, { data: sData }] = await Promise.all([
      supabase.from('goals').select('*').order('updated_at', { ascending: false }),
      supabase.from('students').select('id,first_name,last_name,grade').in('status', ['Enrolled', 'Alumni']),
    ])
    const stuMap: Record<string, Student> = {}
    if (sData) {
      const mapped = sData.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        grade: typeof r.grade === 'number' ? r.grade : null,
      }))
      setStudents(mapped)
      mapped.forEach(s => { stuMap[s.id] = s })
    }
    if (gData) {
      setGoals(gData.map((r: Record<string, unknown>) => {
        const stu = stuMap[r.student_id as string]
        const krs = Array.isArray(r.key_results)
          ? (r.key_results as Record<string, unknown>[]).map(k => ({
              text: (k.text ?? k.description ?? '') as string,
              done: !!(k.done ?? k.completed),
            }))
          : []
        return {
          id: r.id as string,
          studentId: r.student_id as string,
          studentName: stu ? [stu.firstName, stu.lastName].filter(Boolean).join(' ') : (r.student_id as string),
          grade: stu?.grade ?? null,
          term: (r.term as string) ?? null,
          status: (r.status as string) ?? 'Not Started',
          category: (r.category as string) ?? '',
          objective: (r.objective as string) ?? '',
          progress: typeof r.progress === 'number' ? r.progress : 0,
          keyResults: krs,
          reflection: (r.reflection as string) ?? null,
          updatedAt: (r.updated_at as string) ?? null,
        }
      }))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() =>
    Array.from(new Set(goals.map(g => g.category).filter(Boolean))).sort(), [goals])

  const filtered = useMemo(() => goals.filter(g => {
    if (filterStudent && g.studentId !== filterStudent) return false
    if (filterStatus !== 'All' && g.status !== filterStatus) return false
    if (filterCategory !== 'All' && g.category !== filterCategory) return false
    if (search) {
      const q = search.toLowerCase()
      if (!g.objective.toLowerCase().includes(q) && !g.category.toLowerCase().includes(q)) return false
    }
    return true
  }), [goals, filterStudent, filterStatus, filterCategory, search])

  const onTrack = goals.filter(g => g.status === 'On Track').length
  const atRisk = goals.filter(g => g.status === 'At Risk').length
  const avgProg = goals.length
    ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
    : 0

  const iStyle: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2',
    fontSize: 13, color: '#1A365E', background: '#fff',
  }

  const headerPortal = useHeaderActions(
    <button onClick={load} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>↻ Refresh</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Goals',  val: goals.length,  col: '#1A365E', bg: '#EEF3FF' },
          { label: 'On Track',     val: onTrack,       col: '#059669', bg: '#DCFCE7' },
          { label: 'At Risk',      val: atRisk,        col: '#D61F31', bg: '#FEE2E2' },
          { label: 'Avg Progress', val: avgProg + '%', col: '#7C3AED', bg: '#EDE9FE' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130, background: c.bg, border: 'none' }}>
            <div style={{ fontSize: 11, color: c.col, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.col, marginTop: 6 }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search objectives…"
          style={{ ...iStyle, width: 220 }}
        />
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} style={iStyle}>
          <option value="">All Students</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>
              {[s.firstName, s.lastName].filter(Boolean).join(' ')} {s.grade ? `(Gr ${s.grade})` : ''}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={iStyle}>
          <option value="All">All Statuses</option>
          {['On Track', 'At Risk', 'Achieved', 'Paused', 'Not Started'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={iStyle}>
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#7A92B0' }}>{filtered.length} goals</span>
        <button
          onClick={load}
          style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, cursor: 'pointer' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 60, color: '#7A92B0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {goals.length === 0
              ? 'No student goals on file yet. Goals are set by students in their portal.'
              : 'No goals match the current filters.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(g => {
            const meta = STATUS_META[g.status] ?? { bg: '#F3F4F6', tc: '#6B7280' }
            const doneKRs = g.keyResults.filter(k => k.done).length
            const progColor = PROG_COLOR(g.progress)
            return (
              <div key={g.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{g.studentName}</div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                      {g.grade ? `Grade ${g.grade}` : ''}{g.grade && g.term ? ' · ' : ''}{g.term ?? ''}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, background: meta.bg, color: meta.tc, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {g.status}
                  </span>
                </div>

                {/* Category + Objective */}
                <div>
                  {g.category && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      {g.category}
                    </div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A365E', lineHeight: 1.4 }}>{g.objective}</div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7A92B0', marginBottom: 4 }}>
                    <span>Progress</span>
                    <span style={{ fontWeight: 700, color: progColor }}>{g.progress}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#F0F4F8', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.progress}%`, background: progColor, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {/* Key Results */}
                {g.keyResults.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 6 }}>
                      Key Results: <strong>{doneKRs}/{g.keyResults.length} complete</strong>
                    </div>
                    {g.keyResults.slice(0, 3).map((kr, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4, fontSize: 12, color: kr.done ? '#94A3B8' : '#1A365E' }}>
                        <span style={{ color: kr.done ? '#059669' : '#CBD5E1', flexShrink: 0, marginTop: 1 }}>{kr.done ? '✓' : '○'}</span>
                        <span style={{ textDecoration: kr.done ? 'line-through' : 'none' }}>{kr.text}</span>
                      </div>
                    ))}
                    {g.keyResults.length > 3 && (
                      <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>…+{g.keyResults.length - 3} more</div>
                    )}
                  </div>
                )}

                {/* Reflection */}
                {g.reflection && (
                  <div style={{ borderLeft: '3px solid #7C3AED', paddingLeft: 10, fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                    💭 {g.reflection.slice(0, 120)}{g.reflection.length > 120 ? '…' : ''}
                  </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 11, color: '#94A3B8', marginTop: 'auto', paddingTop: 4, borderTop: '1px solid #F0F4F8' }}>
                  {g.updatedAt ? new Date(g.updatedAt).toLocaleDateString() : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div></>
  )
}
