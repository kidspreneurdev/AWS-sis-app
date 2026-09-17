-- Learn it / Show it (Notes) / Master it restructure: lms_submissions needs to tell
-- Presentation Upload apart from the new Case-Study Notes and per-Lesson Notes uploads.
-- Previously this was inferred by JSON-sniffing `note` for a mastery-quiz snapshot tag
-- (see isLmsPresentationRow / isPresentationSubmission) — replaced going forward by an
-- explicit `kind` column. Existing rows default to 'presentation' and are left as-is;
-- the app-side helpers keep the old JSON-sniff as a fallback for those legacy rows.
-- Safe to run multiple times.

alter table lms_submissions add column if not exists kind text not null default 'presentation'
  check (kind in ('presentation', 'case_study_notes', 'lesson_notes', 'mastery_quiz'));

create index if not exists lms_submissions_kind_idx on lms_submissions(kind);
