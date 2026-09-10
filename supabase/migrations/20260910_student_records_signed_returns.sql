-- Student Records: signed-return flow for the generated Course Confirmation and
-- Weekly Schedule documents. Student/parent download the generated doc, upload a
-- signed copy (public `uploads` bucket, URL stored here), then an admin approves
-- or rejects it. Applies to course_confirmation / weekly_schedule only (enforced
-- in app logic). Safe to re-run.

alter table student_records add column if not exists signed_file_url     text;
alter table student_records add column if not exists signed_file_name    text;
alter table student_records add column if not exists signed_submitted_at timestamptz;
alter table student_records add column if not exists signed_status       text;
alter table student_records add column if not exists signed_review_note  text;
alter table student_records add column if not exists signed_reviewed_by  uuid references profiles(id);
alter table student_records add column if not exists signed_reviewed_at  timestamptz;

alter table student_records drop constraint if exists student_records_signed_status_check;
alter table student_records add constraint student_records_signed_status_check
  check (signed_status is null or signed_status in ('submitted', 'approved', 'rejected'));
