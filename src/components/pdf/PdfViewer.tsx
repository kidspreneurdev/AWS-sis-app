import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string

const GOLD = '#FAC600'
const NAVY = '#1A365E'

// ─── Single-page viewer ───────────────────────────────────────────────────────
// Used by the K5 lesson player: renders one page at a time, fit-to-width, with
// the parent driving page navigation and sizing.
export function PdfSinglePage({
  url, page, width, onLoad, onPageLoad,
}: {
  url: string
  page: number
  width: number
  onLoad: (numPages: number) => void
  onPageLoad: (aspect: number) => void
}) {
  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => onLoad(numPages)}
      loading={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,.2)', borderTopColor: GOLD, animation: 'spin 0.7s linear infinite' }} />
        </div>
      }
      error={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,.6)', fontSize: 14 }}>
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

// ─── Scrolling multi-page viewer ──────────────────────────────────────────────
// Used by the Student Records viewers: renders every page stacked vertically in
// a scroll container, sized responsively to the container width.
export function PdfScrollViewer({ url, maxWidth = 900 }: { url: string; maxWidth?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [numPages, setNumPages] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(Math.min(w - 24, maxWidth))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 12, background: '#F1F5F9' }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        loading={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(26,54,94,.15)', borderTopColor: NAVY, animation: 'spin 0.7s linear infinite' }} />
          </div>
        }
        error={
          <div style={{ padding: 32, color: '#7A92B0', fontSize: 14 }}>
            ⚠️ Could not load this document.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} style={{ boxShadow: '0 1px 6px rgba(15,34,64,0.18)', marginBottom: 12, background: '#fff' }}>
            <Page
              pageNumber={i + 1}
              width={width || undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  )
}

// ─── Paged (one-page-at-a-time) viewer ────────────────────────────────────────
// Renders a single page with Prev / Next navigation, a page counter and zoom.
// Used by the Academic Calendar viewers (admin + student/parent portals).
export function PdfPagedViewer({ url, maxWidth = 1000 }: { url: string; maxWidth?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(Math.min(w - 32, maxWidth))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxWidth])

  const go = useCallback((delta: number) => {
    setPageNumber(p => Math.min(Math.max(1, p + delta), Math.max(1, numPages)))
  }, [numPages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const navBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 7, border: '1px solid #E4EAF2',
    background: disabled ? '#F1F5F9' : '#fff', color: disabled ? '#B6C4D6' : '#1A365E',
    fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '8px 12px', background: '#fff', borderBottom: '1px solid #E4EAF2', flexShrink: 0, flexWrap: 'wrap' }}>
        <button disabled={pageNumber <= 1} onClick={() => go(-1)} style={navBtn(pageNumber <= 1)}>‹ Prev</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', minWidth: 96, textAlign: 'center' }}>
          Page {pageNumber} / {numPages || '–'}
        </span>
        <button disabled={numPages > 0 && pageNumber >= numPages} onClick={() => go(1)} style={navBtn(numPages > 0 && pageNumber >= numPages)}>Next ›</button>
        <div style={{ width: 1, height: 20, background: '#E4EAF2', margin: '0 2px' }} />
        <button disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} style={navBtn(zoom <= 0.5)}>−</button>
        <span style={{ fontSize: 11, color: '#7A92B0', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button disabled={zoom >= 2.5} onClick={() => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))} style={navBtn(zoom >= 2.5)}>+</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 16 }}>
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNumber(1) }}
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(26,54,94,.15)', borderTopColor: NAVY, animation: 'spin 0.7s linear infinite' }} />
            </div>
          }
          error={
            <div style={{ padding: 32, color: '#7A92B0', fontSize: 14 }}>
              ⚠️ Could not load this document.
            </div>
          }
        >
          <div style={{ boxShadow: '0 2px 12px rgba(15,34,64,0.22)', background: '#fff' }}>
            <Page
              pageNumber={pageNumber}
              width={width ? width * zoom : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        </Document>
      </div>
    </div>
  )
}
