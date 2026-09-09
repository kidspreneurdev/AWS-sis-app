// Shared style tokens for the SIS-generated record documents.

export const NAVY = '#1A365E'
export const RED = '#D61F31'
export const BORDER = '#C9D3E0'
export const INK = '#1F2A37'
export const SERIF = 'Georgia, "Times New Roman", serif'

export const h2: React.CSSProperties = {
  color: NAVY, fontSize: 15, fontWeight: 700, margin: '22px 0 8px', fontFamily: SERIF,
}
export const p: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.65, color: INK, margin: '0 0 10px' }
export const noteText: React.CSSProperties = { ...p, fontStyle: 'italic', color: '#4B5563', fontSize: 11.5 }
export const th: React.CSSProperties = {
  background: NAVY, color: '#fff', fontSize: 11.5, fontWeight: 700, textAlign: 'left',
  padding: '8px 10px', border: `1px solid ${NAVY}`,
}
export const td: React.CSSProperties = { fontSize: 12, color: INK, padding: '7px 10px', border: `1px solid ${BORDER}` }
