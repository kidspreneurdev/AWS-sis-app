import type { CSSProperties } from 'react'
import { toRichHtml } from '@/lib/richText'

// Renders a value saved by RichTextarea (or legacy plain text) with its formatting.
export function RichText({ value, style, className, inline }: { value: string | null | undefined; style?: CSSProperties; className?: string; inline?: boolean }) {
  if (!value) return null
  const Tag = inline ? 'span' : 'div'
  return <Tag className={`rt-content${className ? ` ${className}` : ''}`} style={style} dangerouslySetInnerHTML={{ __html: toRichHtml(value) }} />
}
