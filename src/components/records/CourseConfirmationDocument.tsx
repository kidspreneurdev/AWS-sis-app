import { forwardRef } from 'react'
import type { CourseConfirmationData } from '@/types/courseConfirmation'
import { RED, INK, SERIF, h2, p, noteText, th, td } from './docStyles'
import { Page, LogoStrip, DocHeader, InfoBox, Bullets, SignatureRow, ContactBlock } from './docPrimitives'

/**
 * Presentational, page-by-page A4 rendering of the Course Confirmation document.
 * Shown to admins (preview) and to students / parents (portal); its markup is
 * what `printDocument` serialises into the print window.
 */
export const CourseConfirmationDocument = forwardRef<HTMLDivElement, { data: CourseConfirmationData }>(
  function CourseConfirmationDocument({ data }, ref) {
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

          <h2 style={h2}>Steps Completed</h2>
          <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
            {data.steps.map((s, i) => (
              <li key={i} style={{ ...p, margin: '0 0 5px' }}>
                <strong>{s.label}:</strong> {s.detail}
              </li>
            ))}
          </ul>
          {data.stepsFootnote && <p style={noteText}>{data.stepsFootnote}</p>}

          <h2 style={h2}>Confirmed Courses for {data.academicYear || 'the Year'}</h2>
          <p style={p}>{data.coursesIntro}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={th}>Course</th>
                <th style={th}>Subject Area</th>
                <th style={{ ...th, width: 90 }}>Credit Value</th>
                <th style={{ ...th, width: 150 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c, i) => (
                <tr key={i} style={{ background: i % 2 ? '#F5F7FA' : '#fff' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{c.course}</td>
                  <td style={td}>{c.subjectArea}</td>
                  <td style={td}>{c.creditValue}</td>
                  <td style={td}>{c.duration}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }}>
                  Total Credits This Year
                </td>
                <td style={{ ...td, background: RED, border: `1px solid ${RED}` }} />
                <td style={{ ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }}>
                  {data.totalCredits}
                </td>
                <td style={{ ...td, background: RED, border: `1px solid ${RED}` }} />
              </tr>
            </tbody>
          </table>

          <h2 style={h2}>{data.gradProgressHeading}</h2>
          {data.gradProgressParagraph && <p style={p}>{data.gradProgressParagraph}</p>}
          {data.auditIntro && <p style={p}>{data.auditIntro}</p>}
          {data.auditRows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '6px 0 14px' }}>
              <thead>
                <tr>
                  <th style={th}>Subject Area</th>
                  <th style={{ ...th, width: 80 }}>Required</th>
                  <th style={{ ...th, width: 96 }}>Earned Prior</th>
                  <th style={{ ...th, width: 110 }}>Added This Year</th>
                  <th style={{ ...th, width: 130 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.auditRows.map((r, i) => {
                  const cell: React.CSSProperties = r.highlight
                    ? { ...td, background: RED, color: '#fff', fontWeight: 700, border: `1px solid ${RED}` }
                    : { ...td, background: i % 2 ? '#F5F7FA' : '#fff' }
                  return (
                    <tr key={i}>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.subjectArea}</td>
                      <td style={cell}>{r.required}</td>
                      <td style={cell}>{r.earnedPrior}</td>
                      <td style={cell}>{r.addedThisYear}</td>
                      <td style={cell}>{r.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Page>

        {/* ── Page 2 ───────────────────────────────────────────── */}
        <Page>
          <LogoStrip />
          {data.schedulingNotes.length > 0 && <Bullets items={data.schedulingNotes} />}

          <h2 style={{ ...h2, marginTop: 4 }}>Next Steps</h2>
          <Bullets items={data.nextSteps} />

          <h2 style={h2}>Family Confirmation</h2>
          <p style={p}>{data.familyConfirmationText}</p>
          <SignatureRow />
        </Page>

        {/* ── Page 3 ───────────────────────────────────────────── */}
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
