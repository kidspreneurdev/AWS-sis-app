-- Prove It — OMR Test becomes an in-app auto-graded MCQ quiz (like a lesson's Mastery
-- Test) instead of a Google Form link. Each submission is snapshotted in lms_submissions
-- for audit purposes, same as the existing mastery_quiz snapshots — add that kind to the
-- allowed list. The actual score/attempts live in lms_score_components (component_type
-- 'omr'), not lms_submissions — this snapshot is informational only.
-- Safe to run multiple times.

-- Drop whichever check constraint currently governs `kind` (name may vary depending on
-- how it was originally created) rather than guessing its exact name.
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'lms_submissions'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%kind%'
  loop
    execute format('alter table lms_submissions drop constraint %I', con.conname);
  end loop;
end
$$;

alter table lms_submissions add constraint lms_submissions_kind_check
  check (kind in ('presentation', 'case_study_notes', 'lesson_notes', 'mastery_quiz', 'omr_quiz'));
