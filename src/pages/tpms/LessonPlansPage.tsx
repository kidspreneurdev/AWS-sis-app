import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapLesson, mapUnit, TPMS_SUBJECTS, TPMS_GRADES, TPMS_LESSON_STATUS, STANDARDS_BANK,
  LESSON_STATUS_META, type TpmsLesson, type TpmsUnit,
} from './tpmsConstants'

const card: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 3 }
const sec: React.CSSProperties = { background: '#F7F9FC', borderRadius: 10, padding: 14 }
const secTitle = (color: string, text: string) => (
  <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{text}</div>
)

type LessonForm = {
  title: string; subject: string; grade: string; date: string; lessonNum: string
  unitId: string; status: string; coachId: string; objectives: string; standards: string[]
  langObjective: string; resources: string; tech: string; room: string
  hook: string; direct: string; guided: string; independent: string; closure: string
  formative: string; successCriteria: string; homework: string
  extension: string; support: string; iep: string
  reflection: string; engagement: string; carryForward: string
}

const EMPTY_FORM: LessonForm = {
  title: '', subject: 'English Language Arts', grade: 'Grade 9', date: '', lessonNum: '1',
  unitId: '', status: 'Draft', coachId: '', objectives: '', standards: [],
  langObjective: '', resources: '', tech: '', room: '',
  hook: '', direct: '', guided: '', independent: '', closure: '',
  formative: '', successCriteria: '', homework: '',
  extension: '', support: '', iep: '',
  reflection: '', engagement: '', carryForward: '',
}

function lessonToForm(l: TpmsLesson): LessonForm {
  return { ...EMPTY_FORM, title: l.title, subject: l.subject, grade: l.grade, date: l.date, lessonNum: String(l.lessonNum), unitId: l.unitId, status: l.status, coachId: l.coachId, objectives: l.objectives, standards: l.standards, langObjective: l.langObjective, resources: l.resources, tech: l.tech, room: l.room, hook: l.hook, direct: l.direct, guided: l.guided, independent: l.independent, closure: l.closure, formative: l.formative, successCriteria: l.successCriteria, homework: l.homework, extension: l.extension, support: l.support, iep: l.iep, reflection: l.reflection, engagement: l.engagement, carryForward: l.carryForward }
}

function StdSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [framework, setFramework] = useState('')
  const [search, setSearch] = useState('')
  const frameworks = Object.keys(STANDARDS_BANK)

  const options = useMemo(() => {
    const result: Array<{ group: string; std: string }> = []
    Object.entries(STANDARDS_BANK).forEach(([g, stds]) => {
      if (framework && g !== framework) return
      stds.forEach(s => {
        if (search && !s.toLowerCase().includes(search.toLowerCase())) return
        result.push({ group: g, std: s })
      })
    })
    return result
  }, [framework, search])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <select value={framework} onChange={e => setFramework(e.target.value)} style={{ ...inp, flex: 1 }}>
          <option value="">— All Frameworks —</option>
          {frameworks.map(f => <option key={f}>{f}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search standard…" style={{ ...inp, flex: 2 }} />
      </div>
      <select
        multiple
        style={{ width: '100%', height: 130, border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 10, fontFamily: 'monospace', padding: 4 }}
        value={value}
        onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => o.value))}
      >
        {options.map(o => (
          <option key={o.std} value={o.std} style={{ padding: '2px 4px' }}>
            [{o.group}] {o.std}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 3 }}>
        {value.length ? `${value.length} standard(s) selected` : 'None selected'} · Hold Ctrl/Cmd to multi-select
      </div>
    </div>
  )
}

function LessonModal({ lesson, units, coaches, onClose, onSave, onDelete }: {
  lesson: TpmsLesson | null; units: TpmsUnit[]
  coaches: { id: string; name: string }[]
  onClose: () => void; onSave: (f: LessonForm, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const isEdit = !!lesson
  const [form, setForm] = useState<LessonForm>(lesson ? lessonToForm(lesson) : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof LessonForm, v: string | string[]) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave(publishStatus?: string) {
    if (!form.title) { alert('Lesson title is required'); return }
    if (publishStatus === 'Published' && !form.objectives) { alert('Learning objectives are required to publish'); return }
    setSaving(true)
    await onSave({ ...form, status: publishStatus || form.status }, lesson?.id)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 760, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📝 {isEdit ? 'Edit' : 'New'} Lesson Plan</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>TPMS · Understanding by Design Framework</div>
        </div>

        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Header Info */}
          <div style={sec}>
            {secTitle('#1A365E', '📋 Header Information')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Lesson Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} style={inp} placeholder="e.g. Forces and Motion — Day 1" /></div>
              <div><label style={lbl}>Subject / Course</label>
                <select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>
                  {TPMS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Grade / Cohort</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)} style={inp}>
                  {TPMS_GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Lesson Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Lesson # in Unit</label><input type="number" value={form.lessonNum} onChange={e => set('lessonNum', e.target.value)} min={1} max={100} style={inp} /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Parent Unit Plan</label>
                <select value={form.unitId} onChange={e => set('unitId', e.target.value)} style={inp}>
                  <option value="">— No parent unit —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                  {TPMS_LESSON_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Success Coach</label>
                <select value={form.coachId} onChange={e => set('coachId', e.target.value)} style={{ ...inp, background: form.coachId ? '#F0FFF4' : '#fff' }}>
                  <option value="">— Not Assigned —</option>
                  {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Objectives */}
          <div style={sec}>
            {secTitle('#7C3AED', '🎯 Objectives')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><label style={lbl}>Learning Objectives (SWBAT) *</label><textarea value={form.objectives} onChange={e => set('objectives', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Students will be able to... (one per line)" /></div>
              <div>
                <label style={lbl}>Standards Tagged <span style={{ fontSize: 9, color: '#7A92B0', fontWeight: 400, marginLeft: 4 }}>· Filter by framework, then select (Ctrl/Cmd for multi)</span></label>
                <StdSelect value={form.standards} onChange={v => set('standards', v)} />
              </div>
              <div><label style={lbl}>Language Objective (ELL)</label><input value={form.langObjective} onChange={e => set('langObjective', e.target.value)} style={inp} placeholder="Students will use academic language to..." /></div>
            </div>
          </div>

          {/* Section 3: Materials */}
          <div style={sec}>
            {secTitle('#059669', '📦 Materials & Setup')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl}>Required Resources</label><textarea value={form.resources} onChange={e => set('resources', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Textbook Ch.4, handout p.12, rulers..." /></div>
              <div><label style={lbl}>Technology Integration</label><textarea value={form.tech} onChange={e => set('tech', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Chromebooks, Khan Academy, Google Slides..." /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Room Setup Notes</label><input value={form.room} onChange={e => set('room', e.target.value)} style={inp} placeholder="Groups of 4, lab benches, outdoor space..." /></div>
            </div>
          </div>

          {/* Section 4: Instructional Sequence */}
          <div style={sec}>
            {secTitle('#D97706', '⏱️ Instructional Sequence')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['hook', 'Hook / Engagement (5–10 min)', 'Opening activity, question, or multimedia to activate prior knowledge...'],
                ['direct', 'Direct Instruction (15–20 min)', 'Teacher-led modeling, explanation, or demonstration...'],
                ['guided', 'Guided Practice (10–15 min)', 'Whole-class or small-group supported practice...'],
                ['independent', 'Independent / Group Work (15 min)', 'Student application activity or collaborative task...'],
                ['closure', 'Closure / Exit Ticket (5 min)', 'Formative check — question, reflection, or quick write...'],
              ] as const).map(([key, label, ph]) => (
                <div key={key}><label style={lbl}>{label}</label><textarea value={form[key as keyof LessonForm] as string} onChange={e => set(key as keyof LessonForm, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder={ph} /></div>
              ))}
            </div>
          </div>

          {/* Section 5: Assessment */}
          <div style={sec}>
            {secTitle('#D61F31', '📊 Assessment')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl}>Formative Assessment Strategy</label><input value={form.formative} onChange={e => set('formative', e.target.value)} style={inp} placeholder="Exit ticket, whiteboard check, think-pair-share..." /></div>
              <div><label style={lbl}>Success Criteria</label><input value={form.successCriteria} onChange={e => set('successCriteria', e.target.value)} style={inp} placeholder="How will teacher & students know objectives are met?" /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Homework Assignment</label><input value={form.homework} onChange={e => set('homework', e.target.value)} style={inp} placeholder="Linked to grade book; auto-appears on student calendar..." /></div>
            </div>
          </div>

          {/* Section 6: Differentiation */}
          <div style={sec}>
            {secTitle('#0891B2', '♿ Differentiation')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><label style={lbl}>Extension Activity (Advanced / Early Finishers)</label><textarea value={form.extension} onChange={e => set('extension', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="For students who master objectives early..." /></div>
              <div><label style={lbl}>Support / Scaffolding (ELL / SEN)</label><textarea value={form.support} onChange={e => set('support', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Visual supports, sentence frames, simplified text..." /></div>
              <div><label style={lbl}>IEP Accommodations</label><textarea value={form.iep} onChange={e => set('iep', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Auto-populated from SIS IEP flags for enrolled students..." /></div>
            </div>
          </div>

          {/* Section 7: Reflection (edit mode only) */}
          {isEdit && (
            <div style={{ background: '#FFFBEA', borderRadius: 10, padding: 14, border: '1.5px solid #FDE68A' }}>
              {secTitle('#92400E', '💭 Post-Lesson Reflection')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Post-Lesson Notes (What worked? What to change?)</label><textarea value={form.reflection} onChange={e => set('reflection', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Complete after instruction..." /></div>
                <div><label style={lbl}>Student Engagement Rating (1–5)</label>
                  <select value={form.engagement} onChange={e => set('engagement', e.target.value)} style={inp}>
                    <option value="">—</option>
                    {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Carry-Forward Notes</label><input value={form.carryForward} onChange={e => set('carryForward', e.target.value)} style={inp} placeholder="Notes for next lesson planning..." /></div>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #E4EAF2' }}>
            <div>
              {isEdit && onDelete && (
                <button onClick={() => { if (confirm('Delete this lesson plan?')) onDelete(lesson!.id).then(onClose) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}>🗑 Delete</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #DDE6F0', background: '#F0F4FA', color: '#1A365E', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleSave('Draft')} disabled={saving} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #DDE6F0', background: '#F0F4FA', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💾 Save Draft</button>
              <button onClick={() => handleSave('Published')} disabled={saving} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#D61F31', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : '✅ Save & Publish'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LessonPlansPage() {
  const [lessons, setLessons] = useState<TpmsLesson[]>([])
  const [units, setUnits] = useState<TpmsUnit[]>([])
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  const [selSub, setSelSub] = useState('All')
  const [selGrade, setSelGrade] = useState('All')
  const [selStatus, setSelStatus] = useState('All')
  const [modal, setModal] = useState<{ open: boolean; lesson: TpmsLesson | null }>({ open: false, lesson: null })

  async function load() {
    const [lr, ur, cr] = await Promise.all([
      supabase.from('tpms').select('*').eq('type', 'lesson').order('date', { ascending: false }),
      supabase.from('tpms').select('*').eq('type', 'unit').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,role').in('role', ['coach', 'teacher', 'principal', 'staff']).order('full_name'),
    ])
    if (lr.data) setLessons(lr.data.map(r => mapLesson(r as Record<string,unknown>)))
    if (ur.data) setUnits(ur.data.map(r => mapUnit(r as Record<string,unknown>)))
    if (cr.data) setCoaches(cr.data.map((r: Record<string,unknown>) => ({ id: r.id as string, name: (r.full_name as string) || 'Unknown' })))
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => lessons.filter(l => {
    if (selSub !== 'All' && l.subject !== selSub) return false
    if (selGrade !== 'All' && l.grade !== selGrade) return false
    if (selStatus !== 'All' && l.status !== selStatus) return false
    return true
  }), [lessons, selSub, selGrade, selStatus])

  async function savePlan(form: LessonForm, id?: string) {
    const content = JSON.stringify({
      subject: form.subject, grade: form.grade, lessonNum: parseInt(form.lessonNum) || 1,
      unitId: form.unitId, coachId: form.coachId, objectives: form.objectives, standards: form.standards,
      langObjective: form.langObjective, resources: form.resources, tech: form.tech, room: form.room,
      hook: form.hook, direct: form.direct, guided: form.guided, independent: form.independent, closure: form.closure,
      formative: form.formative, successCriteria: form.successCriteria, homework: form.homework,
      extension: form.extension, support: form.support, iep: form.iep,
      reflection: form.reflection, engagement: form.engagement, carryForward: form.carryForward,
    })
    if (id) await supabase.from('tpms').update({ title: form.title, date: form.date || null, status: form.status, content }).eq('id', id)
    else await supabase.from('tpms').insert({ type: 'lesson', title: form.title, date: form.date || null, status: form.status, content })
    await load()
  }
  async function deletePlan(id: string) { await supabase.from('tpms').delete().eq('id', id); setLessons(prev => prev.filter(l => l.id !== id)) }
  async function pushToAT(l: TpmsLesson) {
    const content = JSON.stringify({ subject: l.subject, grade: l.grade, description: l.objectives, fromLesson: l.id })
    await supabase.from('at_assignments').insert({
      title: l.title,
      date_assigned: l.date || null,
      due_date: l.date || null,
      status: 'Not Started',
      content,
    })
    alert(`"${l.title}" pushed to Assignment Tracker.`)
  }
  async function quickPublish(l: TpmsLesson) {
    await supabase.from('tpms').update({ status: 'Published' }).eq('id', l.id)
    setLessons(prev => prev.map(x => x.id === l.id ? { ...x, status: 'Published' } : x))
  }

  const iStyle: React.CSSProperties = { padding: '6px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 11 }
  const published = lessons.filter(l => l.status === 'Published').length
  const drafts = lessons.filter(l => l.status === 'Draft').length
  const review = lessons.filter(l => l.status === 'Ready for Review').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📝 Lesson Plans</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{lessons.length} total · {published} published · {drafts} drafts</div>
        </div>
        <button onClick={() => setModal({ open: true, lesson: null })} style={{ padding: '9px 18px', background: '#0EA5E9', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Lesson Plan</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[['Total', lessons.length, '#1A365E'], ['Published', published, '#1DBD6A'], ['Drafts', drafts, '#7A92B0'], ['In Review', review, '#F5A623']].map(([l, v, c]) => (
          <div key={l as string} style={{ ...card, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#F7F9FC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E4EAF2' }}>
        <select value={selSub} onChange={e => setSelSub(e.target.value)} style={iStyle}>
          <option value="All">All Subjects</option>{TPMS_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={selGrade} onChange={e => setSelGrade(e.target.value)} style={iStyle}>
          <option value="All">All Grades</option>{TPMS_GRADES.map(g => <option key={g}>{g}</option>)}
        </select>
        <select value={selStatus} onChange={e => setSelStatus(e.target.value)} style={iStyle}>
          <option value="All">All Statuses</option>{TPMS_LESSON_STATUS.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{filtered.length} records</span>
      </div>

      {/* Lesson cards */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>No lesson plans yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create your first lesson plan using the button above.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(l => {
            const sm = LESSON_STATUS_META[l.status] ?? LESSON_STATUS_META.Draft
            const d = l.date ? new Date(l.date + 'T00:00:00') : null
            const unit = units.find(u => u.id === l.unitId)
            const coach = coaches.find(c => c.id === l.coachId)
            return (
              <div key={l.id} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Date badge */}
                <div style={{ minWidth: 44, textAlign: 'center', background: '#EEF3FF', borderRadius: 10, padding: '6px 4px', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>{d ? d.getDate() : '—'}</div>
                  <div style={{ fontSize: 8, color: '#7A92B0', fontWeight: 700 }}>{d ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'DATE'}</div>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{l.title || 'Untitled'}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sm.bg, color: sm.tc }}>{l.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#7A92B0' }}>
                    {l.subject && <span>{l.subject}</span>}
                    {l.grade && <span> · {l.grade}</span>}
                    {unit && <span> · 📐 {unit.title}</span>}
                    {l.standards?.length > 0 && <span> · 📋 {l.standards.length} standard(s)</span>}
                    {coach && <span> · <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#1DBD6A', marginRight: 3, verticalAlign: 'middle' }} />{coach.name}</span>}
                  </div>
                  {l.objectives && <div style={{ fontSize: 10, color: '#3D5475', marginTop: 4, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {l.objectives}</div>}
                  {l.standards?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                      {l.standards.slice(0, 3).map(s => <span key={s} style={{ fontSize: 9, background: '#F0F4FA', color: '#3D5475', borderRadius: 4, padding: '2px 6px' }}>{s.split(' — ')[0]}</span>)}
                      {l.standards.length > 3 && <span style={{ fontSize: 9, color: '#7A92B0' }}>+{l.standards.length - 3} more</span>}
                    </div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setModal({ open: true, lesson: l })} style={{ padding: '5px 12px', background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
                  {l.status === 'Draft' && <button onClick={() => quickPublish(l)} style={{ padding: '5px 12px', background: '#E8FBF0', color: '#0E6B3B', border: '1px solid #C6F6D5', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✓ Publish</button>}
                  {l.status === 'Ready for Review' && <button onClick={() => quickPublish(l)} style={{ padding: '5px 12px', background: '#FFF7E0', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✓ Approve</button>}
                  <button onClick={() => void pushToAT(l)} style={{ padding: '5px 12px', background: '#FFF7ED', color: '#C2500A', border: '1px solid #FED7AA', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>📋 Push to AT</button>
                  <button onClick={() => { if (confirm('Delete this lesson plan?')) deletePlan(l.id) }} style={{ padding: '5px 12px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 10, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal.open && <LessonModal lesson={modal.lesson} units={units} coaches={coaches} onClose={() => setModal({ open: false, lesson: null })} onSave={savePlan} onDelete={deletePlan} />}
    </div>
  )
}
