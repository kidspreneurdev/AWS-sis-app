import { useState } from 'react'
import type { AssessmentInstructionsData, AICategory } from '@/types/assessmentInstructions'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const area: React.CSSProperties = { ...inp, minHeight: 60, resize: 'vertical' }
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

export function AssessmentInstructionsForm({
  initial, saving, onClose, onSave,
}: {
  initial: AssessmentInstructionsData
  saving: boolean
  onClose: () => void
  onSave: (data: AssessmentInstructionsData) => void
}) {
  const [d, setD] = useState<AssessmentInstructionsData>(initial)
  const set = <K extends keyof AssessmentInstructionsData>(k: K, v: AssessmentInstructionsData[K]) => setD(prev => ({ ...prev, [k]: v }))
  const updCat = (i: number, patch: Partial<AICategory>) =>
    set('categories', d.categories.map((c, j) => j === i ? { ...c, ...patch } : c))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Assessment Instructions — Details</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={sectionTitle}>Header</div>
          <Field labelText="Document title (optional)" value={d.title} onChange={v => set('title', v)} />
          <Field labelText="Subtitle (optional)" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field labelText="Student Name" value={d.studentName} onChange={v => set('studentName', v)} />
            <Field labelText="Student ID" value={d.studentIdCode} onChange={v => set('studentIdCode', v)} />
            <Field labelText="First name (used in the greeting)" value={d.firstName} onChange={v => set('firstName', v)} />
          </div>

          <div style={sectionTitle}>Greeting & Intro</div>
          <Field labelText="Greeting line" value={d.greetingLine} onChange={v => set('greetingLine', v)} />
          <Field labelText="Intro paragraph" value={d.introParagraph} onChange={v => set('introParagraph', v)} textarea />

          <div style={sectionTitle}>Procedure</div>
          <Field labelText="Heading" value={d.procedureHeading} onChange={v => set('procedureHeading', v)} />
          {d.procedureSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'start' }}>
              <span style={{ fontSize: 12, color: '#7A92B0', paddingTop: 8, minWidth: 18, textAlign: 'right' }}>{i + 1}.</span>
              <textarea style={{ ...area, minHeight: 46 }} value={step} onChange={e => set('procedureSteps', d.procedureSteps.map((x, j) => j === i ? e.target.value : x))} />
              <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => set('procedureSteps', d.procedureSteps.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button style={smallBtn} onClick={() => set('procedureSteps', [...d.procedureSteps, ''])}>+ Add step</button>

          <div style={sectionTitle}>Assessment Categories</div>
          <Field labelText="Heading" value={d.categoriesHeading} onChange={v => set('categoriesHeading', v)} />
          {d.categories.map((c, i) => (
            <div key={i} style={rowWrap}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <div>
                  <label style={label}>Title</label>
                  <input style={{ ...inp, marginBottom: 6 }} value={c.title} onChange={e => updCat(i, { title: e.target.value })} />
                  <label style={label}>Body</label>
                  <textarea style={{ ...area, minHeight: 56 }} value={c.body} onChange={e => updCat(i, { body: e.target.value })} />
                </div>
                <button style={{ ...smallBtn, alignSelf: 'start' }} onClick={() => set('categories', d.categories.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
          <button style={smallBtn} onClick={() => set('categories', [...d.categories, { title: '', body: '' } as AICategory])}>+ Add category</button>
          <div style={{ marginTop: 10 }}>
            <Field labelText="Browser warning (bold paragraph)" value={d.browserWarning} onChange={v => set('browserWarning', v)} textarea />
          </div>

          <div style={sectionTitle}>Bodhi Login</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field labelText="User ID" value={d.loginId} onChange={v => set('loginId', v)} />
            <Field labelText="Password" value={d.password} onChange={v => set('password', v)} />
            <Field labelText="Status" value={d.status} onChange={v => set('status', v)} />
          </div>

          <div style={sectionTitle}>Note & Sign-off</div>
          <Field labelText="Note heading" value={d.noteHeading} onChange={v => set('noteHeading', v)} />
          <Field labelText="Note paragraph" value={d.noteParagraph} onChange={v => set('noteParagraph', v)} textarea />
          <Field labelText="Help line (bold)" value={d.helpLine} onChange={v => set('helpLine', v)} />
          <Field labelText="Sign-off (one line per row)" value={d.signOff} onChange={v => set('signOff', v)} textarea />
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
