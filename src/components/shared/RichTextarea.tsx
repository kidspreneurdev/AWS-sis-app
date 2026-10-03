import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { sanitizeRichHtml, toRichHtml } from '@/lib/richText'

// Drop-in replacement for <textarea>: same value/onChange(e.target.value) shape,
// but the value is sanitized HTML with bold/italic/underline/alignment/lists.

interface Props {
  value?: string
  onChange?: (e: { target: { value: string } }) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  style?: CSSProperties
  className?: string
  onPaste?: () => void
  required?: boolean
}

// Style keys that belong to the outer frame; everything else styles the editable area.
const FRAME_KEYS = new Set<keyof CSSProperties>([
  'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderColor', 'borderWidth', 'borderStyle',
  'borderRadius', 'background', 'backgroundColor', 'width', 'maxWidth', 'minWidth', 'boxSizing',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'gridColumn', 'gridRow', 'alignSelf', 'boxShadow', 'outline',
])

type Cmd = 'bold' | 'italic' | 'underline' | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'insertUnorderedList' | 'insertOrderedList'

const TOOLS: ({ cmd: Cmd; icon: typeof Bold; label: string } | 'sep')[] = [
  { cmd: 'bold', icon: Bold, label: 'Bold (⌘B)' },
  { cmd: 'italic', icon: Italic, label: 'Italic (⌘I)' },
  { cmd: 'underline', icon: Underline, label: 'Underline (⌘U)' },
  'sep',
  { cmd: 'justifyLeft', icon: AlignLeft, label: 'Align left' },
  { cmd: 'justifyCenter', icon: AlignCenter, label: 'Align center' },
  { cmd: 'justifyRight', icon: AlignRight, label: 'Align right' },
  'sep',
  { cmd: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
  { cmd: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
]

/** Editor HTML → stored value. An editor that only holds empty blocks is "". */
function normalize(html: string): string {
  const clean = sanitizeRichHtml(html)
  const text = clean.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  if (!text && !/<li\b/i.test(clean)) return ''
  return clean
}

/** Which formatting commands apply at the caret, or null when the caret is outside `el`. */
function readActive(el: HTMLElement | null): Partial<Record<Cmd, boolean>> | null {
  const sel = document.getSelection()
  if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return null
  const next: Partial<Record<Cmd, boolean>> = {}
  for (const t of TOOLS) if (t !== 'sep') next[t.cmd] = document.queryCommandState(t.cmd)
  return next
}

export function RichTextarea({ value = '', onChange, placeholder, rows = 3, disabled, readOnly, autoFocus, style = {}, className, onPaste }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string | null>(null)
  const [active, setActive] = useState<Partial<Record<Cmd, boolean>>>({})
  const [focused, setFocused] = useState(false)
  const editable = !disabled && !readOnly

  const frame: CSSProperties = {}
  const inner: CSSProperties = {}
  for (const [k, v] of Object.entries(style)) {
    if (k === 'resize' || k === 'height') continue
    ;(FRAME_KEYS.has(k as keyof CSSProperties) ? frame : inner)[k as never] = v as never
  }
  if (!frame.border && !frame.borderWidth) frame.border = '1.5px solid #E4EAF2'
  if (frame.borderRadius === undefined) frame.borderRadius = 8
  if (frame.width === undefined) frame.width = '100%'
  if (inner.padding === undefined) inner.padding = '8px 10px'
  const fontSize = typeof inner.fontSize === 'number' ? inner.fontSize : 13
  const lineHeight = 1.5

  // Sync external value into the DOM only when it differs from what we last emitted
  // (otherwise every keystroke would reset the caret).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || value === lastEmitted.current) return
    el.innerHTML = toRichHtml(value)
    lastEmitted.current = value
  }, [value])

  useEffect(() => {
    if (autoFocus && editable) ref.current?.focus()
  }, [autoFocus, editable])

  const refreshActive = () => {
    const next = readActive(ref.current)
    if (next) setActive(next)
  }

  useEffect(() => {
    if (!focused) return
    const onSel = () => { const next = readActive(ref.current); if (next) setActive(next) }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [focused])

  const emit = () => {
    const el = ref.current
    if (!el) return
    const next = normalize(el.innerHTML)
    // Clear leftover <br>/<div> so the :empty placeholder shows again.
    if (!next && el.innerHTML) el.innerHTML = ''
    if (next === lastEmitted.current) return
    lastEmitted.current = next
    onChange?.({ target: { value: next } })
  }

  const run = (cmd: Cmd) => {
    if (!editable) return
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(cmd)
    emit()
    refreshActive()
  }

  return (
    <div className={`rt-frame${focused ? ' rt-focused' : ''}${className ? ` ${className}` : ''}`} style={{ boxSizing: 'border-box', overflow: 'hidden', ...frame, opacity: disabled ? 0.6 : undefined }}>
      {editable && (
        <div className="rt-toolbar" role="toolbar" aria-label="Text formatting">
          {TOOLS.map((t, i) => t === 'sep'
            ? <span key={i} className="rt-sep" aria-hidden />
            : (
              <button
                key={t.cmd}
                type="button"
                className="rt-btn"
                data-active={active[t.cmd] ? '' : undefined}
                aria-pressed={!!active[t.cmd]}
                aria-label={t.label}
                title={t.label}
                // Keep the selection in the editor when clicking the toolbar.
                onMouseDown={e => e.preventDefault()}
                onClick={() => run(t.cmd)}
              >
                <t.icon size={13} strokeWidth={2.4} />
              </button>
            ))}
        </div>
      )}
      <div
        ref={ref}
        className="rt-content rt-editor"
        contentEditable={editable}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-disabled={disabled || undefined}
        data-placeholder={placeholder}
        onInput={emit}
        onFocus={() => { setFocused(true); refreshActive() }}
        onBlur={() => { setFocused(false); emit() }}
        onPaste={e => {
          // Paste as plain text so Word/Docs styling doesn't leak in.
          e.preventDefault()
          onPaste?.()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
        style={{
          fontFamily: 'inherit',
          fontSize,
          lineHeight,
          color: '#1A365E',
          outline: 'none',
          minHeight: `calc(${rows * lineHeight}em + 16px)`,
          maxHeight: 480,
          overflowY: 'auto',
          resize: 'vertical',
          wordBreak: 'break-word',
          cursor: editable ? 'text' : 'default',
          ...inner,
        }}
      />
    </div>
  )
}
