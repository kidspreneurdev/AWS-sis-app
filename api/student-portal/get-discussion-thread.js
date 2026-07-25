import { createClient } from '@supabase/supabase-js'
import { requireStudentToken } from './_token.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(body))
}

/** Returns the full cross-student thread for a lesson's discussion board, plus
 *  this student's own component id (created on first visit, mirroring
 *  get-quiz.js). Moderation-only fields (paste flag, similarity, edit history)
 *  are never sent to students — only to teachers, via direct RLS reads. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return json(res, 405, { error: 'Method not allowed' })
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return json(res, 500, { error: 'Server-side Supabase configuration is incomplete.' })
  }

  const studentDbId = requireStudentToken(req, res, json)
  if (!studentDbId) return

  const lessonId = req.query?.lessonId
  if (typeof lessonId !== 'string' || !lessonId) {
    return json(res, 400, { error: 'lessonId is required.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: lesson, error: lessonError } = await adminClient
    .from('mhs_lessons')
    .select('id,title,min_discussion_words,discussion_due_at')
    .eq('id', lessonId)
    .single()
  if (lessonError || !lesson) return json(res, 404, { error: 'Lesson not found.' })

  let { data: myComponent } = await adminClient
    .from('mhs_lesson_components')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('student_id', studentDbId)
    .eq('component_type', 'discussion')
    .maybeSingle()

  if (!myComponent) {
    const { data: created, error: createError } = await adminClient
      .from('mhs_lesson_components')
      .insert({ lesson_id: lessonId, student_id: studentDbId, component_type: 'discussion', status: 'not_started' })
      .select('id')
      .single()
    if (createError || !created) return json(res, 500, { error: 'Unable to initialize discussion component.' })
    myComponent = created
  }

  const { data: allComponents } = await adminClient
    .from('mhs_lesson_components')
    .select('id,student_id')
    .eq('lesson_id', lessonId)
    .eq('component_type', 'discussion')

  const componentIds = (allComponents ?? []).map((c) => c.id)

  const { data: posts } = await adminClient
    .from('mhs_discussion_posts')
    .select('id,lesson_component_id,student_id,parent_post_id,body,word_count,references_student_id,edited_after_submission,submitted_at')
    .in('lesson_component_id', componentIds.length ? componentIds : ['00000000-0000-0000-0000-000000000000'])
    .order('submitted_at', { ascending: true })

  const studentIds = [...new Set((posts ?? []).map((p) => p.student_id).concat((posts ?? []).map((p) => p.references_student_id).filter(Boolean)))]
  const { data: studentRows } = studentIds.length
    ? await adminClient.from('students').select('id,first_name,last_name').in('id', studentIds)
    : { data: [] }
  const nameOf = (id) => {
    const s = studentRows?.find((r) => r.id === id)
    return s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() : 'Classmate'
  }

  const threadPosts = (posts ?? []).map((p) => ({
    id: p.id,
    studentId: p.student_id,
    authorName: p.student_id === studentDbId ? 'You' : nameOf(p.student_id),
    isMine: p.student_id === studentDbId,
    body: p.body,
    wordCount: p.word_count,
    parentPostId: p.parent_post_id,
    referencesStudentName: p.references_student_id ? nameOf(p.references_student_id) : null,
    editedAfterSubmission: p.edited_after_submission,
    submittedAt: p.submitted_at,
  }))

  return json(res, 200, {
    lesson: { id: lesson.id, title: lesson.title, minWords: lesson.min_discussion_words, dueAt: lesson.discussion_due_at },
    myComponentId: myComponent.id,
    classmates: (allComponents ?? [])
      .filter((c) => c.student_id !== studentDbId)
      .map((c) => ({ studentId: c.student_id, name: nameOf(c.student_id) })),
    posts: threadPosts,
  })
}
