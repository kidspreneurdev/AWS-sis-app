import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 24 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #E4EAF2', fontSize: 13, color: '#1A365E', background: '#fff', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#7A92B0', display: 'block', marginBottom: 6 }
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#1A365E', marginBottom: 16 }

interface Settings {
  id: string
  school_name: string | null
  academic_year: string | null
  campuses: string[] | null
  cohorts: string[] | null
  graduation_credits: number | null
  associate_degree_credits_required: number | null
  required_documents: string[] | null
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<'general' | 'cohorts' | 'docs' | 'grading'>('general')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [schoolName, setSchoolName] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [campuses, setCampuses] = useState<string[]>([])
  const [newCampus, setNewCampus] = useState('')
  const [cohorts, setCohorts] = useState<string[]>([])
  const [newCohort, setNewCohort] = useState('')
  const [graduationCredits, setGraduationCredits] = useState('')
  const [associateDegreeCredits, setAssociateDegreeCredits] = useState('')
  const [requiredDocs, setRequiredDocs] = useState<string[]>([])
  const [newDoc, setNewDoc] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      if (data) {
        const s = data as Settings
        setSettings(s)
        setSchoolName(s.school_name ?? '')
        setAcademicYear(s.academic_year ?? '')
        setCampuses((s.campuses as string[]) ?? [])
        setCohorts((s.cohorts as string[]) ?? [])
        setGraduationCredits(String(s.graduation_credits ?? ''))
        setAssociateDegreeCredits(String(s.associate_degree_credits_required ?? ''))
        setRequiredDocs((s.required_documents as string[]) ?? [])
      }
    })
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    await supabase.from('settings').update({
      school_name: schoolName,
      academic_year: academicYear,
      campuses,
      cohorts,
      graduation_credits: parseFloat(graduationCredits) || null,
      associate_degree_credits_required: parseFloat(associateDegreeCredits) || null,
      required_documents: requiredDocs,
    }).eq('id', settings.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS = [{ key: 'general', label: 'General' }, { key: 'cohorts', label: 'Cohorts' }, { key: 'docs', label: 'Required Documents' }, { key: 'grading', label: 'Grading' }] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Settings</h1><p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Global school configuration</p></div>
        <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saved ? '#1DBD6A' : '#D61F31', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s' }}>{saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}</button>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#F7F9FC', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#1A365E' : '#7A92B0', fontWeight: tab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer', boxShadow: tab === t.key ? '0 1px 4px rgba(26,54,94,0.10)' : 'none', transition: 'all 0.15s' }}>{t.label}</button>
        ))}
      </div>

      {tab === 'general' && (
        <div style={card}>
          <div style={sectionTitle}>General</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
            <div><label style={lbl}>School Name</label><input value={schoolName} onChange={e => setSchoolName(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Academic Year</label><input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2024-2025" style={inp} /></div>
            <div>
              <label style={lbl}>Campuses</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {campuses.map(c => (
                  <span key={c} style={{ padding: '4px 12px', borderRadius: 20, background: '#E6F4FF', color: '#0369A1', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c}
                    <button onClick={() => setCampuses(prev => prev.filter(x => x !== c))} style={{ background: 'none', border: 'none', color: '#0369A1', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newCampus} onChange={e => setNewCampus(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCampus.trim()) { setCampuses(p => [...p, newCampus.trim()]); setNewCampus('') } }} placeholder="Add campus…" style={{ ...inp, flex: 1 }} />
                <button onClick={() => { if (newCampus.trim()) { setCampuses(p => [...p, newCampus.trim()]); setNewCampus('') } }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'cohorts' && (
        <div style={card}>
          <div style={sectionTitle}>Cohorts</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {cohorts.map(c => (
              <span key={c} style={{ padding: '6px 14px', borderRadius: 20, background: '#F3EDFF', color: '#6D28D9', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {c}
                <button onClick={() => setCohorts(prev => prev.filter(x => x !== c))} style={{ background: 'none', border: 'none', color: '#6D28D9', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
            {cohorts.length === 0 && <span style={{ color: '#7A92B0', fontSize: 13 }}>No cohorts yet.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 400 }}>
            <input value={newCohort} onChange={e => setNewCohort(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCohort.trim()) { setCohorts(p => [...p, newCohort.trim()]); setNewCohort('') } }} placeholder="New cohort name…" style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (newCohort.trim()) { setCohorts(p => [...p, newCohort.trim()]); setNewCohort('') } }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
          </div>
          <p style={{ fontSize: 12, color: '#7A92B0', marginTop: 12 }}>Changes here also affect Cohorts and Assignment Tracker pages.</p>
        </div>
      )}

      {tab === 'docs' && (
        <div style={card}>
          <div style={sectionTitle}>Required Documents</div>
          <p style={{ fontSize: 13, color: '#7A92B0', marginBottom: 16 }}>These document types are required for all applicants. Used in the Admissions checklist and Alerts system.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {requiredDocs.map(d => (
              <span key={d} style={{ padding: '6px 14px', borderRadius: 20, background: '#E6F4FF', color: '#0369A1', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                📄 {d}
                <button onClick={() => setRequiredDocs(prev => prev.filter(x => x !== d))} style={{ background: 'none', border: 'none', color: '#0369A1', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
            {requiredDocs.length === 0 && <span style={{ color: '#7A92B0', fontSize: 13 }}>No required documents configured.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
            <input value={newDoc} onChange={e => setNewDoc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newDoc.trim()) { setRequiredDocs(p => [...p, newDoc.trim()]); setNewDoc('') } }} placeholder="e.g. Birth Certificate, Immunization Records…" style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (newDoc.trim()) { setRequiredDocs(p => [...p, newDoc.trim()]); setNewDoc('') } }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1A365E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ marginTop: 16, padding: 14, background: '#FFF6E0', borderRadius: 10, border: '1px solid #FFE4A0', fontSize: 12, color: '#B45309' }}>
            💡 Common documents: Birth Certificate, Immunization Records, Prior School Transcript, Passport / ID Copy, Medical Form, Recommendation Letter, Emergency Contact Form, Technology Agreement
          </div>
        </div>
      )}

      {tab === 'grading' && (
        <div style={card}>
          <div style={sectionTitle}>Grading</div>
          <div style={{ maxWidth: 320 }}>
            <div><label style={lbl}>Graduation Credits Required</label><input type="number" min={0} value={graduationCredits} onChange={e => setGraduationCredits(e.target.value)} style={inp} placeholder="e.g. 24" /></div>
            <div style={{ marginTop: 16 }}><label style={lbl}>Associate Degree Credits Required</label><input type="number" min={0} value={associateDegreeCredits} onChange={e => setAssociateDegreeCredits(e.target.value)} style={inp} placeholder="e.g. 60" /></div>
            <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: '#F7F9FC', border: '1px solid #E4EAF2' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', marginBottom: 10 }}>Standard Grading Scale</div>
              {[['A+','97-100','4.0'],['A','93-96','4.0'],['A-','90-92','3.7'],['B+','87-89','3.3'],['B','83-86','3.0'],['B-','80-82','2.7'],['C+','77-79','2.3'],['C','73-76','2.0'],['C-','70-72','1.7'],['D','60-69','1.0'],['F','0-59','0.0']].map(([g, r, gpa]) => (
                <div key={g} style={{ display: 'flex', gap: 16, fontSize: 13, padding: '3px 0', borderBottom: '1px solid #F0F4F8' }}>
                  <span style={{ width: 28, fontWeight: 700, color: '#1A365E' }}>{g}</span>
                  <span style={{ flex: 1, color: '#7A92B0' }}>{r}</span>
                  <span style={{ color: '#1A365E', fontWeight: 600 }}>{gpa} GPA</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
