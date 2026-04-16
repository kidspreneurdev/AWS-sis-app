import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 13, border: '1px solid #E4EAF2', boxShadow: '0 1px 6px rgba(26,54,94,.05)' }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 13, color: '#1A365E', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#3D5475', textTransform: 'uppercase', letterSpacing: '.7px' }

interface Settings {
  id: string
  school_name: string | null
  academic_year: string | null
  campuses: string[] | null
  cohorts: string[] | null
  graduation_credits: number | null
  associate_degree_credits_required: number | null
  required_documents: string[] | null
  enrollment_capacity: number | null
  sid_prefix: string | null
  grading_scale: string | null
  email_notifications: string | null
}

type EditKey = 'academicYear' | 'campuses' | 'capacity' | 'docs' | 'cohorts' | 'sidPrefix' | 'gradeScale' | 'emailNotif'

const CONFIG_ROWS: { key: EditKey; label: string; ico: string; col: string; desc: string }[] = [
  { key: 'academicYear', label: 'Academic Year', ico: '📅', col: '#1A365E', desc: 'Current school year' },
  { key: 'campuses', label: 'Campuses', ico: '🏫', col: '#D61F31', desc: 'Manage campus locations' },
  { key: 'capacity', label: 'Enrollment Capacity', ico: '📊', col: '#1FD6C4', desc: 'Maximum enrolled students' },
  { key: 'docs', label: 'Required Documents', ico: '📄', col: '#A36CFF', desc: 'Documents required for admission' },
  { key: 'cohorts', label: 'Cohorts / Sections', ico: '👥', col: '#FAC600', desc: 'Class groups and sections' },
  { key: 'sidPrefix', label: 'Student ID Format', ico: '🎓', col: '#0EA5E9', desc: 'Prefix for generated student IDs' },
  { key: 'gradeScale', label: 'Grading Scale', ico: '📝', col: '#1DBD6A', desc: 'Default grading system' },
  { key: 'emailNotif', label: 'Email Notifications', ico: '✉️', col: '#F5A623', desc: 'Notification settings' },
]

function toStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function getDisplayValue(key: EditKey, s: Settings): string {
  switch (key) {
    case 'academicYear': return toStr(s.academic_year) || '—'
    case 'campuses': return s.campuses?.join(', ') || '—'
    case 'capacity': return s.enrollment_capacity != null ? String(s.enrollment_capacity) : '—'
    case 'docs': return s.required_documents?.length ? `${s.required_documents.length} document types` : '—'
    case 'cohorts': return s.cohorts?.join(', ') || '—'
    case 'sidPrefix': return toStr(s.sid_prefix) || 'AWS'
    case 'gradeScale': return typeof s.grading_scale === 'string' ? s.grading_scale : 'A/B/C/D/F'
    case 'emailNotif': return toStr(s.email_notifications) || 'Disabled'
  }
}

function EditModal({ settingsId, editKey, settings, onSave, onClose }: {
  settingsId: string
  editKey: EditKey
  settings: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}) {
  const row = CONFIG_ROWS.find(r => r.key === editKey)!
  const [val, setVal] = useState(() => {
    switch (editKey) {
      case 'academicYear': return settings.academic_year ?? ''
      case 'campuses': return settings.campuses?.join('\n') ?? ''
      case 'capacity': return String(settings.enrollment_capacity ?? '')
      case 'docs': return settings.required_documents?.join('\n') ?? ''
      case 'cohorts': return settings.cohorts?.join('\n') ?? ''
      case 'sidPrefix': return settings.sid_prefix ?? 'AWS'
      case 'gradeScale': return typeof settings.grading_scale === 'string' ? settings.grading_scale : 'A/B/C/D/F'
      case 'emailNotif': return settings.email_notifications ?? 'Disabled'
    }
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const patch: Partial<Settings> = {}
    switch (editKey) {
      case 'academicYear': patch.academic_year = val.trim(); break
      case 'campuses': patch.campuses = val.split('\n').map(v => v.trim()).filter(Boolean); break
      case 'capacity': patch.enrollment_capacity = parseInt(val) || null; break
      case 'docs': patch.required_documents = val.split('\n').map(v => v.trim()).filter(Boolean); break
      case 'cohorts': patch.cohorts = val.split('\n').map(v => v.trim()).filter(Boolean); break
      case 'sidPrefix': patch.sid_prefix = val.trim(); break
      case 'gradeScale': patch.grading_scale = val; break
      case 'emailNotif': patch.email_notifications = val; break
    }
    await supabase.from('settings').update(patch).eq('id', settingsId)
    setSaving(false)
    onSave({ ...settings, ...patch })
    onClose()
  }

  const isTextarea = ['campuses', 'docs', 'cohorts'].includes(editKey)
  const isSelect = ['gradeScale', 'emailNotif'].includes(editKey)

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '18px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{row.ico} Edit {row.label}</div>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>{row.label}</label>
            {isSelect && editKey === 'gradeScale' ? (
              <select value={val} onChange={e => setVal(e.target.value)} style={inp}>
                <option>A/B/C/D/F</option>
                <option>4/3/2/1 Standards Mastery</option>
                <option>Percentage (%)</option>
                <option>Pass/Fail</option>
              </select>
            ) : isSelect && editKey === 'emailNotif' ? (
              <select value={val} onChange={e => setVal(e.target.value)} style={inp}>
                <option>Disabled</option>
                <option>Enabled for status changes only</option>
                <option>Enabled for status changes and document requests</option>
              </select>
            ) : isTextarea ? (
              <>
                <textarea rows={6} value={val} onChange={e => setVal(e.target.value)} style={{ ...inp, resize: 'vertical' }} placeholder="One per line…" />
                <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>Enter one item per line</div>
              </>
            ) : (
              <input type={editKey === 'capacity' ? 'number' : 'text'} value={val} onChange={e => setVal(e.target.value)} style={inp} placeholder={editKey === 'sidPrefix' ? 'e.g. AWS' : editKey === 'academicYear' ? 'e.g. 2024-2025' : ''} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid #E4EAF2' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #E4EAF2', background: '#fff', color: '#3D5475', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void save()} disabled={saving} style={{ padding: '8px 22px', background: '#D61F31', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editKey, setEditKey] = useState<EditKey | null>(null)
  const [totalStudents, setTotalStudents] = useState(0)
  const [enrolledStudents, setEnrolledStudents] = useState(0)
  const [promoting, setPromoting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const [{ data: sData }, { count: total }, { count: enrolled }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'Enrolled'),
    ])
    if (sData) setSettings(sData as Settings)
    setTotalStudents(total ?? 0)
    setEnrolledStudents(enrolled ?? 0)
  }

  async function exportBackup() {
    const [{ data: students }, { data: sett }] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('settings').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ students, settings: sett, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `aws_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }

  function printDirectory() {
    window.print()
  }

  async function runPromotion() {
    if (!settings) return
    if (!confirm('This will promote ALL enrolled students to the next grade and advance the academic year. Are you sure?')) return
    setPromoting(true)
    const { data: students } = await supabase.from('students').select('id, grade').eq('status', 'Enrolled')
    if (students?.length) {
      const gradeOrder = ['Pre-K', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
      for (const s of students) {
        const idx = gradeOrder.indexOf(s.grade ?? '')
        const nextGrade = idx >= 0 && idx < gradeOrder.length - 1 ? gradeOrder[idx + 1] : s.grade
        await supabase.from('students').update({ grade: nextGrade }).eq('id', s.id)
      }
    }
    const [yearA, yearB] = (settings.academic_year ?? '2024-2025').split('-').map(Number)
    const nextYear = `${(yearA || 2024) + 1}-${(yearB || 2025) + 1}`
    await supabase.from('settings').update({ academic_year: nextYear }).eq('id', settings.id)
    setPromoting(false)
    alert(`Promotion complete! ${students?.length ?? 0} students advanced. New year: ${nextYear}`)
    void load()
  }

  async function resetSettings() {
    if (!settings) return
    if (!confirm('Reset all settings to default? This cannot be undone.')) return
    await supabase.from('settings').update({
      academic_year: '2024-2025', campuses: [], cohorts: [], required_documents: [],
      graduation_credits: 24, enrollment_capacity: null, sid_prefix: 'AWS',
      grading_scale: 'A/B/C/D/F', email_notifications: 'Disabled',
    }).eq('id', settings.id)
    void load()
  }

  async function clearAllStudents() {
    if (!confirm('⚠️ This will permanently delete ALL student records. This cannot be undone. Type DELETE to confirm.')) return
    const confirm2 = prompt('Type DELETE to confirm:')
    if (confirm2 !== 'DELETE') return
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    void load()
  }

  const kpiCard = (label: string, value: string | number, color: string) => (
    <div style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', letterSpacing: '1.2px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Global school configuration</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpiCard('Total Students', totalStudents, '#1A365E')}
        {kpiCard('Enrolled', enrolledStudents, '#0EA5E9')}
        {kpiCard('Data Version', 'v5.0', '#7040CC')}
        {kpiCard('Database', 'Supabase', '#1DBD6A')}
      </div>

      {/* System Configuration */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E4EAF2', fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1 }}>⚙️ System Configuration</div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {settings && CONFIG_ROWS.map(row => (
            <div key={row.key} style={{ background: '#fff', borderRadius: 11, padding: '13px 15px', border: '1px solid #E4EAF2', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${row.col}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{row.ico}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{row.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5475', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayValue(row.key, settings)}</div>
                <div style={{ fontSize: 10, color: '#7A92B0', marginTop: 1 }}>{row.desc}</div>
              </div>
              <button onClick={() => setEditKey(row.key)} style={{ flexShrink: 0, padding: '5px 12px', border: '1.5px solid #E4EAF2', background: '#fff', color: '#3D5475', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
            </div>
          ))}
          {!settings && <div style={{ padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>Loading…</div>}
        </div>
      </div>

      {/* Data Management */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>💾 Data Management</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Export Backup', desc: 'Download full data as JSON', ico: '⬇', bg: '#EEF3FF', border: '#1A365E22', col: '#1A365E', fn: exportBackup },
            { label: 'Restore Backup', desc: 'Import previously exported JSON', ico: '⬆', bg: '#F3EEFF', border: '#7040CC22', col: '#7040CC', fn: () => fileRef.current?.click() },
            { label: 'Print Directory', desc: 'Print enrolled student list', ico: '🖨', bg: '#E0F5FF', border: '#0EA5E922', col: '#0EA5E9', fn: printDirectory },
          ].map(b => (
            <button key={b.label} onClick={() => void b.fn()} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: b.bg, border: `1.5px solid ${b.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 20 }}>{b.ico}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: b.col }}>{b.label}</div>
                <div style={{ fontSize: 10, color: '#7A92B0' }}>{b.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={() => alert('Restore functionality coming soon')} />
      </div>

      {/* Year-End Promotion */}
      {settings && (
        <div style={{ background: '#fff', border: '1.5px solid #E4EAF2', borderRadius: 14, padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, background: '#FFF6E0', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎓</div>
              <div>
                <div style={{ fontWeight: 700, color: '#1A365E', fontSize: 14 }}>Year-End Promotion</div>
                <div style={{ color: '#7A92B0', fontSize: 12, marginTop: 3 }}>Promote all enrolled students to the next grade &amp; advance the academic year</div>
                <div style={{ color: '#7A92B0', fontSize: 11, marginTop: 4 }}>Current year: <strong>{settings.academic_year ?? '—'}</strong></div>
              </div>
            </div>
            <button onClick={() => void runPromotion()} disabled={promoting} style={{ padding: '10px 22px', background: '#1A365E', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
              {promoting ? 'Promoting…' : '🎓 Run Promotion'}
            </button>
          </div>
        </div>
      )}

      {/* Grading Scale Reference */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>📊 Standard Grading Scale</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 6 }}>
          {[['A+','97-100','4.0'],['A','93-96','4.0'],['A-','90-92','3.7'],['B+','87-89','3.3'],['B','83-86','3.0'],['B-','80-82','2.7'],['C+','77-79','2.3'],['C','73-76','2.0'],['C-','70-72','1.7'],['D','60-69','1.0'],['F','0-59','0.0']].map(([g, r, gpa]) => (
            <div key={g} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 7, background: '#F7F9FC', border: '1px solid #E4EAF2' }}>
              <span style={{ width: 26, fontWeight: 800, color: '#1A365E', fontSize: 13 }}>{g}</span>
              <span style={{ flex: 1, color: '#7A92B0', fontSize: 11 }}>{r}</span>
              <span style={{ color: '#1A365E', fontWeight: 700, fontSize: 11 }}>{gpa}</span>
            </div>
          ))}
        </div>
      </div>

      {/* About / Branding */}
      <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', borderRadius: 13, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>American World School</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Admissions &amp; Student Information System · v5.0 · K-12 Edition</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
            {['Innovation', 'Leadership', 'Integrity', 'Growth'].map(tag => (
              <span key={tag} style={{ fontSize: 9, fontWeight: 700, color: '#FAC600', background: 'rgba(250,198,0,.15)', padding: '2px 7px', borderRadius: 7 }}>{tag}</span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Last updated</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{ ...card, padding: 18, border: '1.5px solid #D61F3122' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#D61F31', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>⚠️ Danger Zone</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void resetSettings()} style={{ padding: '8px 16px', background: '#FFF0F1', border: '1.5px solid #F5C2C7', borderRadius: 8, color: '#D61F31', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Reset Settings to Default</button>
          <button onClick={() => void clearAllStudents()} style={{ padding: '8px 16px', background: '#FFF0F1', border: '1.5px solid #F5C2C7', borderRadius: 8, color: '#D61F31', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Clear All Student Data</button>
        </div>
      </div>

      {/* Edit Modal */}
      {editKey && settings && (
        <EditModal
          settingsId={settings.id}
          editKey={editKey}
          settings={settings}
          onSave={setSettings}
          onClose={() => setEditKey(null)}
        />
      )}
    </div>
  )
}
