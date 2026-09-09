import { useState } from 'react'
import type {
  CourseConfirmationData, CCStep, CCCourseRow, CCAuditRow, CCNote, CCContact,
} from '@/types/courseConfirmation'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const area: React.CSSProperties = { ...inp, minHeight: 70, resize: 'vertical' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#1A365E', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid #E4EAF2' }
const smallBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const rowWrap: React.CSSProperties = { border: '1px solid #EEF2F7', borderRadius: 8, padding: 10, marginBottom: 8, background: '#FAFBFD' }

function Field({ labelText, value, onChange, textarea }: { labelText: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={label}>{labelText}</label>
      {textarea
        ? <textarea style={area} value={value} onChange={e => onChange(e.target.value)} />
        : <input style={inp} value={value} onChange={e => onChange(e.target.value)} />}
    </div>
  )
}

export function CourseConfirmationForm({
  initial, saving, onClose, onSave,
}: {
  initial: CourseConfirmationData
  saving: boolean
  onClose: () => void
  onSave: (data: CourseConfirmationData) => void
}) {
  const [d, setD] = useState<CourseConfirmationData>(initial)
  const set = <K extends keyof CourseConfirmationData>(k: K, v: CourseConfirmationData[K]) => setD(prev => ({ ...prev, [k]: v }))

  function updateList<T extends object>(key: keyof CourseConfirmationData, idx: number, patch: Partial<T>) {
    setD(prev => {
      const list = [...(prev[key] as unknown as T[])]
      list[idx] = { ...list[idx], ...patch }
      return { ...prev, [key]: list }
    })
  }
  function addRow<T extends object>(key: keyof CourseConfirmationData, blank: T) {
    setD(prev => ({ ...prev, [key]: [...(prev[key] as unknown as T[]), blank] }))
  }
  function removeRow(key: keyof CourseConfirmationData, idx: number) {
    setD(prev => ({ ...prev, [key]: (prev[key] as unknown as unknown[]).filter((_, i) => i !== idx) }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Course Confirmation — Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Header */}
          <div style={sectionTitle}>Header</div>
          <Field labelText="Document Title" value={d.title} onChange={v => set('title', v)} />
          <Field labelText="Subtitle" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field labelText="Student Name" value={d.studentName} onChange={v => set('studentName', v)} />
            <Field labelText="Student ID" value={d.studentIdCode} onChange={v => set('studentIdCode', v)} />
            <Field labelText="Grade Level" value={d.gradeLevel} onChange={v => set('gradeLevel', v)} />
            <Field labelText="Academic Year" value={d.academicYear} onChange={v => set('academicYear', v)} />
            <Field labelText="First name (used in prose)" value={d.firstName} onChange={v => set('firstName', v)} />
          </div>

          {/* Intro */}
          <div style={sectionTitle}>Introduction</div>
          <Field labelText="Intro paragraph" value={d.introParagraph} onChange={v => set('introParagraph', v)} textarea />

          {/* Steps */}
          <div style={sectionTitle}>Steps Completed</div>
          {d.steps.map((s, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={label}>Step</label><input style={inp} value={s.label} onChange={e => updateList<CCStep>('steps', i, { label: e.target.value })} /></div>
                <div><label style={label}>Detail</label><input style={inp} value={s.detail} onChange={e => updateList<CCStep>('steps', i, { detail: e.target.value })} /></div>
                <button style={smallBtn} onClick={() => removeRow('steps', i)}>Remove</button>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => addRow<CCStep>('steps', { label: '', detail: '' })}>+ Add step</button>
          <div style={{ marginTop: 10 }}>
            <Field labelText="Footnote after steps" value={d.stepsFootnote} onChange={v => set('stepsFootnote', v)} textarea />
          </div>

          {/* Courses */}
          <div style={sectionTitle}>Confirmed Courses</div>
          <Field labelText="Intro line" value={d.coursesIntro} onChange={v => set('coursesIntro', v)} />
          {d.courses.map((c, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.6fr 0.9fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={label}>Course</label><input style={inp} value={c.course} onChange={e => updateList<CCCourseRow>('courses', i, { course: e.target.value })} /></div>
                <div><label style={label}>Subject Area</label><input style={inp} value={c.subjectArea} onChange={e => updateList<CCCourseRow>('courses', i, { subjectArea: e.target.value })} /></div>
                <div><label style={label}>Credit</label><input style={inp} value={c.creditValue} onChange={e => updateList<CCCourseRow>('courses', i, { creditValue: e.target.value })} /></div>
                <div><label style={label}>Duration</label><input style={inp} value={c.duration} onChange={e => updateList<CCCourseRow>('courses', i, { duration: e.target.value })} /></div>
                <button style={smallBtn} onClick={() => removeRow('courses', i)}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'end', marginTop: 6 }}>
            <button style={smallBtn} onClick={() => addRow<CCCourseRow>('courses', { course: '', subjectArea: '', creditValue: '', duration: 'Full Year' })}>+ Add course</button>
            <div style={{ width: 140 }}><label style={label}>Total credits</label><input style={inp} value={d.totalCredits} onChange={e => set('totalCredits', e.target.value)} /></div>
          </div>

          {/* Graduation progress */}
          <div style={sectionTitle}>Graduation Progress</div>
          <Field labelText="Section heading" value={d.gradProgressHeading} onChange={v => set('gradProgressHeading', v)} />
          <Field labelText="Paragraph" value={d.gradProgressParagraph} onChange={v => set('gradProgressParagraph', v)} textarea />
          <Field labelText="Line before the audit table" value={d.auditIntro} onChange={v => set('auditIntro', v)} />
          {d.auditRows.map((r, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 0.7fr 0.8fr 1fr auto', gap: 6, alignItems: 'end' }}>
                <div><label style={label}>Subject</label><input style={inp} value={r.subjectArea} onChange={e => updateList<CCAuditRow>('auditRows', i, { subjectArea: e.target.value })} /></div>
                <div><label style={label}>Req.</label><input style={inp} value={r.required} onChange={e => updateList<CCAuditRow>('auditRows', i, { required: e.target.value })} /></div>
                <div><label style={label}>Prior</label><input style={inp} value={r.earnedPrior} onChange={e => updateList<CCAuditRow>('auditRows', i, { earnedPrior: e.target.value })} /></div>
                <div><label style={label}>Added</label><input style={inp} value={r.addedThisYear} onChange={e => updateList<CCAuditRow>('auditRows', i, { addedThisYear: e.target.value })} /></div>
                <div><label style={label}>Status</label><input style={inp} value={r.status} onChange={e => updateList<CCAuditRow>('auditRows', i, { status: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ ...label, marginBottom: 0 }} title="Highlight row">HL</label>
                  <input type="checkbox" checked={r.highlight} onChange={e => updateList<CCAuditRow>('auditRows', i, { highlight: e.target.checked })} />
                  <button style={{ ...smallBtn, padding: '2px 6px' }} onClick={() => removeRow('auditRows', i)}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => addRow<CCAuditRow>('auditRows', { subjectArea: '', required: '', earnedPrior: '', addedThisYear: '', status: '', highlight: false })}>+ Add subject row</button>

          {/* Scheduling notes */}
          <div style={sectionTitle}>Scheduling Notes (bullets)</div>
          {d.schedulingNotes.map((n, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <div>
                  <label style={label}>Title</label>
                  <input style={{ ...inp, marginBottom: 6 }} value={n.title} onChange={e => updateList<CCNote>('schedulingNotes', i, { title: e.target.value })} />
                  <label style={label}>Body</label>
                  <textarea style={{ ...area, minHeight: 52 }} value={n.body} onChange={e => updateList<CCNote>('schedulingNotes', i, { body: e.target.value })} />
                </div>
                <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => removeRow('schedulingNotes', i)}>✕</button>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => addRow<CCNote>('schedulingNotes', { title: '', body: '' })}>+ Add note</button>

          {/* Next steps */}
          <div style={sectionTitle}>Next Steps</div>
          {d.nextSteps.map((n, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <div>
                  <label style={label}>Title</label>
                  <input style={{ ...inp, marginBottom: 6 }} value={n.title} onChange={e => updateList<CCNote>('nextSteps', i, { title: e.target.value })} />
                  <label style={label}>Body</label>
                  <textarea style={{ ...area, minHeight: 52 }} value={n.body} onChange={e => updateList<CCNote>('nextSteps', i, { body: e.target.value })} />
                </div>
                <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => removeRow('nextSteps', i)}>✕</button>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => addRow<CCNote>('nextSteps', { title: '', body: '' })}>+ Add step</button>

          {/* Family confirmation */}
          <div style={sectionTitle}>Family Confirmation</div>
          <Field labelText="Confirmation text" value={d.familyConfirmationText} onChange={v => set('familyConfirmationText', v)} textarea />

          {/* Contact */}
          <div style={sectionTitle}>Contact Information</div>
          <Field labelText="Intro line" value={d.contactsIntro} onChange={v => set('contactsIntro', v)} />
          {d.contacts.map((c, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={label}>Name</label><input style={inp} value={c.name} onChange={e => updateList<CCContact>('contacts', i, { name: e.target.value })} /></div>
                <div><label style={label}>Role</label><input style={inp} value={c.role} onChange={e => updateList<CCContact>('contacts', i, { role: e.target.value })} /></div>
                <button style={smallBtn} onClick={() => removeRow('contacts', i)}>✕</button>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Email</label><input style={inp} value={c.email} onChange={e => updateList<CCContact>('contacts', i, { email: e.target.value })} /></div>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => addRow<CCContact>('contacts', { name: '', role: '', email: '' })}>+ Add contact</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <Field labelText="Issued date" value={d.issuedDate} onChange={v => set('issuedDate', v)} />
            <Field labelText="Disclaimer" value={d.disclaimer} onChange={v => set('disclaimer', v)} />
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...smallBtn, padding: '8px 18px' }}>Cancel</button>
          <button
            onClick={() => onSave(d)}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save & Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
