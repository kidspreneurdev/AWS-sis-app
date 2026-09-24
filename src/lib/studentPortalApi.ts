/** Shared helper for calling api/student-portal/[action].js with the signed portal token. */
export async function authedFetch(token: string, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers, Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

/** Hand-rolled relative time (no date-fns in this app) — "2h ago", "just now", "3d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface PortalNotification {
  id: string
  recipientId: string
  subject: string
  content: string
  attachments: { url: string; name: string }[]
  sentAt: string
  read: boolean
  readAt: string | null
}
