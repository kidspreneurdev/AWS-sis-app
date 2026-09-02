-- Student Notes: faculty notes on a specific student within an LMS section, visible to all staff/teachers.
-- Safe to run multiple times.

create extension if not exists "uuid-ossp";

create table if not exists lms_student_notes (
  id          uuid primary key default uuid_generate_v4(),
  section_id  text not null references lms_courses(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  author_name text,
  body        text not null,
  created_at  timestamptz default now()
);

create index if not exists lms_student_notes_section_idx on lms_student_notes(section_id);
create index if not exists lms_student_notes_student_idx on lms_student_notes(student_id);

alter table lms_student_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lms_student_notes' and policyname = 'lms_student_notes_read'
  ) then
    create policy "lms_student_notes_read" on lms_student_notes for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lms_student_notes' and policyname = 'lms_student_notes_write'
  ) then
    create policy "lms_student_notes_write" on lms_student_notes for all to authenticated
      using (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'));
  end if;
end
$$;
