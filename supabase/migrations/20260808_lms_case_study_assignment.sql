-- Case Study Assignment (7-section revamp of the LMS "+Lesson" assignment block).
-- Rubric is a fixed template (see src/lib/lms/caseStudyRubric.ts) — these tables hold
-- per-student scores/posts/appeals only, never rubric definitions.
--
-- All student-originated writes (discussion posts/comments, presentation submission,
-- appeal filing) go through the signed-token API broker in api/student-portal/[action].js
-- — students authenticate via students.portal_password, not real Supabase Auth, so RLS
-- can't scope writes to "your own row" for them. These tables are therefore staff-only
-- at the RLS layer; the API's service-role client bypasses RLS entirely for the student
-- actions it fronts. Safe to run multiple times.

create extension if not exists "uuid-ossp";

create table if not exists lms_score_components (
  id              uuid primary key default uuid_generate_v4(),
  content_id      text not null references lms_content(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  component_type  text not null check (component_type in ('notes', 'discussion', 'debate', 'omr', 'presentation')),
  criteria_scores jsonb not null default '{}'::jsonb,
  subtotal        numeric(5,2),
  feedback        text,
  status          text not null default 'not_scored' check (status in ('not_scored', 'scored')),
  scored_by       uuid references profiles(id),
  scored_at       timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (content_id, student_id, component_type)
);

create index if not exists lms_score_components_content_idx on lms_score_components(content_id);
create index if not exists lms_score_components_student_idx on lms_score_components(student_id);

create table if not exists lms_discussion_posts (
  id                  uuid primary key default uuid_generate_v4(),
  content_id          text not null references lms_content(id) on delete cascade,
  student_id          uuid not null references students(id) on delete cascade,
  parent_post_id      uuid references lms_discussion_posts(id) on delete set null,
  body                text not null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists lms_discussion_posts_content_idx on lms_discussion_posts(content_id);
create index if not exists lms_discussion_posts_student_idx on lms_discussion_posts(student_id);
create index if not exists lms_discussion_posts_parent_idx on lms_discussion_posts(parent_post_id);

create table if not exists lms_grade_appeals (
  id                uuid primary key default uuid_generate_v4(),
  content_id        text not null references lms_content(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  component_type    text not null check (component_type in ('notes', 'discussion', 'debate', 'omr', 'presentation')),
  score_component_id uuid references lms_score_components(id) on delete set null,
  message           text not null,
  status            text not null default 'open' check (status in ('open', 'resolved')),
  admin_reply       text,
  resolved_by       uuid references profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz default now()
);

create index if not exists lms_grade_appeals_content_idx on lms_grade_appeals(content_id);
create index if not exists lms_grade_appeals_student_idx on lms_grade_appeals(student_id);
create index if not exists lms_grade_appeals_status_idx on lms_grade_appeals(status);

alter table lms_score_components enable row level security;
alter table lms_discussion_posts enable row level security;
alter table lms_grade_appeals enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['lms_score_components', 'lms_discussion_posts', 'lms_grade_appeals']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = tbl || '_read'
    ) then
      execute format('create policy "%s_read" on %s for select to authenticated using (true)', tbl, tbl);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl and policyname = tbl || '_write'
    ) then
      execute format(
        'create policy "%s_write" on %s for all to authenticated using (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal'')) with check (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal''))',
        tbl, tbl
      );
    end if;
  end loop;
end
$$;
