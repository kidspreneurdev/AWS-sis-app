import { forwardRef } from 'react'
import type { EdmentumCredentialsData } from '@/types/edmentumCredentials'
import { NAVY, INK, SERIF, BORDER, h2, p, noteText } from './docStyles'
import { Page, LogoStrip, DocHeader, InfoStack, Bullets, ContactBlock } from './docPrimitives'

/**
 * Presentational, page-by-page A4 rendering of the "Edmentum Courseware Portal —
 * Login Credentials" document. Shown to admins (preview) and to students /
 * parents (portal); its markup is what `printDocument` serialises to print.
 */
export const EdmentumCredentialsDocument = forwardRef<HTMLDivElement, { data: EdmentumCredentialsData }>(
  function EdmentumCredentialsDocument({ data }, ref) {
    const credRow = (label: string, value: string) => (
      <tr>
        <td style={{ fontSize: 12, fontWeight: 700, color: INK, padding: '8px 12px', border: `1px solid ${BORDER}`, background: '#F5F7FA', width: 150 }}>
          {label}
        </td>
        <td style={{ fontSize: 12, color: INK, padding: '8px 12px', border: `1px solid ${BORDER}` }}>{value}</td>
      </tr>
    )

    return (
      <div
        ref={ref}
        className="cc-document"
        style={{ width: '210mm', margin: '0 auto', color: INK, fontFamily: SERIF }}
      >
        {/* ── Page 1 ───────────────────────────────────────────── */}
        <Page>
          <LogoStrip big />
          <DocHeader title={data.title} subtitle={data.subtitle} />
          <InfoStack rows={[
            { label: 'Student Name:', value: data.studentName },
            { label: 'Student ID:', value: data.studentIdCode },
            { label: 'Grade Level:', value: data.gradeLevel },
          ]} />

          <p style={p}>Dear Parent/Guardian,</p>
          <p style={p}>{data.welcomeParagraph}</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0 8px' }}>
            <thead>
              <tr>
                <th colSpan={2} style={{ background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'left', padding: '9px 12px', border: `1px solid ${NAVY}`, letterSpacing: '0.03em' }}>
                  {data.credentialsHeading}
                </th>
              </tr>
            </thead>
            <tbody>
              {credRow('Portal URL:', data.portalUrl)}
              {credRow('Account Login:', data.accountLogin)}
              {credRow('Username:', data.username)}
              {credRow('Password:', data.password)}
            </tbody>
          </table>
          {data.securityNote && <p style={noteText}>{data.securityNote}</p>}

          <h2 style={h2}>{data.firstTimeHeading}</h2>
          <Bullets ordered items={data.firstTimeSteps} />

          <h2 style={h2}>{data.nextStepsHeading}</h2>
          <Bullets items={data.nextSteps} />

          <h2 style={h2}>{data.troubleHeading}</h2>
          <p style={p}>{data.troubleParagraph}</p>
        </Page>

        {/* ── Page 2 · contact ─────────────────────────────────── */}
        <Page>
          <LogoStrip />
          <ContactBlock
            intro={data.contactsIntro}
            contacts={data.contacts}
            issuedDate={data.issuedDate}
            disclaimer={data.disclaimer}
          />
        </Page>
      </div>
    )
  },
)
