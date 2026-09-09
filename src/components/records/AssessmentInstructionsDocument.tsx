import { forwardRef } from 'react'
import type { AssessmentInstructionsData } from '@/types/assessmentInstructions'
import { NAVY, INK, SERIF, BORDER, h2, p } from './docStyles'
import { Page, LogoStrip, DocHeader, PlainList } from './docPrimitives'

/**
 * Presentational, page-by-page A4 rendering of the "Assessment Instructions"
 * document. Shown to admins (preview) and to students / parents (portal); its
 * markup is what `printDocument` serialises to print.
 */
export const AssessmentInstructionsDocument = forwardRef<HTMLDivElement, { data: AssessmentInstructionsData }>(
  function AssessmentInstructionsDocument({ data }, ref) {
    const cellH: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: INK, textAlign: 'center', padding: '8px 12px', border: `1px solid ${BORDER}` }
    const cellV: React.CSSProperties = { fontSize: 12, color: INK, textAlign: 'center', padding: '8px 12px', border: `1px solid ${BORDER}` }

    return (
      <div
        ref={ref}
        className="cc-document"
        style={{ width: '210mm', margin: '0 auto', color: INK, fontFamily: SERIF }}
      >
        {/* ── Page 1 ───────────────────────────────────────────── */}
        <Page>
          <LogoStrip big accreditation />
          {data.title && <DocHeader title={data.title} subtitle={data.subtitle} />}

          <p style={{ ...p, fontWeight: 700 }}>Dear {data.firstName || 'Student'},</p>
          {data.greetingLine && <p style={{ ...p, fontWeight: 700 }}>{data.greetingLine}</p>}
          <p style={p}>{data.introParagraph}</p>

          <h2 style={h2}>{data.procedureHeading}</h2>
          <PlainList ordered items={data.procedureSteps} />
        </Page>

        {/* ── Page 2 ───────────────────────────────────────────── */}
        <Page>
          <LogoStrip accreditation />

          <h2 style={{ ...h2, marginTop: 4 }}>{data.categoriesHeading}</h2>
          {data.categories.map((c, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{c.title}</div>
              <p style={{ ...p, margin: '2px 0 0' }}>{c.body}</p>
            </div>
          ))}

          {data.browserWarning && <p style={{ ...p, fontWeight: 700 }}>{data.browserWarning}</p>}

          <table style={{ borderCollapse: 'collapse', margin: '16px 0', width: '80%' }}>
            <thead>
              <tr>
                <th style={cellH}>User ID</th>
                <th style={cellH}>Password</th>
                <th style={cellH}>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cellV}>{data.loginId}</td>
                <td style={cellV}>{data.password}</td>
                <td style={cellV}>{data.status}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={h2}>{data.noteHeading}</h2>
          <p style={p}>{data.noteParagraph}</p>
          {data.helpLine && <p style={{ ...p, fontWeight: 700 }}>{data.helpLine}</p>}

          <div style={{ marginTop: 20, whiteSpace: 'pre-line', fontSize: 12.5, color: INK }}>
            {data.signOff}
          </div>
        </Page>
      </div>
    )
  },
)
