import { forwardRef } from 'react'
import type { WeeklyScheduleData } from '@/types/weeklySchedule'
import { RED, INK, SERIF, h2, p, noteText, th, td } from './docStyles'
import { Page, LogoStrip, DocHeader, InfoBox, Bullets, SignatureRow, ContactBlock } from './docPrimitives'

/**
 * Presentational, page-by-page A4 rendering of the "Weekly Class Schedule &
 * Credit Hour Breakdown" document. Shown to admins (preview) and to students /
 * parents (portal); its markup is what `printDocument` serialises to print.
 */
export const WeeklyScheduleDocument = forwardRef<HTMLDivElement, { data: WeeklyScheduleData }>(
  function WeeklyScheduleDocument({ data }, ref) {
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
          <InfoBox
            studentName={data.studentName}
            studentIdCode={data.studentIdCode}
            gradeLevel={data.gradeLevel}
            academicYear={data.academicYear}
          />

          <p style={p}>Dear Parent/Guardian,</p>
          <p style={p}>{data.introParagraph}</p>

          <h2 style={h2}>{data.creditHoursHeading}</h2>
          <p style={p}>{data.creditHoursIntro}</p>
          <Bullets items={data.creditParts} />
          <p style={p}>{data.creditFillIntro}</p>
          <Bullets items={data.creditTiers} />
          {data.termLengthNote && <p style={noteText}>{data.termLengthNote}</p>}

          <h2 style={h2}>{data.scheduleHeading}</h2>
          {data.scheduleParagraphs.map((para, i) => <p key={i} style={p}>{para}</p>)}

          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0 14px' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 88 }}>Day</th>
                <th style={{ ...th, width: 120 }}>Time</th>
                <th style={th}>Subject</th>
                <th style={{ ...th, width: 130 }}>Teacher</th>
                <th style={{ ...th, width: 90 }}>Active Term</th>
              </tr>
            </thead>
            <tbody>
              {data.scheduleRows.map((r, i) => {
                const cell: React.CSSProperties = r.highlight
                  ? { ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }
                  : { ...td, background: i % 2 ? '#F5F7FA' : '#fff' }
                return (
                  <tr key={i}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.day}</td>
                    <td style={cell}>{r.time}</td>
                    <td style={cell}>{r.subject}</td>
                    <td style={cell}>{r.teacher}</td>
                    <td style={cell}>{r.activeTerm}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Page>

        {/* ── Page 2 · summaries + credit hours ─────────────────── */}
        <Page>
          <LogoStrip />
          {data.daySummaries.length > 0 && <Bullets items={data.daySummaries} />}
          {data.chemistryNote && <p style={noteText}>{data.chemistryNote}</p>}
          {data.extraNotes.length > 0 && <Bullets items={data.extraNotes} />}

          <h2 style={h2}>{data.creditTableHeading}</h2>
          <p style={p}>{data.creditTableIntro}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <thead>
              <tr>
                <th style={th}>Subject</th>
                <th style={{ ...th, width: 70 }}>Term</th>
                <th style={{ ...th, width: 62 }}>Live Sessions</th>
                <th style={{ ...th, width: 54 }}>Live Hours</th>
                <th style={{ ...th, width: 66 }}>Self-Paced Hours</th>
                <th style={{ ...th, width: 58 }}>Total Hours</th>
                <th style={{ ...th, width: 58 }}>Credit Earned</th>
              </tr>
            </thead>
            <tbody>
              {data.creditRows.map((r, i) => {
                const cell: React.CSSProperties = r.highlight
                  ? { ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }
                  : { ...td, background: i % 2 ? '#F5F7FA' : '#fff' }
                return (
                  <tr key={i}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.subject}</td>
                    <td style={cell}>{r.term}</td>
                    <td style={cell}>{r.liveSessions}</td>
                    <td style={cell}>{r.liveHours}</td>
                    <td style={cell}>{r.selfPacedHours}</td>
                    <td style={cell}>{r.totalHours}</td>
                    <td style={cell}>{r.creditEarned}</td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={6} style={{ ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }}>
                  Total Credits This Year
                </td>
                <td style={{ ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }}>
                  {data.totalCredits}
                </td>
              </tr>
            </tbody>
          </table>
          {data.creditTableCaption && <p style={noteText}>{data.creditTableCaption}</p>}

          <h2 style={h2}>Family Confirmation</h2>
          <p style={p}>{data.familyConfirmationText}</p>
          <SignatureRow />
        </Page>

        {/* ── Page 3 · contact ─────────────────────────────────── */}
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
