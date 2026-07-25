import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'
import { checkSimilarity } from './_similarity.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const { editPostId, lessonComponentId, body, parentPostId, referencesStudentId, pasteEventDetected } = req.body || {}

  if (typeof body !== 'string' || !body.trim()) {
    return json(res, 400, { error: 'Post body is required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ─── Edit an existing post ────────────────────────────────────────────────
  if (typeof editPostId === 'string' && editPostId) {
    const { data: existing, error: existingError } = await adminClient
      .from('mhs_discussion_posts')
      .select('id,body,edit_history,student_id')
      .eq('id', editPostId)
      .eq('student_id', studentDbId)
      .single()
    if (existingError || !existing) return json(res, 404, { error: 'Post not found for this student.' })

    const wordCount = countWords(body)
    const newHistory = [...(existing.edit_history ?? []), { body: existing.body, editedAt: new Date().toISOString() }]

    const { error: updateError } = await adminClient
      .from('mhs_discussion_posts')
      .update({ body: body.trim(), word_count: wordCount, edited_after_submission: true, edit_history: newHistory, updated_at: new Date().toISOString() })
      .eq('id', editPostId)
    if (updateError) return json(res, 500, { error: 'Failed to save edit.' })

    return json(res, 200, { postId: editPostId, wordCount, edited: true })
  }

  // ─── New post or reply ────────────────────────────────────────────────────
  if (typeof lessonComponentId !== 'string' || !lessonComponentId) {
    return json(res, 400, { error: 'lessonComponentId is required.' })
  }

  const { data: component, error: componentError } = await adminClient
    .from('mhs_lesson_components')
    .select('id,lesson_id,mhs_lessons(min_discussion_words)')
    .eq('id', lessonComponentId)
    .eq('student_id', studentDbId)
    .eq('component_type', 'discussion')
    .single()
  if (componentError || !component) return json(res, 404, { error: 'Discussion component not found for this student.' })

  const minWords = component.mhs_lessons?.min_discussion_words ?? 150
  const wordCount = countWords(body)
  if (wordCount < minWords) {
    return json(res, 400, { error: `This post needs at least ${minWords} words (currently ${wordCount}).` })
  }

  if (parentPostId && (typeof referencesStudentId !== 'string' || !referencesStudentId)) {
    return json(res, 400, { error: 'A reply must reference a specific classmate’s point.' })
  }

  const { data: config } = await adminClient.from('mhs_config').select('discussion_similarity_threshold_pct').single()
  const { similarityScore, similarityFlag } = await checkSimilarity(adminClient, {
    lessonId: component.lesson_id,
    studentId: studentDbId,
    body: body.trim(),
    thresholdPct: config?.discussion_similarity_threshold_pct ?? 60,
  })

  const { data: post, error: insertError } = await adminClient
    .from('mhs_discussion_posts')
    .insert({
      lesson_component_id: lessonComponentId,
      student_id: studentDbId,
      parent_post_id: parentPostId || null,
      body: body.trim(),
      word_count: wordCount,
      references_student_id: referencesStudentId || null,
      paste_event_detected: Boolean(pasteEventDetected),
      similarity_score: similarityScore,
      similarity_flag: similarityFlag,
    })
    .select('id')
    .single()
  if (insertError || !post) return json(res, 500, { error: 'Failed to submit post.' })

  await adminClient
    .from('mhs_lesson_components')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lessonComponentId)

  // Paste/similarity flags are never surfaced to the student — flag, not auto-fail,
  // and reviewed only by the teacher via the moderation panel.
  return json(res, 200, { postId: post.id, wordCount })
}
