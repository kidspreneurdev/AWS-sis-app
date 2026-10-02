-- Mark done — students tick off a lesson's Video row (Do It) or a module's Master It
-- presentation (e.g. presented live in class) without uploading anything. Each tick is
-- an lms_submissions row with kind 'video_done' / 'presentation_done' and no link_url;
-- un-ticking deletes it. One row per student per content per kind.
-- Run BEFORE deploying the matching app code. Safe to run multiple times.

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
  check (kind in ('presentation', 'case_study_notes', 'lesson_notes', 'mastery_quiz', 'omr_quiz', 'midterm_review', 'video_done', 'presentation_done'));
