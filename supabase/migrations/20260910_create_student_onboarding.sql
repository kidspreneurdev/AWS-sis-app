-- Onboarding module: tracks a student's progress through the printed
-- "Student Enrollment Checklist" (Section A = 17 steps, Section B = 5 transfer
-- steps). One row per (student_id, step_key). A companion meta table holds the
-- per-student "transferring credits" toggle that reveals Section B.
-- Admin ticks steps off; student & parent portals read them. Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists student_onboarding (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  step_key      text not null check (step_key in (
                  'A1','A2','A3','A4','A5','A6','A7','A8','A9','A10',
                  'A11','A12','A13','A14','A15','A16','A17',
                  'B1','B2','B3','B4','B5'
                )),
  completed     boolean not null default false,
  note          text,
  completed_by  uuid references profiles(id) default auth.uid(),
  completed_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (student_id, step_key)
);

create index if not exists student_onboarding_student_idx on student_onboarding(student_id);

create table if not exists student_onboarding_meta (
  student_id           uuid primary key references students(id) on delete cascade,
  transferring_credits boolean not null default false,
  updated_by           uuid references profiles(id) default auth.uid(),
  updated_at           timestamptz default now()
);

alter table student_onboarding enable row level security;
alter table student_onboarding_meta enable row level security;

do $$
begin
  -- ─── student_onboarding ─────────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_onboarding' and policyname = 'student_onboarding_staff_read'
  ) then
    create policy "student_onboarding_staff_read"
      on student_onboarding
      for select
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_onboarding' and policyname = 'student_onboarding_staff_write'
  ) then
    create policy "student_onboarding_staff_write"
      on student_onboarding
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if to_regclass('public.parent_students') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'student_onboarding' and policyname = 'student_onboarding_parent_read'
     ) then
    create policy "student_onboarding_parent_read"
      on student_onboarding
      for select
      to authenticated
      using (exists (
        select 1 from parent_students ps
        where ps.student_id = student_onboarding.student_id
          and ps.parent_id = auth.uid()
      ));
  end if;

  -- ─── student_onboarding_meta ────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_onboarding_meta' and policyname = 'student_onboarding_meta_staff_read'
  ) then
    create policy "student_onboarding_meta_staff_read"
      on student_onboarding_meta
      for select
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'student_onboarding_meta' and policyname = 'student_onboarding_meta_staff_write'
  ) then
    create policy "student_onboarding_meta_staff_write"
      on student_onboarding_meta
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if to_regclass('public.parent_students') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'student_onboarding_meta' and policyname = 'student_onboarding_meta_parent_read'
     ) then
    create policy "student_onboarding_meta_parent_read"
      on student_onboarding_meta
      for select
      to authenticated
      using (exists (
        select 1 from parent_students ps
        where ps.student_id = student_onboarding_meta.student_id
          and ps.parent_id = auth.uid()
      ));
  end if;
end
$$;
