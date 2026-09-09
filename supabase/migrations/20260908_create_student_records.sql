-- Student Records module: one row per (student_id, record_type).
-- 4 record types are admin-uploaded PDFs; 2 (course_confirmation, weekly_schedule)
-- are reserved for SIS-generated documents. Safe to run multiple times.

create extension if not exists "uuid-ossp";

create table if not exists student_records (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  record_type   text not null check (record_type in (
                  'course_confirmation', 'weekly_schedule',
                  'math_diagnostic', 'ela_diagnostic', 'reading_diagnostic', 'psychometric'
                )),
  source        text not null default 'upload' check (source in ('upload', 'generated')),
  status        text not null default 'pending' check (status in ('pending', 'available', 'coming_soon')),
  storage_path  text,
  file_name     text,
  file_size     bigint,
  mime_type     text default 'application/pdf',
  uploaded_by   uuid references profiles(id) default auth.uid(),
  uploaded_at   timestamptz,
  generated_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (student_id, record_type)
);

create index if not exists student_records_student_idx on student_records(student_id);

alter table student_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_records' and policyname = 'student_records_staff_read'
  ) then
    create policy "student_records_staff_read"
      on student_records
      for select
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_records' and policyname = 'student_records_staff_write'
  ) then
    create policy "student_records_staff_write"
      on student_records
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  -- Parents (real Supabase-auth users) may read their own children's records.
  -- parent_students lives only in the live DB, so guard on its existence.
  if to_regclass('public.parent_students') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'student_records' and policyname = 'student_records_parent_read'
     ) then
    create policy "student_records_parent_read"
      on student_records
      for select
      to authenticated
      using (exists (
        select 1 from parent_students ps
        where ps.student_id = student_records.student_id
          and ps.parent_id = auth.uid()
      ));
  end if;
end
$$;
