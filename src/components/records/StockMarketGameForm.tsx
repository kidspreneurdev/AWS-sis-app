import { useState } from 'react'
import type { StockMarketGameData } from '@/types/stockMarketGame'

const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const area: React.CSSProperties = { ...inp, minHeight: 64, resize: 'vertical' }
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#1A365E', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid #E4EAF2' }
const smallBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }

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

export function StockMarketGameForm({
  initial, saving, onClose, onSave,
}: {
  initial: StockMarketGameData
  saving: boolean
  onClose: () => void
  onSave: (data: StockMarketGameData) => void
}) {
  const [d, setD] = useState<StockMarketGameData>(initial)
  const set = <K extends keyof StockMarketGameData>(k: K, v: StockMarketGameData[K]) => setD(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Stock Market Game — Details</div>
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

          <div style={sectionTitle}>Letter</div>
          <Field labelText="Introduction paragraph" value={d.introParagraph} onChange={v => set('introParagraph', v)} textarea />
          <Field labelText="'Attaching login details' line" value={d.attachingLine} onChange={v => set('attachingLine', v)} />

          <div style={sectionTitle}>Login Credentials</div>
          <Field labelText="Credentials block heading" value={d.credentialsHeading} onChange={v => set('credentialsHeading', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field labelText="Username" value={d.username} onChange={v => set('username', v)} />
            <Field labelText="Password" value={d.password} onChange={v => set('password', v)} />
          </div>
          <Field labelText="Link to login" value={d.loginUrl} onChange={v => set('loginUrl', v)} />

          <div style={sectionTitle}>Training Videos</div>
          <Field labelText="Intro line" value={d.videosIntro} onChange={v => set('videosIntro', v)} textarea />
          <Field labelText="Videos link" value={d.videosUrl} onChange={v => set('videosUrl', v)} />

          <div style={sectionTitle}>Closing</div>
          <Field labelText="Sign-off (new line before the school name)" value={d.signOff} onChange={v => set('signOff', v)} textarea />
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
