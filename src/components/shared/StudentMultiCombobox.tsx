import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StudentMultiComboboxProps<T extends { id: string }> {
  students: T[]
  /** Selected student ids. */
  values: string[]
  onChange: (ids: string[]) => void
  /** Primary line for each row. Also shown as a chip and part of the search text. */
  getLabel: (s: T) => string
  /** Optional secondary line, e.g. "Grade 9 · Cohort A". Also searched. */
  getMeta?: (s: T) => string | undefined
  placeholder?: string
  disabled?: boolean
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

export function StudentMultiCombobox<T extends { id: string }>({
  students,
  values,
  onChange,
  getLabel,
  getMeta,
  placeholder = 'Search students…',
  disabled = false,
  style,
}: StudentMultiComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedSet = useMemo(() => new Set(values), [values])
  const selectedStudents = useMemo(() => students.filter(s => selectedSet.has(s.id)), [students, selectedSet])

  type Row = { id: string; label: string; meta?: string }
  const rows: Row[] = useMemo(() => {
    const toks = tokenize(query)
    const list: Row[] = []
    for (const s of students) {
      const label = getLabel(s)
      const meta = getMeta?.(s)
      if (!matches(`${label} ${meta ?? ''}`, toks)) continue
      list.push({ id: s.id, label, meta })
    }
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return list
  }, [students, query, getLabel, getMeta])

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

  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.children[highlightIdx] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  function openList() {
    if (disabled) return
    setHighlightIdx(0)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setQuery('')
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(values.filter(v => v !== id))
    else onChange([...values, id])
  }

  function remove(id: string) {
    onChange(values.filter(v => v !== id))
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
      if (row) toggle(row.id)
      e.preventDefault()
    }
    else if (e.key === 'Escape') { close(); e.preventDefault() }
    else if (e.key === 'Backspace' && query === '' && values.length > 0) { onChange(values.slice(0, -1)) }
  }

  const mergedStyle: React.CSSProperties = { ...baseInputStyle, ...style, width: style?.width ?? '100%' }

  const menuWidth = rect ? Math.max(rect.width, 288) : 288
  const menuLeft = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)) : 0

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {selectedStudents.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {selectedStudents.map(s => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#EEF3FF', border: '1px solid #DDE6F0', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#1A365E' }}>
              {getLabel(s)}
              {!disabled && (
                <button type="button" onClick={() => remove(s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#7A92B0', lineHeight: 1 }}>✕</button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        value={query}
        placeholder={selectedStudents.length ? 'Add another student…' : placeholder}
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
            const checked = selectedSet.has(row.id)
            return (
              <li
                key={row.id}
                onMouseDown={e => { e.preventDefault(); toggle(row.id) }}
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
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${checked ? '#1A365E' : '#CBD5E1'}`,
                  background: checked ? '#1A365E' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                }}>
                  {checked ? '✓' : ''}
                </div>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: '#1A365E', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
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
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}
