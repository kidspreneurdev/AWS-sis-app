import { useState } from 'react'
import type {
  WeeklyScheduleData, WSNote, WSContact, WSScheduleRow, WSCreditRow,
} from '@/types/weeklySchedule'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const area: React.CSSProperties = { ...inp, minHeight: 64, resize: 'vertical' }
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

function NoteList({ title, items, onChange }: { title: string; items: WSNote[]; onChange: (v: WSNote[]) => void }) {
  return (
    <div>
      <div style={sectionTitle}>{title}</div>
      {items.map((n, i) => (
        <div key={i} style={rowWrap}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div>
              <label style={label}>Title</label>
              <input style={{ ...inp, marginBottom: 6 }} value={n.title} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
              <label style={label}>Body</label>
              <textarea style={{ ...area, minHeight: 50 }} value={n.body} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
            </div>
            <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button style={smallBtn} onClick={() => onChange([...items, { title: '', body: '' }])}>+ Add</button>
    </div>
  )
}

export function WeeklyScheduleForm({
  initial, saving, onClose, onSave,
}: {
  initial: WeeklyScheduleData
  saving: boolean
  onClose: () => void
  onSave: (data: WeeklyScheduleData) => void
}) {
  const [d, setD] = useState<WeeklyScheduleData>(initial)
  const set = <K extends keyof WeeklyScheduleData>(k: K, v: WeeklyScheduleData[K]) => setD(prev => ({ ...prev, [k]: v }))

  const updSchedule = (i: number, patch: Partial<WSScheduleRow>) =>
    set('scheduleRows', d.scheduleRows.map((r, j) => j === i ? { ...r, ...patch } : r))
  const updCredit = (i: number, patch: Partial<WSCreditRow>) =>
    set('creditRows', d.creditRows.map((r, j) => j === i ? { ...r, ...patch } : r))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Weekly Schedule — Details</div>
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

          {/* Credit hours methodology */}
          <div style={sectionTitle}>How Credit Hours Are Calculated</div>
          <Field labelText="Heading" value={d.creditHoursHeading} onChange={v => set('creditHoursHeading', v)} />
          <Field labelText="Intro line" value={d.creditHoursIntro} onChange={v => set('creditHoursIntro', v)} textarea />
          <NoteList title="Learning-time parts" items={d.creditParts} onChange={v => set('creditParts', v)} />
          <div style={{ marginTop: 10 }}>
            <Field labelText="Line before the credit tiers" value={d.creditFillIntro} onChange={v => set('creditFillIntro', v)} textarea />
          </div>
          <NoteList title="Credit tiers" items={d.creditTiers} onChange={v => set('creditTiers', v)} />
          <div style={{ marginTop: 10 }}>
            <Field labelText="Term-length note (italic)" value={d.termLengthNote} onChange={v => set('termLengthNote', v)} textarea />
          </div>

          {/* Weekly schedule */}
          <div style={sectionTitle}>Weekly Schedule</div>
          <Field labelText="Section heading" value={d.scheduleHeading} onChange={v => set('scheduleHeading', v)} />
          {d.scheduleParagraphs.map((para, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <textarea style={{ ...area, minHeight: 50 }} value={para} onChange={e => set('scheduleParagraphs', d.scheduleParagraphs.map((x, j) => j === i ? e.target.value : x))} />
              <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => set('scheduleParagraphs', d.scheduleParagraphs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={smallBtn} onClick={() => set('scheduleParagraphs', [...d.scheduleParagraphs, ''])}>+ Add paragraph</button>

          <div style={{ ...sectionTitle, fontSize: 12, marginTop: 14 }}>Schedule rows</div>
          {d.scheduleRows.map((r, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.1fr 1.4fr 1fr 0.9fr auto', gap: 6, alignItems: 'end' }}>
                <div><label style={label}>Day</label><input style={inp} value={r.day} onChange={e => updSchedule(i, { day: e.target.value })} /></div>
                <div><label style={label}>Time</label><input style={inp} value={r.time} onChange={e => updSchedule(i, { time: e.target.value })} /></div>
                <div><label style={label}>Subject</label><input style={inp} value={r.subject} onChange={e => updSchedule(i, { subject: e.target.value })} /></div>
                <div><label style={label}>Teacher</label><input style={inp} value={r.teacher} onChange={e => updSchedule(i, { teacher: e.target.value })} /></div>
                <div><label style={label}>Term</label><input style={inp} value={r.activeTerm} onChange={e => updSchedule(i, { activeTerm: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ ...label, marginBottom: 0 }} title="Highlight row">HL</label>
                  <input type="checkbox" checked={r.highlight} onChange={e => updSchedule(i, { highlight: e.target.checked })} />
                  <button style={{ ...smallBtn, padding: '2px 6px' }} onClick={() => set('scheduleRows', d.scheduleRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => set('scheduleRows', [...d.scheduleRows, { day: '', time: '', subject: '', teacher: '', activeTerm: 'Full Year', highlight: false } as WSScheduleRow])}>+ Add row</button>

          {/* Day summaries + notes */}
          <NoteList title="Day-by-day summary (bullets)" items={d.daySummaries} onChange={v => set('daySummaries', v)} />
          <div style={{ marginTop: 10 }}>
            <Field labelText="Note (italic, e.g. teacher to be confirmed)" value={d.chemistryNote} onChange={v => set('chemistryNote', v)} textarea />
          </div>
          <NoteList title="Additional notes (bullets)" items={d.extraNotes} onChange={v => set('extraNotes', v)} />

          {/* Credit hours by subject */}
          <div style={sectionTitle}>Credit Hours by Subject</div>
          <Field labelText="Heading" value={d.creditTableHeading} onChange={v => set('creditTableHeading', v)} />
          <Field labelText="Intro line" value={d.creditTableIntro} onChange={v => set('creditTableIntro', v)} textarea />
          {d.creditRows.map((r, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 6, marginBottom: 6 }}>
                <div><label style={label}>Subject</label><input style={inp} value={r.subject} onChange={e => updCredit(i, { subject: e.target.value })} /></div>
                <div><label style={label}>Term</label><input style={inp} value={r.term} onChange={e => updCredit(i, { term: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 6, alignItems: 'end' }}>
                <div><label style={label}>Live Sess.</label><input style={inp} value={r.liveSessions} onChange={e => updCredit(i, { liveSessions: e.target.value })} /></div>
                <div><label style={label}>Live Hrs</label><input style={inp} value={r.liveHours} onChange={e => updCredit(i, { liveHours: e.target.value })} /></div>
                <div><label style={label}>Self-Paced</label><input style={inp} value={r.selfPacedHours} onChange={e => updCredit(i, { selfPacedHours: e.target.value })} /></div>
                <div><label style={label}>Total Hrs</label><input style={inp} value={r.totalHours} onChange={e => updCredit(i, { totalHours: e.target.value })} /></div>
                <div><label style={label}>Credit</label><input style={inp} value={r.creditEarned} onChange={e => updCredit(i, { creditEarned: e.target.value })} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ ...label, marginBottom: 0 }}>HL</label>
                  <input type="checkbox" checked={r.highlight} onChange={e => updCredit(i, { highlight: e.target.checked })} />
                  <button style={{ ...smallBtn, padding: '2px 6px' }} onClick={() => set('creditRows', d.creditRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, alignItems: 'end', marginTop: 6 }}>
            <button style={smallBtn} onClick={() => set('creditRows', [...d.creditRows, { subject: '', term: 'Full Year', liveSessions: '', liveHours: '', selfPacedHours: '', totalHours: '', creditEarned: '', highlight: false } as WSCreditRow])}>+ Add subject</button>
            <div style={{ width: 140 }}><label style={label}>Total credits</label><input style={inp} value={d.totalCredits} onChange={e => set('totalCredits', e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field labelText="Caption below the table (italic)" value={d.creditTableCaption} onChange={v => set('creditTableCaption', v)} textarea />
          </div>

          {/* Family confirmation */}
          <div style={sectionTitle}>Family Confirmation</div>
          <Field labelText="Confirmation text" value={d.familyConfirmationText} onChange={v => set('familyConfirmationText', v)} textarea />

          {/* Contact */}
          <div style={sectionTitle}>Contact Information</div>
          <Field labelText="Intro line" value={d.contactsIntro} onChange={v => set('contactsIntro', v)} />
          {d.contacts.map((c, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={label}>Name</label><input style={inp} value={c.name} onChange={e => set('contacts', d.contacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                <div><label style={label}>Role</label><input style={inp} value={c.role} onChange={e => set('contacts', d.contacts.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} /></div>
                <button style={smallBtn} onClick={() => set('contacts', d.contacts.filter((_, j) => j !== i))}>✕</button>
                <div style={{ gridColumn: '1 / -1' }}><label style={label}>Email</label><input style={inp} value={c.email} onChange={e => set('contacts', d.contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} /></div>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => set('contacts', [...d.contacts, { name: '', role: '', email: '' } as WSContact])}>+ Add contact</button>
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
