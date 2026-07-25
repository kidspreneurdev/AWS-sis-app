import { useCallback, useEffect, useState } from 'react'
import { useStudentPortal } from '@/contexts/StudentPortalContext'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface LessonListItem { lessonId: string; lessonTitle: string; courseTitle: string; status: string }
interface ThreadPost {
  id: string
  studentId: string
  authorName: string
  isMine: boolean
  body: string
  wordCount: number
  parentPostId: string | null
  referencesStudentName: string | null
  editedAfterSubmission: boolean
  submittedAt: string
}
interface Classmate { studentId: string; name: string }
interface ThreadData {
  lesson: { id: string; title: string; minWords: number; dueAt: string | null }
  myComponentId: string
  classmates: Classmate[]
  posts: ThreadPost[]
}

async function authedFetch(token: string | null, url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, headers: { ...opts.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export function MHSDiscussionThread() {
  const { getToken } = useStudentPortal()
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadData | null>(null)
  const [error, setError] = useState('')

  const [composerBody, setComposerBody] = useState('')
  const [replyTo, setReplyTo] = useState<{ postId: string; studentId: string; authorName: string } | null>(null)
  const [pasteDetected, setPasteDetected] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadLessons = useCallback(async () => {
    try {
      const body = await authedFetch(getToken(), '/api/student-portal/list-my-components')
      const discussions = (body.components ?? []).filter((c: { componentType: string }) => c.componentType === 'discussion')
      setLessons(discussions.map((c: { lessonId: string; lessonTitle: string; courseTitle: string; status: string }) => ({
        lessonId: c.lessonId, lessonTitle: c.lessonTitle, courseTitle: c.courseTitle, status: c.status,
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussion boards.')
    }
  }, [getToken])

  useEffect(() => { void loadLessons() }, [loadLessons])

  const openThread = useCallback(async (lessonId: string) => {
    setError('')
    setSelectedLessonId(lessonId)
    try {
      const body = await authedFetch(getToken(), `/api/student-portal/get-discussion-thread?lessonId=${lessonId}`)
      setThread(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread.')
    }
  }, [getToken])

  const wordCount = composerBody.trim() ? composerBody.trim().split(/\s+/).filter(Boolean).length : 0
  const minWords = thread?.lesson.minWords ?? 150

  async function submitPost() {
    if (!thread) return
    if (!editingPostId && wordCount < minWords) return
    if (replyTo === null && composerBody.trim().length === 0) return
    setSubmitting(true)
    setError('')
    try {
      if (editingPostId) {
        await authedFetch(getToken(), '/api/student-portal/submit-discussion-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editPostId: editingPostId, body: composerBody }),
        })
      } else {
        await authedFetch(getToken(), '/api/student-portal/submit-discussion-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonComponentId: thread.myComponentId,
            body: composerBody,
            parentPostId: replyTo?.postId ?? null,
            referencesStudentId: replyTo?.studentId ?? null,
            pasteEventDetected: pasteDetected,
          }),
        })
      }
      setComposerBody('')
      setReplyTo(null)
      setPasteDetected(false)
      setEditingPostId(null)
      await openThread(thread.lesson.id)
      await loadLessons()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!selectedLessonId) {
    return (
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>Discussion Boards</div>
        {error && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        {lessons.length === 0 && <div style={{ fontSize: 12, color: '#7A92B0' }}>No discussion boards assigned yet.</div>}
        {lessons.map((l) => (
          <button
            key={l.lessonId}
            onClick={() => void openThread(l.lessonId)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1.5px solid #E4EAF2', background: '#F7F9FC', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{l.lessonTitle}</div>
            <div style={{ fontSize: 10, color: '#7A92B0' }}>{l.courseTitle} · {l.status.replace('_', ' ')}</div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => { setSelectedLessonId(null); setThread(null) }} style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 11, cursor: 'pointer', alignSelf: 'flex-start' }}>← Back to discussion boards</button>
      {error && <div style={{ color: '#DC2626', fontSize: 12 }}>{error}</div>}
      {!thread ? (
        <div style={card}>Loading…</div>
      ) : (
        <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E' }}>{thread.lesson.title}</div>
            <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 4 }}>Minimum {thread.lesson.minWords} words · replies must reference a classmate's point</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {thread.posts.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No posts yet — be the first to share your thinking.</div>}
            {thread.posts.map((p) => (
              <div key={p.id} style={{ ...card, marginLeft: p.parentPostId ? 24 : 0, background: p.isMine ? '#F0FDF4' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>
                    {p.authorName}
                    {p.referencesStudentName && <span style={{ fontWeight: 400, color: '#7A92B0' }}> replying to {p.referencesStudentName}</span>}
                  </div>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{p.editedAfterSubmission ? 'edited · ' : ''}{p.wordCount} words</div>
                </div>
                <div style={{ fontSize: 12, color: '#3D5475', marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.body}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {!p.parentPostId && (
                    <button
                      onClick={() => { setReplyTo({ postId: p.id, studentId: p.studentId, authorName: p.authorName }); setEditingPostId(null); setComposerBody('') }}
                      style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >
                      Reply
                    </button>
                  )}
                  {p.isMine && (
                    <button
                      onClick={() => { setEditingPostId(p.id); setComposerBody(p.body); setReplyTo(null) }}
                      style={{ background: 'none', border: 'none', color: '#0369A1', fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            {replyTo && (
              <div style={{ fontSize: 11, color: '#7A92B0', marginBottom: 6 }}>
                Replying to {replyTo.authorName} <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            )}
            {editingPostId && <div style={{ fontSize: 11, color: '#D97706', marginBottom: 6 }}>Editing your post — this will be flagged as edited-after-submission.</div>}
            <textarea
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              onPaste={() => setPasteDetected(true)}
              rows={5}
              placeholder={replyTo ? `Share your response, and reference ${replyTo.authorName}'s point…` : 'Share your thinking on this lesson…'}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: !editingPostId && wordCount < minWords ? '#DC2626' : '#15803D' }}>
                {editingPostId ? `${wordCount} words` : `${wordCount} / ${minWords} words minimum`}
              </span>
              <button
                onClick={() => void submitPost()}
                disabled={submitting || (!editingPostId && wordCount < minWords) || (!!replyTo && wordCount === 0)}
                style={{ padding: '8px 18px', background: (!editingPostId && wordCount < minWords) ? '#CBD5E1' : '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                {submitting ? 'Saving…' : editingPostId ? 'Save Edit' : replyTo ? 'Post Reply' : 'Post'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
