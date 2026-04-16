import { useState } from 'react'

export interface RubricLevel { label: string; points: number; description?: string }
export interface RubricCriterion { id: string; name: string; levels: RubricLevel[] }
export interface Rubric { criteria: RubricCriterion[] }

export function rubricParse(val: string): Rubric | null {
  if (!val) return null
  try { const r = JSON.parse(val); if (r && r.criteria) return r } catch { /* empty */ }
  return null
}
export function rubricMaxPoints(rubric: Rubric): number {
  return rubric.criteria.reduce((s, c) => s + c.levels.reduce((m, l) => Math.max(m, l.points), 0), 0)
}
export function rubricComputeScore(rubric: Rubric, sel: Record<string, number>): number {
  return rubric.criteria.reduce((s, c) => s + (sel[c.id] !== undefined ? sel[c.id] : 0), 0)
}
export function rubricScale(raw: number, rubMax: number, assignMax: number): number {
  return rubMax ? Math.round(raw / rubMax * assignMax) : raw
}

function newCriterionId() { return `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }

export function RubricBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rubric, setRubric] = useState<Rubric>(() => rubricParse(value) ?? { criteria: [] })
  const inp: React.CSSProperties = { padding: '5px 8px', borderRadius: 7, border: '1px solid #E4EAF2', fontSize: 11, color: '#1A365E', background: '#fff', width: '100%', boxSizing: 'border-box' }

  function commit(next: Rubric) {
    setRubric(next)
    onChange(JSON.stringify(next))
  }

  function addCriterion() {
    commit({
      criteria: [...rubric.criteria, {
        id: newCriterionId(), name: 'New Criterion',
        levels: [
          { label: 'Excellent', points: 4, description: '' },
          { label: 'Proficient', points: 3, description: '' },
          { label: 'Developing', points: 2, description: '' },
          { label: 'Beginning', points: 1, description: '' },
        ],
      }],
    })
  }

  function removeCriterion(cid: string) {
    commit({ criteria: rubric.criteria.filter(c => c.id !== cid) })
  }

  function updateCriterionName(cid: string, name: string) {
    commit({ criteria: rubric.criteria.map(c => c.id === cid ? { ...c, name } : c) })
  }

  function updateLevel(cid: string, li: number, field: 'label' | 'points' | 'description', val: string) {
    commit({
      criteria: rubric.criteria.map(c => c.id === cid ? {
        ...c,
        levels: c.levels.map((lv, i) => i === li ? { ...lv, [field]: field === 'points' ? Number(val) : val } : lv),
      } : c),
    })
  }

  function addLevel(cid: string) {
    commit({
      criteria: rubric.criteria.map(c => c.id === cid ? {
        ...c, levels: [...c.levels, { label: 'Level', points: 0, description: '' }],
      } : c),
    })
  }

  function removeLevel(cid: string, li: number) {
    commit({
      criteria: rubric.criteria.map(c => c.id === cid ? {
        ...c, levels: c.levels.filter((_, i) => i !== li),
      } : c),
    })
  }

  const maxPts = rubricMaxPoints(rubric)

  return (
    <div style={{ border: '1px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: '#F7F9FC', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E4EAF2' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>📐 Rubric Builder {maxPts > 0 && <span style={{ fontWeight: 400, color: '#7A92B0' }}>· {maxPts} pts max</span>}</span>
        <button type="button" onClick={addCriterion} style={{ padding: '4px 10px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>+ Add Criterion</button>
      </div>
      {rubric.criteria.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 11, color: '#94A3B8' }}>No criteria yet. Click "Add Criterion" to build a rubric.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rubric.criteria.map((c, ci) => (
          <div key={c.id} style={{ padding: '10px 12px', borderBottom: ci < rubric.criteria.length - 1 ? '1px solid #F0F4FA' : 'none', background: '#fff' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input value={c.name} onChange={e => updateCriterionName(c.id, e.target.value)} style={{ ...inp, fontWeight: 700, flex: 1 }} placeholder="Criterion name" />
              <button type="button" onClick={() => addLevel(c.id)} style={{ padding: '4px 8px', background: '#EEF3FF', color: '#1A365E', border: '1px solid #DDE6F0', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Level</button>
              <button type="button" onClick={() => removeCriterion(c.id)} style={{ padding: '4px 7px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 5 }}>
              {c.levels.map((lv, li) => (
                <div key={li} style={{ background: '#F7F9FC', borderRadius: 7, padding: '6px 8px', border: '1px solid #E4EAF2', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input value={lv.label} onChange={e => updateLevel(c.id, li, 'label', e.target.value)} style={{ ...inp, fontWeight: 700, flex: 1 }} placeholder="Label" />
                    <button type="button" onClick={() => removeLevel(c.id, li)} style={{ padding: '2px 5px', background: 'none', color: '#D61F31', border: 'none', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                  <input type="number" value={lv.points} onChange={e => updateLevel(c.id, li, 'points', e.target.value)} style={{ ...inp }} placeholder="Points" />
                  <input value={lv.description ?? ''} onChange={e => updateLevel(c.id, li, 'description', e.target.value)} style={{ ...inp, fontSize: 10, color: '#5A7290' }} placeholder="Description (opt)" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
