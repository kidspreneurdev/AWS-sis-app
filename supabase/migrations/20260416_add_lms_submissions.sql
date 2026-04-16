-- Add LMS submissions table for assignment payloads and mastery answer snapshots
-- Safe to run multiple times.

create extension if not exists "uuid-ossp";

create table if not exists lms_submissions (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  course_id     text not null references lms_courses(id) on delete cascade,
  content_id    text not null references lms_content(id) on delete cascade,
  note          text,
  link_url      text,
  submitted_at  timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists lms_submissions_student_idx on lms_submissions(student_id);
create index if not exists lms_submissions_course_idx on lms_submissions(course_id);
create index if not exists lms_submissions_content_idx on lms_submissions(content_id);
create index if not exists lms_submissions_submitted_at_idx on lms_submissions(submitted_at desc);

alter table lms_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lms_submissions'
      and policyname = 'lms_submissions_read'
  ) then
    create policy "lms_submissions_read"
      on lms_submissions
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lms_submissions'
      and policyname = 'lms_submissions_write'
  ) then
    create policy "lms_submissions_write"
      on lms_submissions
      for all
      to authenticated
      using (get_my_role() in ('admin', 'teacher', 'counselor'));
  end if;
end
$$;
