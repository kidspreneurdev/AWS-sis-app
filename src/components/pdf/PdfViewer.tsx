import { useEffect, useRef, useState } from 'react'
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
