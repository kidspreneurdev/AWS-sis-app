import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { useCampusFilter } from '@/hooks/useCampusFilter'

const TRANSCRIPT_NUMERAL_FONT = 'Cambria, "Times New Roman", serif'
const transcriptNumStyle: React.CSSProperties = {
  fontFamily: TRANSCRIPT_NUMERAL_FONT,
  fontVariantNumeric: 'lining-nums tabular-nums',
}

function renderTranscriptText(value: unknown) {
  return String(value ?? '')
    .split(/(\d[\d.,]*)/g)
    .filter(Boolean)
    .map((part, idx) => /\d/.test(part)
      ? <span key={`${part}-${idx}`} style={transcriptNumStyle}>{part}</span>
      : part)
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GRADE_PTS: Record<string, number | null> = {
  'A':4.0,'B':3.0,'B-':2.5,'C':2.0,'D':1.0,'F':0.0,
  'P':null,'W':null,'I':null,'IP':null,
}
// B- is only valid for STD courses (GCSE 9-1 transfer learners)
const GRADE_OPTS = ['A','B','B-','C','D','F','P','W','I','IP']

const COURSE_TYPES = ['STD','HON','AP','IB','DE','EC','CR'] as const
type CourseType = typeof COURSE_TYPES[number]
const TYPE_LABEL: Record<CourseType,string> = {
  STD:'Standard',HON:'Honors',AP:'AP',IB:'IB',DE:'Dual Enrollment',EC:'Early College',CR:'Credit Recovery',
}
const TYPE_COLOR: Record<CourseType,string> = {
  STD:'#1A365E',HON:'#0A6B64',AP:'#7040CC',IB:'#C47A00',DE:'#0369A1',EC:'#0EA5E9',CR:'#D61F31',
}
const TYPE_WEIGHT: Record<CourseType,number> = { STD:0,HON:0.5,AP:1.0,IB:1.0,DE:1.0,EC:1.0,CR:0 }

const COURSE_STATUS = ['Completed','In Progress','Assigned','Not Started','Withdrawn'] as const
type CourseStatus = typeof COURSE_STATUS[number]
const STATUS_META: Record<CourseStatus,{bg:string;tc:string;icon:string}> = {
  'Completed':    {bg:'#DCFCE7',tc:'#166534',icon:'✓'},
  'In Progress':  {bg:'#DBEAFE',tc:'#1E40AF',icon:'↻'},
  'Assigned':     {bg:'#FEF3C7',tc:'#92400E',icon:'📋'},
  'Not Started':  {bg:'#F3F4F6',tc:'#6B7280',icon:'○'},
  'Withdrawn':    {bg:'#FEE2E2',tc:'#991B1B',icon:'✕'},
}

const SUBJECT_AREAS = ['Language Arts','Mathematics','Science','Social Studies','Fine Arts','PE or Health','Electives','World Language','Technology','Other']

const DURATION_OPTS = ['Full Year','Semester','Summer']
const GRADE_LEVELS = ['Grade 9','Grade 10','Grade 11','Grade 12']
const SCHOOL_YEARS = ['2022-2023','2023-2024','2024-2025','2025-2026','2026-2027']

const GRAD_REQS = [
  {key:'ELA', label:'Language Arts', required:4, area:'Language Arts', color:'#2563EB', icon:'📖', category:'core',
   mandatory:['Language Arts 9','Language Arts 10','Language Arts 11','Language Arts 12'],
   mandatoryNote:'LA 9, 10, 11, 12 all required'},
  {key:'MATH',label:'Mathematics',   required:4, area:'Mathematics',   color:'#7C3AED', icon:'🔢', category:'core',
   mandatory:['Algebra 1','Geometry'],
   mandatoryNote:'Algebra 1 & Geometry required'},
  {key:'SCI', label:'Science',       required:3, area:'Science',       color:'#059669', icon:'🔬', category:'core',
   mandatory:['Biology'],
   mandatoryNote:'Biology required'},
  {key:'SS',  label:'Social Studies',required:3, area:'Social Studies',color:'#D97706', icon:'🌍', category:'core',
   mandatory:['World History','US History','American Government'],
   mandatoryNote:'World History, US History & American Government required'},
  {key:'ARTS',label:'Fine Arts',     required:1, area:'Fine Arts',     color:'#DB2777', icon:'🎨', category:'elective', mandatory:[],mandatoryNote:'Art, Music, Theatre or equivalent'},
  {key:'PE',  label:'PE or Health',  required:1, area:'PE or Health',  color:'#16A34A', icon:'🏃', category:'elective', mandatory:[],mandatoryNote:'PE or Health'},
  {key:'ELEC',label:'Free Electives',required:8, area:'Electives',     color:'#6B7280', icon:'⭐', category:'elective', mandatory:[],mandatoryNote:'Any discipline'},
]
type GradReq = (typeof GRAD_REQS)[number]
const TOTAL_CREDITS = 24

const DE_CORE_AREAS = ['Language Arts','Mathematics','Science','Social Studies']
function deHsToCollege(hsCredits: number, area: string) {
  return Math.round(hsCredits * (DE_CORE_AREAS.includes(area) ? 4 : 3) * 10) / 10
}

const COMPETENCIES = {
  entrepreneurial: [
    {key:'opportunity',label:'Opportunity Recognition'},
    {key:'risk',label:'Risk Assessment'},
    {key:'resourcefulness',label:'Resourcefulness'},
    {key:'pitching',label:'Pitching & Persuasion'},
    {key:'financialLiteracy',label:'Financial Literacy'},
  ],
  academic: [
    {key:'criticalAnalysis',label:'Critical Analysis'},
    {key:'quantReasoning',label:'Quantitative Reasoning'},
    {key:'scientificMethod',label:'Scientific Method'},
    {key:'communication',label:'Communication'},
    {key:'research',label:'Research Skills'},
  ],
  leadership: [
    {key:'decisionMaking',label:'Decision Making'},
    {key:'teamCollab',label:'Team Collaboration'},
    {key:'conflictResolution',label:'Conflict Resolution'},
    {key:'empathy',label:'Empathy'},
    {key:'influence',label:'Influence & Leadership'},
  ],
  global: [
    {key:'crossCultural',label:'Cross-Cultural Communication'},
    {key:'systemsThinking',label:'Systems Thinking'},
    {key:'ethicalReasoning',label:'Ethical Reasoning'},
    {key:'digitalFluency',label:'Digital Fluency'},
    {key:'sustainability',label:'Sustainability Mindset'},
  ],
}
const COMP_COLORS = { entrepreneurial:'#FAC600', academic:'#1A365E', leadership:'#D61F31', global:'#0A6B64' }
const SKILL_LABELS = ['Not Assessed','Beginning','Developing','Proficient','Advanced','Expert']

const DEFAULT_CATALOG = [
  {code:'ELA9',  title:'English 9',              type:'STD',area:'Language Arts',  credits:1},
  {code:'ELA9H', title:'English 9 Honors',       type:'HON',area:'Language Arts',  credits:1},
  {code:'ELA10', title:'English 10',             type:'STD',area:'Language Arts',  credits:1},
  {code:'ELA10H',title:'English 10 Honors',      type:'HON',area:'Language Arts',  credits:1},
  {code:'APLANG',title:'AP Language & Comp',     type:'AP', area:'Language Arts',  credits:1},
  {code:'APLIT', title:'AP Literature & Comp',   type:'AP', area:'Language Arts',  credits:1},
  {code:'ELA12', title:'English 12 / Sr Seminar',type:'STD',area:'Language Arts',  credits:1},
  {code:'ALG1',  title:'Algebra I',              type:'STD',area:'Mathematics',    credits:1},
  {code:'GEOM',  title:'Geometry',               type:'STD',area:'Mathematics',    credits:1},
  {code:'ALG2',  title:'Algebra II',             type:'STD',area:'Mathematics',    credits:1},
  {code:'PREC',  title:'Pre-Calculus',           type:'STD',area:'Mathematics',    credits:1},
  {code:'APCALC',title:'AP Calculus AB',         type:'AP', area:'Mathematics',    credits:1},
  {code:'APSTAT',title:'AP Statistics',          type:'AP', area:'Mathematics',    credits:1},
  {code:'BIO',   title:'Biology (Lab)',           type:'STD',area:'Science',        credits:1,lab:true},
  {code:'CHEM',  title:'Chemistry (Lab)',         type:'STD',area:'Science',        credits:1,lab:true},
  {code:'PHYS',  title:'Physics (Lab)',           type:'STD',area:'Science',        credits:1,lab:true},
  {code:'APBIO', title:'AP Biology (Lab)',        type:'AP', area:'Science',        credits:1,lab:true},
  {code:'APCHEM',title:'AP Chemistry (Lab)',      type:'AP', area:'Science',        credits:1,lab:true},
  {code:'WHIST', title:'World History',          type:'STD',area:'Social Studies', credits:1},
  {code:'USHIST',title:'US History',             type:'STD',area:'Social Studies', credits:1},
  {code:'APUSH', title:'AP US History',          type:'AP', area:'Social Studies', credits:1},
  {code:'GOVT',  title:'Government & Economics', type:'STD',area:'Social Studies', credits:1},
  {code:'APGOV', title:'AP Gov & Politics',      type:'AP', area:'Social Studies', credits:1},
  {code:'PSYCH', title:'AP Psychology',          type:'AP', area:'Social Studies', credits:1},
  {code:'ART',   title:'Visual Arts',            type:'STD',area:'Fine Arts',      credits:1},
  {code:'MUSIC', title:'Music',                  type:'STD',area:'Fine Arts',      credits:1},
  {code:'PE1',   title:'Physical Education',     type:'STD',area:'PE or Health',   credits:1},
  {code:'HEALTH',title:'Health',                 type:'STD',area:'PE or Health',   credits:0.5},
  {code:'SPAN1', title:'Spanish I',              type:'STD',area:'World Language', credits:1},
  {code:'SPAN2', title:'Spanish II',             type:'STD',area:'World Language', credits:1},
  {code:'CS1',   title:'Computer Science',       type:'STD',area:'Technology',     credits:1},
  {code:'APCS',  title:'AP Computer Science A',  type:'AP', area:'Technology',     credits:1},
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface CourseRecord {
  _id: string
  studentId: string
  code: string
  title: string
  type: CourseType
  area: string
  year: string
  semester: string
  gradeLevel: string
  creditsAttempted: number
  creditsEarned: number
  grade: string
  courseStatus: CourseStatus
  apScore: number | null
  instructor: string
  section: string
  notes: string
}

interface TransferCredit {
  _id: string
  studentId: string
  kind: 'DE' | 'TR'
  origTitle: string
  origGrade: string
  creditsAwarded: number
  area: string
  gradeLevel: string
  sourceSchool: string
  sourceLocation: string
  accreditation: string
  notes: string
  status: 'Approved' | 'Pending' | 'Denied'
}

interface CatalogCourse {
  code: string; title: string; type: string; area: string; credits: number; lab?: boolean; gradeLevel?: string
}
const CATALOG_GRADE_LEVELS = ['All','Grade 9','Grade 10','Grade 11','Grade 12']
const ACCREDITATION_OPTS = ['','EC Program','WASC','NEASC','CDE','Regional University','Foreign — IB','Foreign — Other']

type SkillScores = Record<string, number>

interface Student { id: string; studentId: string; name: string; grade: string; dob: string; campus: string; nationality: string; cohort: string; notes: string }

// ─── Supabase row-mapping helpers ─────────────────────────────────────────────
function rowToCourse(r: Record<string,unknown>): CourseRecord {
  return {
    _id: r.id as string,
    studentId: r.student_id as string,
    code: (r.catalog_code as string) ?? '',
    title: (r.title as string) ?? '',
    type: (r.type as CourseType) ?? 'STD',
    area: (r.area as string) ?? '',
    year: (r.academic_year as string) ?? '',
    semester: (r.term as string) ?? '',
    gradeLevel: (r.grade_level as string) ?? 'Grade 9',
    creditsAttempted: Number(r.credits ?? 1),
    creditsEarned: Number(r.credits_earned ?? 1),
    grade: (r.grade_letter as string) ?? '',
    courseStatus: (r.course_status as CourseStatus) ?? 'In Progress',
    apScore: r.ap_score !== null ? Number(r.ap_score) : null,
    instructor: (r.instructor as string) ?? '',
    section: (r.section as string) ?? '',
    notes: (r.notes as string) ?? '',
  }
}

function rowToTransfer(r: Record<string,unknown>): TransferCredit {
  return {
    _id: r.id as string,
    studentId: r.student_id as string,
    kind: ((r.kind as string) ?? 'TR') as 'DE' | 'TR',
    origTitle: (r.orig_title as string) ?? '',
    origGrade: (r.orig_grade as string) ?? '',
    creditsAwarded: Number(r.credits_awarded ?? 1),
    area: (r.area as string) ?? '',
    gradeLevel: (r.grade_level as string) ?? '',
    sourceSchool: (r.source_school as string) ?? '',
    sourceLocation: (r.source_location as string) ?? '',
    accreditation: (r.accreditation as string) ?? '',
    notes: (r.notes as string) ?? '',
    status: ((r.status as string) ?? 'Pending') as 'Approved' | 'Pending' | 'Denied',
  }
}

function rowToCatalog(r: Record<string,unknown>): CatalogCourse {
  return {
    code: r.code as string,
    title: r.title as string,
    type: (r.type as string) ?? 'STD',
    area: (r.area as string) ?? '',
    credits: Number(r.credits ?? 1),
    lab: r.lab === true,
    gradeLevel: (r.grade_level as string) ?? 'All',
  }
}

// ─── GPA helpers ─────────────────────────────────────────────────────────────
function getBasePts(grade: string) { const v = GRADE_PTS[grade]; return (v === undefined) ? null : v }
function getWeightedPts(grade: string, type: CourseType): number | null {
  if (grade === 'B-' && type !== 'STD' && type !== 'CR') return null
  const base = getBasePts(grade); if (base === null) return null
  if (base === 0) return 0
  return Math.round((base + (TYPE_WEIGHT[type]||0)) * 100) / 100
}
function calcGPA(courses: CourseRecord[]): number {
  let tot = 0, pts = 0
  courses.forEach(c => {
    if (c.courseStatus !== 'Completed') return
    const bp = getBasePts(c.grade); if (bp === null) return
    const cr = c.creditsEarned || 0; if (!cr) return
    tot += cr; pts += bp * cr
  })
  return tot ? Math.round(pts/tot*100)/100 : 0
}
function calcWeightedGPA(courses: CourseRecord[]): number {
  let tot = 0, pts = 0
  courses.forEach(c => {
    if (c.courseStatus !== 'Completed') return
    const wp = getWeightedPts(c.grade, c.type); if (wp === null) return
    const cr = c.creditsEarned || 0; if (!cr) return
    tot += cr; pts += wp * cr
  })
  return tot ? Math.round(pts/tot*100)/100 : 0
}
function calcUCGPA(courses: CourseRecord[]): number {
  const core = ['Language Arts','Mathematics','Science','Social Studies']
  return calcWeightedGPA(courses.filter(c => core.includes(c.area)))
}
function getGradCredits(courses: CourseRecord[], transfers: TransferCredit[]) {
  const result: Record<string, number> = { total: 0, deCredits: 0, deCollegeCredits: 0, pendingTotal: 0 }
  GRAD_REQS.forEach(r => { result[r.key] = 0; result[r.key+'_pending'] = 0 })
  const transCourses = transfers.filter(t => t.status === 'Approved').map(t => ({
    area: t.area || 'Electives', creditsEarned: t.creditsAwarded, grade: 'TR', type: 'TR' as CourseType, _transfer: true
  }))
  courses.forEach(c => {
    const pending = !c.grade || c.grade === 'IP'
    if (c.grade === 'F') return
    const e = c.creditsEarned || 0
    const p = pending ? (c.creditsAttempted || 0) : 0
    if (pending) {
      result.pendingTotal += p
      let matched = false
      GRAD_REQS.forEach(r => { if (c.area === r.area) { result[r.key+'_pending'] += p; matched = true } })
      if (!matched) result['ELEC_pending'] += p
      return
    }
    if (!e) return
    result.total += e
    if (c.type === 'DE' || c.type === 'EC') {
      result.deCredits += e
      result.deCollegeCredits += deHsToCollege(e, c.area)
    }
    let matched = false
    GRAD_REQS.forEach(r => { if (c.area === r.area) { result[r.key] += e; matched = true } })
    if (!matched) result['ELEC'] += e
  })
  transCourses.forEach(c => {
    const e = c.creditsEarned || 0; if (!e) return
    result.total += e
    let matched = false
    GRAD_REQS.forEach(r => { if (c.area === r.area) { result[r.key] += e; matched = true } })
    if (!matched) result['ELEC'] += e
  })
  return result
}
function getDistinction(wgpa: number, courses: CourseRecord[]) {
  const apCount = courses.filter(c => c.type === 'AP' || c.type === 'IB').length
  if (wgpa >= 4.0 && apCount >= 4) return { label:'Summa Cum Laude', col:'#D4AF37', bg:'#FFFBEA' }
  if (wgpa >= 3.75 && apCount >= 2) return { label:'Magna Cum Laude', col:'#A8A9AD', bg:'#F5F5F5' }
  if (wgpa >= 3.5) return { label:'Cum Laude', col:'#CD7F32', bg:'#FFF3E8' }
  return null
}
function gpaColor(g: number) { return g >= 3.5 ? '#059669' : g >= 2.5 ? '#F5A623' : '#D61F31' }



// ─── Skill Radar Chart ────────────────────────────────────────────────────────
function SkillRadar({ scores }: { scores: SkillScores }) {
  const allComps = [
    ...COMPETENCIES.entrepreneurial,
    ...COMPETENCIES.academic,
    ...COMPETENCIES.leadership,
    ...COMPETENCIES.global,
  ]
  const n = allComps.length
  const cx = 160, cy = 160, maxR = 115, levels = 5
  const angle = (i: number) => (2 * Math.PI * i / n) - Math.PI / 2
  const pt = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) })

  const gridPolygons = Array.from({ length: levels }, (_, li) => {
    const r = maxR * (li + 1) / levels
    return allComps.map((_, j) => { const p = pt(j, r); return `${p.x},${p.y}` }).join(' ')
  })

  const scorePolygon = allComps.map((c, j) => {
    const val = Math.max(0, scores[c.key] || 0)
    const r = maxR * val / 5
    const p = pt(j, r); return `${p.x},${p.y}`
  }).join(' ')

  const catOrder = ['entrepreneurial', 'academic', 'leadership', 'global'] as const
  const catColors = allComps.map((_, j) => COMP_COLORS[catOrder[Math.floor(j / 5)]])

  return (
    <svg width="320" height="320" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#E4EAF2" strokeWidth={i === levels - 1 ? 1.5 : 0.75} />
      ))}
      {allComps.map((_, j) => {
        const p = pt(j, maxR)
        return <line key={j} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E4EAF2" strokeWidth={0.5} />
      })}
      <polygon points={scorePolygon} fill="rgba(26,54,94,0.12)" stroke="#1A365E" strokeWidth={2} strokeLinejoin="round" />
      {allComps.map((c, j) => {
        const val = Math.max(0, scores[c.key] || 0)
        const r = maxR * val / 5
        const p = pt(j, r)
        return <circle key={j} cx={p.x} cy={p.y} r={val > 0 ? 4 : 2} fill={catColors[j]} stroke="#fff" strokeWidth={1.5} />
      })}
      {[1, 2, 3, 4, 5].map(lvl => (
        <text key={lvl} x={cx + 4} y={cy - maxR * lvl / 5 - 2} fontSize={8} fill="#BDD0E8">{lvl}</text>
      ))}
      {allComps.map((c, j) => {
        const p = pt(j, maxR + 16)
        const anchor = p.x < cx - 4 ? 'end' : p.x > cx + 4 ? 'start' : 'middle'
        const short = c.label.split(' ')[0]
        return <text key={j} x={p.x} y={p.y + 3} fontSize={8} fill="#7A92B0" textAnchor={anchor}>{short}</text>
      })}
    </svg>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background:'#fff', borderRadius:12, border:'1px solid #E4EAF2', boxShadow:'0 1px 4px rgba(26,54,94,0.06)' }
const th: React.CSSProperties = { padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #E4EAF2', whiteSpace:'nowrap' }
const td: React.CSSProperties = { padding:'9px 12px', fontSize:13, color:'#1A365E', borderBottom:'1px solid #F0F4F8', verticalAlign:'middle' }
const inp: React.CSSProperties = { padding:'7px 10px', borderRadius:7, border:'1px solid #E4EAF2', fontSize:13, color:'#1A365E', background:'#fff', width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' }
const sel: React.CSSProperties = { ...inp }

// ─── Empty course ─────────────────────────────────────────────────────────────
function emptyCourseDraft(studentId: string): CourseRecord {
  return { _id: crypto.randomUUID(), studentId, code:'', title:'', type:'STD', area:'Language Arts', year:'2025-2026', semester:'Full Year', gradeLevel:'Grade 9', creditsAttempted:1, creditsEarned:1, grade:'', courseStatus:'In Progress', apScore:null, instructor:'', section:'', notes:'' }
}
function emptyTransferDraft(studentId: string): TransferCredit {
  return { _id: crypto.randomUUID(), studentId, kind:'DE', origTitle:'', origGrade:'', creditsAwarded:1, area:'Language Arts', gradeLevel:'', sourceSchool:'', sourceLocation:'', accreditation:'', notes:'', status:'Pending' }
}

// ─── Course Modal ─────────────────────────────────────────────────────────────
function CourseModal({ draft, catalog, onChange, onSave, onClose }: {
  draft: CourseRecord; catalog: CatalogCourse[]
  onChange: (d: CourseRecord) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof CourseRecord>(k: K, v: CourseRecord[K]) { onChange({ ...draft, [k]: v }) }
  function quickFill(code: string) {
    const c = catalog.find(x => x.code === code); if (!c) return
    onChange({ ...draft, code: c.code, title: c.title, type: c.type as CourseType, area: c.area, creditsAttempted: c.credits, creditsEarned: c.credits })
  }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(10,25,50,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:600, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background:'linear-gradient(135deg,#0F2240,#1A365E)', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>Course Record</div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Quick Fill from Catalog</label>
            <select style={sel} value="" onChange={e => quickFill(e.target.value)}>
              <option value="">— Select course to auto-fill —</option>
              {catalog.map(c => <option key={c.code} value={c.code}>{c.code} — {c.title} ({c.type})</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {([['code','Course Code'],['title','Course Title']] as [keyof CourseRecord,string][]).map(([k,l]) => (
              <div key={k}><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>{l}</label>
                <input style={inp} value={String(draft[k]??'')} onChange={e => set(k, e.target.value as CourseRecord[typeof k])} /></div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Type</label>
              <select style={sel} value={draft.type} onChange={e => set('type', e.target.value as CourseType)}>
                {COURSE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Subject Area</label>
              <select style={sel} value={draft.area} onChange={e => set('area', e.target.value)}>
                {SUBJECT_AREAS.map(a => <option key={a}>{a}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>School Year</label>
              <select style={sel} value={draft.year} onChange={e => set('year', e.target.value)}>
                {SCHOOL_YEARS.map(y => <option key={y}>{y}</option>)}
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Duration</label>
              <select style={sel} value={draft.semester} onChange={e => set('semester', e.target.value)}>
                {DURATION_OPTS.map(d => <option key={d}>{d}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Grade Level</label>
              <select style={sel} value={draft.gradeLevel} onChange={e => set('gradeLevel', e.target.value)}>
                {GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Status</label>
              <select style={sel} value={draft.courseStatus} onChange={e => set('courseStatus', e.target.value as CourseStatus)}>
                {COURSE_STATUS.map(s => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Cr. Attempted</label>
              <input type="number" min={0} max={8} step={0.5} style={inp} value={draft.creditsAttempted} onChange={e => set('creditsAttempted', parseFloat(e.target.value)||0)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Cr. Earned</label>
              <input type="number" min={0} max={8} step={0.5} style={inp} value={draft.creditsEarned} onChange={e => set('creditsEarned', parseFloat(e.target.value)||0)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Final Grade</label>
              <select style={sel} value={draft.grade} onChange={e => set('grade', e.target.value)}>
                <option value="">—</option>
                {GRADE_OPTS.map(g => <option key={g}>{g}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>AP/IB Score</label>
              <input type="number" min={1} max={7} style={inp} value={draft.apScore??''} onChange={e => set('apScore', e.target.value ? parseInt(e.target.value) : null)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Instructor</label>
              <input style={inp} value={draft.instructor} onChange={e => set('instructor', e.target.value)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Section</label>
              <input style={inp} value={draft.section} onChange={e => set('section', e.target.value)} /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Notes</label>
            <textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={draft.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ borderTop:'1px solid #E4EAF2', padding:'12px 20px', display:'flex', justifyContent:'flex-end', gap:8, background:'#F7F9FC' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#1A365E', fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
          <button onClick={onSave} style={{ padding:'8px 24px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Save Course</button>
        </div>
      </div>
    </div>
  )
}

// ─── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({ draft, onChange, onSave, onClose }: {
  draft: TransferCredit; onChange: (d: TransferCredit) => void; onSave: () => void; onClose: () => void
}) {
  function set<K extends keyof TransferCredit>(k: K, v: TransferCredit[K]) { onChange({ ...draft, [k]: v }) }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(10,25,50,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:520, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background:'linear-gradient(135deg,#0F2240,#1A365E)', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>Transfer / DE Credit</div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Type</label>
            <div style={{ display:'flex', gap:8 }}>
              {(['DE','TR'] as const).map(k => (
                <button key={k} onClick={() => set('kind', k)} style={{ flex:1, padding:'8px', borderRadius:8, border:`2px solid ${draft.kind===k?'#D61F31':'#E4EAF2'}`, background:draft.kind===k?'#FFF0F1':'#fff', color:draft.kind===k?'#D61F31':'#1A365E', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  {k === 'DE' ? 'Dual Enrollment / EC' : 'Transfer Credit'}
                </button>
              ))}
            </div></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Original Course Title</label>
              <input style={inp} value={draft.origTitle} onChange={e => set('origTitle', e.target.value)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Original Grade</label>
              <input style={inp} value={draft.origGrade} onChange={e => set('origGrade', e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Credits Awarded</label>
              <input type="number" min={0} max={12} step={0.5} style={inp} value={draft.creditsAwarded} onChange={e => set('creditsAwarded', parseFloat(e.target.value)||0)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Subject Area</label>
              <select style={sel} value={draft.area} onChange={e => set('area', e.target.value)}>
                {SUBJECT_AREAS.map(a => <option key={a}>{a}</option>)}
              </select></div>
          </div>
          {draft.kind === 'DE' && (
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Grade Level <span style={{ color:'#D61F31' }}>*</span></label>
              <select style={sel} value={draft.gradeLevel} onChange={e => set('gradeLevel', e.target.value)}>
                <option value="">— Select Grade Level —</option>
                {GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Source School</label>
              <input style={inp} value={draft.sourceSchool} onChange={e => set('sourceSchool', e.target.value)} /></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Source Location / City</label>
              <input style={inp} placeholder="City, State/Country" value={draft.sourceLocation} onChange={e => set('sourceLocation', e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Accreditation</label>
              <select style={sel} value={draft.accreditation} onChange={e => set('accreditation', e.target.value)}>
                {ACCREDITATION_OPTS.map(a => <option key={a} value={a}>{a || '— Select —'}</option>)}
              </select></div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Status</label>
              <select style={sel} value={draft.status} onChange={e => set('status', e.target.value as TransferCredit['status'])}>
                {(['Approved','Pending','Denied'] as const).map(s => <option key={s}>{s}</option>)}
              </select></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Notes</label>
            <textarea style={{ ...inp, minHeight:56, resize:'vertical' }} value={draft.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ borderTop:'1px solid #E4EAF2', padding:'12px 20px', display:'flex', justifyContent:'flex-end', gap:8, background:'#F7F9FC' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#1A365E', fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
          <button onClick={onSave} style={{ padding:'8px 24px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
  return <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#1A365E,#2D5A8E)', color:'#fff', fontSize:size*0.35, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{initials}</div>
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'overview'|'studentov'|'courses'|'gpa'|'graduation'|'skills'|'transfer'|'transcript'|'catalog'
const TABS: {id:Tab; label:string; icon:string}[] = [
  {id:'overview',   label:'Overview',        icon:'📊'},
  {id:'studentov',  label:'Student Overview',icon:'🎒'},
  {id:'courses',    label:'Course Records',  icon:'📚'},
  {id:'gpa',        label:'GPA & Weighting', icon:'🎯'},
  {id:'graduation', label:'Graduation Audit',icon:'🎓'},
  {id:'skills',     label:'Skill Graph',     icon:'🧠'},
  {id:'transfer',   label:'Transfer & EC',   icon:'🏛️'},
  {id:'transcript', label:'Transcript',      icon:'📄'},
  {id:'catalog',    label:'Course Catalog',  icon:'⚙️'},
]

export function GradesHSPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('overview')
  const [courses, setCourses] = useState<CourseRecord[]>([])
  const [transfers, setTransfers] = useState<TransferCredit[]>([])
  const [catalog, setCatalog] = useState<CatalogCourse[]>(DEFAULT_CATALOG.map(c=>({...c})) as CatalogCourse[])
  const [skillScores, setSkillScores] = useState<SkillScores>({})
  const [skillSaved, setSkillSaved] = useState(false)
  const [courseModal, setCourseModal] = useState<CourseRecord|null>(null)
  const [transferModal, setTransferModal] = useState<TransferCredit|null>(null)
  const [catalogDraft, setCatalogDraft] = useState<CatalogCourse|null>(null)
  const [gradBreakdownKey, setGradBreakdownKey] = useState<string | null>(null)
  const [academicYear, setAcademicYear] = useState('2025–2026')
  const [graduationCreditsRequired, setGraduationCreditsRequired] = useState(24)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadAll() {
      // Load students
      let sQuery = supabase.from('students').select('id,student_id,first_name,last_name,grade,date_of_birth,campus,nationality,cohort,notes').eq('status','Enrolled').in('grade',['9','10','11','12'])
      if (cf) sQuery = sQuery.eq('campus', cf)
      const { data: stData } = await sQuery
      if (stData) {
        const list = stData.map((r: Record<string,unknown>) => ({
          id: r.id as string,
          studentId: (r.student_id as string) ?? '',
          name: `${r.first_name} ${r.last_name}`,
          grade: String(r.grade),
          dob: (r.date_of_birth as string) ?? '',
          campus: (r.campus as string) ?? '',
          nationality: (r.nationality as string) ?? '',
          cohort: (r.cohort as string) ?? '',
          notes: (r.notes as string) ?? '',
        }))
        setStudents(list)
        if (list.length && !selectedId) setSelectedId(list[0].id)
      }
      // Load courses
      const { data: cData } = await supabase.from('courses').select('*')
      if (cData) setCourses(cData.map(rowToCourse))
      // Load transfers
      const { data: tData } = await supabase.from('transfer_credits').select('*')
      if (tData) setTransfers(tData.map(rowToTransfer))
      // Load catalog
      const { data: catData } = await supabase.from('catalog').select('*')
      if (catData && catData.length) setCatalog(catData.map(rowToCatalog))
      // Load settings
      const { data: settingsData } = await supabase.from('settings').select('academic_year,graduation_credits').single()
      if (settingsData) {
        if (settingsData.academic_year) setAcademicYear(settingsData.academic_year)
        if (settingsData.graduation_credits) setGraduationCreditsRequired(Number(settingsData.graduation_credits))
      }
    }
    loadAll()
  }, [cf])

  useEffect(() => {
    if (!selectedId) return
    supabase.from('hs_skill_scores').select('scores').eq('student_id', selectedId).single()
      .then(({ data }) => {
        if (data) setSkillScores((data.scores as SkillScores) ?? {})
        else setSkillScores({})
      })
  }, [selectedId])

  const student = students.find(s => s.id === selectedId)
  const studentCourses = useMemo(() => courses.filter(c => c.studentId === selectedId), [courses, selectedId])
  const studentTransfers = useMemo(() => transfers.filter(t => t.studentId === selectedId), [transfers, selectedId])
  const selectedGradReq = useMemo<GradReq | null>(() => {
    if (!gradBreakdownKey) return null
    return GRAD_REQS.find(r => r.key === gradBreakdownKey) ?? null
  }, [gradBreakdownKey])
  const gradBreakdown = useMemo(() => {
    if (!selectedGradReq) return null
    type BreakdownItem = {
      id: string
      title: string
      source: string
      area: string
      grade: string
      credits: number
    }
    const getReqKeyFromArea = (area: string) => {
      const match = GRAD_REQS.find(r => r.area === area)
      return match ? match.key : 'ELEC'
    }
    const earnedItems: BreakdownItem[] = []
    const pendingItems: BreakdownItem[] = []

    studentCourses.forEach(c => {
      const area = c.area || 'Electives'
      const reqKey = getReqKeyFromArea(area)
      if (reqKey !== selectedGradReq.key) return
      const pending = !c.grade || c.grade === 'IP'
      if (pending) {
        const attempted = parseFloat(String(c.creditsAttempted)) || 0
        if (attempted > 0) {
          pendingItems.push({
            id: c._id,
            title: c.title || 'Untitled course',
            source: c.type === 'DE' || c.type === 'EC' ? 'Course (EC/DE)' : 'Course',
            area,
            grade: c.grade || 'IP',
            credits: attempted,
          })
        }
        return
      }
      if (c.grade === 'F') return
      const earned = parseFloat(String(c.creditsEarned)) || 0
      if (earned <= 0) return
      earnedItems.push({
        id: c._id,
        title: c.title || 'Untitled course',
        source: c.type === 'DE' || c.type === 'EC' ? 'Course (EC/DE)' : 'Course',
        area,
        grade: c.grade || '—',
        credits: earned,
      })
    })

    studentTransfers
      .filter(t => t.status === 'Approved')
      .forEach(t => {
        const area = t.area || 'Electives'
        const reqKey = getReqKeyFromArea(area)
        if (reqKey !== selectedGradReq.key) return
        const earned = parseFloat(String(t.creditsAwarded)) || 0
        if (earned <= 0) return
        earnedItems.push({
          id: t._id,
          title: t.origTitle || 'Transfer credit',
          source: t.kind === 'DE' ? 'Transfer (DE)' : 'Transfer',
          area,
          grade: t.origGrade || 'TR',
          credits: earned,
        })
      })

    earnedItems.sort((a, b) => a.title.localeCompare(b.title))
    pendingItems.sort((a, b) => a.title.localeCompare(b.title))

    const earnedTotal = Math.round(earnedItems.reduce((sum, item) => sum + item.credits, 0) * 10) / 10
    const pendingTotal = Math.round(pendingItems.reduce((sum, item) => sum + item.credits, 0) * 10) / 10
    const remainingAfterPending = Math.max(0, selectedGradReq.required - earnedTotal - pendingTotal)

    return { earnedItems, pendingItems, earnedTotal, pendingTotal, remainingAfterPending }
  }, [selectedGradReq, studentCourses, studentTransfers])

  async function saveCourseModal() {
    if (!courseModal) return
    const payload = {
      id: courseModal._id,
      student_id: courseModal.studentId,
      catalog_code: courseModal.code || null,
      title: courseModal.title,
      type: courseModal.type,
      area: courseModal.area,
      academic_year: courseModal.year,
      term: courseModal.semester,
      grade_level: courseModal.gradeLevel,
      credits: courseModal.creditsAttempted,
      credits_earned: courseModal.creditsEarned,
      grade_letter: courseModal.grade,
      course_status: courseModal.courseStatus,
      ap_score: courseModal.apScore,
      instructor: courseModal.instructor,
      section: courseModal.section,
      notes: courseModal.notes,
    }
    const { error } = await supabase.from('courses').upsert(payload, { onConflict: 'id' })
    if (error) { alert('Save failed: ' + error.message); return }
    setCourses(prev => {
      const exists = prev.find(c => c._id === courseModal._id)
      return exists ? prev.map(c => c._id === courseModal._id ? courseModal : c) : [...prev, courseModal]
    })
    setCourseModal(null)
  }

  async function deleteCourse(id: string) {
    if (!confirm('Delete this course record?')) return
    await supabase.from('courses').delete().eq('id', id)
    setCourses(prev => prev.filter(c => c._id !== id))
  }

  async function saveTransferModal() {
    if (!transferModal) return
    const payload = {
      id: transferModal._id,
      student_id: transferModal.studentId,
      kind: transferModal.kind,
      orig_title: transferModal.origTitle,
      orig_grade: transferModal.origGrade,
      credits_awarded: transferModal.creditsAwarded,
      area: transferModal.area,
      grade_level: transferModal.gradeLevel || null,
      source_school: transferModal.sourceSchool,
      source_location: transferModal.sourceLocation,
      accreditation: transferModal.accreditation,
      notes: transferModal.notes,
      status: transferModal.status,
    }
    const { error } = await supabase.from('transfer_credits').upsert(payload, { onConflict: 'id' })
    if (error) { alert('Save failed: ' + error.message); return }
    setTransfers(prev => {
      const exists = prev.find(t => t._id === transferModal._id)
      return exists ? prev.map(t => t._id === transferModal._id ? transferModal : t) : [...prev, transferModal]
    })
    setTransferModal(null)
  }

  async function deleteTransfer(id: string) {
    if (!confirm('Delete this credit?')) return
    await supabase.from('transfer_credits').delete().eq('id', id)
    setTransfers(prev => prev.filter(t => t._id !== id))
  }

  async function approveTransfer(id: string) {
    await supabase.from('transfer_credits').update({ status: 'Approved' }).eq('id', id)
    setTransfers(prev => prev.map(t => t._id === id ? { ...t, status: 'Approved' as const } : t))
  }

  async function updateSkill(key: string, val: number) {
    const next = { ...skillScores, [key]: val }
    setSkillScores(next)
    setSkillSaved(true)
    setTimeout(() => setSkillSaved(false), 1800)
    await supabase.from('hs_skill_scores').upsert({ student_id: selectedId, scores: next }, { onConflict: 'student_id' })
  }

  function exportTranscriptPDF() {
    if (!student) return
    const win = window.open('', '_blank', 'width=960,height=820,scrollbars=yes,resizable=yes')
    if (!win) { alert('Please allow pop-ups for this site to use the print feature.'); return }
    const h = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

    const gradedCourses = studentCourses.filter(c =>
      c.grade && !['','IP','W','I'].includes(c.grade)
    )
    const deTransferIds = new Set<string>()
    const deTransferRecords: CourseRecord[] = studentTransfers
      .filter(t => t.status === 'Approved' && t.kind === 'DE' && t.gradeLevel && t.origGrade && !['','IP','W','I'].includes(t.origGrade))
      .map(t => {
        deTransferIds.add(t._id)
        return {
          _id: t._id, studentId: t.studentId, code: 'DE', title: t.origTitle,
          type: 'DE' as CourseType, area: t.area, year: '', semester: '',
          gradeLevel: t.gradeLevel, creditsAttempted: t.creditsAwarded,
          creditsEarned: t.creditsAwarded, grade: t.origGrade,
          courseStatus: 'Completed' as CourseStatus, apScore: null,
          instructor: '', section: '', notes: '',
        }
      })
    const allGradedCourses = [...gradedCourses, ...deTransferRecords]
    const tGPA = (courses: CourseRecord[]) => {
      let tot = 0, pts = 0
      courses.forEach(x => { const wp = getWeightedPts(x.grade, x.type); if (wp === null) return; const cr = x.creditsEarned || 0; if (!cr) return; tot += cr; pts += wp * cr })
      return tot ? Math.round(pts / tot * 100) / 100 : 0
    }
    const uw = tGPA(allGradedCourses)
    const totCr = Math.round(allGradedCourses.reduce((s, c) => s + (c.creditsEarned || 0), 0) * 10) / 10

    const gradeLevelOrder = ['Grade 9','Grade 10','Grade 11','Grade 12']
    const gradeGroups = gradeLevelOrder
      .map(gl => ({ gl, courses: allGradedCourses.filter(c => c.gradeLevel === gl) }))
      .filter(g => g.courses.length > 0)

    let allSoFarPDF: CourseRecord[] = []
    const cumulativeByGradePDF: Record<string,number> = {}
    gradeGroups.forEach(({ gl, courses }) => {
      allSoFarPDF = [...allSoFarPDF, ...courses]
      cumulativeByGradePDF[gl] = tGPA(allSoFarPDF)
    })

    const dobDisplay = student.dob
      ? new Date(student.dob + 'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
      : '—'
    const gradYear = academicYear.split(/[–\-—]/)[1]?.trim() || String(new Date().getFullYear())
    const issueDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
    const gridCols = gradeGroups.length <= 1 ? '1fr' : gradeGroups.length === 2 ? '1fr 1fr' : '1fr 1fr'

    const gradeTablesHtml = gradeGroups.map(({ gl, courses: gc2 }, idx) => {
      const gradeGPA = tGPA(gc2)
      const cgpa = cumulativeByGradePDF[gl]
      const gradeCredits = Math.round(gc2.reduce((s,c) => s + c.creditsEarned, 0) * 10) / 10
      const rows = gc2.map(c => {
        const wp = getWeightedPts(c.grade, c.type)
        const sym = (c.type==='AP'||c.type==='IB') ? ' &bull;' : c.type==='HON' ? ' &#10003;' : (c.type==='DE'||c.type==='EC') ? ' &#9733;' : ''
        const ind = deTransferIds.has(c._id) ? '(1)' : '(2)'
        return `<tr>
          <td style="padding:3px 5px;font-size:9pt;border-bottom:1px solid #eee"><span style="color:#999;font-size:7.5pt">${ind} </span>${h(c.title)}${sym}</td>
          <td style="text-align:center;padding:3px 5px;font-size:9pt;border-bottom:1px solid #eee">${h(String(c.creditsEarned))}</td>
          <td style="text-align:center;padding:3px 5px;font-size:9pt;font-weight:700;border-bottom:1px solid #eee">${h(c.grade||'—')}</td>
          <td style="text-align:center;padding:3px 5px;font-size:9pt;border-bottom:1px solid #eee">${wp!==null?wp.toFixed(2):'—'}</td>
        </tr>`
      }).join('')
      return `<div style="border-right:${idx<gradeGroups.length-1?'1px solid #ccc':'none'};padding:10px 12px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1.5px solid #000">
              <th style="text-align:left;font-weight:700;padding:3px 5px;font-size:10pt">${h(gl)}</th>
              <th style="text-align:center;font-weight:700;padding:3px 5px;font-size:9.5pt">Credit</th>
              <th style="text-align:center;font-weight:700;padding:3px 5px;font-size:9.5pt">Grade</th>
              <th style="text-align:center;font-weight:700;padding:3px 5px;font-size:9.5pt">GPA</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="border-top:1.5px solid #000">
              <td colspan="4" style="padding:4px 5px;font-size:9pt;font-weight:700">
                CGPA: ${h(cgpa.toFixed(2))}&nbsp;&nbsp;&nbsp;Total Credits: ${h(String(gradeCredits))}&nbsp;&nbsp;&nbsp;GPA: ${h(gradeGPA.toFixed(2))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>`
    }).join('')

    const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Official Transcript — ${h(student.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Poppins',Arial,sans-serif;font-size:10pt;color:#000;background:#f0f0f0}
  .page{background:#fff;max-width:780px;margin:0 auto;border:1px solid #ccc}
  .toolbar{display:flex;gap:10px;padding:10px 14px;background:#f5f5f5;border-bottom:1px solid #ddd;align-items:center;max-width:780px;margin:0 auto}
  @media print{.toolbar{display:none!important}body{background:#fff}.page{border:none;max-width:100%}@page{size:A4;margin:12mm 14mm}.page-break{page-break-before:always}}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()" style="padding:8px 20px;background:#1A365E;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#fff;color:#333;border:1px solid #ccc;border-radius:6px;font-size:12px;cursor:pointer">✕ Close</button>
  <span style="margin-left:auto;font-size:10px;color:#999">Tip: Enable "Background graphics" in print dialog</span>
</div>

<!-- PAGE 1 -->
<div class="page">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:14px 20px 12px;border-bottom:2px solid #000">
    <div><img src="/Logo_b.png" alt="American World School" style="height:62px;width:auto;object-fit:contain"/></div>
    <div style="text-align:right">
      <div style="font-size:30pt;font-weight:700;letter-spacing:-1px;line-height:1;font-family:'Poppins',Arial,sans-serif">Official Transcript</div>
      <div style="font-size:8.5pt;margin-top:5px;line-height:1.75">
        <span><strong>Official School WASC ID:</strong> 7548950999</span><br/>
        <span><strong>WASC Address:</strong> 533 Airport Boulevard, Suite 200, Burlingame, CA 94010-2009</span><br/>
        <span><strong>Phone:</strong> +1 650 696-1060</span>
      </div>
    </div>
  </div>

  <!-- Student info -->
  <div style="border-bottom:1px solid #ccc;padding:10px 20px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0">
      <div>
        <div style="font-weight:700;font-size:10pt">Student Name:</div>
        <div style="font-size:12pt;font-weight:700;margin-top:2px">${h(student.name)}</div>
      </div>
      <div>
        <div style="font-size:10pt"><strong>Student ID:</strong> ${h(student.studentId||'—')}</div>
        <div style="font-size:10pt;margin-top:4px"><strong>Grade:</strong> ${h(student.grade)}</div>
        <div style="font-size:10pt;margin-top:4px"><strong>Graduation Date:</strong> June ${h(gradYear)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12pt;font-weight:700"><strong>Total Credits:</strong> ${h(String(totCr))}</div>
        <div style="font-size:12pt;font-weight:700;margin-top:4px"><strong>Cumulative GPA:</strong> ${h(uw.toFixed(2))}</div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div style="font-weight:700;font-size:10pt">Date of Birth:</div>
      <div style="font-size:10pt;margin-top:2px">${h(dobDisplay)}</div>
    </div>
  </div>

  <!-- Grade tables -->
  <div style="display:grid;grid-template-columns:${gridCols};border-bottom:1px solid #ccc">
    ${gradeTablesHtml}
  </div>

  <!-- End of transcript -->
  <div style="padding:8px 20px;font-weight:700;font-size:10pt;border-bottom:1px solid #ccc">END OF TRANSCRIPT.</div>

  <!-- WASC stamp + registrar -->
  <div style="display:grid;grid-template-columns:1fr 1fr;padding:14px 20px;gap:20px;border-bottom:1px solid #ccc">
    <div>
      <div style="height:54px;border-bottom:1px solid #000;margin-bottom:6px"></div>
      <div style="font-size:10pt;font-weight:700">Registrar Name: Paul Montague</div>
      <div style="font-size:10pt;margin-top:3px">Date Issued: ${h(issueDate)}</div>
      <div style="display:flex;gap:8px;margin-top:18px;align-items:center">
        <div style="border:1px solid #bbb;border-radius:3px;padding:3px 10px;font-size:8pt;font-weight:700;text-align:center">AI<span style="font-size:9pt">✦</span>ASC</div>
        <div style="border:1px solid #bbb;border-radius:3px;padding:3px 10px;font-size:8pt;font-weight:700;background:#f9f9f9">⊙ WASC</div>
        <div style="border:1px solid #bbb;border-radius:3px;padding:3px 10px;font-size:8pt;font-weight:700">NCPSA</div>
      </div>
    </div>
    <div style="border:1.5px dashed #aaa;border-radius:4px;padding:12px 14px">
      <div style="font-weight:700;font-size:11pt;text-align:center;margin-bottom:8px">WASC ACCREDITATION STAMP</div>
      <div style="font-size:8.5pt;color:#555;line-height:1.65;margin-bottom:12px">Affix the official Western Association of Schools and Colleges physical accreditation stamp in this box before issuance. This transcript is not valid without the stamp.</div>
      <div style="border:1px solid #bbb;height:72px;display:flex;align-items:center;justify-content:center">
        <span style="color:#bbb;font-size:8pt">Official School WASC ID: 7548950999</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:6px 20px;font-size:8pt;color:#555;text-align:center;background:#f9f9f9">
    Address: No 3/171, Nehru Nagar, 1st Main Rd, Rajiv Gandhi Salai, Thiruvengadam Nagar, Perungudi, Chennai, Tamil Nadu 600041 &nbsp;|&nbsp; Phone: +91 82206 06367 &nbsp;|&nbsp; Email: admin@americanworldschool.org
  </div>
</div>

<!-- PAGE 2 -->
<div class="page page-break" style="margin-top:24px">
  <div style="padding:20px 24px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px">
      <div>
        <div style="font-weight:700;font-size:10.5pt;margin-bottom:8px">School (s)</div>
        <div style="font-size:9.5pt">(1) — West Windsor-Plainsboro High School</div>
        <div style="font-size:9.5pt;margin-top:2px">(2) — American World School</div>
      </div>
      <div>
        <div style="font-weight:700;font-size:10.5pt;margin-bottom:8px">Key For Retakes</div>
        <div style="font-size:9.5pt"><em>RP</em> — Replaced Because Retaken</div>
        <div style="font-size:9.5pt;margin-top:2px"><em>RT</em> — Retake</div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div style="font-weight:700;font-size:10.5pt;margin-bottom:8px">Legend for Weighted Courses</div>
      <div style="font-size:9.5pt;display:flex;flex-direction:column;gap:4px">
        <div>&bull; &nbsp; Advanced Placement</div>
        <div>&#9733; &nbsp; College Courses</div>
        <div>&#10003; &nbsp; Honors</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:9.5pt">
        <div><strong>Semester Course = 0.5 credit</strong></div>
        <div><strong>Year long course: 1.0 credit</strong></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
      <thead>
        <tr>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">Grade</th>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">Standard</th>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">Honors</th>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">Advanced Placement</th>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">College Courses</th>
          <th style="border:1px solid #ccc;padding:9px 14px;font-weight:700;background:#f5f5f5">Percentage</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">A</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">4.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">4.50</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">5.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">5.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">90–100</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">B</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">3.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">3.50</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">4.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">4.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">80–89</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">B-</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">2.50</td><td colspan="3" style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-size:9pt">N/A — Only for transfer learners coming from a 9-1 GCSE system</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">—</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">C</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">2.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">2.50</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">3.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">3.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">70–79</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">D</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">1.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">1.50</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">2.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">2.00</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">60–69</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">F</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">0</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">0</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">0</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">0</td><td style="border:1px solid #ccc;padding:9px 14px;text-align:center">0–59</td></tr>
        <tr><td style="border:1px solid #ccc;padding:9px 14px;text-align:center;font-weight:700">P</td><td colspan="5" style="border:1px solid #ccc;padding:9px 14px;text-align:center">Pass</td></tr>
      </tbody>
    </table>
  </div>
</div>
</body></html>`
    win.document.write(doc)
    win.document.close()
  }

  // ── class-wide stats for overview
  const classStats = useMemo(() => {
    return students.map(s => {
      const c = courses.filter(x => x.studentId === s.id)
      const t = transfers.filter(x => x.studentId === s.id)
      const uw = calcGPA(c); const wt = calcWeightedGPA(c); const uc = calcUCGPA(c)
      const gc = getGradCredits(c, t)
      const dist = getDistinction(wt, c)
      return { ...s, uw, wt, uc, credits: gc.total, dist }
    })
  }, [students, courses, transfers])

  const headerPortal = useHeaderActions(
    <div style={{ display: tab === 'overview' ? 'none' : 'flex', gap:8, alignItems:'center' }}>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #E4EAF2', fontSize:13, color:'#1A365E', background:'#fff', maxWidth:220 }}>
        {students.map(s => <option key={s.id} value={s.id}>{s.name} (Gr {s.grade})</option>)}
      </select>
    </div>
  )

  // ── TAB: OVERVIEW (class-wide) ────────────────────────────────────────────
  function renderOverview() {
    const apCount  = courses.filter(c => c.type === 'AP' || c.type === 'IB').length
    const honCount = courses.filter(c => c.type === 'HON').length
    const trCount  = transfers.length
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* 4 class-wide stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'HS Students',        val:students.length, col:'#1A365E', icon:'🎓' },
            { label:'AP / IB Courses',    val:apCount,         col:'#7040CC', icon:'📐' },
            { label:'Honors Courses',     val:honCount,        col:'#0A6B64', icon:'⭐' },
            { label:'Transfer & EC Credits', val:trCount,      col:'#0369A1', icon:'🏛️' },
          ].map(c => (
            <div key={c.label} style={{ ...card, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.8px' }}>{c.label}</span>
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:c.col }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Student GPA Summary table */}
        <div style={{ ...card, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #E4EAF2', fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1 }}>Student GPA Summary — Click to view detail</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#1A365E' }}>
                {['Student','Grade','Unweighted GPA','Weighted GPA','Academic GPA','Credits','Distinction'].map(h => (
                  <th key={h} style={{ ...th, background:'#1A365E', color:'#fff', fontSize:9, letterSpacing:'0.6px', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {classStats.map((s, i) => {
                  const uwCol = s.uw ? (s.uw >= 3.5 ? '#1DBD6A' : s.uw >= 2.5 ? '#F5A623' : '#D61F31') : '#C0C0C0'
                  return (
                    <tr key={s.id} style={{ background:i%2===0?'#fff':'#FAFBFC', cursor:'pointer' }}
                      onClick={() => { setSelectedId(s.id); setTab('studentov') }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background='#F0F6FF'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background=i%2===0?'#fff':'#FAFBFC'}>
                      <td style={td}><span style={{ fontWeight:700, color:'#1A365E' }}>{s.name}</span></td>
                      <td style={{ ...td, color:'#7A92B0', fontSize:11 }}>{s.grade}</td>
                      <td style={{ ...td, textAlign:'center' }}><span style={{ fontSize:14, fontWeight:800, color:uwCol }}>{s.uw ? s.uw.toFixed(2) : '—'}</span></td>
                      <td style={{ ...td, textAlign:'center' }}><span style={{ fontSize:14, fontWeight:800, color:'#1A365E' }}>{s.wt ? s.wt.toFixed(2) : '—'}</span></td>
                      <td style={{ ...td, textAlign:'center' }}><span style={{ fontSize:13, fontWeight:700, color:'#7040CC' }}>{s.uc ? s.uc.toFixed(2) : '—'}</span></td>
                      <td style={{ ...td, color:'#3D5475' }}>{courses.filter(c => c.studentId === s.id).reduce((a, c) => a + (parseFloat(String(c.creditsEarned)) || 0), 0).toFixed(1)} cr</td>
                      <td style={td}>
                        {s.dist
                          ? <span style={{ background:'#FAC60020', color:'#7A5100', border:'1px solid #FAC600', padding:'2px 7px', borderRadius:8, fontSize:10, fontWeight:800 }}>{s.dist.label}</span>
                          : <span style={{ color:'#C0C0C0', fontSize:11 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
                {classStats.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'#7A92B0', padding:32 }}>No HS students enrolled.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── TAB: STUDENT OVERVIEW ──────────────────────────────────────────────────
  function renderStudentOverview() {
    if (!student) return (
      <div style={{ ...card, padding:48, textAlign:'center', color:'#7A92B0' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🎒</div>
        <div style={{ fontSize:14, fontWeight:600 }}>Select a student from the Overview tab to view their profile.</div>
      </div>
    )

    const uw   = calcGPA(studentCourses)
    const wt   = calcWeightedGPA(studentCourses)
    const uc   = calcUCGPA(studentCourses)
    const gc   = getGradCredits(studentCourses, studentTransfers)
    const dist = getDistinction(wt, studentCourses)
    const uwCol = uw >= 3.5 ? '#1DBD6A' : uw >= 2.5 ? '#F5A623' : '#D61F31'

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* 4 stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[
            { label:'Unweighted GPA', val: uw ? uw.toFixed(2) : '—', col: uwCol,    icon:'📊' },
            { label:'Weighted GPA',   val: wt ? wt.toFixed(2) : '—', col:'#7040CC', icon:'⭐' },
            { label:'Academic GPA',   val: uc ? uc.toFixed(2) : '—', col:'#0EA5E9', icon:'🎓' },
            { label:'Total Credits',  val: `${Math.round(gc.total * 10) / 10} / ${graduationCreditsRequired}`, col:'#1A365E', icon:'📚' },
          ].map(c => (
            <div key={c.label} style={{ ...card, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.8px' }}>{c.label}</span>
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:c.col }}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Distinction banner */}
        {dist && (
          <div style={{ background:'linear-gradient(135deg,#FAC600,#F5A623)', borderRadius:11, padding:'13px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:24 }}>🏆</span>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{dist.label}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)' }}>Academic Distinction — Honors Program</div>
            </div>
          </div>
        )}

        {/* 2-col grid: Graduation Progress + Courses by Type */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Graduation Progress */}
          <div style={{ ...card, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Graduation Progress</div>
            {GRAD_REQS.map(req => {
              const earned = gc[req.key] || 0
              const pct = Math.min(100, Math.round(earned / req.required * 100))
              const col = pct >= 100 ? '#1DBD6A' : pct >= 60 ? '#F5A623' : '#D61F31'
              return (
                <div key={req.key} style={{ marginBottom:9 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#3D5475' }}>{req.label}</span>
                    <span style={{ fontSize:11, fontWeight:800, color:col }}>{earned} / {req.required}</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'#F0F4F8', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:3, background:col, width:`${pct}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Courses by Type */}
          <div style={{ ...card, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Courses by Type</div>
            {COURSE_TYPES.map(tp => {
              const n = studentCourses.filter(c => c.type === tp).length
              if (!n && tp !== 'AP' && tp !== 'HON') return null
              const col = TYPE_COLOR[tp]
              return (
                <div key={tp} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ width:36, height:22, borderRadius:6, background:col+'18', border:`1px solid ${col}44`, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:col }}>{tp}</span>
                  <span style={{ flex:1, fontSize:12, fontWeight:600, color:'#1A365E' }}>{TYPE_LABEL[tp]}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:'#1A365E' }}>{n}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── TAB: COURSE RECORDS ───────────────────────────────────────────────────
  function renderCourses() {
    const byYear = SCHOOL_YEARS.slice().reverse().map(y => ({
      year: y, rows: studentCourses.filter(c => c.year === y)
    })).filter(g => g.rows.length > 0)
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={() => setCourseModal({ ...emptyCourseDraft(selectedId) })}
            style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Add Course</button>
        </div>
        {byYear.length === 0 && (
          <div style={{ ...card, padding:48, textAlign:'center', color:'#7A92B0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📚</div>
            <div style={{ fontSize:15, fontWeight:600 }}>No course records yet.</div>
            <div style={{ fontSize:13, marginTop:4 }}>Click "+ Add Course" to start building the academic record.</div>
          </div>
        )}
        {byYear.map(({ year, rows }) => {
          const yw = calcWeightedGPA(rows.filter(r => r.courseStatus === 'Completed') as CourseRecord[])
          const yu = calcGPA(rows.filter(r => r.courseStatus === 'Completed') as CourseRecord[])
          return (
            <div key={year} style={{ ...card, overflow:'hidden' }}>
              <div style={{ background:'#F7F9FC', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #E4EAF2' }}>
                <span style={{ fontWeight:700, color:'#1A365E', fontSize:14 }}>{year}</span>
                <div style={{ display:'flex', gap:12, fontSize:12, color:'#7A92B0' }}>
                  {yu > 0 && <span>UW GPA: <strong style={{ color:gpaColor(yu) }}>{yu.toFixed(2)}</strong></span>}
                  {yw > 0 && <span>W GPA: <strong style={{ color:gpaColor(yw) }}>{yw.toFixed(2)}</strong></span>}
                </div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ background:'#FAFBFD' }}>
                  <th style={th}>Course</th>
                  <th style={{ ...th, textAlign:'center' }}>Type</th>
                  <th style={th}>Area</th>
                  <th style={th}>Duration</th>
                  <th style={{ ...th, textAlign:'center' }}>Cr.</th>
                  <th style={{ ...th, textAlign:'center' }}>Grade</th>
                  <th style={{ ...th, textAlign:'center' }}>Wtd Pts</th>
                  <th style={{ ...th, textAlign:'center' }}>AP/IB</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign:'center' }}>Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => {
                    const sm = STATUS_META[r.courseStatus]
                    const wp = getWeightedPts(r.grade, r.type)
                    const bp = getBasePts(r.grade)
                    return (
                      <tr key={r._id}>
                        <td style={td}><div style={{ fontWeight:600 }}>{r.title || '—'}</div>{r.code && <div style={{ fontSize:11, color:'#7A92B0' }}>{r.code}</div>}</td>
                        <td style={{ ...td, textAlign:'center' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, background: TYPE_COLOR[r.type]+'22', color: TYPE_COLOR[r.type], fontSize:11, fontWeight:700 }}>{r.type}</span>
                        </td>
                        <td style={{ ...td, fontSize:12, color:'#7A92B0' }}>{r.area}</td>
                        <td style={{ ...td, fontSize:12 }}>{r.semester}</td>
                        <td style={{ ...td, textAlign:'center', fontSize:12 }}>{r.creditsEarned}</td>
                        <td style={{ ...td, textAlign:'center', fontWeight:700, color: bp !== null && bp !== undefined ? (bp >= 3.0 ? '#059669' : bp >= 2.0 ? '#F5A623' : '#D61F31') : '#7A92B0' }}>{r.grade || '—'}</td>
                        <td style={{ ...td, textAlign:'center', fontSize:12 }}>{wp !== null ? wp.toFixed(1) : '—'}</td>
                        <td style={{ ...td, textAlign:'center', fontSize:12 }}>{(r.type === 'AP' || r.type === 'IB') && r.apScore ? r.apScore : '—'}</td>
                        <td style={td}><span style={{ padding:'3px 10px', borderRadius:20, background:sm.bg, color:sm.tc, fontSize:11, fontWeight:700 }}>{sm.icon} {r.courseStatus}</span></td>
                        <td style={{ ...td, textAlign:'center' }}>
                          <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                            <button onClick={() => setCourseModal({...r})} style={{ background:'#EEF5FF', border:'none', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:13 }}>✏️</button>
                            <button onClick={() => deleteCourse(r._id)} style={{ background:'#FFF0F1', border:'none', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:13 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    )
  }

  // ── TAB: GPA & WEIGHTING ─────────────────────────────────────────────────
  function renderGPA() {
    // AWS courses: done vs in-progress
    const awsDone = studentCourses.filter(c => c.grade && c.grade !== 'IP' && GRADE_PTS[c.grade] !== undefined)
    const awsIP   = studentCourses.filter(c => c.grade === 'IP' || !c.grade)

    // AWS unweighted GPA
    let awsQP = 0, awsCr = 0
    awsDone.forEach(c => {
      const p = GRADE_PTS[c.grade]; const cr = parseFloat(String(c.creditsEarned)) || 0
      if (p !== null && p !== undefined && cr > 0) { awsQP += p * cr; awsCr += cr }
    })
    const awsGPA = awsCr > 0 ? Math.round(awsQP / awsCr * 100) / 100 : null

    // AWS weighted GPA
    let awsWQP = 0
    awsDone.forEach(c => {
      const p = getWeightedPts(c.grade, c.type); const cr = parseFloat(String(c.creditsEarned)) || 0
      if (p !== null && cr > 0) awsWQP += p * cr
    })
    const awsWGPA = awsCr > 0 ? Math.round(awsWQP / awsCr * 100) / 100 : null

    // Transfer GPA (approved only)
    const approvedTrans = studentTransfers.filter(t => t.status === 'Approved')
    let trQP = 0, trCr = 0, trWQP = 0
    approvedTrans.forEach(t => {
      const p = GRADE_PTS[t.origGrade]; const cr = parseFloat(String(t.creditsAwarded)) || 0
      if (p !== null && p !== undefined && cr > 0) { trQP += p * cr; trCr += cr }
      const tType: CourseType = t.kind === 'DE' ? 'DE' : 'STD'
      const wp = getWeightedPts(t.origGrade, tType)
      if (wp !== null && cr > 0) trWQP += wp * cr
    })
    const trGPA  = trCr > 0 ? Math.round(trQP / trCr * 100) / 100 : null
    const trWGPA = trCr > 0 ? Math.round(trWQP / trCr * 100) / 100 : null

    // Combined
    const totCr    = awsCr + trCr
    const combGPA  = totCr > 0 ? Math.round((awsQP  + trQP)  / totCr * 100) / 100 : null
    const combWGPA = totCr > 0 ? Math.round((awsWQP + trWQP) / totCr * 100) / 100 : null

    // Academic core GPA
    const coreAreas = ['Language Arts','Mathematics','Science','Social Studies']
    const coreCourses = awsDone.filter(c => coreAreas.some(a => (c.area||'').toLowerCase().includes(a.toLowerCase())))
    let acQP = 0, acCr = 0
    coreCourses.forEach(c => {
      const p = GRADE_PTS[c.grade]; const cr = parseFloat(String(c.creditsEarned)) || 0
      if (p !== null && p !== undefined && cr > 0) { acQP += p * cr; acCr += cr }
    })
    const acGPA = acCr > 0 ? Math.round(acQP / acCr * 100) / 100 : null

    // Gap analysis (unweighted AWS vs transfer)
    const gap    = awsGPA !== null && trGPA !== null ? Math.round((awsGPA - trGPA) * 100) / 100 : null
    const gapDir = gap === null ? '◆' : gap > 0 ? '▲' : gap < 0 ? '▼' : '◆'
    const gapCol = gap === null ? '#C0C0C0' : gap > 0 ? '#1DBD6A' : gap < 0 ? '#D61F31' : '#F5A623'

    // Year-by-year
    const byYearData: Record<string,{qp:number;cr:number}> = {}
    awsDone.forEach(c => {
      const yr = c.year || 'Unknown'
      if (!byYearData[yr]) byYearData[yr] = { qp:0, cr:0 }
      const p = GRADE_PTS[c.grade]; const cr = parseFloat(String(c.creditsEarned)) || 0
      if (p !== null && p !== undefined && cr > 0) { byYearData[yr].qp += p * cr; byYearData[yr].cr += cr }
    })
    const yrs    = Object.keys(byYearData).sort()
    const yrGpas = yrs.map(y => byYearData[y].cr > 0 ? Math.round(byYearData[y].qp / byYearData[y].cr * 100) / 100 : null)

    const fmt = (v: number | null) => v !== null && v !== undefined ? v.toFixed(2) : 'N/A'
    const gc  = (v: number | null): string => v === null ? '#C0C0C0' : v >= 3.5 ? '#1DBD6A' : v >= 2.5 ? '#F5A623' : '#D61F31'

    // Big GPA card component
    function BigCard({ label, val, sub, col, extra }: { label:string; val:number|null; sub:string; col:string; extra?: React.ReactNode }) {
      const pct = val !== null ? Math.min(100, Math.round(val / 5 * 100)) : 0
      return (
        <div style={{ ...card, flex:1, minWidth:140, padding:16, borderTop:`3px solid ${col}` }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:900, color:gc(val), lineHeight:1 }}>{fmt(val)}</div>
          <div style={{ fontSize:11, color:'#7A92B0', margin:'4px 0 8px' }}>{sub}</div>
          <div style={{ height:5, borderRadius:3, background:'#F0F4F8', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:3, background:col, width:`${pct}%`, transition:'width 0.3s' }} />
          </div>
          {extra && <div style={{ marginTop:8 }}>{extra}</div>}
        </div>
      )
    }

    // Transfer table totals
    let tTotCr = 0, tTotQP = 0, tTotWQP = 0
    approvedTrans.forEach(t => {
      const p = GRADE_PTS[t.origGrade]; const cr = parseFloat(String(t.creditsAwarded)) || 0
      if (p !== null && p !== undefined) { tTotCr += cr; tTotQP += p * cr; tTotWQP += (getWeightedPts(t.origGrade, t.kind === 'DE' ? 'DE' : 'STD') || 0) * cr }
    })
    const tAvgGPA  = tTotCr > 0 ? Math.round(tTotQP  / tTotCr * 100) / 100 : null
    const tAvgWGPA = tTotCr > 0 ? Math.round(tTotWQP / tTotCr * 100) / 100 : null

    // AWS table totals
    let aTotCr = 0, aTotQP2 = 0, aTotWQP2 = 0
    awsDone.forEach(c => {
      const p = GRADE_PTS[c.grade]; const cr = parseFloat(String(c.creditsEarned)) || 0
      if (p !== null && p !== undefined && cr > 0) { aTotCr += cr; aTotQP2 += p * cr; aTotWQP2 += (getWeightedPts(c.grade, c.type) || 0) * cr }
    })
    const aAvgGPA  = aTotCr > 0 ? Math.round(aTotQP2  / aTotCr * 100) / 100 : null
    const aAvgWGPA = aTotCr > 0 ? Math.round(aTotWQP2 / aTotCr * 100) / 100 : null

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Row 1: 5 GPA summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          <BigCard label="Transfer GPA" val={trGPA} sub={`Unweighted · ${Math.round(trCr*10)/10} cr`} col={gc(trGPA)}
            extra={trGPA !== null ? <div style={{ fontSize:10, color:'#7A92B0' }}>Weighted: <strong style={{ color:gc(trWGPA) }}>{fmt(trWGPA)}</strong></div> : undefined} />
          <BigCard label="AWS GPA (Live)" val={awsGPA} sub={`AWS courses only · ${Math.round(awsCr*10)/10} cr`} col={gc(awsGPA)}
            extra={awsGPA !== null ? <div style={{ fontSize:10, color:'#7A92B0' }}>Weighted: <strong style={{ color:gc(awsWGPA) }}>{fmt(awsWGPA)}</strong> · {awsIP.length} in-progress</div> : undefined} />
          <BigCard label="Combined GPA" val={combGPA} sub={`Transfer + AWS · ${Math.round(totCr*10)/10} cr total`} col={gc(combGPA)}
            extra={combGPA !== null ? <div style={{ fontSize:10, color:'#7A92B0' }}>Weighted: <strong style={{ color:gc(combWGPA) }}>{fmt(combWGPA)}</strong></div> : undefined} />
          <BigCard label="Academic GPA" val={acGPA} sub="Core subjects only (ELA/Math/Sci/SS)" col="#0EA5E9" />
          {/* Gap analysis card */}
          <div style={{ ...card, flex:1, minWidth:140, padding:16, borderTop:`3px solid ${gapCol}` }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>GPA Gap Analysis</div>
            <div style={{ fontSize:32, fontWeight:900, color:gapCol, lineHeight:1 }}>{gap !== null ? `${gap > 0 ? '+' : ''}${gap.toFixed(2)}` : 'N/A'}</div>
            <div style={{ fontSize:11, color:'#7A92B0', margin:'4px 0 8px' }}>Transfer → AWS change {gapDir}</div>
            {gap !== null
              ? <div style={{ fontSize:11, fontWeight:700, color:gapCol }}>{gap > 0 ? '📈 Improved at AWS' : gap < 0 ? '📉 Declined at AWS' : '📊 Maintained GPA'}</div>
              : <div style={{ fontSize:11, color:'#C0C0C0' }}>Not enough data</div>
            }
          </div>
        </div>

        {/* Year-by-year trend bar chart */}
        {yrs.length > 0 && (
          <div style={{ ...card, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>📈 AWS GPA Trend — Year by Year</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:110, paddingBottom:4 }}>
              {yrs.map((yr, i) => {
                const g = yrGpas[i]
                const pct = g !== null ? Math.round(g / 4 * 100) : 0
                const col = gc(g)
                return (
                  <div key={yr} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:col }}>{fmt(g)}</div>
                    <div style={{ width:'100%', background:col, borderRadius:'4px 4px 0 0', height:`${pct}%`, minHeight:4, transition:'height 0.3s' }} />
                    <div style={{ fontSize:9, color:'#7A92B0', marginTop:3, textAlign:'center' }}>{yr}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Transfer Credits Table */}
        <div style={{ ...card, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>📤 Transfer Credits</div>
          {studentTransfers.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'#7A92B0', fontSize:12 }}>No transfer records found. Add via the Transfer Credits tab.</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead><tr style={{ background:'#1A365E' }}>
                  {['Course','From School','Type','Credits','Grade','Unwt Pts','Wt Pts','Quality Pts','Status'].map(h => (
                    <th key={h} style={{ ...th, background:'#1A365E', color:'#fff', fontSize:9, letterSpacing:'0.6px', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {studentTransfers.map((t, i) => {
                    const bp = GRADE_PTS[t.origGrade]
                    const tType: CourseType = t.kind === 'DE' ? 'DE' : 'STD'
                    const wp = getWeightedPts(t.origGrade, tType)
                    const cr = parseFloat(String(t.creditsAwarded)) || 0
                    const stCol = t.status === 'Approved' ? '#1DBD6A' : '#F5A623'
                    const gradeCol = bp !== null && bp !== undefined ? (bp >= 3.5 ? '#1DBD6A' : bp >= 2 ? '#F5A623' : '#D61F31') : '#7A92B0'
                    return (
                      <tr key={t._id} style={{ background: i%2===0 ? '#fff' : '#F7F9FC' }}>
                        <td style={{ ...td, fontWeight:600, color:'#1A365E' }}>{t.origTitle || '—'}</td>
                        <td style={{ ...td, color:'#7A92B0' }}>{t.sourceSchool || '—'}</td>
                        <td style={td}><span style={{ fontSize:10, fontWeight:800, color: TYPE_COLOR[tType] || '#1A365E' }}>{t.kind}</span></td>
                        <td style={{ ...td, color:'#3D5475', fontWeight:700 }}>{cr}</td>
                        <td style={{ ...td, fontWeight:800, color:gradeCol }}>{t.origGrade || '—'}</td>
                        <td style={td}>{bp !== null && bp !== undefined ? bp : '—'}</td>
                        <td style={{ ...td, color:'#7040CC', fontWeight:700 }}>{wp !== null && wp !== undefined ? wp : '—'}</td>
                        <td style={{ ...td, fontWeight:700 }}>{bp !== null && bp !== undefined && cr ? (bp * cr).toFixed(2) : '—'}</td>
                        <td style={td}><span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:7, background:`${stCol}18`, color:stCol }}>{t.status}</span></td>
                      </tr>
                    )
                  })}
                  <tr style={{ background:'#F7F9FC', fontWeight:800 }}>
                    <td colSpan={3} style={{ ...td, fontSize:11, color:'#1A365E' }}>APPROVED TOTALS</td>
                    <td style={{ ...td, color:'#1A365E' }}>{Math.round(tTotCr*10)/10} cr</td>
                    <td style={td}></td>
                    <td colSpan={2} style={{ ...td, color:'#1A365E' }}>Unw: {fmt(tAvgGPA)} / Wt: {fmt(tAvgWGPA)}</td>
                    <td style={td}>{tTotQP.toFixed(2)}</td>
                    <td style={td}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AWS Courses Table */}
        <div style={{ ...card, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>🏫 AWS Courses</div>
          {studentCourses.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'#7A92B0', fontSize:12 }}>No courses recorded yet. Add via Course Records tab.</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead><tr style={{ background:'#1A365E' }}>
                  {['Course','Year','Type','Credits','Grade','Unwt Pts','Wt Pts','Quality Pts','Status'].map(h => (
                    <th key={h} style={{ ...th, background:'#1A365E', color:'#fff', fontSize:9, letterSpacing:'0.6px', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {studentCourses.map((c, i) => {
                    const ip = c.grade === 'IP' || !c.grade
                    const bp = ip ? null : GRADE_PTS[c.grade]
                    const wp = ip ? null : getWeightedPts(c.grade, c.type)
                    const cr = parseFloat(String(c.creditsEarned)) || 0
                    const gradeCol = bp !== null && bp !== undefined ? (bp >= 3.5 ? '#1DBD6A' : bp >= 2 ? '#F5A623' : '#D61F31') : '#7A92B0'
                    return (
                      <tr key={c._id} style={{ background: i%2===0 ? '#fff' : '#F7F9FC' }}>
                        <td style={{ ...td, fontWeight:600, color:'#1A365E' }}>{c.title || '—'}</td>
                        <td style={{ ...td, color:'#7A92B0' }}>{c.year || '—'}</td>
                        <td style={td}><span style={{ fontSize:10, fontWeight:800, color: TYPE_COLOR[c.type] || '#1A365E' }}>{c.type}</span></td>
                        <td style={{ ...td, color:'#3D5475', fontWeight:700 }}>{cr}</td>
                        {ip ? (
                          <>
                            <td style={td}><span style={{ background:'#EEF3FF', color:'#1A365E', padding:'2px 7px', borderRadius:6, fontSize:10, fontWeight:700 }}>⏳ In Progress</span></td>
                            <td style={td}>—</td><td style={td}>—</td><td style={td}>—</td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...td, fontWeight:800, color:gradeCol }}>{c.grade}</td>
                            <td style={td}>{bp !== null && bp !== undefined ? bp : '—'}</td>
                            <td style={{ ...td, color:'#7040CC', fontWeight:700 }}>{wp !== null && wp !== undefined ? wp : '—'}</td>
                            <td style={{ ...td, fontWeight:700 }}>{bp !== null && bp !== undefined && cr ? (bp * cr).toFixed(2) : '—'}</td>
                          </>
                        )}
                        <td style={td}><span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background: ip ? '#EEF3FF' : '#E8FBF0', color: ip ? '#1A365E' : '#0E6B3B' }}>{ip ? 'In Progress' : 'Complete'}</span></td>
                      </tr>
                    )
                  })}
                  <tr style={{ background:'#F7F9FC', fontWeight:800 }}>
                    <td colSpan={3} style={{ ...td, fontSize:11, color:'#1A365E' }}>COMPLETED TOTALS</td>
                    <td style={{ ...td, color:'#1A365E' }}>{Math.round(aTotCr*10)/10} cr</td>
                    <td style={td}></td>
                    <td colSpan={2} style={{ ...td, color:'#1A365E' }}>Unw: {fmt(aAvgGPA)} / Wt: {fmt(aAvgWGPA)}</td>
                    <td style={td}>{aTotQP2.toFixed(2)}</td>
                    <td style={td}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overall GPA Summary table */}
        <div style={{ ...card, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>📊 Overall GPA Summary</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'#1A365E' }}>
              {['Category','GPA (Unweighted)','GPA (Weighted)','Credits','Indicator'].map(h => (
                <th key={h} style={{ ...th, background:'#1A365E', color:'#fff', fontSize:9, letterSpacing:'0.6px', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                { label:'Transfer School',    ugpa:trGPA,   wgpa:trWGPA,  cr:trCr },
                { label:'AWS Courses (Live)', ugpa:awsGPA,  wgpa:awsWGPA, cr:awsCr },
                { label:'Combined (All)',     ugpa:combGPA, wgpa:combWGPA,cr:totCr },
                { label:'Academic Core',      ugpa:acGPA,   wgpa:acGPA,   cr:acCr },
              ].map((r, i) => (
                <tr key={r.label} style={{ background: i%2===0 ? '#fff' : '#F7F9FC' }}>
                  <td style={{ ...td, fontWeight:700, color:'#1A365E' }}>{r.label}</td>
                  <td style={{ ...td, fontSize:16, fontWeight:900, color:gc(r.ugpa) }}>{fmt(r.ugpa)}</td>
                  <td style={{ ...td, fontSize:16, fontWeight:900, color:gc(r.wgpa) }}>{fmt(r.wgpa)}</td>
                  <td style={{ ...td, color:'#7A92B0', fontWeight:600 }}>{Math.round(r.cr*10)/10} cr</td>
                  <td style={td}>
                    <div style={{ width:90, height:7, borderRadius:3, background:'#F0F4F8', overflow:'hidden', display:'inline-block' }}>
                      <div style={{ height:'100%', borderRadius:3, background:gc(r.ugpa), width:`${r.ugpa !== null ? Math.min(100,Math.round(r.ugpa/4*100)) : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GPA Weighting Scale reference */}
        <div style={{ ...card, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>GPA Weighting Scale Reference</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'#1A365E' }}>
              {['Grade','Standard (4.0)','Honors (+0.5)','AP / IB / DE (+1.0)'].map(h => (
                <th key={h} style={{ ...th, background:'#1A365E', color:'#fff', fontSize:9, letterSpacing:'0.6px', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[['A','4.0','4.5','5.0'],['B','3.0','3.5','4.0'],['C','2.0','2.5','3.0'],['D','1.0','1.0','1.0'],['F','0.0','0.0','0.0']].map(([g,s,h,ap], i) => {
                const col = parseFloat(s) >= 3 ? '#1DBD6A' : parseFloat(s) >= 2 ? '#F5A623' : '#D61F31'
                return (
                  <tr key={g} style={{ background: i%2===0 ? '#fff' : '#F7F9FC' }}>
                    <td style={td}><strong style={{ fontSize:16, color:col }}>{g}</strong></td>
                    <td style={{ ...td, fontWeight:700, color:col }}>{s}</td>
                    <td style={{ ...td, fontWeight:700, color:'#0A6B64' }}>{h}</td>
                    <td style={{ ...td, fontWeight:700, color:'#7040CC' }}>{ap}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop:8, fontSize:11, color:'#7A92B0' }}>⚠️ D and F grades in AP/IB/Honors/DE courses do not receive the weighted bonus per AWS policy.</div>
        </div>

      </div>
    )
  }

  // ── PRINT: GRADUATION AUDIT ───────────────────────────────────────────────
  function printGraduationAudit(opts: {
    totalEarned:number; pctDone:number; allMet:boolean; onPace:boolean;
    wgpa:number; ugpa:number; dist:{label:string;col:string}|null;
    distinctions:{name:string;desc:string;met:boolean;gold?:boolean;blue?:boolean}[];
    totalPending:number; credRemaining:number;
    deTotal:number; deCollegeTotal:number;
    failedCourses:CourseRecord[]; mandatoryAlerts:{area:string;course:string;color:string}[];
    expectedByNow:number; gc:Record<string,number>;
  }) {
    const { totalEarned, pctDone, allMet, onPace, wgpa, ugpa, dist, distinctions,
            totalPending, credRemaining, deTotal, deCollegeTotal,
            failedCourses, mandatoryAlerts, gc } = opts
    const TOTAL_REQ = 24
    const issueDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    const acYear = '2024–2025'
    const h = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

    // Course rows per area
    function courseRows(area: string) {
      const done = studentCourses.filter(c => (c.area || 'Electives') === area && c.grade !== 'F' && c.courseStatus === 'Completed')
      const ip   = studentCourses.filter(c => (c.area || 'Electives') === area && ['In Progress','Assigned','Not Started'].includes(c.courseStatus))
      const tr   = studentTransfers.filter(t => t.status === 'Approved' && (t.area || 'Electives') === area)
      let rows = ''
      done.forEach(c => {
        rows += `<tr><td>${h(c.title)}</td><td style="text-align:center">${h(c.year)}</td><td style="text-align:center">${h(c.type)}</td><td style="text-align:center;font-weight:700">${h(c.grade)}</td><td style="text-align:center;font-weight:700">${parseFloat(String(c.creditsEarned))||0}</td></tr>`
      })
      tr.forEach(t => {
        rows += `<tr style="background:#F0F9FF"><td>${h(t.origTitle||'Transfer Credit')}<span style="font-size:9px;color:#0369A1;margin-left:4px">[Transfer — ${h(t.sourceSchool||'External')}]</span></td><td style="text-align:center">—</td><td style="text-align:center">TR</td><td style="text-align:center;font-weight:700">${h(t.origGrade||'—')}</td><td style="text-align:center;font-weight:700">${t.creditsAwarded||0}</td></tr>`
      })
      if (ip.length) {
        rows += `<tr><td colspan="5" style="padding:4px 8px;background:#FFFBEB;font-size:10px;font-weight:700;color:#92400E">▸ IN PROGRESS / PLANNED</td></tr>`
        ip.forEach(c => {
          const stCol = c.courseStatus === 'In Progress' ? '#1E40AF' : c.courseStatus === 'Assigned' ? '#92400E' : '#6B7280'
          rows += `<tr style="opacity:.8"><td style="font-style:italic">${h(c.title)}</td><td style="text-align:center;color:#7A92B0;font-size:10px">${h(c.year)}</td><td style="text-align:center;color:#7A92B0;font-size:10px">${h(c.type)}</td><td style="text-align:center;color:${stCol};font-size:10px;font-weight:700">${c.courseStatus}</td><td style="text-align:center;color:#7A92B0">(${parseFloat(String(c.creditsAttempted))||0} planned)</td></tr>`
        })
      }
      return rows
    }

    // Requirement rows
    let reqRows = ''
    GRAD_REQS.forEach(req => {
      const earned  = Math.round((gc[req.key]||0)*10)/10
      const pending = Math.round((gc[req.key+'_pending']||0)*10)/10
      const met = earned >= req.required
      const statusText = met ? '✓ Met' : pending > 0 ? `In Progress (${(earned+pending).toFixed(1)} if all pass)` : `${(req.required-earned).toFixed(1)} cr needed`
      const statusColor = met ? '#0E6B3B' : pending > 0 ? '#92400E' : '#C0392B'
      reqRows += `<tr class="${met?'req-met':'req-unmet'}"><td>${h(req.icon+' '+req.label)}</td><td style="text-align:center">${req.required}</td><td style="text-align:center;font-weight:700">${earned}</td>${pending>0?`<td style="text-align:center;color:#92400E;font-weight:600">${pending} (IP)</td>`:'<td style="text-align:center;color:#7A92B0">—</td>'}<td style="text-align:center;font-weight:800;color:${statusColor}">${statusText}</td></tr>`
    })

    // Area sections
    let areaSections = ''
    GRAD_REQS.forEach(req => {
      const rows = courseRows(req.area)
      if (!rows) return
      areaSections += `<div class="section-break"><h3 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#1A365E;border-bottom:1.5px solid #1A365E;padding-bottom:4px;margin:0 0 8px">${h(req.icon+' '+req.label)}</h3><table><thead><tr><th>Course Title</th><th>Year</th><th>Type</th><th>Grade</th><th>Credits</th></tr></thead><tbody>${rows}</tbody></table></div>`
    })

    const statusBg     = allMet ? '#E8FBF0' : onPace ? '#EEF3FF' : '#FFF0F1'
    const statusBorder = allMet ? '#1DBD6A' : onPace ? '#1A365E' : '#D61F31'
    const statusLabel  = allMet ? '✓ All Graduation Requirements Met' : onPace ? 'On Track to Graduate' : 'Behind Pace — Counselor Review Needed'
    const barColor     = allMet ? '#1DBD6A' : onPace ? '#1A365E' : '#D61F31'

    // DE courses for print table
    const deCoursesPrint = studentCourses.filter(c => c.type === 'DE' || c.type === 'EC')
    const deTransPrint   = studentTransfers.filter(t => t.status === 'Approved' && (t.kind === 'DE'))
    const deRowsHtml = [...deCoursesPrint.map(c => ({title:c.title,area:c.area,hs:parseFloat(String(c.creditsEarned))||0})), ...deTransPrint.map(t => ({title:t.origTitle||'Transfer',area:t.area||'Electives',hs:parseFloat(String(t.creditsAwarded))||0}))].map(c => `<tr><td>${h(c.title)}</td><td>${h(c.area)}</td><td style="text-align:center;font-weight:700">${c.hs}</td><td style="text-align:center;font-weight:700;color:#0369A1">${deHsToCollege(c.hs,c.area)}</td></tr>`).join('')

    const doc = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>Graduation Audit — ${h(student?.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Georgia",serif;font-size:12px;color:#1A365E;background:#fff;max-width:780px;margin:0 auto;padding:32px 36px}
h2{font-size:13px;font-weight:800;margin:0 0 10px;text-transform:uppercase;letter-spacing:.8px;color:#1A365E}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1A365E;padding-bottom:14px;margin-bottom:18px}
.school-name{font-size:18px;font-weight:900;letter-spacing:1px;color:#1A365E}
.school-sub{font-size:10px;letter-spacing:2px;color:#7A92B0;margin-top:3px}
.doc-title{font-size:11px;font-weight:700;color:#7A92B0;text-align:right;letter-spacing:1px}
.doc-meta{font-size:11px;color:#3D5475;text-align:right;margin-top:4px}
.confidential{font-size:9px;font-weight:700;color:#D61F31;text-align:right;margin-top:2px}
.student-bar{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;background:#F7F9FC;border:1px solid #E4EAF2;border-radius:6px;padding:12px 16px;margin-bottom:16px}
.sb-item .label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#7A92B0}
.sb-item .value{font-size:12px;font-weight:700;color:#1A365E;margin-top:2px}
.status-banner{padding:12px 16px;border-radius:6px;border-left:4px solid ${statusBorder};background:${statusBg};margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.status-label{font-size:13px;font-weight:800;color:#1A365E}
.status-sub{font-size:11px;color:#3D5475;margin-top:2px}
.progress-bar{height:8px;background:#E4EAF2;border-radius:4px;margin-top:8px;overflow:hidden}
.progress-fill{height:100%;background:${barColor};border-radius:4px}
.gpa-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px}
.gpa-box{border:1.5px solid #E4EAF2;border-radius:6px;padding:10px 12px;text-align:center}
.gpa-box .gpa-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#7A92B0}
.gpa-box .gpa-val{font-size:22px;font-weight:900;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
th{background:#1A365E;color:#fff;padding:6px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
td{padding:6px 9px;border-bottom:1px solid #E4EAF2}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#F7F9FC}
.req-table tr td:first-child{font-weight:600}
.req-met td{background:#F0FFF4!important}
.req-unmet td{background:#FFF8F8!important}
.section-break{margin-bottom:18px}
.section-block{margin-bottom:20px}
.dist-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.dist-card{padding:9px 12px;border-radius:5px;border:1.5px solid #E4EAF2;font-size:11px}
.dist-card.met{border-color:#1DBD6A;background:#F0FFF4}
.dist-card.met-gold{border-color:#FAC600;background:#FFFBEA}
.dist-name{font-weight:800}
.dist-desc{font-size:10px;color:#7A92B0;margin-top:1px}
.dist-status{font-size:10px;font-weight:800;margin-top:4px}
.alert-box{padding:10px 14px;border-radius:5px;margin-bottom:12px;font-size:11px}
.alert-red{background:#FFF0F1;border-left:3px solid #D61F31}
.alert-amber{background:#FFFBEA;border-left:3px solid #D97706}
.sig-block{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:28px;padding-top:16px;border-top:2px solid #E4EAF2}
.sig-line{border-bottom:1px solid #1A365E;height:32px;margin-bottom:5px}
.sig-label{font-size:10px;color:#7A92B0}
.footer{text-align:center;font-size:9px;color:#7A92B0;margin-top:28px;padding-top:10px;border-top:1px solid #E4EAF2}
@media print{
  body{padding:18px 22px;font-size:11px}
  .no-print{display:none!important}
  .section-break{page-break-inside:avoid}
  .sig-block{page-break-inside:avoid}
  h2{page-break-after:avoid}
  @page{size:A4;margin:18mm 16mm}
}
</style>
</head><body>

<div class="no-print" style="display:flex;gap:10px;margin-bottom:20px">
  <button onclick="window.print()" style="padding:9px 22px;background:#1A365E;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="padding:9px 18px;background:#F5F7FA;color:#3D5475;border:1.5px solid #E4EAF2;border-radius:7px;font-size:13px;cursor:pointer">✕ Close</button>
  <span style="margin-left:auto;font-size:11px;color:#7A92B0;align-self:center">Tip: In print dialog → choose <strong>Save as PDF</strong>, enable <em>Background graphics</em> for best results.</span>
</div>

<div class="header">
  <div>
    <div class="school-name">AMERICAN WORLD SCHOOL</div>
    <div class="school-sub">GRADUATION AUDIT — OFFICIAL DOCUMENT</div>
    <div style="font-size:10px;color:#3D5475;margin-top:6px">24-Credit High School Diploma Program · ${h(acYear)}</div>
  </div>
  <div>
    <div class="doc-title">GRADUATION AUDIT</div>
    <div class="doc-meta">Issue Date: ${issueDate}</div>
    <div class="doc-meta">Academic Year: ${h(acYear)}</div>
    <div class="confidential">CONFIDENTIAL — FOR FAMILY USE</div>
  </div>
</div>

<div class="student-bar">
  <div class="sb-item"><div class="label">Student Name</div><div class="value">${h(student?.name)}</div></div>
  <div class="sb-item"><div class="label">Student ID</div><div class="value" style="font-family:monospace">${h(student?.studentId||'—')}</div></div>
  <div class="sb-item"><div class="label">Grade Level</div><div class="value">${h(student?.grade||'—')}</div></div>
  <div class="sb-item"><div class="label">Academic Year</div><div class="value">${h(acYear)}</div></div>
</div>

<div class="status-banner">
  <div>
    <div class="status-label">${statusLabel}</div>
    <div class="status-sub">${totalEarned} of ${TOTAL_REQ} credits earned · ${pctDone}% complete${totalPending>0?' · '+totalPending+' cr in progress':''}</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pctDone}%"></div></div>
  </div>
  ${dist ? `<div style="text-align:center;background:${dist.col};color:#fff;border-radius:6px;padding:7px 14px;margin-left:16px"><div style="font-size:9px;font-weight:700;opacity:.8">DISTINCTION</div><div style="font-size:13px;font-weight:800">${h(dist.label)}</div></div>` : ''}
</div>

<div class="gpa-row">
  <div class="gpa-box"><div class="gpa-label">Unweighted GPA</div><div class="gpa-val" style="color:${ugpa>=3.5?'#1DBD6A':ugpa>=2.5?'#D97706':'#D61F31'}">${ugpa.toFixed(2)}</div></div>
  <div class="gpa-box"><div class="gpa-label">Weighted GPA</div><div class="gpa-val" style="color:#1A365E">${wgpa.toFixed(2)}</div></div>
  <div class="gpa-box"><div class="gpa-label">Credits Earned</div><div class="gpa-val" style="color:#1A365E">${totalEarned}<span style="font-size:13px;color:#7A92B0"> / ${TOTAL_REQ}</span></div></div>
  <div class="gpa-box"><div class="gpa-label">Credits Remaining</div><div class="gpa-val" style="color:${credRemaining>0?'#D61F31':'#1DBD6A'}">${credRemaining.toFixed(1)}</div></div>
</div>

${failedCourses.length ? `<div class="alert-box alert-red"><strong>❌ Failed Courses — No Credit Awarded, Must Repeat:</strong> ${failedCourses.map(c=>h(c.title)).join(', ')}</div>` : ''}
${mandatoryAlerts.length ? `<div class="alert-box alert-amber"><strong>⚠️ Required Courses Not Yet Completed:</strong> ${mandatoryAlerts.map(a=>h(a.area+': '+a.course)).join(' · ')}</div>` : ''}

<div class="section-block">
  <h2>Credit Requirements Checklist</h2>
  <table class="req-table">
    <thead><tr><th>Subject Area</th><th style="text-align:center">Required</th><th style="text-align:center">Earned</th><th style="text-align:center">In Progress</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${reqRows}
    <tr style="background:#1A365E">
      <td style="color:#fff;font-weight:800">TOTAL — AWS High School Diploma</td>
      <td style="text-align:center;color:#fff;font-weight:800">${TOTAL_REQ}</td>
      <td style="text-align:center;color:#fff;font-weight:900;font-size:13px">${totalEarned}</td>
      ${totalPending>0?`<td style="text-align:center;color:rgba(255,255,255,.75)">${totalPending}</td>`:'<td></td>'}
      <td style="text-align:center;color:#fff;font-weight:800">${allMet?'✓ COMPLETE':'⚠ INCOMPLETE'}</td>
    </tr>
    </tbody>
  </table>
</div>

<div class="section-block">
  <h2>Course History by Subject Area</h2>
  ${areaSections}
</div>

<div class="section-block">
  <h2>Academic Distinctions</h2>
  <div class="dist-grid">
    ${distinctions.map(d => {
      const cls = d.met ? (d.gold ? 'met-gold' : 'met') : ''
      const statusCol = d.met ? (d.gold ? '#7A5100' : d.blue ? '#0369A1' : '#0E6B3B') : '#C0C0C0'
      return `<div class="dist-card ${cls}"><div class="dist-name">${h(d.name)}</div><div class="dist-desc">${h(d.desc)}</div><div class="dist-status" style="color:${statusCol}">${d.met?'✓ Qualified':'Not yet met'}</div></div>`
    }).join('')}
  </div>
</div>

${deTotal > 0 ? `
<div class="section-block">
  <h2>Early College Program — Dual Enrollment</h2>
  <table>
    <thead><tr><th>Course</th><th>Subject Area</th><th style="text-align:center">HS Credits</th><th style="text-align:center">College Credits</th></tr></thead>
    <tbody>${deRowsHtml}
    <tr style="background:#EFF8FF"><td style="font-weight:800">TOTAL</td><td></td><td style="text-align:center;font-weight:900">${deTotal}</td><td style="text-align:center;font-weight:900;color:#0369A1">${deCollegeTotal}</td></tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#0369A1;margin-top:4px">Associate Degree Track: ${deCollegeTotal} of 60 college credits earned (${Math.round(deCollegeTotal/60*100)}%)</p>
</div>` : ''}

<div class="sig-block">
  <div><div class="sig-line"></div><div class="sig-label">School Counselor / Academic Advisor</div><div class="sig-label" style="margin-top:3px">Date: ___________________</div></div>
  <div><div class="sig-line"></div><div class="sig-label">Parent / Guardian Signature</div><div class="sig-label" style="margin-top:3px">Date: ___________________</div></div>
</div>

<div class="footer">
  American World School · 24-Credit Graduation Program · ${h(acYear)} · Generated ${issueDate}<br>
  This document is for informational purposes. Contact your academic counselor for official records.
</div>

</body></html>`

    const win = window.open('', '_blank', 'width=860,height=950,menubar=yes,toolbar=yes,scrollbars=yes')
    if (!win) { alert('Pop-up blocked — please allow pop-ups for this page'); return }
    win.document.write(doc)
    win.document.close()
    win.focus()
  }

  // ── TAB: GRADUATION AUDIT ─────────────────────────────────────────────────
  function renderGraduation() {
    const gc = getGradCredits(studentCourses, studentTransfers)
    const wt  = calcWeightedGPA(studentCourses)
    const uw  = calcGPA(studentCourses)
    const apCourses = studentCourses.filter(c => c.type === 'AP' || c.type === 'IB')
    const deCourses = studentCourses.filter(c => c.type === 'DE' || c.type === 'EC')
    const approvedTrans = studentTransfers.filter(t => t.status === 'Approved')
    const deTrans = approvedTrans.filter(t => t.area === 'Dual Enrollment' || t.kind === 'DE')

    const deTotalCredits  = deCourses.reduce((s, c) => s + (parseFloat(String(c.creditsEarned)) || 0), 0)
    const deTransCredits  = deTrans.reduce((s, t) => s + (parseFloat(String(t.creditsAwarded)) || 0), 0)
    const deTotal         = Math.round((deTotalCredits + deTransCredits) * 10) / 10
    const deCollegeCourses = deCourses.reduce((s, c) => Math.round((s + deHsToCollege(parseFloat(String(c.creditsEarned)) || 0, c.area || 'Electives')) * 10) / 10, 0)
    const deCollegeTrans   = deTrans.reduce((s, t) => Math.round((s + deHsToCollege(parseFloat(String(t.creditsAwarded)) || 0, t.area || 'Electives')) * 10) / 10, 0)
    const deCollegeTotal   = Math.round((deCollegeCourses + deCollegeTrans) * 10) / 10
    const ASSOC = 60

    const totalEarned = Math.round(gc.total * 10) / 10
    const pctDone     = Math.min(100, Math.round(totalEarned / TOTAL_CREDITS * 100))
    const allMet      = GRAD_REQS.every(r => (gc[r.key] || 0) >= r.required) && totalEarned >= TOTAL_CREDITS
    const dist        = getDistinction(wt, studentCourses)

    const gradeExpect: Record<string,number> = {'Grade 9':6,'Grade 10':12,'Grade 11':18,'Grade 12':24}
    const expectedByNow = gradeExpect[student?.grade || ''] || 0
    const onPace = totalEarned >= expectedByNow

    const failedCourses = studentCourses.filter(c => c.grade === 'F')

    const earnedTitles = studentCourses.filter(c => (parseFloat(String(c.creditsEarned)) || 0) > 0 && c.grade !== 'F').map(c => c.title)
    const mandatoryAlerts: {area:string; course:string; color:string}[] = []
    GRAD_REQS.forEach(req => {
      if (!req.mandatory?.length) return
      req.mandatory.forEach(m => {
        const satisfied = earnedTitles.some(t => t.toLowerCase().includes(m.toLowerCase()))
        if (!satisfied) mandatoryAlerts.push({ area: req.label, course: m, color: req.color })
      })
    })

    const totalPending = Math.round((gc.pendingTotal || 0) * 10) / 10
    const credRemaining = Math.max(0, TOTAL_CREDITS - totalEarned)

    const heroBg = allMet
      ? 'linear-gradient(135deg,#E8FBF0,#D5F5E3)'
      : onPace
        ? 'linear-gradient(135deg,#EEF3FF,#DDE6FF)'
        : 'linear-gradient(135deg,#FFF0F1,#FFE0E3)'
    const heroIcon   = allMet ? '🎓' : onPace ? '📚' : '⚠️'
    const heroTitle  = allMet ? 'Graduation Requirements Met' : onPace ? 'On Track to Graduate' : 'Behind Pace — Action Needed'
    const heroBarCol = allMet ? '#1DBD6A' : onPace ? '#1A365E' : '#D61F31'

    const typeCounts: Record<string, number> = {}
    studentCourses.forEach(c => { typeCounts[c.type] = (typeCounts[c.type] || 0) + (parseFloat(String(c.creditsEarned)) || 0) })

    const typeInfo: Record<string,{label:string;color:string}> = {
      STD:{label:'Standard',color:'#6B7280'}, HON:{label:'Honors',color:'#0891B2'},
      AP:{label:'Adv. Placement',color:'#7C3AED'}, IB:{label:'IB',color:'#D97706'},
      DE:{label:'Dual Enrollment',color:'#0369A1'}, EC:{label:'Early College',color:'#0EA5E9'},
      CR:{label:'Credit Recovery',color:'#D61F31'},
    }

    const distinctions = [
      {name:'Summa Cum Laude',   desc:'WGPA 4.0+ · 4+ AP/IB courses',          met: wt >= 4.0 && apCourses.length >= 4, gold:true},
      {name:'Magna Cum Laude',   desc:'WGPA 3.75+ · 2+ AP/IB courses',         met: wt >= 3.75 && apCourses.length >= 2},
      {name:'Cum Laude',         desc:'WGPA 3.5+',                             met: wt >= 3.5},
      {name:'Honor Roll',        desc:'Unweighted GPA 3.0+',                   met: uw >= 3.0},
      {name:'Early College Scholar', desc:'8+ Dual Enrollment credits',        met: deTotal >= 8, blue:true},
      {name:'Associate Degree Track', desc:'30+ EC credits toward Associate',  met: deTotal >= 30, blue:true},
      {name:'Academic Excellence', desc:'All requirements met · WGPA 3.75+',   met: allMet && wt >= 3.75},
      {name:'AP Scholar', desc:'Score 3+ on 3+ AP exams',                      met: studentCourses.filter(c => c.apScore && parseInt(String(c.apScore)) >= 3).length >= 3},
    ]

    const totalMet = totalEarned >= TOTAL_CREDITS
    const totalMetWithPending = (totalEarned + totalPending) >= TOTAL_CREDITS

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Print toolbar */}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={() => printGraduationAudit({ totalEarned, pctDone, allMet, onPace, wgpa: wt, ugpa: uw, dist, distinctions, totalPending, credRemaining, deTotal, deCollegeTotal, failedCourses, mandatoryAlerts, expectedByNow, gc })}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 18px', background:'#1A365E', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px rgba(26,54,94,.2)' }}>
            🖨️ Print / Save PDF
          </button>
        </div>

        {/* Hero card */}
        <div style={{ ...card, padding:20, background:heroBg }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ fontSize:44 }}>{heroIcon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:'#1A365E' }}>{heroTitle}</div>
              <div style={{ fontSize:12, color:'#3D5475', marginTop:3 }}>
                {totalEarned} of {TOTAL_CREDITS} credits earned · {pctDone}% complete · 6 credits per year required
              </div>
              <div style={{ marginTop:10, height:10, borderRadius:5, background:'rgba(0,0,0,0.08)', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:5, background:heroBarCol, width:`${pctDone}%`, transition:'width 0.4s' }} />
              </div>
              <div style={{ display:'flex', gap:20, marginTop:8, flexWrap:'wrap' }}>
                <div style={{ fontSize:11, color:'#3D5475' }}>
                  <strong>Expected by {student?.grade}:</strong> {expectedByNow} cr &nbsp;
                  {onPace ? '✅ On Pace' : `⚠️ ${Math.max(0, expectedByNow - totalEarned).toFixed(1)} cr behind`}
                </div>
                {deTotal > 0 && (
                  <div style={{ fontSize:11, color:'#0369A1' }}>
                    <strong>🏛️ Early College:</strong> {deTotal} HS credits = {deCollegeTotal} college credits
                  </div>
                )}
              </div>
            </div>
            {dist && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#7A92B0', marginBottom:4, fontWeight:600, letterSpacing:'0.5px' }}>DISTINCTION</div>
                <div style={{ background:dist.col, color:'#fff', borderRadius:12, padding:'7px 16px', fontSize:12, fontWeight:800 }}>{dist.label}</div>
              </div>
            )}
          </div>
        </div>

        {/* Alert: Failed courses */}
        {failedCourses.length > 0 && (
          <div style={{ ...card, padding:'14px 18px', borderLeft:'4px solid #D61F31', background:'#FFF0F1' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#D61F31', marginBottom:6 }}>❌ Failed Courses — No Credit Awarded | Course Must Be Repeated</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {failedCourses.map(c => (
                <span key={c._id} style={{ background:'#FFE0E3', color:'#D61F31', border:'1px solid #F5C2C7', borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>{c.title}</span>
              ))}
            </div>
          </div>
        )}

        {/* Alert: Missing mandatory courses */}
        {mandatoryAlerts.length > 0 && (
          <div style={{ ...card, padding:'14px 18px', borderLeft:'4px solid #D97706', background:'#FFFBEA' }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#92400E', marginBottom:6 }}>⚠️ Required Courses Not Yet Completed</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {mandatoryAlerts.map((a, i) => (
                <span key={i} style={{ background:a.color+'18', color:a.color, border:`1px solid ${a.color}44`, borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                  [{a.area}] {a.course}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary stats row — 4-col grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {[
            { label:'Credits Earned',  val:`${totalEarned} / ${TOTAL_CREDITS}`, col:'#1A365E', icon:'📚' },
            { label:'In Progress',     val: totalPending > 0 ? `${totalPending} cr pending` : 'None', col:'#F5A623', icon:'⏳' },
            { label:'Credits Needed',  val:`${credRemaining.toFixed(1)} cr`, col: credRemaining > 0 ? '#D61F31' : '#1DBD6A', icon:'🎯' },
            { label:'Weighted GPA',    val: wt ? wt.toFixed(2) : '—', col: wt >= 3.5 ? '#1DBD6A' : wt >= 2.0 ? '#F5A623' : '#D61F31', icon:'📊' },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{s.icon}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.8px' }}>{s.label}</span>
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:s.col }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Graduation checklist */}
        <div style={{ ...card, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1 }}>📋 AWS Graduation Checklist — 24 Credits</div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{ fontSize:10, background:'#EEF3FF', color:'#1A365E', padding:'3px 10px', borderRadius:8, fontWeight:700 }}>CORE: 14 cr</span>
              <span style={{ fontSize:10, background:'#F3EFF9', color:'#7C3AED', padding:'3px 10px', borderRadius:8, fontWeight:700 }}>ELECTIVES: 10 cr</span>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display:'flex', gap:14, marginBottom:12, flexWrap:'wrap' }}>
            {[{col:'#1DBD6A',label:'Earned'},{col:'#F5A623',label:'In Progress (pending grade)'},{col:'#E4EAF2',label:'Still Needed'}].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:l.col }} />
                <span style={{ fontSize:10, color:'#7A92B0', fontWeight:600 }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {/* CORE section header */}
            <div style={{ fontSize:10, fontWeight:800, color:'#1A365E', textTransform:'uppercase', letterSpacing:'0.8px', padding:'4px 0 2px', borderBottom:'2px solid #EEF3FF', marginBottom:2 }}>
              CORE REQUIREMENTS — 14 CREDITS
            </div>
            {GRAD_REQS.map((req, idx) => {
              const earned     = Math.round((gc[req.key] || 0) * 10) / 10
              const pending    = Math.round((gc[req.key + '_pending'] || 0) * 10) / 10
              const remAfterPending = Math.max(0, req.required - earned - pending)
              const pctEarned  = Math.min(100, Math.round(earned / req.required * 100))
              const pctPending = Math.min(100 - pctEarned, Math.round(pending / req.required * 100))
              const met        = earned >= req.required
              const metWithPending = (earned + pending) >= req.required
              const statusLabel = met ? '✓ MET' : remAfterPending > 0 ? `${remAfterPending.toFixed(1)} cr still needed` : '⏳ Will meet with pending'
              const statusBg  = met ? '#E8FBF0' : remAfterPending > 0 ? '#FFF0F1' : '#FEF3C7'
              const statusCol = met ? '#0E6B3B' : remAfterPending > 0 ? '#D61F31' : '#92400E'
              return (
                <div key={req.key}>
                  {/* ELECTIVE divider before first elective */}
                  {idx > 0 && GRAD_REQS[idx-1].category === 'core' && req.category === 'elective' && (
                    <div style={{ fontSize:10, fontWeight:800, color:'#7C3AED', textTransform:'uppercase', letterSpacing:'0.8px', padding:'8px 0 2px', borderBottom:'2px solid #F3EFF9', marginBottom:2, marginTop:4 }}>
                      ELECTIVE REQUIREMENTS — 10 CREDITS
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setGradBreakdownKey(req.key)}
                    style={{ width:'100%', background:'transparent', border:'none', padding:0, textAlign:'left', cursor:'pointer' }}
                  >
                    <div style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${met ? '#C6F6D5' : metWithPending ? '#FDE68A' : '#E4EAF2'}`, background: met ? '#F0FFF4' : metWithPending ? '#FFFBEA' : '#FAFBFF' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontSize:20 }}>{req.icon}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:'#1A365E' }}>{req.label}</span>
                              {req.category === 'core' && <span style={{ fontSize:9, background:'#EEF3FF', color:'#1A365E', padding:'2px 6px', borderRadius:4, fontWeight:700 }}>CORE</span>}
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:10, fontWeight:800, color:'#0E6B3B', background:'#E8FBF0', padding:'2px 7px', borderRadius:6 }}>✓ {earned} earned</span>
                              {pending > 0 && <span style={{ fontSize:10, fontWeight:800, color:'#92400E', background:'#FEF3C7', padding:'2px 7px', borderRadius:6 }}>⏳ {pending} pending</span>}
                              <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:800, background:statusBg, color:statusCol }}>{statusLabel}</span>
                            </div>
                          </div>
                          {/* 3-color segmented bar */}
                          <div style={{ height:7, borderRadius:4, background:'#E4EAF2', overflow:'hidden', display:'flex' }}>
                            {pctEarned > 0 && <div style={{ width:`${pctEarned}%`, background:'#1DBD6A', transition:'width 0.3s' }} />}
                            {pctPending > 0 && <div style={{ width:`${pctPending}%`, background:'#F5A623', transition:'width 0.3s' }} />}
                          </div>
                          {/* Numeric summary */}
                          <div style={{ fontSize:10, color:'#7A92B0', marginTop:3 }}>
                            {earned} of {req.required} cr required{pending > 0 ? ` · ${pending} cr in progress` : ''}{remAfterPending > 0 ? ` · ${remAfterPending.toFixed(1)} cr still needed` : ''}
                          </div>
                          {req.mandatoryNote && <div style={{ fontSize:10, color:'#7A92B0', marginTop:2 }}>📌 {req.mandatoryNote}</div>}
                          <div style={{ fontSize:10, color:'#3D5475', marginTop:3, fontWeight:700 }}>Click to view credit breakdown</div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
            {/* Total banner */}
            <div style={{ padding:'14px 16px', borderRadius:10, background: totalMet ? '#1A365E' : totalMetWithPending ? '#92400E' : '#D61F31', marginTop:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>🎓 TOTAL GRADUATION CREDITS — AWS HIGH SCHOOL DIPLOMA</div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{totalEarned} / {TOTAL_CREDITS} cr &nbsp;{totalMet ? '✓ COMPLETE' : '⚠ INCOMPLETE'}</div>
                  {totalPending > 0 && !totalMet && (
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.75)' }}>⏳ {totalPending} cr in progress → {(totalEarned + totalPending).toFixed(1)} total if all pass</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DE / Early College section — always shown */}
        <div style={{ ...card, padding:18, border:'2px solid #BAE6FD', background:'linear-gradient(135deg,#F0F9FF,#E0F2FE)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'#0C4A6E' }}>🏛️ Early College Program — Dual Enrollment</div>
              <div style={{ fontSize:11, color:'#0369A1', marginTop:2 }}>University credits earned through EC Program transfer directly to graduation requirements</div>
            </div>
            {deTotal > 0 && (
              <div style={{ textAlign:'center', background:'#0369A1', borderRadius:12, padding:'8px 16px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.7)', fontWeight:600 }}>DE CREDITS EARNED</div>
                <div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{deTotal}</div>
              </div>
            )}
          </div>
          {(deCourses.length > 0 || deTrans.length > 0) ? (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
{(() => {
                  type DERow = { id:string; title:string; area:string; credits:number; grade:string; school:string }
                  const rows: DERow[] = [
                    ...deCourses.map(c => ({ id:c._id, title:c.title, area:c.area, credits:c.creditsEarned||0, grade:c.grade||'—', school:'' })),
                    ...deTrans.map(t => ({ id:t._id, title:t.origTitle||'Transfer', area:t.area||'Electives', credits:t.creditsAwarded||0, grade:t.origGrade||'—', school:t.sourceSchool||'' })),
                  ]
                  return rows.map((c, i) => (
                    <div key={c.id || i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:'rgba(255,255,255,0.7)', border:'1px solid #BAE6FD' }}>
                      <span style={{ fontSize:18 }}>🏛️</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#0C4A6E' }}>{c.title}</div>
                        <div style={{ fontSize:10, color:'#0369A1' }}>{c.area}{c.school ? ` · ${c.school}` : ''}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#0C4A6E' }}>{c.credits} cr</div>
                        <div style={{ fontSize:10, color:'#7A92B0' }}>Grade: {c.grade}</div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
              <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'#E0F2FE', border:'1px solid #BAE6FD' }}>
                <div style={{ fontSize:11, color:'#0C4A6E' }}>
                  <strong>Associate Degree Track:</strong> Students completing 60 EC credits earn an Associate degree alongside the AWS Diploma. {deCollegeTotal} of {ASSOC} college credits earned ({deTotal} HS credits × 3–4x multiplier).
                </div>
                <div style={{ marginTop:6, height:6, borderRadius:3, background:'rgba(3,105,161,0.15)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:'#0369A1', width:`${Math.min(100, Math.round(deCollegeTotal / ASSOC * 100))}%` }} />
                </div>
                <div style={{ fontSize:10, color:'#0369A1', marginTop:3 }}>
                  {Math.round(deCollegeTotal / ASSOC * 100)}% toward Associate Degree ({ASSOC} college credits | 1 HS credit = 3–4 college credits)
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:20, color:'#0369A1' }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🏛️</div>
              <div style={{ fontSize:12, fontWeight:700 }}>No Dual Enrollment credits recorded yet</div>
              <div style={{ fontSize:11, marginTop:4, opacity:0.8 }}>Add courses with type <strong>DE (Dual Enrollment)</strong> to track EC Program progress. DE credits count toward graduation requirements.</div>
            </div>
          )}
        </div>

        {/* Course Rigor Profile */}
        <div style={{ ...card, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>🏫 Course Rigor Profile</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
            {Object.keys(typeInfo).map(t => {
              const cnt = typeCounts[t] || 0
              if (cnt === 0 && t !== 'AP' && t !== 'DE') return null
              const info = typeInfo[t]
              return (
                <div key={t} style={{ padding:'10px 12px', borderRadius:8, border:`1.5px solid ${cnt > 0 ? info.color + '44' : '#E4EAF2'}`, background: cnt > 0 ? info.color + '08' : '#F7F9FC' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:info.color, marginBottom:2 }}>{info.label.toUpperCase()}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:'#1A365E' }}>{cnt % 1 ? cnt.toFixed(1) : cnt.toFixed(0)}</div>
                  <div style={{ fontSize:10, color:'#7A92B0' }}>credit{cnt === 1 ? '' : 's'}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Academic Distinctions */}
        <div style={{ ...card, padding:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#7A92B0', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>🏆 Academic Distinctions</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {distinctions.map(d => {
              const bc = d.met ? (d.gold ? '#FAC600' : (d as {blue?:boolean}).blue ? '#0369A1' : '#1DBD6A') : '#E4EAF2'
              const tc = d.met ? (d.gold ? '#7A5100' : (d as {blue?:boolean}).blue ? '#0C4A6E' : '#0E6B3B') : '#7A92B0'
              const bg = d.met ? (d.gold ? '#FFFBEA' : (d as {blue?:boolean}).blue ? '#F0F9FF' : '#F0FFF4') : '#F7F9FC'
              return (
                <div key={d.name} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${bc}`, background:bg }}>
                  <div style={{ fontSize:12, fontWeight:800, color:tc }}>{d.name}</div>
                  <div style={{ fontSize:10, color: d.met ? tc : '#7A92B0', marginTop:2 }}>{d.desc}</div>
                  <div style={{ marginTop:6, fontSize:10, fontWeight:800, color: d.met ? bc : '#C0C0C0' }}>{d.met ? '✓ QUALIFIED' : 'Not yet met'}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── TAB: SKILL GRAPH ──────────────────────────────────────────────────────
  function renderSkillGraph() {
    const totalScored = Object.values(skillScores).filter(v => v > 0).length
    const avgScore = totalScored > 0
      ? (Object.values(skillScores).reduce((a, b) => a + b, 0) / 20).toFixed(1)
      : '—'
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ ...card, padding:'12px 16px', background:'#F7F9FC', border:'none', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <div style={{ fontSize:13, color:'#7A92B0' }}>
            Rate each of the 20 AWS Core Competencies on a 0–5 scale.
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:12, color:'#7A92B0' }}>{totalScored}/20 rated · Avg: {avgScore}</span>
            <div style={{
              padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:700,
              background: skillSaved ? '#DCFCE7' : '#F7F9FC',
              color: skillSaved ? '#166534' : '#7A92B0',
              border: `1px solid ${skillSaved ? '#86EFAC' : '#E4EAF2'}`,
              transition: 'all 0.3s',
            }}>
              {skillSaved ? '✓ Saved' : 'Scores auto-save'}
            </div>
          </div>
        </div>
        {/* Radar chart */}
        <div style={{ ...card, padding:24, display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'#1A365E' }}>AWS Competency Radar</div>
          <SkillRadar scores={skillScores} />
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
            {(Object.entries(COMP_COLORS) as [string,string][]).map(([cat, col]) => (
              <div key={cat} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:col }} />
                <span style={{ color:'#1A365E', textTransform:'capitalize' }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
        {(Object.entries(COMPETENCIES) as [keyof typeof COMPETENCIES, typeof COMPETENCIES[keyof typeof COMPETENCIES]][]).map(([cat, comps]) => (
          <div key={cat} style={{ ...card, padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:(COMP_COLORS as Record<string,string>)[cat] }} />
              <div style={{ fontSize:14, fontWeight:700, color:'#1A365E', textTransform:'capitalize' }}>{cat} Skills</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {comps.map(c => {
                const val = skillScores[c.key] || 0
                return (
                  <div key={c.key}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#1A365E' }}>{c.label}</span>
                      <span style={{ fontSize:12, color:(COMP_COLORS as Record<string,string>)[cat], fontWeight:700 }}>{SKILL_LABELS[val]}</span>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {[0,1,2,3,4,5].map(lvl => (
                        <button key={lvl} onClick={() => updateSkill(c.key, lvl)}
                          style={{ flex:1, height:28, borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, transition:'all 0.15s',
                            background: lvl <= val ? (COMP_COLORS as Record<string,string>)[cat] : '#F0F4F8',
                            color: lvl <= val ? '#fff' : '#7A92B0' }}>
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <button onClick={async () => { if (confirm('Reset all competency scores to zero?')) { setSkillScores({}); setSkillSaved(false); await supabase.from('hs_skill_scores').upsert({ student_id: selectedId, scores: {} }, { onConflict: 'student_id' }) } }}
          style={{ alignSelf:'flex-start', padding:'7px 16px', borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#D61F31', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          ↺ Reset All Scores
        </button>
      </div>
    )
  }

  // ── TAB: TRANSFER & EC ────────────────────────────────────────────────────
  function renderTransfer() {
    const approved = studentTransfers.filter(t => t.status === 'Approved')
    const pending  = studentTransfers.filter(t => t.status === 'Pending')
    const deTotal  = approved.filter(t => t.kind === 'DE').reduce((a,t) => a+t.creditsAwarded, 0)
    const trTotal  = approved.filter(t => t.kind === 'TR').reduce((a,t) => a+t.creditsAwarded, 0)
    const collegeTotal = approved.filter(t => t.kind === 'DE').reduce((a,t) => a+deHsToCollege(t.creditsAwarded, t.area), 0)
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', gap:12, justifyContent:'space-between', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[{label:'DE / EC Credits',val:deTotal.toFixed(1),col:'#0369A1',bg:'#DBEAFE'},{label:'College Credits',val:collegeTotal.toFixed(1),col:'#7040CC',bg:'#EDE6FB'},{label:'Transfer Credits',val:trTotal.toFixed(1),col:'#C47A00',bg:'#FFF6E0'},{label:'Pending',val:pending.length,col:'#D61F31',bg:'#FEE2E2'}].map(c => (
              <div key={c.label} style={{ ...card, padding:'10px 16px', background:c.bg, border:'none' }}>
                <div style={{ fontSize:10, fontWeight:700, color:c.col, textTransform:'uppercase', letterSpacing:'0.06em' }}>{c.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:c.col }}>{c.val}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setTransferModal({ ...emptyTransferDraft(selectedId) })}
            style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Add Credit</button>
        </div>
        {studentTransfers.length === 0 && (
          <div style={{ ...card, padding:48, textAlign:'center', color:'#7A92B0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🏛️</div>
            <div style={{ fontSize:14, fontWeight:600 }}>No transfer or DE credits recorded.</div>
          </div>
        )}
        {studentTransfers.length > 0 && (
          <div style={{ ...card, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#F7F9FC' }}>
                <th style={th}>Course</th><th style={th}>Type</th><th style={th}>Source</th><th style={{ ...th, textAlign:'center' }}>Grade</th><th style={{ ...th, textAlign:'center' }}>HS Cr.</th><th style={{ ...th, textAlign:'center' }}>College Cr.</th><th style={th}>Area</th><th style={th}>Status</th><th style={{ ...th, textAlign:'center' }}>Actions</th>
              </tr></thead>
              <tbody>
                {studentTransfers.map(t => {
                  const statusMeta = { Approved:{bg:'#DCFCE7',tc:'#166534'}, Pending:{bg:'#FEF3C7',tc:'#92400E'}, Denied:{bg:'#FEE2E2',tc:'#991B1B'} }[t.status]
                  return (
                    <tr key={t._id}>
                      <td style={td}><div style={{ fontWeight:600 }}>{t.origTitle}</div>{t.sourceSchool && <div style={{ fontSize:11, color:'#7A92B0' }}>{t.sourceSchool}</div>}</td>
                      <td style={td}><span style={{ padding:'2px 8px', borderRadius:6, background:t.kind==='DE'?'#DBEAFE':'#FFF6E0', color:t.kind==='DE'?'#1E40AF':'#92400E', fontSize:11, fontWeight:700 }}>{t.kind}</span></td>
                      <td style={{ ...td, fontSize:12, color:'#7A92B0' }}>{t.sourceSchool || '—'}</td>
                      <td style={{ ...td, textAlign:'center', fontWeight:700 }}>{t.origGrade || '—'}</td>
                      <td style={{ ...td, textAlign:'center' }}>{t.creditsAwarded}</td>
                      <td style={{ ...td, textAlign:'center', color:'#7040CC', fontWeight:600 }}>{t.kind==='DE'?deHsToCollege(t.creditsAwarded,t.area).toFixed(1):'—'}</td>
                      <td style={{ ...td, fontSize:12, color:'#7A92B0' }}>{t.area}</td>
                      <td style={td}><span style={{ padding:'3px 10px', borderRadius:20, background:statusMeta.bg, color:statusMeta.tc, fontSize:11, fontWeight:700 }}>{t.status}</span></td>
                      <td style={{ ...td, textAlign:'center' }}>
                        <div style={{ display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap' }}>
                          {t.status === 'Pending' && (
                            <button onClick={() => approveTransfer(t._id)} style={{ padding:'3px 8px', background:'#DCFCE7', border:'none', borderRadius:6, color:'#166534', fontSize:11, fontWeight:700, cursor:'pointer' }}>✓ Approve</button>
                          )}
                          <button onClick={() => setTransferModal({...t})} style={{ background:'#EEF5FF', border:'none', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:13 }}>✏️</button>
                          <button onClick={() => deleteTransfer(t._id)} style={{ background:'#FFF0F1', border:'none', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:13 }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── TAB: TRANSCRIPT ───────────────────────────────────────────────────────
  function renderTranscript() {
    const gradedCourses = studentCourses.filter(c =>
      c.grade && !['','IP','W','I'].includes(c.grade)
    )
    const rtDeTransferIds = new Set<string>()
    const deTransferRecordsRT: CourseRecord[] = studentTransfers
      .filter(t => t.status === 'Approved' && t.kind === 'DE' && t.gradeLevel && t.origGrade && !['','IP','W','I'].includes(t.origGrade))
      .map(t => {
        rtDeTransferIds.add(t._id)
        return {
          _id: t._id, studentId: t.studentId, code: 'DE', title: t.origTitle,
          type: 'DE' as CourseType, area: t.area, year: '', semester: '',
          gradeLevel: t.gradeLevel, creditsAttempted: t.creditsAwarded,
          creditsEarned: t.creditsAwarded, grade: t.origGrade,
          courseStatus: 'Completed' as CourseStatus, apScore: null,
          instructor: '', section: '', notes: '',
        }
      })
    const allGradedCourses = [...gradedCourses, ...deTransferRecordsRT]
    const tGPA = (courses: CourseRecord[]) => {
      let tot = 0, pts = 0
      courses.forEach(x => { const wp = getWeightedPts(x.grade, x.type); if (wp === null) return; const cr = x.creditsEarned || 0; if (!cr) return; tot += cr; pts += wp * cr })
      return tot ? Math.round(pts / tot * 100) / 100 : 0
    }
    const uw = tGPA(allGradedCourses)
    const totCr = Math.round(allGradedCourses.reduce((s, c) => s + (c.creditsEarned || 0), 0) * 10) / 10
    const issueDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    const gradYear = academicYear.split(/[–\-—]/)[1]?.trim() || String(new Date().getFullYear())
    const dobDisplay = student?.dob
      ? new Date(student.dob + 'T00:00:00').toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
      : '—'

    const gradeLevelOrder = ['Grade 9','Grade 10','Grade 11','Grade 12']
    const gradeGroups = gradeLevelOrder
      .map(gl => ({ gl, courses: allGradedCourses.filter(c => c.gradeLevel === gl) }))
      .filter(g => g.courses.length > 0)

    let allSoFar: CourseRecord[] = []
    const cumulativeByGrade: Record<string, number> = {}
    gradeGroups.forEach(({ gl, courses }) => {
      allSoFar = [...allSoFar, ...courses]
      cumulativeByGrade[gl] = tGPA(allSoFar)
    })

    const docWrapper: React.CSSProperties = {
      background: '#fff',
      border: '1px solid #ccc',
      width: '210mm',
      minHeight: '297mm',
      margin: '0 auto',
      padding: '12mm 16mm',
      fontFamily: 'Poppins, Arial, sans-serif',
      fontSize: 10,
      color: '#000',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
    }
    const thin = '1px solid #ccc'
    const bgPattern = <img src="/bgpattern.png" alt="" aria-hidden="true" style={{ position:'absolute', top:0, right:'15%', width:'100%', height:'auto', opacity:0.5, pointerEvents:'none', userSelect:'none' }} />

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {/* Toolbar */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={exportTranscriptPDF}
            style={{ padding:'8px 18px', borderRadius:9, border:'none', background:'#1A365E', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 8px rgba(26,54,94,.2)' }}>
            🖨️ Print / Save as PDF
          </button>
        </div>

        {/* Transcript document */}
        <div ref={printRef} style={docWrapper}>

          {/* Background pattern */}
          {bgPattern}

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'0 0 12px', borderBottom:'2px solid #000' }}>
            <div style={{ display:'flex', alignItems:'center' }}>
              <img src="/Logo_b.png" alt="American World School" style={{ height:62, width:'auto', objectFit:'contain' }} />
            </div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:36, fontWeight:700, letterSpacing:-1, lineHeight:1, fontFamily:'Poppins, Arial, sans-serif' }}>Official Transcript</div>
              <div style={{ fontSize:7, marginTop:5, lineHeight:1.75, textAlign:'left' }}>
                <div><strong>Official School WASC ID:</strong> 7548950999</div>
                <div><strong>WASC Address:</strong> 533 Airport Boulevard, Suite 200, Burlingame, CA 94010-2009</div>
                <div><strong>Phone:</strong> +1 650 696-1060</div>
              </div>
            </div>
          </div>

          {/* Student info */}
          <div style={{ borderBottom:thin, padding:'18px 0' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'repeat(3, 24px)', rowGap:6, alignItems:'center' }}>
              {/* Row 1: labels + Student ID + Total Credits */}
              <div style={{ gridColumn:1, gridRow:1, fontWeight:700, fontSize:10 }}>Student Name:</div>
              <div style={{ gridColumn:2, gridRow:1, fontSize:10 }}><strong>Student ID:</strong> {student?.studentId || '—'}</div>
              <div style={{ gridColumn:3, gridRow:1, fontSize:10, textAlign:'right' }}><strong>Total Credits:</strong> {totCr}</div>
              {/* Row 2: student name value + Grade */}
              <div style={{ gridColumn:1, gridRow:2, fontSize:13, fontWeight:700 }}>{student?.name || '—'}</div>
              <div style={{ gridColumn:2, gridRow:2, fontSize:10 }}><strong>Grade:</strong> {student?.grade || '—'}</div>
              {/* Row 3: Date of Birth + Graduation Date + Cumulative GPA */}
              <div style={{ gridColumn:1, gridRow:3, fontSize:10 }}><strong>Date of Birth:</strong> {dobDisplay}</div>
              <div style={{ gridColumn:2, gridRow:3, fontSize:10 }}><strong>Graduation Date:</strong> June {gradYear}</div>
              <div style={{ gridColumn:3, gridRow:2, fontSize:10, textAlign:'right' }}><strong>Cumulative GPA:</strong> {uw.toFixed(2)}</div>
            </div>
          </div>

          {/* Grade level tables side by side */}
          {gradeGroups.length > 0 ? (
            <div style={{ display:'grid', gridTemplateColumns: gradeGroups.length <= 1 ? '1fr' : '1fr 1fr' }}>
              {gradeGroups.map(({ gl, courses: gc2 }, idx) => {
                const gradeGPA = tGPA(gc2)
                const cgpa = cumulativeByGrade[gl]
                const gradeCredits = Math.round(gc2.reduce((s,c) => s + c.creditsEarned, 0) * 10) / 10
                return (
                  <div key={gl} style={{ padding:'10px 12px' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom:'1.5px solid #000' }}>
                          <th style={{ textAlign:'left', fontWeight:700, padding:'3px 5px', fontSize:10 }}>{gl}</th>
                          <th style={{ textAlign:'center', fontWeight:700, padding:'3px 5px', fontSize:9.5, whiteSpace:'nowrap' }}>Credit</th>
                          <th style={{ textAlign:'center', fontWeight:700, padding:'3px 5px', fontSize:9.5 }}>Grade</th>
                          <th style={{ textAlign:'center', fontWeight:700, padding:'3px 5px', fontSize:9.5 }}>GPA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gc2.map(c => {
                          const wp = getWeightedPts(c.grade, c.type)
                          const sym = (c.type === 'AP' || c.type === 'IB') ? ' ●' : c.type === 'HON' ? ' ✓' : (c.type === 'DE' || c.type === 'EC') ? ' ★' : ''
                          const ind = rtDeTransferIds.has(c._id) ? '(1)' : '(2)'
                          return (
                            <tr key={c._id} style={{ borderBottom:'0.5px solid #eee' }}>
                              <td style={{ padding:'3px 5px', fontSize:9.5 }}>
                                <span style={{ color:'#999', fontSize:8 }}>{ind} </span>
                                {c.title}{sym && <span style={{ fontSize:8 }}>{sym}</span>}
                              </td>
                              <td style={{ textAlign:'center', padding:'3px 5px', fontSize:9.5 }}>{c.creditsEarned}</td>
                              <td style={{ textAlign:'center', padding:'3px 5px', fontSize:9.5, fontWeight:700 }}>{c.grade || '—'}</td>
                              <td style={{ textAlign:'center', padding:'3px 5px', fontSize:9.5 }}>{wp !== null ? wp.toFixed(2) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop:'1.5px solid #000' }}>
                          <td colSpan={4} style={{ padding:'4px 5px', fontSize:9, fontWeight:700 }}>
                            CGPA: {cgpa.toFixed(2)}&nbsp;&nbsp;&nbsp;Total Credits: {gradeCredits}&nbsp;&nbsp;&nbsp;GPA: {gradeGPA.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {idx === gradeGroups.length - 1 && (
                      <div style={{ padding:'6px 5px', fontWeight:700, fontSize:10 }}>END OF TRANSCRIPT.</div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding:'16px 0', fontSize:11, color:'#888', fontStyle:'italic' }}>No completed courses to display.</div>
          )}

          {/* Bottom block — always pinned above footer */}
          <div style={{ marginTop:'auto' }}>
            {/* WASC stamp + registrar */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding:'14px 0', gap:20, borderBottom:thin }}>
              <div style={{ alignSelf:'end' }}>
                <div style={{ display:'inline-block', marginBottom:6 }}>
                  <img src="/Paul_sign.png" alt="Registrar Signature" style={{ height:44, width:'auto', objectFit:'contain', display:'block', marginBottom:4 }} />
                  <div style={{ borderBottom:'1px solid #000', width: 182 }} />
                </div>
                <div style={{ fontSize:13, fontWeight:700 }}>Registrar Name: Paul Montague</div>
                <div style={{ fontSize:13, marginTop:3 }}>Date Issued: {issueDate}</div>
                <div style={{ display:'flex', gap:10, marginTop:18, alignItems:'center' }}>
                  <img src="/AIAASC.png" alt="AIAASC" style={{ height:35, width:80, objectFit:'contain', position:'relative', top:2, left:0 }} />
                  <img src="/WASC.png"   alt="WASC"   style={{ height:100, width:105, objectFit:'contain', position:'relative', top:1, left:0 }} />
                  <img src="/NCPSA.png"  alt="NCPSA"  style={{ height:40, width:110, objectFit:'contain', position:'relative', top:0, left:0 }} />
                </div>
              </div>
              <div style={{ border:'1.5px dashed #aaa', borderRadius:16, padding:'12px 14px', minHeight:380, display:'flex', flexDirection:'column' }}>
                <div style={{ fontWeight:700, fontSize:11, textAlign:'center', marginBottom:8 }}>WASC ACCREDITATION STAMP</div>
                <div style={{ fontSize:9.5, color:'#555', lineHeight:1.65, marginBottom:12, textAlign:'center' }}>
                  Affix the official Western Association of Schools and Colleges physical accreditation stamp in this box before issuance. This transcript is not valid without the stamp.
                </div>
                <div style={{ border:'1px solid #bbb', borderRadius:16, flex:1, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'10px', minHeight:120, background:'#F0F0F0' }}>
                  <span style={{ color:'#bbb', fontSize:8.5 }}>Official School WASC ID: 7548950999</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'6px 0', fontSize:7, color:'#000', textAlign:'center', background:'#fff', borderTop:'1px solid #000', whiteSpace:'nowrap' }}>
              <strong>Address:</strong> No 3/171, Nehru Nagar, 1st Main Rd, Rajiv Gandhi Salai, Thiruvengadam Nagar, Perungudi, Chennai, Tamil Nadu 600041 &nbsp;|&nbsp; <strong>Phone:</strong> +91 82206 06367 &nbsp;|&nbsp; <strong>Email:</strong> admin@americanworldschool.org
            </div>
          </div>

        </div>

        {/* Page 2 — Grading scale (visible below on screen, separate page on print) */}
        <div style={{ ...docWrapper, marginTop:16 }}>
          {bgPattern}
          <div style={{ padding:'16px', border:'1px solid #000', background:'#F5F5F5', borderRadius:4, marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:10.5, marginBottom:8 }}>School (s)</div>
                <div style={{ fontSize:9.5 }}>(1) — West Windsor-Plainsboro High School</div>
                <div style={{ fontSize:9.5, marginTop:2 }}>(2) — American World School</div>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:10.5, marginBottom:8 }}>Key For Retakes</div>
                <div style={{ fontSize:9.5 }}><em>RP</em> — Replaced Because Retaken</div>
                <div style={{ fontSize:9.5, marginTop:2 }}><em>RT</em> — Retake</div>
              </div>
            </div>
            <div style={{ marginBottom:0 }}>
              <div style={{ fontWeight:700, fontSize:10.5, marginBottom:8 }}>Legend for Weighted Courses</div>
              <div style={{ fontSize:9.5, display:'flex', flexDirection:'column', gap:4 }}>
                <div>● &nbsp; Advanced Placement</div>
                <div>★ &nbsp; College Courses</div>
                <div>✓ &nbsp; Honors</div>
              </div>
              <div style={{ display:'flex', gap:24, marginTop:10, fontSize:9.5 }}>
                <div><strong>Semester Course = 0.5 credit</strong></div>
                <div><strong>Year long course: 1.0 credit</strong></div>
              </div>
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:9.5 }}>
              <thead>
                <tr>
                  {['Grade','Standard','Honors','Advanced Placement','College Courses','Percentage'].map(h2 => (
                    <th key={h2} style={{ border:thin, padding:'9px 14px', fontWeight:700, background:'#f5f5f5' }}>{h2}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['A',   '4.00','4.50','5.00','5.00','90–100'],
                  ['B',   '3.00','3.50','4.00','4.00','80–89'],
                ].map(([g,...vals]) => (
                  <tr key={g}>
                    <td style={{ border:thin, padding:'9px 14px', textAlign:'center', fontWeight:700 }}>{g}</td>
                    {vals.map((v,i) => <td key={i} style={{ border:thin, padding:'9px 14px', textAlign:'center' }}>{v}</td>)}
                  </tr>
                ))}
                <tr>
                  <td style={{ border:thin, padding:'9px 14px', textAlign:'center', fontWeight:700 }}>B-</td>
                  <td style={{ border:thin, padding:'9px 14px', textAlign:'center' }}>2.50</td>
                  <td colSpan={3} style={{ border:thin, padding:'9px 14px', textAlign:'center', fontSize:9 }}>N/A — Only for transfer learners coming from a 9-1 GCSE system</td>
                  <td style={{ border:thin, padding:'9px 14px', textAlign:'center' }}>—</td>
                </tr>
                {[
                  ['C',   '2.00','2.50','3.00','3.00','70–79'],
                  ['D',   '1.00','1.50','2.00','2.00','60–69'],
                  ['F',   '0',   '0',   '0',   '0',   '0–59'],
                ].map(([g,...vals]) => (
                  <tr key={g}>
                    <td style={{ border:thin, padding:'9px 14px', textAlign:'center', fontWeight:700 }}>{g}</td>
                    {vals.map((v,i) => <td key={i} style={{ border:thin, padding:'9px 14px', textAlign:'center' }}>{v}</td>)}
                  </tr>
                ))}
                <tr>
                  <td style={{ border:thin, padding:'9px 14px', textAlign:'center', fontWeight:700 }}>P</td>
                  <td colSpan={5} style={{ border:thin, padding:'9px 14px', textAlign:'center' }}>Pass</td>
                </tr>
              </tbody>
            </table>
        </div>
      </div>
    )
  }

  // ── TAB: CATALOG ──────────────────────────────────────────────────────────
  function renderCatalog() {
    const byArea = SUBJECT_AREAS.map(a => ({ area:a, courses:catalog.filter(c=>c.area===a) })).filter(g=>g.courses.length>0)
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ fontSize:13, color:'#7A92B0' }}>{catalog.length} courses in catalog</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={async () => { if (confirm('Reset catalog to defaults?')) { const d = DEFAULT_CATALOG.map(c=>({...c})) as CatalogCourse[]; setCatalog(d) } }}
              style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#D61F31', fontSize:13, fontWeight:600, cursor:'pointer' }}>↺ Reset Defaults</button>
            <button onClick={() => setCatalogDraft({ code:'', title:'', type:'STD', area:'Language Arts', credits:1, gradeLevel:'All' })}
              style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Add Course</button>
          </div>
        </div>
        {byArea.map(({ area, courses: ac }) => (
          <div key={area} style={{ ...card, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid #E4EAF2', background:'#F7F9FC', fontWeight:700, fontSize:13, color:'#1A365E' }}>{area} <span style={{ fontSize:12, color:'#7A92B0', fontWeight:400 }}>({ac.length} courses)</span></div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr style={{ background:'#FAFBFD' }}><th style={th}>Code</th><th style={th}>Title</th><th style={th}>Type</th><th style={{ ...th, textAlign:'center' }}>Credits</th><th style={th}>Grade Level</th><th style={{ ...th, textAlign:'center' }}>Lab</th><th style={{ ...th, textAlign:'center' }}>Actions</th></tr></thead>
              <tbody>
                {ac.map((c, i) => (
                  <tr key={c.code+i}>
                    <td style={{ ...td, fontFamily:'monospace', fontSize:12 }}>{c.code}</td>
                    <td style={{ ...td, fontWeight:600 }}>{c.title}</td>
                    <td style={td}><span style={{ padding:'2px 8px', borderRadius:6, background:TYPE_COLOR[c.type as CourseType]+'22'||'#F3F4F6', color:TYPE_COLOR[c.type as CourseType]||'#6B7280', fontSize:11, fontWeight:700 }}>{c.type}</span></td>
                    <td style={{ ...td, textAlign:'center' }}>{c.credits}</td>
                    <td style={{ ...td, fontSize:12, color:'#7A92B0' }}>{c.gradeLevel || 'All'}</td>
                    <td style={{ ...td, textAlign:'center' }}>{(c as CatalogCourse & {lab?:boolean}).lab ? <span style={{ fontSize:12, color:'#059669' }}>🧪</span> : '—'}</td>
                    <td style={{ ...td, textAlign:'center' }}>
                      <button onClick={async () => { if (confirm(`Remove "${c.title}" from catalog?`)) { await supabase.from('catalog').delete().eq('code', c.code); setCatalog(prev => prev.filter(x => x.code !== c.code)) } }}
                        style={{ background:'#FFF0F1', border:'none', borderRadius:6, width:26, height:26, cursor:'pointer', fontSize:12, color:'#D61F31' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {/* Add catalog course modal */}
        {catalogDraft && (
          <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(10,25,50,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e => { if (e.target===e.currentTarget) setCatalogDraft(null) }}>
            <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:440, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,#0F2240,#1A365E)', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>Add to Catalog</div>
                <button onClick={() => setCatalogDraft(null)} style={{ background:'rgba(255,255,255,.1)', border:'none', color:'#fff', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                {([['code','Course Code'],['title','Course Title']] as [keyof CatalogCourse,string][]).map(([k,l]) => (
                  <div key={k}><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>{l}</label>
                    <input style={inp} value={String(catalogDraft[k]??'')} onChange={e => setCatalogDraft(d => d?{...d,[k]:e.target.value}:null)} /></div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Type</label>
                    <select style={sel} value={catalogDraft.type} onChange={e => setCatalogDraft(d => d?{...d,type:e.target.value}:null)}>
                      {COURSE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select></div>
                  <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Credits</label>
                    <input type="number" min={0.5} max={8} step={0.5} style={inp} value={catalogDraft.credits} onChange={e => setCatalogDraft(d => d?{...d,credits:parseFloat(e.target.value)||1}:null)} /></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Subject Area</label>
                    <select style={sel} value={catalogDraft.area} onChange={e => setCatalogDraft(d => d?{...d,area:e.target.value}:null)}>
                      {SUBJECT_AREAS.map(a => <option key={a}>{a}</option>)}
                    </select></div>
                  <div><label style={{ fontSize:11, fontWeight:700, color:'#3D5475', display:'block', marginBottom:4 }}>Grade Level</label>
                    <select style={sel} value={catalogDraft.gradeLevel??'All'} onChange={e => setCatalogDraft(d => d?{...d,gradeLevel:e.target.value}:null)}>
                      {CATALOG_GRADE_LEVELS.map(g => <option key={g}>{g}</option>)}
                    </select></div>
                </div>
              </div>
              <div style={{ borderTop:'1px solid #E4EAF2', padding:'12px 20px', display:'flex', justifyContent:'flex-end', gap:8, background:'#F7F9FC' }}>
                <button onClick={() => setCatalogDraft(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#1A365E', fontWeight:600, fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={async () => {
                  if (!catalogDraft.code.trim() || !catalogDraft.title.trim()) return
                  const next = { ...catalogDraft }
                  await supabase.from('catalog').upsert({
                    code: next.code, title: next.title, type: next.type, area: next.area, credits: next.credits, lab: next.lab ?? false, grade_level: next.gradeLevel ?? 'All'
                  }, { onConflict: 'code' })
                  setCatalog(prev => [...prev.filter(x => x.code !== next.code), next])
                  setCatalogDraft(null)
                }} style={{ padding:'8px 24px', borderRadius:8, border:'none', background:'#D61F31', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>{headerPortal}
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
      {/* Student header — hidden on class-wide overview */}
      {student && tab !== 'overview' && (
        <div style={{ ...card, padding:'14px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
          <Avatar name={student.name} size={40} />
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1A365E' }}>{student.name}</div>
            <div style={{ fontSize:12, color:'#7A92B0' }}>Grade {student.grade} · High School</div>
          </div>
          {(() => { const wt = calcWeightedGPA(studentCourses); const dist = getDistinction(wt, studentCourses); return dist ? <span style={{ marginLeft:8, padding:'3px 12px', borderRadius:20, background:dist.bg, color:dist.col, fontSize:12, fontWeight:700 }}>🏅 {dist.label}</span> : null })()}
          <div style={{ marginLeft:'auto', display:'flex', gap:16, fontSize:13 }}>
            {[{l:'Credits',v:(getGradCredits(studentCourses,studentTransfers).total).toFixed(1)+'/'+TOTAL_CREDITS},{l:'UW GPA',v:calcGPA(studentCourses)?calcGPA(studentCourses).toFixed(2):'—'},{l:'W GPA',v:calcWeightedGPA(studentCourses)?calcWeightedGPA(studentCourses).toFixed(2):'—'}].map(x => (
              <div key={x.l} style={{ textAlign:'center' }}><div style={{ fontSize:10, fontWeight:700, color:'#7A92B0', textTransform:'uppercase', letterSpacing:'0.06em' }}>{x.l}</div><div style={{ fontSize:18, fontWeight:800, color:'#1A365E' }}>{x.v}</div></div>
            ))}
          </div>
        </div>
      )}
      {/* Tab bar */}
      <div style={{ ...card, marginBottom:16, padding:'0 4px', display:'flex', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'11px 16px', border:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t.id?700:500, color:tab===t.id?'#D61F31':'#7A92B0', background:'transparent', borderBottom:tab===t.id?'2px solid #D61F31':'2px solid transparent', whiteSpace:'nowrap', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6 }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div>
        {tab === 'overview'   && renderOverview()}
        {tab === 'studentov'  && renderStudentOverview()}
        {tab === 'courses'    && renderCourses()}
        {tab === 'gpa'        && renderGPA()}
        {tab === 'graduation' && renderGraduation()}
        {tab === 'skills'     && renderSkillGraph()}
        {tab === 'transfer'   && renderTransfer()}
        {tab === 'transcript' && renderTranscript()}
        {tab === 'catalog'    && renderCatalog()}
      </div>
      {/* Modals */}
      {courseModal && <CourseModal draft={courseModal} catalog={catalog} onChange={setCourseModal} onSave={saveCourseModal} onClose={() => setCourseModal(null)} />}
      {transferModal && <TransferModal draft={transferModal} onChange={setTransferModal} onSave={saveTransferModal} onClose={() => setTransferModal(null)} />}
      {selectedGradReq && gradBreakdown && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'grid', placeItems:'center', zIndex:9999, padding:16 }} onClick={() => setGradBreakdownKey(null)}>
          <div style={{ width:'min(860px,96vw)', maxHeight:'86vh', overflow:'auto', background:'#fff', borderRadius:14, border:'1px solid #E4EAF2', boxShadow:'0 20px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #E4EAF2', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:'#1A365E' }}>{selectedGradReq.icon} {selectedGradReq.label} Credit Breakdown</div>
                <div style={{ fontSize:11, color:'#7A92B0', marginTop:2 }}>Required: {selectedGradReq.required} cr · Earned: {gradBreakdown.earnedTotal} cr · Pending: {gradBreakdown.pendingTotal} cr</div>
              </div>
              <button onClick={() => setGradBreakdownKey(null)} style={{ width:30, height:30, borderRadius:8, border:'1px solid #E4EAF2', background:'#fff', color:'#1A365E', fontSize:16, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                <div style={{ border:'1px solid #E4EAF2', borderRadius:8, padding:'10px 12px', background:'#F7F9FC' }}>
                  <div style={{ fontSize:10, color:'#7A92B0', fontWeight:700, textTransform:'uppercase' }}>Required</div>
                  <div style={{ fontSize:22, color:'#1A365E', fontWeight:900 }}>{selectedGradReq.required}</div>
                </div>
                <div style={{ border:'1px solid #C6F6D5', borderRadius:8, padding:'10px 12px', background:'#F0FFF4' }}>
                  <div style={{ fontSize:10, color:'#0E6B3B', fontWeight:700, textTransform:'uppercase' }}>Earned</div>
                  <div style={{ fontSize:22, color:'#0E6B3B', fontWeight:900 }}>{gradBreakdown.earnedTotal}</div>
                </div>
                <div style={{ border:'1px solid #E4EAF2', borderRadius:8, padding:'10px 12px', background:'#FAFBFF' }}>
                  <div style={{ fontSize:10, color:'#7A92B0', fontWeight:700, textTransform:'uppercase' }}>Still Needed</div>
                  <div style={{ fontSize:22, color:gradBreakdown.remainingAfterPending > 0 ? '#D61F31' : '#0E6B3B', fontWeight:900 }}>{gradBreakdown.remainingAfterPending.toFixed(1)}</div>
                </div>
              </div>

              <div style={{ border:'1px solid #E4EAF2', borderRadius:10, overflow:'hidden' }}>
                <div style={{ padding:'8px 12px', fontSize:11, fontWeight:800, color:'#1A365E', background:'#F7F9FC', borderBottom:'1px solid #E4EAF2' }}>Completed Credits ({gradBreakdown.earnedItems.length})</div>
                {gradBreakdown.earnedItems.length === 0 ? (
                  <div style={{ padding:12, fontSize:12, color:'#7A92B0' }}>No completed courses or approved transfers counted in this category yet.</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#FAFBFF' }}>
                        {['Course / Credit','Source','Area','Grade','Credits Counted'].map(h => (
                          <th key={h} style={{ textAlign:'left', fontSize:10, color:'#7A92B0', fontWeight:700, padding:'8px 10px', borderBottom:'1px solid #E4EAF2' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gradBreakdown.earnedItems.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding:'8px 10px', fontSize:12, color:'#1A365E', borderBottom:'1px solid #F1F5F9', fontWeight:600 }}>{item.title}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#3D5475', borderBottom:'1px solid #F1F5F9' }}>{item.source}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#3D5475', borderBottom:'1px solid #F1F5F9' }}>{item.area}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#3D5475', borderBottom:'1px solid #F1F5F9' }}>{item.grade}</td>
                          <td style={{ padding:'8px 10px', fontSize:12, color:'#0E6B3B', borderBottom:'1px solid #F1F5F9', fontWeight:800 }}>{item.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {gradBreakdown.pendingItems.length > 0 && (
                <div style={{ border:'1px solid #FDE68A', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ padding:'8px 12px', fontSize:11, fontWeight:800, color:'#92400E', background:'#FFFBEA', borderBottom:'1px solid #FDE68A' }}>In Progress / Pending ({gradBreakdown.pendingItems.length})</div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#FFFBEB' }}>
                        {['Course','Source','Area','Status','Potential Credits'].map(h => (
                          <th key={h} style={{ textAlign:'left', fontSize:10, color:'#92400E', fontWeight:700, padding:'8px 10px', borderBottom:'1px solid #FDE68A' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gradBreakdown.pendingItems.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding:'8px 10px', fontSize:12, color:'#1A365E', borderBottom:'1px solid #FEF3C7', fontWeight:600 }}>{item.title}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#3D5475', borderBottom:'1px solid #FEF3C7' }}>{item.source}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#3D5475', borderBottom:'1px solid #FEF3C7' }}>{item.area}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#92400E', borderBottom:'1px solid #FEF3C7' }}>{item.grade || 'IP'}</td>
                          <td style={{ padding:'8px 10px', fontSize:12, color:'#92400E', borderBottom:'1px solid #FEF3C7', fontWeight:800 }}>{item.credits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div></>
  )
}
