import { forwardRef } from 'react'
import type { StockMarketGameData } from '@/types/stockMarketGame'
import { NAVY, INK, SERIF, BORDER, p } from './docStyles'
import { Page, LogoStrip, DocHeader, InfoStack } from './docPrimitives'

/**
 * Presentational A4 rendering of the "Stock Market Game — Login Details"
 * letter. Shown to admins (preview) and to students / parents (portal); its
 * markup is what `printDocument` serialises to print.
 */
export const StockMarketGameDocument = forwardRef<HTMLDivElement, { data: StockMarketGameData }>(
  function StockMarketGameDocument({ data }, ref) {
    const credRow = (label: string, value: string) => (
      <tr>
        <td style={{ fontSize: 12, fontWeight: 700, color: INK, padding: '8px 12px', border: `1px solid ${BORDER}`, background: '#F5F7FA', width: 150 }}>
          {label}
        </td>
        <td style={{ fontSize: 12, color: INK, padding: '8px 12px', border: `1px solid ${BORDER}`, wordBreak: 'break-all' }}>{value}</td>
      </tr>
    )

    return (
      <div
        ref={ref}
        className="cc-document"
        style={{ width: '210mm', margin: '0 auto', color: INK, fontFamily: SERIF }}
      >
        <Page>
          <LogoStrip big />
          <DocHeader title={data.title} subtitle={data.subtitle} />
          <InfoStack rows={[
            { label: 'Student Name:', value: data.studentName },
            { label: 'Student ID:', value: data.studentIdCode },
            { label: 'Grade Level:', value: data.gradeLevel },
          ]} />

          <p style={p}>Dear {data.firstName || 'Student'},</p>
          <p style={p}>{data.introParagraph}</p>
          <p style={p}>{data.attachingLine}</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 16px' }}>
            <thead>
              <tr>
                <th colSpan={2} style={{ background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'left', padding: '9px 12px', border: `1px solid ${NAVY}`, letterSpacing: '0.03em' }}>
                  {data.credentialsHeading}
                </th>
              </tr>
            </thead>
            <tbody>
              {credRow('Username:', data.username)}
              {credRow('Password:', data.password)}
              {credRow('Link to login:', data.loginUrl)}
            </tbody>
          </table>

          <p style={p}>{data.videosIntro}</p>
          <p style={{ ...p, wordBreak: 'break-all' }}>{data.videosUrl}</p>

          <div style={{ marginTop: 20, whiteSpace: 'pre-line', fontSize: 12.5, color: INK }}>
            {data.signOff}
          </div>
        </Page>
      </div>
    )
  },
)
