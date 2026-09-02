-- Groups multiple lms_courses rows ("Sections") under a shared parent "Course" label
-- for the Manage Courses page. Existing lms_courses rows keep working exactly as
-- before (own content, enrolments, gradebook, progress) — group_id is purely a
-- nullable label; ungrouped courses render as their own standalone Course with 1 Section.
-- Safe to run multiple times.

create extension if not exists "uuid-ossp";

create table if not exists lms_course_groups (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  created_at timestamptz default now()
);

alter table lms_courses add column if not exists group_id uuid references lms_course_groups(id) on delete set null;
create index if not exists lms_courses_group_idx on lms_courses(group_id);

-- Section offering window, shown on the Manage Courses page (independent of per-student enrolment pacing)
alter table lms_courses add column if not exists start_date date;
alter table lms_courses add column if not exists end_date date;

alter table lms_course_groups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lms_course_groups'
      and policyname = 'lms_course_groups_read'
  ) then
    create policy "lms_course_groups_read"
      on lms_course_groups
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lms_course_groups'
      and policyname = 'lms_course_groups_write'
  ) then
    create policy "lms_course_groups_write"
      on lms_course_groups
      for all
      to authenticated
      using (get_my_role() in ('admin', 'teacher', 'counselor'));
  end if;
end
$$;
