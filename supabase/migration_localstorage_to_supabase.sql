-- ============================================================
-- Migration: Move localStorage data to Supabase
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

-- ─── 1. Extend courses table (HS Grade Records) ─────────────
alter table courses add column if not exists grade_level      text;
alter table courses add column if not exists credits_attempted numeric(4,2) default 1.0;
alter table courses add column if not exists credits_earned   numeric(4,2) default 1.0;
alter table courses add column if not exists course_status    text default 'In Progress';
alter table courses add column if not exists instructor       text;
alter table courses add column if not exists section          text;
alter table courses add column if not exists notes            text;

-- ─── 2. Extend transfer_credits table ───────────────────────
alter table transfer_credits add column if not exists kind            text default 'TR';
alter table transfer_credits add column if not exists area            text;
alter table transfer_credits add column if not exists source_location text;
alter table transfer_credits add column if not exists accreditation   text;
alter table transfer_credits add column if not exists notes           text;
alter table transfer_credits add column if not exists status          text default 'Pending';
alter table transfer_credits add column if not exists orig_grade      text;

-- Rename institution → source_school if not already done (safe, idempotent approach)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='transfer_credits' and column_name='source_school'
  ) then
    alter table transfer_credits rename column institution to source_school;
  end if;
end $$;

-- Rename course_title → orig_title if not already done
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='transfer_credits' and column_name='orig_title'
  ) then
    alter table transfer_credits rename column course_title to orig_title;
  end if;
end $$;

-- Rename credits → credits_awarded if not already done
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='transfer_credits' and column_name='credits_awarded'
  ) then
    alter table transfer_credits rename column credits to credits_awarded;
  end if;
end $$;

-- ─── 3. Extend catalog table ────────────────────────────────
alter table catalog add column if not exists lab         boolean default false;
alter table catalog add column if not exists grade_level text;

-- ─── 4. HS Skill Scores ─────────────────────────────────────
create table if not exists hs_skill_scores (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  scores     jsonb not null default '{}',
  updated_at timestamptz default now(),
  unique(student_id)
);

alter table hs_skill_scores enable row level security;
create policy "hs_skill_scores_read"  on hs_skill_scores for select to authenticated using (true);
create policy "hs_skill_scores_write" on hs_skill_scores for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));

-- ─── 5. LS Grade Records ────────────────────────────────────
create table if not exists ls_grade_records (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  term          text not null,
  elem_grades   jsonb not null default '{}',
  ms_grades     jsonb not null default '{}',
  narrative     jsonb not null default '{}',
  skill_mastery jsonb not null default '{}',
  updated_at    timestamptz default now(),
  unique(student_id, term)
);

alter table ls_grade_records enable row level security;
create policy "ls_grade_records_read"  on ls_grade_records for select to authenticated using (true);
create policy "ls_grade_records_write" on ls_grade_records for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));

-- ─── 6. LMS Tables ──────────────────────────────────────────
create table if not exists lms_courses (
  id            text primary key,
  title         text not null,
  subject       text,
  grade_level   text,
  description   text,
  pass_mark     integer default 70,
  credit_hours  numeric(4,2) default 1.0,
  required_hours integer,
  status        text default 'Draft',
  announcement  text,
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists lms_content (
  id            text primary key,
  course_id     text not null references lms_courses(id) on delete cascade,
  title         text,
  type          text,
  extra         jsonb default '{}',
  unit_title    text,
  unit_order    integer,
  module_title  text,
  module_order  integer,
  order_idx     integer,
  created_at    timestamptz default now()
);

create table if not exists lms_enrolments (
  id                   text primary key,
  course_id            text not null references lms_courses(id) on delete cascade,
  target_type          text,
  target_value         text,
  assigned_by          text,
  assigned_at          timestamptz,
  pace_type            text,
  pace_days_per_lesson integer,
  pace_start_date      date,
  due_date             date,
  active               boolean default true,
  created_at           timestamptz default now()
);

create table if not exists lms_progress (
  id               uuid primary key default uuid_generate_v4(),
  student_id       uuid not null references students(id) on delete cascade,
  course_id        text not null references lms_courses(id) on delete cascade,
  content_id       text not null references lms_content(id) on delete cascade,
  status           text default 'not_started',
  mastery_score    numeric(5,2),
  mastery_passed   boolean,
  mastery_attempts integer default 0,
  assign_score     numeric(5,2),
  assign_status    text,
  time_spent_mins  integer default 0,
  updated_at       timestamptz default now(),
  unique(student_id, content_id)
);

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

alter table lms_courses    enable row level security;
alter table lms_content    enable row level security;
alter table lms_enrolments enable row level security;
alter table lms_progress   enable row level security;
alter table lms_submissions enable row level security;

create policy "lms_courses_read"      on lms_courses    for select to authenticated using (true);
create policy "lms_courses_write"     on lms_courses    for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));
create policy "lms_content_read"      on lms_content    for select to authenticated using (true);
create policy "lms_content_write"     on lms_content    for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));
create policy "lms_enrolments_read"   on lms_enrolments for select to authenticated using (true);
create policy "lms_enrolments_write"  on lms_enrolments for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));
create policy "lms_progress_read"     on lms_progress   for select to authenticated using (true);
create policy "lms_progress_write"    on lms_progress   for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));
create policy "lms_submissions_read"  on lms_submissions for select to authenticated using (true);
create policy "lms_submissions_write" on lms_submissions for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));

-- ─── 7. TPMS IPDP Goals ─────────────────────────────────────
create table if not exists tpms_ipdp (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   text not null default 'default',
  goal1      text default '',
  goal2      text default '',
  goal3      text default '',
  reflection text default '',
  updated_at timestamptz default now(),
  unique(owner_id)
);

alter table tpms_ipdp enable row level security;
create policy "tpms_ipdp_read"  on tpms_ipdp for select to authenticated using (true);
create policy "tpms_ipdp_write" on tpms_ipdp for all    to authenticated using (get_my_role() in ('admin','teacher','counselor'));
