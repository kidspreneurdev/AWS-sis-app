import DOMPurify from 'dompurify'

// Rich text is stored as a small, sanitized HTML subset. Older rows hold plain
// text, so every helper here accepts either and treats non-HTML as plain text.

const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li']
const ALLOWED_STYLE = /^\s*text-align\s*:\s*(left|center|right|justify)\s*;?\s*$/i
const HTML_TAG = /<\/?(b|strong|i|em|u|s|br|p|div|span|ul|ol|li)\b[^>]*>/i

let hooked = false
function purifier() {
  if (!hooked) {
    // Keep only text-align in style attributes; drop everything else.
    DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
      if (data.attrName === 'style') {
        const align = data.attrValue.split(';').map(s => s.trim()).find(s => ALLOWED_STYLE.test(s))
        if (align) data.attrValue = align
        else data.keepAttr = false
      }
    })
    hooked = true
  }
  return DOMPurify
}

export function isRichHtml(value: string | null | undefined): boolean {
  return !!value && HTML_TAG.test(value)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function sanitizeRichHtml(html: string): string {
  return purifier().sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['style'] }) as string
}

/** Any stored value (rich or legacy plain text) → safe HTML. */
export function toRichHtml(value: string | null | undefined): string {
  if (!value) return ''
  return isRichHtml(value) ? sanitizeRichHtml(value) : escapeHtml(value).replace(/\r?\n/g, '<br>')
}

/** Any stored value → plain text, keeping line breaks. For previews, exports, prompts, emails. */
export function toPlainText(value: string | null | undefined): string {
  if (!value) return ''
  if (!isRichHtml(value)) return value
  const html = sanitizeRichHtml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li)>/gi, '\n')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\n{2,}/g, '\n').trim()
}
