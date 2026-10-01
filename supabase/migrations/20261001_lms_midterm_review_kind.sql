-- Midterm Review — students submit each block (Text Box / OMR Test / File Upload) of an
-- admin-built Midterm Review as its own lms_submissions row, kind 'midterm_review'.
-- `note` holds JSON with the blockId plus the response (text, or OMR score/answers);
-- `link_url` holds the uploaded file for File Upload blocks. One row per attempt.
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
  check (kind in ('presentation', 'case_study_notes', 'lesson_notes', 'mastery_quiz', 'omr_quiz', 'midterm_review'));
