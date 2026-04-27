-- ============================================================
-- AWS SIS — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Enums ──────────────────────────────────────────────────
create type student_status as enum (
  'Applied', 'Under Review', 'Accepted', 'Denied',
  'Waitlisted', 'Inquiry', 'Enrolled', 'Alumni', 'Withdrawn'
);

create type attendance_status as enum ('Present', 'Absent', 'Late', 'Excused');

create type user_role as enum ('admin', 'staff', 'teacher', 'principal', 'partner', 'coach', 'viewer', 'counselor', 'readonly');

create type course_type as enum ('STD', 'HON', 'AP', 'IB', 'DE', 'EC', 'CR');

create type tpms_type as enum ('lesson', 'unit', 'event', 'pd');

create type ecde_type as enum ('EC', 'DE');

-- ─── Profiles (extends Supabase auth.users) ─────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        user_role not null default 'readonly',
  campus      text,
  active      boolean not null default true,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on user sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Settings ───────────────────────────────────────────────
create table settings (
  id                   uuid primary key default uuid_generate_v4(),
  academic_year        text not null default '2024-2025',
  campuses             text[] default '{}',
  cohorts              text[] default '{}',
  grading_scale        jsonb default '{"A":4.0,"B":3.0,"C":2.0,"D":1.0,"F":0}',
  graduation_credits   integer default 24,
  associate_degree_credits_required integer default 60,
  email_notifications  boolean default false,
  updated_at           timestamptz default now()
);

-- Seed default settings row
insert into settings (academic_year) values ('2024-2025');

-- ─── Students ───────────────────────────────────────────────
create table students (
  id                 uuid primary key default uuid_generate_v4(),
  student_id         text unique not null,
  first_name         text not null,
  last_name          text not null,
  email              text,
  phone              text,
  date_of_birth      date,
  nationality        text,
  grade              integer,
  cohort             text,
  campus             text,
  status             student_status not null default 'Inquiry',
  enroll_date        date,
  application_date   date,
  year_joined        text,
  year_graduated     text,
  grade_when_joined  integer,
  parent             text,
  iep                boolean default false,
  support_needs      text,
  priority           text,
  notes              text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index on students(status);
create index on students(campus);
create index on students(cohort);

-- ─── Course Catalog ─────────────────────────────────────────
create table catalog (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,
  title       text not null,
  type        course_type not null default 'STD',
  area        text not null,
  credits     numeric(4,2) not null default 1.0,
  description text
);

-- ─── Graduation Audit Config ────────────────────────────────
create table graduation_requirements (
  id               uuid primary key default uuid_generate_v4(),
  key              text unique not null,
  label            text not null,
  area             text not null,
  required_credits numeric(4,2) not null,
  icon             text,
  mandatory_note   text,
  sort_order       integer not null default 0
);

create table graduation_requirement_courses (
  id             uuid primary key default uuid_generate_v4(),
  requirement_id uuid not null references graduation_requirements(id) on delete cascade,
  course_title   text not null,
  sort_order     integer not null default 0
);

create table graduation_distinctions (
  id                    uuid primary key default uuid_generate_v4(),
  label                 text not null,
  icon                  text,
  color                 text,
  weighted_gpa_required numeric(4,2) not null,
  sort_order            integer not null default 0
);

-- ─── Student Courses ────────────────────────────────────────
create table courses (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  catalog_code  text references catalog(code),
  title         text not null,
  type          course_type not null default 'STD',
  area          text not null,
  credits       numeric(4,2) not null default 1.0,
  grade_letter  text,
  grade_percent numeric(5,2),
  ap_score      integer check (ap_score between 1 and 5),
  ib_score      numeric(4,1) check (ib_score between 1 and 7),
  term          text,
  academic_year text not null,
  created_at    timestamptz default now()
);

create index on courses(student_id);
create index on courses(academic_year);

-- ─── Attendance ─────────────────────────────────────────────
create table attendance (
  id           uuid primary key default uuid_generate_v4(),
  student_id   uuid not null references students(id) on delete cascade,
  date         date not null,
  status       attendance_status not null,
  note         text,
  recorded_by  uuid references profiles(id),
  created_at   timestamptz default now(),
  unique(student_id, date)
);

create index on attendance(date);
create index on attendance(student_id);

-- ─── Interviews ─────────────────────────────────────────────
create table interviews (
  id           uuid primary key default uuid_generate_v4(),
  student_id   uuid not null references students(id) on delete cascade,
  date         date not null,
  time         text,
  score        integer check (score between 1 and 10),
  notes        text,
  interviewer  text,
  outcome      text,
  created_at   timestamptz default now()
);

create index on interviews(student_id);

-- ─── Fees ───────────────────────────────────────────────────
create table fees (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  type        text not null,
  amount      numeric(10,2) not null,
  currency    text not null default 'USD',
  paid        boolean default false,
  paid_date   date,
  note        text,
  created_at  timestamptz default now()
);

create index on fees(student_id);

-- ─── Communications ─────────────────────────────────────────
create table communications (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  date          date not null,
  type          text not null,
  outcome       text,
  notes         text,
  staff_member  text,
  created_at    timestamptz default now()
);

create index on communications(student_id);

-- ─── Staff ──────────────────────────────────────────────────
create table staff (
  id          uuid primary key default uuid_generate_v4(),
  first_name  text not null,
  last_name   text not null,
  email       text unique not null,
  role        text not null,
  department  text,
  campus      text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ─── Calendar Events ────────────────────────────────────────
create table calendar (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  date         date not null,
  end_date     date,
  type         text not null,
  description  text,
  campus       text,
  created_at   timestamptz default now()
);

create index on calendar(date);

-- ─── Health Records ─────────────────────────────────────────
create table health_records (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null unique references students(id) on delete cascade,
  allergies       text,
  medications     text,
  conditions      text,
  immunizations   text,
  notes           text,
  updated_at      timestamptz default now()
);

-- ─── Behaviour Log ──────────────────────────────────────────
create table behaviour_log (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  date          date not null,
  type          text not null,
  description   text,
  action_taken  text,
  staff_member  text,
  created_at    timestamptz default now()
);

create index on behaviour_log(student_id);

-- ─── Remarks ────────────────────────────────────────────────
create table remarks (
  id             uuid primary key default uuid_generate_v4(),
  student_id     uuid not null references students(id) on delete cascade,
  term           text not null,
  academic_year  text not null,
  content        text not null,
  author         text,
  created_at     timestamptz default now()
);

create index on remarks(student_id);

-- ─── Transfer Credits ───────────────────────────────────────
create table transfer_credits (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  institution   text not null,
  course_title  text not null,
  credits       numeric(4,2) not null,
  grade_letter  text,
  year          text,
  created_at    timestamptz default now()
);

create index on transfer_credits(student_id);

-- ─── EC/DE Credits ──────────────────────────────────────────
create table ec_de_credits (
  id               uuid primary key default uuid_generate_v4(),
  student_id       uuid not null references students(id) on delete cascade,
  type             ecde_type not null,
  institution      text not null,
  course_title     text not null,
  college_credits  numeric(4,2) not null,
  hs_credits       numeric(4,2) not null,
  grade_letter     text,
  academic_year    text not null,
  created_at       timestamptz default now()
);

create index on ec_de_credits(student_id);

-- ─── TPMS ───────────────────────────────────────────────────
create table tpms (
  id         uuid primary key default uuid_generate_v4(),
  type       tpms_type not null,
  title      text not null,
  staff_id   uuid references profiles(id),
  date       date,
  content    text,
  status     text,
  created_at timestamptz default now()
);

-- ─── Assignment Tracker ─────────────────────────────────────
create table at_assignments (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  cohort         text,
  subject        text,
  due_date       date,
  max_score      integer,
  academic_year  text not null,
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

-- ─── Projects ───────────────────────────────────────────────
create table pt_projects (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  student_id  uuid references students(id) on delete set null,
  cohort      text,
  due_date    date,
  status      text,
  score       numeric(5,2),
  feedback    text,
  created_at  timestamptz default now()
);

create index on pt_projects(student_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
alter table profiles         enable row level security;
alter table settings         enable row level security;
alter table students         enable row level security;
alter table catalog          enable row level security;
alter table courses          enable row level security;
alter table attendance       enable row level security;
alter table interviews       enable row level security;
alter table fees             enable row level security;
alter table communications   enable row level security;
alter table staff            enable row level security;
alter table calendar         enable row level security;
alter table health_records   enable row level security;
alter table behaviour_log    enable row level security;
alter table remarks          enable row level security;
alter table transfer_credits enable row level security;
alter table ec_de_credits    enable row level security;
alter table tpms             enable row level security;
alter table at_assignments   enable row level security;
alter table pt_projects      enable row level security;

-- Helper: get current user role
create or replace function get_my_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Profiles: users can read all, update own
create policy "profiles_read_all" on profiles for select to authenticated using (true);
create policy "profiles_update_own" on profiles for update to authenticated using (id = auth.uid());

-- Settings: all authenticated can read; only admin can modify
create policy "settings_read" on settings for select to authenticated using (true);
create policy "settings_write" on settings for all to authenticated using (get_my_role() = 'admin');

-- Students: all authenticated can read; admin/counselor can write
create policy "students_read" on students for select to authenticated using (true);
create policy "students_write" on students for all to authenticated
  using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
  with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));

-- Catalog: all read; admin can write
create policy "catalog_read" on catalog for select to authenticated using (true);
create policy "catalog_write" on catalog for all to authenticated using (get_my_role() = 'admin');

-- All other tables: all authenticated can read; admin/counselor/teacher/staff can write
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'courses','attendance','interviews','fees','communications',
    'staff','calendar','health_records','behaviour_log','remarks',
    'transfer_credits','ec_de_credits','tpms','at_assignments','pt_projects'
  ] loop
    execute format('create policy "%s_read" on %s for select to authenticated using (true)', tbl, tbl);
    execute format('create policy "%s_write" on %s for all to authenticated using (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal'')) with check (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal''))', tbl, tbl);
  end loop;
end $$;
