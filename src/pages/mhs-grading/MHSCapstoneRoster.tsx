import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MHSCapstoneScorer } from './MHSCapstoneScorer'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }
const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3, textTransform: 'uppercase' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }

interface MhsModule { id: string; title: string; sequence: number; capstone_weight_pct: number | null }
interface CapstoneRosterRow { studentId: string; studentName: string; componentId: string; rawScorePct: number | null }

interface MHSCapstoneRosterProps {
  mhsCourseId: string
}

/** Module-level capstone: its own module picker + roster, kept separate from
 *  the lesson-scoped component tabs above since capstone attaches to a module,
 *  not a lesson (spec section 8). */
export function MHSCapstoneRoster({ mhsCourseId }: MHSCapstoneRosterProps) {
  const [modules, setModules] = useState<MhsModule[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [roster, setRoster] = useState<CapstoneRosterRow[]>([])
  const [showNewModule, setShowNewModule] = useState(false)
  const [newModule, setNewModule] = useState({ title: '', weight: '20' })

  const loadModules = useCallback(async () => {
    const { data } = await supabase.from('mhs_modules').select('id,title,sequence,capstone_weight_pct').eq('mhs_course_id', mhsCourseId).order('sequence')
    setModules(data ?? [])
  }, [mhsCourseId])

  useEffect(() => { void loadModules() }, [loadModules])

  const loadRoster = useCallback(async (moduleId: string) => {
    const { data: enrolled } = await supabase
      .from('courses')
      .select('student_id,students(first_name,last_name)')
      .eq('mhs_course_id', mhsCourseId)

    // Dedupe by student: a student can have more than one `courses` row linked to the
    // same mhs_course_id (duplicate/legacy enrollment records) — see MHSGradingPage's
    // loadRoster for the same fix.
    const seenStudentIds = new Set<string>()
    const students: { studentId: string; studentName: string }[] = []
    for (const c of enrolled ?? []) {
      const sid = c.student_id as string
      if (seenStudentIds.has(sid)) continue
      seenStudentIds.add(sid)
      const s = c.students as unknown as { first_name: string | null; last_name: string | null } | null
      students.push({ studentId: sid, studentName: `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.trim() || '(unnamed student)' })
    }
    if (students.length === 0) {
      setRoster([])
      return
    }

    let { data: components } = await supabase
      .from('mhs_lesson_components')
      .select('id,student_id,raw_score_pct')
      .eq('module_id', moduleId)
      .eq('component_type', 'capstone')
      .in('student_id', students.map((s) => s.studentId))

    const missing = students.map((s) => s.studentId).filter((sid) => !components?.some((c) => c.student_id === sid))
    if (missing.length > 0) {
      // Best-effort — see MHSGradingPage.loadRoster for the same race rationale.
      await supabase.from('mhs_lesson_components').insert(
        missing.map((studentId) => ({ module_id: moduleId, student_id: studentId, component_type: 'capstone', status: 'not_started' }))
      )
      const { data: refreshed } = await supabase
        .from('mhs_lesson_components')
        .select('id,student_id,raw_score_pct')
        .eq('module_id', moduleId)
        .eq('component_type', 'capstone')
        .in('student_id', students.map((s) => s.studentId))
      components = refreshed
    }

    setRoster(
      students.map((s) => {
        const comp = components?.find((c) => c.student_id === s.studentId)
        return { studentId: s.studentId, studentName: s.studentName, componentId: comp?.id ?? '', rawScorePct: comp?.raw_score_pct ?? null }
      })
    )
  }, [mhsCourseId])

  useEffect(() => {
    if (selectedModuleId) void loadRoster(selectedModuleId)
  }, [selectedModuleId, loadRoster])

  async function createModule() {
    if (!newModule.title.trim()) return
    const { data } = await supabase
      .from('mhs_modules')
      .insert({ mhs_course_id: mhsCourseId, title: newModule.title.trim(), sequence: modules.length, capstone_weight_pct: Number(newModule.weight) || 20 })
      .select('id')
      .single()
    setNewModule({ title: '', weight: '20' })
    setShowNewModule(false)
    await loadModules()
    if (data) setSelectedModuleId(data.id)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8, textTransform: 'uppercase' }}>Modules</div>
          {modules.length === 0 && <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>No modules yet.</div>}
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModuleId(m.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 8, border: `1.5px solid ${selectedModuleId === m.id ? '#1A365E' : '#E4EAF2'}`, background: selectedModuleId === m.id ? '#1A365E' : '#F7F9FC', color: selectedModuleId === m.id ? '#fff' : '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {m.title} <span style={{ opacity: 0.7 }}>· {m.capstone_weight_pct}%</span>
            </button>
          ))}
          <button onClick={() => setShowNewModule((v) => !v)} style={{ ...btnPrimary, width: '100%', marginTop: 8, background: '#F7F9FC', color: '#1A365E', border: '1.5px solid #E4EAF2' }}>
            {showNewModule ? 'Cancel' : '+ New Module'}
          </button>
        </div>
        {showNewModule && (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={label}>Module title</label>
              <input value={newModule.title} onChange={(e) => setNewModule((p) => ({ ...p, title: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={label}>Capstone weight % (relative to a single lesson)</label>
              <input value={newModule.weight} onChange={(e) => setNewModule((p) => ({ ...p, weight: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={() => void createModule()} style={btnPrimary}>Save Module</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!selectedModuleId ? (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>Select a module to score its capstone defense.</div>
        ) : (
          roster.map((row) => (
            <div key={row.studentId} style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{row.studentName}</div>
              {row.componentId ? (
                <MHSCapstoneScorer componentId={row.componentId} existingScorePct={row.rawScorePct} onSaved={() => void loadRoster(selectedModuleId)} />
              ) : (
                <div style={{ fontSize: 11, color: '#7A92B0' }}>Loading…</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
