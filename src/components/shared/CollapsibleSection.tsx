import { useState, type ReactNode } from 'react'

// A dependency-free collapsible "dropdown" section styled for the portal /
// admin record pages. Nestable — use level="category" for the outer group and
// level="sub" for nested groups (e.g. a diagnostics semester).

interface Props {
  title: string
  subtitle?: string
  badge?: string
  defaultOpen?: boolean
  level?: 'category' | 'sub'
  children: ReactNode
}

export function CollapsibleSection({ title, subtitle, badge, defaultOpen = true, level = 'category', children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const isCategory = level === 'category'

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E4EAF2',
        borderRadius: isCategory ? 12 : 10,
        boxShadow: isCategory ? '0 1px 4px rgba(26,54,94,0.06)' : 'none',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: isCategory ? '14px 18px' : '11px 16px',
          background: open ? '#F7F9FC' : '#fff',
          border: 'none',
          borderBottom: open ? '1px solid #E4EAF2' : 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          transition: 'background 140ms',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 20,
            height: 20,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #E4EAF2',
            borderRadius: 4,
            background: '#fff',
            fontSize: 12,
            color: '#5A7290',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 180ms ease',
          }}
        >
          ▸
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: isCategory ? 14 : 13, fontWeight: 800, color: '#1A365E' }}>{title}</span>
          {subtitle && (
            <span style={{ display: 'block', fontSize: 11.5, color: '#7A92B0', marginTop: 2 }}>{subtitle}</span>
          )}
        </span>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7A92B0', flexShrink: 0 }}>{badge}</span>
        )}
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 220ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            role="region"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isCategory ? 12 : 10,
              padding: isCategory ? '14px 16px' : '12px 14px',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
