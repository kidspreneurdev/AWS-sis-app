-- New Section creation flow: per-section settings shown on the "Enter Section Details" screen.
-- Safe to run multiple times.

alter table lms_courses add column if not exists pre_test_exemption_threshold integer default 80;
alter table lms_courses add column if not exists mastery_retakes text default 'unlimited';
alter table lms_courses add column if not exists progression_mode text default 'open';
alter table lms_courses add column if not exists self_enroll_enabled boolean default false;
alter table lms_courses add column if not exists self_enroll_code text;
alter table lms_courses add column if not exists self_enroll_password text;
alter table lms_courses add column if not exists student_instructions text;
alter table lms_courses add column if not exists instructor_ids uuid[] default '{}';
