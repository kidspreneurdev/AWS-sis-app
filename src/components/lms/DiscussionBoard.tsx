import { useMemo, useState } from 'react'
import {
  ArrowLeft, Lock, Megaphone, MessageSquare, Paperclip, Pencil, Pin,
  Search, LayoutGrid, List, ThumbsUp, Trash2, Upload, ExternalLink, Send,
} from 'lucide-react'

/** Shared visual language for Master It's discussion board — used by both the student
 *  portal view (SPMyLearningPage) and the staff moderation view (LMSPage). The two
 *  surfaces have different data sources and permissions (student API broker + own-post
 *  edit/like vs. direct Supabase + pin/lock/delete moderation), so this component takes
 *  posts and mutation callbacks as props rather than fetching anything itself. */

export interface DiscussionPost {
  id: string
  authorName: string
  isStaff: boolean
  isMine?: boolean
  isAnnouncement: boolean
  isPinned: boolean
  isLocked: boolean
  title: string | null
  body: string | null
  deletedAt: string | null
  edited?: boolean
  parentPostId: string | null
  createdAt: string
  attachmentUrl: string | null
  attachmentFileName: string | null
  reactionCount: number
  reactedByMe?: boolean
}

export interface DiscussionBoardProps {
  mode: 'student' | 'staff'
  posts: DiscussionPost[]
  loading?: boolean
  busy?: boolean
  readOnly?: boolean
  introText?: string
  onCreateTopic: (input: { title: string; body: string; file: File | null; announce: boolean }) => Promise<void> | void
  onCreateReply: (topicId: string, input: { body: string; file: File | null }) => Promise<void> | void
  onEditPost?: (post: DiscussionPost, newBody: string) => Promise<void> | void
  onDeletePost: (post: DiscussionPost) => Promise<void> | void
  onReact?: (post: DiscussionPost) => Promise<void> | void
  onTogglePin?: (post: DiscussionPost) => Promise<void> | void
  onToggleLock?: (post: DiscussionPost) => Promise<void> | void
  allowAttachments?: boolean
  allowAnnouncementToggle?: boolean
}

const NAVY = '#1A365E'
const RED = '#D61F31'
const GREEN = '#1DBD6A'

const AVATAR_TINTS = [
  { bg: '#E7ECF4', fg: '#2C4A78' }, // navy
  { bg: '#FBE7E9', fg: '#B01827' }, // red
  { bg: '#E1F7EC', fg: '#159154' }, // green
  { bg: '#E1F2EE', fg: '#1E7A63' }, // teal (navy+green mix)
  { bg: '#F1E7ED', fg: '#7A3A5C' }, // plum (navy+red mix)
]

function avatarTintFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid #E4EAF2', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#FBFCFE' }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' }
const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E4EAF2', boxShadow: '0 1px 6px rgba(26,54,94,.06)' }

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const tint = avatarTintFor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tint.bg, color: tint.fg, fontWeight: 700, fontSize: size * 0.38,
    }}>
      {initialsFor(name)}
    </div>
  )
}

function Badges({ post }: { post: DiscussionPost }) {
  const chips: React.ReactNode[] = []
  if (post.isAnnouncement) {
    chips.push(<span key="ann" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: RED, background: '#FBE7E9', padding: '3px 8px', borderRadius: 20 }}><Megaphone size={11} /> Announcement</span>)
  } else if (post.isPinned) {
    chips.push(<span key="pin" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: RED, background: '#FBE7E9', padding: '3px 8px', borderRadius: 20 }}><Pin size={11} /> Pinned</span>)
  }
  if (post.isLocked) {
    chips.push(<span key="lock" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#64748B', background: '#F8FAFC', border: '1px solid #E4EAF2', padding: '3px 8px', borderRadius: 20 }}><Lock size={11} /> Locked</span>)
  }
  if (chips.length === 0) return null
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{chips}</div>
}

function ReactionControl({ post, mode, onReact, readOnly }: { post: DiscussionPost; mode: 'student' | 'staff'; onReact?: (post: DiscussionPost) => void; readOnly?: boolean }) {
  if (mode === 'staff') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
        <ThumbsUp size={13} /> {post.reactionCount}
      </span>
    )
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!readOnly) onReact?.(post) }}
      disabled={readOnly}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
        padding: '5px 10px', borderRadius: 20, border: `1px solid ${post.reactedByMe ? 'transparent' : '#E4EAF2'}`,
        background: post.reactedByMe ? '#E1F7EC' : '#F8FAFC', color: post.reactedByMe ? '#159154' : '#64748B',
        cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      }}
    >
      <ThumbsUp size={13} fill={post.reactedByMe ? '#159154' : 'none'} /> {post.reactionCount > 0 ? post.reactionCount : 'Like'}
    </button>
  )
}

function AttachmentChip({ url, name }: { url: string; name: string | null }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#E7ECF4', borderRadius: 10, textDecoration: 'none', maxWidth: 260 }}>
      <Paperclip size={12} color="#2C4A78" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: '#2C4A78', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Attachment'}</span>
      <ExternalLink size={10} color="#2C4A78" style={{ flexShrink: 0 }} />
    </a>
  )
}

export function DiscussionBoard({
  mode, posts, loading, busy, readOnly,
  introText = mode === 'student' ? 'Ask questions, share ideas, and discuss your presentation with classmates.' : undefined,
  onCreateTopic, onCreateReply, onEditPost, onDeletePost, onReact, onTogglePin, onToggleLock,
  allowAttachments = mode === 'student', allowAnnouncementToggle = mode === 'staff',
}: DiscussionBoardProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'liked'>('recent')
  const [filter, setFilter] = useState<'all' | 'pinned' | 'mine'>('all')
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newAnnounce, setNewAnnounce] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const topics = useMemo(() => posts.filter((p) => !p.parentPostId), [posts])
  const repliesOf = (topicId: string) => posts.filter((p) => p.parentPostId === topicId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const lastActivityOf = (topic: DiscussionPost) => {
    const r = repliesOf(topic.id)
    return r.length ? r[r.length - 1].createdAt : topic.createdAt
  }

  const visibleTopics = useMemo(() => {
    let list = topics
    if (filter === 'pinned') list = list.filter((t) => t.isPinned)
    if (filter === 'mine') list = list.filter((t) => t.isMine)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => (t.title ?? '').toLowerCase().includes(q) || (t.body ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      if (sort === 'liked') return b.reactionCount - a.reactionCount
      return lastActivityOf(b).localeCompare(lastActivityOf(a))
    })
  }, [topics, filter, search, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTopic = selectedTopicId ? posts.find((p) => p.id === selectedTopicId) ?? null : null

  function resetComposer() { setComposerOpen(false); setNewTitle(''); setNewBody(''); setNewFile(null); setNewAnnounce(false) }

  async function submitTopic() {
    if (!newTitle.trim() || !newBody.trim()) return
    await onCreateTopic({ title: newTitle.trim(), body: newBody.trim(), file: newFile, announce: newAnnounce })
    resetComposer()
  }

  async function submitReply(topicId: string) {
    if (!replyBody.trim()) return
    await onCreateReply(topicId, { body: replyBody.trim(), file: replyFile })
    setReplyBody(''); setReplyFile(null)
  }

  function canModerateSelf(post: DiscussionPost) {
    return mode === 'student' && !!post.isMine && !readOnly && !post.deletedAt
  }

  function RowActions({ post, isTopic }: { post: DiscussionPost; isTopic: boolean }) {
    if (post.deletedAt) return null
    if (mode === 'staff') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {isTopic && (
            <>
              <button onClick={() => onTogglePin?.(post)} title={post.isPinned ? 'Unpin' : 'Pin'} style={{ padding: '4px 8px', background: post.isPinned ? '#FBE7E9' : '#F8FAFC', color: post.isPinned ? RED : '#64748B', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pin size={11} /> {post.isPinned ? 'Unpin' : 'Pin'}</button>
              <button onClick={() => onToggleLock?.(post)} title={post.isLocked ? 'Unlock' : 'Lock'} style={{ padding: '4px 8px', background: post.isLocked ? '#F8FAFC' : '#F8FAFC', color: '#64748B', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={11} /> {post.isLocked ? 'Unlock' : 'Lock'}</button>
            </>
          )}
          <button onClick={() => setConfirmDeleteId(post.id)} title="Delete" style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} /></button>
        </div>
      )
    }
    if (canModerateSelf(post)) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setEditingPostId(post.id); setEditBody(post.body ?? '') }} title="Edit" style={{ padding: 5, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><Pencil size={13} /></button>
          <button onClick={() => setConfirmDeleteId(post.id)} title="Delete" style={{ padding: 5, background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} /></button>
        </div>
      )
    }
    return null
  }

  function confirmDelete(post: DiscussionPost) {
    onDeletePost(post)
    setConfirmDeleteId(null)
    if (selectedTopicId === post.id) setSelectedTopicId(null)
  }

  // ─── Composer ───────────────────────────────────────────────────────────
  function Composer() {
    if (!composerOpen) return null
    return (
      <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Give your topic a title…" style={inputStyle} />
        <textarea rows={3} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="What do you want to discuss?" style={textareaStyle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          {allowAttachments ? (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: newFile ? GREEN : '#7A92B0', fontWeight: newFile ? 700 : 400, cursor: 'pointer' }}>
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setNewFile(f) }} />
              <Upload size={12} /> {newFile ? newFile.name : 'Attach file'}
            </label>
          ) : allowAnnouncementToggle ? (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5A7290', cursor: 'pointer' }}>
              <input type="checkbox" checked={newAnnounce} onChange={(e) => setNewAnnounce(e.target.checked)} /> Post as Instructor Announcement (pins it)
            </label>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetComposer} style={{ padding: '8px 14px', background: '#F0F4FA', color: NAVY, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void submitTopic()} disabled={busy || !newTitle.trim() || !newBody.trim()} style={{ padding: '8px 16px', background: newTitle.trim() && newBody.trim() ? NAVY : '#E4EAF2', color: newTitle.trim() && newBody.trim() ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: newTitle.trim() && newBody.trim() ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Send size={12} /> Post</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Card (grid/list) ───────────────────────────────────────────────────
  function TopicCard({ topic }: { topic: DiscussionPost }) {
    const replyCount = repliesOf(topic.id).length
    const isDeleted = !!topic.deletedAt
    return (
      <article
        onClick={() => !isDeleted && setSelectedTopicId(topic.id)}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isDeleted) { e.preventDefault(); setSelectedTopicId(topic.id) } }}
        style={{
          ...card, padding: 16, display: 'flex', flexDirection: view === 'list' ? 'row' : 'column', gap: 10,
          borderTop: topic.isPinned ? `3px solid ${RED}` : card.border, cursor: isDeleted ? 'default' : 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: view === 'list' ? '0 0 220px' : undefined }}>
          <Avatar name={topic.authorName} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{topic.isMine ? 'You' : topic.authorName}</span>
              {topic.isStaff && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', padding: '2px 7px', borderRadius: 20, background: '#E7ECF4', color: '#2C4A78' }}>Staff</span>}
            </div>
            <div style={{ fontSize: 12, color: '#9AA6B8', marginTop: 1 }}>{formatRelativeTime(topic.createdAt)}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}><RowActions post={topic} isTopic /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
          <Badges post={topic} />
          {isDeleted ? (
            <div style={{ fontSize: 14, color: '#94A3B8', fontStyle: 'italic' }}>[deleted]</div>
          ) : (
            <>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.3 }}>{topic.title}</h3>
              <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{topic.body}</p>
              {topic.attachmentUrl && <AttachmentChip url={topic.attachmentUrl} name={topic.attachmentFileName} />}
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #E4EAF2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ReactionControl post={topic} mode={mode} onReact={onReact} readOnly={readOnly} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#9AA6B8' }}><MessageSquare size={13} /> {replyCount}</span>
            </div>
            <span style={{ fontSize: 11.5, color: '#9AA6B8' }}>Active {formatRelativeTime(lastActivityOf(topic))}</span>
          </div>
        </div>
      </article>
    )
  }

  // ─── Thread / detail view ───────────────────────────────────────────────
  if (selectedTopic) {
    const threadReplies = repliesOf(selectedTopic.id)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setSelectedTopicId(null)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 4px', background: 'none', border: 'none', color: '#5A7290', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ArrowLeft size={13} /> Back to Discussion Board
        </button>

        <div style={{ ...card, padding: 20, borderTop: selectedTopic.isPinned ? `3px solid ${RED}` : card.border }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Avatar name={selectedTopic.authorName} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{selectedTopic.isMine ? 'You' : selectedTopic.authorName}</span>
                {selectedTopic.isStaff && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', padding: '2px 7px', borderRadius: 20, background: '#E7ECF4', color: '#2C4A78' }}>Staff</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9AA6B8', marginTop: 1 }}>{formatRelativeTime(selectedTopic.createdAt)}{selectedTopic.edited && !selectedTopic.deletedAt ? ' · edited' : ''}</div>
            </div>
            <RowActions post={selectedTopic} isTopic />
          </div>
          <div style={{ marginTop: 10 }}><Badges post={selectedTopic} /></div>
          {editingPostId === selectedTopic.id ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} style={textareaStyle} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingPostId(null)} style={{ padding: '7px 14px', background: '#F0F4FA', color: NAVY, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => { void onEditPost?.(selectedTopic, editBody.trim()); setEditingPostId(null) }} disabled={busy || !editBody.trim()} style={{ padding: '7px 14px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              </div>
            </div>
          ) : selectedTopic.deletedAt ? (
            <div style={{ fontSize: 15, color: '#94A3B8', fontStyle: 'italic', marginTop: 10 }}>[deleted]</div>
          ) : (
            <>
              <h2 style={{ fontSize: 19, fontWeight: 700, color: NAVY, margin: '12px 0 6px' }}>{selectedTopic.title}</h2>
              <p style={{ fontSize: 14.5, color: '#1A2233', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>{selectedTopic.body}</p>
              {selectedTopic.attachmentUrl && <AttachmentChip url={selectedTopic.attachmentUrl} name={selectedTopic.attachmentFileName} />}
              <div style={{ marginTop: 10 }}><ReactionControl post={selectedTopic} mode={mode} onReact={onReact} readOnly={readOnly} /></div>
            </>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#5A7290' }}>Replies {threadReplies.length > 0 && `(${threadReplies.length})`}</div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {threadReplies.length === 0 && <div style={{ fontSize: 14, color: '#9AA6B8', padding: '8px 0' }}>No replies yet — be the first to respond.</div>}
          {threadReplies.map((reply, idx) => (
            editingPostId === reply.id ? (
              <div key={reply.id} style={{ padding: '12px 4px', borderTop: idx > 0 ? '1px solid #E4EAF2' : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} style={textareaStyle} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditingPostId(null)} style={{ padding: '6px 12px', background: '#F0F4FA', color: NAVY, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={() => { void onEditPost?.(reply, editBody.trim()); setEditingPostId(null) }} disabled={busy || !editBody.trim()} style={{ padding: '6px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                </div>
              </div>
            ) : (
              <div key={reply.id} style={{ display: 'flex', gap: 12, padding: '14px 4px', borderTop: idx > 0 ? '1px solid #E4EAF2' : undefined }}>
                <Avatar name={reply.authorName} size={32} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{reply.isMine ? 'You' : reply.authorName}</span>
                      {reply.isStaff && <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', padding: '2px 7px', borderRadius: 20, background: '#E7ECF4', color: '#2C4A78' }}>Staff</span>}
                      <span style={{ fontSize: 12, color: '#9AA6B8' }}>{formatRelativeTime(reply.createdAt)}{reply.edited && !reply.deletedAt ? ' · edited' : ''}</span>
                    </div>
                    <RowActions post={reply} isTopic={false} />
                  </div>
                  {reply.deletedAt ? (
                    <div style={{ fontSize: 14, color: '#94A3B8', fontStyle: 'italic', marginTop: 4 }}>[deleted]</div>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, color: '#1A2233', lineHeight: 1.55, margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>{reply.body}</p>
                      {reply.attachmentUrl && <div style={{ marginBottom: 8 }}><AttachmentChip url={reply.attachmentUrl} name={reply.attachmentFileName} /></div>}
                      <ReactionControl post={reply} mode={mode} onReact={onReact} readOnly={readOnly} />
                    </>
                  )}
                </div>
              </div>
            )
          ))}
        </div>

        {mode === 'student' && selectedTopic.isLocked ? (
          <div style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13.5, fontWeight: 600 }}>
            <Lock size={15} /> This discussion is locked. You can view the conversation but cannot add a reply.
          </div>
        ) : !selectedTopic.deletedAt && (
          <div style={{ ...card, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={mode === 'staff' ? 'Instructor' : 'You'} size={32} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea rows={2} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply…" disabled={readOnly} style={textareaStyle} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {allowAttachments ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: replyFile ? GREEN : '#7A92B0', fontWeight: replyFile ? 700 : 400, cursor: 'pointer' }}>
                    <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setReplyFile(f) }} />
                    <Upload size={12} /> {replyFile ? replyFile.name : 'Attach'}
                  </label>
                ) : <span />}
                <button onClick={() => void submitReply(selectedTopic.id)} disabled={readOnly || busy || !replyBody.trim()} style={{ padding: '8px 16px', background: replyBody.trim() && !readOnly ? NAVY : '#E4EAF2', color: replyBody.trim() && !readOnly ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: replyBody.trim() && !readOnly ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Send size={12} /> Reply</button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteId && (
          <DeleteConfirm postId={confirmDeleteId} posts={posts} onCancel={() => setConfirmDeleteId(null)} onConfirm={confirmDelete} />
        )}
      </div>
    )
  }

  // ─── Board (toolbar + filters + grid) ───────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {introText && <div style={{ fontSize: 13.5, color: '#7A92B0' }}>{introText}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E4EAF2', borderRadius: 20, padding: '7px 12px', color: '#9AA6B8', minWidth: 160 }}>
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search discussions…" style={{ border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: 13, color: '#1A2233', width: '100%' }} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'liked')} style={{ ...inputStyle, width: 'auto', padding: '7px 10px', cursor: 'pointer' }}>
            <option value="recent">Most recent</option>
            <option value="liked">Most liked</option>
          </select>
          <div style={{ display: 'flex', background: '#F8FAFC', border: '1px solid #E4EAF2', borderRadius: 10, padding: 3, gap: 2 }}>
            <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} style={{ width: 32, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', background: view === 'grid' ? '#fff' : 'transparent', color: view === 'grid' ? NAVY : '#94A3B8', boxShadow: view === 'grid' ? '0 1px 4px rgba(26,54,94,.1)' : 'none' }}><LayoutGrid size={15} /></button>
            <button onClick={() => setView('list')} aria-pressed={view === 'list'} style={{ width: 32, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, cursor: 'pointer', background: view === 'list' ? '#fff' : 'transparent', color: view === 'list' ? NAVY : '#94A3B8', boxShadow: view === 'list' ? '0 1px 4px rgba(26,54,94,.1)' : 'none' }}><List size={15} /></button>
          </div>
          {!composerOpen && (
            <button onClick={() => setComposerOpen(true)} disabled={readOnly} style={{ padding: '9px 16px', background: NAVY, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: readOnly ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
              <MessageSquare size={13} /> New Discussion
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          { key: 'all', label: 'All', count: topics.length },
          { key: 'pinned', label: 'Pinned', count: topics.filter((t) => t.isPinned).length },
          ...(mode === 'student' ? [{ key: 'mine', label: 'My posts', count: topics.filter((t) => t.isMine).length }] : []),
        ] as const).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as 'all' | 'pinned' | 'mine')} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
            background: filter === f.key ? '#E7ECF4' : '#fff', color: filter === f.key ? '#2C4A78' : '#64748B', boxShadow: filter === f.key ? 'none' : '0 1px 4px rgba(26,54,94,.05)',
          }}>
            {f.label} <span style={{ opacity: .7 }}>{f.count}</span>
          </button>
        ))}
      </div>

      <Composer />

      {loading ? (
        <div style={{ ...card, padding: '32px 20px', textAlign: 'center', color: '#7A92B0', fontSize: 14 }}>Loading…</div>
      ) : visibleTopics.length === 0 ? (
        <div style={{ ...card, padding: '40px 20px', textAlign: 'center', border: '1px dashed #D7E0EA' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{topics.length === 0 ? 'No discussions yet' : 'No matching discussions'}</div>
          <div style={{ fontSize: 13.5, color: '#94A3B8' }}>{topics.length === 0 ? 'Start the first conversation for this module.' : 'Try a different search or filter.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: view === 'list' ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {visibleTopics.map((topic) => <TopicCard key={topic.id} topic={topic} />)}
        </div>
      )}

      {confirmDeleteId && (
        <DeleteConfirm postId={confirmDeleteId} posts={posts} onCancel={() => setConfirmDeleteId(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )

  function DeleteConfirm({ postId, posts: allPosts, onCancel, onConfirm }: { postId: string; posts: DiscussionPost[]; onCancel: () => void; onConfirm: (post: DiscussionPost) => void }) {
    const post = allPosts.find((p) => p.id === postId)
    if (!post) return null
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,36,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 22, maxWidth: 340, boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Delete this post?</div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 16 }}>This can't be undone.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onCancel} style={{ padding: '8px 14px', background: '#F0F4FA', color: NAVY, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => onConfirm(post)} style={{ padding: '8px 14px', background: RED, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          </div>
        </div>
      </div>
    )
  }
}
