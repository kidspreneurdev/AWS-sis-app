-- Academic Calendar module: the school's annual academic calendar PDF.
-- Admin uploads one PDF per academic year (stored in the public `uploads` bucket);
-- the most recent row flagged `is_current` is what the student & parent portals
-- preview and download. History rows are kept so an admin can roll back.
-- Student/parent portals use the Supabase anon key, so read is open to everyone.
-- Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists academic_calendars (
  id            uuid primary key default uuid_generate_v4(),
  academic_year text not null,
  file_url      text not null,
  file_name     text,
  file_size     bigint,
  is_current    boolean not null default true,
  uploaded_by   uuid references profiles(id) default auth.uid(),
  uploaded_at   timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists academic_calendars_current_idx
  on academic_calendars (is_current, uploaded_at desc);

alter table academic_calendars enable row level security;

do $$
begin
  -- Anyone (incl. the anon key used by the student/parent portals) may read.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'academic_calendars' and policyname = 'academic_calendars_public_read'
  ) then
    create policy "academic_calendars_public_read"
      on academic_calendars
      for select
      using (true);
  end if;

  -- Only staff may add / update / remove calendars.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'academic_calendars' and policyname = 'academic_calendars_staff_write'
  ) then
    create policy "academic_calendars_staff_write"
      on academic_calendars
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;
end
$$;

-- Seed the 2026-27 family calendar that ships in public/ so the portals have
-- something to show before an admin uploads a fresh copy.
insert into academic_calendars (academic_year, file_url, file_name, is_current)
select '2026-27', '/AWS_Family_Calendar_2026-27.pdf', 'AWS_Family_Calendar_2026-27.pdf', true
where not exists (select 1 from academic_calendars);
