import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const NAVY = '#1A365E'
const RED  = '#D61F31'
const GOLD = '#FAC600'

export const CERT_WIDTH  = 1500
export const CERT_HEIGHT = 1060

export interface K5CertificateProps {
  studentName: string
  subject:     string
  lessonTitle: string
  scorePct:    number
  starsEarned: number
  date:        string
  badgeName?:  string
}

function Star({ size = 16, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27l-6.18 3.23L7 13.63l-5-4.87 6.91-1L12 1.5z" />
    </svg>
  )
}

function StarOutline({ size = 34, color = RED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.4}>
      <path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27l-6.18 3.23L7 13.63l-5-4.87 6.91-1L12 1.5z" />
    </svg>
  )
}

function IconCircle({ children }: { children: ReactNode }) {
  return (
    <div style={{ width:56, height:56, borderRadius:'50%', background:NAVY, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {children}
    </div>
  )
}

function ScoreIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <path d="M3 21h18" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      <rect x="5" y="14" width="3" height="6" fill="#fff" />
      <rect x="10.5" y="10" width="3" height="10" fill="#fff" />
      <rect x="16" y="5" width="3" height="15" fill="#fff" />
      <path d="M4 10l5-5 4 3 6-6" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2h5v5" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="16" rx="2.2" stroke="#fff" strokeWidth={1.8} />
      <path d="M3.5 9.5h17" stroke="#fff" strokeWidth={1.8} />
      <path d="M8 3v4M16 3v4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="8.2" cy="14" r="1.2" fill="#fff" />
      <circle cx="12" cy="14" r="1.2" fill="#fff" />
      <circle cx="15.8" cy="14" r="1.2" fill="#fff" />
    </svg>
  )
}

function ScrollIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h11a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H8" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M6 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2 2 2 0 0 0 2-2V5.5a2 2 0 0 0-2-2Z" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M18 20.5a2 2 0 0 0 2-2" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M9.5 7.5h6M9.5 11h6M9.5 14.5h3.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function Ticks({ flip = false }: { flip?: boolean }) {
  return (
    <svg width={26} height={44} viewBox="0 0 26 44" fill="none" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d="M2 10 L20 2" stroke={RED} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M0 24 L18 16" stroke={RED} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M2 38 L20 30" stroke={RED} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  )
}

function DottedGrid({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, justifyItems: align === 'left' ? 'start' : 'end' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:NAVY }} />
      ))}
    </div>
  )
}

export const K5Certificate = forwardRef<HTMLDivElement, K5CertificateProps>(function K5Certificate(
  { studentName, subject, lessonTitle, scorePct, starsEarned, date, badgeName },
  ref,
) {
  const stars = Math.max(0, Math.min(5, Math.round(starsEarned)))

  return (
    <div
      ref={ref}
      style={{
        width: CERT_WIDTH, height: CERT_HEIGHT, position:'relative', overflow:'hidden',
        background:'#fff', fontFamily:'Poppins, sans-serif', flexShrink:0,
      }}
    >
      {/* ── Corner decorations ── */}
      <div style={{ position:'absolute', top:-320, left:-260, width:500, height:500, borderRadius:'50%', background:RED, zIndex:0 }} />
      <div style={{ position:'absolute', top:-290, left:-230, width:500, height:500, borderRadius:'50%', border:`6px dashed ${NAVY}55`, zIndex:1 }} />
      <div style={{ position:'absolute', top:100, left:155, zIndex:2 }}><Star size={100} color={NAVY} /></div>

      <div style={{ position:'absolute', top:-240, right:-180, width:400, height:400, borderRadius:'50%', background:NAVY, zIndex:0 }} />
      <div style={{ position:'absolute', top:130, right:150, borderRadius:100, zIndex:2 }}><StarOutline size={58} color={RED} /></div>

      <div style={{ position:'absolute', bottom:0, left:0, width:0, height:0, borderStyle:'solid', borderWidth:'0 0 300px 300px', borderColor:`transparent transparent ${GOLD} transparent`, transform: 'rotate(90deg)' , zIndex:0 }} />
      <div style={{ position:'absolute', bottom:0, left:0, width:0, height:0, borderStyle:'solid', borderWidth:'0 0 150px 150px', borderColor:`transparent transparent ${NAVY} transparent`, transform: 'rotate(90deg)', zIndex:1 }} />
      <div style={{ position:'absolute', bottom:150, left:44, zIndex:2 }}><DottedGrid align="left" /></div>

      <div style={{ position:'absolute', bottom:0, right:0, width:0, height:0, borderStyle:'solid', borderWidth:'380px 0 0 380px', borderColor:`transparent transparent transparent ${RED}`, transform: 'rotate(270deg)', zIndex:0 }} />
      <div style={{ position:'absolute', bottom:0, right:0, width:0, height:0, borderStyle:'solid', borderWidth:'250px 0 0 250px', borderColor:`transparent transparent transparent ${NAVY}`, transform: 'rotate(270deg)', zIndex:1 }} />
      <div style={{ position:'absolute', bottom:200, right:80, zIndex:2 }}><DottedGrid align="right" /></div>

      {/* ── Main content ── */}
      <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', boxSizing:'border-box', padding:'44px 190px 0' }}>

        <img src="/Logo_b.png" alt="American World School" style={{ height:125, width:'auto', objectFit:'contain', marginBottom:6 }} />

        <div style={{ display:'flex', alignItems:'center', gap:22, marginTop:40 }}>
          <Ticks />
          <div style={{ fontFamily:'"Baloo 2", sans-serif', fontWeight:800, fontSize:160, color:NAVY, letterSpacing:1, lineHeight:1 }}>
            CERTIFICATE
          </div>
          <Ticks flip />
        </div>

        <div style={{ position:'relative', marginTop:2 }}>
          <div style={{ position:'absolute', left:-18, top:0, bottom:0, width:18, background:GOLD, clipPath:'polygon(0 0, 100% 0, 100% 100%, 0 100%, 50% 50%)' }} />
          <div style={{
            fontFamily:'"Baloo 2", sans-serif', fontWeight:700, fontSize:27, color:'#fff', background:RED,
            padding:'9px 46px', letterSpacing:4,
          }}>
            OF ACHIEVEMENT
          </div>
          <div style={{ position:'absolute', right:-18, top:0, bottom:0, width:18, background:GOLD, clipPath:'polygon(0 0, 100% 0, 100% 100%, 0 100%, 50% 50%)', transform: 'rotate(180deg)' }} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:26, fontSize:20, fontWeight:600, color:NAVY }}>
          <Star size={17} /> Proudly presented to <Star size={17} />
        </div>

        <div style={{ fontFamily:'"Baloo 2", sans-serif', fontWeight:800, fontSize:100, color:RED, marginTop:6, textAlign:'center', maxWidth:1000, lineHeight:1.05 }}>
          {studentName}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:0, width:890, marginTop:4 }}>
          <div style={{ width:9, height:9, borderRadius:'50%', background:NAVY, flexShrink:0 }} />
          <div style={{ flex:1, height:2, background:NAVY }} />
          <div style={{ width:9, height:9, borderRadius:'50%', background:NAVY, flexShrink:0 }} />
        </div>

        <div style={{ marginTop:14, fontSize:20, color:NAVY }}>for successfully completing</div>
        <div style={{ marginTop:4, fontSize:29, fontWeight:800, color:NAVY, textAlign:'center' }}>
          <span style={{ color:RED }}>{subject}</span> {lessonTitle}
        </div>

        {/* ── Stats row ── */}
        {/* <div style={{ display:'flex', alignItems:'center', gap:44, marginTop:38 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <IconCircle><ScoreIcon /></IconCircle>
            <div style={{ fontSize:26, fontWeight:800, color:RED }}>{scorePct}%</div>
            <div style={{ fontSize:15, color:NAVY, fontWeight:600 }}>Score</div>
          </div>

          <div style={{ width:2, height:96, background:'transparent', borderLeft:`2px dashed ${NAVY}44` }} />

          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <IconCircle><Star size={24} color="#fff" /></IconCircle>
            <div style={{ display:'flex', gap:4 }}>
              {Array.from({ length: stars }).map((_, i) => <Star key={i} size={22} />)}
            </div>
            <div style={{ fontSize:15, color:NAVY, fontWeight:600 }}>{stars} Stars Earned</div>
          </div>

          <div style={{ width:2, height:96, background:'transparent', borderLeft:`2px dashed ${NAVY}44` }} />

          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <IconCircle><CalendarIcon /></IconCircle>
            <div style={{ fontSize:26, fontWeight:800, color:RED }}>{date}</div>
            <div style={{ fontSize:15, color:NAVY, fontWeight:600 }}>Date</div>
          </div>
        </div> */}
        <div
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    width: 600,
  }}
>
  {/* Score */}
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    <IconCircle>
      <ScoreIcon />
    </IconCircle>

    <div style={{ fontSize: 26, fontWeight: 800, color: RED }}>
      {scorePct}%
    </div>

    <div style={{ fontSize: 15, color: NAVY, fontWeight: 600 , marginTop: -10}}>
      Score
    </div>
  </div>

  {/* Divider */}
  <div
    style={{
      width: 2,
      height: 96,
      borderLeft: `2px dashed ${NAVY}44`,
      flexShrink: 0,
    }}
  />

  {/* Stars */}
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    <IconCircle>
      <Star size={24} color="#fff" />
    </IconCircle>

    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        minHeight: 22,
      }}
    >
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} size={40} />
      ))}
    </div>

    <div style={{ fontSize: 15, color: NAVY, fontWeight: 600 }}>
      {stars} Stars Earned
    </div>
  </div>

  {/* Divider */}
  <div
    style={{
      width: 2,
      height: 96,
      borderLeft: `2px dashed ${NAVY}44`,
      flexShrink: 0,
    }}
  />

  {/* Date */}
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    <IconCircle>
      <CalendarIcon />
    </IconCircle>

    <div style={{ fontSize: 26, fontWeight: 800, color: RED }}>
      {date}
    </div>

    <div style={{ fontSize: 15, color: NAVY, fontWeight: 600, marginTop: -10 }}>
      Date
    </div>
  </div>
</div>

        {/* ── Badge earned ── */}
        {badgeName && (
          <div style={{ position:'relative', marginTop:34, border:`2.5px solid ${GOLD}`, borderRadius:16, padding:'22px 56px 18px' }}>
            <div style={{
              position:'absolute', top:-18, left:'50%', transform:'translateX(-50%)', background:NAVY, color:'#fff',
              fontSize:13, fontWeight:800, letterSpacing:2, padding:'6px 20px', borderRadius:20, whiteSpace:'nowrap',
            }}>
              BADGE EARNED
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <IconCircle><ScrollIcon /></IconCircle>
              <div style={{ fontSize:30, fontWeight:800, color:NAVY }}>{badgeName}</div>
              <Star size={22} />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:10 }}>
        <div style={{ height:3, background:RED }} />
        <div style={{ background:NAVY, padding:'14px 0', textAlign:'center', fontSize:15, fontWeight:700, color:'#fff', letterSpacing:3 }}>
          LEARN &nbsp;•&nbsp; UNLEARN &nbsp;•&nbsp; RELEARN
        </div>
      </div>
    </div>
  )
})

export const K5CertificateFrame = forwardRef<HTMLDivElement, K5CertificateProps>(function K5CertificateFrame(
  props,
  captureRef,
) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    function update() {
      if (!outerRef.current) return
      setScale(outerRef.current.offsetWidth / CERT_WIDTH)
    }
    update()
    const ro = new ResizeObserver(update)
    if (outerRef.current) ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <div ref={outerRef} style={{ width:'100%', height: CERT_HEIGHT * scale, overflow:'hidden', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.25)' }}>
        <div style={{ width:CERT_WIDTH, height:CERT_HEIGHT, transform:`scale(${scale})`, transformOrigin:'top left' }}>
          <K5Certificate {...props} />
        </div>
      </div>

      {/* Hidden true-size copy — html2canvas mis-measures elements inside a scaled ancestor, so capture happens off-screen at 1:1 instead. */}
      <div style={{ position:'fixed', top:0, left:-99999, zIndex:-1, pointerEvents:'none' }} aria-hidden="true">
        <K5Certificate ref={captureRef} {...props} />
      </div>
    </>
  )
})
