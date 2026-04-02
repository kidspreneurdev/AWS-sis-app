import type { StudentStatus } from '@/types/student'
import { STATUS_META } from '@/types/student'

interface Props {
  status: StudentStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const m = STATUS_META[status] ?? { dot: '#7A92B0', bg: '#F3F4F6', tc: '#6B7280' }
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const fontSize = size === 'sm' ? '11px' : '12px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: m.bg,
        color: m.tc,
        borderRadius: 20,
        padding: pad,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: m.dot,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  )
}
