-- Student Records: JSON payload for SIS-generated documents (course confirmation,
-- weekly schedule). Upload-type records leave this null. Safe to re-run.

alter table student_records add column if not exists data jsonb;
