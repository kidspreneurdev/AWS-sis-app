import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { K5Lesson } from '@/types/k5Lesson'

const NAVY  = '#1A365E'
const RED   = '#D61F31'
const GREEN = '#16A34A'
const GOLD  = '#FAC600'

const GRADE_OPTIONS = ['Pre-K', 'K', '1', '2', '3', '4', '5']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

interface QuizQuestion {
  q: string
  opts: [string, string, string, string]
  ok: number
  fbCorrect: string
  fbIncorrect: string
}

const BLANK_QUESTION: QuizQuestion = {
  q: '', opts: ['', '', '', ''], ok: 0, fbCorrect: '', fbIncorrect: '',
}

interface FormState {
  id: string | null
  title: string
  subject: string
  gradeLevels: string[]
  badgeName: string
  estimatedMins: number
  status: 'Draft' | 'Published'
  slidesFileUrl: string | null
  slidesFileName: string
  questions: QuizQuestion[]
}

const BLANK_FORM: FormState = {
  id: null,
  title: '',
  subject: '',
  gradeLevels: [],
  badgeName: '',
  estimatedMins: 12,
  status: 'Draft',
  slidesFileUrl: null,
  slidesFileName: '',
  questions: [{ ...BLANK_QUESTION }],
}

function rowToLesson(r: Record<string, unknown>): K5Lesson {
  return {
    id:             r.id as string,
    title:          (r.title as string) ?? '',
    subject:        (r.subject as string) ?? '',
    gradeLevels:    (r.grade_levels as string[]) ?? [],
    slides:         (r.slides_json as K5Lesson['slides']) ?? [],
    quiz:           (r.quiz_json as K5Lesson['quiz']) ?? [],
    badgeName:      (r.badge_name as string) ?? '',
    estimatedMins:  (r.estimated_mins as number) ?? 12,
    status:         (r.status as 'Draft' | 'Published') ?? 'Draft',
    slidesFileUrl:  (r.slides_file_url as string | null) ?? null,
    slidesFileType: (r.slides_file_type as string | null) ?? null,
  }
}

function lessonToQuestions(quiz: K5Lesson['quiz']): QuizQuestion[] {
  if (!quiz || quiz.length === 0) return [{ ...BLANK_QUESTION }]
  return quiz.map(q => ({
    q:    q.q,
    opts: (q.opts.length === 4 ? q.opts : [...q.opts, '', '', '', ''].slice(0, 4)) as [string, string, string, string],
    ok:   q.ok,
    fbCorrect:   q.fbCorrect ?? q.fb ?? '',
    fbIncorrect: q.fbIncorrect ?? q.fb ?? '',
  }))
}

function updateQuestion<K extends keyof QuizQuestion>(
  questions: QuizQuestion[],
  idx: number,
  key: K,
  value: QuizQuestion[K],
): QuizQuestion[] {
  return questions.map((q, i) => i === idx ? { ...q, [key]: value } : q)
}

function updateOption(questions: QuizQuestion[], qIdx: number, optIdx: number, value: string): QuizQuestion[] {
  return questions.map((q, i) => {
    if (i !== qIdx) return q
    const opts = [...q.opts] as [string, string, string, string]
    opts[optIdx] = value
    return { ...q, opts }
  })
}

export function K5LessonsAdminPage() {
  const [lessons,   setLessons]   = useState<K5Lesson[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<FormState>(BLANK_FORM)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('k5_lessons')
      .select('id,title,subject,grade_levels,slides_json,quiz_json,badge_name,estimated_mins,status,slides_file_url,slides_file_type,created_at')
      .order('created_at', { ascending: false })
    setLessons((data ?? []).map(r => rowToLesson(r as Record<string, unknown>)))
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setForm(BLANK_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(lesson: K5Lesson) {
    setForm({
      id:            lesson.id,
      title:         lesson.title,
      subject:       lesson.subject,
      gradeLevels:   lesson.gradeLevels,
      badgeName:     lesson.badgeName,
      estimatedMins: lesson.estimatedMins,
      status:        lesson.status,
      slidesFileUrl: lesson.slidesFileUrl,
      slidesFileName: lesson.slidesFileUrl ? lesson.slidesFileUrl.split('/').pop() ?? '' : '',
      questions:     lessonToQuestions(lesson.quiz),
    })
    setError(null)
    setShowForm(true)
  }

  async function uploadPdf(file: File) {
    if (file.type !== 'application/pdf') { setError('Only PDF files are supported.'); return }
    setUploading(true)
    setError(null)
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data, error: uploadErr } = await supabase.storage
      .from('k5-lesson-slides')
      .upload(safeName, file, { upsert: true })
    if (uploadErr || !data) {
      setError(`Upload failed: ${uploadErr?.message ?? 'unknown error'}`)
      setUploading(false)
      return
    }
    setForm(f => ({ ...f, slidesFileUrl: data.path, slidesFileName: file.name }))
    setUploading(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadPdf(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void uploadPdf(file)
  }

  function removeFile() {
    setForm(f => ({ ...f, slidesFileUrl: null, slidesFileName: '' }))
  }

  function addQuestion() {
    setForm(f => ({ ...f, questions: [...f.questions, { ...BLANK_QUESTION }] }))
  }

  function removeQuestion(idx: number) {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }))
  }

  async function save() {
    if (!form.title.trim())            return setError('Title is required')
    if (!form.subject.trim())          return setError('Subject is required')
    if (form.gradeLevels.length === 0) return setError('Select at least one grade level')
    if (!form.slidesFileUrl)           return setError('Upload a PDF for the lesson slides')
    if (form.questions.length === 0)   return setError('Add at least one quiz question')

    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i]
      if (!q.q.trim())                      return setError(`Question ${i + 1}: question text is required`)
      if (q.opts.some(o => !o.trim()))      return setError(`Question ${i + 1}: all 4 options are required`)
      if (!q.fbCorrect.trim())               return setError(`Question ${i + 1}: feedback for a correct answer is required`)
      if (!q.fbIncorrect.trim())             return setError(`Question ${i + 1}: feedback for an incorrect answer is required`)
    }

    setError(null)
    setSaving(true)

    const { error: err } = form.id
      ? await supabase.from('k5_lessons').update({
          title: form.title.trim(), subject: form.subject.trim(),
          grade_levels: form.gradeLevels, badge_name: form.badgeName.trim(),
          estimated_mins: form.estimatedMins, status: form.status,
          slides_file_url: form.slidesFileUrl, slides_file_type: 'pdf',
          quiz_json: form.questions, updated_at: new Date().toISOString(),
        }).eq('id', form.id)
      : await supabase.from('k5_lessons').insert({
          title: form.title.trim(), subject: form.subject.trim(),
          grade_levels: form.gradeLevels, badge_name: form.badgeName.trim(),
          estimated_mins: form.estimatedMins, status: form.status,
          slides_file_url: form.slidesFileUrl, slides_file_type: 'pdf',
          quiz_json: form.questions, updated_at: new Date().toISOString(),
        })

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowForm(false)
    void load()
  }

  async function toggleStatus(lesson: K5Lesson) {
    const next = lesson.status === 'Published' ? 'Draft' : 'Published'
    await supabase.from('k5_lessons').update({ status: next, updated_at: new Date().toISOString() }).eq('id', lesson.id)
    void load()
  }

  async function deleteLesson(lesson: K5Lesson) {
    if (!confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return
    await supabase.from('k5_lessons').delete().eq('id', lesson.id)
    void load()
  }

  const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', border:'1.5px solid #CBD5E1', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', color:'#1E293B' }
  const lbl: React.CSSProperties = { fontSize:12, fontWeight:700, color:'#374151', marginBottom:4, display:'block' }
  const fieldWrap: React.CSSProperties = { display:'flex', flexDirection:'column', gap:4 }

  return (
    <div style={{ padding:'24px 28px', fontFamily:'Poppins, sans-serif', maxWidth:1000, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800, color:NAVY }}>K–5 Lessons</div>
          <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>Manage interactive lesson content for K–5 students</div>
        </div>
        <button onClick={openCreate} style={{ padding:'9px 18px', background:NAVY, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          + New Lesson
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', border:`3px solid #E4EAF2`, borderTopColor:RED, animation:'spin 0.7s linear infinite' }} />
        </div>
      ) : lessons.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📚</div>
          <div style={{ fontSize:16, fontWeight:700, color:NAVY, marginBottom:6 }}>No lessons yet</div>
          <div style={{ fontSize:13, color:'#64748B' }}>Click "New Lesson" to create your first K–5 lesson.</div>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:14, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#F8FAFC', borderBottom:'1.5px solid #E2E8F0' }}>
                {['Lesson', 'Subject', 'Grades', 'Slides', 'Quiz', 'Status', ''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, i) => (
                <tr key={lesson.id} style={{ borderBottom: i < lessons.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📚</div>
                      <div>
                        <div style={{ fontWeight:700, color:NAVY }}>{lesson.title}</div>
                        <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>
                          {lesson.slidesFileUrl ? '📄 PDF' : '🃏 Cards'} · Badge: {lesson.badgeName || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px', color:'#374151' }}>{lesson.subject}</td>
                  <td style={{ padding:'12px 14px', color:'#374151' }}>{lesson.gradeLevels.join(', ')}</td>
                  <td style={{ padding:'12px 14px', color:'#64748B' }}>{lesson.slidesFileUrl ? 'PDF' : `${lesson.slides.length}`}</td>
                  <td style={{ padding:'12px 14px', color:'#64748B' }}>{lesson.quiz.length} Q</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:10, background: lesson.status === 'Published' ? '#DCFCE7' : '#F1F5F9', color: lesson.status === 'Published' ? GREEN : '#64748B' }}>
                      {lesson.status}
                    </span>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openEdit(lesson)} style={{ padding:'5px 10px', border:'1.5px solid #CBD5E1', borderRadius:6, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color:NAVY, fontFamily:'inherit' }}>Edit</button>
                      <button onClick={() => toggleStatus(lesson)} style={{ padding:'5px 10px', border:'1.5px solid #CBD5E1', borderRadius:6, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', color: lesson.status === 'Published' ? '#92400E' : GREEN, fontFamily:'inherit' }}>
                        {lesson.status === 'Published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => deleteLesson(lesson)} style={{ padding:'5px 10px', border:`1.5px solid ${RED}30`, borderRadius:6, background:'#FFF5F5', fontSize:12, fontWeight:600, cursor:'pointer', color:RED, fontFamily:'inherit' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex' }}>
          <div onClick={() => setShowForm(false)} style={{ flex:1, background:'rgba(0,0,0,.45)' }} />

          <div style={{ width:560, background:'#fff', height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', boxShadow:'-4px 0 24px rgba(0,0,0,.15)' }}>

            {/* Panel header */}
            <div style={{ padding:'18px 24px', borderBottom:'1.5px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between', background:NAVY, flexShrink:0 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{form.id ? 'Edit Lesson' : 'New K–5 Lesson'}</div>
              <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,.12)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', borderRadius:6, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>

            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16, flex:1 }}>

              {error && (
                <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#991B1B' }}>{error}</div>
              )}

              {/* Title */}
              <div style={fieldWrap}>
                <label style={lbl}>Lesson Title *</label>
                <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. How plants grow" />
              </div>

              {/* Subject */}
              <div style={fieldWrap}>
                <label style={lbl}>Subject *</label>
                <input style={inp} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Science" />
              </div>

              {/* Grade levels */}
              <div style={fieldWrap}>
                <label style={lbl}>Grade Levels * <span style={{ fontWeight:400, color:'#94A3B8' }}>(select all that apply)</span></label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {GRADE_OPTIONS.map(g => {
                    const on = form.gradeLevels.includes(g)
                    return (
                      <button key={g} onClick={() => setForm(f => ({ ...f, gradeLevels: on ? f.gradeLevels.filter(x => x !== g) : [...f.gradeLevels, g] }))}
                        style={{ padding:'5px 14px', borderRadius:20, border:`2px solid ${on ? NAVY : '#CBD5E1'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#374151', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 120ms' }}>
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Estimated mins */}
              <div style={fieldWrap}>
                <label style={lbl}>Estimated mins</label>
                <input type="number" style={inp} value={form.estimatedMins} onChange={e => setForm(f => ({ ...f, estimatedMins: Number(e.target.value) }))} min={1} max={60} />
              </div>

              {/* Badge */}
              <div style={fieldWrap}>
                <label style={lbl}>Badge name</label>
                <input style={inp} value={form.badgeName} onChange={e => setForm(f => ({ ...f, badgeName: e.target.value }))} placeholder="e.g. Plant Scientist" />
              </div>

              {/* Status */}
              <div style={fieldWrap}>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'Draft' | 'Published' }))}>
                  <option value="Draft">Draft — not visible to students</option>
                  <option value="Published">Published — visible to students</option>
                </select>
              </div>

              {/* PDF Upload */}
              <div style={fieldWrap}>
                <label style={lbl}>Lesson Slides (PDF) * <span style={{ fontWeight:400, color:'#94A3B8' }}>16:9 landscape recommended</span></label>
                {form.slidesFileUrl ? (
                  <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontSize:28 }}>📄</div>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#166534', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{form.slidesFileName || 'PDF uploaded'}</div>
                    </div>
                    <button onClick={removeFile} style={{ background:'none', border:'none', color:RED, fontSize:18, cursor:'pointer', padding:'2px 6px', borderRadius:4 }}>✕</button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{ border:`2px dashed ${dragOver ? NAVY : '#CBD5E1'}`, borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', background: dragOver ? '#EFF6FF' : '#FAFAFA', transition:'all 120ms' }}
                  >
                    {uploading ? (
                      <>
                        <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
                        <div style={{ fontSize:13, fontWeight:700, color:NAVY }}>Uploading…</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:36, marginBottom:8 }}>📁</div>
                        <div style={{ fontSize:13, fontWeight:700, color:NAVY }}>Drop PDF here or click to browse</div>
                        <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>PDF files only · 16:9 landscape</div>
                      </>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileInput} style={{ display:'none' }} />
              </div>

              {/* Quiz builder */}
              <div style={fieldWrap}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <label style={{ ...lbl, marginBottom:0 }}>Quiz Questions *</label>
                  <span style={{ fontSize:11, color:'#94A3B8' }}>{form.questions.length} question{form.questions.length !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {form.questions.map((q, qi) => (
                    <div key={qi} style={{ background:'#F8FAFC', border:'1.5px solid #E2E8F0', borderRadius:12, padding:'16px' }}>

                      {/* Question header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:NAVY }}>Question {qi + 1}</div>
                        {form.questions.length > 1 && (
                          <button onClick={() => removeQuestion(qi)} style={{ background:'none', border:'none', color:'#94A3B8', fontSize:16, cursor:'pointer', padding:'2px 6px', borderRadius:4, lineHeight:1 }}>✕</button>
                        )}
                      </div>

                      {/* Question text */}
                      <div style={{ ...fieldWrap, marginBottom:10 }}>
                        <label style={{ ...lbl, fontSize:10 }}>Question *</label>
                        <input style={inp} value={q.q} onChange={e => setForm(f => ({ ...f, questions: updateQuestion(f.questions, qi, 'q', e.target.value) }))} placeholder="What is the question?" />
                      </div>

                      {/* Options */}
                      <div style={{ marginBottom:10 }}>
                        <label style={{ ...lbl, fontSize:10, marginBottom:6 }}>Options * <span style={{ fontWeight:400, color:'#94A3B8' }}>— mark the correct one</span></label>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {OPTION_LABELS.map((label, oi) => {
                            const isCorrect = q.ok === oi
                            return (
                              <div key={oi} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <button
                                  onClick={() => setForm(f => ({ ...f, questions: updateQuestion(f.questions, qi, 'ok', oi) }))}
                                  title={`Mark as correct answer`}
                                  style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${isCorrect ? GOLD : '#CBD5E1'}`, background: isCorrect ? GOLD : '#fff', color: isCorrect ? NAVY : '#94A3B8', fontSize:11, fontWeight:900, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}
                                >
                                  {isCorrect ? '✓' : label}
                                </button>
                                <input
                                  style={{ ...inp, borderColor: isCorrect ? GOLD : '#CBD5E1', background: isCorrect ? '#FFFBEB' : '#fff' }}
                                  value={q.opts[oi]}
                                  onChange={e => setForm(f => ({ ...f, questions: updateOption(f.questions, qi, oi, e.target.value) }))}
                                  placeholder={`Option ${label}`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ fontSize:10, color:'#94A3B8', marginTop:5 }}>Click the circle to mark the correct answer (highlighted in gold)</div>
                      </div>

                      {/* Feedback */}
                      <div style={{ ...fieldWrap, marginBottom:10 }}>
                        <label style={{ ...lbl, fontSize:10 }}>Feedback shown after answering correctly ✅ *</label>
                        <input style={inp} value={q.fbCorrect} onChange={e => setForm(f => ({ ...f, questions: updateQuestion(f.questions, qi, 'fbCorrect', e.target.value) }))} placeholder="Great job! You found the answer right in the text." />
                      </div>

                      <div style={fieldWrap}>
                        <label style={{ ...lbl, fontSize:10 }}>Feedback shown after answering incorrectly ❌ *</label>
                        <input style={inp} value={q.fbIncorrect} onChange={e => setForm(f => ({ ...f, questions: updateQuestion(f.questions, qi, 'fbIncorrect', e.target.value) }))} placeholder="Not quite — look back at the sentence for a clue." />
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={addQuestion} style={{ marginTop:8, width:'100%', padding:'9px', border:`2px dashed #CBD5E1`, borderRadius:10, background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', color:'#64748B', fontFamily:'inherit' }}>
                  + Add question
                </button>
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding:'16px 24px', borderTop:'1.5px solid #E2E8F0', display:'flex', gap:10, flexShrink:0, background:'#F8FAFC' }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'10px', border:'1.5px solid #CBD5E1', borderRadius:8, background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#374151' }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving || uploading} style={{ flex:2, padding:'10px', border:'none', borderRadius:8, background:(saving || uploading) ? '#94A3B8' : NAVY, color:'#fff', fontSize:13, fontWeight:700, cursor:(saving || uploading) ? 'default' : 'pointer', fontFamily:'inherit' }}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create lesson'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
