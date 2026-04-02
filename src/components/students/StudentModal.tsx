import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  STATUSES, GRADES, BLOOD_GROUPS, IEP_OPTIONS, DOCUMENT_TYPES,
  PRIORITIES, STUDENT_TYPES, generateStudentId, EMPTY_STUDENT,
  type Student, type StudentInsert,
} from '@/types/student'

interface FeeRec {
  id: string
  feeType: string
  amount: number
  amountPaid: number
  dueDate: string | null
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Waived'
  notes: string | null
  schoolYear: string
}

const FEE_STATUS_META = {
  Paid:    { bg: '#E8FBF0', tc: '#0E6B3B' },
  Partial: { bg: '#FFF6E0', tc: '#B45309' },
  Unpaid:  { bg: '#FFF0F1', tc: '#D61F31' },
  Waived:  { bg: '#F3F4F6', tc: '#7A92B0' },
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
}

interface Props {
  open: boolean
  student?: Student | null
  campuses: string[]
  cohorts: string[]
  onSave: (data: StudentInsert) => Promise<void>
  onClose: () => void
}

const TABS = ['Personal', 'Contact', 'Health', 'Documents', 'Notes', 'Interview', 'Fees'] as const
type Tab = typeof TABS[number]

const S: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  borderRadius: 7,
  border: '1px solid #E4EAF2',
  padding: '7px 10px',
  width: '100%',
  color: '#1A365E',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#3D5475' }}>
        {label}{required && <span style={{ color: '#D61F31' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input style={S} {...props} />
}

function FSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select style={S} {...props}>{children}</select>
}

function FTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea style={{ ...S, resize: 'vertical', minHeight: 70 }} {...props} />
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  )
}

export function StudentModal({ open, student, campuses, cohorts, onSave, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('Personal')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<StudentInsert>(EMPTY_STUDENT)
  const [feeRecords, setFeeRecords] = useState<FeeRec[]>([])
  const [feesLoading, setFeesLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTab('Personal')
      setFeeRecords([])
      if (student) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = student
        setForm(rest)
      } else {
        setForm(EMPTY_STUDENT)
      }
    }
  }, [open, student])

  useEffect(() => {
    if (tab === 'Fees' && student?.id) {
      setFeesLoading(true)
      supabase.from('fees').select('*').eq('student_id', student.id).order('due_date', { ascending: true })
        .then(({ data }) => {
          setFeeRecords((data ?? []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            feeType: r.fee_type as string,
            amount: Number(r.amount),
            amountPaid: Number(r.amount_paid ?? 0),
            dueDate: r.due_date as string | null,
            status: r.status as FeeRec['status'],
            notes: r.notes as string | null,
            schoolYear: r.school_year as string,
          })))
          setFeesLoading(false)
        })
    }
  }, [tab, student?.id])

  function set<K extends keyof StudentInsert>(key: K, value: StudentInsert[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleDoc(doc: string) {
    setForm(f => ({
      ...f,
      documents: f.documents.includes(doc)
        ? f.documents.filter(d => d !== doc)
        : [...f.documents, doc],
    }))
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const docPct = DOCUMENT_TYPES.length ? Math.round((form.documents.length / DOCUMENT_TYPES.length) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10,25,50,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 700,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            background: 'linear-gradient(135deg,#0F2240,#1A365E)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {student ? 'Edit Student' : 'Add New Student'}
            </div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 2 }}>
              {student ? `${student.firstName} ${student.lastName}` : 'Fill in the student details below'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              borderRadius: 6,
              width: 28, height: 28,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E4EAF2',
            background: '#F7F9FC',
            overflowX: 'auto',
          }}
        >
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 18px',
                fontSize: 12,
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#D61F31' : '#3D5475',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #D61F31' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── PERSONAL ── */}
          {tab === 'Personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Grid2>
                <Field label="First Name" required>
                  <FInput value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
                </Field>
                <Field label="Last Name" required>
                  <FInput value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name" />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Date of Birth">
                  <FInput type="date" value={form.dob ?? ''} onChange={e => set('dob', e.target.value || null)} />
                </Field>
                <Field label="Gender">
                  <FSelect value={form.gender ?? ''} onChange={e => set('gender', (e.target.value || null) as Student['gender'])}>
                    <option value="">— Select —</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </FSelect>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Nationality">
                  <FInput value={form.nationality ?? ''} onChange={e => set('nationality', e.target.value || null)} placeholder="e.g. American" />
                </Field>
                <Field label="Language">
                  <FInput value={form.lang ?? ''} onChange={e => set('lang', e.target.value || null)} placeholder="e.g. English" />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Grade">
                  <FSelect value={form.grade ?? ''} onChange={e => set('grade', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">— Select Grade —</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </FSelect>
                </Field>
                <Field label="Status">
                  <FSelect value={form.status} onChange={e => set('status', e.target.value as Student['status'])}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </FSelect>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Campus">
                  <FSelect value={form.campus ?? ''} onChange={e => set('campus', e.target.value || null)}>
                    <option value="">— Select Campus —</option>
                    {campuses.map(c => <option key={c}>{c}</option>)}
                  </FSelect>
                </Field>
                <Field label="Cohort">
                  <FSelect value={form.cohort ?? ''} onChange={e => set('cohort', e.target.value || null)}>
                    <option value="">— Select Cohort —</option>
                    {cohorts.map(c => <option key={c}>{c}</option>)}
                  </FSelect>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Student Type">
                  <FSelect value={form.studentType} onChange={e => set('studentType', e.target.value as Student['studentType'])}>
                    {STUDENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </FSelect>
                </Field>
                <Field label="Priority">
                  <FSelect value={form.priority} onChange={e => set('priority', e.target.value as Student['priority'])}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </FSelect>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Application Date">
                  <FInput type="date" value={form.appDate ?? ''} onChange={e => set('appDate', e.target.value || null)} />
                </Field>
                <Field label="Enrollment Date">
                  <FInput type="date" value={form.enrollDate ?? ''} onChange={e => set('enrollDate', e.target.value || null)} />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Previous School">
                  <FInput value={form.prevSchool ?? ''} onChange={e => set('prevSchool', e.target.value || null)} placeholder="School name" />
                </Field>
                <Field label="Prior GPA">
                  <FInput type="number" step="0.01" min="0" max="4" value={form.priorGpa ?? ''} onChange={e => set('priorGpa', e.target.value || null)} placeholder="0.00" />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Support Plan (IEP)">
                  <FSelect value={form.iep ?? ''} onChange={e => set('iep', e.target.value || null)}>
                    {IEP_OPTIONS.map(i => <option key={i} value={i}>{i || '— None —'}</option>)}
                  </FSelect>
                </Field>
                <Field label="Student ID">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <FInput value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder="Auto-generate or enter" style={{ ...S, flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => set('studentId', generateStudentId())}
                      style={{
                        padding: '7px 10px', borderRadius: 7, border: '1px solid #E4EAF2',
                        background: '#F7F9FC', color: '#1A365E', fontSize: 12,
                        cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600,
                      }}
                    >
                      Generate
                    </button>
                  </div>
                </Field>
              </Grid2>

              {/* Alumni-specific fields */}
              {form.studentType === 'Alumni' && (
                <Grid2>
                  <Field label="Year Joined">
                    <FInput value={form.yearJoined ?? ''} onChange={e => set('yearJoined', e.target.value || null)} placeholder="e.g. 2018" />
                  </Field>
                  <Field label="Year Graduated">
                    <FInput value={form.yearGraduated ?? ''} onChange={e => set('yearGraduated', e.target.value || null)} placeholder="e.g. 2022" />
                  </Field>
                </Grid2>
              )}
              {form.studentType === 'Alumni' && (
                <>
                  <Grid2>
                    <Field label="Post-Secondary Institution">
                      <FInput value={form.postSecondary ?? ''} onChange={e => set('postSecondary', e.target.value || null)} placeholder="University / College" />
                    </Field>
                    <Field label="Graduation Distinction">
                      <FInput value={form.gradDistinction ?? ''} onChange={e => set('gradDistinction', e.target.value || null)} placeholder="e.g. Summa Cum Laude" />
                    </Field>
                  </Grid2>
                  <Field label="Alumni Notes">
                    <FTextarea value={form.alumniNotes ?? ''} onChange={e => set('alumniNotes', e.target.value || null)} placeholder="Notes about alumni..." />
                  </Field>
                </>
              )}
            </div>
          )}

          {/* ── CONTACT ── */}
          {tab === 'Contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Grid2>
                <Field label="Parent / Guardian Name" required>
                  <FInput value={form.parent ?? ''} onChange={e => set('parent', e.target.value || null)} placeholder="Full name" />
                </Field>
                <Field label="Relationship">
                  <FSelect value={form.relation ?? ''} onChange={e => set('relation', e.target.value || null)}>
                    <option value="">— Select —</option>
                    <option>Mother</option>
                    <option>Father</option>
                    <option>Guardian</option>
                    <option>Grandparent</option>
                    <option>Other</option>
                  </FSelect>
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Email">
                  <FInput type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || null)} placeholder="email@example.com" />
                </Field>
                <Field label="Phone">
                  <FInput type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value || null)} placeholder="+1 (000) 000-0000" />
                </Field>
              </Grid2>
              <div style={{ borderTop: '1px solid #E4EAF2', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3D5475', marginBottom: 10 }}>
                  Emergency Contact
                </div>
                <Grid2>
                  <Field label="Contact Name">
                    <FInput value={form.ecName ?? ''} onChange={e => set('ecName', e.target.value || null)} placeholder="Emergency contact name" />
                  </Field>
                  <Field label="Contact Phone">
                    <FInput type="tel" value={form.ecPhone ?? ''} onChange={e => set('ecPhone', e.target.value || null)} placeholder="+1 (000) 000-0000" />
                  </Field>
                </Grid2>
              </div>
              <Field label="Address" required>
                <FInput value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} placeholder="Full address" />
              </Field>
            </div>
          )}

          {/* ── HEALTH ── */}
          {tab === 'Health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Grid2>
                <Field label="Blood Group">
                  <FSelect value={form.bloodGroup ?? ''} onChange={e => set('bloodGroup', e.target.value || null)}>
                    <option value="">— Select —</option>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </FSelect>
                </Field>
                <Field label="Support Plan (IEP)">
                  <FSelect value={form.iep ?? ''} onChange={e => set('iep', e.target.value || null)}>
                    {IEP_OPTIONS.map(i => <option key={i} value={i}>{i || '— None —'}</option>)}
                  </FSelect>
                </Field>
              </Grid2>
              <Field label="Allergies">
                <FInput value={form.allergy ?? ''} onChange={e => set('allergy', e.target.value || null)} placeholder="List any known allergies" />
              </Field>
              <Field label="Medications">
                <FInput value={form.meds ?? ''} onChange={e => set('meds', e.target.value || null)} placeholder="Current medications" />
              </Field>
              <Grid2>
                <Field label="Physician Name">
                  <FInput value={form.physician ?? ''} onChange={e => set('physician', e.target.value || null)} placeholder="Doctor's name" />
                </Field>
                <Field label="Physician Phone">
                  <FInput type="tel" value={form.physicianPhone ?? ''} onChange={e => set('physicianPhone', e.target.value || null)} placeholder="+1 (000) 000-0000" />
                </Field>
              </Grid2>
              <Field label="Health Notes">
                <FTextarea value={form.healthNotes ?? ''} onChange={e => set('healthNotes', e.target.value || null)} placeholder="Additional health information..." />
              </Field>
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {tab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: '#F7F9FC',
                borderRadius: 8,
                padding: 14,
                border: '1px solid #E4EAF2',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3D5475' }}>Documents Received</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: docPct === 100 ? '#1DBD6A' : '#F5A623' }}>
                    {form.documents.length}/{DOCUMENT_TYPES.length}
                  </span>
                </div>
                <div style={{ background: '#E4EAF2', borderRadius: 20, height: 6 }}>
                  <div style={{
                    height: 6, borderRadius: 20,
                    background: docPct === 100 ? '#1DBD6A' : docPct >= 50 ? '#F5A623' : '#D61F31',
                    width: `${docPct}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DOCUMENT_TYPES.map(doc => {
                  const received = form.documents.includes(doc)
                  return (
                    <button
                      key={doc}
                      type="button"
                      onClick={() => toggleDoc(doc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: `1px solid ${received ? '#1DBD6A' : '#E4EAF2'}`,
                        background: received ? '#E8FBF0' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{
                        width: 20, height: 20,
                        borderRadius: 4,
                        border: `2px solid ${received ? '#1DBD6A' : '#CBD5E1'}`,
                        background: received ? '#1DBD6A' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 13, color: '#fff',
                      }}>
                        {received ? '✓' : ''}
                      </span>
                      <span style={{ fontSize: 13, color: received ? '#0E6B3B' : '#1A365E', fontWeight: received ? 600 : 400 }}>
                        {doc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── NOTES ── */}
          {tab === 'Notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Admissions Notes">
                <FTextarea
                  rows={4}
                  value={form.notes ?? ''}
                  onChange={e => set('notes', e.target.value || null)}
                  placeholder="Notes visible to admissions team..."
                />
              </Field>
              <Field label="Counselor Notes">
                <FTextarea
                  rows={4}
                  value={form.counselorNotes ?? ''}
                  onChange={e => set('counselorNotes', e.target.value || null)}
                  placeholder="Private counselor notes..."
                />
              </Field>
            </div>
          )}

          {/* ── INTERVIEW ── */}
          {tab === 'Interview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Grid2>
                <Field label="Interview Date">
                  <FInput type="date" value={form.intDate ?? ''} onChange={e => set('intDate', e.target.value || null)} />
                </Field>
                <Field label="Interview Time">
                  <FInput type="time" value={form.intTime ?? ''} onChange={e => set('intTime', e.target.value || null)} />
                </Field>
              </Grid2>
              <Grid2>
                <Field label="Interviewer">
                  <FInput value={form.intViewer ?? ''} onChange={e => set('intViewer', e.target.value || null)} placeholder="Staff name" />
                </Field>
                <Field label="Committee">
                  <FInput value={form.intCommittee ?? ''} onChange={e => set('intCommittee', e.target.value || null)} placeholder="Committee name" />
                </Field>
              </Grid2>
              <Field label="Interview Score (1–10)">
                <FInput type="number" min={1} max={10} value={form.intScore ?? ''} onChange={e => set('intScore', e.target.value ? Number(e.target.value) : null)} placeholder="Score out of 10" />
              </Field>
              <Field label="Interview Notes">
                <FTextarea value={form.intNotes ?? ''} onChange={e => set('intNotes', e.target.value || null)} placeholder="Interview notes and observations..." />
              </Field>
              <div style={{ borderTop: '1px solid #E4EAF2', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3D5475', marginBottom: 10 }}>Decision</div>
                <Grid2>
                  <Field label="Decision Date">
                    <FInput type="date" value={form.decDate ?? ''} onChange={e => set('decDate', e.target.value || null)} />
                  </Field>
                  <div />
                </Grid2>
                <div style={{ marginTop: 10 }}>
                  <Field label="Decision Notes">
                    <FTextarea value={form.decNotes ?? ''} onChange={e => set('decNotes', e.target.value || null)} placeholder="Decision notes..." />
                  </Field>
                </div>
              </div>
            </div>
          )}
          {/* ── FEES ── */}
          {tab === 'Fees' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!student ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>
                  Save the student first to manage fee records.
                </div>
              ) : feesLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9EB3C8', fontSize: 13 }}>Loading fees…</div>
              ) : feeRecords.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#7A92B0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A365E' }}>No fee records</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Use the Fees page to add records for this student.</div>
                </div>
              ) : (() => {
                const totalOwed = feeRecords.reduce((a, r) => a + r.amount, 0)
                const totalPaid = feeRecords.reduce((a, r) => a + r.amountPaid, 0)
                const balance = totalOwed - totalPaid
                const pct = totalOwed > 0 ? Math.round((totalPaid / totalOwed) * 100) : 0
                return (
                  <>
                    {/* Summary strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Total Owed', val: fmtUSD(totalOwed), col: '#1A365E', bg: '#EEF3FF' },
                        { label: 'Total Paid', val: fmtUSD(totalPaid), col: '#0E6B3B', bg: '#E8FBF0' },
                        { label: 'Balance Due', val: fmtUSD(balance), col: balance > 0 ? '#D61F31' : '#0E6B3B', bg: balance > 0 ? '#FFF0F1' : '#E8FBF0' },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: s.col, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: s.col, marginTop: 2 }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: '#7A92B0' }}>
                        <span>Payment Progress</span><span>{pct}%</span>
                      </div>
                      <div style={{ background: '#E4EAF2', borderRadius: 20, height: 8 }}>
                        <div style={{ height: 8, borderRadius: 20, width: `${pct}%`, background: pct === 100 ? '#1DBD6A' : pct >= 50 ? '#F5A623' : '#D61F31', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    {/* Fee rows */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F7F9FC' }}>
                          {['Type', 'Year', 'Amount', 'Paid', 'Due Date', 'Status'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E4EAF2' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {feeRecords.map(f => {
                          const m = FEE_STATUS_META[f.status] ?? FEE_STATUS_META.Unpaid
                          return (
                            <tr key={f.id} style={{ borderBottom: '1px solid #F0F4F8' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.feeType}</td>
                              <td style={{ padding: '8px 12px', color: '#7A92B0' }}>{f.schoolYear}</td>
                              <td style={{ padding: '8px 12px' }}>{fmtUSD(f.amount)}</td>
                              <td style={{ padding: '8px 12px', color: '#0E6B3B' }}>{fmtUSD(f.amountPaid)}</td>
                              <td style={{ padding: '8px 12px', color: '#7A92B0', fontSize: 12 }}>{f.dueDate ?? '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 20, background: m.bg, color: m.tc, fontSize: 11, fontWeight: 700 }}>{f.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #E4EAF2',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#F7F9FC',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1px solid #E4EAF2',
              background: '#fff', color: '#1A365E',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.firstName.trim() || !form.lastName.trim()}
            style={{
              padding: '8px 24px', borderRadius: 8,
              border: 'none',
              background: saving ? '#9EB3C8' : '#D61F31',
              color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : student ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}
