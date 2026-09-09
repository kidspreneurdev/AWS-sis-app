// Shared building blocks for the SIS-generated record documents (Course
// Confirmation, Weekly Schedule). Each document is a stack of A4 <Page> cards;
// printDocument collapses the min-height and forces page breaks between them.
// Style tokens live in ./docStyles.

import { NAVY, BORDER, INK, h2, p } from './docStyles'

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="cc-page"
      style={{
        width: '210mm', minHeight: '297mm', boxSizing: 'border-box', padding: '16mm',
        background: '#fff', margin: '0 auto 20px', boxShadow: '0 2px 14px rgba(15,34,64,0.18)',
      }}
    >
      {children}
    </div>
  )
}

export function LogoStrip({ big, accreditation }: { big?: boolean; accreditation?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: big ? 18 : 14 }}>
      <img src="/Logo_b.png" alt="American World School" style={{ height: big ? 52 : 40, width: 'auto' }} />
      {accreditation && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/AIAASC.png" alt="AIAASC" style={{ height: big ? 34 : 28, width: 'auto' }} />
          <img src="/WASC.png" alt="WASC" style={{ height: big ? 34 : 28, width: 'auto' }} />
          <img src="/NCPSA.png" alt="NCPSA" style={{ height: big ? 34 : 28, width: 'auto' }} />
        </div>
      )}
    </div>
  )
}

export function DocHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>{title}</h1>
      <div style={{ fontStyle: 'italic', color: '#4B5563', fontSize: 13, marginBottom: 16 }}>{subtitle}</div>
    </>
  )
}

export function InfoBox({ studentName, studentIdCode, gradeLevel, academicYear }: {
  studentName: string; studentIdCode: string; gradeLevel: string; academicYear: string
}) {
  const cell = (label: string, value: string) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ color: NAVY, fontWeight: 700, fontSize: 11.5, minWidth: 96 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: INK, borderBottom: `1px solid ${BORDER}`, flex: 1, paddingBottom: 2 }}>{value || ' '}</span>
    </div>
  )
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 28px',
      border: `1px solid ${BORDER}`, borderRadius: 4, padding: '12px 14px', marginBottom: 16,
    }}>
      {cell('Student Name:', studentName)}
      {cell('Student ID:', studentIdCode)}
      {cell('Grade Level:', gradeLevel)}
      {cell('Academic Year:', academicYear)}
    </div>
  )
}

// Single-column info box (full-width underlined rows), for documents with a
// short student-detail block.
export function InfoStack({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0' }}>
          <span style={{ color: NAVY, fontWeight: 700, fontSize: 11.5, minWidth: 110 }}>{r.label}</span>
          <span style={{ fontSize: 12.5, color: INK, borderBottom: `1px solid ${BORDER}`, flex: 1, paddingBottom: 2 }}>{r.value || ' '}</span>
        </div>
      ))}
    </div>
  )
}

export function Bullets({ items, ordered }: { items: { title: string; body: string }[]; ordered?: boolean }) {
  const inner = items.map((n, i) => (
    <li key={i} style={{ ...p, margin: '0 0 5px' }}>
      <strong>{n.title}:</strong> {n.body}
    </li>
  ))
  return ordered
    ? <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>{inner}</ol>
    : <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>{inner}</ul>
}

// Plain numbered / bulleted list of strings (no bold lead-in).
export function PlainList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const inner = items.map((t, i) => <li key={i} style={{ ...p, margin: '0 0 6px' }}>{t}</li>)
  return ordered
    ? <ol style={{ margin: '0 0 8px', paddingLeft: 22 }}>{inner}</ol>
    : <ul style={{ margin: '0 0 8px', paddingLeft: 22 }}>{inner}</ul>
}

export function SignatureRow() {
  return (
    <div style={{ display: 'flex', gap: 40, marginTop: 26 }}>
      <div style={{ flex: 1 }}>
        <div style={{ borderBottom: `1px solid ${INK}`, height: 28 }} />
        <div style={{ fontSize: 11, color: NAVY, fontWeight: 700, marginTop: 4 }}>Parent/Guardian Signature</div>
      </div>
      <div style={{ width: 180 }}>
        <div style={{ borderBottom: `1px solid ${INK}`, height: 28 }} />
        <div style={{ fontSize: 11, color: NAVY, fontWeight: 700, marginTop: 4 }}>Date</div>
      </div>
    </div>
  )
}

export function ContactBlock({ intro, contacts, issuedDate, disclaimer }: {
  intro: string
  contacts: { name: string; role: string; email: string }[]
  issuedDate: string
  disclaimer: string
}) {
  return (
    <>
      <h2 style={{ ...h2, marginTop: 4 }}>CONTACT INFORMATION</h2>
      <p style={p}>{intro}</p>
      {contacts.map((c, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{c.name}</div>
          <div style={{ fontSize: 12, color: INK }}>{c.role}{c.email ? ` — ${c.email}` : ''}</div>
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11.5, fontStyle: 'italic', color: '#4B5563' }}>
        <div>Document Issued: {issuedDate}</div>
        <div>{disclaimer}</div>
      </div>
    </>
  )
}
