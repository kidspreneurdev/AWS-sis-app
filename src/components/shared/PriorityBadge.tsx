import type { Priority } from '@/types/student'
import { PRIORITY_META } from '@/types/student'

interface Props {
  priority: Priority
}

export function PriorityBadge({ priority }: Props) {
  const m = PRIORITY_META[priority] ?? { bg: '#7A92B0', tc: '#fff' }
  return (
    <span
      style={{
        display: 'inline-block',
        background: m.bg,
        color: m.tc,
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {priority}
    </span>
  )
}
