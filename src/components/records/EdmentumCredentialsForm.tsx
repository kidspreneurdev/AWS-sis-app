import { useState } from 'react'
import type { EdmentumCredentialsData, ECNote, ECContact } from '@/types/edmentumCredentials'

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

function NoteList({ title, items, onChange }: { title: string; items: ECNote[]; onChange: (v: ECNote[]) => void }) {
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

export function EdmentumCredentialsForm({
  initial, saving, onClose, onSave,
}: {
  initial: EdmentumCredentialsData
  saving: boolean
  onClose: () => void
  onSave: (data: EdmentumCredentialsData) => void
}) {
  const [d, setD] = useState<EdmentumCredentialsData>(initial)
  const set = <K extends keyof EdmentumCredentialsData>(k: K, v: EdmentumCredentialsData[K]) => setD(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Edmentum Courseware Portal — Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={sectionTitle}>Header</div>
          <Field labelText="Document Title" value={d.title} onChange={v => set('title', v)} />
          <Field labelText="Subtitle" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field labelText="Student Name" value={d.studentName} onChange={v => set('studentName', v)} />
            <Field labelText="Student ID" value={d.studentIdCode} onChange={v => set('studentIdCode', v)} />
            <Field labelText="Grade Level" value={d.gradeLevel} onChange={v => set('gradeLevel', v)} />
            <Field labelText="First name (used in prose)" value={d.firstName} onChange={v => set('firstName', v)} />
          </div>

          <div style={sectionTitle}>Introduction</div>
          <Field labelText="Welcome paragraph" value={d.welcomeParagraph} onChange={v => set('welcomeParagraph', v)} textarea />

          <div style={sectionTitle}>Login Credentials</div>
          <Field labelText="Credentials block heading" value={d.credentialsHeading} onChange={v => set('credentialsHeading', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field labelText="Portal URL" value={d.portalUrl} onChange={v => set('portalUrl', v)} />
            <Field labelText="Account Login" value={d.accountLogin} onChange={v => set('accountLogin', v)} />
            <Field labelText="Username" value={d.username} onChange={v => set('username', v)} />
            <Field labelText="Password" value={d.password} onChange={v => set('password', v)} />
          </div>
          <Field labelText="Security note (italic)" value={d.securityNote} onChange={v => set('securityNote', v)} textarea />

          <Field labelText="'Logging in for the first time' heading" value={d.firstTimeHeading} onChange={v => set('firstTimeHeading', v)} />
          <NoteList title="First-time steps (numbered)" items={d.firstTimeSteps} onChange={v => set('firstTimeSteps', v)} />

          <div style={{ marginTop: 10 }}>
            <Field labelText="'What to do next' heading" value={d.nextStepsHeading} onChange={v => set('nextStepsHeading', v)} />
          </div>
          <NoteList title="Next steps (bullets)" items={d.nextSteps} onChange={v => set('nextSteps', v)} />

          <div style={sectionTitle}>Trouble Logging In</div>
          <Field labelText="Heading" value={d.troubleHeading} onChange={v => set('troubleHeading', v)} />
          <Field labelText="Paragraph" value={d.troubleParagraph} onChange={v => set('troubleParagraph', v)} textarea />

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
          <button style={smallBtn} onClick={() => set('contacts', [...d.contacts, { name: '', role: '', email: '' } as ECContact])}>+ Add contact</button>
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
