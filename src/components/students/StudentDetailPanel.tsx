import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import {
  type Student, type StudentStatus,
  STATUSES, STATUS_META, DOCUMENT_TYPES, fullName,
} from '@/types/student'

// ── Types ─────────────────────────────────────────────────────────────────────
const PANEL_TABS = ['Info', 'Documents', 'Fees', 'Interview', 'Comms', 'Attendance'] as const
type PanelTab = typeof PANEL_TABS[number]

interface FeeRec { id: string; feeType: string; amount: number; amountPaid: number; dueDate: string | null; status: string; schoolYear: string }
interface CommRec { id: string; type: string; subject: string; outcome: string | null; date: string | null; staff: string | null; notes: string | null }
interface AttRec { date: string; status: string }

interface Props {
  student: Student | null
  onClose: () => void
  onStatusChange: (id: string, status: StudentStatus) => void
  onEdit: (s: Student) => void
  onDocumentsUpdated: (id: string, docs: string[]) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtUSD(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }) }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }

const FEE_STATUS_META: Record<string, { bg: string; tc: string }> = {
  Paid:    { bg: '#E8FBF0', tc: '#0E6B3B' },
  Partial: { bg: '#FFF6E0', tc: '#B45309' },
  Unpaid:  { bg: '#FFF0F1', tc: '#D61F31' },
  Waived:  { bg: '#F3F4F6', tc: '#7A92B0' },
}

const COMM_TYPE_ICON: Record<string, string> = {
  Email: '✉️', Call: '📞', SMS: '💬', Meeting: '🤝', Letter: '📄', Other: '📌',
}

const ATT_META: Record<string, { bg: string; tc: string; label: string }> = {
  P: { bg: '#E8FBF0', tc: '#0E6B3B', label: 'Present' },
  A: { bg: '#FFF0F1', tc: '#D61F31', label: 'Absent' },
  T: { bg: '#FFF6E0', tc: '#B45309', label: 'Tardy' },
  E: { bg: '#E6F4FF', tc: '#0369A1', label: 'Excused' },
  R: { bg: '#F3EDFF', tc: '#A36CFF', label: 'Remote' },
}

// ── Row ───────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F0F4F8' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', width: 110, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1A365E', flex: 1, wordBreak: 'break-word' }}>{value || <span style={{ color: '#C4D0DE' }}>—</span>}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function StudentDetailPanel({ student, onClose, onStatusChange, onEdit, onDocumentsUpdated }: Props) {
  const [tab, setTab] = useState<PanelTab>('Info')
  const [fees, setFees] = useState<FeeRec[]>([])
  const [comms, setComms] = useState<CommRec[]>([])
  const [attendance, setAttendance] = useState<AttRec[]>([])
  const [loadingFees, setLoadingFees] = useState(false)
  const [loadingComms, setLoadingComms] = useState(false)
  const [loadingAtt, setLoadingAtt] = useState(false)
  const [docs, setDocs] = useState<string[]>([])

  // Reset on student change
  useEffect(() => {
    if (student) {
      setTab('Info')
      setDocs(student.documents ?? [])
      setFees([]); setComms([]); setAttendance([])
    }
  }, [student?.id])

  // Lazy load per tab
  useEffect(() => {
    if (!student) return
    if (tab === 'Fees' && fees.length === 0) {
      setLoadingFees(true)
      supabase.from('fees').select('*').eq('student_id', student.id).order('due_date', { ascending: true })
        .then(({ data }) => {
          setFees((data ?? []).map((r: Record<string, unknown>) => ({
            id: r.id as string, feeType: r.fee_type as string,
            amount: Number(r.amount), amountPaid: Number(r.amount_paid ?? 0),
            dueDate: r.due_date as string | null, status: r.status as string,
            schoolYear: r.school_year as string,
          })))
          setLoadingFees(false)
        })
    }
    if (tab === 'Comms' && comms.length === 0) {
      setLoadingComms(true)
      supabase.from('communications').select('*').eq('student_id', student.id).order('sent_at', { ascending: false }).limit(20)
        .then(({ data }) => {
          setComms((data ?? []).map((r: Record<string, unknown>) => ({
            id: r.id as string, type: r.type as string,
            subject: r.subject as string ?? '', outcome: null,
            date: r.sent_at as string ?? null, staff: r.sent_by as string ?? null,
            notes: r.body as string ?? null,
          })))
          setLoadingComms(false)
        })
    }
    if (tab === 'Attendance' && attendance.length === 0) {
      setLoadingAtt(true)
      supabase.from('attendance').select('date,status').eq('student_id', student.id).order('date', { ascending: false }).limit(30)
        .then(({ data }) => {
          setAttendance((data ?? []).map((r: Record<string, unknown>) => ({ date: r.date as string, status: r.status as string })))
          setLoadingAtt(false)
        })
    }
  }, [tab, student?.id])

  function toggleDoc(doc: string) {
    if (!student) return
    const next = docs.includes(doc) ? docs.filter(d => d !== doc) : [...docs, doc]
    setDocs(next)
    onDocumentsUpdated(student.id, next)
    toast(docs.includes(doc) ? 'Document removed' : 'Document marked received', 'ok')
  }

  if (!student) return null

  const smeta = STATUS_META[student.status]
  const docPct = DOCUMENT_TYPES.length ? Math.round((docs.length / DOCUMENT_TYPES.length) * 100) : 0

  // Attendance stats (last 30)
  const attPresent = attendance.filter(a => a.status === 'P' || a.status === 'E' || a.status === 'R').length
  const attAbsent = attendance.filter(a => a.status === 'A').length
  const attTardy = attendance.filter(a => a.status === 'T').length
  const attRate = attendance.length ? Math.round((attPresent / attendance.length) * 100) : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,25,50,0.45)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, zIndex: 301,
        background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'panelSlideIn 0.22s ease',
      }}>
        <style>{`@keyframes panelSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{fullName(student)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, background: smeta.bg, color: smeta.tc, fontSize: 11, fontWeight: 700 }}>{student.status}</span>
                {student.grade !== null && <span style={{ fontSize: 12, color: '#9EB3C8' }}>Grade {student.grade}</span>}
                {student.campus && <span style={{ fontSize: 12, color: '#9EB3C8' }}>· {student.campus}</span>}
                {student.studentId && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7A94B8' }}>#{student.studentId}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10 }}>
              <button
                onClick={() => onEdit(student)}
                title="Edit full profile"
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✏️</button>
              <button
                onClick={onClose}
                style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
          </div>

          {/* Quick status change */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: '#7A94B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Change Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {STATUSES.filter(st => st !== student.status).map(st => {
                const m = STATUS_META[st]
                return (
                  <button
                    key={st}
                    onClick={() => { onStatusChange(student.id, st); toast(`Status → ${st}`, 'ok') }}
                    style={{
                      padding: '3px 10px', borderRadius: 20, border: 'none',
                      background: 'rgba(255,255,255,0.12)', color: '#E0EAFF',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = m.bg; (e.currentTarget as HTMLButtonElement).style.color = m.tc }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#E0EAFF' }}
                  >{st}</button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E4EAF2', background: '#F7F9FC', overflowX: 'auto', flexShrink: 0 }}>
          {PANEL_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '9px 14px', fontSize: 12,
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#D61F31' : '#3D5475',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid #D61F31' : '2px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{t}</button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* INFO */}
          {tab === 'Info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Personal</div>
              <InfoRow label="Date of Birth" value={fmtDate(student.dob)} />
              <InfoRow label="Gender" value={student.gender} />
              <InfoRow label="Nationality" value={student.nationality} />
              <InfoRow label="Language" value={student.lang} />
              <InfoRow label="IEP / Support" value={student.iep} />
              <InfoRow label="Blood Group" value={student.bloodGroup} />

              <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 8 }}>Academic</div>
              <InfoRow label="Student Type" value={student.studentType} />
              <InfoRow label="Applied" value={fmtDate(student.appDate)} />
              <InfoRow label="Enrolled" value={fmtDate(student.enrollDate)} />
              <InfoRow label="Cohort" value={student.cohort} />
              <InfoRow label="Prev. School" value={student.prevSchool} />
              <InfoRow label="Prior GPA" value={student.priorGpa} />
              <InfoRow label="Priority" value={student.priority} />
              {student.yearJoined && <InfoRow label="Year Joined" value={student.yearJoined} />}
              {student.yearGraduated && <InfoRow label="Year Graduated" value={student.yearGraduated} />}
              {student.gradeWhenJoined !== null && <InfoRow label="Grade (Joined)" value={student.gradeWhenJoined} />}

              <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 8 }}>Contact</div>
              <InfoRow label="Parent" value={`${student.parent ?? ''} ${student.relation ? `(${student.relation})` : ''}`.trim()} />
              <InfoRow label="Email" value={student.email ? <a href={`mailto:${student.email}`} style={{ color: '#0369A1' }}>{student.email}</a> : null} />
              <InfoRow label="Phone" value={student.phone} />
              <InfoRow label="Emerg. Contact" value={student.ecName ? `${student.ecName} ${student.ecPhone ?? ''}` : null} />
              <InfoRow label="Address" value={student.address} />

              {(student.allergy || student.meds || student.physician || student.healthNotes) && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 8 }}>Health</div>
                  <InfoRow label="Allergies" value={student.allergy} />
                  <InfoRow label="Medications" value={student.meds} />
                  <InfoRow label="Physician" value={student.physician ? `${student.physician}${student.physicianPhone ? ` · ${student.physicianPhone}` : ''}` : null} />
                  {student.healthNotes && <div style={{ fontSize: 13, color: '#4A6480', background: '#FFF6E0', borderRadius: 8, padding: '8px 12px', marginTop: 4, lineHeight: 1.5, border: '1px solid #FFE4A0' }}>{student.healthNotes}</div>}
                </>
              )}

              {student.status === 'Alumni' && (student.postSecondary || student.gradDistinction || student.alumniNotes) && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 8 }}>Alumni</div>
                  <InfoRow label="Post-Secondary" value={student.postSecondary} />
                  <InfoRow label="Distinction" value={student.gradDistinction} />
                  {student.alumniNotes && <div style={{ fontSize: 13, color: '#856404', background: '#FFFBE6', borderRadius: 8, padding: '8px 12px', marginTop: 4, lineHeight: 1.5, border: '1px solid #FAE896' }}>{student.alumniNotes}</div>}
                </>
              )}

              {(student.notes || student.counselorNotes) && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 14, marginBottom: 8 }}>Notes</div>
                  {student.notes && <div style={{ fontSize: 13, color: '#1A365E', background: '#F7F9FC', borderRadius: 8, padding: '10px 12px', marginBottom: 8, lineHeight: 1.5 }}>{student.notes}</div>}
                  {student.counselorNotes && <div style={{ fontSize: 12, color: '#7A92B0', fontStyle: 'italic', background: '#FAFBFC', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>{student.counselorNotes}</div>}
                </>
              )}
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Progress bar */}
              <div style={{ background: '#F7F9FC', borderRadius: 8, padding: '10px 14px', border: '1px solid #E4EAF2', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3D5475' }}>Documents Received</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: docPct === 100 ? '#1DBD6A' : '#F5A623' }}>{docs.length}/{DOCUMENT_TYPES.length}</span>
                </div>
                <div style={{ background: '#E4EAF2', borderRadius: 20, height: 6 }}>
                  <div style={{ height: 6, borderRadius: 20, width: `${docPct}%`, background: docPct === 100 ? '#1DBD6A' : docPct >= 50 ? '#F5A623' : '#D61F31', transition: 'width 0.3s' }} />
                </div>
              </div>
              {DOCUMENT_TYPES.map(doc => {
                const received = docs.includes(doc)
                return (
                  <button
                    key={doc}
                    onClick={() => toggleDoc(doc)}
                    title={received ? '✓ Received — click to remove' : 'Pending — click to mark received'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8,
                      border: `1px solid ${received ? '#1DBD6A' : '#E4EAF2'}`,
                      background: received ? '#E8FBF0' : '#fff',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 4,
                      border: `2px solid ${received ? '#1DBD6A' : '#CBD5E1'}`,
                      background: received ? '#1DBD6A' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 13, color: '#fff', fontWeight: 800,
                    }}>{received ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, color: received ? '#0E6B3B' : '#1A365E', fontWeight: received ? 600 : 400 }}>
                      📄 {doc}
                    </span>
                    {received && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0E6B3B', fontWeight: 700 }}>RECEIVED</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* FEES */}
          {tab === 'Fees' && (
            loadingFees ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9EB3C8' }}>Loading fees…</div>
            ) : fees.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#7A92B0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
                <div style={{ fontWeight: 600, color: '#1A365E' }}>No fee records</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Add records from the Fees page.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Summary */}
                {(() => {
                  const owed = fees.reduce((a, f) => a + f.amount, 0)
                  const paid = fees.reduce((a, f) => a + f.amountPaid, 0)
                  const bal = owed - paid
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { l: 'Owed', v: fmtUSD(owed), c: '#1A365E', bg: '#EEF3FF' },
                        { l: 'Paid', v: fmtUSD(paid), c: '#0E6B3B', bg: '#E8FBF0' },
                        { l: 'Balance', v: fmtUSD(bal), c: bal > 0 ? '#D61F31' : '#0E6B3B', bg: bal > 0 ? '#FFF0F1' : '#E8FBF0' },
                      ].map(s => (
                        <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: s.c, textTransform: 'uppercase' }}>{s.l}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {fees.map(f => {
                  const m = FEE_STATUS_META[f.status] ?? FEE_STATUS_META.Unpaid
                  return (
                    <div key={f.id} style={{ border: '1px solid #E4EAF2', borderRadius: 8, padding: '10px 14px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#1A365E', fontSize: 13 }}>{f.feeType}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 11, fontWeight: 700 }}>{f.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#7A92B0' }}>
                        <span>Amount: <strong style={{ color: '#1A365E' }}>{fmtUSD(f.amount)}</strong></span>
                        <span>Paid: <strong style={{ color: '#0E6B3B' }}>{fmtUSD(f.amountPaid)}</strong></span>
                        {f.dueDate && <span>Due: {fmtDate(f.dueDate)}</span>}
                        <span>{f.schoolYear}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* INTERVIEW */}
          {tab === 'Interview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {student.intDate ? (
                <>
                  <div style={{ background: '#F7F9FC', borderRadius: 10, padding: 14, border: '1px solid #E4EAF2' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#3D5475', marginBottom: 10 }}>Interview Details</div>
                    <InfoRow label="Date" value={fmtDate(student.intDate)} />
                    <InfoRow label="Time" value={student.intTime} />
                    <InfoRow label="Interviewer" value={student.intViewer} />
                    <InfoRow label="Committee" value={student.intCommittee} />
                    <InfoRow label="Score" value={student.intScore !== null ? (
                      <span style={{ padding: '2px 10px', borderRadius: 20, background: (student.intScore ?? 0) >= 7 ? '#E8FBF0' : (student.intScore ?? 0) >= 5 ? '#FFF6E0' : '#FFF0F1', color: (student.intScore ?? 0) >= 7 ? '#0E6B3B' : (student.intScore ?? 0) >= 5 ? '#B45309' : '#D61F31', fontWeight: 700, fontSize: 13 }}>{student.intScore}/10</span>
                    ) : null} />
                  </div>
                  {student.intNotes && (
                    <div style={{ background: '#FFFBE6', borderRadius: 8, padding: '10px 14px', border: '1px solid #FFE4A0', fontSize: 13, color: '#B45309', lineHeight: 1.5 }}>
                      <strong>Notes:</strong> {student.intNotes}
                    </div>
                  )}
                  {(student.decDate || student.decNotes) && (
                    <div style={{ borderRadius: 10, padding: 14, border: '1px solid #E4EAF2', background: '#fff' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3D5475', marginBottom: 10 }}>Decision</div>
                      <InfoRow label="Decision Date" value={fmtDate(student.decDate)} />
                      {student.decNotes && <div style={{ fontSize: 13, color: '#1A365E', marginTop: 8, lineHeight: 1.5 }}>{student.decNotes}</div>}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#7A92B0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
                  <div style={{ fontWeight: 600, color: '#1A365E' }}>No interview scheduled</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Schedule via the Interviews page.</div>
                </div>
              )}
            </div>
          )}

          {/* COMMS */}
          {tab === 'Comms' && (
            loadingComms ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
            ) : comms.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#7A92B0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
                <div style={{ fontWeight: 600, color: '#1A365E' }}>No communications logged</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Log from the Communications page.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {comms.map(c => (
                  <div key={c.id} style={{ border: '1px solid #E4EAF2', borderRadius: 8, padding: '10px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{COMM_TYPE_ICON[c.type] ?? '📌'}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#1A365E' }}>{c.type}</span>
                        {c.outcome && (
                          <span style={{ padding: '2px 8px', borderRadius: 20, background: '#E6F4FF', color: '#0369A1', fontSize: 11, fontWeight: 700 }}>{c.outcome}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#7A92B0' }}>{fmtDate(c.date)}</span>
                    </div>
                    {c.subject && <div style={{ fontSize: 13, color: '#3D5475', marginBottom: 2 }}>{c.subject}</div>}
                    {c.staff && <div style={{ fontSize: 11, color: '#7A92B0' }}>By {c.staff}</div>}
                    {c.notes && <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 4, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {/* ATTENDANCE */}
          {tab === 'Attendance' && (
            loadingAtt ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Rate', v: attRate !== null ? `${attRate}%` : '—', c: attRate !== null && attRate >= 90 ? '#0E6B3B' : attRate !== null && attRate >= 75 ? '#B45309' : '#D61F31', bg: '#F7F9FC' },
                    { l: 'P/E/R', v: attPresent, c: '#0E6B3B', bg: '#E8FBF0' },
                    { l: 'Absent', v: attAbsent, c: '#D61F31', bg: '#FFF0F1' },
                    { l: 'Tardy', v: attTardy, c: '#B45309', bg: '#FFF6E0' },
                  ].map(s => (
                    <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: s.c, textTransform: 'uppercase' }}>{s.l}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
                      {s.l === 'Rate' && <div style={{ fontSize: 11, color: '#7A92B0' }}>Last {attendance.length} days</div>}
                    </div>
                  ))}
                </div>
                {attendance.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>No attendance records found.</div>
                ) : (
                  <div style={{ border: '1px solid #E4EAF2', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#F7F9FC', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Date</span><span>Status</span>
                    </div>
                    {attendance.slice(0, 20).map(a => {
                      const m = ATT_META[a.status] ?? { bg: '#F3F4F6', tc: '#7A92B0', label: a.status }
                      return (
                        <div key={a.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px', borderTop: '1px solid #F0F4F8' }}>
                          <span style={{ fontSize: 12, color: '#3D5475' }}>{fmtDate(a.date)}</span>
                          <span style={{ padding: '2px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}
