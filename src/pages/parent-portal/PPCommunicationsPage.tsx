import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParentPortal } from '@/contexts/ParentPortalContext'

interface CommRecord {
  id: string
  type: string
  subject: string
  body: string | null
  sentBy: string | null
  sentAt: string
  direction: 'from_school' | 'from_parent'
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,.06)',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #E4EAF2', fontSize: 13, color: '#1A365E',
  background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
}

const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#3D5475',
  textTransform: 'uppercase', letterSpacing: '.7px',
  display: 'block', marginBottom: 4,
}

export function PPCommunicationsPage() {
  const { session, activeChild } = useParentPortal()
  const [comms, setComms] = useState<CommRecord[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function load() {
    if (!activeChild) return
    const { data } = await supabase
      .from('communications')
      .select('*')
      .eq('student_id', activeChild.dbId)
      .order('sent_at', { ascending: false })
    if (data) {
      setComms((data as Record<string, unknown>[]).map(r => ({
        id: r.id as string,
        type: (r.type as string) ?? 'Message',
        subject: (r.subject as string) ?? '',
        body: (r.body as string) ?? null,
        sentBy: (r.sent_by as string) ?? null,
        sentAt: (r.sent_at as string) ?? '',
        direction: (r.direction as string) === 'from_parent' ? 'from_parent' : 'from_school',
      })))
    }
  }

  useEffect(() => { void load() }, [activeChild?.dbId])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim() || !activeChild || !session) return
    setSending(true)
    await supabase.from('communications').insert({
      student_id: activeChild.dbId,
      type: 'Message',
      subject: subject.trim(),
      body: body.trim(),
      sent_by: session.parentName,
      direction: 'from_parent',
    })
    setSending(false)
    setSent(true)
    setSubject('')
    setBody('')
    void load()
    setTimeout(() => setSent(false), 3000)
  }

  function fmtDate(d: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#6B21A8' }}>💬 Messages</div>
        <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
          {activeChild ? `Communications for ${activeChild.fullName}` : 'Select a child to view messages'}
        </div>
      </div>

      {/* Compose */}
      <div style={{ ...card, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B21A8', marginBottom: 14 }}>✏️ Send a Message to School</div>
        <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={lbl}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} placeholder="e.g. Absence notice, Question about grades…" required />
          </div>
          <div>
            <label style={lbl}>Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ ...inp, minHeight: 100, resize: 'vertical' }}
              placeholder="Write your message here…"
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="submit"
              disabled={sending || !activeChild}
              style={{
                padding: '9px 24px', background: sending ? '#aaa' : '#6B21A8',
                color: '#fff', border: 'none', borderRadius: 9, fontSize: 13,
                fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {sending ? 'Sending…' : '📨 Send Message'}
            </button>
            {sent && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Message sent!</span>}
          </div>
        </form>
      </div>

      {/* History */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', fontSize: 12, fontWeight: 700, color: '#1A365E' }}>
          📋 Communication History ({comms.length})
        </div>
        {comms.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No communications yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {comms.map(c => {
              const isParent = c.direction === 'from_parent'
              return (
                <div key={c.id} style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #F0F4F8',
                  borderLeft: `3px solid ${isParent ? '#6B21A8' : '#0EA5E9'}`,
                  background: isParent ? '#FAF5FF' : '#F0F9FF',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{c.subject}</div>
                      {c.body && <div style={{ fontSize: 12, color: '#3D5475', marginTop: 4 }}>{c.body}</div>}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
                      background: isParent ? '#EDE9FE' : '#DBEAFE',
                      color: isParent ? '#6D28D9' : '#1E40AF',
                    }}>
                      {isParent ? '↑ From You' : '↓ From School'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 6 }}>
                    {c.sentBy ? `${c.sentBy} · ` : ''}{fmtDate(c.sentAt)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
