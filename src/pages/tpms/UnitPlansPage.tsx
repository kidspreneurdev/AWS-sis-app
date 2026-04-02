import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapUnit, TPMS_SUBJECTS, TPMS_GRADES, TPMS_UNIT_STATUS, TPMS_PACING_STATUS,
  STANDARDS_BANK, UNIT_STATUS_META, PACING_META, type TpmsUnit,
} from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }

type UnitForm = {
  title: string; subject: string; grade: string; startDate: string; endDate: string
  status: string; pacing: string; weeks: string; standards: string[]
  essentialQuestions: string; enduringUnderstandings: string; transferGoals: string
  stage2Evidence: string; stage2Tasks: string; stage3Plan: string; notes: string
}

const EMPTY: UnitForm = {
  title: '', subject: 'English Language Arts', grade: 'Grade 9',
  startDate: '', endDate: '', status: 'Planning', pacing: 'On Track', weeks: '',
  standards: [], essentialQuestions: '', enduringUnderstandings: '', transferGoals: '',
  stage2Evidence: '', stage2Tasks: '', stage3Plan: '', notes: '',
}

function unitToForm(u: TpmsUnit): UnitForm {
  return { title: u.title, subject: u.subject, grade: u.grade, startDate: u.startDate, endDate: u.endDate, status: u.status, pacing: u.pacing, weeks: u.weeks, standards: u.standards, essentialQuestions: u.essentialQuestions, enduringUnderstandings: u.enduringUnderstandings, transferGoals: u.transferGoals, stage2Evidence: u.stage2Evidence, stage2Tasks: u.stage2Tasks, stage3Plan: u.stage3Plan, notes: u.notes }
}

function StdMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [fw, setFw] = useState('')
  const [srch, setSrch] = useState('')
  const options = useMemo(() => {
    const r: Array<{ g: string; s: string }> = []
    Object.entries(STANDARDS_BANK).forEach(([g, stds]) => {
      if (fw && g !== fw) return
      stds.forEach(s => { if (!srch || s.toLowerCase().includes(srch.toLowerCase())) r.push({ g, s }) })
    })
    return r
  }, [fw, srch])
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <select value={fw} onChange={e => setFw(e.target.value)} style={{ ...inp, flex: 1 }}>
          <option value="">— All Frameworks —</option>
          {Object.keys(STANDARDS_BANK).map(f => <option key={f}>{f}</option>)}
        </select>
        <input value={srch} onChange={e => setSrch(e.target.value)} placeholder="Search…" style={{ ...inp, flex: 2 }} />
      </div>
      <select multiple style={{ width: '100%', height: 110, border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 10, fontFamily: 'monospace', padding: 4 }}
        value={value} onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => o.value))}>
        {options.map(o => <option key={o.s} value={o.s}>[{o.g}] {o.s}</option>)}
      </select>
      <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 3 }}>{value.length ? `${value.length} selected` : 'None'} · Ctrl/Cmd for multi</div>
    </div>
  )
}

function UnitModal({ unit, onClose, onSave, onDelete }: {
  unit: TpmsUnit | null; onClose: () => void
  onSave: (f: UnitForm, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState<UnitForm>(unit ? unitToForm(unit) : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof UnitForm, v: string | string[]) => setForm(p => ({ ...p, [k]: v }))

  // Auto-calc weeks from dates
  const autoWeeks = useMemo(() => {
    if (!form.startDate || !form.endDate) return ''
    const diff = Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (7 * 24 * 3600 * 1000))
    return diff > 0 ? String(diff) : ''
  }, [form.startDate, form.endDate])

  async function handleSave() {
    if (!form.title) { alert('Unit title is required'); return }
    setSaving(true)
    await onSave({ ...form, weeks: form.weeks || autoWeeks }, unit?.id)
    setSaving(false)
    onClose()
  }

  const secHdr = (col: string, text: string, sub: string) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: col, textTransform: 'uppercase', letterSpacing: 1 }}>{text}</div>
      <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 720, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📐 {unit ? 'Edit' : 'New'} Unit Plan</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>UbD Framework · Understanding by Design · 3-Stage Process</div>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header fields */}
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>📋 Unit Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Unit Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} placeholder="e.g. Forces & Motion — Newton's Laws" /></div>
              <div><label style={lbl}>Subject</label>
                <select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>
                  {TPMS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Grade Level</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)} style={inp}>
                  {TPMS_GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Start Date</label><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>End Date</label><input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Duration (weeks){autoWeeks ? <span style={{ color: '#059669', marginLeft: 6 }}>auto: {autoWeeks}w</span> : null}</label>
                <input type="number" value={form.weeks} onChange={e => set('weeks', e.target.value)} placeholder={autoWeeks || '4'} min={1} style={inp} />
              </div>
              <div><label style={lbl}>Pacing Status</label>
                <select value={form.pacing} onChange={e => set('pacing', e.target.value)} style={inp}>
                  {TPMS_PACING_STATUS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                  {TPMS_UNIT_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* UbD Stage 1: Desired Results */}
          <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 14, border: '1.5px solid #C7D7F5' }}>
            {secHdr('#1A365E', '🏆 Stage 1 — Desired Results', 'What do we want students to know, understand, and be able to do?')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Essential Questions <span style={{ fontWeight: 400, color: '#94A3B8' }}>(open-ended, thought-provoking)</span></label>
                <textarea value={form.essentialQuestions} onChange={e => set('essentialQuestions', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="What makes a good argument? How does science shape society? Why do things move?" />
              </div>
              <div>
                <label style={lbl}>Enduring Understandings <span style={{ fontWeight: 400, color: '#94A3B8' }}>(big ideas students will retain)</span></label>
                <textarea value={form.enduringUnderstandings} onChange={e => set('enduringUnderstandings', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Students will understand that... (lasting insights beyond the unit)" />
              </div>
              <div>
                <label style={lbl}>Transfer Goals <span style={{ fontWeight: 400, color: '#94A3B8' }}>(skills applied in new contexts)</span></label>
                <textarea value={form.transferGoals} onChange={e => set('transferGoals', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Students will be able to independently apply... in real-world contexts" />
              </div>
              <div>
                <label style={lbl}>Standards Alignment <span style={{ fontSize: 9, color: '#7A92B0', fontWeight: 400 }}>· Hold Ctrl/Cmd for multi-select</span></label>
                <StdMultiSelect value={form.standards} onChange={v => set('standards', v)} />
              </div>
            </div>
          </div>

          {/* UbD Stage 2: Assessment Evidence */}
          <div style={{ background: '#FFF7F0', borderRadius: 10, padding: 14, border: '1.5px solid #FDD5B0' }}>
            {secHdr('#D97706', '📊 Stage 2 — Assessment Evidence', 'How will we know students have achieved the desired results?')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Performance Tasks <span style={{ fontWeight: 400, color: '#94A3B8' }}>(authentic evidence of understanding)</span></label>
                <textarea value={form.stage2Tasks} onChange={e => set('stage2Tasks', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Students will demonstrate understanding by... (GRASPS format: Goal, Role, Audience, Situation, Product, Standards)" />
              </div>
              <div>
                <label style={lbl}>Other Evidence <span style={{ fontWeight: 400, color: '#94A3B8' }}>(quizzes, tests, observations, work samples)</span></label>
                <textarea value={form.stage2Evidence} onChange={e => set('stage2Evidence', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Unit test, exit tickets, lab reports, class discussions, portfolios..." />
              </div>
            </div>
          </div>

          {/* UbD Stage 3: Learning Plan */}
          <div style={{ background: '#F0FFF4', borderRadius: 10, padding: 14, border: '1.5px solid #BBF7D0' }}>
            {secHdr('#059669', '📅 Stage 3 — Learning Plan', 'What learning experiences and instruction support students to achieve the goals?')}
            <div>
              <label style={lbl}>Learning Sequence & Activities <span style={{ fontWeight: 400, color: '#94A3B8' }}>(week-by-week progression)</span></label>
              <textarea value={form.stage3Plan} onChange={e => set('stage3Plan', e.target.value)} rows={5} style={{ ...inp, resize: 'vertical' }} placeholder={'Week 1: Hook / introduction to big idea\nWeek 2: Direct instruction & skill-building\nWeek 3: Guided & independent practice\nWeek 4: Performance task & reflection'} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Additional Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Resources, cross-curricular connections, teacher notes..." />
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #E4EAF2' }}>
            <div>
              {unit && onDelete && <button onClick={() => { if (confirm('Delete this unit plan?')) onDelete(unit.id).then(onClose) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}>🗑 Delete</button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid #DDE6F0', background: '#F0F4FA', color: '#1A365E', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : '💾 Save Unit Plan'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UnitPlansPage() {
  const [units, setUnits] = useState<TpmsUnit[]>([])
  const [selSub, setSelSub] = useState('All')
  const [selStatus, setSelStatus] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; unit: TpmsUnit | null }>({ open: false, unit: null })

  async function load() {
    const { data } = await supabase.from('tpms').select('*').eq('type', 'unit').order('created_at', { ascending: false })
    if (data) setUnits(data.map(r => mapUnit(r as Record<string, unknown>)))
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => units.filter(u => {
    if (selSub !== 'All' && u.subject !== selSub) return false
    if (selStatus !== 'All' && u.status !== selStatus) return false
    return true
  }), [units, selSub, selStatus])

  async function saveUnit(form: UnitForm, id?: string) {
    const content = JSON.stringify({ subject: form.subject, grade: form.grade, startDate: form.startDate, endDate: form.endDate, pacing: form.pacing, weeks: form.weeks, standards: form.standards, essentialQuestions: form.essentialQuestions, enduringUnderstandings: form.enduringUnderstandings, transferGoals: form.transferGoals, stage2Evidence: form.stage2Evidence, stage2Tasks: form.stage2Tasks, stage3Plan: form.stage3Plan, notes: form.notes })
    if (id) await supabase.from('tpms').update({ title: form.title, status: form.status, content }).eq('id', id)
    else await supabase.from('tpms').insert({ type: 'unit', title: form.title, status: form.status, content })
    await load()
  }
  async function deleteUnit(id: string) { await supabase.from('tpms').delete().eq('id', id); setUnits(prev => prev.filter(u => u.id !== id)) }

  const iStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11 }
  const active = units.filter(u => u.status === 'Active').length
  const completed = units.filter(u => u.status === 'Completed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📐 Unit Plans</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{units.length} units · {active} active · {completed} completed · UbD Framework</div>
        </div>
        <button onClick={() => setModal({ open: true, unit: null })} style={{ padding: '9px 18px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Unit Plan</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[['Total', units.length, '#1A365E'], ['Active', active, '#1DBD6A'], ['Planning', units.filter(u => u.status === 'Planning').length, '#7C3AED'], ['Completed', completed, '#0EA5E9']].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <select value={selSub} onChange={e => setSelSub(e.target.value)} style={iStyle}>
          <option value="All">All Subjects</option>{TPMS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={selStatus} onChange={e => setSelStatus(e.target.value)} style={iStyle}>
          <option value="All">All Statuses</option>{TPMS_UNIT_STATUS.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{filtered.length} units</span>
      </div>

      {/* Unit cards */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📐</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>No unit plans yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create your first unit plan using the UbD framework above.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const sm = UNIT_STATUS_META[u.status] ?? UNIT_STATUS_META.Planning
            const pm = PACING_META[u.pacing] ?? PACING_META['On Track']
            // Progress bar: days elapsed / total days
            let pct = 0
            if (u.startDate && u.endDate) {
              const total = new Date(u.endDate).getTime() - new Date(u.startDate).getTime()
              const elapsed = Date.now() - new Date(u.startDate).getTime()
              pct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
            }
            return (
              <div key={u.id} style={{ ...card, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{u.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sm.bg, color: sm.tc }}>{u.status}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: pm.bg, color: pm.tc }}>{u.pacing}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 6 }}>
                      {u.subject && <span>{u.subject}</span>}
                      {u.grade && <span> · {u.grade}</span>}
                      {u.weeks && <span> · {u.weeks}w</span>}
                      {u.startDate && <span> · {u.startDate}</span>}
                      {u.endDate && <span> → {u.endDate}</span>}
                      {u.standards?.length > 0 && <span> · 📋 {u.standards.length} standards</span>}
                    </div>
                    {(u.startDate && u.endDate) && (
                      <div style={{ background: '#F0F4FA', borderRadius: 4, height: 5, marginBottom: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#1DBD6A' : '#0EA5E9', borderRadius: 4 }} />
                      </div>
                    )}
                    {u.essentialQuestions && <div style={{ fontSize: 10, color: '#3D5475', maxWidth: 560, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>❓ {u.essentialQuestions}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setModal({ open: true, unit: u })} style={{ padding: '5px 12px', background: '#EDE9FE', color: '#6D28D9', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
                    <button onClick={() => { if (confirm('Delete?')) deleteUnit(u.id) }} style={{ padding: '5px 12px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 10, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && <UnitModal unit={modal.unit} onClose={() => setModal({ open: false, unit: null })} onSave={saveUnit} onDelete={deleteUnit} />}
    </div>
  )
}
