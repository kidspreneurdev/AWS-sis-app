const SPAIN_TIME_ZONE = 'Europe/Madrid'
const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

export function isSpainCampus(campus?: string | null): boolean {
  return (campus ?? '').trim().toLowerCase() === 'spain'
}

export function getCampusTimeZone(campus?: string | null): string {
  return isSpainCampus(campus) ? SPAIN_TIME_ZONE : DEFAULT_TIME_ZONE
}

export function getCampusHour(campus?: string | null, date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: getCampusTimeZone(campus),
    hour: 'numeric',
    hour12: false,
  }).format(date)
  return parseInt(hourStr, 10) % 24
}

export function getCampusGreeting(campus?: string | null): string {
  const h = getCampusHour(campus)
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Formats a stored timestamp in the viewer's campus timezone, e.g. "25 Sep 26 14:05:30". */
export function formatCampusDateTime(value: string | Date, campus?: string | null): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '—'
  const timeZone = getCampusTimeZone(campus)
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone })
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone })
  return `${datePart} ${timePart}`
}
