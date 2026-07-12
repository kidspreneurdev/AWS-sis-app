import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { supabase } from '@/lib/supabase'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type {
  K5Lesson, K5Slide,
  IntroSlide, FourSlide, JourneySlide, PartsSlide, GiveSlide, ReadySlide,
} from '@/types/k5Lesson'

// @ts-ignore — Vite ?url import for pdfjs worker
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string

const NAVY  = '#1A365E'
const GOLD  = '#FAC600'
const RED   = '#D61F31'
const GREEN = '#16A34A'

type PlayerMode = 'slides' | 'quiz' | 'complete'

interface Props {
  lesson: K5Lesson
  studentName: string
  grade: string
  onClose: () => void
  onComplete: (starsEarned: number) => Promise<void>
}

// ─── JSON card renderers ──────────────────────────────────────────────────────

function IntroContent({ slide }: { slide: IntroSlide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:'28px 32px', textAlign:'center', gap:16 }}>
      <div style={{ fontSize:90 }}>{slide.emoji}</div>
      <div style={{ fontSize:28, fontWeight:900, color:'#fff', lineHeight:1.2 }}>{slide.title}</div>
      <div style={{ fontSize:16, color:'rgba(255,255,255,.82)', lineHeight:1.75, maxWidth:420 }}>{slide.body}</div>
    </div>
  )
}

function FourContent({ slide }: { slide: FourSlide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'22px 24px' }}>
      <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>{slide.title}</div>
      <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:16 }}>{slide.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1 }}>
        {slide.items.map((item, i) => (
          <div key={i} style={{ background:item.bg, borderRadius:18, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'18px 12px' }}>
            <div style={{ fontSize:46 }}>{item.e}</div>
            <div style={{ fontSize:16, fontWeight:800, color:item.tc }}>{item.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function JourneyContent({ slide }: { slide: JourneySlide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'22px 24px' }}>
      <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>{slide.title}</div>
      <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:24 }}>{slide.label}</div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', justifyContent:'center' }}>
          {slide.steps.flatMap((step, i) => {
            const m = step.match(/^(\S+)\s+(.+)$/)
            const emoji = m ? m[1] : step
            const label = m ? m[2] : ''
            const els = [
              <div key={`s${i}`} style={{ background:'rgba(255,255,255,.15)', border:'2px solid rgba(255,255,255,.22)', borderRadius:16, padding:'16px 20px', textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:30, marginBottom:6 }}>{emoji}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{label}</div>
              </div>,
            ]
            if (i < slide.steps.length - 1) els.push(<div key={`a${i}`} style={{ fontSize:22, color:GOLD, fontWeight:900 }}>→</div>)
            return els
          })}
        </div>
      </div>
    </div>
  )
}

function PartsContent({ slide }: { slide: PartsSlide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'22px 24px' }}>
      <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>{slide.title}</div>
      <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:16 }}>{slide.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, flex:1 }}>
        {slide.items.map((item, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,.14)', border:'2px solid rgba(255,255,255,.2)', borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, padding:'16px 10px', textAlign:'center' }}>
            <div style={{ fontSize:40 }}>{item.e}</div>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{item.l}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.65)', lineHeight:1.4 }}>{item.s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GiveContent({ slide }: { slide: GiveSlide }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:'22px 24px' }}>
      <div style={{ fontSize:24, fontWeight:900, color:'#fff', marginBottom:4 }}>{slide.title}</div>
      <div style={{ fontSize:13, color:GOLD, fontWeight:700, marginBottom:20 }}>{slide.label}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, flex:1, alignContent:'start' }}>
        {slide.items.map((item, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,.14)', border:'2px solid rgba(255,255,255,.2)', borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:'18px 12px', textAlign:'center' }}>
            <div style={{ fontSize:36 }}>{item.e}</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{item.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadyContent({ slide, onStartQuiz }: { slide: ReadySlide; onStartQuiz: () => void }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:'28px 32px', textAlign:'center', gap:18 }}>
      <div style={{ fontSize:72 }}>🎉</div>
      <div style={{ fontSize:26, fontWeight:900, color:'#fff', lineHeight:1.2 }}>{slide.title}</div>
      <div style={{ fontSize:15, color:'rgba(255,255,255,.8)', lineHeight:1.7, maxWidth:380 }}>{slide.body}</div>
      <button onClick={onStartQuiz} style={{ marginTop:8, padding:'14px 36px', background:GOLD, border:'none', borderRadius:14, fontSize:17, fontWeight:900, color:NAVY, cursor:'pointer', fontFamily:'inherit' }}>
        Start quiz! 🎮
      </button>
    </div>
  )
}

function renderJsonSlide(slide: K5Slide, onStartQuiz: () => void) {
  switch (slide.type) {
    case 'intro':   return <IntroContent slide={slide} />
    case 'four':    return <FourContent slide={slide} />
    case 'journey': return <JourneyContent slide={slide} />
    case 'parts':   return <PartsContent slide={slide} />
    case 'give':    return <GiveContent slide={slide} />
    case 'ready':   return <ReadyContent slide={slide} onStartQuiz={onStartQuiz} />
  }
}

// ─── PDF page viewer ──────────────────────────────────────────────────────────

function PdfViewer({ url, page, width, onLoad, onPageLoad }: { url: string; page: number; width: number; onLoad: (n: number) => void; onPageLoad: (aspect: number) => void }) {
  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => onLoad(numPages)}
      loading={
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid rgba(255,255,255,.2)`, borderTopColor:GOLD, animation:'spin 0.7s linear infinite' }} />
        </div>
      }
      error={
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.6)', fontSize:14 }}>
          ⚠️ Could not load PDF. Check your internet connection.
        </div>
      }
    >
      <Page
        pageNumber={page}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={p => onPageLoad(p.width / p.height)}
      />
    </Document>
  )
}

// ─── Main player ──────────────────────────────────────────────────────────────

export function K5LessonPlayer({ lesson, studentName, grade, onClose, onComplete }: Props) {
  const isPdf = !!lesson.slidesFileUrl

  // Signed URL for the private-bucket PDF (generated once on mount)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!lesson.slidesFileUrl) return
    supabase.storage
      .from('k5-lesson-slides')
      .createSignedUrl(lesson.slidesFileUrl, 7200)
      .then(({ data }) => { if (data?.signedUrl) setPdfSignedUrl(data.signedUrl) })
  }, [lesson.slidesFileUrl])

  // Slide state (used for both JSON cards and PDF pages)
  const [slideIdx,    setSlideIdx]    = useState(0)
  const [numPages,    setNumPages]    = useState(0)
  const [allViewed,   setAllViewed]   = useState(!isPdf && lesson.slides.length <= 1)

  // PDF sizing: fit the page to fill the available viewport space (like
  // object-fit: contain) using the container's real dimensions and the PDF's
  // actual aspect ratio, instead of a fixed width that left slides shrunk.
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [pdfAspect, setPdfAspect] = useState(16 / 9)

  useEffect(() => {
    if (!isPdf) return
    const el = pdfContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0]?.contentRect ?? {}
      if (width && height) setContainerSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isPdf])

  const PDF_PAD = 32
  const pdfAvailW = Math.max(containerSize.width - PDF_PAD, 0)
  const pdfAvailH = Math.max(containerSize.height - PDF_PAD, 0)
  const pdfWidth  = pdfAvailW > 0 && pdfAvailH > 0
    ? Math.min(pdfAvailW, pdfAvailH * pdfAspect)
    : pdfAvailW

  // Quiz state
  const [mode,     setMode]     = useState<PlayerMode>('slides')
  const [qIdx,     setQIdx]     = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [stars,    setStars]    = useState(0)
  const [saving,   setSaving]   = useState(false)

  // Derived — PDF uses 1-based page numbers
  const totalSlides   = isPdf ? numPages : lesson.slides.length
  const currentPage   = isPdf ? slideIdx + 1 : slideIdx          // 1-based for PDF display
  const isLastSlide   = isPdf ? (numPages > 0 && slideIdx === numPages - 1) : (slideIdx === lesson.slides.length - 1)
  const slidePct      = totalSlides > 1 ? Math.round(slideIdx / Math.max(totalSlides - 1, 1) * 100) : 100
  const showDots      = totalSlides <= 10

  const q        = lesson.quiz[qIdx]
  const isLastQ  = qIdx === lesson.quiz.length - 1

  // ── Navigation ──────────────────────────────────────────────────────────────
  function changeSlide(dir: -1 | 1) {
    const next = Math.max(0, Math.min(totalSlides - 1, slideIdx + dir))
    setSlideIdx(next)
    if (next === totalSlides - 1) setAllViewed(true)
  }

  function jumpSlide(i: number) {
    setSlideIdx(i)
    if (i === totalSlides - 1) setAllViewed(true)
  }

  function startQuiz() {
    setMode('quiz')
    setQIdx(0)
    setSelected(null)
    setAnswered(false)
    setStars(0)
  }

  function selectAnswer(i: number) {
    if (answered) return
    setSelected(i)
    setAnswered(true)
    if (i === q.ok) setStars(s => s + 1)
  }

  async function nextQuestion() {
    if (isLastQ) {
      setMode('complete')
      setSaving(true)
      await onComplete(stars)
      setSaving(false)
    } else {
      setQIdx(i => i + 1)
      setSelected(null)
      setAnswered(false)
    }
  }

  const optionStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = { padding:'28px 22px', borderRadius:20, border:'3px solid', fontSize:22, fontWeight:700, cursor: answered ? 'default' : 'pointer', textAlign:'center', lineHeight:1.4, fontFamily:'inherit', background:'#fff', color:NAVY, borderColor:'#CBD5E1' }
    if (!answered) return base
    if (i === q.ok) return { ...base, background:'#DCFCE7', borderColor:GREEN, color:'#166534' }
    if (i === selected) return { ...base, background:'#FEE2E2', borderColor:RED, color:'#991B1B' }
    return { ...base, background:'#F8FAFC', borderColor:'#E2E8F0', color:'#94A3B8' }
  }

  const optionPrefix = (i: number) => !answered ? '' : i === q.ok ? '✓ ' : i === selected ? '✗ ' : ''
  const completedDate = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const firstName = studentName.split(' ')[0]

  // ── Top bar shared styles ───────────────────────────────────────────────────
  const topBar = (children: React.ReactNode) => (
    <div style={{ background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', padding:'0 16px', height:52, flexShrink:0, gap:12 }}>
      {children}
    </div>
  )

  const bottomBar = (children: React.ReactNode) => (
    <div style={{ background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', flexShrink:0 }}>
      {children}
    </div>
  )

  const navBtn = (label: string, onClick: () => void, disabled = false, gold = false) => (
    <button onClick={onClick} disabled={disabled} style={{ padding:'10px 22px', borderRadius:10, border: gold ? 'none' : '2px solid rgba(255,255,255,.25)', background: gold ? GOLD : 'rgba(255,255,255,.1)', color: disabled ? 'rgba(255,255,255,.3)' : gold ? NAVY : '#fff', fontSize:14, fontWeight:900, cursor: disabled ? 'default' : 'pointer', fontFamily:'inherit' }}>
      {label}
    </button>
  )

  // ── Slides mode ──────────────────────────────────────────────────────────────
  if (mode === 'slides') {
    const jsonSlide = !isPdf ? lesson.slides[slideIdx] : null
    const slideBg   = jsonSlide ? jsonSlide.bg : '#0F2240'

    return (
      <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', flexDirection:'column', fontFamily:'Poppins, sans-serif', background: slideBg }}>

        {/* Top bar */}
        {topBar(
          <>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:8, color:'rgba(255,255,255,.8)', fontSize:12, fontWeight:700, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              ✕ Close
            </button>
            <div style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lesson.title}</div>

            {/* Dots or page counter */}
            {showDots && totalSlides > 0 ? (
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                {Array.from({ length: totalSlides }, (_, i) => (
                  <button key={i} onClick={() => jumpSlide(i)} style={{ width: i === slideIdx ? 20 : 8, height:8, borderRadius:4, background: i === slideIdx ? GOLD : 'rgba(255,255,255,.35)', border:'none', cursor:'pointer', padding:0, transition:'width 200ms,background 200ms' }} />
                ))}
              </div>
            ) : totalSlides > 0 ? (
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)', flexShrink:0 }}>
                Page {currentPage} / {totalSlides}
              </div>
            ) : null}

            <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', flexShrink:0 }}>{totalSlides > 0 ? `${slidePct}%` : ''}</div>
          </>
        )}

        {/* Slide content */}
        {isPdf ? (
          <div ref={pdfContainerRef} style={{ flex:1, background:'#F1F5F9', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            {pdfSignedUrl ? (
              <PdfViewer
                url={pdfSignedUrl}
                page={slideIdx + 1}
                width={pdfWidth}
                onLoad={n => {
                  setNumPages(n)
                  if (n <= 1) setAllViewed(true)
                }}
                onPageLoad={setPdfAspect}
              />
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid rgba(0,0,0,.1)`, borderTopColor:NAVY, animation:'spin 0.7s linear infinite' }} />
              </div>
            )}
          </div>
        ) : jsonSlide ? (
          <div style={{ flex:1, background: jsonSlide.bg, overflow:'hidden', position:'relative' }}>
            {renderJsonSlide(jsonSlide, startQuiz)}
          </div>
        ) : null}

        {/* Bottom nav */}
        {bottomBar(
          <>
            {navBtn('← Prev', () => changeSlide(-1), slideIdx === 0)}

            <div style={{ fontSize:12, color:'rgba(255,255,255,.55)' }}>
              {isPdf && numPages === 0 ? 'Loading…' : `${isPdf ? 'Page' : 'Slide'} ${isPdf ? currentPage : slideIdx + 1} / ${totalSlides || '…'}`}
            </div>

            {isLastSlide && !isPdf && jsonSlide?.type === 'ready' ? null
              : isLastSlide
              ? navBtn('Start quiz! 🎮', startQuiz, !allViewed, allViewed)
              : navBtn('Next →', () => changeSlide(1), false, true)}
          </>
        )}
      </div>
    )
  }

  // ── Quiz mode ─────────────────────────────────────────────────────────────────
  if (mode === 'quiz') {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', flexDirection:'column', fontFamily:'Poppins, sans-serif', background:'#F8FAFC', overflowY:'auto' }}>

        {topBar(
          <>
            <div style={{ flex:1, fontSize:18, fontWeight:700, color:'#fff' }}>Question {qIdx + 1} / {lesson.quiz.length}</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(250,198,0,.18)', border:'1.5px solid rgba(250,198,0,.4)', borderRadius:22, padding:'6px 18px' }}>
              <span style={{ fontSize:20 }}>⭐</span>
              <span style={{ fontSize:16, fontWeight:800, color:GOLD }}>{stars} / {lesson.quiz.length}</span>
            </div>
          </>
        )}

        <div style={{ display:'flex', gap:7, padding:'13px 28px', background:'#fff', borderBottom:'1px solid #E2E8F0' }}>
          {lesson.quiz.map((_, i) => (
            <div key={i} style={{ flex:1, height:8, borderRadius:4, background: i < qIdx ? GREEN : i === qIdx ? GOLD : '#E2E8F0', transition:'background 300ms' }} />
          ))}
        </div>

        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'48px 36px', gap:30, maxWidth:1080, margin:'0 auto', width:'100%' }}>
          <div style={{ background:'#fff', border:'2px solid #E2E8F0', borderRadius:26, padding:'46px 40px', textAlign:'center' }}>
            <div style={{ fontSize:30, fontWeight:800, color:NAVY, lineHeight:1.4 }}>{q.q}</div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {q.opts.map((opt, i) => (
              <button key={i} onClick={() => selectAnswer(i)} style={optionStyle(i)}>
                {optionPrefix(i)}{opt}
              </button>
            ))}
          </div>

          {answered && (
            <div style={{ background: selected === q.ok ? '#DCFCE7' : '#FEE2E2', border:`2px solid ${selected === q.ok ? GREEN : RED}`, borderRadius:22, padding:'26px 32px' }}>
              <div style={{ fontSize:22, fontWeight:800, color: selected === q.ok ? '#166534' : '#991B1B', marginBottom:9 }}>
                {selected === q.ok ? '⭐ Correct! Well done!' : '❌ Not quite!'}
              </div>
              <div style={{ fontSize:18, color: selected === q.ok ? '#166534' : '#7F1D1D', lineHeight:1.6 }}>
                {(selected === q.ok ? q.fbCorrect : q.fbIncorrect) ?? q.fb}
              </div>
            </div>
          )}

          {answered && (
            <button onClick={nextQuestion} style={{ padding:'22px', borderRadius:16, border:'none', background:NAVY, color:'#fff', fontSize:20, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
              {isLastQ ? 'See my results! 🎉' : 'Next question →'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Complete mode ─────────────────────────────────────────────────────────────
  const scorePct = lesson.quiz.length > 0 ? Math.round((stars / lesson.quiz.length) * 100) : 0
  const scoreMsg = stars === lesson.quiz.length ? 'Perfect score!' : stars >= Math.ceil(lesson.quiz.length / 2) ? 'Great job!' : 'Keep practising!'

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', flexDirection:'column', fontFamily:'Poppins, sans-serif', background:`linear-gradient(160deg,${NAVY} 0%,#1E40AF 100%)`, overflowY:'auto' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 20px', gap:16, maxWidth:520, margin:'0 auto', width:'100%' }}>

        {/* ── Celebration block (sc5 style) ── */}
        <div style={{ background:'rgba(255,255,255,.08)', borderRadius:20, padding:'24px 20px', textAlign:'center', width:'100%' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
          <div style={{ fontSize:22, fontWeight:800, color:GOLD, marginBottom:8 }}>Amazing work, {firstName}!</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.72)', marginBottom:18, lineHeight:1.6 }}>
            You finished the lesson and earned {stars} {stars === 1 ? 'star' : 'stars'}! {scoreMsg}
          </div>

          {/* cert-unlock notification */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, background:'rgba(250,198,0,.15)', border:`2px solid ${GOLD}`, borderRadius:14, padding:'12px 22px' }}>
            <span style={{ fontSize:28 }}>📜</span>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.5)', marginBottom:2 }}>New certificate unlocked</div>
              <div style={{ fontSize:14, fontWeight:800, color:GOLD }}>{lesson.badgeName || lesson.title} ⭐</div>
            </div>
          </div>
        </div>

        {/* ── Certificate card (sc11 style) ── */}
        <div style={{ width:'100%', borderRadius:16, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>

          {/* Red header bar */}
          <div style={{ background:'#D61F31', padding:'8px 18px', display:'flex', alignItems:'center', gap:8 }}>
            <img src="/Logo_w.png" alt="AWS" style={{ height:26, width:'auto', objectFit:'contain' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>American World School</span>
          </div>

          {/* Certificate body */}
          <div style={{ background:NAVY, padding:'22px', textAlign:'center' }}>

            {/* Seal */}
            <div style={{ width:68, height:68, borderRadius:'50%', background:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 12px', border:'3px solid rgba(255,255,255,.25)' }}>
              📜
            </div>

            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
              Certificate of Achievement
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:GOLD, marginBottom:4 }}>
              {studentName}
            </div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', marginBottom:14, lineHeight:1.5 }}>
              successfully completed <strong style={{ color:GOLD }}>{lesson.title}</strong>{stars === lesson.quiz.length ? ' with a perfect score' : ''}
            </div>

            {/* Stats row */}
            <div style={{ display:'flex', justifyContent:'center', gap:22, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{scorePct}%</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Score</div>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{'⭐'.repeat(Math.min(stars, 5))}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Stars earned</div>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:GOLD }}>{completedDate.split(' ').slice(0, 2).join(' ')}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.4)', marginTop:2 }}>Date</div>
              </div>
            </div>

            <div style={{ fontSize:9, color:'rgba(255,255,255,.25)', marginBottom:14, fontStyle:'italic' }}>
              WASC Accredited · American World School · Grade {grade} · 2025–26
            </div>

            <button
              onClick={() => window.print()}
              style={{ background:GOLD, color:NAVY, border:'none', borderRadius:10, padding:'9px 22px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}
            >
              📥 Download certificate
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display:'flex', gap:12, width:'100%' }}>
          <button onClick={onClose} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:12, border:'none', background:GOLD, color:NAVY, fontSize:14, fontWeight:900, cursor: saving ? 'default' : 'pointer', fontFamily:'inherit' }}>
            {saving ? 'Saving…' : '🏠 Back to home'}
          </button>
        </div>

      </div>
    </div>
  )
}
