import { useEffect, useState, useMemo } from 'react'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { supabase } from '@/lib/supabase'

const AT_NOTE_TYPES = ['Academic Observation', 'Misconception', 'Participation', 'Behaviour', 'Positive Highlight', 'Other']
const AT_SUBJECTS = ['Mathematics', 'English Language Arts', 'Reading', 'Science', 'Social Studies', 'Entrepreneurship', 'Art', 'World Language', 'Physical Education', 'Computer Science', 'Other']
const AT_CORR_STATUS = ['Assigned', 'In Progress', 'Submitted', 'Verified Complete', 'Overdue']

const TYPE_COLORS: Record<string, string> = {
  Misconception: '#D97706', 'Positive Highlight': '#059669', Behaviour: '#EF4444',
  'Academic Observation': '#3B82F6', Participation: '#8B5CF6', Other: '#6B7280',
}
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 12 }

interface ATNote { id: string; student_id: string; type: string; subject: string; note_text: string; date_logged: string; topic_tag: string; correction_required: boolean; visibility: string }
interface ATCorrection { id: string; note_id: string; student_id: string; subject: string; instructions: string; status: string; deadline: string }
interface Student { id: string; fullName: string }

function NoteModal({ students, onClose, onSave }: {
  students: Student[]; onClose: () => void
  onSave: (note: Omit<ATNote, 'id'>, corrInstr?: string, corrDeadline?: string) => Promise<void>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const d3 = new Date(); d3.setDate(d3.getDate() + 3)
  const [form, setForm] = useState({ studentId: '', type: AT_NOTE_TYPES[0], subject: AT_SUBJECTS[0], noteText: '', dateLogged: today, topicTag: '', correctionRequired: false, visibility: 'Internal' })
  const [corrInstr, setCorrInstr] = useState('')
  const [corrDeadline, setCorrDeadline] = useState(d3.toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }

  async function handleSave() {
    if (!form.studentId || !form.noteText.trim()) return
    setSaving(true)
    await onSave(
      { student_id: form.studentId, type: form.type, subject: form.subject, note_text: form.noteText.trim(), date_logged: form.dateLogged, topic_tag: form.topicTag, correction_required: form.correctionRequired, visibility: form.visibility },
      form.correctionRequired && corrInstr.trim() ? corrInstr.trim() : undefined,
      corrDeadline
    )
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#0369A1)', padding: '16px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>📒 Log Class Note</div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div><label style={lbl}>Student *</label>
            <select value={form.studentId} onChange={e => set('studentId', e.target.value)} style={inp}>
              <option value="">— Select —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Note Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inp}>
                {AT_NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Subject *</label>
              <select value={form.subject} onChange={e => set('subject', e.target.value)} style={inp}>
                {AT_SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Date</label>
              <input type="date" value={form.dateLogged} onChange={e => set('dateLogged', e.target.value)} style={inp} />
            </div>
            <div><label style={lbl}>Topic Tag</label>
              <input value={form.topicTag} onChange={e => set('topicTag', e.target.value)} placeholder="e.g. Fractions Week 3" style={inp} />
            </div>
          </div>
          <div><label style={lbl}>Note *</label>
            <textarea value={form.noteText} onChange={e => set('noteText', e.target.value)} rows={3} placeholder="Describe the observation..." style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.correctionRequired} onChange={e => set('correctionRequired', e.target.checked)} />
              Correction task required
            </label>
            <select value={form.visibility} onChange={e => set('visibility', e.target.value)} style={{ ...inp, fontSize: 11, width: 'auto' }}>
              <option value="Internal">Internal Only</option>
              <option value="Shared">Shared with Parent</option>
            </select>
          </div>
          {form.correctionRequired && (
            <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><label style={{ ...lbl, color: '#92400E' }}>Correction Instructions *</label>
                <textarea value={corrInstr} onChange={e => setCorrInstr(e.target.value)} rows={2} placeholder="e.g. Redo Questions 4-8..." style={{ ...inp, background: '#fff' }} />
              </div>
              <div><label style={{ ...lbl, color: '#92400E' }}>Correction Deadline</label>
                <input type="date" value={corrDeadline} onChange={e => setCorrDeadline(e.target.value)} style={{ ...inp, background: '#fff' }} />
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 22px', borderTop: '1px solid #E4EAF2' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💾 {saving ? 'Saving…' : 'Save Note'}</button>
        </div>
      </div>
    </div>
  )
}

function CorrModal({ note, studentName, onClose, onSave }: { note: ATNote; studentName: string; onClose: () => void; onSave: (instr: string, deadline: string) => Promise<void> }) {
  const d3 = new Date(); d3.setDate(d3.getDate() + 3)
  const [instr, setInstr] = useState('')
  const [deadline, setDeadline] = useState(d3.toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 12, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 3 }

  async function handleSave() {
    if (!instr.trim()) return
    setSaving(true); await onSave(instr.trim(), deadline); setSaving(false); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ background: '#B45309', padding: '14px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>✏️ Assign Correction Task</div>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400E' }}>
            <strong>For:</strong> {studentName}  <strong>Note:</strong> {note.note_text}
          </div>
          <div><label style={lbl}>Correction Instructions *</label>
            <textarea value={instr} onChange={e => setInstr(e.target.value)} rows={3} placeholder="e.g. Redo Questions 4-8 from Monday worksheet..." style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div><label style={lbl}>Deadline</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '10px 20px', borderTop: '1px solid #E4EAF2' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '7px 18px', background: '#B45309', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>💾 {saving ? 'Saving…' : 'Assign'}</button>
        </div>
      </div>
    </div>
  )
}

export function ATNotesPage() {
  const cf = useCampusFilter()
  const [notes, setNotes] = useState<ATNote[]>([])
  const [corrections, setCorrections] = useState<ATCorrection[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [filterType, setFilterType] = useState('All')
  const [noteModal, setNoteModal] = useState(false)
  const [corrModal, setCorrModal] = useState<ATNote | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])

  async function load() {
    let sQuery = supabase.from('students').select('id,full_name').eq('status', 'enrolled').order('full_name')
    if (cf) sQuery = sQuery.eq('campus', cf)
    const [{ data: n }, { data: c }, { data: st }] = await Promise.all([
      supabase.from('at_notes').select('*').order('date_logged', { ascending: false }),
      supabase.from('at_corrections').select('*').order('deadline'),
      sQuery,
    ])
    if (n) setNotes(n.map((r: Record<string, unknown>) => ({
      id: r.id as string, student_id: r.student_id as string, type: (r.type as string) ?? 'Other',
      subject: (r.subject as string) ?? '', note_text: (r.note_text ?? r.content) as string ?? '',
      date_logged: (r.date_logged ?? r.created_at) as string ?? '', topic_tag: (r.topic_tag as string) ?? '',
      correction_required: (r.correction_required as boolean) ?? false, visibility: (r.visibility as string) ?? 'Internal',
    })))
    if (c) setCorrections(c.map((r: Record<string, unknown>) => ({
      id: r.id as string, note_id: (r.note_id as string) ?? '', student_id: r.student_id as string,
      subject: (r.subject as string) ?? '', instructions: (r.instructions ?? r.description) as string ?? '',
      status: (r.status as string) ?? 'Assigned', deadline: (r.deadline as string) ?? '',
    })))
    if (st) setStudents(st.map((r: Record<string, unknown>) => ({ id: r.id as string, fullName: (r.full_name as string) ?? '' })))
  }
  useEffect(() => { load() }, [cf])

  const pendingCorr = useMemo(() => corrections.filter(c => c.status !== 'Verified Complete'), [corrections])
  const overdueCorr = useMemo(() => pendingCorr.filter(c => c.deadline < today), [pendingCorr, today])
  const filteredNotes = useMemo(() => {
    return filterType === 'All' ? notes : notes.filter(n => n.type === filterType)
  }, [notes, filterType])

  async function saveNote(noteData: Omit<ATNote, 'id'>, corrInstr?: string, corrDeadline?: string) {
    const { data: inserted } = await supabase.from('at_notes').insert({
      student_id: noteData.student_id, type: noteData.type, subject: noteData.subject,
      note_text: noteData.note_text, date_logged: noteData.date_logged, topic_tag: noteData.topic_tag,
      correction_required: noteData.correction_required, visibility: noteData.visibility,
    }).select('id').single()
    if (corrInstr && inserted?.id) {
      await supabase.from('at_corrections').insert({
        note_id: inserted.id, student_id: noteData.student_id, subject: noteData.subject,
        instructions: corrInstr, status: 'Assigned', deadline: corrDeadline,
      })
    }
    await load()
  }

  async function assignCorrection(note: ATNote, instr: string, deadline: string) {
    await supabase.from('at_corrections').insert({
      note_id: note.id, student_id: note.student_id, subject: note.subject,
      instructions: instr, status: 'Assigned', deadline,
    })
    await load()
  }

  async function updateCorrStatus(id: string, status: string) {
    const update: Record<string, unknown> = { status }
    if (status === 'Verified Complete') update.verified_at = new Date().toISOString()
    await supabase.from('at_corrections').update(update).eq('id', id)
    setCorrections(p => p.map(c => c.id === id ? { ...c, status } : c))
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('at_corrections').delete().eq('note_id', id)
    await supabase.from('at_notes').delete().eq('id', id)
    await load()
  }

  const iStyle: React.CSSProperties = { padding: '4px 8px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 10, background: '#fff', color: '#1A365E' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>📒 Class Notes & Corrections</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
            {notes.length} notes · {pendingCorr.length} pending corrections ·{' '}
            <span style={{ color: overdueCorr.length ? '#D61F31' : '#059669', fontWeight: 700 }}>{overdueCorr.length} overdue</span>
          </div>
        </div>
        <button onClick={() => setNoteModal(true)} style={{ padding: '9px 18px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Log Note</button>
      </div>

      {overdueCorr.length > 0 && (
        <div style={{ background: '#FEE2E2', borderLeft: '4px solid #D61F31', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#7F1D1D' }}>
          ⚠️ {overdueCorr.length} correction task(s) overdue — review below
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Notes panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>Class Notes</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...iStyle, marginLeft: 'auto' }}>
              {['All', ...AT_NOTE_TYPES].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {filteredNotes.length === 0 && (
            <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No notes logged yet.</div>
          )}
          {filteredNotes.map(n => {
            const tc = TYPE_COLORS[n.type] ?? '#6B7280'
            const hasCorrTask = corrections.some(c => c.note_id === n.id)
            const stuName = studentMap[n.student_id]?.fullName ?? 'Unknown'
            return (
              <div key={n.id} style={{ ...card, borderLeft: `3px solid ${tc}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, background: tc + '18', color: tc, padding: '2px 6px', borderRadius: 4 }}>{n.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{stuName}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>{n.date_logged?.slice(0, 10) ?? ''}</span>
                  {n.visibility === 'Internal' && <span style={{ fontSize: 8, fontWeight: 700, background: '#F0F4FA', color: '#64748B', padding: '1px 5px', borderRadius: 3 }}>Internal</span>}
                </div>
                <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 4 }}>{n.note_text}</div>
                {n.subject && <div style={{ fontSize: 10, color: '#94A3B8' }}>📚 {n.subject}{n.topic_tag ? ` · ${n.topic_tag}` : ''}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {n.correction_required && !hasCorrTask && (
                    <button onClick={() => setCorrModal(n)} style={{ padding: '3px 9px', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>+ Assign Correction</button>
                  )}
                  {hasCorrTask && <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#F0FDF4', padding: '2px 7px', borderRadius: 4 }}>✓ Correction Assigned</span>}
                  <button onClick={() => deleteNote(n.id)} style={{ padding: '3px 8px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 5, fontSize: 9, cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Corrections panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 4, display: 'block' }}>Correction Tasks ({pendingCorr.length} pending)</span>
          {corrections.length === 0 && (
            <div style={{ ...card, padding: 30, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No correction tasks yet.</div>
          )}
          {[...corrections].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')).map(cr => {
            const isOverdue = cr.status !== 'Verified Complete' && cr.deadline < today
            const CORR_COLORS: Record<string, string> = { Assigned: '#3B82F6', 'In Progress': '#D97706', Submitted: '#8B5CF6', 'Verified Complete': '#059669', Overdue: '#D61F31' }
            const statCol = CORR_COLORS[cr.status] ?? '#6B7280'
            const borderCol = isOverdue ? '#D61F31' : statCol
            const stuName = studentMap[cr.student_id]?.fullName ?? 'Unknown'
            return (
              <div key={cr.id} style={{ ...card, borderLeft: `3px solid ${borderCol}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{stuName}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: statCol, background: statCol + '18', padding: '2px 6px', borderRadius: 4 }}>{isOverdue ? 'Overdue' : cr.status}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>Due: {cr.deadline}</span>
                </div>
                <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 6 }}>{cr.instructions}</div>
                {cr.subject && <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>📚 {cr.subject}</div>}
                {cr.status !== 'Verified Complete' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select defaultValue={cr.status} onChange={e => updateCorrStatus(cr.id, e.target.value)} style={iStyle}>
                      {AT_CORR_STATUS.map(st => <option key={st}>{st}</option>)}
                    </select>
                    {cr.status === 'Submitted' && (
                      <button onClick={() => updateCorrStatus(cr.id, 'Verified Complete')} style={{ padding: '3px 9px', background: '#F0FDF4', color: '#059669', border: '1px solid #BBF7D0', borderRadius: 5, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>✓ Verify Complete</button>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>✓ Verified Complete</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {noteModal && <NoteModal students={students} onClose={() => setNoteModal(false)} onSave={saveNote} />}
      {corrModal && (
        <CorrModal
          note={corrModal}
          studentName={studentMap[corrModal.student_id]?.fullName ?? 'Unknown'}
          onClose={() => setCorrModal(null)}
          onSave={(instr, deadline) => assignCorrection(corrModal, instr, deadline)}
        />
      )}
    </div>
  )
}
