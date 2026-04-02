import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useHeaderActions } from '@/contexts/PageHeaderContext'

interface HealthRec {
  id: string; studentId: string; studentName: string; grade: string
  bloodGroup: string; allergies: string; medications: string; conditions: string
  immunizations: string; visionHearing: string; dietary: string
  iep: string; physician: string; physicianPhone: string; notes: string
}

interface Student { id: string; name: string; grade: string }

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20 }
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E4EAF2', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#1A365E', borderBottom: '1px solid #F0F4F8', verticalAlign: 'middle' }

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']
const IEP_OPTIONS = ['None', 'IEP', '504 Plan', 'ELL', 'GT', 'Speech', 'Occupational Therapy']
const EMPTY = { studentId: '', bloodGroup: '', allergies: '', medications: '', conditions: '', immunizations: '', visionHearing: '', dietary: '', iep: 'None', physician: '', physicianPhone: '', notes: '' }

function HealthModal({ rec, students, onClose, onSave, onDelete }: {
  rec: HealthRec | null; students: Student[]
  onClose: () => void; onSave: (f: typeof EMPTY, id?: string) => Promise<void>; onDelete?: (id: string) => Promise<void>
}) {
  const [form, setForm] = useState(rec ? { studentId: rec.studentId, bloodGroup: rec.bloodGroup, allergies: rec.allergies, medications: rec.medications, conditions: rec.conditions, immunizations: rec.immunizations, visionHearing: rec.visionHearing, dietary: rec.dietary, iep: rec.iep, physician: rec.physician, physicianPhone: rec.physicianPhone, notes: rec.notes } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 4 }
  async function handleSave() { if (!form.studentId) return; setSaving(true); await onSave(form, rec?.id); setSaving(false); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{rec ? 'Edit Health Record' : 'New Health Record'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Student</label>
              <select value={form.studentId} onChange={e => set('studentId', e.target.value)} style={inp} disabled={!!rec}>
                <option value="">Select student…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>)}
              </select>
            </div>
            <div><label style={lbl}>Blood Group</label><select value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} style={inp}><option value="">—</option>{BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Special Education / Support</label><select value={form.iep} onChange={e => set('iep', e.target.value)} style={inp}>{IEP_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label style={lbl}>Dietary Restrictions</label><input value={form.dietary} onChange={e => set('dietary', e.target.value)} placeholder="e.g. Vegetarian, Halal, Nut-free" style={inp} /></div>
          </div>
          <div><label style={lbl}>Known Allergies</label><textarea value={form.allergies} onChange={e => set('allergies', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. Peanuts, Shellfish, Latex" /></div>
          <div><label style={lbl}>Current Medications</label><textarea value={form.medications} onChange={e => set('medications', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. EpiPen, Ventolin, Ritalin" /></div>
          <div><label style={lbl}>Chronic Conditions</label><textarea value={form.conditions} onChange={e => set('conditions', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Immunization Records</label><input value={form.immunizations} onChange={e => set('immunizations', e.target.value)} placeholder="e.g. Up to date 2024" style={inp} /></div>
            <div><label style={lbl}>Vision / Hearing Notes</label><input value={form.visionHearing} onChange={e => set('visionHearing', e.target.value)} placeholder="e.g. Corrective lenses" style={inp} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>Physician / Pediatrician</label><input value={form.physician} onChange={e => set('physician', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Physician Phone</label><input value={form.physicianPhone} onChange={e => set('physicianPhone', e.target.value)} style={inp} /></div>
          </div>
          <div><label style={lbl}>Nurse / Counselor Notes <span style={{ fontSize: 10, color: '#D61F31', fontWeight: 400 }}>(confidential)</span></label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>{rec && onDelete && <button onClick={() => { if (confirm('Delete?')) onDelete(rec.id).then(onClose) }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 13, cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#7A92B0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HealthRecordsPage() {
  const [records, setRecords] = useState<HealthRec[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; rec: HealthRec | null }>({ open: false, rec: null })

  async function load() {
    const [{ data: recs }, { data: studs }] = await Promise.all([
      supabase.from('health_records').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('id,first_name,last_name,grade').eq('status', 'Enrolled'),
    ])
    if (studs) setStudents(studs.map((s: Record<string, unknown>) => ({ id: s.id as string, name: `${s.first_name} ${s.last_name}`, grade: s.grade as string })))
    if (recs && studs) {
      const sMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, `${s.first_name} ${s.last_name}` as string]))
      const gradeMap = new Map(studs.map((s: Record<string, unknown>) => [s.id as string, s.grade as string]))
      setRecords(recs.map((r: Record<string, unknown>) => ({
        id: r.id as string, studentId: r.student_id as string,
        studentName: sMap.get(r.student_id as string) ?? '—',
        grade: gradeMap.get(r.student_id as string) ?? '—',
        bloodGroup: (r.blood_group as string) ?? '',
        allergies: (r.allergies as string) ?? '', medications: (r.medications as string) ?? '',
        conditions: (r.conditions as string) ?? '', immunizations: (r.immunizations as string) ?? '',
        visionHearing: (r.vision_hearing as string) ?? '',
        dietary: (r.dietary as string) ?? '',
        iep: (r.iep as string) ?? 'None',
        physician: (r.physician as string) ?? '',
        physicianPhone: (r.physician_phone as string) ?? '',
        notes: (r.notes as string) ?? '',
      })))
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => !q || r.studentName.toLowerCase().includes(q) || r.studentId.toLowerCase().includes(q))
  }, [records, search])

  async function saveRec(form: typeof EMPTY, id?: string) {
    const payload = { student_id: form.studentId, blood_group: form.bloodGroup || null, allergies: form.allergies, medications: form.medications, conditions: form.conditions, immunizations: form.immunizations, vision_hearing: form.visionHearing || null, dietary: form.dietary || null, iep: form.iep || null, physician: form.physician || null, physician_phone: form.physicianPhone || null, notes: form.notes }
    if (id) { await supabase.from('health_records').update(payload).eq('id', id); toast('Health record updated', 'ok') }
    else { await supabase.from('health_records').insert(payload); toast('Health record added', 'ok') }
    await load()
  }
  async function deleteRec(id: string) { await supabase.from('health_records').delete().eq('id', id); setRecords(prev => prev.filter(r => r.id !== id)); toast('Record deleted', 'ok') }

  const iStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff' }

  const headerPortal = useHeaderActions(
    <button onClick={() => setModal({ open: true, rec: null })} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add Record</button>
  )

  return (
    <>{headerPortal}<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Records', value: records.length, color: '#1A365E' },
          { label: 'Has Allergy', value: records.filter(r => r.allergies).length, color: '#F5A623' },
          { label: 'On Medication', value: records.filter(r => r.medications).length, color: '#0EA5E9' },
          { label: 'IEP / 504 / Support', value: records.filter(r => r.iep && r.iep !== 'None').length, color: '#7C3AED' },
        ].map(c => (
          <div key={c.label} style={{ ...card, flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: '#7A92B0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginTop: 6 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student…" style={{ ...iStyle, width: 240 }} />
        <span style={{ fontSize: 13, color: '#7A92B0', alignSelf: 'center' }}>{filtered.length} records</span>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#F7F9FC' }}>
            <th style={th}>Student</th><th style={th}>Grade</th><th style={th}>Blood Group</th>
            <th style={th}>Allergies</th><th style={th}>Medications</th><th style={th}>IEP/Support</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id}
                onClick={() => setModal({ open: true, rec: r })}
                style={{ cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F0F6FF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#fff' : '#FAFBFC' }}
              >
                <td style={{ ...td, fontWeight: 600 }}>{r.studentName}</td>
                <td style={{ ...td, color: '#7A92B0' }}>{r.grade}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.bloodGroup ? <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{r.bloodGroup}</span> : <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                <td style={{ ...td, color: r.allergies ? '#B45309' : '#C4D0DE', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.allergies || '—'}</td>
                <td style={{ ...td, color: r.medications ? '#0369A1' : '#C4D0DE', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.medications || '—'}</td>
                <td style={td}>{r.iep && r.iep !== 'None' ? <span style={{ background: '#F3EDFF', color: '#6D28D9', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{r.iep}</span> : <span style={{ color: '#C4D0DE' }}>—</span>}</td>
                <td style={td} onClick={e => e.stopPropagation()}><button onClick={() => setModal({ open: true, rec: r })} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#7A92B0', padding: 32 }}>No health records yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal.open && <HealthModal rec={modal.rec} students={students} onClose={() => setModal({ open: false, rec: null })} onSave={saveRec} onDelete={deleteRec} />}
    </div></>
  )
}
