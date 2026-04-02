export interface PTCriterion { name: string; w: number; d: { 1: string; 2: string; 3: string; 4: string } }
export interface PTMethodology { n: number; name: string; type: 'I' | 'C'; q: string; icon: string; col: string; cr: PTCriterion[] }

export const PTM: PTMethodology[] = [
  {n:1,name:"Place-Based Learning",type:"I",q:"Q1",icon:"🌍",col:"#0369A1",cr:[{name:"Local Connection",w:30,d:{1:"No connection to local context",2:"Weak connection to place",3:"Clear local relevance",4:"Deep, authentic local connection"}},{name:"Community Engagement",w:30,d:{1:"No community involvement",2:"Minimal engagement",3:"Meaningful community interaction",4:"Transformative community impact"}},{name:"Documentation",w:20,d:{1:"Little to no documentation",2:"Basic documentation",3:"Thorough documentation",4:"Exemplary, multi-modal documentation"}},{name:"Reflection",w:20,d:{1:"No reflection",2:"Surface reflection",3:"Thoughtful reflection",4:"Deep, transferable insights"}}]},
  {n:2,name:"Experience-Based Learning",type:"I",q:"Q1",icon:"🎯",col:"#7C3AED",cr:[{name:"Real-World Application",w:35,d:{1:"Purely theoretical",2:"Some application",3:"Clear real-world connection",4:"Authentic real-world impact"}},{name:"Skill Demonstration",w:35,d:{1:"No demonstrable skill",2:"Emerging skill",3:"Competent skill application",4:"Expert skill demonstration"}},{name:"Reflection",w:30,d:{1:"No reflection",2:"Surface reflection",3:"Thoughtful reflection",4:"Deep insight and transfer"}}]},
  {n:3,name:"Peer-to-Peer Learning",type:"C",q:"Q1",icon:"🤝",col:"#059669",cr:[{name:"Teaching Quality",w:40,d:{1:"Cannot explain concepts",2:"Basic explanation",3:"Clear and engaging teaching",4:"Inspiring and transformative teaching"}},{name:"Collaboration",w:30,d:{1:"No collaboration",2:"Minimal collaboration",3:"Effective collaboration",4:"Exemplary team synergy"}},{name:"Feedback Given",w:30,d:{1:"No constructive feedback",2:"Basic feedback",3:"Helpful, specific feedback",4:"Insightful, growth-oriented feedback"}}]},
  {n:4,name:"Project-Based Learning",type:"I",q:"Q1",icon:"🔨",col:"#D97706",cr:[{name:"Problem Definition",w:25,d:{1:"Problem not identified",2:"Vague problem statement",3:"Clear problem definition",4:"Insightful, nuanced problem framing"}},{name:"Research & Inquiry",w:25,d:{1:"No research conducted",2:"Minimal research",3:"Thorough research",4:"In-depth, multi-source research"}},{name:"Solution Quality",w:30,d:{1:"No viable solution",2:"Partial solution",3:"Effective solution",4:"Innovative, impactful solution"}},{name:"Presentation",w:20,d:{1:"Unclear presentation",2:"Basic presentation",3:"Clear presentation",4:"Compelling, professional presentation"}}]},
  {n:5,name:"Challenge-Based Learning",type:"I",q:"Q1",icon:"⚡",col:"#D61F31",cr:[{name:"Challenge Identification",w:30,d:{1:"Challenge not identified",2:"Vague challenge",3:"Clear, meaningful challenge",4:"Complex, real-world challenge"}},{name:"Action Plan",w:30,d:{1:"No action plan",2:"Incomplete plan",3:"Solid action plan",4:"Strategic, adaptive plan"}},{name:"Implementation",w:40,d:{1:"Not implemented",2:"Partial implementation",3:"Full implementation",4:"Exemplary execution with iteration"}}]},
  {n:6,name:"Play-Based Learning",type:"I",q:"Q1",icon:"🎮",col:"#EC4899",cr:[{name:"Creative Engagement",w:40,d:{1:"No creative engagement",2:"Minimal creativity",3:"Clear creative expression",4:"Highly original, imaginative work"}},{name:"Learning Transfer",w:35,d:{1:"No transfer demonstrated",2:"Limited transfer",3:"Clear learning transfer",4:"Deep, cross-domain transfer"}},{name:"Reflection",w:25,d:{1:"No reflection",2:"Surface reflection",3:"Meaningful reflection",4:"Profound insight"}}]},
  {n:7,name:"Nature-Based Learning",type:"I",q:"Q2",icon:"🌿",col:"#15803D",cr:[{name:"Environmental Connection",w:35,d:{1:"No nature connection",2:"Superficial connection",3:"Meaningful nature integration",4:"Deep ecological understanding"}},{name:"Observation Skills",w:35,d:{1:"No systematic observation",2:"Basic observation",3:"Detailed observation",4:"Scientific, analytical observation"}},{name:"Sustainability Awareness",w:30,d:{1:"No awareness",2:"Basic awareness",3:"Clear sustainability thinking",4:"Transformative environmental action"}}]},
  {n:8,name:"Sustainability-Based Learning",type:"I",q:"Q2",icon:"♻️",col:"#166534",cr:[{name:"Systems Thinking",w:35,d:{1:"No systems thinking",2:"Basic system awareness",3:"Clear systems analysis",4:"Complex systems mastery"}},{name:"Sustainability Solution",w:35,d:{1:"No solution proposed",2:"Partial solution",3:"Viable sustainability solution",4:"Innovative, scalable solution"}},{name:"Impact Measurement",w:30,d:{1:"No measurement",2:"Basic metrics",3:"Clear impact data",4:"Rigorous, multi-dimensional impact"}}]},
  {n:9,name:"Phenomenon-Based Learning",type:"I",q:"Q2",icon:"🔭",col:"#1D4ED8",cr:[{name:"Phenomenon Understanding",w:35,d:{1:"Phenomenon not understood",2:"Basic understanding",3:"Deep phenomenon analysis",4:"Expert-level phenomenon mastery"}},{name:"Inquiry Process",w:35,d:{1:"No inquiry process",2:"Basic inquiry",3:"Structured inquiry",4:"Scientific, iterative inquiry"}},{name:"Evidence Use",w:30,d:{1:"No evidence used",2:"Minimal evidence",3:"Strong evidence base",4:"Comprehensive evidence synthesis"}}]},
  {n:10,name:"Game-Based Learning",type:"I",q:"Q2",icon:"🎲",col:"#7C3AED",cr:[{name:"Game Design/Use",w:40,d:{1:"No intentional game use",2:"Basic game integration",3:"Effective game-based approach",4:"Masterful game design or application"}},{name:"Learning Objectives Met",w:35,d:{1:"Objectives not met",2:"Partially met",3:"Objectives clearly met",4:"Objectives exceeded with depth"}},{name:"Reflection",w:25,d:{1:"No reflection",2:"Surface reflection",3:"Meaningful reflection",4:"Deep metacognitive insight"}}]},
  {n:11,name:"Service Learning",type:"C",q:"Q2",icon:"❤️",col:"#B91C1C",cr:[{name:"Community Need Identified",w:30,d:{1:"Need not identified",2:"Vague need",3:"Clear community need",4:"Deeply researched, authentic need"}},{name:"Service Quality",w:40,d:{1:"No meaningful service",2:"Basic service",3:"High-quality service",4:"Transformative community service"}},{name:"Civic Reflection",w:30,d:{1:"No civic reflection",2:"Surface reflection",3:"Thoughtful civic engagement",4:"Deep civic responsibility demonstrated"}}]},
  {n:12,name:"Social Entrepreneurship",type:"C",q:"Q2",icon:"💡",col:"#B45309",cr:[{name:"Problem-Solution Fit",w:35,d:{1:"No fit identified",2:"Weak fit",3:"Clear problem-solution fit",4:"Compelling, validated fit"}},{name:"Business/Impact Model",w:35,d:{1:"No model",2:"Basic model",3:"Viable model",4:"Scalable, innovative model"}},{name:"Pitch & Communication",w:30,d:{1:"Unclear pitch",2:"Basic pitch",3:"Effective pitch",4:"Compelling, investor-ready pitch"}}]},
  {n:13,name:"Learning by Tinkering",type:"I",q:"Q3",icon:"🔧",col:"#92400E",cr:[{name:"Experimentation",w:40,d:{1:"No experimentation",2:"Minimal tinkering",3:"Systematic experimentation",4:"Iterative, innovative experimentation"}},{name:"Maker Mindset",w:35,d:{1:"No maker mindset",2:"Basic curiosity",3:"Strong maker approach",4:"Exemplary maker/hacker mindset"}},{name:"Documentation",w:25,d:{1:"No documentation",2:"Basic notes",3:"Clear process documentation",4:"Comprehensive maker journal"}}]},
  {n:14,name:"Multilingual Learning",type:"I",q:"Q3",icon:"🗣️",col:"#0891B2",cr:[{name:"Language Use",w:40,d:{1:"No target language use",2:"Minimal language use",3:"Consistent language use",4:"Fluent, nuanced language use"}},{name:"Cultural Awareness",w:35,d:{1:"No cultural awareness",2:"Basic awareness",3:"Strong cultural understanding",4:"Deep intercultural competence"}},{name:"Communication Clarity",w:25,d:{1:"Unclear communication",2:"Basic clarity",3:"Clear communication",4:"Eloquent, precise communication"}}]},
  {n:15,name:"Authentic Learning",type:"I",q:"Q3",icon:"✅",col:"#059669",cr:[{name:"Real-World Relevance",w:40,d:{1:"No real-world connection",2:"Limited relevance",3:"Clear real-world application",4:"Authentic, high-stakes application"}},{name:"Expert Engagement",w:30,d:{1:"No expert contact",2:"Minimal expert input",3:"Meaningful expert engagement",4:"Deep mentorship or collaboration"}},{name:"Authentic Product",w:30,d:{1:"No authentic product",2:"Basic product",3:"Quality authentic product",4:"Professional-grade deliverable"}}]},
  {n:16,name:"Passion Projects",type:"I",q:"Q3",icon:"🔥",col:"#EA580C",cr:[{name:"Personal Connection",w:35,d:{1:"No personal connection",2:"Weak personal relevance",3:"Clear passion and interest",4:"Deep, intrinsic motivation evident"}},{name:"Depth of Inquiry",w:35,d:{1:"Superficial exploration",2:"Basic inquiry",3:"Deep investigation",4:"Expert-level passion pursuit"}},{name:"Shareable Outcome",w:30,d:{1:"Nothing to share",2:"Basic output",3:"Quality shareable work",4:"Inspiring, publishable work"}}]},
  {n:17,name:"Deeper Learning",type:"I",q:"Q3",icon:"🧠",col:"#4F46E5",cr:[{name:"Content Mastery",w:35,d:{1:"No mastery demonstrated",2:"Basic understanding",3:"Strong content mastery",4:"Expert-level content command"}},{name:"Transfer of Learning",w:35,d:{1:"No transfer",2:"Limited transfer",3:"Clear transfer",4:"Sophisticated cross-domain transfer"}},{name:"Academic Mindset",w:30,d:{1:"No academic engagement",2:"Basic engagement",3:"Strong academic mindset",4:"Exceptional scholarly disposition"}}]},
  {n:18,name:"Design Thinking",type:"I",q:"Q3",icon:"✏️",col:"#0284C7",cr:[{name:"Empathy & Research",w:25,d:{1:"No empathy research",2:"Basic user research",3:"Clear empathy mapping",4:"Deep, validated user insights"}},{name:"Ideation",w:25,d:{1:"No ideation",2:"Limited ideas",3:"Rich ideation process",4:"Breakthrough creative ideation"}},{name:"Prototyping",w:25,d:{1:"No prototype",2:"Basic prototype",3:"Functional prototype",4:"Tested, iterated prototype"}},{name:"Testing & Iteration",w:25,d:{1:"No testing",2:"Basic testing",3:"User-tested iteration",4:"Rigorous, evidence-based iteration"}}]},
  {n:19,name:"Mobile Learning",type:"I",q:"Q3",icon:"📱",col:"#0F766E",cr:[{name:"Technology Use",w:35,d:{1:"No effective tech use",2:"Basic technology use",3:"Effective mobile integration",4:"Innovative, purposeful tech use"}},{name:"Digital Citizenship",w:35,d:{1:"No digital responsibility",2:"Basic digital awareness",3:"Responsible digital citizen",4:"Exemplary digital leadership"}},{name:"Learning Outcome",w:30,d:{1:"No clear outcome",2:"Basic outcome",3:"Strong learning outcome",4:"Transformative digital learning"}}]},
  {n:20,name:"Adventure Learning",type:"I",q:"Q3",icon:"🏔️",col:"#854D0E",cr:[{name:"Challenge Acceptance",w:35,d:{1:"Avoids challenge",2:"Reluctant engagement",3:"Embraces challenge",4:"Seeks and thrives in challenge"}},{name:"Resilience",w:35,d:{1:"Gives up easily",2:"Limited persistence",3:"Demonstrates resilience",4:"Exemplary grit and recovery"}},{name:"Reflection",w:30,d:{1:"No reflection",2:"Surface reflection",3:"Meaningful reflection",4:"Deep growth mindset insight"}}]},
  {n:21,name:"Internship-Based Learning",type:"I",q:"Q3",icon:"💼",col:"#374151",cr:[{name:"Professional Conduct",w:30,d:{1:"Unprofessional",2:"Basic professionalism",3:"Consistent professionalism",4:"Exemplary professional conduct"}},{name:"Skill Application",w:40,d:{1:"No skills applied",2:"Basic skill use",3:"Clear skill application",4:"Expert skill transfer in context"}},{name:"Reflection & Report",w:30,d:{1:"No report",2:"Basic report",3:"Detailed reflection report",4:"Insightful, publication-quality report"}}]},
  {n:22,name:"Boot Camp",type:"I",q:"Q4",icon:"🥾",col:"#1F2937",cr:[{name:"Intensity & Commitment",w:35,d:{1:"Not committed",2:"Basic participation",3:"Full commitment",4:"Outstanding dedication and endurance"}},{name:"Skill Acquisition",w:40,d:{1:"No new skills",2:"Basic skill gain",3:"Clear skill development",4:"Rapid, high-level skill mastery"}},{name:"Peer Support",w:25,d:{1:"No peer support",2:"Minimal support",3:"Active peer support",4:"Exemplary mentoring of peers"}}]},
  {n:23,name:"Agile Learning",type:"I",q:"Q4",icon:"🔄",col:"#0369A1",cr:[{name:"Sprint Planning",w:30,d:{1:"No planning",2:"Basic plan",3:"Clear sprint plan",4:"Strategic, adaptive planning"}},{name:"Iteration & Improvement",w:40,d:{1:"No iteration",2:"One revision",3:"Multiple meaningful iterations",4:"Continuous, data-driven improvement"}},{name:"Team Agility",w:30,d:{1:"Rigid, inflexible approach",2:"Some flexibility",3:"Responsive team",4:"Highly adaptive, self-organizing team"}}]},
  {n:24,name:"Research-Based Learning",type:"I",q:"Q4",icon:"📚",col:"#6D28D9",cr:[{name:"Research Question",w:25,d:{1:"No clear question",2:"Vague question",3:"Clear research question",4:"Sophisticated, original research question"}},{name:"Methodology",w:30,d:{1:"No methodology",2:"Basic approach",3:"Sound methodology",4:"Rigorous, replicable methodology"}},{name:"Analysis & Findings",w:30,d:{1:"No analysis",2:"Basic analysis",3:"Strong analysis",4:"Expert-level analytical insight"}},{name:"Academic Communication",w:15,d:{1:"Poor communication",2:"Basic writing",3:"Clear academic writing",4:"Publication-quality scholarship"}}]},
  {n:25,name:"Open Space Technology",type:"C",q:"Q4",icon:"🌐",col:"#0891B2",cr:[{name:"Facilitation",w:40,d:{1:"Cannot facilitate",2:"Basic facilitation",3:"Effective facilitation",4:"Inspiring, transformative facilitation"}},{name:"Emergent Learning",w:35,d:{1:"No emergent insight",2:"Limited emergence",3:"Clear emergent learning",4:"Rich, self-organized discovery"}},{name:"Documentation",w:25,d:{1:"No documentation",2:"Basic record",3:"Clear proceedings",4:"Comprehensive open space record"}}]},
  {n:26,name:"Stages of Autonomy",type:"I",q:"Q4",icon:"🎓",col:"#7C3AED",cr:[{name:"Self-Direction",w:40,d:{1:"Fully dependent",2:"Some independence",3:"Consistently self-directed",4:"Fully autonomous learner"}},{name:"Goal Setting & Achievement",w:35,d:{1:"No goals set",2:"Vague goals",3:"Clear, achieved goals",4:"Ambitious goals exceeded"}},{name:"Metacognition",w:25,d:{1:"No self-awareness",2:"Basic self-awareness",3:"Strong metacognitive skill",4:"Exceptional learning ownership"}}]},
  {n:27,name:"Entrepreneurial/ESTEAM",type:"C",q:"Q4",icon:"🚀",col:"#D61F31",cr:[{name:"Innovation",w:30,d:{1:"No innovative thinking",2:"Basic ideas",3:"Clear innovative approach",4:"Breakthrough, scalable innovation"}},{name:"STEAM Integration",w:30,d:{1:"No STEAM integration",2:"One domain used",3:"Multiple domains integrated",4:"Seamless STEAM synthesis"}},{name:"Entrepreneurial Mindset",w:25,d:{1:"No entrepreneurial thinking",2:"Basic enterprise",3:"Strong entrepreneurial approach",4:"Compelling venture mindset"}},{name:"Pitch & Impact",w:15,d:{1:"No pitch",2:"Basic pitch",3:"Effective pitch",4:"Investor-ready, high-impact pitch"}}]},
]

export const PTCORE = [
  {name:"Collaboration",w:25,d:{1:"Works in isolation; disruptive to group",2:"Participates when prompted; limited contribution",3:"Actively contributes; supports team goals",4:"Leads collaboration; elevates the whole team"}},
  {name:"Communication",w:25,d:{1:"Unable to articulate ideas clearly",2:"Basic communication with limited clarity",3:"Communicates ideas clearly and purposefully",4:"Eloquent, audience-aware communication"}},
  {name:"Critical Thinking",w:25,d:{1:"Accepts information without question",2:"Some analysis but lacks depth",3:"Analyses evidence and draws reasoned conclusions",4:"Sophisticated synthesis; challenges assumptions constructively"}},
  {name:"Creativity",w:25,d:{1:"Reproduces existing ideas without adaptation",2:"Some originality; mostly conventional",3:"Generates original, useful ideas",4:"Highly inventive; creates novel solutions with impact"}},
]

export const PTQD: Record<string, { lbl: string; tot: number; end: string }> = {
  Q1: { lbl: 'Quarter 1', tot: 7, end: '2024-11-30' },
  Q2: { lbl: 'Quarter 2', tot: 7, end: '2025-02-28' },
  Q3: { lbl: 'Quarter 3', tot: 6, end: '2025-05-31' },
  Q4: { lbl: 'Quarter 4', tot: 7, end: '2025-08-31' },
}

export const PTSTAT = ['Not Assigned','Assigned','In Progress','Work Uploaded','Under Review','Approved','Resubmission Required']
export const PTDELIV = ['Report','Prototype','Presentation','Video','Portfolio','Exhibition','Research Paper','Digital Project','Performance','Other']

export const STAT_META: Record<string, { bg: string; tc: string; ic: string }> = {
  'Not Assigned':          { bg: '#F1F5F9', tc: '#94A3B8', ic: '·' },
  'Assigned':              { bg: '#DBEAFE', tc: '#1D4ED8', ic: '○' },
  'In Progress':           { bg: '#EDE9FE', tc: '#6D28D9', ic: '◑' },
  'Work Uploaded':         { bg: '#FEF3C7', tc: '#B45309', ic: '◕' },
  'Under Review':          { bg: '#FFF7ED', tc: '#9A3412', ic: '⧗' },
  'Approved':              { bg: '#DCFCE7', tc: '#15803D', ic: '✓' },
  'Resubmission Required': { bg: '#FEE2E2', tc: '#DC2626', ic: '↩' },
}

export interface PTAssignment {
  id: string; student_id: string; methodology_n: number; quarter: string; status: string
  title: string; brief: string; wurl: string; reflect: string; cnotes: string
  due: string; mastery: boolean; ptype: string; deliv: string; score: number | null; yr: string
}

export interface PTEvaluation {
  id: string; assignment_id: string; student_id: string
  ms: number | null; cs: number | null; ov: number | null
  mastery: boolean; cr: Record<string, number>; co: Record<string, number>; comment: string
}

export function mapAssignment(r: Record<string, unknown>): PTAssignment {
  return {
    id: r.id as string,
    student_id: r.student_id as string,
    methodology_n: r.methodology_n as number,
    quarter: (r.quarter as string) ?? '',
    status: (r.status as string) ?? 'Not Assigned',
    title: (r.title as string) ?? '',
    brief: (r.brief as string) ?? (r.cnotes as string) ?? '',
    wurl: (r.wurl as string) ?? (r.submission_url as string) ?? '',
    reflect: (r.reflect as string) ?? '',
    cnotes: (r.cnotes as string) ?? '',
    due: (r.due as string) ?? (r.due_date as string) ?? '',
    mastery: (r.mastery as boolean) ?? false,
    ptype: (r.ptype as string) ?? 'I',
    deliv: (r.deliv as string) ?? 'Report',
    score: (r.score as number | null) ?? null,
    yr: (r.yr as string) ?? '2024-25',
  }
}

export function mapEvaluation(r: Record<string, unknown>): PTEvaluation {
  return {
    id: r.id as string,
    assignment_id: (r.assignment_id as string) ?? '',
    student_id: (r.student_id as string) ?? '',
    ms: (r.ms as number | null) ?? null,
    cs: (r.cs as number | null) ?? null,
    ov: (r.ov as number | null) ?? (r.overall as number | null) ?? null,
    mastery: (r.mastery as boolean) ?? false,
    cr: (r.cr as Record<string, number>) ?? (r.competencies as Record<string, number>) ?? {},
    co: (r.co as Record<string, number>) ?? {},
    comment: (r.comment as string) ?? '',
  }
}

export function ptSUM(studentId: string, assignments: PTAssignment[], evaluations: PTEvaluation[]) {
  const ap = assignments.filter(a => a.student_id === studentId && a.status === 'Approved')
  const ev = evaluations.filter(e => e.student_id === studentId)
  const avg = ev.length ? Math.round(ev.reduce((a, b) => a + (b.ov ?? 0), 0) / ev.length * 10) / 10 : null
  return {
    tot: ap.length,
    ind: ap.filter(a => a.ptype === 'I').length,
    col: ap.filter(a => a.ptype === 'C').length,
    mas: ap.filter(a => a.mastery).length,
    avg,
  }
}

export function ptQST(studentId: string, assignments: PTAssignment[]) {
  const today = new Date().toISOString().slice(0, 10)
  const r: Record<string, { st: string; done: number; need: number; end: string }> = {}
  Object.keys(PTQD).forEach(q => {
    const qd = PTQD[q]
    const done = assignments.filter(a => a.student_id === studentId && a.quarter === q && a.status === 'Approved').length
    const past = today > qd.end
    const near = !past && (new Date(qd.end).getTime() - new Date(today).getTime()) < 30 * 86400000
    const st = done >= qd.tot ? 'Complete' : past ? 'Overdue' : near ? 'At Risk' : 'On Track'
    r[q] = { st, done, need: qd.tot, end: qd.end }
  })
  return r
}

export function ptScoreBadge(score: number | null, sz = 11): React.CSSProperties & { label: string; score: string } {
  if (score === null) return { label: '—', score: '—', color: '#94A3B8', background: 'transparent', padding: '2px 8px', borderRadius: 6, fontSize: sz, fontWeight: 800 }
  const s = parseFloat(String(score))
  const cfg = s >= 3.5 ? { bg: '#FEF9C3', tc: '#92400E', lb: 'Mastery' }
    : s >= 3.0 ? { bg: '#DCFCE7', tc: '#14532D', lb: 'Proficient' }
    : s >= 2.5 ? { bg: '#DBEAFE', tc: '#1E3A8A', lb: 'Developing+' }
    : s >= 2.0 ? { bg: '#FFEDD5', tc: '#9A3412', lb: 'Developing' }
    : { bg: '#FEE2E2', tc: '#7F1D1D', lb: 'Beginning' }
  return { label: cfg.lb, score: s.toFixed(1), background: cfg.bg, color: cfg.tc, padding: '2px 8px', borderRadius: 6, fontSize: sz, fontWeight: 800 }
}
