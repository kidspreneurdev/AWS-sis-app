import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2', boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 16 }

interface EditHistoryEntry { body: string; editedAt: string }
interface FlaggedPost {
  id: string
  studentName: string
  body: string
  pasteEventDetected: boolean
  similarityScore: number | null
  similarityFlag: boolean
  editedAfterSubmission: boolean
  editHistory: EditHistoryEntry[]
  submittedAt: string
}

interface MHSDiscussionModerationPanelProps {
  lessonId: string
}

/** Teacher-facing flags queue for one lesson's discussion board — paste events,
 *  cross-student/year-over-year similarity, and edited-after-submission are
 *  surfaced for review, never auto-failed (spec section 7). */
export function MHSDiscussionModerationPanel({ lessonId }: MHSDiscussionModerationPanelProps) {
  const [posts, setPosts] = useState<FlaggedPost[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: components } = await supabase
      .from('mhs_lesson_components')
      .select('id,student_id')
      .eq('lesson_id', lessonId)
      .eq('component_type', 'discussion')
    const componentIds = (components ?? []).map((c) => c.id)
    if (componentIds.length === 0) {
      setPosts([])
      return
    }

    const { data: rows } = await supabase
      .from('mhs_discussion_posts')
      .select('id,student_id,body,paste_event_detected,similarity_score,similarity_flag,edited_after_submission,edit_history,submitted_at')
      .in('lesson_component_id', componentIds)
      .or('paste_event_detected.eq.true,similarity_flag.eq.true,edited_after_submission.eq.true')
      .order('submitted_at', { ascending: false })

    const studentIds = [...new Set((rows ?? []).map((r) => r.student_id))]
    const { data: students } = studentIds.length
      ? await supabase.from('students').select('id,first_name,last_name').in('id', studentIds)
      : { data: [] }

    setPosts(
      (rows ?? []).map((r) => {
        const s = students?.find((x) => x.id === r.student_id)
        return {
          id: r.id,
          studentName: s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : '(unknown student)',
          body: r.body,
          pasteEventDetected: r.paste_event_detected,
          similarityScore: r.similarity_score,
          similarityFlag: r.similarity_flag,
          editedAfterSubmission: r.edited_after_submission,
          editHistory: (r.edit_history as EditHistoryEntry[]) ?? [],
          submittedAt: r.submitted_at,
        }
      })
    )
  }, [lessonId])

  useEffect(() => { void load() }, [load])

  if (posts.length === 0) {
    return <div style={{ ...card, padding: 20, textAlign: 'center', color: '#7A92B0', fontSize: 12 }}>No flagged posts for this lesson.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {posts.map((p) => (
        <div key={p.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>{p.studentName}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {p.pasteEventDetected && <span style={{ fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6 }}>PASTE EVENT</span>}
              {p.similarityFlag && <span style={{ fontSize: 9, fontWeight: 800, background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 6 }}>SIMILARITY {p.similarityScore}%</span>}
              {p.editedAfterSubmission && <span style={{ fontSize: 9, fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: 6 }}>EDITED</span>}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#3D5475', marginTop: 8, whiteSpace: 'pre-wrap' }}>{p.body}</div>
          {p.editHistory.length > 0 && (
            <button
              onClick={() => setExpandedId((v) => (v === p.id ? null : p.id))}
              style={{ marginTop: 8, background: 'none', border: 'none', color: '#0369A1', fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              {expandedId === p.id ? 'Hide revision history' : `View revision history (${p.editHistory.length})`}
            </button>
          )}
          {expandedId === p.id && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.editHistory.map((h, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#F7F9FC', borderRadius: 8, fontSize: 11 }}>
                  <div style={{ color: '#94A3B8', marginBottom: 4 }}>Prior version — {new Date(h.editedAt).toLocaleString()}</div>
                  <div style={{ color: '#3D5475', whiteSpace: 'pre-wrap' }}>{h.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
