-- Policy Documents module: admin requests that a student read, sign and return
-- each of the 5 school policy PDFs (public/Policy/*). One row per
-- (student_id, policy_key), created when the admin sends the request. The student
-- uploads a signed copy (uploads bucket), then the admin approves or rejects it.
-- Admin ticks/reviews; student & parent portals read. Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists student_policy_documents (
  id               uuid primary key default uuid_generate_v4(),
  student_id       uuid not null references students(id) on delete cascade,
  policy_key       text not null check (policy_key in (
                     'academic_integrity', 'graduation_requirements', 'repeated_courses',
                     'student_attendance', 'transcript_revision'
                   )),
  status           text not null default 'requested' check (status in (
                     'requested', 'submitted', 'approved', 'rejected'
                   )),
  requested_by     uuid references profiles(id) default auth.uid(),
  requested_at     timestamptz default now(),
  signed_file_url  text,
  signed_file_name text,
  submitted_at     timestamptz,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (student_id, policy_key)
);

create index if not exists student_policy_documents_student_idx on student_policy_documents(student_id);

alter table student_policy_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_policy_documents' and policyname = 'student_policy_documents_staff_read'
  ) then
    create policy "student_policy_documents_staff_read"
      on student_policy_documents
      for select
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_policy_documents' and policyname = 'student_policy_documents_staff_write'
  ) then
    create policy "student_policy_documents_staff_write"
      on student_policy_documents
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  -- Parents (real Supabase-auth users) may read their own children's rows.
  if to_regclass('public.parent_students') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'student_policy_documents' and policyname = 'student_policy_documents_parent_read'
     ) then
    create policy "student_policy_documents_parent_read"
      on student_policy_documents
      for select
      to authenticated
      using (exists (
        select 1 from parent_students ps
        where ps.student_id = student_policy_documents.student_id
          and ps.parent_id = auth.uid()
      ));
  end if;
end
$$;
