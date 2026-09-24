import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/uploadFile'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { useCohorts } from '@/hooks/useCohorts'
import { GRADES } from '@/types/student'
import { StudentMultiCombobox } from '@/components/shared/StudentMultiCombobox'
import type { AudienceType, Notification, NotificationAttachment } from '@/types/notification'
import { Paperclip, X } from 'lucide-react'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#7A92B0', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }

const AUDIENCE_OPTIONS: { key: AudienceType; label: string }[] = [
  { key: 'students', label: 'Specific Students' },
  { key: 'grade', label: 'Grade' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'all', label: 'All Students' },
]

interface RosterStudent { id: string; fullName: string; grade: string; cohort: string }

async function fetchEnrolledStudents(): Promise<RosterStudent[]> {
  const { data } = await supabase.from('students').select('id,first_name,last_name,grade,cohort').eq('status', 'Enrolled').order('last_name')
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: `${(r.first_name as string) ?? ''} ${(r.last_name as string) ?? ''}`.trim(),
    grade: String(r.grade ?? ''),
    cohort: (r.cohort as string) ?? '',
  }))
}

// ── ComposeModal ──────────────────────────────────────────────────────────────
function ComposeModal({ students, cohorts, onClose, onSent }: {
  students: RosterStudent[]
  cohorts: string[]
  onClose: () => void
  onSent: () => void
}) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [audienceType, setAudienceType] = useState<AudienceType>('students')
  const [studentIds, setStudentIds] = useState<string[]>([])
  const [grade, setGrade] = useState(GRADES[0])
  const [cohort, setCohort] = useState(cohorts[0] ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function resolveRecipients(): RosterStudent[] {
    if (audienceType === 'students') return students.filter(s => studentIds.includes(s.id))
    if (audienceType === 'grade') return students.filter(s => s.grade === grade)
    if (audienceType === 'cohort') return students.filter(s => s.cohort === cohort)
    return students
  }

  function audienceLabel(recipients: RosterStudent[]): string {
    if (audienceType === 'grade') return `Grade ${grade}`
    if (audienceType === 'cohort') return `${cohort} Cohort`
    if (audienceType === 'all') return 'All Students'
    return `${recipients.length} student${recipients.length !== 1 ? 's' : ''}`
  }

  async function handleSend() {
    if (!subject.trim() || !content.trim()) { setError('Subject and content are required.'); return }
    const recipients = resolveRecipients()
    if (recipients.length === 0) { setError('No students match this audience.'); return }

    setSending(true)
    setError('')
    try {
      const notificationId = crypto.randomUUID()

      const attachments: NotificationAttachment[] = []
      for (const file of files) {
        const url = await uploadFile(`notifications/${notificationId}/${Date.now()}_${file.name}`, file)
        attachments.push({ url, name: file.name })
      }

      const { data: user } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('notifications').insert({
        id: notificationId,
        subject: subject.trim(),
        content: content.trim(),
        attachments,
        audience_type: audienceType,
        audience_label: audienceLabel(recipients),
        sent_by: user.user?.id ?? null,
      })
      if (insertError) throw new Error(insertError.message)

      const CHUNK = 500
      for (let i = 0; i < recipients.length; i += CHUNK) {
        const batch = recipients.slice(i, i + CHUNK).map(s => ({ notification_id: notificationId, student_id: s.id }))
        const { error: recipError } = await supabase.from('notification_recipients').insert(batch)
        if (recipError) throw new Error(recipError.message)
      }

      onSent()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification.')
    } finally {
      setSending(false)
    }
  }

  const recipientCount = resolveRecipients().length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 640, boxShadow: '0 24px 60px rgba(0,0,0,.3)', margin: 'auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 22px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>📣 New Notification</div>
          <button onClick={onClose} style={{ padding: '4px 12px', background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          <div><label style={lbl}>Subject *</label><input value={subject} onChange={e => setSubject(e.target.value)} style={inp} placeholder="e.g. Report cards now available" /></div>

          <div><label style={lbl}>Message *</label><textarea value={content} onChange={e => setContent(e.target.value)} rows={6} style={{ ...inp, resize: 'vertical' }} placeholder="Write your message…" /></div>

          <div>
            <label style={lbl}>Attachments</label>
            <label
              htmlFor="notif-attach-input"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid #E4EAF2',
                background: '#F7F9FC', color: '#1A365E', fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Paperclip size={13} /> Add Files
            </label>
            <input
              id="notif-attach-input"
              type="file"
              multiple
              onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = '' }}
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {files.map((f, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#F0F4FA', borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#1A365E' }}>
                    <Paperclip size={11} /> {f.name}
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: '#7A92B0' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Send To</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAudienceType(opt.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: audienceType === opt.key ? '1.5px solid #1A365E' : '1.5px solid #E4EAF2',
                    background: audienceType === opt.key ? '#1A365E' : '#fff',
                    color: audienceType === opt.key ? '#fff' : '#3D5475',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {audienceType === 'students' && (
              <StudentMultiCombobox
                students={students}
                values={studentIds}
                onChange={setStudentIds}
                getLabel={s => s.fullName}
                getMeta={s => s.grade ? `Grade ${s.grade}` : undefined}
                placeholder="Search students…"
              />
            )}
            {audienceType === 'grade' && (
              <select value={grade} onChange={e => setGrade(e.target.value)} style={inp}>
                {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            )}
            {audienceType === 'cohort' && (
              <select value={cohort} onChange={e => setCohort(e.target.value)} style={inp}>
                {cohorts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 8 }}>
              {audienceType === 'all'
                ? `Sends to all ${students.length} enrolled students.`
                : `${recipientCount} student${recipientCount !== 1 ? 's' : ''} will receive this notification.`}
            </div>
          </div>

          {error && <div style={{ padding: '8px 12px', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#F0F4FA', color: '#1A365E', border: '1.5px solid #DDE6F0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '8px 20px', background: '#D61F31', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending…' : '📤 Send Notification'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function StudentNotificationsPage() {
  const cohorts = useCohorts()
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [composeOpen, setComposeOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [studentRows, { data: notifRows }] = await Promise.all([
      fetchEnrolledStudents(),
      supabase.from('notifications').select('*').order('sent_at', { ascending: false }),
    ])
    setStudents(studentRows)

    const ids = (notifRows ?? []).map((r: Record<string, unknown>) => r.id as string)
    const countsByNotif: Record<string, { total: number; read: number }> = {}
    if (ids.length > 0) {
      const { data: recipRows } = await supabase.from('notification_recipients').select('notification_id,read').in('notification_id', ids)
      for (const r of recipRows ?? []) {
        const nid = r.notification_id as string
        if (!countsByNotif[nid]) countsByNotif[nid] = { total: 0, read: 0 }
        countsByNotif[nid].total += 1
        if (r.read) countsByNotif[nid].read += 1
      }
    }

    setNotifications((notifRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      subject: r.subject as string,
      content: r.content as string,
      attachments: (r.attachments as NotificationAttachment[]) ?? [],
      audienceType: r.audience_type as AudienceType,
      audienceLabel: r.audience_label as string,
      sentAt: r.sent_at as string,
      recipientCount: countsByNotif[r.id as string]?.total ?? 0,
      readCount: countsByNotif[r.id as string]?.read ?? 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const headerPortal = useHeaderActions(
    <button onClick={() => setComposeOpen(true)} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ New Notification</button>
  )

  return (
    <>{headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
        ) : notifications.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#7A92B0' }}>
            <div style={{ fontSize: 36 }}>📣</div>
            <div style={{ fontWeight: 700, marginTop: 8 }}>No notifications sent yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Compose your first notification above.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map(n => (
              <div key={n.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>{n.subject}</div>
                    <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>{n.content}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1A365E' }}>{n.readCount}/{n.recipientCount} read</div>
                    <div style={{ fontSize: 10, color: '#9AACC4', marginTop: 2 }}>{new Date(n.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#EEF3FF', color: '#1A365E' }}>{n.audienceLabel}</span>
                  {n.attachments.length > 0 && (
                    <span style={{ fontSize: 11, color: '#7A92B0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Paperclip size={11} /> {n.attachments.length} attachment{n.attachments.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {composeOpen && (
        <ComposeModal
          students={students}
          cohorts={cohorts}
          onClose={() => setComposeOpen(false)}
          onSent={() => void load()}
        />
      )}
    </>
  )
}
