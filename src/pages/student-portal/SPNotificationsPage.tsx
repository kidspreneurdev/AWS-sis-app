import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { downloadUrl } from '@/lib/uploadFile'
import { authedFetch, timeAgo, type PortalNotification } from '@/lib/studentPortalApi'
import { Bell, Paperclip } from 'lucide-react'

const PAGE_SIZE = 20

const styles = `
  .spn-card {
    background: #fff;
    border: 1px solid #E4EAF2;
    border-left: 3px solid transparent;
    border-radius: 12px;
    margin-bottom: 10px;
    overflow: hidden;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .spn-card--unread { background: #F0F6FF; border-left-color: #D61F31; }
  .spn-card--highlight { box-shadow: 0 0 0 2px #D61F31; }

  .spn-card-head {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .spn-card-body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 200ms cubic-bezier(0.23,1,0.32,1);
  }
  .spn-card-body--open { grid-template-rows: 1fr; }
  .spn-card-body-inner { overflow: hidden; }
  .spn-card-content { padding: 0 18px 18px; font-size: 13px; color: #3D5475; line-height: 1.6; white-space: pre-wrap; }

  .spn-attachment {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px; margin: 4px 6px 0 0;
    background: #F0F4FA; border-radius: 8px;
    font-size: 11.5px; font-weight: 600; color: #1A365E;
    border: none; cursor: pointer; font-family: inherit;
    transition: background 140ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .spn-attachment:hover { background: #E4EAF2; }
  }

  .spn-load-more {
    width: 100%;
    padding: 11px;
    border-radius: 10px;
    border: 1px solid #E4EAF2;
    background: #fff;
    color: #1A365E;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 140ms ease, transform 120ms cubic-bezier(0.23,1,0.32,1);
  }
  .spn-load-more:active:not(:disabled) { transform: scale(0.98); }
  .spn-load-more:disabled { opacity: .6; cursor: default; }
  @media (hover: hover) and (pointer: fine) {
    .spn-load-more:not(:disabled):hover { background: #F7F9FC; }
  }

  @media (prefers-reduced-motion: reduce) {
    .spn-card-body { transition-duration: 1ms; }
  }
`

export function SPNotificationsPage() {
  const { getToken } = useStudentPortal()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('id')

  const [items, setItems] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const markedRef = useRef<Set<string>>(new Set())
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const scrolledRef = useRef(false)

  const load = useCallback(async (offset: number, replace: boolean) => {
    const token = getToken()
    if (!token) { setError('Notifications are only available from the student portal.'); setLoading(false); return }
    try {
      const body = await authedFetch(token, `/api/student-portal/list-my-notifications?limit=${PAGE_SIZE}&offset=${offset}`)
      const next = (body.notifications ?? []) as PortalNotification[]
      setItems(prev => replace ? next : [...prev, ...next])
      setHasMore(!!body.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [getToken])

  useEffect(() => { void load(0, true) }, [load])

  useEffect(() => {
    if (!highlightId || scrolledRef.current) return
    if (items.some(n => n.id === highlightId)) {
      setExpanded(prev => new Set(prev).add(highlightId))
      scrolledRef.current = true
      requestAnimationFrame(() => highlightRef.current?.scrollIntoView({ block: 'center' }))
    }
  }, [items, highlightId])

  async function toggle(n: PortalNotification) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(n.id)) next.delete(n.id); else next.add(n.id)
      return next
    })
    if (!n.read && !markedRef.current.has(n.id)) {
      markedRef.current.add(n.id)
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      const token = getToken()
      if (token) {
        try { await authedFetch(token, '/api/student-portal/mark-notification-read', { method: 'POST', body: JSON.stringify({ notificationId: n.id }) }) } catch { /* best-effort */ }
      }
    }
  }

  function loadMore() {
    setLoadingMore(true)
    void load(items.length, false)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <style>{styles}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Bell size={20} color="#1A365E" />
        <h1 style={{ fontSize: 21, fontWeight: 800, color: '#1A365E', margin: 0 }}>Notifications</h1>
      </div>
      <div style={{ fontSize: 17, color: '#7A92B0', marginBottom: 20 }}>Messages sent to you from school staff.</div>

      {loading ? (
        <div style={{ fontSize: 16, color: '#7A92B0' }}>Loading…</div>
      ) : error ? (
        <div style={{ fontSize: 16, color: '#D61F31' }}>{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9AACC4', fontSize: 16 }}>You don't have any notifications yet.</div>
      ) : (
        <>
          {items.map(n => {
            const isOpen = expanded.has(n.id)
            return (
              <div
                key={n.id}
                ref={n.id === highlightId ? highlightRef : undefined}
                className={`spn-card${n.read ? '' : ' spn-card--unread'}${n.id === highlightId ? ' spn-card--highlight' : ''}`}
              >
                <button className="spn-card-head" onClick={() => toggle(n)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: n.read ? 600 : 800, color: '#1A365E' }}>{n.subject}</div>
                    {!isOpen && (
                      <div style={{ fontSize: 17, color: '#7A92B0', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.content}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 15, color: '#9AACC4', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.sentAt)}</span>
                </button>
                <div className={`spn-card-body${isOpen ? ' spn-card-body--open' : ''}`}>
                  <div className="spn-card-body-inner">
                    <div className="spn-card-content">
                      {n.content}
                      {n.attachments.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {n.attachments.map((a, i) => (
                            <button key={i} className="spn-attachment" onClick={() => downloadUrl(a.url, a.name)}>
                              <Paperclip size={12} /> {a.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {hasMore && (
            <button className="spn-load-more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
