// MVP lexical similarity check for Discussion Board posts (spec section 7):
// "cross-student and year-over-year similarity check (catches shared/reused
// answers, not just AI paste)". This is a shingled Jaccard comparison — a
// deliberately simple, honest heuristic, not a paraphrase/LLM-rewrite-proof
// detector. If stronger detection is wanted later, swap the body of
// scorePairSimilarity() — callers only need a 0-100 similarity number back.

const SHINGLE_SIZE = 5

function shingles(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  const set = new Set()
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) {
    set.add(words.slice(i, i + SHINGLE_SIZE).join(' '))
  }
  return set
}

function scorePairSimilarity(a, b) {
  const setA = shingles(a)
  const setB = shingles(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const s of setA) if (setB.has(s)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : (intersection / union) * 100
}

/**
 * Compares a new post's body against every other student's post on the same
 * lesson AND on any prior/future-year sibling lesson (same title, same
 * catalog course, different mhs_course_id) — one query covers both spec
 * requirements ("cross-student and year-over-year") since siblings include
 * every academic year, not just the current one.
 */
export async function checkSimilarity(adminClient, { lessonId, studentId, body, thresholdPct }) {
  const { data: lesson } = await adminClient.from('mhs_lessons').select('id,title,mhs_course_id').eq('id', lessonId).single()
  if (!lesson) return { similarityScore: 0, similarityFlag: false }

  const { data: course } = await adminClient.from('mhs_courses').select('catalog_code').eq('id', lesson.mhs_course_id).single()

  let siblingLessonIds = [lessonId]
  if (course?.catalog_code) {
    const { data: siblingCourses } = await adminClient.from('mhs_courses').select('id').eq('catalog_code', course.catalog_code)
    const siblingCourseIds = (siblingCourses ?? []).map((c) => c.id)
    if (siblingCourseIds.length > 0) {
      const { data: siblingLessons } = await adminClient
        .from('mhs_lessons')
        .select('id')
        .eq('title', lesson.title)
        .in('mhs_course_id', siblingCourseIds)
      if (siblingLessons?.length) siblingLessonIds = siblingLessons.map((l) => l.id)
    }
  }

  const { data: siblingComponents } = await adminClient
    .from('mhs_lesson_components')
    .select('id,student_id')
    .in('lesson_id', siblingLessonIds)
    .eq('component_type', 'discussion')

  const componentIds = (siblingComponents ?? []).filter((c) => c.student_id !== studentId).map((c) => c.id)
  if (componentIds.length === 0) return { similarityScore: 0, similarityFlag: false }

  const { data: candidatePosts } = await adminClient.from('mhs_discussion_posts').select('body').in('lesson_component_id', componentIds)

  let maxScore = 0
  for (const p of candidatePosts ?? []) {
    const score = scorePairSimilarity(body, p.body)
    if (score > maxScore) maxScore = score
  }

  const similarityScore = Math.round(maxScore * 100) / 100
  return { similarityScore, similarityFlag: similarityScore >= thresholdPct }
}
