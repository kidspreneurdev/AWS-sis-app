import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { uploadFile, downloadUrl } from '@/lib/uploadFile'
import { useCohorts } from '@/hooks/useCohorts'
import { useCampusFilter } from '@/hooks/useCampusFilter'
import { useCampuses } from '@/hooks/useCampuses'
import { useAuthStore } from '@/store/auth.store'
import { GRADES } from '@/types/student'
import { StudentCombobox } from '@/components/shared/StudentCombobox'
import {
  loadLMS, saveLMS, loadLMSFromDB, deleteLMSCourse, deleteLMSContent, deleteLMSEnrolment,
  lmsId, fmtTime, hasMasteryBool, hasAssignBool, isActiveBool,
  lmsCompositeScore, lmsCourseComposite, gradeLabel,
  SUBJECT_COLORS, SUBJECTS, GRADE_LEVELS, TYPE_ICONS, TYPE_COLORS,
  type LMSCourse, type LMSContent, type LMSEnrolment, type LMSProgress, type LMSStore, type LMSCourseGroup
} from './lmsStore'
import { CASE_STUDY_RUBRIC, SCORE_COMPONENT_TYPES, categorySubtotal, finalGrade, type ScoreComponentType } from '@/lib/lms/caseStudyRubric'

interface Student { id: string; lastName: string; firstName: string; fullName: string; cohort: string; grade: string; studentId: string; campus: string; status: string }
type LMSSubmissionRow = Record<string, unknown>

const card: React.CSSProperties = { background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)' }
const iStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', fontFamily: 'inherit', outline: 'none', background: '#fff' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#5A7290', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, color: '#1A365E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { ...inputStyle }
const taStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' as const }

// ─── Confirm / Prompt dialogs — in-app replacements for window.confirm() / prompt() ──
// Native browser dialogs render as unstyled OS chrome (and pick up the OS's dark/light
// theme, not the app's), so every "are you sure?" / "name this" interaction in the LMS
// goes through these instead.
interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}
interface PromptDialogState {
  title: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
}

function ConfirmDialog({ state, onClose }: { state: ConfirmDialogState; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: '22px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E' }}>{state.title}</div>
        <div style={{ fontSize: 12.5, color: '#5A7290', lineHeight: 1.55, marginTop: 8 }}>{state.message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button
            onClick={async () => { setBusy(true); await state.onConfirm(); setBusy(false); onClose() }}
            disabled={busy}
            style={{ padding: '9px 20px', background: state.danger ? '#D61F31' : '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? .7 : 1 }}
          >{busy ? 'Working…' : (state.confirmLabel || 'Confirm')}</button>
        </div>
      </div>
    </div>
  )
}

function PromptDialog({ state, onClose }: { state: PromptDialogState; onClose: () => void }) {
  const [value, setValue] = useState(state.defaultValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    state.onConfirm(trimmed)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: '22px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1A365E', marginBottom: 12 }}>{state.title}</div>
        {state.label && <label style={labelStyle}>{state.label}</label>}
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          placeholder={state.placeholder}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={submit} disabled={!value.trim()}
            style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: value.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: value.trim() ? 1 : .5 }}
          >{state.confirmLabel || 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

const TAB_PATHS: Record<string, string> = {
  '/lms/overview': 'overview',
  '/lms/manage': 'manage',
  '/lms/students': 'students',
  '/lms/courses': 'courses',
  '/lms/content': 'content',
  '/lms/assign': 'assign',
  '/lms/gradebook': 'gradebook',
  '/lms/curriculum': 'curriculum',
  '/lms/appeals': 'appeals',
  '/lms/section': 'section',
  '/lms/progress': 'progress',
  '/lms/student': 'student',
  '/lms/student-section': 'student-section',
}

const TABS = [
  { v: 'overview', path: '/lms/overview', l: '📊 Overview' },
  { v: 'manage', path: '/lms/manage', l: '📋 Manage' },
  { v: 'students', path: '/lms/students', l: '👨‍🎓 Students' },
  { v: 'courses', path: '/lms/courses', l: '📘 Courses' },
  { v: 'content', path: '/lms/content', l: '📄 Content' },
  { v: 'assign', path: '/lms/assign', l: '👥 Assign' },
  { v: 'gradebook', path: '/lms/gradebook', l: '📊 Gradebook' },
  { v: 'curriculum', path: '/lms/curriculum', l: '🧩 Curriculum' },
  { v: 'appeals', path: '/lms/appeals', l: '🚩 Appeals' },
  { v: 'section', path: '/lms/section', l: '📋 Section' },
  { v: 'progress', path: '/lms/progress', l: '📈 Progress' },
]

// ─── ENROL MODAL (top-level to prevent remount on parent re-render) ──────────
interface EnrolModalProps {
  courses: LMSCourse[]
  students: { id: string; fullName: string; cohort: string; grade: string }[]
  cohorts: string[]
  onSave: (enrolment: LMSEnrolment) => void
  onClose: () => void
}
function EnrolModal({ courses, students, cohorts, onSave, onClose }: EnrolModalProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [targetType, setTargetType] = useState<'cohort' | 'student' | 'grade'>('cohort')
  const [cohort, setCohort] = useState(cohorts[0] ?? '')
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [grade, setGrade] = useState('Grade 6')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [paceType, setPaceType] = useState('self')
  const [paceDays, setPaceDays] = useState('3')
  const save = () => {
    if (!courseId) { alert('Select a course'); return }
    const targetValue = targetType === 'cohort' ? cohort : targetType === 'grade' ? grade : studentId
    if (!targetValue) { alert('Select a target'); return }
    const enrolment: LMSEnrolment = {
      id: lmsId(), courseId, targetType, targetValue,
      assignedBy: 'Admin',
      assignedAt: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      paceType, paceDaysPerLesson: parseInt(paceDays) || 3,
      paceStartDate: startDate,
      dueDate,
      active: true
    }
    onSave(enrolment)
    onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>👥 Assign Course</div>
        </div>
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Course *</label><select value={courseId} onChange={e => setCourseId(e.target.value)} style={selectStyle}>{courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}</select></div>
          <div><label style={labelStyle}>Assign to</label>
            <select value={targetType} onChange={e => setTargetType(e.target.value as 'cohort' | 'student' | 'grade')} style={selectStyle}>
              <option value="cohort">Cohort</option>
              <option value="student">Individual Student</option>
              <option value="grade">Grade Level</option>
            </select>
          </div>
          {targetType === 'cohort' && <div><label style={labelStyle}>Cohort</label><select value={cohort} onChange={e => setCohort(e.target.value)} style={selectStyle}>{cohorts.map(c => <option key={c}>{c}</option>)}</select></div>}
          {targetType === 'student' && (
            <div>
              <label style={labelStyle}>Student ({students.length} loaded)</label>
              <StudentCombobox
                students={students}
                value={studentId}
                onChange={setStudentId}
                getLabel={s => s.fullName}
                getMeta={s => [s.grade && `Grade ${s.grade}`, s.cohort].filter(Boolean).join(' · ') || undefined}
                placeholder={students.length === 0 ? 'No students found' : 'Search students…'}
                style={selectStyle}
              />
            </div>
          )}
          {targetType === 'grade' && <div><label style={labelStyle}>Grade Level</label><select value={grade} onChange={e => setGrade(e.target.value)} style={selectStyle}>{GRADE_LEVELS.filter(g => g !== 'All Grades').map(g => <option key={g}>{g}</option>)}</select></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Start Date</label><input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" style={inputStyle} /></div>
            <div><label style={labelStyle}>Due Date (optional)</label><input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" style={inputStyle} /></div>
          </div>
          <div style={{ borderTop: '1px solid #E4EAF2', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>📅 Course Pace (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={labelStyle}>Pace Type</label>
                <select value={paceType} onChange={e => setPaceType(e.target.value)} style={selectStyle}>
                  <option value="self">Self-paced (no schedule)</option>
                  <option value="fixed">Fixed pace (generates calendar)</option>
                </select>
              </div>
              <div><label style={labelStyle}>Days per Lesson</label><input value={paceDays} onChange={e => setPaceDays(e.target.value)} type="number" min={1} max={30} style={inputStyle} /></div>
            </div>
            <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 4 }}>Fixed pace auto-generates a lesson due-date calendar for enrolled students based on their start date.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Assign</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SECTION NOTES MODAL (shared faculty notes on a section) ────────────────
interface SectionNote {
  id: string
  section_id: string
  author_id: string | null
  author_name: string | null
  body: string
  created_at: string
}
interface SectionNotesModalProps {
  sectionId: string
  sectionTitle: string
  authorId?: string
  authorName?: string
  onClose: () => void
}
function SectionNotesModal({ sectionId, sectionTitle, authorId, authorName, onClose }: SectionNotesModalProps) {
  const [notes, setNotes] = useState<SectionNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.from('lms_section_notes').select('*').eq('section_id', sectionId).order('created_at', { ascending: false })
      if (!cancelled) {
        if (!error && data) setNotes(data as SectionNote[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sectionId])

  async function addNote() {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    const { data, error } = await supabase.from('lms_section_notes')
      .insert({ section_id: sectionId, author_id: authorId ?? null, author_name: authorName ?? 'Unknown', body })
      .select().single()
    setSaving(false)
    if (error) { alert('Could not save note: ' + error.message); return }
    if (data) { setNotes(prev => [data as SectionNote, ...prev]); setDraft('') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, height: '85vh', maxHeight: 760, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📝 Section Notes</div>
            <div style={{ fontSize: 11, color: '#B9C7DC', marginTop: 2 }}>{sectionTitle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>Loading notes…</div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>No notes yet. Leave one for other faculty.</div>
          ) : notes.map(n => (
            <div key={n.id} style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>{n.author_name || 'Unknown'}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 12, color: '#334155', whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a note for other faculty…" rows={4} style={{ ...taStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            <button onClick={addNote} disabled={saving || !draft.trim()} style={{ padding: '9px 20px', background: saving || !draft.trim() ? '#B7C3D6' : '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving || !draft.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Add Note'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STUDENT NOTES MODAL (faculty notes on one student within one section) ──
interface StudentNote {
  id: string
  section_id: string
  student_id: string
  author_id: string | null
  author_name: string | null
  body: string
  created_at: string
}
interface StudentNotesModalProps {
  sectionId: string
  studentId: string
  studentName: string
  courseTitle: string
  authorId?: string
  authorName?: string
  onClose: () => void
}
function StudentNotesModal({ sectionId, studentId, studentName, courseTitle, authorId, authorName, onClose }: StudentNotesModalProps) {
  const [notes, setNotes] = useState<StudentNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.from('lms_student_notes').select('*').eq('section_id', sectionId).eq('student_id', studentId).order('created_at', { ascending: false })
      if (!cancelled) {
        if (!error && data) setNotes(data as StudentNote[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [sectionId, studentId])

  async function addNote() {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    const { data, error } = await supabase.from('lms_student_notes')
      .insert({ section_id: sectionId, student_id: studentId, author_id: authorId ?? null, author_name: authorName ?? 'Unknown', body })
      .select().single()
    setSaving(false)
    if (error) { alert('Could not save note: ' + error.message); return }
    if (data) { setNotes(prev => [data as StudentNote, ...prev]); setDraft('') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, height: '85vh', maxHeight: 760, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📝 Student Notes</div>
            <div style={{ fontSize: 11, color: '#B9C7DC', marginTop: 2 }}>{studentName} · {courseTitle}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>Loading notes…</div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: '20px 0' }}>No notes yet for this student in this section.</div>
          ) : notes.map(n => (
            <div key={n.id} style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>{n.author_name || 'Unknown'}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 12, color: '#334155', whiteSpace: 'pre-wrap' }}>{n.body}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Add a note about ${studentName}…`} rows={4} style={{ ...taStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
            <button onClick={addNote} disabled={saving || !draft.trim()} style={{ padding: '9px 20px', background: saving || !draft.trim() ? '#B7C3D6' : '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving || !draft.trim() ? 'default' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Add Note'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STUDENT DIRECTORY (used by the New Section "Add Students" step) ─────────
interface DirStudent { id: string; firstName: string; lastName: string; grade: string; studentId: string; campus: string }

interface StudentDirectoryModalProps {
  directoryStudents: DirStudent[]
  campuses: string[]
  initialSelectedIds: Set<string>
  onDone: (ids: Set<string>) => void
  onClose: () => void
}
function StudentDirectoryModal({ directoryStudents, campuses, initialSelectedIds, onDone, onClose }: StudentDirectoryModalProps) {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [gradeMinIdx, setGradeMinIdx] = useState(0)
  const [gradeMaxIdx, setGradeMaxIdx] = useState(GRADES.length - 1)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds))

  const q = search.trim().toLowerCase()
  const filtered = directoryStudents
    .filter(s => !locationFilter || s.campus === locationFilter)
    .filter(s => {
      const idx = GRADES.indexOf(s.grade)
      if (idx === -1) return true
      return idx >= gradeMinIdx && idx <= gradeMaxIdx
    })
    .filter(s => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q))
    .sort((a, b) => sortDir === 'asc' ? a.lastName.localeCompare(b.lastName) : b.lastName.localeCompare(a.lastName))
  const shown = filtered.slice(0, 50)
  const allShownSelected = shown.length > 0 && shown.every(s => selectedIds.has(s.id))

  function toggleAllShown() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allShownSelected) shown.forEach(s => next.delete(s.id))
      else shown.forEach(s => next.add(s.id))
      return next
    })
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', padding: '10px 12px' }
  const tdStyle: React.CSSProperties = { fontSize: 12, color: '#1A365E', padding: '9px 12px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 1100, height: '85vh', maxHeight: 820, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E4EAF2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🪪</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#1A365E', letterSpacing: '.03em' }}>STUDENT DIRECTORY</span>
            </div>
            <button onClick={onClose} title="Close" style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid #1A365E', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.3fr', gap: 20 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Student Search:</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for Students" style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Filter by Location:</label>
              <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={selectStyle}>
                <option value="">All Locations</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Grade Filter:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select value={gradeMinIdx} onChange={e => setGradeMinIdx(Math.min(Number(e.target.value), gradeMaxIdx))} style={{ ...selectStyle, flex: 1 }}>
                  {GRADES.map((g, i) => <option key={g} value={i}>{g}</option>)}
                </select>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>to</span>
                <select value={gradeMaxIdx} onChange={e => setGradeMaxIdx(Math.max(Number(e.target.value), gradeMinIdx))} style={{ ...selectStyle, flex: 1 }}>
                  {GRADES.map((g, i) => <option key={g} value={i}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 24px 0', fontSize: 12, fontWeight: 700, color: '#5A7290' }}>Showing {shown.length} of {filtered.length} Students</div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4EAF2' }}>
                <th style={{ ...thStyle, width: 34 }}><input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} style={{ cursor: 'pointer' }} /></th>
                <th style={thStyle}>
                  <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Last Name {sortDir === 'asc' ? '▾' : '▴'}
                  </button>
                </th>
                <th style={thStyle}>First Name</th>
                <th style={thStyle}>Grade</th>
                <th style={thStyle}>Student ID</th>
                <th style={thStyle}>Start Date</th>
                <th style={thStyle}>End Date</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No students match these filters.</td></tr>
              ) : shown.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF', borderBottom: '1px solid #F0F4FA' }}>
                  <td style={tdStyle}><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)} style={{ cursor: 'pointer' }} /></td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{s.lastName}</td>
                  <td style={tdStyle}>{s.firstName}</td>
                  <td style={tdStyle}>{s.grade || '—'}</td>
                  <td style={tdStyle}>{s.studentId || '—'}</td>
                  <td style={{ ...tdStyle, color: '#B7C3D6' }}>—</td>
                  <td style={{ ...tdStyle, color: '#B7C3D6' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderTop: '1px solid #E4EAF2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{selectedIds.size}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.03em' }}>Students Selected</span>
          </div>
          <button onClick={() => onDone(selectedIds)} style={{ padding: '12px 40px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>DONE</button>
        </div>
      </div>
    </div>
  )
}

// ─── INSTRUCTOR DIRECTORY (used by the New Section "Section Details" step) ────
interface DirStaff { id: string; firstName: string; lastName: string; role: string; email: string; campus: string }

interface InstructorDirectoryModalProps {
  staffList: DirStaff[]
  campuses: string[]
  initialSelectedIds: Set<string>
  onDone: (ids: Set<string>) => void
  onClose: () => void
}
function InstructorDirectoryModal({ staffList, campuses, initialSelectedIds, onDone, onClose }: InstructorDirectoryModalProps) {
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds))

  const roles = [...new Set(staffList.map(s => s.role).filter(Boolean))].sort()
  const q = search.trim().toLowerCase()
  const filtered = staffList
    .filter(s => !locationFilter || s.campus === locationFilter)
    .filter(s => !roleFilter || s.role === roleFilter)
    .filter(s => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    .sort((a, b) => sortDir === 'asc' ? a.lastName.localeCompare(b.lastName) : b.lastName.localeCompare(a.lastName))
  const shown = filtered.slice(0, 50)

  function toggleOne(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', padding: '10px 12px' }
  const tdStyle: React.CSSProperties = { fontSize: 12, color: '#1A365E', padding: '9px 12px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 1100, height: '85vh', maxHeight: 820, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E4EAF2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🪪</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#1A365E', letterSpacing: '.03em' }}>INSTRUCTOR DIRECTORY</span>
            </div>
            <button onClick={onClose} title="Close" style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid #1A365E', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Instructor Search:</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Filter by Location:</label>
              <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={selectStyle}>
                <option value="">All Locations</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Program Role</label>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle}>
                <option value="">Any</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 24px 0', fontSize: 12, fontWeight: 700, color: '#5A7290' }}>Showing {shown.length} of {filtered.length} Instructors</div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4EAF2' }}>
                <th style={{ ...thStyle, width: 34 }} />
                <th style={thStyle}>
                  <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    Last Name {sortDir === 'asc' ? '▾' : '▴'}
                  </button>
                </th>
                <th style={thStyle}>First Name</th>
                <th style={thStyle}>User Name</th>
                <th style={thStyle}>Program Role</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No instructors match these filters.</td></tr>
              ) : shown.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFF', borderBottom: '1px solid #F0F4FA' }}>
                  <td style={tdStyle}><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)} style={{ cursor: 'pointer' }} /></td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{s.lastName}</td>
                  <td style={tdStyle}>{s.firstName}</td>
                  <td style={tdStyle}>{s.email || '—'}</td>
                  <td style={tdStyle}>{s.role || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderTop: '1px solid #E4EAF2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{selectedIds.size}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.03em' }}>Instructors Selected</span>
          </div>
          <button onClick={() => onDone(selectedIds)} style={{ padding: '12px 40px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>DONE</button>
        </div>
      </div>
    </div>
  )
}

// ─── OVERVIEW HELPERS ──────────────────────────────────────────────────────────
function rangeDates(days: number): string[] {
  const now = new Date()
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  }
  return out
}

function rangeLabel(days: number): string {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - (days - 1))
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} - ${fmt(now)}`
}

function KpiCard({ icon, iconBg, value, label }: { icon: string; iconBg: string; value: number | string; label: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', flex: 1, minWidth: 240, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#1A365E', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#5A7290', fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function TimeSeriesChart({ dates, series, unit }: { dates: string[]; series: { label: string; color: string; values: number[] }[]; unit?: 'hours' | 'count' }) {
  const width = 900, height = 200, padL = 34, padR = 10, padT = 10, padB = 26
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const maxVal = Math.max(1, ...series.flatMap(s => s.values))
  const n = dates.length
  const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
  const y = (v: number) => padT + innerH - (v / maxVal) * innerH
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
          <line x1={padL} y1={padT + innerH} x2={width - padR} y2={padT + innerH} stroke="#E4EAF2" strokeWidth={1} />
          <text x={0} y={padT + innerH + 4} fontSize={11} fill="#7A92B0">{unit === 'hours' ? '0h' : '0'}</text>
          {series.map(s => (
            <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={2}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          ))}
          {dates.map((d, i) => (
            i % labelEvery === 0 ? <text key={i} x={x(i)} y={height - 6} fontSize={10} fill="#7A92B0" textAnchor="middle">{d}</text> : null
          ))}
        </svg>
      </div>
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          {series.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5A7290', fontWeight: 700 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TopList({ items }: { items: { title: string; value: string }[] }) {
  if (!items.length) return <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '48px 0' }}>No results found.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: '#F0F4FA', color: '#5A7290', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', flexShrink: 0 }}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── SELF-ENROLL CODE GENERATION ────────────────────────────────────────────
function genSelfEnrollCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
function genSelfEnrollPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── GRADE RANGE SLIDER (dual-thumb, used by Manage Students filters) ────────
interface GradeRangeSliderProps {
  min: number
  max: number
  value: [number, number]
  onChange: (v: [number, number]) => void
}
function GradeRangeSlider({ min, max, value, onChange }: GradeRangeSliderProps) {
  const [lo, hi] = value
  const pctLo = ((lo - min) / (max - min)) * 100
  const pctHi = ((hi - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>By Grade</span>
      <div style={{ position: 'relative', width: 190, height: 26, flexShrink: 0 }}>
        <style>{`
          .ms-grade-range { position: absolute; top: 0; left: 0; width: 100%; height: 26px; margin: 0; background: transparent; pointer-events: none; appearance: none; -webkit-appearance: none; }
          .ms-grade-range::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; pointer-events: auto; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 2px solid #1A365E; box-shadow: 0 1px 3px rgba(26,54,94,.3); cursor: pointer; margin-top: 0; }
          .ms-grade-range::-moz-range-thumb { pointer-events: auto; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 2px solid #1A365E; box-shadow: 0 1px 3px rgba(26,54,94,.3); cursor: pointer; }
          .ms-grade-range::-webkit-slider-runnable-track { background: transparent; }
        `}</style>
        <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 4, borderRadius: 2, background: '#E4EAF2' }} />
        <div style={{ position: 'absolute', top: 11, left: `${pctLo}%`, width: `${pctHi - pctLo}%`, height: 4, borderRadius: 2, background: '#1A365E' }} />
        <input
          type="range" className="ms-grade-range" min={min} max={max} value={lo}
          onChange={e => onChange([Math.min(Number(e.target.value), hi), hi])}
        />
        <input
          type="range" className="ms-grade-range" min={min} max={max} value={hi}
          onChange={e => onChange([lo, Math.max(Number(e.target.value), lo)])}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap' }}>{GRADES[lo]}–{GRADES[hi]}</span>
    </div>
  )
}

export function LMSPage() {
  const cf = useCampusFilter()
  const profile = useAuthStore(s => s.profile)
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = TAB_PATHS[location.pathname] || 'overview'
  const query = new URLSearchParams(location.search)
  const studentDetailSid = query.get('sid') ?? ''
  const studentDetailCid = query.get('cid') ?? ''

  const [store, setStore] = useState<LMSStore>(loadLMS)
  const [students, setStudents] = useState<Student[]>([])
  const cohorts = useCohorts()
  const campuses = useCampuses()

  // Per-tab UI state
  const [manageSearch, setManageSearch] = useState('')
  const [manageTabFilter, setManageTabFilter] = useState<'active' | 'inactive'>('active')
  const [manageTypeFilter, setManageTypeFilter] = useState('')
  const [manageExpanded, setManageExpanded] = useState<Record<string, boolean>>({})

  // Manage Students tab state
  const [msSearch, setMsSearch] = useState('')
  const [msCourseFilter, setMsCourseFilter] = useState('')
  const [msSectionFilter, setMsSectionFilter] = useState('')
  const [msLocationFilter, setMsLocationFilter] = useState('')
  const [msStatusFilter, setMsStatusFilter] = useState('')
  const [msSort, setMsSort] = useState<'az' | 'za'>('az')
  const [msGradeRange, setMsGradeRange] = useState<[number, number]>([1, GRADES.length - 1])
  const [msVisibleCount, setMsVisibleCount] = useState(20)
  const [msExpanded, setMsExpanded] = useState<Record<string, boolean>>({})
  const [msSectionTab, setMsSectionTab] = useState<Record<string, 'active' | 'completed' | 'dropped'>>({})
  const [studentSectionTab, setStudentSectionTab] = useState<'curriculum' | 'weekly'>('curriculum')
  const [studentNotesTarget, setStudentNotesTarget] = useState<{ sid: string; cid: string; studentName: string; courseTitle: string } | null>(null)
  const [activeCourseId, setActiveCourseId] = useState('')
  const [gbCourseId, setGbCourseId] = useState('')
  const [gbSubjectFilter, setGbSubjectFilter] = useState('')
  const [curriculumCourseId, setCurriculumCourseId] = useState('')
  const [sectionCourseId, setSectionCourseId] = useState('')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [progFilterCourse, setProgFilterCourse] = useState('')
  const [usageRange, setUsageRange] = useState('7')
  const [performanceRange, setPerformanceRange] = useState('7')
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false)
  const reportsMenuRef = useRef<HTMLDivElement>(null)
  const usageSectionRef = useRef<HTMLDivElement>(null)
  const performanceSectionRef = useRef<HTMLDivElement>(null)
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editCourseIdx, setEditCourseIdx] = useState<number | null>(null)
  const [newSectionGroupId, setNewSectionGroupId] = useState<string | null>(null)
  const [showNewSectionFlow, setShowNewSectionFlow] = useState(false)
  const [staffList, setStaffList] = useState<{ id: string; fullName: string; firstName: string; lastName: string; role: string; department: string; email: string; campus: string }[]>([])
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [sectionMenuOpenId, setSectionMenuOpenId] = useState<string | null>(null)
  const sectionMenuRef = useRef<HTMLDivElement>(null)
  const [notesSectionId, setNotesSectionId] = useState<string | null>(null)
  const [curriculumExpanded, setCurriculumExpanded] = useState<Record<string, boolean>>({})
  const [curriculumSettingsOpen, setCurriculumSettingsOpen] = useState(false)
  const [curriculumMenuOpenId, setCurriculumMenuOpenId] = useState<string | null>(null)
  const curriculumMenuRef = useRef<HTMLDivElement>(null)
  // Curriculum drag-and-drop reordering. `kind` scopes what can drop where:
  // 'top' = top-level lesson, 'unit' = unit folder, 'unititem' = lesson inside a unit (scoped by unit title).
  const [curriculumDrag, setCurriculumDrag] = useState<{ kind: 'top' | 'unit' | 'unititem'; id: string; scope: string } | null>(null)
  const [curriculumDropTarget, setCurriculumDropTarget] = useState<string | null>(null)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [editLessonIdx, setEditLessonIdx] = useState<number | null>(null)
  const [prefillUnit, setPrefillUnit] = useState<string | null>(null)
  const [showCaseStudyModal, setShowCaseStudyModal] = useState(false)
  const [editCaseStudyIdx, setEditCaseStudyIdx] = useState<number | null>(null)
  const [showEnrolModal, setShowEnrolModal] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null)
  const [previewItem, setPreviewItem] = useState<LMSContent | null>(null)
  const [scoreModal, setScoreModal] = useState<{ studentId: string; studentName: string; contentId: string; courseId: string; lessonTitle: string; caseStudyUrl?: string } | null>(null)
  const [studentSubmissions, setStudentSubmissions] = useState<LMSSubmissionRow[]>([])
  const [studentSubmissionsLoading, setStudentSubmissionsLoading] = useState(false)
  const [allSubmissions, setAllSubmissions] = useState<LMSSubmissionRow[]>([])
  interface AppealListRow { id: string; contentId: string; studentId: string; componentType: ScoreComponentType; message: string; status: 'open' | 'resolved'; adminReply: string | null; createdAt: string }
  const [appeals, setAppeals] = useState<AppealListRow[]>([])
  const [appealsLoading, setAppealsLoading] = useState(false)

  const loadAppeals = useCallback(() => {
    setAppealsLoading(true)
    supabase.from('lms_grade_appeals').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      setAppealsLoading(false)
      if (error) { console.error('lms_grade_appeals load error:', error); return }
      setAppeals((data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, contentId: r.content_id as string, studentId: r.student_id as string,
        componentType: r.component_type as ScoreComponentType, message: r.message as string,
        status: r.status as 'open' | 'resolved', adminReply: (r.admin_reply as string) ?? null,
        createdAt: (r.created_at as string) ?? '',
      })))
    })
  }, [])

  useEffect(() => { loadLMSFromDB().then(setStore) }, [])

  useEffect(() => { if (activeTab === 'appeals') loadAppeals() }, [activeTab, loadAppeals])

  useEffect(() => {
    let q = supabase.from('students').select('id,first_name,last_name,cohort,grade,student_id,campus,status').eq('status', 'Enrolled').order('last_name')
    if (cf) q = q.eq('campus', cf)
    q.then(({ data, error }) => {
      if (error) { console.error('LMS students load error:', error); return }
      if (data) {
        const mapped = data.map((r: Record<string, unknown>) => {
          const firstName = (r.first_name as string) ?? ''
          const lastName = (r.last_name as string) ?? ''
          return {
            id: r.id as string,
            fullName: `${firstName} ${lastName}`.trim() || 'Unknown',
            firstName,
            lastName,
            cohort: (r.cohort as string) ?? '',
            grade: String(r.grade ?? ''),
            studentId: (r.student_id as string) ?? '',
            campus: (r.campus as string) ?? '',
            status: (r.status as string) ?? '',
          }
        })
        setStudents(mapped)
      }
    })
  }, [cf])

  useEffect(() => { setMsVisibleCount(20) }, [msSearch, msCourseFilter, msSectionFilter, msLocationFilter, msStatusFilter, msGradeRange])

  useEffect(() => {
    supabase.from('staff').select('id,first_name,last_name,role,department,email,campus,active').eq('active', true).order('last_name').then(({ data, error }) => {
      if (error) { console.error('LMS staff load error:', error); return }
      if (data) {
        setStaffList(data.map((r: Record<string, unknown>) => {
          const firstName = (r.first_name as string) ?? ''
          const lastName = (r.last_name as string) ?? ''
          return {
            id: r.id as string,
            fullName: `${firstName} ${lastName}`.trim() || 'Unknown',
            firstName, lastName,
            role: (r.role as string) ?? '',
            department: (r.department as string) ?? '',
            email: (r.email as string) ?? '',
            campus: (r.campus as string) ?? '',
          }
        }))
      }
    })
  }, [])

  useEffect(() => {
    if (activeTab !== 'student') return
    if (!studentDetailSid) { setStudentSubmissions([]); return }
    let alive = true
    setStudentSubmissionsLoading(true)
    supabase.from('lms_submissions').select('*').eq('student_id', studentDetailSid).then(({ data, error }) => {
      if (!alive) return
      if (error) {
        console.error('LMS student submissions load error:', error)
        setStudentSubmissions([])
      } else {
        setStudentSubmissions((data ?? []) as LMSSubmissionRow[])
      }
      setStudentSubmissionsLoading(false)
    })
    return () => { alive = false }
  }, [activeTab, studentDetailSid])

  useEffect(() => {
    if (activeTab !== 'gradebook' && activeTab !== 'student') return
    let alive = true
    supabase.from('lms_submissions').select('*').then(({ data, error }) => {
      if (!alive) return
      if (error) {
        console.error('LMS submissions load error:', error)
        setAllSubmissions([])
      } else {
        setAllSubmissions((data ?? []) as LMSSubmissionRow[])
      }
    })
    return () => { alive = false }
  }, [activeTab])

  useEffect(() => {
    if (!reportsMenuOpen) return
    function onClick(e: MouseEvent) {
      if (reportsMenuRef.current && !reportsMenuRef.current.contains(e.target as Node)) setReportsMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [reportsMenuOpen])

  useEffect(() => {
    if (!sectionMenuOpenId) return
    function onClick(e: MouseEvent) {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node)) setSectionMenuOpenId(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [sectionMenuOpenId])

  useEffect(() => {
    if (!curriculumMenuOpenId) return
    function onClick(e: MouseEvent) {
      if (curriculumMenuRef.current && !curriculumMenuRef.current.contains(e.target as Node)) setCurriculumMenuOpenId(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [curriculumMenuOpenId])

  const persist = useCallback(async (updated: LMSStore) => {
    setStore(updated)
    const err = await saveLMS(updated)
    if (err) alert('Save failed: ' + err)
  }, [])

  function closeCourseModal() {
    setShowCourseModal(false)
    setNewSectionGroupId(null)
  }

  // Case Study Assignments are edited in their own modal, not the Tutorial/Mastery Test
  // lesson editor — route to whichever one actually owns this item's fields.
  function openEditItem(item: LMSContent, idx: number, courseId: string) {
    setActiveCourseId(courseId)
    setPrefillUnit(null)
    if (hasAssignBool(item.hasAssignment)) {
      setEditCaseStudyIdx(idx)
      setShowCaseStudyModal(true)
    } else {
      setEditLessonIdx(idx)
      setShowLessonModal(true)
    }
  }

  // ─── Shared per-student × per-course stat calc (Manage Students + student-section detail) ──
  interface StuCourseStat {
    course: LMSCourse
    enrol: LMSEnrolment | undefined
    pct: number
    avgMastery: number | null
    courseGrade: number | null
    onTargetGrade: number
    timeMins: number
    compLessons: number
    totalLessons: number
    paceLabel: string
    paceColor: string
    bucket: 'active' | 'completed' | 'dropped'
  }
  function calcStudentCourseStats(sid: string, course: LMSCourse, enrol: LMSEnrolment | undefined): StuCourseStat {
    const content = store.content.filter(x => x.courseId === course.id)
    const myProg = store.progress.filter(p => p.courseId === course.id && p.studentId === sid)
    const comp = myProg.filter(p => p.status === 'completed').length
    const pct = content.length ? Math.round(comp / content.length * 100) : 0
    const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
    const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
    const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
    const courseGrade = lmsCourseComposite(myProg, content, course.passMark || 80)
    const onTargetGrade = enrol?.assignedAt && enrol?.dueDate
      ? Math.min(100, Math.round((Date.now() - new Date(enrol.assignedAt).getTime()) / (new Date(enrol.dueDate).getTime() - new Date(enrol.assignedAt).getTime()) * 100))
      : pct
    const enrolActive = isActiveBool(enrol?.active)
    const bucket: 'active' | 'completed' | 'dropped' = pct >= 100 ? 'completed' : (enrol && !enrolActive ? 'dropped' : 'active')
    let paceLabel = '—', paceColor = '#94A3B8'
    if (bucket === 'completed') { paceLabel = 'Completed'; paceColor = '#059669' }
    else if (enrol?.assignedAt && enrol?.dueDate) {
      const diff = pct - onTargetGrade
      if (diff >= 15) { paceLabel = 'Ahead of Pace'; paceColor = '#059669' }
      else if (diff >= 5) { paceLabel = 'On Pace'; paceColor = '#16A34A' }
      else if (diff >= -10) { paceLabel = 'Slightly Off Pace'; paceColor = '#D97706' }
      else { paceLabel = 'Off Pace'; paceColor = '#D61F31' }
    }
    return { course, enrol, pct, avgMastery, courseGrade, onTargetGrade, timeMins, compLessons: comp, totalLessons: content.length, paceLabel, paceColor, bucket }
  }
  // Mirrors the (pre-existing) direct grade comparison used by Manage Courses' sectionStats,
  // so enrolment counts stay consistent between the two pages.
  function getStudentCourseStats(student: Student): StuCourseStat[] {
    const seen = new Set<string>()
    const out: StuCourseStat[] = []
    store.enrolments.forEach(en => {
      let matches = false
      if (en.targetType === 'student') matches = en.targetValue === student.id
      else if (en.targetType === 'cohort') matches = en.targetValue === student.cohort
      else if (en.targetType === 'grade') matches = en.targetValue === student.grade
      if (!matches || seen.has(en.courseId)) return
      const course = store.courses.find(c => c.id === en.courseId)
      if (!course) return
      seen.add(en.courseId)
      out.push(calcStudentCourseStats(student.id, course, en))
    })
    return out
  }

  function navTab(tab: string) {
    const t = TABS.find(x => x.v === tab)
    if (t) navigate(t.path)
  }

  // ─── TAB NAV ────────────────────────────────────────────────────────────────
  function renderNav() {
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: '#F0F4FA', padding: 8, borderRadius: 12, marginBottom: 14 }}>
        {TABS.map(t => {
          const active = activeTab === t.v
          return (
            <button key={t.v} onClick={() => navTab(t.v)}
              style={{ padding: '6px 13px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: active ? '#1A365E' : 'transparent', color: active ? '#fff' : '#5A7290', fontFamily: 'inherit' }}>
              {t.l}
            </button>
          )
        })}
      </div>
    )
  }

  // ─── COURSES TAB ────────────────────────────────────────────────────────────
  function renderCourses() {
    const courses = store.courses
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📘 LMS Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{courses.length} courses · Self-paced learning</div>
          </div>
          <button onClick={() => { setEditCourseIdx(null); setShowCourseModal(true) }}
            style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New Course
          </button>
        </div>
        {renderNav()}
        {!courses.length ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No courses yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Create your first course to get started</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {courses.map((course, idx) => {
              const col = SUBJECT_COLORS[course.subject] || '#6B7280'
              const contentItems = store.content.filter(x => x.courseId === course.id)
              const unitSet = new Set(contentItems.map(x => x.unitTitle).filter(Boolean))
              const statusCol = course.status === 'Published' ? '#059669' : '#D97706'
              return (
                <div key={course.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: 8, background: col }} />
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', flex: 1, marginRight: 8 }}>{course.title}</div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: statusCol, background: statusCol + '18', padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{course.status || 'Draft'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>{course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''}</div>
                    {course.description && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 10, lineHeight: 1.5 }}>{course.description.substring(0, 100)}{course.description.length > 100 ? '…' : ''}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#7A92B0', marginBottom: 12 }}>
                      <span>📂 {unitSet.size} module{unitSet.size !== 1 ? 's' : ''}</span>
                      <span>📄 {contentItems.length} lesson{contentItems.length !== 1 ? 's' : ''}</span>
                      <span>🎯 Pass: {course.passMark || 80}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditCourseIdx(idx); setShowCourseModal(true) }}
                        style={{ flex: 1, padding: 7, background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Edit</button>
                      <button onClick={() => { setActiveCourseId(course.id); navTab('content') }}
                        style={{ flex: 1, padding: 7, background: '#E8FBF0', color: '#059669', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📄 Content</button>
                      <button onClick={() => setConfirmDialog({
                        title: 'Delete Course',
                        message: 'Delete this course and all its content? This cannot be undone.',
                        danger: true,
                        confirmLabel: 'Delete',
                        onConfirm: async () => {
                          await deleteLMSCourse(course.id)
                          const updated = { ...store, courses: store.courses.filter((_, i) => i !== idx), content: store.content.filter(x => x.courseId !== course.id) }
                          setStore(updated)
                        },
                      })} style={{ padding: '7px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── CONTENT TAB ────────────────────────────────────────────────────────────
  function renderContent() {
    const courseId = activeCourseId || (store.courses[0]?.id ?? '')
    const course = store.courses.find(x => x.id === courseId)
    const items = store.content.filter(x => x.courseId === courseId)
      .sort((a, b) => ((a.unitOrder ?? 0) - (b.unitOrder ?? 0)) || ((a.order ?? 0) - (b.order ?? 0)))
    const units: string[] = []
    const unitMap: Record<string, LMSContent[]> = {}
    items.forEach(item => {
      const ut = item.unitTitle || 'Default Module'
      if (!unitMap[ut]) { unitMap[ut] = []; units.push(ut) }
      unitMap[ut].push(item)
    })
    const courseOpts = store.courses.map(co => ({ value: co.id, label: co.title }))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📄 Content Library</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{items.length} lesson{items.length !== 1 ? 's' : ''} · {units.length} module{units.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={courseId} onChange={e => setActiveCourseId(e.target.value)} style={iStyle}>
              {courseOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setPromptDialog({
              title: 'New Module',
              label: 'Module title',
              placeholder: 'e.g. Module 1: Business Writing Fundamentals & Persuasive Memos',
              confirmLabel: 'Continue',
              onConfirm: (ut) => { setPrefillUnit(ut); setEditLessonIdx(null); setShowLessonModal(true) },
            })} style={{ padding: '9px 14px', background: '#EEF3FF', color: '#1A365E', border: '1px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Module</button>
            <button onClick={() => { setPrefillUnit(null); setEditLessonIdx(null); setShowLessonModal(true) }}
              style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Lesson</button>
            <button onClick={() => { setActiveCourseId(courseId); setPrefillUnit(null); setEditCaseStudyIdx(null); setShowCaseStudyModal(true) }}
              style={{ padding: '9px 14px', background: '#FFF3D6', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📚 + Case Study</button>
          </div>
        </div>
        {renderNav()}
        {!store.courses.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Create a course first before adding content.</div>
        ) : !items.length ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No content yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Add a module then add lessons inside it</div>
          </div>
        ) : units.map(unitTitle => {
          const unitItems = unitMap[unitTitle]
          return (
            <div key={unitTitle} style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ background: '#F7F9FC', padding: '10px 16px', borderBottom: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>📂 {unitTitle}</div>
                <span style={{ fontSize: 10, color: '#7A92B0' }}>{unitItems.length} lesson{unitItems.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ padding: 8 }}>
                {unitItems.map((item, i) => {
                  const realIdx = store.content.indexOf(item)
                  const typeCol = TYPE_COLORS[item.type] || '#6B7280'
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, background: i % 2 === 0 ? '#fff' : '#FAFBFF', border: '1px solid #F0F4FA', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || 'Untitled'}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#7A92B0', marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ color: typeCol, fontWeight: 700 }}>{item.type}</span>
                          {item.estimatedMins && <span>⏱ {item.estimatedMins} min</span>}
                          {hasMasteryBool(item.hasMastery) && <span style={{ color: '#059669', fontWeight: 700 }}>✓ Mastery test</span>}
                          {hasAssignBool(item.hasAssignment) && <span style={{ background: '#EEF3FF', color: '#1A365E', fontWeight: 700, fontSize: 9, padding: '2px 7px', borderRadius: 4, border: '1px solid #C7D9FF' }}>📚 Case Study Assignment</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setPreviewItem(item)} title="Preview as student" style={{ padding: '5px 10px', background: '#F0FFF4', color: '#1DBD6A', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>👁</button>
                        <button onClick={() => openEditItem(item, realIdx, courseId)}
                          style={{ padding: '5px 10px', background: '#EEF3FF', color: '#1A365E', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                        <button onClick={() => setConfirmDialog({
                          title: 'Delete Lesson',
                          message: 'Delete this lesson? This cannot be undone.',
                          danger: true,
                          confirmLabel: 'Delete',
                          onConfirm: async () => {
                            await deleteLMSContent(item.id)
                            const updated = { ...store, content: store.content.filter((_, j) => j !== realIdx) }
                            setStore(updated)
                          },
                        })} style={{ padding: '5px 8px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {(course?.announcement) && (
          <div style={{ background: '#FFF9F0', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
            📢 <strong>Announcement:</strong> {course.announcement}
          </div>
        )}
      </div>
    )
  }

  // ─── ASSIGN TAB ─────────────────────────────────────────────────────────────
  function renderAssign() {
    const enrolments = store.enrolments
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>👥 Assign Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{enrolments.length} active enrolment{enrolments.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setShowEnrolModal(true)}
            style={{ padding: '9px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Assign Course
          </button>
        </div>
        {renderNav()}
        {!enrolments.length ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No assignments yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Assign courses to cohorts or individual students</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enrolments.map((en, idx) => {
              const course = store.courses.find(x => x.id === en.courseId)
              const enrolStart = en.assignedAt ? new Date(en.assignedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
              const active = isActiveBool(en.active)
              return (
                <div key={en.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{course?.title || 'Unknown Course'}</div>
                    <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                      {en.targetType === 'cohort' ? '🏫 Cohort: ' : '👤 Student: '}{en.targetValue}
                      {enrolStart ? ' · Start: ' + enrolStart : ''}
                      {en.dueDate ? ' · Due: ' + en.dueDate : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#059669' : '#94A3B8', background: active ? '#DCFCE7' : '#F1F5F9', padding: '2px 8px', borderRadius: 5 }}>{active ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => setConfirmDialog({
                    title: 'Remove Course Assignment',
                    message: 'Remove this course assignment?',
                    danger: true,
                    confirmLabel: 'Remove',
                    onConfirm: async () => {
                      await deleteLMSEnrolment(en.id)
                      const updated = { ...store, enrolments: store.enrolments.filter((_, i) => i !== idx) }
                      setStore(updated)
                    },
                  })} style={{ padding: '6px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 7, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── PROGRESS TAB ───────────────────────────────────────────────────────────
  function renderProgress() {
    const prog = store.progress
    const filtered = progFilterCourse ? prog.filter(p => p.courseId === progFilterCourse) : prog
    const grouped: Record<string, { studentId: string; courseId: string; items: LMSProgress[] }> = {}
    filtered.forEach(p => {
      const key = p.studentId + '_' + p.courseId
      if (!grouped[key]) grouped[key] = { studentId: p.studentId, courseId: p.courseId, items: [] }
      grouped[key].items.push(p)
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>📈 LMS Progress Reports</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{prog.length} progress record{prog.length !== 1 ? 's' : ''}</div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <select value={progFilterCourse} onChange={e => setProgFilterCourse(e.target.value)} style={iStyle}>
            <option value="">All Courses</option>
            {store.courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
          </select>
        </div>
        {!Object.keys(grouped).length ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>No progress data yet</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Progress appears here as students engage with LMS content</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(grouped).map(g => {
              const course = store.courses.find(x => x.id === g.courseId)
              const stu = students.find(s => s.id === g.studentId)
              const total = store.content.filter(x => x.courseId === g.courseId).length
              const completed = g.items.filter(p => p.status === 'completed').length
              const pct = total ? Math.round(completed / total * 100) : 0
              const pCol = pct >= 80 ? '#059669' : pct >= 40 ? '#D97706' : '#D61F31'
              const initials = stu ? (stu.firstName[0] || '') + (stu.lastName[0] || '') : g.studentId.substring(0, 2)
              return (
                <div key={g.studentId + '_' + g.courseId} style={{ ...card, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{stu ? stu.fullName : g.studentId}</div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>{course?.title || g.courseId}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: pCol }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>{completed}/{total} lessons</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 6, background: '#F0F4FA', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: pCol, borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
  function renderOverview() {
    const activeCourses = store.courses.filter(co => co.status === 'Published')
    let totalEnrollments = 0
    const perCourse = activeCourses.map(co => {
      const enrols = store.enrolments.filter(en => en.courseId === co.id && isActiveBool(en.active))
      const enrolledIds = new Set<string>()
      enrols.forEach(en => {
        if (en.targetType === 'student') enrolledIds.add(en.targetValue)
        else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
        else if (en.targetType === 'grade') students.filter(s => s.grade === en.targetValue).forEach(s => enrolledIds.add(s.id))
      })
      totalEnrollments += enrolledIds.size
      const courseProg = store.progress.filter(p => p.courseId === co.id)
      const timeMins = courseProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
      const content = store.content.filter(x => x.courseId === co.id)
      const creditsEarned = [...enrolledIds].reduce((sum, sid) => {
        const myProg = courseProg.filter(p => p.studentId === sid)
        const comp = myProg.filter(p => p.status === 'completed').length
        const pct = content.length ? Math.round(comp / content.length * 100) : 0
        return sum + (pct >= 100 ? (co.creditHours || 1) : 0)
      }, 0)
      return { course: co, timeMins, creditsEarned }
    })
    const activeSectionsCount = store.enrolments.filter(en => isActiveBool(en.active)).length
    const totalTimeMins = perCourse.reduce((s, x) => s + x.timeMins, 0)
    const totalCredits = perCourse.reduce((s, x) => s + x.creditsEarned, 0)
    const topByTime = [...perCourse].filter(x => x.timeMins > 0).sort((a, b) => b.timeMins - a.timeMins).slice(0, 5)
    const topByCredits = [...perCourse].filter(x => x.creditsEarned > 0).sort((a, b) => b.creditsEarned - a.creditsEarned).slice(0, 5)
    const modulesCompleted = store.progress.filter(p => p.status === 'completed').length
    const modulesMastered = store.progress.filter(p => p.masteryPassed === true).length

    const usageDays = Number(usageRange)
    const perfDays = Number(performanceRange)
    const usageDates = rangeDates(usageDays)
    const perfDates = rangeDates(perfDays)

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1A365E' }}>Courseware</div>
            <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2, fontStyle: 'italic' }}>Data as of {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div ref={reportsMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setReportsMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#fff', border: '1.5px solid #D8E1EC', borderRadius: 9, fontSize: 12, fontWeight: 800, color: '#1A365E', cursor: 'pointer', fontFamily: 'inherit' }}>
              📊 REPORTS <span style={{ fontSize: 9 }}>{reportsMenuOpen ? '▲' : '▼'}</span>
            </button>
            {reportsMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(26,54,94,0.14)', minWidth: 210, zIndex: 20, overflow: 'hidden' }}>
                <button onClick={() => { setReportsMenuOpen(false); usageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#1A365E', cursor: 'pointer', fontFamily: 'inherit' }}>Program Usage</button>
                <button onClick={() => { setReportsMenuOpen(false); performanceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#1A365E', cursor: 'pointer', fontFamily: 'inherit' }}>Program Performance</button>
              </div>
            )}
          </div>
        </div>

        {renderNav()}

        {/* KPI row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <KpiCard icon="📚" iconBg="#EEF1FB" value={activeCourses.length} label="Active Courses" />
          <KpiCard icon="📝" iconBg="#E8F3FF" value={activeSectionsCount} label="Active Sections" />
          <KpiCard icon="👥" iconBg="#FFF4E5" value={totalEnrollments} label="Active Enrollments" />
        </div>

        {/* Program Usage */}
        <div ref={usageSectionRef} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Program Usage</div>
            <select value={usageRange} onChange={e => setUsageRange(e.target.value)} style={{ ...selectStyle, width: 132, flex: 'none' }}>
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>Daily Time On Task</div>
                <div style={{ fontSize: 11, color: '#7A92B0' }}>{rangeLabel(usageDays)}</div>
              </div>
              <TimeSeriesChart dates={usageDates} unit="hours" series={[{ label: 'Time on Task', color: '#2563EB', values: usageDates.map(() => 0) }]} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Total Time on Task</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{rangeLabel(usageDays)}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#2563EB', marginTop: 10 }}>{fmtTime(totalTimeMins)}</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 4 }}>Daily Avg: {fmtTime(Math.round(totalTimeMins / usageDays))}</div>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Top 5 Courses by Time on Task</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2, marginBottom: 14 }}>{rangeLabel(usageDays)}</div>
                <TopList items={topByTime.map(x => ({ title: x.course.title, value: fmtTime(x.timeMins) }))} />
              </div>
            </div>
          </div>
        </div>

        {/* Program Performance */}
        <div ref={performanceSectionRef} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Program Performance</div>
            <select value={performanceRange} onChange={e => setPerformanceRange(e.target.value)} style={{ ...selectStyle, width: 132, flex: 'none' }}>
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>Daily Module Progress</div>
                <div style={{ fontSize: 11, color: '#7A92B0' }}>{rangeLabel(perfDays)}</div>
              </div>
              <TimeSeriesChart dates={perfDates} unit="count" series={[
                { label: 'Modules Completed', color: '#FBA76B', values: perfDates.map(() => 0) },
                { label: 'Modules Mastered', color: '#D2601A', values: perfDates.map(() => 0) },
              ]} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2.5px solid #1DBD6A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎖️</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Total Credits Earned</div>
                  <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 1 }}>{rangeLabel(perfDays)}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#1DBD6A', marginLeft: 'auto' }}>{totalCredits}</div>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Top 5 Courses by Credits Earned</div>
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2, marginBottom: 14 }}>{rangeLabel(perfDays)}</div>
                <TopList items={topByCredits.map(x => ({ title: x.course.title, value: String(x.creditsEarned) }))} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#B7C3D6', marginTop: 10 }}>
            {modulesCompleted} modules completed · {modulesMastered} modules mastered to date (daily breakdown requires per-day activity tracking, coming in a later step)
          </div>
        </div>
      </div>
    )
  }

  // ─── MANAGE TAB ─────────────────────────────────────────────────────────────
  function renderManage() {
    interface CourseGroupRow { key: string; title: string; groupId: string | null; sections: LMSCourse[] }

    function fmtDateShort(iso?: string | null): string {
      if (!iso) return 'None'
      const d = new Date(iso + 'T00:00:00')
      if (isNaN(d.getTime())) return 'None'
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`
    }

    function sectionStats(co: LMSCourse) {
      const enrols = store.enrolments.filter(en => en.courseId === co.id && isActiveBool(en.active))
      const enrolledIds = new Set<string>()
      enrols.forEach(en => {
        if (en.targetType === 'student') enrolledIds.add(en.targetValue)
        else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
        else if (en.targetType === 'grade') students.filter(s => s.grade === en.targetValue).forEach(s => enrolledIds.add(s.id))
      })
      const enrollCount = enrolledIds.size
      const courseProg = store.progress.filter(p => p.courseId === co.id)
      const timeMins = courseProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
      const content = store.content.filter(x => x.courseId === co.id)
      const creditsEarned = [...enrolledIds].reduce((sum, sid) => {
        const myProg = courseProg.filter(p => p.studentId === sid)
        const comp = myProg.filter(p => p.status === 'completed').length
        const pct = content.length ? Math.round(comp / content.length * 100) : 0
        return sum + (pct >= 100 ? (co.creditHours || 1) : 0)
      }, 0)
      return { enrollCount, timeMins, creditsEarned }
    }

    function openNewSection(lockGroupId: string | null) {
      setNewSectionGroupId(lockGroupId)
      setShowNewSectionFlow(true)
    }
    function addSectionToGroupRow(g: CourseGroupRow) {
      if (g.groupId) { openNewSection(g.groupId); return }
      // Ungrouped standalone course — create a real Course using its current title, reassign it, then lock the new section to it
      const newGroupId = crypto.randomUUID()
      const newGroup: LMSCourseGroup = { id: newGroupId, title: g.title }
      const courses = store.courses.map(c => c.id === g.sections[0].id ? { ...c, groupId: newGroupId } : c)
      persist({ ...store, courses, courseGroups: [...store.courseGroups, newGroup] })
      openNewSection(newGroupId)
    }
    function editSection(co: LMSCourse) {
      setEditCourseIdx(store.courses.findIndex(c => c.id === co.id))
      setNewSectionGroupId(null)
      setShowNewSectionFlow(true)
      setSectionMenuOpenId(null)
    }
    function duplicateSection(co: LMSCourse) {
      const dup: LMSCourse = { ...co, id: lmsId(), title: co.title + ' (Copy)', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      persist({ ...store, courses: [...store.courses, dup] })
      setSectionMenuOpenId(null)
    }
    function toggleSectionActive(co: LMSCourse) {
      const nextStatus = co.status === 'Published' ? 'Draft' : 'Published'
      persist({ ...store, courses: store.courses.map(c => c.id === co.id ? { ...c, status: nextStatus } : c) })
      setSectionMenuOpenId(null)
    }
    function deleteSection(co: LMSCourse) {
      setSectionMenuOpenId(null)
      setConfirmDialog({
        title: 'Delete Section',
        message: `Delete section "${co.title}"? This cannot be undone.`,
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await deleteLMSCourse(co.id)
          setStore(prev => ({ ...prev, courses: prev.courses.filter(c => c.id !== co.id), content: prev.content.filter(x => x.courseId !== co.id) }))
        },
      })
    }
    function selectAllInGroup(g: CourseGroupRow) {
      setSelectedSectionIds(prev => { const next = new Set(prev); g.sections.forEach(s => next.add(s.id)); return next })
    }
    function deselectAllInGroup(g: CourseGroupRow) {
      setSelectedSectionIds(prev => { const next = new Set(prev); g.sections.forEach(s => next.delete(s.id)); return next })
    }
    function toggleSectionSelected(id: string) {
      setSelectedSectionIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
    }

    const allCourses = store.courses
    let filtered = allCourses.filter(co => manageTabFilter === 'active' ? co.status === 'Published' : co.status !== 'Published')
    if (manageSearch) {
      const q = manageSearch.toLowerCase()
      filtered = filtered.filter(co => co.title.toLowerCase().includes(q) || (co.subject || '').toLowerCase().includes(q))
    }
    if (manageTypeFilter) filtered = filtered.filter(co => co.subject === manageTypeFilter)
    const subjects = [...new Set(allCourses.map(co => co.subject).filter(Boolean))]

    const groupsMap = new Map<string, CourseGroupRow>()
    filtered.forEach(co => {
      const key = co.groupId || co.id
      let g = groupsMap.get(key)
      if (!g) {
        const title = co.groupId ? (store.courseGroups.find(x => x.id === co.groupId)?.title || co.title) : co.title
        g = { key, title, groupId: co.groupId ?? null, sections: [] }
        groupsMap.set(key, g)
      }
      g.sections.push(co)
    })
    const groupRows = [...groupsMap.values()].sort((a, b) => a.title.localeCompare(b.title))

    const actionBtnStyle: React.CSSProperties = { width: 30, height: 30, borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    const menuItemStyle: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: '#1A365E', cursor: 'pointer', fontFamily: 'inherit' }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Manage Courses</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Data as of {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', pointerEvents: 'none' }}>🔍</span>
              <input value={manageSearch} onChange={e => setManageSearch(e.target.value)} placeholder="Search for Courses or Sections" style={{ ...iStyle, paddingLeft: 28, paddingRight: manageSearch ? 28 : 10, width: 240 }} />
              {manageSearch && (
                <button onClick={() => setManageSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94A3B8', fontFamily: 'inherit' }}>✕</button>
              )}
            </div>
            <button onClick={() => openNewSection(null)} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⊕ NEW SECTION</button>
          </div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E4EAF2' }}>
            {(['active', 'inactive'] as const).map(tab => (
              <button key={tab} onClick={() => setManageTabFilter(tab)}
                style={{ padding: '8px 18px', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: manageTabFilter === tab ? '#1A365E' : '#94A3B8', borderBottom: manageTabFilter === tab ? '2px solid #1A365E' : '2px solid transparent', marginBottom: -2, textTransform: 'capitalize', fontFamily: 'inherit' }}>
                {tab === 'active' ? 'Active Sections' : 'Inactive Sections'}
              </button>
            ))}
          </div>
          <select value={manageTypeFilter} onChange={e => setManageTypeFilter(e.target.value)} style={iStyle}>
            <option value="">All Course Types</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 150px', padding: '8px 16px', borderBottom: '1px solid #E4EAF2', gap: 8 }}>
            {['Course', 'Enrollments', 'Time on Task', 'Credits Earned', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.8px', textAlign: i > 0 ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>
          {!groupRows.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{manageSearch ? 'No courses match your search' : 'No ' + manageTabFilter + ' courses'}</div>
            </div>
          ) : groupRows.map((g, idx) => {
            const stats = g.sections.map(sectionStats)
            const enrollCount = stats.reduce((s, x) => s + x.enrollCount, 0)
            const totalTimeMins = stats.reduce((s, x) => s + x.timeMins, 0)
            const creditsEarned = stats.reduce((s, x) => s + x.creditsEarned, 0)
            const isExpanded = !!manageExpanded[g.key]
            const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
            return (
              <div key={g.key} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 150px', padding: '12px 16px', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setManageExpanded(prev => ({ ...prev, [g.key]: !prev[g.key] }))}
                      style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid #E4EAF2', background: '#F7F9FC', cursor: 'pointer', fontSize: 11, color: '#5A7290', flexShrink: 0, fontFamily: 'inherit' }}>
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: '#FFF4E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 16 }}>📘</span></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: '#7A92B0' }}>{g.sections.length} Section{g.sections.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>{enrollCount > 0 ? <div style={{ fontSize: 20, fontWeight: 900, color: '#1A365E' }}>{enrollCount}</div> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ textAlign: 'center' }}>{totalTimeMins > 0 ? <div style={{ fontSize: 14, fontWeight: 700, color: '#1A365E' }}>{fmtTime(totalTimeMins)}</div> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ textAlign: 'center' }}>{enrollCount > 0 ? <div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>{creditsEarned}</div> : <div style={{ fontSize: 16, color: '#94A3B8' }}>—</div>}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => navigate('/lms/overview')} title="Reports" style={{ ...actionBtnStyle, background: '#EEF3FF' }}>📊</button>
                    <button onClick={() => addSectionToGroupRow(g)} title="Add Section" style={{ ...actionBtnStyle, background: '#E8FBF0', color: '#059669' }}>📑➕</button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ background: '#F7F9FC', borderTop: '1px solid #E4EAF2', padding: '10px 16px 14px 56px' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                      <button onClick={() => selectAllInGroup(g)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Select All</button>
                      <span style={{ color: '#D8E1EC' }}>|</span>
                      <button onClick={() => deselectAllInGroup(g)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Deselect All</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {g.sections.map(co => {
                        const st = sectionStats(co)
                        return (
                          <div key={co.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 150px', gap: 8, padding: '10px 0', borderBottom: '1px solid #E9EEF5', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <input type="checkbox" checked={selectedSectionIds.has(co.id)} onChange={() => toggleSectionSelected(co.id)} style={{ marginTop: 3, cursor: 'pointer' }} />
                              <div>
                                <div onClick={() => { setGbCourseId(co.id); setSectionCourseId(co.id); navTab('section') }}
                                  style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>{co.title}</div>
                                <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 2 }}>Start Date: {fmtDateShort(co.startDate)} - End Date: {fmtDateShort(co.endDate)}</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: st.enrollCount > 0 ? '#1A365E' : '#94A3B8' }}>{st.enrollCount > 0 ? st.enrollCount : '—'}</div>
                            <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: st.timeMins > 0 ? '#1A365E' : '#94A3B8' }}>{st.timeMins > 0 ? fmtTime(st.timeMins) : '—'}</div>
                            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: st.creditsEarned > 0 ? '#059669' : '#94A3B8' }}>{st.enrollCount > 0 ? st.creditsEarned : '—'}</div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', position: 'relative' }}>
                              <button onClick={() => setNotesSectionId(co.id)}
                                title="Section Notes" style={{ ...actionBtnStyle, background: '#EEF3FF' }}>📝</button>
                              <button onClick={() => { setGbCourseId(co.id); navTab('gradebook') }}
                                title="Gradebook" style={{ ...actionBtnStyle, background: '#FFF4E5' }}>🅰️➕</button>
                              <button onClick={() => { setCurriculumCourseId(co.id); navTab('curriculum') }}
                                title="View Curriculum" style={{ ...actionBtnStyle, background: '#F0F4FA' }}>🔍</button>
                              <button onClick={() => setSectionMenuOpenId(prev => prev === co.id ? null : co.id)}
                                title="More actions" style={{ ...actionBtnStyle, background: '#F7F9FC' }}>⋯</button>
                              {sectionMenuOpenId === co.id && (
                                <div ref={sectionMenuRef} style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(26,54,94,0.14)', minWidth: 170, zIndex: 30, overflow: 'hidden' }}>
                                  <button onClick={() => editSection(co)} style={menuItemStyle}>✏️ Edit Section</button>
                                  <button onClick={() => duplicateSection(co)} style={menuItemStyle}>⧉ Duplicate</button>
                                  <button onClick={() => toggleSectionActive(co)} style={menuItemStyle}>{co.status === 'Published' ? '⏸ Deactivate' : '▶ Activate'}</button>
                                  <button onClick={() => deleteSection(co)} style={{ ...menuItemStyle, color: '#D61F31', borderTop: '1px solid #F0F4FA' }}>🗑 Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── MANAGE STUDENTS TAB ────────────────────────────────────────────────────
  function renderManageStudents() {
    interface CourseGroupRow { key: string; title: string; sections: LMSCourse[] }
    const groupsMap = new Map<string, CourseGroupRow>()
    store.courses.forEach(co => {
      const key = co.groupId || co.id
      let g = groupsMap.get(key)
      if (!g) {
        const title = co.groupId ? (store.courseGroups.find(x => x.id === co.groupId)?.title || co.title) : co.title
        g = { key, title, sections: [] }
        groupsMap.set(key, g)
      }
      g.sections.push(co)
    })
    const groupRows = [...groupsMap.values()].sort((a, b) => a.title.localeCompare(b.title))
    const sectionOptions = msCourseFilter ? (groupsMap.get(msCourseFilter)?.sections ?? []) : store.courses

    function resetFilters() {
      setMsSearch(''); setMsCourseFilter(''); setMsSectionFilter(''); setMsLocationFilter('')
      setMsStatusFilter(''); setMsSort('az'); setMsGradeRange([1, GRADES.length - 1])
    }

    const q = msSearch.trim().toLowerCase()
    let filtered = students.filter(s => {
      const idx = GRADES.indexOf(s.grade)
      if (idx !== -1 && (idx < msGradeRange[0] || idx > msGradeRange[1])) return false
      if (msLocationFilter && s.campus !== msLocationFilter) return false
      if (q) {
        const hay = [s.fullName, s.studentId, s.cohort, s.grade].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (msCourseFilter || msSectionFilter || msStatusFilter) {
        const stats = getStudentCourseStats(s)
        const match = stats.some(st =>
          (!msCourseFilter || (st.course.groupId || st.course.id) === msCourseFilter) &&
          (!msSectionFilter || st.course.id === msSectionFilter) &&
          (!msStatusFilter || st.bucket === msStatusFilter)
        )
        if (!match) return false
      }
      return true
    })
    filtered = [...filtered].sort((a, b) => {
      const cmp = (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName)
      return msSort === 'az' ? cmp : -cmp
    })
    const visible = filtered.slice(0, msVisibleCount)

    const BUCKET_TABS: { k: 'active' | 'completed' | 'dropped'; l: string }[] = [
      { k: 'active', l: 'Active Sections' }, { k: 'completed', l: 'Completed Sections' }, { k: 'dropped', l: 'Dropped Sections' },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Manage Students</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Data as of {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8', pointerEvents: 'none' }}>🔍</span>
            <input value={msSearch} onChange={e => setMsSearch(e.target.value)} placeholder="Search students" style={{ ...iStyle, paddingLeft: 28, width: 220 }} />
          </div>
        </div>
        {renderNav()}

        <div style={{ ...card, padding: '12px 16px', marginTop: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={msCourseFilter} onChange={e => { setMsCourseFilter(e.target.value); setMsSectionFilter('') }} style={iStyle}>
              <option value="">All Courses</option>
              {groupRows.map(g => <option key={g.key} value={g.key}>{g.title}</option>)}
            </select>
            <select value={msSectionFilter} onChange={e => setMsSectionFilter(e.target.value)} style={iStyle}>
              <option value="">All Sections</option>
              {sectionOptions.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
            </select>
            <select value={msLocationFilter} onChange={e => setMsLocationFilter(e.target.value)} style={iStyle}>
              <option value="">All Locations</option>
              {campuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={msStatusFilter} onChange={e => setMsStatusFilter(e.target.value)} style={iStyle}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
            <button onClick={resetFilters} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reset Filters</button>
            <div style={{ marginLeft: 'auto' }}>
              <select value={msSort} onChange={e => setMsSort(e.target.value as 'az' | 'za')} style={iStyle}>
                <option value="az">Sort by name A-Z</option>
                <option value="za">Sort by name Z-A</option>
              </select>
            </div>
          </div>
          <GradeRangeSlider min={1} max={GRADES.length - 1} value={msGradeRange} onChange={setMsGradeRange} />
        </div>

        <div style={{ fontSize: 12, color: '#7A92B0', marginBottom: 10 }}>Showing {visible.length} of {filtered.length} Students</div>

        <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 12, overflow: 'hidden' }}>
          {!visible.length ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👨‍🎓</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>No students match your filters</div>
            </div>
          ) : visible.map((s, idx) => {
            const stats = getStudentCourseStats(s).filter(st =>
              (!msCourseFilter || (st.course.groupId || st.course.id) === msCourseFilter) &&
              (!msSectionFilter || st.course.id === msSectionFilter)
            )
            const buckets = { active: stats.filter(x => x.bucket === 'active'), completed: stats.filter(x => x.bucket === 'completed'), dropped: stats.filter(x => x.bucket === 'dropped') }
            const rowKey = s.id
            const isExpanded = !!msExpanded[rowKey]
            const subTab = msSectionTab[rowKey] ?? 'active'
            const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
            return (
              <div key={s.id} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 17 }}>👤</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{s.lastName}, {s.firstName}</div>
                      <div style={{ fontSize: 11, color: '#7A92B0' }}>Grade {s.grade || '—'}{s.studentId ? ` • SIS ID: ${s.studentId}` : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => setMsExpanded(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A365E', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {buckets.active.length} Active Section{buckets.active.length !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
                {isExpanded && (
                  <div style={{ background: '#F7F9FC', borderTop: '1px solid #E4EAF2', padding: '10px 16px 14px 64px' }}>
                    <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E4EAF2', marginBottom: 10 }}>
                      {BUCKET_TABS.map(t => (
                        <button key={t.k} onClick={() => setMsSectionTab(prev => ({ ...prev, [rowKey]: t.k }))}
                          style={{ padding: '7px 14px', border: 'none', background: 'transparent', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: subTab === t.k ? '#1A365E' : '#94A3B8', borderBottom: subTab === t.k ? '2px solid #1A365E' : '2px solid transparent', marginBottom: -2, fontFamily: 'inherit' }}>
                          {t.l} ({buckets[t.k].length})
                        </button>
                      ))}
                    </div>
                    {!buckets[subTab].length ? (
                      <div style={{ padding: '16px 0', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>No {subTab} sections.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 110px 110px 110px 150px 100px', gap: 8, padding: '6px 0', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        <div>Section</div><div style={{ textAlign: 'center' }}>On-Target</div><div style={{ textAlign: 'center' }}>Current</div><div style={{ textAlign: 'center' }}>Course Grade</div><div>Activities</div><div style={{ textAlign: 'center' }}>Time on Task</div>
                      </div>
                    )}
                    {buckets[subTab].map(st => {
                      const onTgtCol = st.onTargetGrade >= (st.course.passMark || 80) ? '#059669' : '#D61F31'
                      const curCol = st.avgMastery !== null ? (st.avgMastery >= (st.course.passMark || 80) ? '#059669' : '#D61F31') : '#7A92B0'
                      const courseCol = st.courseGrade !== null ? (st.courseGrade >= (st.course.passMark || 80) ? '#059669' : '#D61F31') : '#7A92B0'
                      return (
                        <div key={st.course.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 110px 110px 110px 150px 100px', gap: 8, padding: '9px 0', borderBottom: '1px solid #E9EEF5', alignItems: 'center' }}>
                          <div onClick={() => navigate(`/lms/student-section?sid=${s.id}&cid=${st.course.id}`)} style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', cursor: 'pointer' }}>{st.course.title}</div>
                          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: onTgtCol }}>{st.bucket === 'active' && (st.enrol?.assignedAt && st.enrol?.dueDate) ? `${st.onTargetGrade}%` : '—'}</div>
                          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: curCol }}>{st.avgMastery !== null ? `${st.avgMastery}%` : '—'}</div>
                          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: courseCol }}>{st.courseGrade !== null ? `${st.courseGrade}%` : '—'}</div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{st.compLessons}/{st.totalLessons} ({st.totalLessons ? Math.round(st.compLessons / st.totalLessons * 100) : 0}%)</div>
                            <div style={{ height: 4, borderRadius: 2, background: '#E4EAF2', marginTop: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${st.totalLessons ? Math.round(st.compLessons / st.totalLessons * 100) : 0}%`, background: '#1A365E' }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{fmtTime(st.timeMins)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {filtered.length > visible.length && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button onClick={() => setMsVisibleCount(c => c + 20)} style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Show 20 More</button>
          </div>
        )}
      </div>
    )
  }

  // ─── STUDENT-SECTION DETAIL TAB (reached from Manage Students) ─────────────
  function renderStudentSectionDetail() {
    const sid = studentDetailSid
    const cid = studentDetailCid
    const student = students.find(s => s.id === sid)
    const course = store.courses.find(c => c.id === cid)
    if (!sid || !cid || !student || !course) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>Student Section Detail</div>
          {renderNav()}
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>No student/section selected.</div>
        </div>
      )
    }
    const enrol = store.enrolments.find(en => en.courseId === cid && (
      (en.targetType === 'student' && en.targetValue === sid) ||
      (en.targetType === 'cohort' && en.targetValue === student.cohort) ||
      (en.targetType === 'grade' && en.targetValue === student.grade)
    ))
    const stat = calcStudentCourseStats(sid, course, enrol)
    const passMark = course.passMark || 80
    const content = store.content.filter(x => x.courseId === course.id)
    const myProg = store.progress.filter(p => p.courseId === course.id && p.studentId === sid)
    const topLevel = content.filter(x => !x.unitTitle).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const unitTitles = [...new Set(content.filter(x => x.unitTitle).map(x => x.unitTitle as string))]
    const units = unitTitles.map(t => {
      const items = content.filter(x => x.unitTitle === t).sort((a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
      return { title: t, unitOrder: items[0]?.unitOrder ?? 0, items }
    }).sort((a, b) => a.unitOrder - b.unitOrder)

    function isExpanded(key: string) { return curriculumExpanded[key] !== false }
    function toggleExpanded(key: string) { setCurriculumExpanded(prev => ({ ...prev, [key]: !isExpanded(key) })) }
    function expandAll() {
      const next: Record<string, boolean> = {}
      units.forEach(u => { next['unit:' + u.title] = true })
      setCurriculumExpanded(next)
    }
    function collapseAll() {
      const next: Record<string, boolean> = {}
      units.forEach(u => { next['unit:' + u.title] = false })
      setCurriculumExpanded(next)
    }

    const thStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.05em', padding: '8px 8px', textAlign: 'center' }
    const statusIconStyle = (active?: boolean): React.CSSProperties => ({ width: 22, height: 22, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: active ? '#1A365E' : '#F0F4FA', color: active ? '#fff' : '#C4D0DE' })

    function renderResultRow(item: LMSContent, depth: number) {
      const prog = myProg.find(p => p.contentId === item.id)
      const compositeScore = lmsCompositeScore(prog, item, passMark)
      const attempts = prog?.masteryAttempts ?? 0
      const timeMins = prog?.timeSpentMins ?? 0
      const scoreCol = compositeScore !== null ? (compositeScore >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
      const reviewKey = 'review:' + item.id
      const reviewOpen = !!curriculumExpanded[reviewKey]
      const hasResult = prog?.masteryScore != null || prog?.assignScore != null
      return (
        <Fragment key={item.id}>
          <tr style={{ borderBottom: '1px solid #F0F4FA' }}>
            <td style={{ padding: '8px 10px', paddingLeft: 12 + depth * 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{TYPE_ICONS[item.type] || '📄'}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{item.title || 'Untitled'}</span>
              </div>
            </td>
            <td style={{ padding: '8px 8px', textAlign: 'center', fontSize: 11, color: '#5A7290' }}>{item.targetDate ? item.targetDate.slice(0, 10) : '—'}</td>
            <td style={{ padding: '8px 4px', textAlign: 'center' }}><span style={statusIconStyle(item.locked)} title="Locked">🔒</span></td>
            <td style={{ padding: '8px 4px', textAlign: 'center' }}><span style={statusIconStyle(item.hidden)} title="Hidden">🚫</span></td>
            <td style={{ padding: '8px 4px', textAlign: 'center' }}><span style={statusIconStyle(item.excludedFromGrade)} title="Excluded from grade">📄</span></td>
            <td style={{ padding: '8px 8px', textAlign: 'center', fontSize: 12, color: '#1A365E' }}>{attempts || '—'}</td>
            <td style={{ padding: '8px 8px', textAlign: 'center', fontSize: 12, color: '#1A365E' }}>{timeMins ? fmtTime(timeMins) : '—'}</td>
            <td style={{ padding: '8px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: scoreCol }}>{compositeScore !== null ? `${compositeScore}%` : '—'}</td>
            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
              {hasResult ? (
                <button onClick={() => setCurriculumExpanded(prev => ({ ...prev, [reviewKey]: !prev[reviewKey] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5A7290', fontFamily: 'inherit' }} title="Review">🔍</button>
              ) : <span style={{ color: '#D8E1EC' }}>—</span>}
            </td>
          </tr>
          {reviewOpen && hasResult && (
            <tr style={{ borderBottom: '1px solid #F0F4FA', background: '#FAFBFF' }}>
              <td colSpan={9} style={{ padding: '8px 10px 10px', paddingLeft: 12 + depth * 26 + 24 }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#3D5475' }}>
                  <span>Status: <strong>{prog?.status}</strong></span>
                  {prog?.masteryScore != null && <span>Mastery Score: <strong>{prog.masteryScore}%</strong>{prog.masteryPassed !== undefined && <> ({isActiveBool(prog.masteryPassed) ? 'Passed' : 'Not Passed'})</>}</span>}
                  {prog?.assignScore != null && <span>Assignment Score: <strong>{prog.assignScore}%</strong>{prog.assignStatus ? ` (${prog.assignStatus})` : ''}</span>}
                </div>
              </td>
            </tr>
          )}
        </Fragment>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={() => navTab('students')} style={{ alignSelf: 'flex-start', padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Manage Students</button>
        {renderNav()}

        <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1A365E' }}>{student.fullName}</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Grade {student.grade || '—'} · {course.title}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#7A92B0' }}>
            <div>Start Date: <strong style={{ color: '#1A365E' }}>{enrol?.paceStartDate || '—'}</strong></div>
            <div>End Date: <strong style={{ color: '#1A365E' }}>{enrol?.dueDate || '—'}</strong></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { l: 'Pacing Status', v: stat.paceLabel, c: stat.paceColor },
            { l: 'On-Target Grade', v: (stat.bucket === 'active' && enrol?.assignedAt && enrol?.dueDate) ? `${stat.onTargetGrade}%` : '—', c: '#1A365E' },
            { l: 'Current Grade', v: stat.avgMastery !== null ? `${stat.avgMastery}%` : '—', c: stat.avgMastery !== null && stat.avgMastery >= passMark ? '#059669' : '#1A365E' },
            { l: 'Course Grade', v: stat.courseGrade !== null ? `${stat.courseGrade}%` : '—', c: stat.courseGrade !== null && stat.courseGrade >= passMark ? '#059669' : '#1A365E' },
            { l: 'Activities Completed', v: `${stat.compLessons}/${stat.totalLessons} (${stat.totalLessons ? Math.round(stat.compLessons / stat.totalLessons * 100) : 0}%)`, c: '#1A365E' },
            { l: 'Time on Task', v: fmtTime(stat.timeMins), c: '#1A365E' },
          ].map(k => (
            <div key={k.l} style={{ padding: '10px 14px', background: '#F7F9FC', borderRadius: 10, minWidth: 120, border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 9, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStudentSectionTab('curriculum')}
              style={{ padding: '9px 18px', borderRadius: 10, border: studentSectionTab === 'curriculum' ? 'none' : '1.5px solid #E4EAF2', background: studentSectionTab === 'curriculum' ? '#1A365E' : '#fff', color: studentSectionTab === 'curriculum' ? '#fff' : '#5A7290', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '.5px', fontFamily: 'inherit' }}>Curriculum Details</button>
            <button onClick={() => setStudentSectionTab('weekly')}
              style={{ padding: '9px 18px', borderRadius: 10, border: studentSectionTab === 'weekly' ? 'none' : '1.5px solid #E4EAF2', background: studentSectionTab === 'weekly' ? '#1A365E' : '#fff', color: studentSectionTab === 'weekly' ? '#fff' : '#5A7290', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '.5px', fontFamily: 'inherit' }}>Weekly Progress</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStudentNotesTarget({ sid, cid, studentName: student.fullName, courseTitle: course.title })}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📝 Add Notes</button>
            <button onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🖨 Print</button>
          </div>
        </div>

        {studentSectionTab === 'weekly' ? (
          <div style={{ ...card, padding: 30, textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Weekly Progress isn't available yet</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 4, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              Activity completion isn't currently tracked with a per-week timestamp, so a week-by-week breakdown can't be shown yet. Curriculum Details below reflects this student's current results.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={expandAll} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>EXPAND ALL</button>
              <span style={{ color: '#D8E1EC' }}>|</span>
              <button onClick={collapseAll} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>COLLAPSE ALL</button>
            </div>
            <div style={{ border: '1px solid #E4EAF2', borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4EAF2', background: '#F7F9FC' }}>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: 'left' }} />
                    <th rowSpan={2} style={thStyle}>Target Date</th>
                    <th colSpan={3} style={{ ...thStyle, borderBottom: '1px solid #E4EAF2' }}>Statuses</th>
                    <th colSpan={4} style={{ ...thStyle, borderBottom: '1px solid #E4EAF2' }}>Results</th>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #E4EAF2', background: '#F7F9FC' }}>
                    <th style={thStyle} title="Locked until prerequisite met">🔒</th>
                    <th style={thStyle} title="Hidden from students">🚫</th>
                    <th style={thStyle} title="Excluded from grade">📄</th>
                    <th style={thStyle}>Attempts</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Review</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#fff', borderBottom: '1px solid #E4EAF2' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>📘</span>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#1A365E' }}>{course.title}</span>
                      </div>
                    </td>
                    <td colSpan={8} />
                  </tr>
                  {!content.length ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No curriculum content in this section yet.</td></tr>
                  ) : (
                    <>
                      {topLevel.map(item => renderResultRow(item, 0))}
                      {units.map(u => (
                        <Fragment key={u.title}>
                          <tr style={{ background: '#FAFBFF', borderBottom: '1px solid #F0F4FA' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => toggleExpanded('unit:' + u.title)} style={{ width: 18, height: 18, border: '1px solid #E4EAF2', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#5A7290', padding: 0, lineHeight: 1 }}>{isExpanded('unit:' + u.title) ? '−' : '+'}</button>
                                <span style={{ fontSize: 15 }}>📁</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>{u.title}</span>
                              </div>
                            </td>
                            <td colSpan={8} />
                          </tr>
                          {isExpanded('unit:' + u.title) && u.items.map(item => renderResultRow(item, 1))}
                        </Fragment>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── GRADEBOOK TAB ──────────────────────────────────────────────────────────
  function renderGradebook() {
    const allCourses = store.courses.filter(co => co.status === 'Published' || co.status === 'Draft')
    const subjects = [...new Set(allCourses.map(co => co.subject).filter(Boolean))]
    const courses = gbSubjectFilter ? allCourses.filter(co => co.subject === gbSubjectFilter) : allCourses
    const cid = (courses.find(co => co.id === gbCourseId) ? gbCourseId : '') || (courses[0]?.id ?? '')
    const course = courses.find(co => co.id === cid) || courses[0]
    if (!course) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>📊 Gradebook</div>
        {renderNav()}
        <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No courses yet.</div>
      </div>
    )
    const content = store.content.filter(x => x.courseId === course.id)
      .sort((a, b) => ((a.unitOrder ?? 0) - (b.unitOrder ?? 0)) || ((a.order ?? 0) - (b.order ?? 0)))
    const enrolments = store.enrolments.filter(en => en.courseId === course.id && isActiveBool(en.active))
    const enrolledIds = new Set<string>()
    enrolments.forEach(en => {
      if (en.targetType === 'student') enrolledIds.add(en.targetValue)
      else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
    })
    const enrolled = students.filter(s => enrolledIds.has(s.id)).sort((a, b) => a.lastName.localeCompare(b.lastName))
    const allProg = store.progress
    const passMark = course.passMark || 80
    const creditHours = course.creditHours || 1
    const enrol0 = enrolments[0] || {}
    const getLessonSubmissions = (studentId: string, contentId: string) =>
      allSubmissions
        .filter(r => String(r.student_id ?? '') === studentId && String(r.content_id ?? '') === contentId)
        .sort((a, b) => {
          const ad = new Date(String(a.submitted_at ?? a.created_at ?? 0)).getTime()
          const bd = new Date(String(b.submitted_at ?? b.created_at ?? 0)).getTime()
          return bd - ad
        })

    // Stats
    let ahead = 0, onP = 0, off = 0, done = 0, needsScoring = 0, atRisk = 0
    enrolled.forEach(s => {
      const sid = s.id
      const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
      const comp = myProg.filter(p => p.status === 'completed').length
      const pct = content.length ? Math.round(comp / content.length * 100) : 0
      if (pct === 100) { done++; return }
      if (enrol0.assignedAt && enrol0.dueDate) {
        const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
        const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
        const diff = pct - expPct
        if (diff >= 10) ahead++; else if (diff >= -10) onP++; else off++
      }
      content.forEach(item => {
        if (!hasAssignBool(item.hasAssignment)) return
        const p = myProg.find(pp => pp.contentId === item.id)
        if (p && p.assignStatus === 'submitted' && (p.assignScore == null || isNaN(Number(p.assignScore)))) needsScoring++
      })
      const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
      const avgM = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
      if (pct < 50 && enrol0.assignedAt && enrol0.dueDate) {
        const _n = Date.now(), _s = new Date(enrol0.assignedAt).getTime(), _e = new Date(enrol0.dueDate).getTime()
        if (_e > _s && pct < Math.min(100, Math.round((_n - _s) / (_e - _s) * 100)) - 10) atRisk++
      }
      if (avgM !== null && avgM < passMark && mastRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0) atRisk++
    })

    const unitGroups: string[] = []
    const unitMap: Record<string, LMSContent[]> = {}
    content.forEach(item => {
      const ut = item.unitTitle || 'Lessons'
      if (!unitMap[ut]) { unitMap[ut] = []; unitGroups.push(ut) }
      unitMap[ut].push(item)
    })

    const exportCSV = () => {
      const hdr = ['Student', 'Grade', 'Cohort', 'Completion %', 'Avg Mastery %', 'Avg Assignment %', 'Composite %', 'Time (mins)', 'Credits', 'At Risk', ...content.map(c => c.title + ' (Composite)')]
      const rows = enrolled.map(s => {
        const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === s.id)
        const comp = myProg.filter(p => p.status === 'completed').length
        const pctV = content.length ? Math.round(comp / content.length * 100) : 0
        const mRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
        const aRows = myProg.filter(p => p.assignScore != null && !isNaN(Number(p.assignScore)))
        const avgM = mRows.length ? Math.round(mRows.reduce((acc, p) => acc + Number(p.masteryScore), 0) / mRows.length) : null
        const avgA = aRows.length ? Math.round(aRows.reduce((acc, p) => acc + Number(p.assignScore), 0) / aRows.length) : null
        const compV = lmsCourseComposite(myProg, content, passMark)
        const timeMins = Math.round(myProg.reduce((acc, p) => acc + (p.timeSpentMins || 0), 0))
        const cred = (pctV >= 100 && (avgM === null || avgM >= passMark)) ? creditHours : 0
        let atRisk = 'No'
        if (pctV < 50 && enrol0.assignedAt && enrol0.dueDate) {
          const _n = Date.now(), _s = new Date(enrol0.assignedAt).getTime(), _e = new Date(enrol0.dueDate).getTime()
          if (_e > _s && pctV < Math.min(100, Math.round((_n - _s) / (_e - _s) * 100)) - 10) atRisk = 'Yes'
        }
        if (avgM !== null && avgM < passMark && mRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0) atRisk = 'Yes'
        const lessonCells = content.map(item => { const p = myProg.find(pp => pp.contentId === item.id); const cs = p ? lmsCompositeScore(p, item, passMark) : null; return cs !== null ? cs + '%' : '' })
        return [s.lastName + ', ' + s.firstName, s.grade || '', s.cohort || '', pctV + '%', avgM !== null ? avgM + '%' : '', avgA !== null ? avgA + '%' : '', compV !== null ? compV + '%' : '', timeMins, cred, atRisk, ...lessonCells].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
      })
      const csv = [hdr.map(v => '"' + v.replace(/"/g, '""') + '"').join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'Gradebook_' + (course.title || 'export').replace(/[^a-z0-9]/gi, '_') + '_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); URL.revokeObjectURL(url)
    }

    const openScoreModal = (studentId: string, studentName: string, contentId: string, lessonTitle: string) => {
      const lessonItem = store.content.find(x => x.id === contentId)
      setScoreModal({
        studentId, studentName, contentId, courseId: course.id, lessonTitle,
        caseStudyUrl: lessonItem?.caseStudyUrl,
      })
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>📊 Gradebook</div>
            {course && <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{course.title} · {course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''} · Pass: {course.passMark || 80}%</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {subjects.length > 1 && (
              <select value={gbSubjectFilter} onChange={e => { setGbSubjectFilter(e.target.value); setGbCourseId('') }} style={iStyle}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {courses.length > 1 && (
              <select value={cid} onChange={e => setGbCourseId(e.target.value)} style={iStyle}>
                {courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
              </select>
            )}
            <button onClick={() => navTab('section')} style={{ padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📋 Section View</button>
            <button onClick={exportCSV} style={{ padding: '7px 14px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Export CSV</button>
          </div>
        </div>
        {renderNav()}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ icon: '👥', label: 'All', val: enrolled.length, col: '#1A365E', bg: '#EEF3FF' }, { icon: '✅', label: 'Done', val: done, col: '#059669', bg: '#DCFCE7' }, { icon: '🏃', label: 'Ahead', val: ahead, col: '#059669', bg: '#D1FAE5' }, { icon: '🚶', label: 'On Pace', val: onP, col: '#D97706', bg: '#FEF3C7' }, { icon: '⚠️', label: 'Behind', val: off, col: '#D61F31', bg: '#FEE2E2' }, { icon: '📋', label: 'To Score', val: needsScoring, col: '#7C3AED', bg: '#EDE9FE' }, { icon: '🚨', label: 'At Risk', val: atRisk, col: '#D61F31', bg: '#FFF0F0' }].map(st => (
            <div key={st.label} style={{ padding: '10px 14px', background: st.bg, borderRadius: 10, textAlign: 'center', minWidth: 76 }}>
              <div style={{ fontSize: 16 }}>{st.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: st.col }}>{st.val}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: st.col, textTransform: 'uppercase' }}>{st.label}</div>
            </div>
          ))}
        </div>
        {(!content.length || !enrolled.length) ? (
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>{!content.length ? 'No lessons yet.' : 'No students enrolled.'}</div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #E4EAF2', borderRadius: 13, background: '#fff', boxShadow: '0 2px 8px rgba(26,54,94,.06)' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F0F4FA' }}>
                  {[{ l: 'Student', w: '200px' }, { l: 'On-Target', w: '80px' }, { l: 'Mastery Grade', w: '90px' }, { l: 'Assign Grade', w: '90px' }, { l: '⭐ Composite', w: '90px' }, { l: 'Course %', w: '80px' }, { l: 'Time', w: '76px' }, { l: 'Credits', w: '66px' }].map((fh, i) => (
                    <th key={fh.l} rowSpan={2} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: `8px ${i === 0 ? '14' : '8'}px`, textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 800, color: '#1A365E', borderBottom: '2px solid #E4EAF2', borderRight: i === 7 ? '2px solid #D0D7E4' : '1px solid #E4EAF2', whiteSpace: 'nowrap', minWidth: fh.w }}>{fh.l}</th>
                  ))}
                  {unitGroups.map(ut => (
                    <th key={ut} colSpan={unitMap[ut].length} style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#1A365E', borderBottom: '1px solid #E4EAF2', borderLeft: '2px solid #D0D7E4', background: '#F7F9FC', whiteSpace: 'nowrap' }}>📂 {ut.substring(0, 28)}{ut.length > 28 ? '…' : ''}</th>
                  ))}
                </tr>
                <tr style={{ background: '#F7F9FC' }}>
                  {content.map((item, ci) => {
                    const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #E4EAF2'
                    return (
                      <th key={item.id} style={{ padding: '4px 3px', textAlign: 'center', borderBottom: '2px solid #E4EAF2', borderLeft: borderL, width: 56, verticalAlign: 'bottom' }}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9.5, fontWeight: 600, color: '#3D5475', maxHeight: 100, overflow: 'hidden', padding: '3px 1px', lineHeight: 1.3 }} title={item.title}>{item.title.substring(0, 35)}</div>
                        <div style={{ fontSize: 11, marginTop: 3 }}>{TYPE_ICONS[item.type] || '📄'}</div>
                        {hasMasteryBool(item.hasMastery) && <div style={{ fontSize: 8, color: '#059669', fontWeight: 800 }}>🎯</div>}
                        {hasAssignBool(item.hasAssignment) && <div style={{ fontSize: 8, color: '#1A365E', fontWeight: 800 }}>📋</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {enrolled.map((s, rowIdx) => {
                  const sid = s.id
                  const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
                  const comp = myProg.filter(p => p.status === 'completed').length
                  const pct = content.length ? Math.round(comp / content.length * 100) : 0
                  const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
                  const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
                  const assignRows = myProg.filter(p => p.assignScore != null && !isNaN(Number(p.assignScore)))
                  const avgAssign = assignRows.length ? Math.round(assignRows.reduce((s, p) => s + Number(p.assignScore), 0) / assignRows.length) : null
                  const composite = lmsCourseComposite(myProg, content, passMark)
                  const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
                  const credEarned = pct >= 100 && (avgMastery === null || avgMastery >= passMark) ? creditHours : 0
                  let paceLabel = '—'; let paceCol = '#94A3B8'
                  if (pct === 100) { paceLabel = '✅ Done'; paceCol = '#059669' }
                  else if (enrol0.assignedAt && enrol0.dueDate) {
                    const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
                    const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
                    const diff = pct - expPct
                    if (diff >= 10) { paceLabel = '🏃 Ahead'; paceCol = '#059669' } else if (diff >= -10) { paceLabel = '🚶 On Pace'; paceCol = '#D97706' } else { paceLabel = '⚠️ Behind'; paceCol = '#D61F31' }
                  }
                  const _atRisk = pct < 50 && enrol0.assignedAt && enrol0.dueDate
                    ? (() => { const _n = Date.now(), _s0 = new Date(enrol0.assignedAt).getTime(), _e0 = new Date(enrol0.dueDate).getTime(); return _e0 > _s0 && pct < Math.min(100, Math.round((_n - _s0) / (_e0 - _s0) * 100)) - 10 })()
                    : (avgMastery !== null && avgMastery < passMark && mastRows.filter(p => (p.masteryAttempts || 0) > 1).length > 0)
                  const rowBg = rowIdx % 2 === 0 ? '#fff' : '#FAFBFF'
                  const mCol = avgMastery !== null ? (avgMastery >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const aCol = avgAssign !== null ? (avgAssign >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const ccCol = composite !== null ? (composite >= passMark ? '#059669' : '#D61F31') : '#94A3B8'
                  const crsCol = pct >= passMark ? '#059669' : pct > 0 ? '#D97706' : '#94A3B8'
                  const sticky: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: rowBg }
                  return (
                    <tr key={sid} style={{ background: rowBg }}>
                      <td style={{ ...sticky, padding: '9px 14px', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{(s.firstName[0] || '?')}{(s.lastName[0] || '?')}</div>
                          <div>
                            <div onClick={() => navigate(`/lms/student?sid=${s.id}&cid=${cid}`)} style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', cursor: 'pointer', textDecoration: 'underline' }}>{s.lastName}, {s.firstName}</div>
                            <div style={{ fontSize: 9, color: '#7A92B0' }}>{s.grade}{s.cohort ? ' · ' + s.cohort : ''}</div>
                            {_atRisk && <div style={{ marginTop: 3 }}><span style={{ fontSize: 9, fontWeight: 800, color: '#D61F31', background: '#FEE2E2', padding: '2px 7px', borderRadius: 4 }}>⚠️ At Risk</span></div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', fontSize: 10, fontWeight: 700, color: paceCol }}>{paceLabel}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>{avgMastery !== null ? <><div style={{ fontSize: 13, fontWeight: 900, color: mCol }}>{avgMastery}%</div><div style={{ fontSize: 9, fontWeight: 700, color: mCol }}>{gradeLabel(avgMastery)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>{avgAssign !== null ? <><div style={{ fontSize: 13, fontWeight: 900, color: aCol }}>{avgAssign}%</div><div style={{ fontSize: 9, fontWeight: 700, color: aCol }}>{gradeLabel(avgAssign)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, background: composite !== null ? (composite >= passMark ? '#F0FDF4' : '#FFF9F9') : rowBg, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '2px solid #D0D7E4' }}>{composite !== null ? <><div style={{ fontSize: 14, fontWeight: 900, color: ccCol }}>{composite}%</div><div style={{ fontSize: 9, fontWeight: 800, color: ccCol }}>{gradeLabel(composite)}</div></> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: crsCol }}>{pct}%</div>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 44, marginInline: 'auto' }}><div style={{ height: '100%', width: pct + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '1px solid #E4EAF2', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{fmtTime(timeMins)}</td>
                      <td style={{ ...sticky, padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderRight: '2px solid #D0D7E4', fontSize: 14, fontWeight: 900, color: credEarned > 0 ? '#059669' : '#94A3B8' }}>{credEarned}</td>
                      {content.map((item, ci) => {
                        const prog = myProg.find(p => p.contentId === item.id)
                        const status = prog?.status || 'not_started'
                        const lessonSubs = getLessonSubmissions(sid, item.id)
                        const hasSubmission = lessonSubs.length > 0
                        const effectiveStatus = status !== 'not_started' ? status : (hasSubmission ? 'completed' : 'not_started')
                        const hm = hasMasteryBool(item.hasMastery)
                        const ha = hasAssignBool(item.hasAssignment)
                        const ms = prog && prog.masteryScore != null && !isNaN(Number(prog.masteryScore)) ? Number(prog.masteryScore) : null
                        const as_ = prog && prog.assignScore != null && !isNaN(Number(prog.assignScore)) ? Number(prog.assignScore) : null
                        const cs = lmsCompositeScore(prog, item, passMark)
                        const assignSt = prog?.assignStatus || ''
                        const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #F0F4FA'
                        const canOpenScore = ha && (effectiveStatus !== 'not_started' || hasSubmission)
                        return (
                          <td key={item.id} onClick={canOpenScore ? (e) => { e.stopPropagation(); openScoreModal(sid, `${s.lastName}, ${s.firstName}`, item.id, item.title) } : undefined} style={{ padding: '5px 3px', textAlign: 'center', borderBottom: '1px solid #F0F4FA', borderLeft: borderL, width: 56, cursor: canOpenScore ? 'pointer' : 'default' }} title={ha ? 'Click to score assignment' : ''}>
                            {effectiveStatus === 'not_started' ? <span style={{ color: '#D0D7E4', fontSize: 13 }}>—</span>
                              : effectiveStatus === 'in_progress' ? <div style={{ background: '#FEF3C7', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#D97706' }}>⏳</div></div>
                              : ha && cs !== null ? (
                                <div style={{ background: cs >= passMark ? '#DCFCE7' : '#FEE2E2', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}>
                                  <div style={{ fontSize: 11, fontWeight: 900, color: cs >= passMark ? '#059669' : '#D61F31' }}>{cs}</div>
                                  {ms !== null && <div style={{ fontSize: 8, color: cs >= passMark ? '#059669' : '#D61F31', opacity: .8 }}>M:{ms}</div>}
                                  {as_ !== null ? <div style={{ fontSize: 8, color: cs >= passMark ? '#059669' : '#D61F31', opacity: .8 }}>A:{as_}</div>
                                    : assignSt === 'submitted' ? <div style={{ fontSize: 8, fontWeight: 700, color: '#7C3AED' }}>📋⏳</div>
                                    : <div style={{ fontSize: 8, color: '#94A3B8' }}>📋+</div>}
                                </div>
                              ) : hm && ms !== null ? (
                                <div style={{ background: prog?.masteryPassed === true || prog?.masteryPassed === 'TRUE' ? '#DCFCE7' : '#FEE2E2', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}>
                                  <div style={{ fontSize: 12, fontWeight: 900, color: prog?.masteryPassed === true || prog?.masteryPassed === 'TRUE' ? '#059669' : '#D61F31' }}>{ms}</div>
                                  {ha && <div style={{ fontSize: 8, fontWeight: 700, color: assignSt === 'submitted' ? '#7C3AED' : '#94A3B8' }}>{assignSt === 'submitted' ? '📋⏳' : '📋+'}</div>}
                                </div>
                              ) : hasSubmission
                                  ? <div style={{ background: '#EDE9FE', borderRadius: 5, padding: '3px 4px', display: 'inline-block' }}><div style={{ fontSize: 8, fontWeight: 700, color: '#7C3AED' }}>📋⏳</div></div>
                                  : <div style={{ background: '#DCFCE7', borderRadius: 5, padding: '4px 5px', display: 'inline-block' }}><div style={{ fontSize: 13, color: '#059669' }}>✓</div></div>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F0F4FA' }}>
                  <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '8px 14px', fontSize: 10, fontWeight: 800, color: '#1A365E', borderTop: '2px solid #E4EAF2' }}>CLASS AVERAGES</td>
                  {(() => {
                    let totM = 0, cntM = 0, totA = 0, cntA = 0, totC = 0, cntC = 0
                    enrolled.forEach(s => {
                      const sid = s.id
                      const mr = allProg.filter(p => p.courseId === course.id && p.studentId === sid && p.masteryScore != null && !isNaN(Number(p.masteryScore)))
                      if (mr.length) { totM += Math.round(mr.reduce((s, p) => s + Number(p.masteryScore), 0) / mr.length); cntM++ }
                      const ar = allProg.filter(p => p.courseId === course.id && p.studentId === sid && p.assignScore != null && !isNaN(Number(p.assignScore)))
                      if (ar.length) { totA += Math.round(ar.reduce((s, p) => s + Number(p.assignScore), 0) / ar.length); cntA++ }
                      const myP = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
                      const cv = lmsCourseComposite(myP, content, passMark)
                      if (cv !== null) { totC += cv; cntC++ }
                    })
                    const avgComp = cntC ? Math.round(totC / cntC) : null
                    return <>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 12, fontWeight: 900, color: '#1A365E' }}>{cntM ? Math.round(totM / cntM) + '%' : '—'}</td>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 12, fontWeight: 900, color: '#1A365E' }}>{cntA ? Math.round(totA / cntA) + '%' : '—'}</td>
                      <td style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', padding: '7px 8px', textAlign: 'center', borderTop: '2px solid #E4EAF2', fontSize: 13, fontWeight: 900, color: avgComp !== null && avgComp >= passMark ? '#059669' : '#94A3B8' }}>{avgComp !== null ? avgComp + '%' : '—'}</td>
                      <td colSpan={3} style={{ position: 'sticky', left: 0, zIndex: 3, background: '#F0F4FA', borderTop: '2px solid #E4EAF2' }} />
                    </>
                  })()}
                  {content.map((item, ci) => {
                    const lessonProgs = allProg.filter(p => p.courseId === course.id && p.contentId === item.id)
                    const csArr = lessonProgs.map(p => lmsCompositeScore(p, item, passMark)).filter(v => v !== null) as number[]
                    const avgCS = csArr.length ? Math.round(csArr.reduce((s, v) => s + v, 0) / csArr.length) : null
                    const borderL = ci > 0 && content[ci - 1]?.unitTitle !== item.unitTitle ? '2px solid #D0D7E4' : '1px solid #E4EAF2'
                    return <td key={item.id} style={{ padding: '7px 3px', textAlign: 'center', borderTop: '2px solid #E4EAF2', borderLeft: borderL, fontSize: 11, fontWeight: 900, color: avgCS !== null ? (avgCS >= passMark ? '#059669' : '#D61F31') : '#94A3B8' }}>{avgCS !== null ? avgCS + '%' : '—'}</td>
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: '#F7F9FC', borderRadius: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#7A92B0', alignSelf: 'center' }}>LEGEND:</span>
          {[{ bg: '#DCFCE7', col: '#059669', l: `Pass (≥${passMark}%)` }, { bg: '#FEE2E2', col: '#D61F31', l: `Fail (<${passMark}%)` }, { bg: '#FEF3C7', col: '#D97706', l: 'In Progress' }, { bg: '#F0F4FA', col: '#94A3B8', l: 'Not Started' }].map(lg => (
            <div key={lg.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: lg.bg }} />
              <span style={{ fontSize: 10, color: '#3D5475' }}>{lg.l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10 }}>🎯 Mastery</span>
            <span style={{ fontSize: 10 }}>📋 Assignment</span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>⭐ = Composite</span>
          </div>
          <div style={{ fontSize: 10, color: '#7A92B0' }}>Click any assignment cell to score</div>
        </div>

        {/* Course Discussion Board */}
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>💬 Course Discussion Board <span style={{ fontSize: 10, color: '#7A92B0', fontWeight: 400 }}>{course.title}</span></div>
          <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Share your thoughts or ask a question</div>
            <textarea rows={3} placeholder="What's on your mind about this course?" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Peer reviews and questions welcome 👋</span>
              <button style={{ padding: '7px 18px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🚀 Post</button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 10, color: '#94A3B8', fontSize: 12 }}>No posts yet. Start the discussion! 🎯</div>
        </div>
      </div>
    )
  }

  // ─── STUDENT DETAIL TAB ────────────────────────────────────────────────────
  function renderStudentDetail() {
    const sid = studentDetailSid
    if (!sid) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>👤 Student Detail</div>
          {renderNav()}
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>
            No student selected.
          </div>
        </div>
      )
    }

    const student = students.find(s => s.id === sid)
    const studentProgress = store.progress.filter(p => p.studentId === sid)
    const pickedCourse = store.courses.find(c => c.id === studentDetailCid)
    const fallbackCourse = store.courses.find(c => studentProgress.some(p => p.courseId === c.id))
    const course = pickedCourse || fallbackCourse || store.courses[0]
    const passMark = course?.passMark || 80
    const courseContent = course
      ? store.content
        .filter(x => x.courseId === course.id)
        .sort((a, b) => ((a.unitOrder ?? 0) - (b.unitOrder ?? 0)) || ((a.order ?? 0) - (b.order ?? 0)))
      : []
    const myProg = course ? studentProgress.filter(p => p.courseId === course.id) : studentProgress
    const hasSubmissionForContent = (contentId: string) =>
      studentSubmissions.some(r => String(r.content_id ?? '') === contentId)
    const completed = courseContent.length
      ? courseContent.filter((item) => {
        const p = myProg.find(x => x.contentId === item.id)
        if (p?.status === 'completed') return true
        // Fallback: if a lesson submission exists but progress wasn't updated, treat as completed for detail view.
        return !p && hasSubmissionForContent(item.id)
      }).length
      : 0
    const pct = courseContent.length ? Math.round((completed / courseContent.length) * 100) : 0
    const masteryRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
    const assignmentRows = myProg.filter(p => p.assignScore != null && !isNaN(Number(p.assignScore)))
    const avgMastery = masteryRows.length ? Math.round(masteryRows.reduce((sum, p) => sum + Number(p.masteryScore), 0) / masteryRows.length) : null
    const avgAssign = assignmentRows.length ? Math.round(assignmentRows.reduce((sum, p) => sum + Number(p.assignScore), 0) / assignmentRows.length) : null
    const composite = course ? lmsCourseComposite(myProg, courseContent, passMark) : null
    const timeMins = Math.round(myProg.reduce((sum, p) => sum + (p.timeSpentMins || 0), 0))

    const subsSorted = [...studentSubmissions].sort((a, b) => {
      const ad = new Date(String(a.submitted_at ?? a.created_at ?? 0)).getTime()
      const bd = new Date(String(b.submitted_at ?? b.created_at ?? 0)).getTime()
      return bd - ad
    })

    const parseNoteMeta = (noteVal: unknown): Record<string, unknown> | null => {
      if (typeof noteVal !== 'string') return null
      const t = noteVal.trim()
      if (!t.startsWith('{') && !t.startsWith('[')) return null
      try {
        const parsed = JSON.parse(t)
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
      } catch {
        return null
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>👤 Student Detail</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
              {(student?.fullName || sid)}{student?.grade ? ` · ${student.grade}` : ''}{student?.cohort ? ` · ${student.cohort}` : ''}{course ? ` · ${course.title}` : ''}
            </div>
          </div>
          <button
            onClick={() => navigate('/lms/gradebook')}
            style={{ padding: '7px 14px', background: '#F0F4FA', color: '#1A365E', border: '1px solid #E4EAF2', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Back to Gradebook
          </button>
        </div>
        {renderNav()}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[{ l: 'Completion', v: `${pct}%`, c: pct >= passMark ? '#059669' : '#D97706', bg: '#F7F9FC' }, { l: 'Mastery Avg', v: avgMastery !== null ? `${avgMastery}%` : '—', c: avgMastery !== null && avgMastery >= passMark ? '#059669' : '#1A365E', bg: '#F7F9FC' }, { l: 'Assign Avg', v: avgAssign !== null ? `${avgAssign}%` : '—', c: avgAssign !== null && avgAssign >= passMark ? '#059669' : '#1A365E', bg: '#F7F9FC' }, { l: 'Composite', v: composite !== null ? `${composite}%` : '—', c: composite !== null && composite >= passMark ? '#059669' : '#1A365E', bg: '#F7F9FC' }, { l: 'Time on Task', v: fmtTime(timeMins), c: '#1A365E', bg: '#F7F9FC' }].map(k => (
            <div key={k.l} style={{ padding: '10px 14px', background: k.bg, borderRadius: 10, minWidth: 110, border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 9, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {!courseContent.length ? (
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', color: '#94A3B8' }}>
            No lessons found for this student/course.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {studentSubmissionsLoading && (
              <div style={{ fontSize: 11, color: '#7A92B0' }}>Loading lesson submissions…</div>
            )}
            {courseContent.map((item, idx) => {
              const prog = myProg.find(p => p.contentId === item.id)
              const lessonSubs = subsSorted.filter(r => String(r.content_id ?? '') === item.id)
              const lessonSubsWithMeta = lessonSubs.map(row => ({ row, meta: parseNoteMeta(row.note) }))
              const masterySub = lessonSubsWithMeta.find(x => x.meta && x.meta.kind === 'mastery_quiz')
              const assignmentSub = lessonSubsWithMeta.find(x => !x.meta || x.meta.kind !== 'mastery_quiz')
              const masteryMeta = masterySub?.meta
              const masteryQuestions = Array.isArray(masteryMeta?.questions) ? (masteryMeta?.questions as Array<Record<string, unknown>>) : []
              const hasAnySubmission = lessonSubs.length > 0
              const status = prog?.status ?? (hasAnySubmission ? 'completed' : 'not_started')
              const mScore = prog?.masteryScore != null && !isNaN(Number(prog.masteryScore)) ? Number(prog.masteryScore) : null
              const aScore = prog?.assignScore != null && !isNaN(Number(prog.assignScore)) ? Number(prog.assignScore) : null
              const compositeScore = lmsCompositeScore(prog, item, passMark)
              return (
                <div key={item.id} style={{ ...card, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>{idx + 1}. {item.title}</div>
                      <div style={{ fontSize: 10, color: '#7A92B0' }}>{item.unitTitle || 'Lesson'} · {TYPE_ICONS[item.type] || '📄'} {item.type}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#3D5475', background: '#F0F4FA', borderRadius: 6, padding: '4px 8px' }}>Status: {status}</span>
                      {mScore !== null && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#DCFCE7', borderRadius: 6, padding: '4px 8px' }}>Mastery: {mScore}%</span>}
                      {aScore !== null && <span style={{ fontSize: 10, fontWeight: 700, color: '#1A365E', background: '#EEF3FF', borderRadius: 6, padding: '4px 8px' }}>Assignment: {aScore}%</span>}
                      {compositeScore !== null && <span style={{ fontSize: 10, fontWeight: 700, color: compositeScore >= passMark ? '#059669' : '#D61F31', background: compositeScore >= passMark ? '#DCFCE7' : '#FEE2E2', borderRadius: 6, padding: '4px 8px' }}>Composite: {compositeScore}%</span>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 8, padding: '9px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', marginBottom: 5 }}>📋 Lesson Submission</div>
                      {assignmentSub ? (
                        <>
                          {typeof assignmentSub.row.note === 'string' && assignmentSub.row.note.trim() && (
                            <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap', marginBottom: 4 }}>{String(assignmentSub.row.note)}</div>
                          )}
                          {assignmentSub.row.link_url && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <a href={String(assignmentSub.row.link_url)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, wordBreak: 'break-all' }}>
                                🔗 View submission
                              </a>
                              <button onClick={() => void downloadUrl(String(assignmentSub.row.link_url))} style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>⬇ Download</button>
                            </div>
                          )}
                          {!assignmentSub.row.note && !assignmentSub.row.link_url && (
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>Submission record exists, but no note/link was provided.</div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>No assignment submission yet for this lesson.</div>
                      )}
                    </div>

                    <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 8, padding: '9px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#1A365E', marginBottom: 5 }}>📝 Student Actual Answers</div>
                      {masteryMeta ? (
                        <>
                          <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 6 }}>
                            Attempt {Number(masteryMeta.attempt ?? 0) || 1} · Score {Number(masteryMeta.score ?? 0)}% · {masteryMeta.passed ? 'Passed' : 'Not Passed'}
                          </div>
                          {masteryQuestions.length ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {masteryQuestions.map((q, qi) => {
                                const opts = Array.isArray(q.opts) ? (q.opts as string[]) : []
                                const studentAnswer = q.studentAnswer
                                const correctIdx = typeof q.ans === 'number' ? Number(q.ans) : null
                                const isShort = String(q.type ?? '').toLowerCase() === 'short' || !opts.length
                                const selectedIdx = typeof studentAnswer === 'number' ? studentAnswer : (typeof studentAnswer === 'string' && studentAnswer !== '' && !isNaN(Number(studentAnswer)) ? Number(studentAnswer) : null)
                                const answerText = isShort
                                  ? (studentAnswer != null && String(studentAnswer).trim() ? String(studentAnswer) : 'No answer')
                                  : (selectedIdx != null && opts[selectedIdx] ? `${String.fromCharCode(65 + selectedIdx)}. ${opts[selectedIdx]}` : 'No answer')
                                const correctText = !isShort && correctIdx != null && opts[correctIdx]
                                  ? `${String.fromCharCode(65 + correctIdx)}. ${opts[correctIdx]}`
                                  : null
                                return (
                                  <div key={`${item.id}_ans_${qi}`} style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 7, padding: '8px 10px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>Q{qi + 1}. {String(q.q ?? '')}</div>
                                    <div style={{ fontSize: 11, color: '#3D5475' }}><strong>Your answer:</strong> {answerText}</div>
                                    {!isShort && correctText && <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}><strong>Correct answer:</strong> {correctText}</div>}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#94A3B8' }}>Mastery submission found, but no answer payload was stored.</div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>No mastery answer submission yet for this lesson.</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── APPEALS TAB ────────────────────────────────────────────────────────────
  function renderAppeals() {
    const openAppeals = appeals.filter(a => a.status === 'open')
    const resolvedAppeals = appeals.filter(a => a.status === 'resolved')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>🚩 Grade Appeals{openAppeals.length > 0 ? ` (${openAppeals.length} open)` : ''}</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Students appealing a Case Study score they think is a discrepancy.</div>
        </div>
        {renderNav()}
        {appealsLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Loading…</div>
        ) : appeals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No appeals filed yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...openAppeals, ...resolvedAppeals].map(a => {
              const student = students.find(s => s.id === a.studentId)
              const lesson = store.content.find(c => c.id === a.contentId)
              return (
                <AppealRowCard
                  key={a.id}
                  appeal={a}
                  studentName={student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student'}
                  lessonTitle={lesson?.title ?? 'Unknown Lesson'}
                  onResolved={(reply) => setAppeals(prev => prev.map(x => x.id === a.id ? { ...x, status: 'resolved', adminReply: reply } : x))}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── CURRICULUM TAB ─────────────────────────────────────────────────────────
  function renderCurriculumPage() {
    const allCourses = store.courses.filter(co => co.status === 'Published' || co.status === 'Draft')
    const cid = (allCourses.find(co => co.id === curriculumCourseId) ? curriculumCourseId : '') || (allCourses[0]?.id ?? '')
    const course = allCourses.find(co => co.id === cid)
    if (!course) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>🧩 Curriculum</div>
        {renderNav()}
        <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>No courses yet.</div>
      </div>
    )
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1A365E' }}>🧩 Curriculum</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>{course.title} · {course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''}</div>
          </div>
          {allCourses.length > 1 && (
            <select value={cid} onChange={e => setCurriculumCourseId(e.target.value)} style={iStyle}>
              {allCourses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
            </select>
          )}
        </div>
        {renderNav()}
        {renderCurriculum(course)}
      </div>
    )
  }

  // ─── CURRICULUM OUTLINE (used by the Curriculum tab) ────────────────────────
  function renderCurriculum(course: LMSCourse) {
    const content = store.content.filter(x => x.courseId === course.id)
    const topLevel = content.filter(x => !x.unitTitle).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const unitTitles = [...new Set(content.filter(x => x.unitTitle).map(x => x.unitTitle as string))]
    const units = unitTitles.map(t => {
      const items = content.filter(x => x.unitTitle === t).sort((a, b) => (a.moduleOrder ?? 0) - (b.moduleOrder ?? 0) || (a.order ?? 0) - (b.order ?? 0))
      return { title: t, unitOrder: items[0]?.unitOrder ?? 0, items }
    }).sort((a, b) => a.unitOrder - b.unitOrder)

    function isExpanded(key: string) { return curriculumExpanded[key] !== false }
    function toggleExpanded(key: string) { setCurriculumExpanded(prev => ({ ...prev, [key]: !isExpanded(key) })) }
    function expandAll() {
      const next: Record<string, boolean> = {}
      units.forEach(u => {
        next['unit:' + u.title] = true
        u.items.forEach(it => { if (hasMasteryBool(it.hasMastery) || hasAssignBool(it.hasAssignment)) next['topic:' + it.id] = true })
      })
      topLevel.forEach(it => { if (hasMasteryBool(it.hasMastery) || hasAssignBool(it.hasAssignment)) next['topic:' + it.id] = true })
      setCurriculumExpanded(next)
    }
    function collapseAll() {
      const next: Record<string, boolean> = {}
      units.forEach(u => {
        next['unit:' + u.title] = false
        u.items.forEach(it => { if (hasMasteryBool(it.hasMastery) || hasAssignBool(it.hasAssignment)) next['topic:' + it.id] = false })
      })
      topLevel.forEach(it => { if (hasMasteryBool(it.hasMastery) || hasAssignBool(it.hasAssignment)) next['topic:' + it.id] = false })
      setCurriculumExpanded(next)
    }

    function patchContent(id: string, patch: Partial<LMSContent>) {
      persist({ ...store, content: store.content.map(c => c.id === id ? { ...c, ...patch } : c) })
    }
    function patchCourse(patch: Partial<LMSCourse>) {
      persist({ ...store, courses: store.courses.map(c => c.id === course.id ? { ...c, ...patch } : c) })
    }
    // Move `draggedId` to the position of `targetId` within `list`, then renumber the whole list.
    function reorderContent(list: LMSContent[], draggedId: string, targetId: string, field: 'order' | 'moduleOrder') {
      const from = list.findIndex(x => x.id === draggedId)
      const to = list.findIndex(x => x.id === targetId)
      if (from < 0 || to < 0 || from === to) return
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      const orderMap = new Map(next.map((x, i) => [x.id, i]))
      persist({ ...store, content: store.content.map(c => orderMap.has(c.id) ? { ...c, [field]: orderMap.get(c.id) as number } : c) })
    }
    // Move `unitTitle` to 0-based `targetIdx` among the other modules, then renumber unitOrder
    // across every content row in each module. Shared by both drag-reordering and the manual
    // "Module Order" prompt below.
    function applyUnitOrder(unitTitle: string, targetIdx: number) {
      const moved = units.find(u => u.title === unitTitle)
      if (!moved) return
      const others = units.filter(u => u.title !== unitTitle)
      others.splice(Math.max(0, Math.min(targetIdx, others.length)), 0, moved)
      const orderMap = new Map(others.map((u, i) => [u.title, i]))
      persist({ ...store, content: store.content.map(c => c.unitTitle && orderMap.has(c.unitTitle) ? { ...c, unitOrder: orderMap.get(c.unitTitle) as number } : c) })
    }
    function reorderUnits(draggedTitle: string, targetTitle: string) {
      const targetIdx = units.findIndex(u => u.title === targetTitle)
      if (targetIdx < 0) return
      applyUnitOrder(draggedTitle, targetIdx)
    }
    function setModuleOrder(unitTitle: string) {
      const currentPos = units.findIndex(u => u.title === unitTitle) + 1
      setPromptDialog({
        title: 'Module Order',
        label: 'Position in list (1 = first)',
        defaultValue: String(currentPos || units.length),
        confirmLabel: 'Save',
        onConfirm: (value) => {
          const requested = parseInt(value)
          if (Number.isFinite(requested) && requested >= 1) applyUnitOrder(unitTitle, requested - 1)
        },
      })
    }
    function handleCurriculumDrop(targetKind: 'top' | 'unit' | 'unititem', targetId: string, targetScope: string) {
      const drag = curriculumDrag
      setCurriculumDrag(null)
      setCurriculumDropTarget(null)
      if (!drag || drag.kind !== targetKind || drag.scope !== targetScope || drag.id === targetId) return
      if (targetKind === 'unit') reorderUnits(drag.id, targetId)
      else reorderContent(targetKind === 'top' ? topLevel : (units.find(u => u.title === targetScope)?.items ?? []), drag.id, targetId, targetKind === 'top' ? 'order' : 'moduleOrder')
    }
    function renameUnit(unitTitle: string) {
      setPromptDialog({
        title: 'Rename Module',
        label: 'Module title',
        defaultValue: unitTitle,
        confirmLabel: 'Rename',
        onConfirm: (next) => {
          if (next === unitTitle) return
          persist({ ...store, content: store.content.map(c => c.unitTitle === unitTitle ? { ...c, unitTitle: next } : c) })
        },
      })
    }
    function deleteUnit(unitTitle: string, items: LMSContent[]) {
      setConfirmDialog({
        title: 'Delete Module',
        message: `Delete module "${unitTitle}" and its ${items.length} item(s)? This cannot be undone.`,
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await Promise.all(items.map(it => deleteLMSContent(it.id)))
          setStore(prev => ({ ...prev, content: prev.content.filter(c => c.unitTitle !== unitTitle) }))
        },
      })
    }
    function deleteItem(item: LMSContent) {
      setConfirmDialog({
        title: 'Delete Item',
        message: `Delete "${item.title}"? This cannot be undone.`,
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await deleteLMSContent(item.id)
          setStore(prev => ({ ...prev, content: prev.content.filter(c => c.id !== item.id) }))
        },
      })
      setCurriculumMenuOpenId(null)
    }
    function openAddItem(unitTitle: string | null) {
      setActiveCourseId(course.id)
      setPrefillUnit(unitTitle)
      setEditLessonIdx(null)
      setShowLessonModal(true)
    }
    function openAddUnit() {
      setPromptDialog({
        title: 'New Module',
        label: 'Module title',
        placeholder: 'e.g. Module 1: Business Writing Fundamentals & Persuasive Memos',
        confirmLabel: 'Continue',
        onConfirm: (ut) => openAddItem(ut),
      })
    }
    function openEdit(item: LMSContent) {
      openEditItem(item, store.content.indexOf(item), course.id)
      setCurriculumMenuOpenId(null)
    }

    const menuItemStyle: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: '#1A365E', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
    const thStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.05em', padding: '8px 10px' }
    function statusBtnStyle(active?: boolean): React.CSSProperties {
      return { width: 26, height: 26, borderRadius: 6, border: `1px solid ${active ? '#1A365E' : '#E4EAF2'}`, background: active ? '#1A365E' : '#fff', color: active ? '#fff' : '#B7C3D6', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }
    }

    function renderContentRow(item: LMSContent, depth: number, orderField: 'order' | 'moduleOrder', dragScope = '') {
      const dragKind: 'top' | 'unititem' = orderField === 'order' ? 'top' : 'unititem'
      const isDragging = curriculumDrag?.kind === dragKind && curriculumDrag.id === item.id
      const isDropTarget = curriculumDropTarget === item.id && curriculumDrag?.kind === dragKind && curriculumDrag.scope === dragScope && curriculumDrag.id !== item.id
      const dragHandleProps = {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          setCurriculumDrag({ kind: dragKind, id: item.id, scope: dragScope })
          e.dataTransfer.effectAllowed = 'move'
          const row = (e.currentTarget as HTMLElement).closest('tr')
          if (row) e.dataTransfer.setDragImage(row, 12, 12)
        },
        onDragEnd: () => { setCurriculumDrag(null); setCurriculumDropTarget(null) },
      }
      const rowDropProps = {
        onDragOver: (e: React.DragEvent) => {
          if (curriculumDrag?.kind === dragKind && curriculumDrag.scope === dragScope) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (curriculumDropTarget !== item.id) setCurriculumDropTarget(item.id)
          }
        },
        onDrop: (e: React.DragEvent) => { e.preventDefault(); handleCurriculumDrop(dragKind, item.id, dragScope) },
      }
      const itemHasMastery = hasMasteryBool(item.hasMastery)
      const itemHasAssignment = hasAssignBool(item.hasAssignment)
      const hasSub = itemHasMastery || itemHasAssignment
      const subLabels = ['Tutorial', ...(itemHasMastery ? ['Mastery Test'] : []), ...(itemHasAssignment ? ['Assignment'] : [])]
      const key = 'topic:' + item.id
      const expanded = isExpanded(key)
      const isPretest = item.type === 'quiz' && item.title.toLowerCase().startsWith('pretest')
      const icon = isPretest ? '⭐' : hasSub ? '📄' : '📋'
      return (
        <>
          <tr key={item.id} {...rowDropProps} style={{ borderBottom: isDropTarget ? '2px solid #2563EB' : '1px solid #F0F4FA', opacity: isDragging ? 0.4 : 1, background: isDragging ? '#F7F9FC' : undefined }}>
            <td style={{ padding: '8px 10px', paddingLeft: 12 + depth * 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span {...dragHandleProps} title="Drag to reorder" style={{ color: '#B7C3D6', fontSize: 12, cursor: 'grab', userSelect: 'none' }}>⣿</span>
                {hasSub ? (
                  <button onClick={() => toggleExpanded(key)} style={{ width: 18, height: 18, border: '1px solid #E4EAF2', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#5A7290', padding: 0, lineHeight: 1 }}>{expanded ? '−' : '+'}</button>
                ) : <span style={{ width: 18, flexShrink: 0 }} />}
                <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{item.title || 'Untitled'}</span>
              </div>
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
              <input type="date" value={item.targetDate ? item.targetDate.slice(0, 10) : ''} onChange={e => patchContent(item.id, { targetDate: e.target.value || null })}
                style={{ border: '1px solid #E4EAF2', borderRadius: 6, fontSize: 11, padding: '3px 5px', color: '#1A365E', fontFamily: 'inherit', width: 118 }} />
            </td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}><button onClick={() => patchContent(item.id, { locked: !item.locked })} title="Locked" style={statusBtnStyle(item.locked)}>🔒</button></td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}><button onClick={() => patchContent(item.id, { hidden: !item.hidden })} title="Hidden from students" style={statusBtnStyle(item.hidden)}>🚫</button></td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}><button onClick={() => patchContent(item.id, { excludedFromGrade: !item.excludedFromGrade })} title="Excluded from grade" style={statusBtnStyle(item.excludedFromGrade)}>📄</button></td>
            <td style={{ padding: '8px 10px', textAlign: 'right', position: 'relative' }}>
              <button onClick={() => setCurriculumMenuOpenId(prev => prev === item.id ? null : item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#5A7290', fontFamily: 'inherit' }}>⋯</button>
              {curriculumMenuOpenId === item.id && (
                <div ref={curriculumMenuRef} style={{ position: 'absolute', right: 10, top: '100%', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(26,54,94,.14)', minWidth: 150, zIndex: 30, overflow: 'hidden' }}>
                  <button onClick={() => openEdit(item)} style={menuItemStyle}>✏️ Edit</button>
                  <button onClick={() => deleteItem(item)} style={{ ...menuItemStyle, color: '#D61F31', borderTop: '1px solid #F0F4FA' }}>🗑 Delete</button>
                </div>
              )}
            </td>
          </tr>
          {hasSub && expanded && subLabels.map(label => (
            <tr key={item.id + '-' + label} style={{ borderBottom: '1px solid #F0F4FA' }}>
              <td style={{ padding: '6px 10px', paddingLeft: 12 + (depth + 1) * 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📋</span>
                  <span style={{ fontSize: 11, color: '#5A7290' }}>{item.title}: {label}</span>
                </div>
              </td>
              <td colSpan={4} />
              <td />
            </tr>
          ))}
        </>
      )
    }

    function renderUnitRow(u: { title: string; unitOrder: number; items: LMSContent[] }) {
      const key = 'unit:' + u.title
      const expanded = isExpanded(key)
      const menuKey = 'unit:' + u.title
      const isDragging = curriculumDrag?.kind === 'unit' && curriculumDrag.id === u.title
      const isDropTarget = curriculumDropTarget === u.title && curriculumDrag?.kind === 'unit' && curriculumDrag.id !== u.title
      return (
        <tr key={u.title}
          onDragOver={(e: React.DragEvent) => {
            if (curriculumDrag?.kind === 'unit') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (curriculumDropTarget !== u.title) setCurriculumDropTarget(u.title) }
          }}
          onDrop={(e: React.DragEvent) => { e.preventDefault(); handleCurriculumDrop('unit', u.title, '') }}
          style={{ background: '#FAFBFF', borderBottom: isDropTarget ? '2px solid #2563EB' : '1px solid #F0F4FA', opacity: isDragging ? 0.4 : 1 }}>
          <td style={{ padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                draggable
                onDragStart={(e: React.DragEvent) => {
                  setCurriculumDrag({ kind: 'unit', id: u.title, scope: '' })
                  e.dataTransfer.effectAllowed = 'move'
                  const row = (e.currentTarget as HTMLElement).closest('tr')
                  if (row) e.dataTransfer.setDragImage(row, 12, 12)
                }}
                onDragEnd={() => { setCurriculumDrag(null); setCurriculumDropTarget(null) }}
                title="Drag to reorder"
                style={{ color: '#B7C3D6', fontSize: 12, cursor: 'grab', userSelect: 'none' }}>⣿</span>
              <button onClick={() => toggleExpanded(key)} style={{ width: 18, height: 18, border: '1px solid #E4EAF2', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#5A7290', padding: 0, lineHeight: 1 }}>{expanded ? '−' : '+'}</button>
              <span style={{ fontSize: 15 }}>📁</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>{u.title}</span>
            </div>
          </td>
          <td colSpan={4} />
          <td style={{ padding: '8px 10px', textAlign: 'right', position: 'relative' }}>
            <button onClick={() => setCurriculumMenuOpenId(prev => prev === menuKey ? null : menuKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#5A7290', fontFamily: 'inherit' }}>⋯</button>
            {curriculumMenuOpenId === menuKey && (
              <div ref={curriculumMenuRef} style={{ position: 'absolute', right: 10, top: '100%', background: '#fff', border: '1px solid #E4EAF2', borderRadius: 10, boxShadow: '0 8px 24px rgba(26,54,94,.14)', minWidth: 160, zIndex: 30, overflow: 'hidden' }}>
                <button onClick={() => { openAddItem(u.title); setCurriculumMenuOpenId(null) }} style={menuItemStyle}>+ Add Topic</button>
                <button onClick={() => { renameUnit(u.title); setCurriculumMenuOpenId(null) }} style={menuItemStyle}>✏️ Rename Module</button>
                <button onClick={() => { setModuleOrder(u.title); setCurriculumMenuOpenId(null) }} style={menuItemStyle}>🔢 Module Order</button>
                <button onClick={() => { deleteUnit(u.title, u.items); setCurriculumMenuOpenId(null) }} style={{ ...menuItemStyle, color: '#D61F31', borderTop: '1px solid #F0F4FA' }}>🗑 Delete Module</button>
              </div>
            )}
          </td>
        </tr>
      )
    }

    return (
      <div>
        <div style={{ fontSize: 12, color: '#7A92B0', marginBottom: 14 }}>Total Activities: {content.length}</div>

        <button onClick={() => setCurriculumSettingsOpen(o => !o)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '12px 16px', background: '#fff', border: '1px solid #E4EAF2', borderRadius: curriculumSettingsOpen ? '10px 10px 0 0' : 10, cursor: 'pointer', fontFamily: 'inherit', marginBottom: curriculumSettingsOpen ? 0 : 16 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', letterSpacing: '.05em' }}>CURRICULUM SETTINGS</span>
          <span style={{ fontSize: 11, color: '#5A7290' }}>{curriculumSettingsOpen ? '▲' : '▼'}</span>
        </button>
        {curriculumSettingsOpen && (
          <div style={{ border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Mastery Test Threshold (%)</label>
                <input type="number" min={0} max={100} value={course.passMark} onChange={e => patchCourse({ passMark: parseInt(e.target.value) || 80 })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Pre-Test Exemption Threshold (%)</label>
                <input type="number" min={0} max={100} value={course.preTestExemptionThreshold ?? 80} onChange={e => patchCourse({ preTestExemptionThreshold: parseInt(e.target.value) || 80 })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Mastery Test Retakes</label>
                <select value={course.masteryRetakes ?? 'unlimited'} onChange={e => patchCourse({ masteryRetakes: e.target.value })} style={selectStyle}>
                  <option value="unlimited">Unlimited retakes</option>
                  <option value="0">No retakes</option>
                  <option value="1">1 retake</option>
                  <option value="2">2 retakes</option>
                  <option value="3">3 retakes</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Course Progression Settings</label>
                <select value={course.progressionMode ?? 'open'} onChange={e => patchCourse({ progressionMode: e.target.value })} style={selectStyle}>
                  <option value="open">Open</option>
                  <option value="sequential">Sequential Completion</option>
                  <option value="mastery">Mastery Learning</option>
                  <option value="mastery_sequential">Mastery Learning with Sequential Completion</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={expandAll} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>EXPAND ALL</button>
            <span style={{ color: '#D8E1EC' }}>|</span>
            <button onClick={collapseAll} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 800, letterSpacing: '.03em', cursor: 'pointer', fontFamily: 'inherit' }}>COLLAPSE ALL</button>
          </div>
          <div style={{ fontSize: 11, color: '#7A92B0' }}>Last Saved: {course.updatedAt ? new Date(course.updatedAt).toLocaleString() : '—'}{course.createdBy ? ' by ' + course.createdBy : ''}</div>
        </div>

        <div style={{ border: '1px solid #E4EAF2', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4EAF2', background: '#F7F9FC' }}>
                <th rowSpan={2} style={{ ...thStyle, textAlign: 'left' }} />
                <th rowSpan={2} style={{ ...thStyle, textAlign: 'center' }}>Target Date</th>
                <th colSpan={3} style={{ ...thStyle, textAlign: 'center', borderBottom: '1px solid #E4EAF2' }}>Statuses</th>
                <th rowSpan={2} style={thStyle} />
              </tr>
              <tr style={{ borderBottom: '1px solid #E4EAF2', background: '#F7F9FC' }}>
                <th style={{ ...thStyle, textAlign: 'center' }} title="Locked until prerequisite met">🔒</th>
                <th style={{ ...thStyle, textAlign: 'center' }} title="Hidden from students">🚫</th>
                <th style={{ ...thStyle, textAlign: 'center' }} title="Excluded from grade">📄</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#fff', borderBottom: '1px solid #E4EAF2' }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📘</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#1A365E' }}>{course.title}</span>
                  </div>
                </td>
                <td colSpan={4} />
                <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={openAddUnit} title="Add Module" style={{ padding: '5px 9px', background: '#EEF3FF', color: '#1A365E', border: '1px solid #DDE6F0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginRight: 6 }}>+ Module</button>
                  <button onClick={() => openAddItem(null)} title="Add Lesson" style={{ padding: '5px 9px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginRight: 6 }}>+ Lesson</button>
                  <button onClick={() => { setActiveCourseId(course.id); setPrefillUnit(null); setEditCaseStudyIdx(null); setShowCaseStudyModal(true) }} title="Add Case Study" style={{ padding: '5px 9px', background: '#FFF3D6', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📚 + Case Study</button>
                </td>
              </tr>
              {!content.length ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>No curriculum content yet. Add a module or item above.</td></tr>
              ) : (
                <>
                  {topLevel.map(item => renderContentRow(item, 0, 'order'))}
                  {units.map(u => (
                    <Fragment key={u.title}>
                      {renderUnitRow(u)}
                      {isExpanded('unit:' + u.title) && u.items.map(item => renderContentRow(item, 1, 'moduleOrder', u.title))}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─── SECTION TAB ────────────────────────────────────────────────────────────
  function renderSection() {
    const courses = store.courses.filter(co => co.status === 'Published' || co.status === 'Draft')
    if (!courses.length) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Section Details</div>
        {renderNav()}
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No courses yet.</div>
      </div>
    )
    const cid = sectionCourseId || courses[0].id
    const course = courses.find(co => co.id === cid) || courses[0]
    const content = store.content.filter(x => x.courseId === course.id)
    const allProg = store.progress
    const enrolRows = store.enrolments.filter(en => en.courseId === course.id && isActiveBool(en.active))
    const enrolledIds = new Set<string>()
    enrolRows.forEach(en => {
      if (en.targetType === 'student') enrolledIds.add(en.targetValue)
      else if (en.targetType === 'cohort') students.filter(s => s.cohort === en.targetValue).forEach(s => enrolledIds.add(s.id))
    })
    const enrolled = students.filter(s => enrolledIds.has(s.id)).sort((a, b) => a.lastName.localeCompare(b.lastName))
    const total = enrolled.length
    const passMark = course.passMark || 80
    const enrol0 = enrolRows[0] || {}
    const subjectCol = SUBJECT_COLORS[course.subject] || '#0F5699'

    interface StuStat {
      sid: string; pct: number; avgMastery: number | null; timeMins: number
      paceKey: string; paceLabel: string; paceIcon: string; paceColor: string
      comp: number; total: number; lockedCount: number; readyToScore: number; onTargetGrade: number
    }
    function calcStats(s: Student): StuStat {
      const sid = s.id
      const myProg = allProg.filter(p => p.courseId === course.id && p.studentId === sid)
      const comp = myProg.filter(p => p.status === 'completed').length
      const pct = content.length ? Math.round(comp / content.length * 100) : 0
      const mastRows = myProg.filter(p => p.masteryScore != null && !isNaN(Number(p.masteryScore)))
      const avgMastery = mastRows.length ? Math.round(mastRows.reduce((s, p) => s + Number(p.masteryScore), 0) / mastRows.length) : null
      const timeMins = myProg.reduce((s, p) => s + (p.timeSpentMins || 0), 0)
      let paceKey = 'none', paceLabel = '—', paceIcon = '—', paceColor = '#94A3B8'
      if (pct === 100) { paceKey = 'done'; paceLabel = 'Done'; paceIcon = '✅'; paceColor = '#059669' }
      else if (enrol0.assignedAt && enrol0.dueDate) {
        const now = Date.now(), s0 = new Date(enrol0.assignedAt).getTime(), e0 = new Date(enrol0.dueDate).getTime()
        const expPct = Math.min(100, Math.round((now - s0) / (e0 - s0) * 100))
        const diff = pct - expPct
        if (diff >= 15) { paceKey = 'ahead'; paceLabel = 'Ahead of Pace'; paceIcon = '🏃'; paceColor = '#059669' }
        else if (diff >= 5) { paceKey = 'onpace'; paceLabel = 'On Pace'; paceIcon = '🚶'; paceColor = '#16A34A' }
        else if (diff >= -10) { paceKey = 'slightlyoff'; paceLabel = 'Slightly Off Pace'; paceIcon = '🚶'; paceColor = '#D97706' }
        else { paceKey = 'off'; paceLabel = 'Off Pace'; paceIcon = '🏃'; paceColor = '#D61F31' }
      }
      const lockedCount = myProg.filter(p => {
        const it = content.find(x => x.id === p.contentId)
        if (!it || !hasMasteryBool(it.hasMastery)) return false
        const maxR = it.masteryRetakes || 3
        return (p.masteryAttempts || 0) >= maxR && p.masteryPassed !== true && p.masteryPassed !== 'TRUE'
      }).length
      const readyToScore = myProg.filter(p => {
        const it = content.find(x => x.id === p.contentId)
        return it && it.type === 'quiz' && p.status === 'completed' && (p.masteryScore == null)
      }).length
      const onTargetGrade = enrol0.assignedAt && enrol0.dueDate
        ? Math.min(100, Math.round((Date.now() - new Date(enrol0.assignedAt).getTime()) / (new Date(enrol0.dueDate).getTime() - new Date(enrol0.assignedAt).getTime()) * 100))
        : pct
      return { sid, pct, avgMastery, timeMins, paceKey, paceLabel, paceIcon, paceColor, comp, total: content.length, lockedCount, readyToScore, onTargetGrade }
    }

    const stuStats = enrolled.map(s => ({ s, stat: calcStats(s) }))
    const buckets = { all: total, off: 0, slightlyoff: 0, onpace: 0, ahead: 0, locked: 0, readyToScore: 0 }
    stuStats.forEach(x => {
      const pk = x.stat.paceKey
      if (pk === 'off') buckets.off++
      else if (pk === 'slightlyoff') buckets.slightlyoff++
      else if (pk === 'onpace' || pk === 'done') buckets.onpace++
      else if (pk === 'ahead') buckets.ahead++
      buckets.locked += x.stat.lockedCount
      buckets.readyToScore += x.stat.readyToScore
    })

    let filtered = stuStats
    if (sectionFilter !== 'all') {
      filtered = stuStats.filter(x => {
        if (sectionFilter === 'off') return x.stat.paceKey === 'off'
        if (sectionFilter === 'slightlyoff') return x.stat.paceKey === 'slightlyoff'
        if (sectionFilter === 'onpace') return x.stat.paceKey === 'onpace' || x.stat.paceKey === 'done'
        if (sectionFilter === 'ahead') return x.stat.paceKey === 'ahead'
        if (sectionFilter === 'locked') return false // lockedNoAttempts — not yet computed
        if (sectionFilter === 'lockedRetakes') return x.stat.lockedCount > 0
        if (sectionFilter === 'readytoscore') return x.stat.readyToScore > 0
        return true
      })
    }

    const pills = [
      { k: 'all', label: 'All Students', icon: '👥', col: '#1A365E', bg: '#EEF3FF', count: buckets.all },
      { k: 'off', label: 'Off Pace', icon: '🏃', col: '#D61F31', bg: '#FEE2E2', count: buckets.off },
      { k: 'slightlyoff', label: 'Slightly Off Pace', icon: '🚶', col: '#D97706', bg: '#FEF3C7', count: buckets.slightlyoff },
      { k: 'onpace', label: 'On Pace', icon: '🚶', col: '#16A34A', bg: '#DCFCE7', count: buckets.onpace },
      { k: 'ahead', label: 'Ahead of Pace', icon: '🏃', col: '#059669', bg: '#D1FAE5', count: buckets.ahead },
      { k: 'locked', label: 'Locked (No Attempts)', icon: '🔐', col: '#9333EA', bg: '#F3E8FF', count: 0 },
      { k: 'lockedRetakes', label: 'Locked', icon: '🔒', col: '#6B7280', bg: '#F1F5F9', count: buckets.locked },
      { k: 'readytoscore', label: 'Ready to Score', icon: '⏰', col: '#DC2626', bg: '#FEF2F2', count: buckets.readyToScore },
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>Section Details</div>
          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Data as of {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</div>
        </div>
        {renderNav()}

        {/* Course header banner */}
        <div style={{ background: 'transparent', border: `1.5px solid ${subjectCol}`, borderRadius: 14, padding: '16px 20px', marginTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, background: subjectCol + '18', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: 32 }}>📘</span></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#5A7290', marginBottom: 2 }}>{course.subject}{course.gradeLevel ? ' · ' + course.gradeLevel : ''}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1A365E' }}>{course.title}</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 3 }}>{total} student{total !== 1 ? 's' : ''}{enrol0.dueDate ? ' · End Date: ' + enrol0.dueDate.substring(0, 10) : ''}</div>
          </div>
          {courses.length > 1 && (
            <select value={cid} onChange={e => setSectionCourseId(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${subjectCol}`, borderRadius: 9, fontSize: 12, color: '#1A365E', fontWeight: 600, fontFamily: 'inherit', background: 'transparent', cursor: 'pointer' }}>
              {courses.map(co => <option key={co.id} value={co.id}>{co.title}</option>)}
            </select>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#7A92B0' }}>End Date</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{enrol0.dueDate ? enrol0.dueDate.substring(0, 10) : '—'}</div>
          </div>
        </div>

        {/* Gradebook / View Curriculum */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#1A365E', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'default', letterSpacing: '.5px', fontFamily: 'inherit' }}>📊 GRADEBOOK</button>
          <button onClick={() => { setCurriculumCourseId(course.id); navTab('curriculum') }}
            style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #E4EAF2', background: '#fff', color: '#5A7290', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '.5px', fontFamily: 'inherit' }}>🔍 CURRICULUM</button>
        </div>

        {/* Pace filter pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {pills.map(p => {
            const a = sectionFilter === p.k
            return (
              <button key={p.k} onClick={() => setSectionFilter(p.k)}
                style={{ padding: '12px 16px', borderRadius: 12, border: `2px solid ${a ? p.col : 'transparent'}`, background: a ? p.bg : '#fff', cursor: 'pointer', textAlign: 'center', minWidth: 90, boxShadow: '0 1px 4px rgba(0,0,0,.08)', flexShrink: 0, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: p.col, lineHeight: 1 }}>{p.count}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: p.col, textTransform: 'uppercase', letterSpacing: '.3px', marginTop: 3, lineHeight: 1.2, maxWidth: 80 }}>{p.label}</div>
              </button>
            )
          })}
        </div>

        {/* Student table */}
        <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #E4EAF2', background: '#FAFBFF' }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{course.title}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F7F9FC', borderBottom: '2px solid #E4EAF2' }}>
                  <th style={{ width: 36, padding: '10px 8px', textAlign: 'center' }}></th>
                  <th style={{ width: 40, padding: '10px 6px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>PACE</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>STUDENT ▾</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>ON-TARGET GRADE ⓘ</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>CURRENT GRADE ⓘ</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>COURSE GRADE ⓘ</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>ACTIVITIES COMPLETED</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>TIME ON TASK</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '.7px' }}>TASKS</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr><td colSpan={10} style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>No students match this filter.</td></tr>
                ) : filtered.map(({ s, stat }, idx) => {
                  const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF'
                  const onTgtCol = stat.onTargetGrade >= passMark ? '#059669' : '#D61F31'
                  const curMCol = stat.avgMastery !== null ? (stat.avgMastery >= passMark ? '#059669' : '#D61F31') : '#7A92B0'
                  const crsCol = stat.pct >= passMark ? '#059669' : stat.pct > 0 ? '#D97706' : '#94A3B8'
                  const hasCourseAssign = content.some(it => hasAssignBool(it.hasAssignment))
                  const compSec = hasCourseAssign ? lmsCourseComposite(allProg.filter(p => p.courseId === course.id && p.studentId === stat.sid), content, passMark) : null
                  return (
                    <tr key={stat.sid} style={{ background: rowBg, borderBottom: '1px solid #F0F4FA' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}><input type="checkbox" style={{ cursor: 'pointer' }} /></td>
                      <td style={{ padding: '10px 6px', textAlign: 'center' }}><span style={{ fontSize: 16 }} title={stat.paceLabel}>{stat.paceIcon}</span></td>
                      <td style={{ padding: '10px 12px' }}>
                        <div onClick={() => navigate(`/lms/student-section?sid=${stat.sid}&cid=${course.id}`)} style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', cursor: 'pointer', textDecoration: 'underline' }}>{s.lastName}, {s.firstName}</div>
                        <div style={{ fontSize: 10, color: '#7A92B0' }}>{s.grade}{s.cohort ? ' · ' + s.cohort : ''}</div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: onTgtCol }}>{stat.onTargetGrade}%</span>{' '}
                        <span style={{ fontSize: 10, color: onTgtCol }}>({gradeLabel(stat.onTargetGrade)})</span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {compSec !== null ? <><span style={{ fontSize: 12, fontWeight: 800, color: compSec >= passMark ? '#059669' : '#D61F31' }}>⭐{compSec}%</span>{' '}<span style={{ fontSize: 10, color: compSec >= passMark ? '#059669' : '#D61F31' }}>({gradeLabel(compSec)})</span></>
                          : stat.avgMastery !== null ? <><span style={{ fontSize: 12, fontWeight: 700, color: curMCol }}>{stat.avgMastery}%</span>{' '}<span style={{ fontSize: 10, color: curMCol }}>({gradeLabel(stat.avgMastery)})</span></>
                          : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: crsCol }}>{stat.pct}%</span>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 50, marginInline: 'auto' }}><div style={{ height: '100%', width: stat.pct + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#1A365E' }}>{stat.comp} / {stat.total} completed</div>
                        <div style={{ height: 4, background: '#F0F4FA', borderRadius: 2, marginTop: 3, width: 80 }}><div style={{ height: '100%', width: (stat.total ? stat.pct : 0) + '%', background: crsCol, borderRadius: 2 }} /></div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{fmtTime(stat.timeMins)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {(() => {
                          const taskCount = stat.readyToScore + stat.lockedCount
                          return taskCount > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <span style={{ fontSize: 14 }}>⏰</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: '#D61F31' }}>{taskCount}</span>
                            </div>
                          ) : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>
                        })()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8', fontFamily: 'inherit' }}>•••</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ─── COURSE MODAL (creates/edits a Section) ────────────────────────────────
  function CourseModal() {
    const course = editCourseIdx !== null ? store.courses[editCourseIdx] : undefined
    const isNew = editCourseIdx === null
    const locked = isNew && newSectionGroupId !== null
    const lockedGroup = locked ? store.courseGroups.find(g => g.id === newSectionGroupId) : undefined
    const [title, setTitle] = useState(course?.title ?? '')
    const [subject, setSubject] = useState(course?.subject ?? SUBJECTS[0])
    const [gradeLevel, setGradeLevel] = useState(course?.gradeLevel ?? GRADE_LEVELS[0])
    const [description, setDescription] = useState(course?.description ?? '')
    const [passMark, setPassMark] = useState(String(course?.passMark ?? 80))
    const [creditHours, setCreditHours] = useState(String(course?.creditHours ?? 1))
    const [requiredHours, setRequiredHours] = useState(String(course?.requiredHours ?? ''))
    const [status, setStatus] = useState<'Draft' | 'Published'>(course?.status ?? 'Draft')
    const [announcement, setAnnouncement] = useState(course?.announcement ?? '')
    const [startDate, setStartDate] = useState(course?.startDate ?? '')
    const [endDate, setEndDate] = useState(course?.endDate ?? '')
    const [groupMode, setGroupMode] = useState<'none' | 'existing' | 'new'>(locked || course?.groupId ? 'existing' : 'none')
    const [groupId, setGroupId] = useState(course?.groupId ?? newSectionGroupId ?? '')
    const [newGroupTitle, setNewGroupTitle] = useState('')
    const save = () => {
      if (!title.trim()) { alert('Section title is required'); return }
      let finalGroupId: string | null = null
      const newGroupsToAdd: LMSCourseGroup[] = []
      if (groupMode === 'existing') {
        finalGroupId = groupId || null
      } else if (groupMode === 'new') {
        if (!newGroupTitle.trim()) { alert('Enter a name for the new course'); return }
        const newId = crypto.randomUUID()
        finalGroupId = newId
        newGroupsToAdd.push({ id: newId, title: newGroupTitle.trim() })
      }
      const obj: LMSCourse = {
        ...course,
        id: course?.id ?? lmsId(),
        title: title.trim(), subject, gradeLevel, description: description.trim(),
        passMark: parseInt(passMark) || 80,
        creditHours: parseFloat(creditHours) || 1,
        requiredHours: parseFloat(requiredHours) || 0,
        status, announcement: announcement.trim(),
        createdBy: course?.createdBy ?? 'Admin',
        createdAt: course?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        groupId: finalGroupId,
        startDate: startDate || null,
        endDate: endDate || null,
      }
      const courses = [...store.courses]
      if (isNew) courses.push(obj); else courses[editCourseIdx!] = obj
      persist({ ...store, courses, courseGroups: [...store.courseGroups, ...newGroupsToAdd] })
      closeCourseModal()
    }
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) closeCourseModal() }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📘 {isNew ? 'New Section' : 'Edit Section'}</div>
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Course</label>
              {locked ? (
                <div style={{ ...inputStyle, background: '#F7F9FC', color: '#5A7290', boxSizing: 'border-box' }}>{lockedGroup?.title ?? 'Untitled Course'}</div>
              ) : (
                <>
                  <select
                    value={groupMode === 'new' ? '__new__' : (groupMode === 'existing' ? groupId : '')}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '__new__') setGroupMode('new')
                      else if (v === '') setGroupMode('none')
                      else { setGroupMode('existing'); setGroupId(v) }
                    }}
                    style={selectStyle}>
                    <option value="">— No Course (standalone section) —</option>
                    {store.courseGroups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                    <option value="__new__">+ Create New Course…</option>
                  </select>
                  {groupMode === 'new' && (
                    <input value={newGroupTitle} onChange={e => setNewGroupTitle(e.target.value)} placeholder="e.g. Accelerate to Algebra 1" style={{ ...inputStyle, marginTop: 6 }} />
                  )}
                </>
              )}
            </div>
            <div><label style={labelStyle}>Section Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Entrepreneurship" style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Subject</label><select value={subject} onChange={e => setSubject(e.target.value)} style={selectStyle}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={labelStyle}>Grade Level</label><select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} style={selectStyle}>{GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}</select></div>
            </div>
            <div><label style={labelStyle}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What will students learn in this course?" style={taStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Start Date</label><input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" style={inputStyle} /></div>
              <div><label style={labelStyle}>End Date (optional)</label><input value={endDate} onChange={e => setEndDate(e.target.value)} type="date" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Pass Mark (%)</label><input value={passMark} onChange={e => setPassMark(e.target.value)} type="number" min={1} max={100} style={inputStyle} /></div>
              <div><label style={labelStyle}>Credit Hours</label><input value={creditHours} onChange={e => setCreditHours(e.target.value)} type="number" min={0} max={10} step={0.5} style={inputStyle} /></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Required Study Hours (optional)</label>
                <input value={requiredHours} onChange={e => setRequiredHours(e.target.value)} type="number" min={0} step={0.5} placeholder="e.g. 60" style={inputStyle} />
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>Leave blank for no time requirement. If set, the certificate will only be issued after the student has spent this many hours on the course.</div>
              </div>
              <div><label style={labelStyle}>Status</label><select value={status} onChange={e => setStatus(e.target.value as 'Draft' | 'Published')} style={selectStyle}><option>Draft</option><option>Published</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>📢 Announcement <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span></label>
                <textarea value={announcement} onChange={e => setAnnouncement(e.target.value)} rows={2} placeholder="e.g. Quiz rescheduled to Friday…" style={{ ...taStyle, fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 1 }}>
                <button onClick={closeCourseModal} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Section</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── NEW SECTION FLOW (full-screen, 2-step: pick Course → Section Details) ──
  function NewSectionFlow() {
    const editCourse = editCourseIdx !== null ? store.courses[editCourseIdx] : undefined
    const isEdit = !!editCourse
    const lockedGroupId = newSectionGroupId
    const lockedGroup = lockedGroupId ? store.courseGroups.find(g => g.id === lockedGroupId) : undefined
    const editGroup = isEdit && editCourse.groupId ? store.courseGroups.find(g => g.id === editCourse.groupId) : undefined
    const locked = isEdit || !!lockedGroupId
    const [step, setStep] = useState<'course' | 'details' | 'students'>(locked ? 'details' : 'course')
    const campuses = useCampuses()

    const [courseSearch, setCourseSearch] = useState('')
    const [creatingCourse, setCreatingCourse] = useState(false)
    const [newCourseName, setNewCourseName] = useState('')
    const [chosenCourse, setChosenCourse] = useState<{ key: string; title: string; groupId: string | null } | null>(() => {
      if (isEdit) return { key: editCourse.groupId || editCourse.id, title: editGroup?.title ?? editCourse.title, groupId: editCourse.groupId ?? null }
      if (lockedGroupId) return { key: lockedGroupId, title: lockedGroup?.title ?? '', groupId: lockedGroupId }
      return null
    })
    const [chosenIsNewGroup, setChosenIsNewGroup] = useState(false)

    const [sectionName, setSectionName] = useState(editCourse?.title ?? '')
    const [descOpen, setDescOpen] = useState(!!editCourse?.description)
    const [description, setDescription] = useState(editCourse?.description ?? '')
    const [startDate, setStartDate] = useState(editCourse?.startDate ?? new Date().toISOString().slice(0, 10))
    const [noEndDate, setNoEndDate] = useState(isEdit ? !editCourse.endDate : true)
    const [endDate, setEndDate] = useState(editCourse?.endDate ?? '')
    const [instructorSearch, setInstructorSearch] = useState('')
    const [instructorIds, setInstructorIds] = useState<Set<string>>(new Set(editCourse?.instructorIds ?? []))
    const [showInstructorDirectory, setShowInstructorDirectory] = useState(false)
    const [instructionsOpen, setInstructionsOpen] = useState(!!editCourse?.studentInstructions)
    const [studentInstructions, setStudentInstructions] = useState(editCourse?.studentInstructions ?? '')
    const [preTest, setPreTest] = useState(String(editCourse?.preTestExemptionThreshold ?? 80))
    const [masteryThreshold, setMasteryThreshold] = useState(String(editCourse?.passMark ?? 80))
    const [masteryRetakes, setMasteryRetakes] = useState(editCourse?.masteryRetakes ?? 'unlimited')
    const [progressionMode, setProgressionMode] = useState(editCourse?.progressionMode ?? 'open')
    const [selfEnroll, setSelfEnroll] = useState(editCourse?.selfEnrollEnabled ?? false)
    const [selfEnrollCode, setSelfEnrollCode] = useState<string | null>(editCourse?.selfEnrollCode ?? null)
    const [selfEnrollPassword, setSelfEnrollPassword] = useState<string | null>(editCourse?.selfEnrollPassword ?? null)
    const [saving, setSaving] = useState(false)

    const [directoryStudents, setDirectoryStudents] = useState<DirStudent[]>([])
    const [addedStudentIds, setAddedStudentIds] = useState<Set<string>>(() => {
      if (!editCourse) return new Set()
      return new Set(store.enrolments.filter(e => e.courseId === editCourse.id && e.targetType === 'student').map(e => e.targetValue))
    })
    const [studentQuickSearch, setStudentQuickSearch] = useState('')
    const [studentsLocationFilter, setStudentsLocationFilter] = useState('')
    const [showStudentDirectory, setShowStudentDirectory] = useState(false)

    useEffect(() => {
      if (step !== 'students' || directoryStudents.length) return
      supabase.from('students').select('id,first_name,last_name,grade,student_id,campus').order('last_name').then(({ data, error }) => {
        if (error) { console.error('Student directory load error:', error); return }
        if (data) {
          setDirectoryStudents(data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            firstName: (r.first_name as string) ?? '',
            lastName: (r.last_name as string) ?? '',
            grade: (r.grade as string) ?? '',
            studentId: (r.student_id as string) ?? '',
            campus: (r.campus as string) ?? '',
          })))
        }
      })
    }, [step])

    function closeFlow() {
      setShowNewSectionFlow(false)
      setNewSectionGroupId(null)
      setEditCourseIdx(null)
    }

    const catalog = (() => {
      const map = new Map<string, { key: string; title: string; groupId: string | null; count: number }>()
      store.courses.forEach(co => {
        const key = co.groupId || co.id
        const existing = map.get(key)
        if (existing) { existing.count++; return }
        const title = co.groupId ? (store.courseGroups.find(g => g.id === co.groupId)?.title || co.title) : co.title
        map.set(key, { key, title, groupId: co.groupId ?? null, count: 1 })
      })
      return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
    })()
    const filteredCatalog = courseSearch ? catalog.filter(c => c.title.toLowerCase().includes(courseSearch.toLowerCase())) : catalog

    function pickCourse(c: { key: string; title: string; groupId: string | null }) {
      setChosenCourse(c)
      setChosenIsNewGroup(false)
      setStep('details')
    }
    function confirmNewCourse() {
      if (!newCourseName.trim()) { alert('Enter a course name'); return }
      setChosenCourse({ key: 'NEW', title: newCourseName.trim(), groupId: null })
      setChosenIsNewGroup(true)
      setStep('details')
    }

    function toggleSelfEnroll() {
      setSelfEnroll(prev => {
        const next = !prev
        if (next && !selfEnrollCode) { setSelfEnrollCode(genSelfEnrollCode()); setSelfEnrollPassword(genSelfEnrollPassword()) }
        return next
      })
    }

    async function finalize(studentIdsToEnroll: string[]) {
      if (!sectionName.trim()) { alert('Section name is required'); return }
      if (!chosenCourse) { alert('Select a course'); return }
      setSaving(true)
      let finalGroupId: string | null
      const newGroupsToAdd: LMSCourseGroup[] = []
      let coursesBase = store.courses
      if (chosenIsNewGroup) {
        const newId = crypto.randomUUID()
        finalGroupId = newId
        newGroupsToAdd.push({ id: newId, title: chosenCourse.title })
      } else if (chosenCourse.groupId) {
        finalGroupId = chosenCourse.groupId
      } else {
        // Existing standalone course picked — promote it into a real Course now
        const newId = crypto.randomUUID()
        finalGroupId = newId
        newGroupsToAdd.push({ id: newId, title: chosenCourse.title })
        coursesBase = store.courses.map(c => c.id === chosenCourse!.key ? { ...c, groupId: newId } : c)
      }
      const sibling = chosenCourse.groupId
        ? store.courses.find(c => c.groupId === chosenCourse!.groupId)
        : store.courses.find(c => c.id === chosenCourse!.key)
      const newSection: LMSCourse = {
        id: lmsId(),
        title: sectionName.trim(),
        subject: sibling?.subject ?? SUBJECTS[0],
        gradeLevel: sibling?.gradeLevel ?? GRADE_LEVELS[0],
        description: description.trim(),
        passMark: parseInt(masteryThreshold) || 80,
        creditHours: sibling?.creditHours ?? 1,
        requiredHours: sibling?.requiredHours ?? 0,
        status: 'Published',
        announcement: '',
        createdBy: 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        groupId: finalGroupId,
        startDate: startDate || null,
        endDate: noEndDate ? null : (endDate || null),
        preTestExemptionThreshold: parseInt(preTest) || 80,
        masteryRetakes,
        progressionMode,
        selfEnrollEnabled: selfEnroll,
        selfEnrollCode: selfEnroll ? selfEnrollCode : null,
        selfEnrollPassword: selfEnroll ? selfEnrollPassword : null,
        studentInstructions: studentInstructions.trim(),
        instructorIds: [...instructorIds],
      }
      const newEnrolments: LMSEnrolment[] = studentIdsToEnroll.map(sid => ({
        id: lmsId(), courseId: newSection.id, targetType: 'student', targetValue: sid,
        assignedBy: 'Admin', assignedAt: new Date().toISOString(), active: true,
      }))
      await persist({
        ...store,
        courses: [...coursesBase, newSection],
        courseGroups: [...store.courseGroups, ...newGroupsToAdd],
        enrolments: [...store.enrolments, ...newEnrolments],
      })
      setSaving(false)
      closeFlow()
    }

    // studentIdsToEnroll: null = leave individual-student enrolments untouched (details-only save);
    // an array = sync the section's individual-student roster to exactly this set (add missing, remove dropped).
    async function finalizeEdit(studentIdsToEnroll: string[] | null) {
      if (!editCourse) return
      if (!sectionName.trim()) { alert('Section name is required'); return }
      setSaving(true)
      const updated: LMSCourse = {
        ...editCourse,
        title: sectionName.trim(),
        description: description.trim(),
        updatedAt: new Date().toISOString(),
        startDate: startDate || null,
        endDate: noEndDate ? null : (endDate || null),
        preTestExemptionThreshold: parseInt(preTest) || 80,
        passMark: parseInt(masteryThreshold) || 80,
        masteryRetakes,
        progressionMode,
        selfEnrollEnabled: selfEnroll,
        selfEnrollCode: selfEnroll ? selfEnrollCode : null,
        selfEnrollPassword: selfEnroll ? selfEnrollPassword : null,
        studentInstructions: studentInstructions.trim(),
        instructorIds: [...instructorIds],
      }
      let nextEnrolments = store.enrolments
      if (studentIdsToEnroll !== null) {
        const existingStudentEnrolments = store.enrolments.filter(e => e.courseId === editCourse.id && e.targetType === 'student')
        const existingStudentIds = new Set(existingStudentEnrolments.map(e => e.targetValue))
        const keepSet = new Set(studentIdsToEnroll)
        const additions: LMSEnrolment[] = studentIdsToEnroll
          .filter(sid => !existingStudentIds.has(sid))
          .map(sid => ({
            id: lmsId(), courseId: editCourse.id, targetType: 'student', targetValue: sid,
            assignedBy: 'Admin', assignedAt: new Date().toISOString(), active: true,
          }))
        const removedIds = existingStudentEnrolments.filter(e => !keepSet.has(e.targetValue)).map(e => e.id)
        if (removedIds.length) await Promise.all(removedIds.map(id => deleteLMSEnrolment(id)))
        nextEnrolments = [...store.enrolments.filter(e => !removedIds.includes(e.id)), ...additions]
      }
      await persist({
        ...store,
        courses: store.courses.map(c => c.id === editCourse.id ? updated : c),
        enrolments: nextEnrolments,
      })
      setSaving(false)
      closeFlow()
    }

    const selectedInstructors = staffList.filter(s => instructorIds.has(s.id))
    const instructorMatches = staffList.filter(s => !instructorIds.has(s.id) && instructorSearch && s.fullName.toLowerCase().includes(instructorSearch.toLowerCase()))
    const collapsibleToggleStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderTop: '1px solid #E4EAF2', borderBottom: '1px solid #E4EAF2', padding: '12px 2px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }
    const settingLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#0F766E', letterSpacing: '.04em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) closeFlow() }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, height: '85vh', maxHeight: 820, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '28px 32px 40px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            {step === 'students' ? (
              <button onClick={() => setStep('details')} title="Back"
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0F4FA', cursor: 'pointer', fontSize: 16, color: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            ) : step === 'details' && !locked ? (
              <button onClick={() => setStep('course')} title="Back"
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0F4FA', cursor: 'pointer', fontSize: 16, color: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            ) : <div />}
            <button onClick={closeFlow} title="Cancel"
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#F0F4FA', cursor: 'pointer', fontSize: 16, color: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              <span style={{ fontSize: 44 }}>{step === 'students' ? '🧑' : '📘'}</span>
              <span style={{ position: 'absolute', bottom: -2, left: -8, width: 20, height: 20, borderRadius: '50%', background: isEdit ? '#1A365E' : '#059669', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{isEdit ? '✏️' : '+'}</span>
            </div>
            {step === 'course' ? (
              <>
                <div style={{ fontSize: 21, fontWeight: 700, color: '#1A365E' }}>Create New Section</div>
                <div style={{ fontSize: 14, color: '#5A7290', marginTop: 4 }}>Select a Course</div>
              </>
            ) : step === 'details' ? (
              <>
                <div style={{ fontSize: 21, fontWeight: 700, color: '#1A365E' }}>{chosenCourse?.title}</div>
                <div style={{ fontSize: 14, color: '#5A7290', marginTop: 4 }}>{isEdit ? 'Edit Section Details' : 'Enter Section Details'}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 21, fontWeight: 700, color: '#1A365E' }}>{chosenCourse?.title}</div>
                <div style={{ fontSize: 14, color: '#5A7290', marginTop: 4 }}>Add Students to {sectionName || 'this section'}</div>
              </>
            )}
          </div>

          {step === 'course' ? (
            <>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
                <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search by course name"
                  style={{ width: '100%', padding: '13px 14px 13px 40px', border: '1px solid #E4EAF2', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F7F9FC' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                {creatingCourse ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input autoFocus value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="New course name" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={confirmNewCourse} style={{ padding: '9px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Use This Name</button>
                    <button onClick={() => setCreatingCourse(false)} style={{ padding: '9px 12px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setCreatingCourse(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px 9px 10px', background: '#F0FBF4', border: '1px solid #BBF0D2', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>+</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Create New Course</span>
                  </button>
                )}
              </div>
              <div style={{ border: '1px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {!filteredCatalog.length ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No courses match your search.</div>
                  ) : filteredCatalog.map(c => (
                    <button key={c.key} onClick={() => pickCourse(c)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '14px 18px', background: 'none', border: 'none', borderBottom: '1px solid #F0F4FA', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{c.title}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{c.count} SECTION{c.count !== 1 ? 'S' : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : step === 'details' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={settingLabelStyle}>Section Name</label>
                <input value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="Example: Algebra IA Fall 2018 Jacobson"
                  style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #1A365E', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {!descOpen ? (
                <button onClick={() => setDescOpen(true)} style={collapsibleToggleStyle}>
                  <span style={{ width: 20, height: 20, border: '1.5px solid #94A3B8', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#5A7290' }}>+</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Section Description</span>
                </button>
              ) : (
                <div><label style={labelStyle}>Section Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={taStyle} /></div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                <div>
                  <label style={settingLabelStyle}>Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...settingLabelStyle, color: noEndDate ? '#94A3B8' : '#0F766E' }}>End Date</label>
                  <input type="date" value={endDate} disabled={noEndDate} onChange={e => setEndDate(e.target.value)}
                    style={{ ...inputStyle, background: noEndDate ? '#F7F9FC' : '#fff', color: noEndDate ? '#94A3B8' : '#1A365E' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#5A7290', cursor: 'pointer' }}>
                    <input type="checkbox" checked={noEndDate} onChange={e => setNoEndDate(e.target.checked)} /> No End Date (Disable Pacing)
                  </label>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <label style={settingLabelStyle}>Instructors</label>
                  <button onClick={() => setShowInstructorDirectory(true)}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Browse Instructor Directory</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }}>🔍</span>
                  <input value={instructorSearch} onChange={e => setInstructorSearch(e.target.value)}
                    placeholder="Search and add instructors by name" style={{ ...inputStyle, paddingLeft: 32 }} />
                </div>
                {instructorMatches.length > 0 && (
                  <div style={{ border: '1px solid #E4EAF2', borderRadius: 8, marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {instructorMatches.slice(0, 20).map(s => (
                      <button key={s.id} onClick={() => { setInstructorIds(prev => new Set(prev).add(s.id)); setInstructorSearch('') }}
                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #F0F4FA', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{s.fullName}</span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{s.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedInstructors.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {selectedInstructors.map(s => (
                      <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EEF3FF', color: '#1A365E', padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        {s.fullName}
                        <button onClick={() => setInstructorIds(prev => { const n = new Set(prev); n.delete(s.id); return n })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A7290', fontSize: 12, fontFamily: 'inherit', padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!instructionsOpen ? (
                <button onClick={() => setInstructionsOpen(true)} style={collapsibleToggleStyle}>
                  <span style={{ width: 20, height: 20, border: '1.5px solid #94A3B8', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#5A7290' }}>+</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>Student Instructions</span>
                </button>
              ) : (
                <div><label style={labelStyle}>Student Instructions</label><textarea value={studentInstructions} onChange={e => setStudentInstructions(e.target.value)} rows={3} style={taStyle} /></div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderTop: '1px solid #E4EAF2', paddingTop: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Pre-Test Exemption Threshold</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Set the minimum percentage students must earn on a pre-test to receive module exemption.</div>
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input type="number" min={0} max={100} value={preTest} onChange={e => setPreTest(e.target.value)} style={{ ...inputStyle, width: 90, paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 12 }}>%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Mastery Test Threshold</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Set the minimum percentage students must earn to achieve module mastery.</div>
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input type="number" min={0} max={100} value={masteryThreshold} onChange={e => setMasteryThreshold(e.target.value)} style={{ ...inputStyle, width: 90, paddingRight: 24 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 12 }}>%</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Mastery Test Retakes</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Set the number of times students can unlock Mastery Tests by completing the Tutorial.</div>
                </div>
                <select value={masteryRetakes} onChange={e => setMasteryRetakes(e.target.value)} style={{ ...selectStyle, width: 170, flexShrink: 0 }}>
                  <option value="unlimited">Unlimited retakes</option>
                  <option value="0">No retakes</option>
                  <option value="1">1 retake</option>
                  <option value="2">2 retakes</option>
                  <option value="3">3 retakes</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Course Progression Settings</div>
                <select value={progressionMode} onChange={e => setProgressionMode(e.target.value)} style={{ ...selectStyle, width: 280, flexShrink: 0 }}>
                  <option value="open">Open</option>
                  <option value="sequential">Sequential Completion</option>
                  <option value="mastery">Mastery Learning</option>
                  <option value="mastery_sequential">Mastery Learning with Sequential Completion</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>Self-Enroll</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Generate a Self-Enroll code and password that can be sent to any student.</div>
                  {selfEnroll && selfEnrollCode && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 16, alignItems: 'center', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 8, padding: '10px 14px' }}>
                      <div><div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Code</div><div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', letterSpacing: '.05em' }}>{selfEnrollCode}</div></div>
                      <div><div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Password</div><div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', letterSpacing: '.05em' }}>{selfEnrollPassword}</div></div>
                      <button onClick={() => { setSelfEnrollCode(genSelfEnrollCode()); setSelfEnrollPassword(genSelfEnrollPassword()) }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2563EB', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Regenerate</button>
                    </div>
                  )}
                </div>
                <button onClick={toggleSelfEnroll} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: selfEnroll ? '#1A365E' : '#CBD5E1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: selfEnroll ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                {isEdit ? (
                  <>
                    <button disabled={saving} onClick={() => void finalizeEdit(null)}
                      style={{ padding: '12px 24px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 24, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : '💾 SAVE SECTION'}</button>
                    <span style={{ alignSelf: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>or</span>
                    <button disabled={saving} onClick={() => setStep('students')}
                      style={{ padding: '12px 24px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 24, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>+ ADD STUDENTS →</button>
                  </>
                ) : (
                  <>
                    <button disabled={saving} onClick={() => finalize([])}
                      style={{ padding: '12px 24px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 24, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>SAVE SECTION WITHOUT STUDENTS</button>
                    <span style={{ alignSelf: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>or</span>
                    <button disabled={saving} onClick={() => setStep('students')}
                      style={{ padding: '12px 24px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 24, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>CONTINUE TO STUDENTS →</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowStudentDirectory(true)}
                  style={{ background: 'none', border: 'none', color: '#1A365E', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Browse Student Directory</button>
              </div>
              <select value={studentsLocationFilter} onChange={e => setStudentsLocationFilter(e.target.value)}
                style={{ border: 'none', background: 'none', fontSize: 13, color: '#1A365E', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' }}>
                <option value="">Search All Locations</option>
                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
                <input value={studentQuickSearch} onChange={e => setStudentQuickSearch(e.target.value)} placeholder="Search to add students"
                  style={{ width: '100%', padding: '13px 14px 13px 40px', border: '1px solid #E4EAF2', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F7F9FC' }} />
              </div>
              {(() => {
                const q = studentQuickSearch.trim().toLowerCase()
                const quickMatches = q ? directoryStudents.filter(s => !addedStudentIds.has(s.id)
                  && (!studentsLocationFilter || s.campus === studentsLocationFilter)
                  && `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)).slice(0, 20) : []
                const addedStudents = directoryStudents.filter(s => addedStudentIds.has(s.id)).sort((a, b) => a.lastName.localeCompare(b.lastName))
                return (
                  <>
                    {quickMatches.length > 0 && (
                      <div style={{ border: '1px solid #E4EAF2', borderRadius: 10, maxHeight: 220, overflowY: 'auto' }}>
                        {quickMatches.map(s => (
                          <button key={s.id} onClick={() => { setAddedStudentIds(prev => new Set(prev).add(s.id)); setStudentQuickSearch('') }}
                            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #F0F4FA', cursor: 'pointer', fontFamily: 'inherit' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{s.lastName}, {s.firstName}</span>
                            <span style={{ fontSize: 11, color: '#94A3B8' }}>Grade {s.grade || '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!addedStudents.length ? (
                      <div style={{ textAlign: 'center', padding: '50px 0' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>Add students using the search field above.</div>
                        <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>You may also browse the student directory.</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#5A7290', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{addedStudents.length} Student{addedStudents.length !== 1 ? 's' : ''} Added</div>
                        {addedStudents.map(s => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid #F0F4FA' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{s.lastName}, {s.firstName}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8' }}>Grade {s.grade || '—'}{s.studentId ? ' · ' + s.studentId : ''}</div>
                            </div>
                            <button onClick={() => setAddedStudentIds(prev => { const n = new Set(prev); n.delete(s.id); return n })}
                              style={{ background: 'none', border: 'none', color: '#D61F31', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>✕ Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button disabled={saving} onClick={() => void (isEdit ? finalizeEdit([...addedStudentIds]) : finalize([...addedStudentIds]))}
                  style={{ padding: '12px 32px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 24, fontSize: 12, fontWeight: 800, letterSpacing: '.03em', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : isEdit ? '💾 SAVE & ADD STUDENTS' : 'SAVE SECTION'}</button>
              </div>
            </div>
          )}
          {showInstructorDirectory && (
            <InstructorDirectoryModal
              staffList={staffList}
              campuses={campuses}
              initialSelectedIds={instructorIds}
              onDone={ids => { setInstructorIds(ids); setShowInstructorDirectory(false) }}
              onClose={() => setShowInstructorDirectory(false)}
            />
          )}
          {showStudentDirectory && (
            <StudentDirectoryModal
              directoryStudents={directoryStudents}
              campuses={campuses}
              initialSelectedIds={addedStudentIds}
              onDone={ids => { setAddedStudentIds(ids); setShowStudentDirectory(false) }}
              onClose={() => setShowStudentDirectory(false)}
            />
          )}
        </div>
        </div>
      </div>
    )
  }

  // ─── LESSON MODAL ───────────────────────────────────────────────────────────
  function LessonModal() {
    const courseId = activeCourseId || (store.courses[0]?.id ?? '')
    const item = editLessonIdx !== null ? store.content[editLessonIdx] : undefined
    const isNew = editLessonIdx === null
    const existingUnits = [...new Set(store.content.filter(x => x.courseId === courseId).map(x => x.unitTitle).filter(Boolean))] as string[]
    if (prefillUnit && !existingUnits.includes(prefillUnit)) existingUnits.push(prefillUnit)
    const [title, setTitle] = useState(item?.title ?? '')
    const [unitTitle, setUnitTitle] = useState(item?.unitTitle ?? prefillUnit ?? '')
    const [newUnitTitle, setNewUnitTitle] = useState('')
    const [type, setType] = useState(item?.type ?? 'video' as LMSContent['type'])
    const [lessonSubType, setLessonSubType] = useState(item?.lessonSubType ?? '')
    const [url, setUrl] = useState(item?.url ?? item?.body ?? '')
    const [contentFile, setContentFile] = useState<File | null>(null)
    const [estimatedMins, setEstimatedMins] = useState(String(item?.estimatedMins ?? ''))
    const [order, setOrder] = useState(String(item?.order ?? ''))
    const [hasMastery, setHasMastery] = useState(hasMasteryBool(item?.hasMastery))
    const [masteryPassMark, setMasteryPassMark] = useState(String(item?.masteryPassMark ?? 80))
    const [masteryRetakes, setMasteryRetakes] = useState(String(item?.masteryRetakes ?? 3))
    const [masteryBrief, setMasteryBrief] = useState(item?.masteryBrief ?? '')
    const [masteryTimeLimit, setMasteryTimeLimit] = useState(String(item?.masteryTimeLimit ?? ''))
    const [masteryShuffleQuestions, setMasteryShuffleQuestions] = useState(item?.masteryShuffleQuestions === true || item?.masteryShuffleQuestions === 'TRUE')
    const [masteryWeight, setMasteryWeight] = useState(String(item?.masteryWeight ?? 60))
    // Module (sub-grouping within a Unit) is legacy and no longer editable here — AWS courses
    // go straight from Course to Unit ("Module" in the UI) to Lesson. moduleTitle passes
    // through any pre-existing value unchanged so old content isn't disturbed. moduleOrder,
    // however, is still the field that actually sorts lessons within a unit (see save()
    // below), so it's computed from "Lesson Order" rather than left untouched.
    const [moduleTitle] = useState(item?.moduleTitle ?? '')
    const [slideCount, setSlideCount] = useState(String(item?.slideCount ?? ''))
    const [step, setStep] = useState<1 | 2>(1)

    // Mastery questions state
    interface MasteryQuestion { q: string; type: 'mcq' | 'short'; opts: string[]; ans: number }
    const [masteryQuestions, setMasteryQuestions] = useState<MasteryQuestion[]>(() => {
      try { return JSON.parse(item?.masteryQuizJson || '[]') } catch { return [] }
    })

    function addMasteryQuestion() {
      setMasteryQuestions(p => [...p, { q: '', type: 'mcq', opts: ['', '', '', ''], ans: 0 }])
    }
    function removeMasteryQuestion(qi: number) {
      setMasteryQuestions(p => p.filter((_, i) => i !== qi))
    }
    function updateMasteryQuestion(qi: number, field: string, val: string | number) {
      setMasteryQuestions(p => p.map((q, i) => i === qi ? { ...q, [field]: val } : q))
    }
    function updateMasteryOption(qi: number, oi: number, val: string) {
      setMasteryQuestions(p => p.map((q, i) => i === qi ? { ...q, opts: q.opts.map((o, j) => j === oi ? val : o) } : q))
    }

    const save = async () => {
      if (!title.trim()) { alert('Title is required'); return }
      let finalUnit = unitTitle
      if (unitTitle === '__new__') {
        if (!newUnitTitle.trim()) { alert('Enter a module title'); return }
        finalUnit = newUnitTitle.trim()
      }
      let finalUrl = url.trim()
      if (contentFile) {
        try {
          const path = `lms-content/${Date.now()}_${contentFile.name}`
          finalUrl = await uploadFile(path, contentFile)
        } catch {
          alert('File upload failed. Please try again.')
          return
        }
      }
      const obj: LMSContent = {
        id: item?.id ?? lmsId(),
        courseId,
        title: title.trim(),
        unitTitle: finalUnit,
        type,
        lessonSubType,
        url: finalUrl,
        estimatedMins: parseInt(estimatedMins) || undefined,
        hasMastery,
        masteryPassMark: parseInt(masteryPassMark) || 80,
        masteryRetakes: parseInt(masteryRetakes) || 3,
        masteryBrief: masteryBrief.trim(),
        masteryTimeLimit: parseInt(masteryTimeLimit) || undefined,
        masteryShuffleQuestions,
        masteryWeight: parseInt(masteryWeight) || 60,
        moduleTitle: moduleTitle.trim() || undefined,
        slideCount: parseInt(slideCount) || undefined,
        // Case Study Assignments are created and edited in their own modal now — carry
        // through whatever this item already had (normally nothing, for a Tutorial/Mastery
        // Test lesson) rather than exposing these fields here.
        hasAssignment: item?.hasAssignment,
        assignWeight: item?.assignWeight,
        caseStudyUrl: item?.caseStudyUrl,
        caseStudyFileName: item?.caseStudyFileName,
        masteryQuizJson: masteryQuestions.length ? JSON.stringify(masteryQuestions) : undefined,
      }
      const content = [...store.content]
      if (isNew) content.push(obj); else content[editLessonIdx!] = obj

      // "Lesson Order" is a 1-based target position among this lesson's siblings — the other
      // top-level lessons, or (if it's in a unit) the other lessons in that same unit — mirroring
      // what dragging the ⣿ handle does. A lesson inside a unit is sorted by moduleOrder first
      // (order is only a tiebreaker there), so that's the field a manual position must update.
      const field: 'order' | 'moduleOrder' = finalUnit ? 'moduleOrder' : 'order'
      const siblings = content
        .filter(c => c.id !== obj.id && c.courseId === courseId && (finalUnit ? c.unitTitle === finalUnit : !c.unitTitle))
        .sort((a, b) => (a[field] ?? 0) - (b[field] ?? 0))
      const requested = parseInt(order)
      const targetIdx = requested > 0 ? Math.min(requested - 1, siblings.length) : siblings.length
      siblings.splice(targetIdx, 0, obj)
      const orderMap = new Map(siblings.map((c, i) => [c.id, i]))
      const renumbered = content.map(c => orderMap.has(c.id) ? { ...c, [field]: orderMap.get(c.id) as number } : c)

      persist({ ...store, content: renumbered })
      setShowLessonModal(false)
    }
    const STEP_LABELS: Record<1 | 2, string> = { 1: 'Tutorial', 2: 'Mastery Test' }
    const canLeaveStep1 = title.trim().length > 0

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowLessonModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 12 }}>📄 {isNew ? 'New Lesson' : 'Edit Lesson'}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { if (s === 1 || canLeaveStep1) setStep(s) }}
                  disabled={s > 1 && !canLeaveStep1}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, textAlign: 'center',
                    cursor: s === 1 || canLeaveStep1 ? 'pointer' : 'not-allowed',
                    background: step === s ? '#fff' : 'rgba(255,255,255,.14)',
                    color: step === s ? '#1A365E' : 'rgba(255,255,255,.85)',
                    opacity: s > 1 && !canLeaveStep1 ? 0.5 : 1,
                  }}
                >
                  {s}. {STEP_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {step === 1 && (
              <>
                <div><label style={labelStyle}>Lesson Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Introduction to Ratios" style={inputStyle} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Module</label>
                    <select value={unitTitle} onChange={e => setUnitTitle(e.target.value)} style={selectStyle}>
                      <option value="">Default Module</option>
                      {existingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                      <option value="__new__">+ New module...</option>
                    </select>
                    {unitTitle === '__new__' && (
                      <input value={newUnitTitle} onChange={e => setNewUnitTitle(e.target.value)} placeholder="e.g. Module 1: Business Writing Fundamentals & Persuasive Memos" style={{ ...inputStyle, marginTop: 6 }} />
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Content Type</label>
                    <select value={type} onChange={e => setType(e.target.value as LMSContent['type'])} style={selectStyle}>
                      {['video', 'article', 'link', 'file', 'quiz', 'presentation'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Lesson Role</label>
                    <select value={lessonSubType} onChange={e => setLessonSubType(e.target.value)} style={selectStyle}>
                      <option value="">Standard Lesson</option>
                      <option value="pretest">📋 Pre-Test</option>
                      <option value="posttest">📊 Post-Test</option>
                      <option value="tutorial">📖 Tutorial</option>
                      <option value="practice">✏️ Practice</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Content URL (YouTube, Google Slides, Drive link, or article text)</label>
                  <textarea value={url} onChange={e => { setUrl(e.target.value); if (e.target.value) setContentFile(null) }} rows={3} placeholder="YouTube URL, Google Slides URL, or paste article text..." style={taStyle} />
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 4 }}>— Or upload a file (PDF, image, doc) —</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `2px dashed ${contentFile ? '#059669' : '#CBD5E0'}`, background: contentFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 12, color: contentFile ? '#059669' : '#7A92B0', fontWeight: contentFile ? 700 : 400 }}>
                      <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setContentFile(f); setUrl('') } }} />
                      {contentFile ? `✅ ${contentFile.name}` : '+ Choose file'}
                    </label>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={labelStyle}>Est. Minutes</label><input value={estimatedMins} onChange={e => setEstimatedMins(e.target.value)} type="number" min={1} placeholder="15" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Lesson Order</label><input value={order} onChange={e => setOrder(e.target.value)} type="number" min={1} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Slide Count (presentations)</label><input value={slideCount} onChange={e => setSlideCount(e.target.value)} type="number" min={1} placeholder="e.g. 15" style={inputStyle} /></div>
                </div>
              </>
            )}

            {step === 2 && (
              <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#3D5475', cursor: 'pointer', marginBottom: hasMastery ? 10 : 0 }}>
                  <input type="checkbox" checked={hasMastery} onChange={e => setHasMastery(e.target.checked)} /> 🎯 Enable Mastery Test
                </label>
                {hasMastery && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div><label style={labelStyle}>Pass Mark (%)</label><input value={masteryPassMark} onChange={e => setMasteryPassMark(e.target.value)} type="number" min={1} max={100} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Max Retakes</label><input value={masteryRetakes} onChange={e => setMasteryRetakes(e.target.value)} type="number" min={1} max={10} style={inputStyle} /></div>
                    </div>
                    <div><label style={labelStyle}>📋 Assessment Brief <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional — shown to student before the test)</span></label><textarea value={masteryBrief} onChange={e => setMasteryBrief(e.target.value)} rows={3} placeholder="Explain what this assessment is testing, what the student should focus on, or any instructions before they begin..." style={{ ...taStyle, fontSize: 11 }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><label style={labelStyle}>⏱ Time Limit (minutes)</label><input value={masteryTimeLimit} onChange={e => setMasteryTimeLimit(e.target.value)} type="number" min={1} max={180} placeholder="e.g. 30 — leave blank for unlimited" style={inputStyle} /></div>
                      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#1A365E' }}>
                          <input type="checkbox" checked={masteryShuffleQuestions} onChange={e => setMasteryShuffleQuestions(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} /> 🔀 Shuffle Question Order
                        </label>
                      </div>
                    </div>
                    {/* Mastery Questions Builder */}
                    <div style={{ border: '1px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: '#F7F9FC', padding: '8px 12px', borderBottom: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>🎯 Mastery Test Questions <span style={{ fontWeight: 400, color: '#7A92B0' }}>({masteryQuestions.length})</span></span>
                      </div>
                      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {masteryQuestions.length === 0 && (
                          <div style={{ fontSize: 11, color: '#94A3B8', padding: '6px 0' }}>No questions yet. Click the button below to add one.</div>
                        )}
                        {masteryQuestions.map((q, qi) => (
                          <div key={qi} style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', flexShrink: 0 }}>{qi + 1}.</span>
                              <input
                                value={q.q}
                                onChange={e => updateMasteryQuestion(qi, 'q', e.target.value)}
                                placeholder="Question text..."
                                style={{ flex: 1, padding: '5px 8px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, fontFamily: 'inherit' }}
                              />
                              <select
                                value={q.type}
                                onChange={e => {
                                  updateMasteryQuestion(qi, 'type', e.target.value)
                                  if (e.target.value === 'mcq' && !q.opts?.length) updateMasteryQuestion(qi, 'opts', ['', '', '', ''] as unknown as string)
                                }}
                                style={{ padding: '4px 6px', border: '1px solid #E4EAF2', borderRadius: 5, fontSize: 10 }}
                              >
                                <option value="mcq">MCQ</option>
                                <option value="short">Short</option>
                              </select>
                              <button type="button" onClick={() => removeMasteryQuestion(qi)} style={{ padding: '3px 7px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #F5C2C7', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>×</button>
                            </div>
                            {q.type === 'mcq' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {(q.opts || ['', '', '', '']).map((opt, oi) => (
                                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input
                                      type="radio"
                                      name={`mastery_ans_${qi}`}
                                      checked={q.ans === oi}
                                      onChange={() => updateMasteryQuestion(qi, 'ans', oi)}
                                      title="Mark as correct answer"
                                      style={{ flexShrink: 0, cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', width: 14 }}>{['A', 'B', 'C', 'D'][oi]}</span>
                                    <input
                                      value={opt}
                                      onChange={e => updateMasteryOption(qi, oi, e.target.value)}
                                      placeholder={`Option ${['A', 'B', 'C', 'D'][oi]}...`}
                                      style={{ flex: 1, padding: '4px 8px', border: '1px solid #E4EAF2', borderRadius: 5, fontSize: 11, fontFamily: 'inherit' }}
                                    />
                                  </div>
                                ))}
                                <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>Click the radio button to mark the correct answer</div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 10, color: '#7A92B0', fontStyle: 'italic' }}>Short answer — student types their response</div>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={addMasteryQuestion} style={{ padding: '8px 14px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}>+ Add Mastery Question</button>
                      </div>
                    </div>

                    <div style={{ padding: 10, background: '#EEF3FF', borderRadius: 8, border: '1px solid #C7D9FF' }}>
                      <label style={labelStyle}>Mastery Weight (%) <span style={{ fontWeight: 400, color: '#94A3B8' }}>— of the composite grade, alongside the assignment weight set in step 3</span></label>
                      <input value={masteryWeight} onChange={e => setMasteryWeight(e.target.value)} type="number" min={0} max={100} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 6 }}>
              <div>
                {step > 1 && <button onClick={() => setStep(prev => (prev - 1) as 1 | 2)} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowLessonModal(false)} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                {step < 2 ? (
                  <button
                    onClick={() => { if (step === 1 && !canLeaveStep1) { alert('Title is required'); return } setStep(prev => (prev + 1) as 1 | 2) }}
                    style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Next →
                  </button>
                ) : (
                  <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Lesson</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── CASE STUDY MODAL ───────────────────────────────────────────────────────
  // A Case Study Assignment is its own item, separate from the Tutorial/Mastery Test
  // lesson editor above — one per module, conventionally that module's final lesson.
  function CaseStudyModal() {
    const courseId = activeCourseId || (store.courses[0]?.id ?? '')
    const item = editCaseStudyIdx !== null ? store.content[editCaseStudyIdx] : undefined
    const isNew = editCaseStudyIdx === null
    const existingUnits = [...new Set(store.content.filter(x => x.courseId === courseId).map(x => x.unitTitle).filter(Boolean))] as string[]
    if (prefillUnit && !existingUnits.includes(prefillUnit)) existingUnits.push(prefillUnit)
    const [title, setTitle] = useState(item?.title ?? 'Case Study Launch')
    const [unitTitle, setUnitTitle] = useState(item?.unitTitle ?? prefillUnit ?? '')
    const [newUnitTitle, setNewUnitTitle] = useState('')
    const [caseStudyUrl, setCaseStudyUrl] = useState(item?.caseStudyUrl ?? '')
    const [caseStudyFileName] = useState(item?.caseStudyFileName ?? '')
    const [caseStudyFile, setCaseStudyFile] = useState<File | null>(null)

    const save = async () => {
      if (!title.trim()) { alert('Title is required'); return }
      let finalUnit = unitTitle
      if (unitTitle === '__new__') {
        if (!newUnitTitle.trim()) { alert('Enter a module title'); return }
        finalUnit = newUnitTitle.trim()
      }
      if (!caseStudyUrl.trim() && !caseStudyFile && !caseStudyFileName) { alert('Add a case study document — a URL or an uploaded file'); return }
      let finalCaseStudyUrl = caseStudyUrl.trim()
      let finalCaseStudyFileName = caseStudyFileName
      if (caseStudyFile) {
        try {
          const path = `lms-case-study/${Date.now()}_${caseStudyFile.name}`
          finalCaseStudyUrl = await uploadFile(path, caseStudyFile)
          finalCaseStudyFileName = caseStudyFile.name
        } catch {
          alert('Case study file upload failed. Please try again.')
          return
        }
      }
      // New case studies land after every other item in their module, so they sort as
      // that module's final lesson — matching how AWS actually orders "Case Study Launch".
      const siblingOrders = store.content
        .filter(c => c.courseId === courseId && (c.unitTitle || '') === finalUnit && c.id !== item?.id)
        .map(c => c.order ?? 0)
      const order = item?.order ?? (siblingOrders.length ? Math.max(...siblingOrders) + 1 : 1)
      const obj: LMSContent = {
        id: item?.id ?? lmsId(),
        courseId,
        title: title.trim(),
        unitTitle: finalUnit,
        type: (caseStudyFile || finalCaseStudyFileName) ? 'file' : 'link',
        order,
        hasMastery: false,
        hasAssignment: true,
        caseStudyUrl: finalCaseStudyUrl || undefined,
        caseStudyFileName: finalCaseStudyFileName || undefined,
        url: finalCaseStudyUrl || undefined,
      }
      const content = [...store.content]
      if (isNew) content.push(obj); else content[editCaseStudyIdx!] = obj
      persist({ ...store, content })
      setShowCaseStudyModal(false)
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowCaseStudyModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 24px', borderRadius: '18px 18px 0 0' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📚 {isNew ? 'New Case Study' : 'Edit Case Study'}</div>
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Case Study Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Case Study Launch" style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Module</label>
              <select value={unitTitle} onChange={e => setUnitTitle(e.target.value)} style={selectStyle}>
                <option value="">Default Module</option>
                {existingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                <option value="__new__">+ New module...</option>
              </select>
              {unitTitle === '__new__' && (
                <input value={newUnitTitle} onChange={e => setNewUnitTitle(e.target.value)} placeholder="e.g. Module 1: Business Writing Fundamentals & Persuasive Memos" style={{ ...inputStyle, marginTop: 6 }} />
              )}
            </div>
            <div style={{ padding: 12, background: '#FFF9F0', borderRadius: 10, border: '1px solid #FDE68A', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.5px' }}>📚 Case Study Document</div>
              <div style={{ fontSize: 10, color: '#7A92B0' }}>
                Students will view this case study, then work through a fixed 7-section flow (Case Study → Notes Score → Discussion Post → Socratic Debate Score → OMR Test Score → Presentation Upload → Presentation Score). Scoring happens per-student in the Gradebook — the rubric is fixed and not editable here.
              </div>
              <div>
                <label style={labelStyle}>Case Study URL (Google Slides, Drive link)</label>
                <textarea value={caseStudyUrl} onChange={e => { setCaseStudyUrl(e.target.value); if (e.target.value) setCaseStudyFile(null) }} rows={2} placeholder="Google Slides URL or Drive link..." style={taStyle} />
                <div style={{ marginTop: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>— Or upload a file (PDF, PPT) —</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `2px dashed ${caseStudyFile ? '#059669' : '#CBD5E0'}`, background: caseStudyFile ? '#F0FDF4' : '#F8FAFC', cursor: 'pointer', fontSize: 12, color: caseStudyFile ? '#059669' : '#7A92B0', fontWeight: caseStudyFile ? 700 : 400 }}>
                    <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setCaseStudyFile(f); setCaseStudyUrl('') } }} />
                    {caseStudyFile ? `✅ ${caseStudyFile.name}` : caseStudyFileName ? `📎 ${caseStudyFileName} (uploaded — choose a new file to replace)` : '+ Choose file'}
                  </label>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setShowCaseStudyModal(false)} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} style={{ padding: '9px 20px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Save Case Study</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 32px 0' }}>
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'manage' && renderManage()}
      {activeTab === 'students' && renderManageStudents()}
      {activeTab === 'student-section' && renderStudentSectionDetail()}
      {activeTab === 'courses' && renderCourses()}
      {activeTab === 'content' && renderContent()}
      {activeTab === 'assign' && renderAssign()}
      {activeTab === 'gradebook' && renderGradebook()}
      {activeTab === 'curriculum' && renderCurriculumPage()}
      {activeTab === 'appeals' && renderAppeals()}
      {activeTab === 'student' && renderStudentDetail()}
      {activeTab === 'section' && renderSection()}
      {activeTab === 'progress' && renderProgress()}
      {showCourseModal && <CourseModal />}
      {showNewSectionFlow && <NewSectionFlow />}
      {showLessonModal && <LessonModal />}
      {showCaseStudyModal && <CaseStudyModal />}
      {showEnrolModal && <EnrolModal courses={store.courses} students={students} cohorts={cohorts} onSave={enrolment => persist({ ...store, enrolments: [...store.enrolments, enrolment] })} onClose={() => setShowEnrolModal(false)} />}
      {confirmDialog && <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />}
      {promptDialog && <PromptDialog state={promptDialog} onClose={() => setPromptDialog(null)} />}
      {notesSectionId && (
        <SectionNotesModal
          sectionId={notesSectionId}
          sectionTitle={store.courses.find(c => c.id === notesSectionId)?.title ?? 'Section'}
          authorId={profile?.id}
          authorName={profile?.full_name || profile?.email}
          onClose={() => setNotesSectionId(null)}
        />
      )}
      {studentNotesTarget && (
        <StudentNotesModal
          sectionId={studentNotesTarget.cid}
          studentId={studentNotesTarget.sid}
          studentName={studentNotesTarget.studentName}
          courseTitle={studentNotesTarget.courseTitle}
          authorId={profile?.id}
          authorName={profile?.full_name || profile?.email}
          onClose={() => setStudentNotesTarget(null)}
        />
      )}
      {previewItem && <LessonPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
      {scoreModal && <CaseStudyGradingPanel data={scoreModal} onClose={() => setScoreModal(null)} onFinalGradeChange={(score) => {
        const key = scoreModal.studentId + '_' + scoreModal.contentId
        persist({ ...store, progress: store.progress.map(p => p.studentId === scoreModal.studentId && p.contentId === scoreModal.contentId ? { ...p, assignScore: score, assignStatus: 'scored' } : p).concat(store.progress.find(p => p.studentId === scoreModal.studentId && p.contentId === scoreModal.contentId) ? [] : [{ studentId: scoreModal.studentId, courseId: scoreModal.courseId, contentId: scoreModal.contentId, status: 'in_progress' as const, assignScore: score, assignStatus: 'scored', id: key }]) })
      }} />}
    </div>
  )
}

interface CaseStudyGradingData {
  studentId: string
  studentName: string
  contentId: string
  courseId: string
  lessonTitle: string
  caseStudyUrl?: string
}

interface ScoreComponentRow {
  criteriaScores: Record<string, number>
  subtotal: number | null
  feedback: string
  status: 'not_scored' | 'scored'
}

interface DiscussionPostRow { id: string; studentId: string; studentName: string; body: string; createdAt: string; parentPostId: string | null }
interface AppealRow { id: string; componentType: ScoreComponentType; message: string; status: 'open' | 'resolved'; adminReply: string | null }

function emptyScoreComponents(): Record<ScoreComponentType, ScoreComponentRow> {
  return Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, { criteriaScores: {}, subtotal: null, feedback: '', status: 'not_scored' as const }])) as Record<ScoreComponentType, ScoreComponentRow>
}

/** A submission row counts as this content's Presentation Upload unless its note is
 *  tagged JSON metadata for something else (e.g. a mastery-quiz snapshot). */
function isPresentationSubmission(row: Record<string, unknown>): boolean {
  const noteVal = row.note
  if (typeof noteVal !== 'string') return true
  const t = noteVal.trim()
  if (!t.startsWith('{')) return true
  try {
    const parsed = JSON.parse(t)
    return !(parsed && typeof parsed === 'object' && 'kind' in parsed)
  } catch {
    return true
  }
}

function CaseStudyGradingPanel({ data, onClose, onFinalGradeChange }: {
  data: CaseStudyGradingData
  onClose: () => void
  onFinalGradeChange: (finalGradeVal: number) => void
}) {
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<Record<ScoreComponentType, ScoreComponentRow>>(emptyScoreComponents)
  const [draftCriteria, setDraftCriteria] = useState<Record<ScoreComponentType, Record<string, string>>>(() => Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, {}])) as Record<ScoreComponentType, Record<string, string>>)
  const [draftFeedback, setDraftFeedback] = useState<Record<ScoreComponentType, string>>(() => Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, ''])) as Record<ScoreComponentType, string>)
  const [posts, setPosts] = useState<DiscussionPostRow[]>([])
  const [presentationSub, setPresentationSub] = useState<{ note: string; linkUrl: string; submittedAt: string } | null>(null)
  const [appeals, setAppeals] = useState<AppealRow[]>([])
  const [saving, setSaving] = useState<ScoreComponentType | null>(null)

  async function load() {
    setLoading(true)
    const [scRes, dpRes, subRes, apRes] = await Promise.all([
      supabase.from('lms_score_components').select('*').eq('content_id', data.contentId).eq('student_id', data.studentId),
      supabase.from('lms_discussion_posts').select('*').eq('content_id', data.contentId).order('created_at', { ascending: true }),
      supabase.from('lms_submissions').select('*').eq('content_id', data.contentId).eq('student_id', data.studentId).order('submitted_at', { ascending: false }),
      supabase.from('lms_grade_appeals').select('*').eq('content_id', data.contentId).eq('student_id', data.studentId),
    ])

    const nextScores = emptyScoreComponents()
    const nextDraftCriteria = Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, {}])) as Record<ScoreComponentType, Record<string, string>>
    const nextDraftFeedback = Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, ''])) as Record<ScoreComponentType, string>
    ;(scRes.data ?? []).forEach((r: Record<string, unknown>) => {
      const type = r.component_type as ScoreComponentType
      if (!SCORE_COMPONENT_TYPES.includes(type)) return
      const criteriaScores = (r.criteria_scores as Record<string, number>) ?? {}
      nextScores[type] = { criteriaScores, subtotal: r.subtotal as number | null, feedback: (r.feedback as string) ?? '', status: (r.status as 'not_scored' | 'scored') ?? 'not_scored' }
      nextDraftCriteria[type] = Object.fromEntries(Object.entries(criteriaScores).map(([k, v]) => [k, String(v)]))
      nextDraftFeedback[type] = (r.feedback as string) ?? ''
    })
    setScores(nextScores)
    setDraftCriteria(nextDraftCriteria)
    setDraftFeedback(nextDraftFeedback)

    const rawPosts = (dpRes.data ?? []) as Record<string, unknown>[]
    const posterIds = [...new Set(rawPosts.map(p => p.student_id as string))]
    let names: Record<string, string> = {}
    if (posterIds.length) {
      const { data: rows } = await supabase.from('students').select('id,first_name,last_name').in('id', posterIds)
      names = Object.fromEntries((rows ?? []).map((r: Record<string, unknown>) => [r.id, `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim()]))
    }
    setPosts(rawPosts.map(p => ({
      id: p.id as string, studentId: p.student_id as string, studentName: names[p.student_id as string] ?? 'Student',
      body: p.body as string, createdAt: p.created_at as string, parentPostId: (p.parent_post_id as string) ?? null,
    })))

    const presRow = (subRes.data ?? []).find(isPresentationSubmission) as Record<string, unknown> | undefined
    setPresentationSub(presRow ? { note: (presRow.note as string) ?? '', linkUrl: (presRow.link_url as string) ?? '', submittedAt: (presRow.submitted_at as string) ?? '' } : null)

    setAppeals((apRes.data ?? []).map((a: Record<string, unknown>) => ({
      id: a.id as string, componentType: a.component_type as ScoreComponentType, message: a.message as string,
      status: a.status as 'open' | 'resolved', adminReply: (a.admin_reply as string) ?? null,
    })))
    setLoading(false)
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  async function saveCategory(type: ScoreComponentType) {
    const criteria = CASE_STUDY_RUBRIC[type].criteria
    const criteriaScores: Record<string, number> = {}
    for (const c of criteria) {
      const raw = draftCriteria[type][c.key] ?? ''
      const v = Math.max(0, Math.min(c.max, Number(raw) || 0))
      criteriaScores[c.key] = v
    }
    const subtotal = categorySubtotal(type, criteriaScores)
    setSaving(type)
    const { error } = await supabase.from('lms_score_components').upsert({
      content_id: data.contentId, student_id: data.studentId, component_type: type,
      criteria_scores: criteriaScores, subtotal, feedback: draftFeedback[type].trim() || null,
      status: 'scored', scored_at: new Date().toISOString(),
    }, { onConflict: 'content_id,student_id,component_type' })
    setSaving(null)
    if (error) { alert('Failed to save score. Please try again.'); return }

    const nextScores: Record<ScoreComponentType, ScoreComponentRow> = { ...scores, [type]: { criteriaScores, subtotal, feedback: draftFeedback[type].trim(), status: 'scored' } }
    setScores(nextScores)

    const subtotalsByType = Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, nextScores[t].status === 'scored' ? nextScores[t].subtotal : null])) as Partial<Record<ScoreComponentType, number | null>>
    const fg = finalGrade(subtotalsByType)
    if (fg !== null) onFinalGradeChange(fg)
  }

  function appealFor(type: ScoreComponentType) {
    return appeals.find(a => a.componentType === type)
  }

  const subtotalsByType = Object.fromEntries(SCORE_COMPONENT_TYPES.map(t => [t, scores[t].status === 'scored' ? scores[t].subtotal : null])) as Partial<Record<ScoreComponentType, number | null>>
  const currentFinalGrade = finalGrade(subtotalsByType)

  function renderCategoryEditor(type: ScoreComponentType) {
    return (
      <CategoryEditor
        type={type}
        row={scores[type]}
        draftValues={draftCriteria[type]}
        draftFeedback={draftFeedback[type]}
        saving={saving === type}
        appeal={appealFor(type)}
        onCriteriaChange={(key, val) => setDraftCriteria(prev => ({ ...prev, [type]: { ...prev[type], [key]: val } }))}
        onFeedbackChange={val => setDraftFeedback(prev => ({ ...prev, [type]: val }))}
        onSave={() => void saveCategory(type)}
        onAppealResolved={reply => setAppeals(prev => prev.map(a => a.componentType === type ? { ...a, status: 'resolved', adminReply: reply } : a))}
      />
    )
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, margin: '0 auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>📚 Grade Case Study — {data.studentName}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{data.lessonTitle}</div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading…</div>
          ) : (
            <>
              <div style={{ padding: '10px 12px', background: currentFinalGrade !== null ? '#DCFCE7' : '#F7F9FC', border: `1px solid ${currentFinalGrade !== null ? '#BBF7D0' : '#E4EAF2'}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#5A7290' }}>Final Grade</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: currentFinalGrade !== null ? '#059669' : '#94A3B8' }}>{currentFinalGrade !== null ? `${currentFinalGrade}/100` : 'Pending — score all 5 categories'}</span>
              </div>

              {/* 1. Case Study */}
              <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>1. Case Study</div>
                {data.caseStudyUrl
                  ? <a href={data.caseStudyUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700 }}>↗ Open case study document</a>
                  : <div style={{ fontSize: 11, color: '#94A3B8' }}>No case study document uploaded.</div>}
              </div>

              {/* 2. Notes Score */}
              {renderCategoryEditor('notes')}

              {/* 3. Discussion Post */}
              <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>3. Discussion Thread ({posts.length})</div>
                {posts.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>No posts yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, maxHeight: 220, overflowY: 'auto' }}>
                    {posts.map(p => (
                      <div key={p.id} style={{ background: p.studentId === data.studentId ? '#EEF3FF' : '#fff', border: '1px solid #E4EAF2', borderRadius: 8, padding: '8px 10px', marginLeft: p.parentPostId ? 16 : 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#1A365E', marginBottom: 3 }}>{p.studentName}{p.studentId === data.studentId ? ' (this student)' : ''}</div>
                        <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap' }}>{p.body}</div>
                      </div>
                    ))}
                  </div>
                )}
                {renderCategoryEditor('discussion')}
              </div>

              {/* 4. Socratic Debate */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>4. Socratic Debate</div>
                {renderCategoryEditor('debate')}
              </div>

              {/* 5. OMR Test */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>5. OMR Test</div>
                {renderCategoryEditor('omr')}
              </div>

              {/* 6. Presentation Upload */}
              <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>6. Presentation Upload</div>
                {presentationSub ? (
                  <>
                    {presentationSub.note && <div style={{ fontSize: 11, color: '#3D5475', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{presentationSub.note}</div>}
                    {presentationSub.linkUrl && <a href={presentationSub.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700, wordBreak: 'break-all' }}>🔗 View uploaded presentation</a>}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Student has not uploaded a presentation yet.</div>
                )}
              </div>

              {/* 7. Presentation Score */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', marginBottom: 6 }}>7. Presentation Score</div>
                {renderCategoryEditor('presentation')}
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: '#F0F4FA', color: '#1A365E', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryEditorAppealNote({ appeal, onResolved }: {
  appeal: AppealRow | undefined
  onResolved: (reply: string) => void
}) {
  const [reply, setReply] = useState(appeal?.adminReply ?? '')
  const [saving, setSaving] = useState(false)
  if (!appeal) return null

  async function resolve() {
    if (!reply.trim()) { alert('Enter a reply before resolving.'); return }
    setSaving(true)
    const { error } = await supabase.from('lms_grade_appeals').update({ status: 'resolved', admin_reply: reply.trim(), resolved_at: new Date().toISOString() }).eq('id', appeal!.id)
    setSaving(false)
    if (error) { alert('Failed to resolve appeal.'); return }
    onResolved(reply.trim())
  }

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', background: appeal.status === 'open' ? '#FEF3C7' : '#F0FDF4', border: `1px solid ${appeal.status === 'open' ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: appeal.status === 'open' ? '#92400E' : '#059669', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        🚩 {appeal.status === 'open' ? 'Open Appeal' : 'Appeal Resolved'}
      </div>
      <div style={{ fontSize: 11, color: '#3D5475', whiteSpace: 'pre-wrap', marginBottom: 6 }}>{appeal.message}</div>
      {appeal.status === 'open' ? (
        <>
          <textarea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to the student..." style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #FDE68A', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 6 }} />
          <button onClick={() => void resolve()} disabled={saving} style={{ padding: '5px 12px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Mark Resolved'}</button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#059669', whiteSpace: 'pre-wrap' }}>↩ {appeal.adminReply}</div>
      )}
    </div>
  )
}

function CategoryEditor({ type, row, draftValues, draftFeedback, saving, appeal, onCriteriaChange, onFeedbackChange, onSave, onAppealResolved }: {
  type: ScoreComponentType
  row: ScoreComponentRow
  draftValues: Record<string, string>
  draftFeedback: string
  saving: boolean
  appeal: AppealRow | undefined
  onCriteriaChange: (key: string, val: string) => void
  onFeedbackChange: (val: string) => void
  onSave: () => void
  onAppealResolved: (reply: string) => void
}) {
  const cat = CASE_STUDY_RUBRIC[type]
  return (
    <div style={{ background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E' }}>{cat.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {row.status === 'scored' && <span style={{ fontSize: 10, fontWeight: 900, color: '#059669', background: '#DCFCE7', padding: '2px 8px', borderRadius: 10 }}>{row.subtotal}/{cat.weight}</span>}
          <span style={{ fontSize: 9, color: '#94A3B8' }}>{cat.weight}% of grade</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cat.criteria.length, 4)}, 1fr)`, gap: 8, marginBottom: 8 }}>
        {cat.criteria.map(c => (
          <div key={c.key}>
            <label style={{ fontSize: 9, fontWeight: 700, color: '#5A7290', display: 'block', marginBottom: 2 }}>{c.label} (0–{c.max})</label>
            <input
              type="number" min={0} max={c.max}
              value={draftValues[c.key] ?? ''}
              onChange={e => onCriteriaChange(c.key, e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        ))}
      </div>
      <textarea
        rows={2} value={draftFeedback}
        onChange={e => onFeedbackChange(e.target.value)}
        placeholder="Feedback visible to the student..."
        style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E4EAF2', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <button onClick={onSave} disabled={saving} style={{ padding: '6px 14px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? 'Saving…' : row.status === 'scored' ? '💾 Update Score' : '💾 Save Score'}
      </button>
      <CategoryEditorAppealNote appeal={appeal} onResolved={onAppealResolved} />
    </div>
  )
}

function AppealRowCard({ appeal, studentName, lessonTitle, onResolved }: {
  appeal: { id: string; componentType: ScoreComponentType; message: string; status: 'open' | 'resolved'; adminReply: string | null; createdAt: string }
  studentName: string
  lessonTitle: string
  onResolved: (reply: string) => void
}) {
  const [reply, setReply] = useState(appeal.adminReply ?? '')
  const [saving, setSaving] = useState(false)

  async function resolve() {
    if (!reply.trim()) { alert('Enter a reply before resolving.'); return }
    setSaving(true)
    const { error } = await supabase.from('lms_grade_appeals').update({ status: 'resolved', admin_reply: reply.trim(), resolved_at: new Date().toISOString() }).eq('id', appeal.id)
    setSaving(false)
    if (error) { alert('Failed to resolve appeal.'); return }
    onResolved(reply.trim())
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${appeal.status === 'open' ? '#FDE68A' : '#E4EAF2'}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A365E' }}>{studentName} · {CASE_STUDY_RUBRIC[appeal.componentType].label}</div>
        <span style={{ fontSize: 9, fontWeight: 700, color: appeal.status === 'open' ? '#92400E' : '#059669', background: appeal.status === 'open' ? '#FEF3C7' : '#DCFCE7', padding: '3px 8px', borderRadius: 10 }}>
          {appeal.status === 'open' ? '⏳ Open' : '✅ Resolved'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#7A92B0', marginBottom: 8 }}>{lessonTitle} · Filed {appeal.createdAt ? new Date(appeal.createdAt).toLocaleDateString() : ''}</div>
      <div style={{ fontSize: 12, color: '#3D5475', whiteSpace: 'pre-wrap', marginBottom: 8, background: '#F7F9FC', borderRadius: 8, padding: '8px 10px' }}>{appeal.message}</div>
      {appeal.status === 'open' ? (
        <>
          <textarea rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to the student..." style={{ width: '100%', padding: '7px 9px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
          <button onClick={() => void resolve()} disabled={saving} style={{ padding: '7px 16px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Mark Resolved'}</button>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#059669', whiteSpace: 'pre-wrap' }}>↩ {appeal.adminReply}</div>
      )}
    </div>
  )
}

function LessonPreviewModal({ item, onClose }: { item: LMSContent; onClose: () => void }) {
  const noteKey = `lms_note_${item.id}`
  const [noteOpen, setNoteOpen] = useState(() => { try { return !!localStorage.getItem(noteKey) } catch { return false } })
  const [noteText, setNoteText] = useState(() => { try { return localStorage.getItem(noteKey) || '' } catch { return '' } })
  const [slideIdx, setSlideIdx] = useState(0)

  const contentTypeLabels: Record<string, string> = { video: '🎬 Video', article: '📝 Article', link: '🔗 Web Link', file: '📎 File', quiz: '❓ Quiz', presentation: '🖥️ Presentation' }
  const passMark = item.masteryPassMark ?? 80
  const maxRetakes = item.masteryRetakes ?? 3

  let masteryQuestions: Array<{ q: string; opts?: string[]; ans?: number }> = []
  try { masteryQuestions = JSON.parse(item.masteryQuizJson || item.quizJson || '[]') } catch { /* empty */ }

  function getEmbedUrl(url: string): string {
    if (url.includes('docs.google.com/presentation')) {
      const base = url.replace(/\/pub(\?.*)?$/, '').replace(/\/edit(\?.*)?$/, '').replace(/\/embed(\?.*)?$/, '')
      return base + '/embed?start=false&loop=false&rm=minimal'
    }
    const driveMatch = url.match(/\/file\/d\/([^/]+)/)
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    return url
  }

  function renderContent() {
    const url = item.url || ''

    if (item.type === 'video') {
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
      if (ytMatch) {
        return (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
            <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
          </div>
        )
      }
      return url
        ? <div style={{ padding: '20px', textAlign: 'center' }}><a href={url} target="_blank" rel="noreferrer" style={{ color: '#1A365E', fontWeight: 700 }}>▶ Watch Video</a></div>
        : <div style={{ padding: 20, color: '#94A3B8' }}>No video URL provided.</div>
    }

    if (item.type === 'article') {
      const content = item.body || item.url || ''
      return content
        ? <div style={{ padding: 20, lineHeight: 1.7, fontSize: 13, color: '#1A365E', whiteSpace: 'pre-wrap' }}>{content}</div>
        : <div style={{ padding: 20, color: '#94A3B8' }}>No article content.</div>
    }

    if (item.type === 'presentation' && url) {
      const slideCount = item.slideCount || 20
      const slideM = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)
      const slideId = slideM ? slideM[1] : null
      const embedUrl = slideId
        ? `https://docs.google.com/presentation/d/${slideId}/embed?rm=minimal&start=false&loop=false&delayms=99999`
        : getEmbedUrl(url)
      const SLIDE_H = 500
      const pct = Math.round(slideIdx / Math.max(1, slideCount - 1) * 100)
      const isFirst = slideIdx === 0
      const isLast = slideIdx === slideCount - 1
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Clipped slide window */}
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px 10px 0 0', background: '#1A1A2E', height: 390 }}>
            <div style={{ position: 'relative', width: '100%', transform: `translateY(-${slideIdx * SLIDE_H}px)`, transition: 'transform .3s ease' }}>
              <iframe src={embedUrl} style={{ width: '100%', height: slideCount * SLIDE_H + 100, border: 'none', display: 'block', pointerEvents: 'none' }} scrolling="no" allowFullScreen title={item.title} loading="lazy" />
            </div>
            {/* Transparent overlay blocks iframe interaction */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'default', background: 'transparent' }} title="Use ◀ Prev and ▶ Next buttons to navigate slides" />
          </div>
          {/* Navigation bar */}
          <div style={{ background: '#F0F4FA', padding: '10px 16px 12px', border: '1px solid #E4EAF2', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
            {/* Progress bar with dots */}
            <div style={{ position: 'relative', height: 6, background: '#DDE6F0', borderRadius: 3, marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1A365E', borderRadius: 3, transition: 'width .2s' }} />
              {Array.from({ length: Math.min(slideCount, 20) }).map((_, ti) => {
                const tpct = Math.round(ti / Math.max(1, slideCount - 1) * 100)
                return (
                  <div key={ti} onClick={() => setSlideIdx(ti)} style={{ position: 'absolute', top: -3, left: `${tpct}%`, width: 12, height: 12, borderRadius: '50%', background: ti <= slideIdx ? '#1A365E' : '#fff', border: `2px solid ${ti < slideIdx ? '#1A365E' : '#DDE6F0'}`, transform: 'translateX(-50%)', cursor: 'pointer', transition: 'all .2s' }} title={`Slide ${ti + 1}`} />
                )
              })}
            </div>
            {/* Nav row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSlideIdx(p => Math.max(0, p - 1))} disabled={isFirst} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isFirst ? 'not-allowed' : 'pointer', background: isFirst ? '#E4EAF2' : '#1A365E', color: isFirst ? '#94A3B8' : '#fff' }}>◀ Prev</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>Slide {slideIdx + 1} <span style={{ color: '#94A3B8', fontWeight: 400 }}>of {slideCount}</span></div>
                {slideCount <= 20 && (
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    {Array.from({ length: slideCount }).map((_, di) => (
                      <div key={di} onClick={() => setSlideIdx(di)} style={{ width: di === slideIdx ? 18 : 6, height: 6, borderRadius: 3, background: di === slideIdx ? '#1A365E' : di < slideIdx ? '#7A92B0' : '#DDE6F0', cursor: 'pointer', transition: 'all .2s' }} />
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setSlideIdx(p => Math.min(slideCount - 1, p + 1))} disabled={isLast} style={{ padding: '7px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isLast ? 'not-allowed' : 'pointer', background: isLast ? '#E4EAF2' : '#1A365E', color: isLast ? '#94A3B8' : '#fff' }}>Next ▶</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{pct}% through presentation</div>
              <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#1A365E', fontWeight: 700 }}>↗ Open in Google Slides</a>
            </div>
          </div>
        </div>
      )
    }

    if (item.type === 'file' && url) {
      const driveMatch = url.match(/\/file\/d\/([^/]+)/)
      const previewUrl = driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : url
      return (
        <>
          <div style={{ position: 'relative', paddingBottom: '75%', height: 0, overflow: 'hidden' }}>
            <iframe src={previewUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={item.title} loading="lazy" />
          </div>
          <div style={{ padding: '8px 16px', textAlign: 'right' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1A365E', fontWeight: 700 }}>↗ Open in Drive</a>
          </div>
        </>
      )
    }

    if (item.type === 'link' && url) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 8 }}>Loading external content inline...</div>
          <iframe src={url} style={{ width: '100%', height: 500, border: '1.5px solid #E4EAF2', borderRadius: 10 }} sandbox="allow-scripts allow-same-origin allow-forms" loading="lazy" title={item.title} />
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '10px 24px', background: '#1A365E', color: '#fff', borderRadius: 9, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>🔗 Open Link</a>
          </div>
        </div>
      )
    }

    if (item.type === 'quiz') {
      let questions: Array<{ q: string; opts?: string[]; ans?: number }> = []
      try { questions = JSON.parse(item.quizJson || '[]') } catch { /* empty */ }
      if (!questions.length) return <div style={{ padding: '20px', color: '#94A3B8' }}>No quiz questions defined yet.</div>
      return (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 4 }}>📝 Practice Quiz</div>
          {questions.map((q, qi) => (
            <div key={qi} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
              {q.opts && q.opts.map((opt, oi) => (
                <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400 }}>
                  {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? ' ✓' : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    return <div style={{ padding: 20, color: '#94A3B8' }}>No content available.</div>
  }

  // Read-only preview of a fixed rubric category's criteria (Notes/Discussion/Debate/OMR/Presentation) —
  // structure only, no live scores, since preview has no specific student.
  function renderRubricPreview(type: ScoreComponentType) {
    const cat = CASE_STUDY_RUBRIC[type]
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {cat.criteria.map(c => (
          <span key={c.key} style={{ fontSize: 10, fontWeight: 700, color: '#3D5475', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 6, padding: '4px 8px' }}>{c.label} /{c.max}</span>
        ))}
      </div>
    )
  }

  function caseStudySectionShell(icon: string, title: string, weightPct: number | null, children: React.ReactNode) {
    return (
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8' }}>{icon} {title}</div>
          {weightPct !== null && <span style={{ fontSize: 9, fontWeight: 700, color: '#7A92B0' }}>{weightPct}% of grade</span>}
        </div>
        {children}
      </div>
    )
  }

  // Preview of the fixed 7-section Case Study Assignment (structure only — no real
  // student, so scores/threads/uploads all render disabled/empty).
  function renderCaseStudyPreview() {
    if (hasMasteryBool(item.hasMastery)) {
      return (
        <div style={{ marginTop: 4, padding: '14px 16px', background: '#F7F9FC', borderRadius: 10, border: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔒</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7A92B0' }}>Case Study Assignment Locked</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Pass the mastery test first to unlock this assignment.</div>
          </div>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {caseStudySectionShell('📚', '1. Case Study', null, item.caseStudyUrl
          ? <div style={{ fontSize: 11, color: '#2D3F5E' }}><a href={item.caseStudyUrl} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontWeight: 700 }}>↗ Open case study document</a></div>
          : <div style={{ fontSize: 11, color: '#94A3B8' }}>No case study document uploaded yet.</div>
        )}
        {caseStudySectionShell('📝', '2. Notes Score', CASE_STUDY_RUBRIC.notes.weight, <>
          <div style={{ fontSize: 11, color: '#5A7290' }}>Admin scores the student's physical notes — no student view/upload here.</div>
          {renderRubricPreview('notes')}
        </>)}
        {caseStudySectionShell('💬', '3. Discussion Post', CASE_STUDY_RUBRIC.discussion.weight, <>
          <div style={{ fontSize: 11, color: '#5A7290', marginBottom: 6 }}>Student posts about the case study, then views/comments on classmates' posts.</div>
          <textarea disabled rows={2} placeholder="Student would post here… (Preview Only)" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #BFDBFE', borderRadius: 8, fontSize: 11, resize: 'none', boxSizing: 'border-box', background: '#F7FBFF', color: '#94A3B8', fontFamily: 'inherit' }} />
          {renderRubricPreview('discussion')}
        </>)}
        {caseStudySectionShell('⚖️', '4. Socratic Debate Score', CASE_STUDY_RUBRIC.debate.weight, renderRubricPreview('debate'))}
        {caseStudySectionShell('🔢', '5. OMR Test Score', CASE_STUDY_RUBRIC.omr.weight, renderRubricPreview('omr'))}
        {caseStudySectionShell('📤', '6. Presentation Upload', null, <>
          <div style={{ fontSize: 11, color: '#5A7290', marginBottom: 6 }}>Student uploads their presentation file here.</div>
          <div style={{ padding: '9px 12px', borderRadius: 8, border: '2px dashed #BFDBFE', background: '#F7FBFF', fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>+ Choose file (Preview Only)</div>
        </>)}
        {caseStudySectionShell('🏆', '7. Presentation Score', CASE_STUDY_RUBRIC.presentation.weight, renderRubricPreview('presentation'))}
      </div>
    )
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, margin: '0 auto', boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'linear-gradient(135deg,#059669,#047857)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>{item.type}{item.estimatedMins ? ` · ${item.estimatedMins} min` : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,.2)', color: '#fff', padding: '3px 10px', borderRadius: 6 }}>👁 Teacher Preview</span>
            <button onClick={onClose} style={{ padding: '4px 12px', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Metadata bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.lessonSubType && <span style={{ fontSize: 10, fontWeight: 700, background: '#F0F4FA', color: '#1A365E', padding: '3px 9px', borderRadius: 5 }}>{item.lessonSubType}</span>}
            {item.unitTitle && <span style={{ fontSize: 10, color: '#7A92B0' }}>📂 {item.unitTitle}</span>}
          </div>

          {/* Content area */}
          <div style={{ background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F0F4FA', background: '#F7F9FC' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{contentTypeLabels[item.type] ?? '📄 Content'}</span>
              <span style={{ padding: '4px 10px', background: '#EEF3FF', color: '#1A365E', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>⛶ Fullscreen</span>
            </div>
            {renderContent()}
          </div>

          {/* Mark as complete (preview - disabled) */}
          {!hasMasteryBool(item.hasMastery) && (
            <button disabled style={{ padding: 12, background: '#D1FAE5', color: '#6EE7B7', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'not-allowed', width: '100%' }}>✅ Mark as Complete (Preview)</button>
          )}

          {/* Mastery test section */}
          {hasMasteryBool(item.hasMastery) && (
            <div style={{ background: '#fff', border: '1px solid #E4EAF2', borderRadius: 13, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 4 }}>🎯 Mastery Test</div>
              <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 12 }}>Pass with {passMark}% to unlock the next lesson · {maxRetakes} attempt{maxRetakes !== 1 ? 's' : ''} max</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#92400E', marginBottom: item.masteryBrief ? 12 : 4 }}>
                {item.masteryTimeLimit && <span style={{ background: '#FFF7ED', padding: '3px 8px', borderRadius: 5 }}>⏱ {item.masteryTimeLimit} min limit</span>}
                {(item.masteryShuffleQuestions === true || item.masteryShuffleQuestions === 'TRUE') && <span style={{ background: '#FFF7ED', padding: '3px 8px', borderRadius: 5 }}>🔀 Shuffle On</span>}
              </div>
              {item.masteryBrief && (
                <div style={{ background: '#EEF3FF', border: '1px solid #C4D4E8', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1A365E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📋</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1A365E', textTransform: 'uppercase', letterSpacing: 0.5 }}>Assessment Brief</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#2D3F5E', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.masteryBrief}</div>
                </div>
              )}
              {masteryQuestions.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                    {masteryQuestions.map((q, qi) => (
                      <div key={qi} style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E4EAF2' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', marginBottom: 8 }}>{qi + 1}. {q.q}</div>
                        {q.opts && q.opts.map((opt, oi) => (
                          <div key={oi} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 6, background: oi === q.ans ? '#DCFCE7' : '#fff', border: `1px solid ${oi === q.ans ? '#86EFAC' : '#E4EAF2'}`, fontSize: 11, color: oi === q.ans ? '#15803D' : '#3D5475', fontWeight: oi === q.ans ? 700 : 400 }}>
                            {String.fromCharCode(65 + oi)}. {opt}{oi === q.ans ? ' ✓' : ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <button disabled style={{ padding: 10, background: '#C7D2FE', color: '#6366F1', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'not-allowed', width: '100%' }}>Submit Mastery Test ({masteryQuestions.length} question{masteryQuestions.length !== 1 ? 's' : ''}) — Preview Only</button>
                </>
              ) : (
                <div style={{ padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E' }}>⚠️ No mastery questions configured yet.</div>
              )}
            </div>
          )}

          {/* Case Study Assignment — fixed 7-section preview */}
          {hasAssignBool(item.hasAssignment) && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 8 }}>📚 Case Study Assignment</div>
              {renderCaseStudyPreview()}
            </div>
          )}

          {/* Private notepad */}
          <div style={{ background: '#FFFBEA', border: '1px solid #FDE68A', borderRadius: 13, overflow: 'hidden' }}>
            <button onClick={() => setNoteOpen(p => !p)} style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: '#92400E', textAlign: 'left' }}>
              <span style={{ fontSize: 16 }}>📝</span>
              My Notes
              <span style={{ fontSize: 10, fontWeight: 400, color: '#B45309', marginLeft: 'auto' }}>Private — only you can see these</span>
              <span style={{ color: '#B45309' }}>{noteOpen ? '▼' : '▶'}</span>
            </button>
            {noteOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <textarea
                  rows={5}
                  placeholder="Jot your thoughts, questions, or key takeaways here…"
                  value={noteText}
                  onChange={e => {
                    setNoteText(e.target.value)
                    try { localStorage.setItem(noteKey, e.target.value) } catch { /* empty */ }
                  }}
                  style={{ width: '100%', padding: 10, border: '1.5px solid #FDE68A', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#fff', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#B45309' }}>Auto-saved as you type</span>
                  <button onClick={() => { setNoteText(''); try { localStorage.removeItem(noteKey) } catch { /* empty */ } }} style={{ padding: '4px 10px', background: '#FFF0F1', color: '#D61F31', border: '1px solid #FFD0D3', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
