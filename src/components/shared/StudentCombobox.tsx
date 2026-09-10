import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StudentComboboxProps<T extends { id: string }> {
  students: T[]
  /** Selected student id. '' means nothing selected (or "all" when `allOption` is set). */
  value: string
  onChange: (id: string) => void
  /** Primary line for each row. Also the closed-input display and part of the search text. */
  getLabel: (s: T) => string
  /** Optional secondary line, e.g. "Grade 9 · Cohort A". Also searched. */
  getMeta?: (s: T) => string | undefined
  /** Optional right-aligned status badge, e.g. "Enrolled". */
  getStatus?: (s: T) => string | undefined
  placeholder?: string
  /** When set, adds a leading row (value '') with this label, e.g. "All Students". */
  allOption?: string
  disabled?: boolean
  autoFocus?: boolean
  /** Merged onto the trigger <input> so each call site keeps its own width / border. */
  style?: React.CSSProperties
}

const baseInputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #E4EAF2',
  fontSize: 13,
  color: '#1A365E',
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
}

interface Rect { left: number; top: number; width: number; bottom: number }

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean)
}

function matches(hay: string, toks: string[]): boolean {
  if (toks.length === 0) return true
  const h = hay.toLowerCase()
  return toks.every(t => h.includes(t))
}

/** "John Smith" → "JS", "Smith, John" → "JS", "Mary Adams (Grade 9)" → "MA". */
function initialsOf(label: string): string {
  const clean = label.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const comma = clean.indexOf(',')
  if (comma !== -1) {
    const last = clean.slice(0, comma).trim()
    const rest = clean.slice(comma + 1).trim()
    return ((rest[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
  }
  const parts = clean.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
}

/** Bold the earliest matched token span. */
function highlight(label: string, toks: string[]): React.ReactNode {
  if (toks.length === 0) return label
  const lower = label.toLowerCase()
  let start = -1
  let end = -1
  for (const t of toks) {
    const i = lower.indexOf(t)
    if (i === -1) continue
    if (start === -1 || i < start) { start = i; end = i + t.length }
  }
  if (start === -1) return label
  return (
    <>
      {label.slice(0, start)}
      <strong>{label.slice(start, end)}</strong>
      {label.slice(end)}
    </>
  )
}

export function StudentCombobox<T extends { id: string }>({
  students,
  value,
  onChange,
  getLabel,
  getMeta,
  getStatus,
  placeholder = 'Search students…',
  allOption,
  disabled = false,
  autoFocus = false,
  style,
}: StudentComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedLabel = useMemo(() => {
    const s = students.find(x => x.id === value)
    if (s) return getLabel(s)
    if (!value && allOption) return allOption
    return ''
  }, [students, value, allOption, getLabel])

  type Row = { id: string; label: string; meta?: string; status?: string; isAll?: boolean }
  const rows: Row[] = useMemo(() => {
    const toks = tokenize(query)
    const list: Row[] = []
    for (const s of students) {
      const label = getLabel(s)
      const meta = getMeta?.(s)
      const status = getStatus?.(s)
      if (!matches(`${label} ${meta ?? ''} ${status ?? ''}`, toks)) continue
      list.push({ id: s.id, label, meta, status })
    }
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    if (allOption && matches(allOption, toks)) {
      list.unshift({ id: '', label: allOption, isAll: true })
    }
    return list
  }, [students, query, allOption, getLabel, getMeta, getStatus])

  const toks = useMemo(() => tokenize(query), [query])

  const updateRect = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ left: r.left, top: r.top, width: r.width, bottom: r.bottom })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateRect()
    const onScroll = () => updateRect()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updateRect])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (listRef.current?.contains(t)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.children[highlightIdx] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  function openList() {
    if (disabled) return
    setQuery('')
    const cur = rows.findIndex(r => r.id === value)
    setHighlightIdx(cur === -1 ? 0 : cur)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setQuery('')
  }

  function pick(row: Row) {
    onChange(row.id)
    close()
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { openList(); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setHighlightIdx(i => Math.min(i + 1, rows.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHighlightIdx(i => Math.max(i - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter') {
      const row = rows[highlightIdx]
      if (row) pick(row)
      e.preventDefault()
    }
    else if (e.key === 'Escape') { close(); e.preventDefault() }
  }

  const mergedStyle: React.CSSProperties = { ...baseInputStyle, ...style, width: style?.width ?? '100%' }

  const menuWidth = rect ? Math.max(rect.width, 288) : 288
  const menuLeft = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)) : 0

  return (
    <div ref={wrapRef} style={{ display: 'contents' }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        autoFocus={autoFocus}
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => openList()}
        onChange={e => { setQuery(e.target.value); setHighlightIdx(0); if (!open) setOpen(true) }}
        onKeyDown={onKeyDown}
        style={{ ...mergedStyle, cursor: disabled ? 'not-allowed' : 'text' }}
      />
      {open && rect && createPortal(
        <ul
          ref={listRef}
          style={{
            position: 'fixed',
            left: menuLeft,
            top: rect.bottom + 6,
            width: menuWidth,
            maxHeight: 340,
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: '#fff',
            border: '1.5px solid #E4EAF2',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(26,54,94,0.14)',
            zIndex: 3000,
          }}
        >
          {rows.length === 0 && (
            <li style={{ padding: '12px 16px', fontSize: 12, color: '#7A92B0' }}>No students found</li>
          )}
          {rows.map((row, i) => {
            const active = i === highlightIdx
            if (row.isAll) {
              return (
                <li
                  key="__all__"
                  onMouseDown={e => { e.preventDefault(); pick(row) }}
                  onMouseEnter={() => setHighlightIdx(i)}
                  style={{
                    padding: '10px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7A92B0',
                    cursor: 'pointer',
                    borderBottom: '1px solid #F0F4F8',
                    background: active ? '#F0F6FF' : 'transparent',
                  }}
                >
                  {row.label}
                </li>
              )
            }
            return (
              <li
                key={row.id}
                onMouseDown={e => { e.preventDefault(); pick(row) }}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F0F4F8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: active ? '#F0F6FF' : 'transparent',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: '#1A365E', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {initialsOf(row.label)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlight(row.label, toks)}
                  </div>
                  {row.meta && (
                    <div style={{ fontSize: 11, color: '#7A92B0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.meta}
                    </div>
                  )}
                </div>
                {row.status && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7A92B0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {row.status}
                  </span>
                )}
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}
