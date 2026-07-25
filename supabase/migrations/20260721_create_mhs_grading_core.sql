-- MS/HS gated grading system — Phase 1 (see plan: MS/HS Gated Grading System)
-- Adds the mhs_* ("middle/high-school grading") schema and hooks the computed
-- Mastery letter grade into the existing courses.grade_letter field.

create extension if not exists "uuid-ossp";

-- ─── Admin-locked global policy config (singleton) ─────────────────────────
create table mhs_config (
  id                              uuid primary key default uuid_generate_v4(),
  mastery_weight_quiz             numeric(5,2) not null default 15,
  mastery_weight_discussion       numeric(5,2) not null default 15,
  mastery_weight_debate           numeric(5,2) not null default 30,
  mastery_weight_omr              numeric(5,2) not null default 25,
  mastery_weight_notes            numeric(5,2) not null default 15,
  quiz_gate_threshold_pct         numeric(5,2) not null default 60,
  quiz_max_attempts               integer not null default 3,
  how_diploma_threshold_pct       numeric(5,2),              -- school policy TBD, do not treat null as met
  mastery_diploma_threshold_pct   numeric(5,2),              -- school policy TBD, do not treat null as met
  honor_roll_how_threshold_pct    numeric(5,2) not null default 80,
  dispute_window_school_days      integer not null default 10,
  capstone_cadence                text not null default 'every_module',
  handwriting_spotcheck_frequency text not null default 'once_per_grading_period',
  debate_recording_retention_days integer,                    -- school policy TBD, do not treat null as "forever"
  percent_to_letter               jsonb not null default '{"A":90,"B":80,"C":70,"D":60,"F":0}',
  updated_at                      timestamptz default now(),
  check (mastery_weight_quiz + mastery_weight_discussion + mastery_weight_debate
         + mastery_weight_omr + mastery_weight_notes = 100)
);
insert into mhs_config default values;

-- ─── Course / module / lesson shell ─────────────────────────────────────────
create table mhs_courses (
  id            uuid primary key default uuid_generate_v4(),
  catalog_code  text references catalog(code),
  title         text not null,
  academic_year text not null,
  term          text,
  grade_level   text,
  teacher_id    uuid references profiles(id),
  campus        text,
  created_at    timestamptz default now()
);

create table mhs_modules (
  id                  uuid primary key default uuid_generate_v4(),
  mhs_course_id       uuid not null references mhs_courses(id) on delete cascade,
  title               text not null,
  sequence            integer not null default 0,
  capstone_weight_pct numeric(5,2) default 20,
  created_at          timestamptz default now()
);

create table mhs_lessons (
  id                      uuid primary key default uuid_generate_v4(),
  mhs_course_id           uuid not null references mhs_courses(id) on delete cascade,
  module_id               uuid references mhs_modules(id) on delete set null,
  title                   text not null,
  sequence                integer not null default 0,
  quiz_gate_threshold_pct numeric(5,2),              -- null = fall back to mhs_config.quiz_gate_threshold_pct
  quiz_max_attempts       integer,                    -- null = fall back to mhs_config.quiz_max_attempts
  quiz_due_at             timestamptz,
  -- Manual multiple-choice quiz content: [{ "question": "...", "choices": ["..."], "correctIndex": 0 }]
  quiz_questions          jsonb not null default '[]',
  rubric_version          integer not null default 1,
  created_by              uuid references profiles(id),
  created_at              timestamptz default now()
);

-- ─── Per-student per-lesson (or per-module, for capstone) component record ──
create table mhs_lesson_components (
  id                   uuid primary key default uuid_generate_v4(),
  lesson_id            uuid references mhs_lessons(id) on delete cascade,
  module_id            uuid references mhs_modules(id) on delete cascade,
  student_id           uuid not null references students(id) on delete cascade,
  component_type       text not null check (component_type in ('quiz','notes','discussion','debate','omr','capstone')),
  status               text not null default 'not_started'
                         check (status in ('not_started','in_progress','submitted','gate_flagged','gate_cleared','scored','excused')),
  raw_score_pct        numeric(5,2),
  score_pct            numeric(5,2),
  gate_passed          boolean,
  gate_override        boolean not null default false,
  gate_override_reason text,
  gate_override_by     uuid references profiles(id),
  gate_override_at     timestamptz,
  gate_delay_days      integer not null default 0,
  attempt_count        integer not null default 0,
  max_attempts         integer not null default 3,
  due_at               timestamptz,
  effective_due_at     timestamptz,
  submitted_at         timestamptz,
  scored_by            uuid references profiles(id),
  scored_at            timestamptz,
  comment              text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  check ((component_type = 'capstone' and module_id is not null and lesson_id is null)
      or (component_type <> 'capstone' and lesson_id is not null and module_id is null)),
  check (gate_override = false or gate_override_reason is not null)
);
create unique index mhs_lesson_components_lesson_uniq on mhs_lesson_components(lesson_id, student_id, component_type) where lesson_id is not null;
create unique index mhs_lesson_components_module_uniq on mhs_lesson_components(module_id, student_id, component_type) where module_id is not null;

-- ─── Quiz attempt history (only the quiz gate has multi-attempt retries) ────
create table mhs_quiz_attempts (
  id                  uuid primary key default uuid_generate_v4(),
  lesson_component_id uuid not null references mhs_lesson_components(id) on delete cascade,
  attempt_number      integer not null,
  score_pct           numeric(5,2) not null,
  passed              boolean not null,
  submitted_at        timestamptz not null default now(),
  unique(lesson_component_id, attempt_number)
);

-- DB-level safety net for the attempt cap: a forged direct-API insert for a 4th
-- attempt without a valid gate override must fail even if the client-side cap
-- (mirroring K5LessonPlayer/LMSPage precedent) is bypassed.
create or replace function mhs_enforce_quiz_attempt_cap() returns trigger
language plpgsql as $$
declare
  lc mhs_lesson_components%rowtype;
begin
  select * into lc from mhs_lesson_components where id = new.lesson_component_id;
  if new.attempt_number > coalesce(lc.max_attempts, 3) and lc.gate_override = false then
    raise exception 'Attempt cap exceeded for lesson_component %; requires teacher gate override', new.lesson_component_id;
  end if;
  return new;
end;
$$;
create trigger mhs_quiz_attempt_cap before insert on mhs_quiz_attempts
  for each row execute function mhs_enforce_quiz_attempt_cap();

-- ─── Two-strand GPA rollup, one row per mhs-tracked course enrollment ───────
create table mhs_gpa_strands (
  id                          uuid primary key default uuid_generate_v4(),
  course_id                   uuid not null unique references courses(id) on delete cascade,
  student_id                  uuid not null references students(id) on delete cascade,
  mastery_pct                 numeric(5,2),
  mastery_letter              text,
  how_pct                     numeric(5,2),
  mastery_component_breakdown jsonb not null default '{}',
  diploma_mastery_met         boolean,
  diploma_how_met             boolean,
  computed_at                 timestamptz default now()
);

-- ─── Habits of Work rubric scores, per lesson per student (4 fixed 1-4 axes) ─
create table mhs_how_scores (
  id            uuid primary key default uuid_generate_v4(),
  lesson_id     uuid not null references mhs_lessons(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  punctuality   smallint not null check (punctuality between 1 and 4),
  preparedness  smallint not null check (preparedness between 1 and 4),
  participation smallint not null check (participation between 1 and 4),
  integrity     smallint not null check (integrity between 1 and 4),
  comment       text,
  scored_by     uuid references profiles(id),
  scored_at     timestamptz default now(),
  unique(lesson_id, student_id)
);

-- ─── Append-only change log (gate/grade overrides, disputes, reflections…) ──
create table mhs_grade_change_log (
  id                  uuid primary key default uuid_generate_v4(),
  occurred_at         timestamptz not null default now(),
  student_id          uuid references students(id),
  course_id           uuid references courses(id),
  lesson_component_id uuid references mhs_lesson_components(id),
  change_type         text not null check (change_type in
    ('gate_override','grade_override','dispute_resolution','reflection_approval','makeup_scheduled','manual_gpa_recompute')),
  reason              text not null,
  old_value           jsonb,
  new_value           jsonb,
  actor_id            uuid references profiles(id),
  actor_role          text
);

-- ─── Hook into the existing courses table (confirmed integration point) ────
alter table courses add column mhs_course_id           uuid references mhs_courses(id) on delete set null;
alter table courses add column mhs_grade_override        boolean not null default false;
alter table courses add column mhs_grade_override_reason text;
alter table courses add column mhs_grade_override_by     uuid references profiles(id);
alter table courses add column mhs_grade_override_at     timestamptz;
alter table courses add column mhs_mastery_pct           numeric(5,2);  -- denormalized cache for GradesHSPage list rendering
alter table courses add column mhs_how_pct               numeric(5,2);
alter table courses add constraint mhs_grade_override_reason_required
  check (mhs_grade_override = false or mhs_grade_override_reason is not null);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table mhs_config             enable row level security;
alter table mhs_courses            enable row level security;
alter table mhs_modules            enable row level security;
alter table mhs_lessons            enable row level security;
alter table mhs_lesson_components  enable row level security;
alter table mhs_quiz_attempts      enable row level security;
alter table mhs_gpa_strands        enable row level security;
alter table mhs_how_scores         enable row level security;
alter table mhs_grade_change_log   enable row level security;

create policy "mhs_config_read"  on mhs_config for select to authenticated using (true);
create policy "mhs_config_write" on mhs_config for all    to authenticated using (get_my_role() = 'admin');  -- admin/dept-head lock, spec section 4

do $$
declare tbl text;
begin
  foreach tbl in array array['mhs_courses','mhs_modules','mhs_lessons','mhs_lesson_components',
                              'mhs_quiz_attempts','mhs_gpa_strands','mhs_how_scores'] loop
    execute format('create policy "%s_read" on %s for select to authenticated using (true)', tbl, tbl);
    execute format('create policy "%s_write" on %s for all to authenticated using (get_my_role() in (''admin'',''teacher'',''counselor'',''staff'',''principal'')) with check (get_my_role() in (''admin'',''teacher'',''counselor'',''staff'',''principal''))', tbl, tbl);
  end loop;
end $$;

-- Append-only: staff can read/insert, no update/delete policy at all — enforces immutability.
create policy "mhs_grade_change_log_read"   on mhs_grade_change_log for select to authenticated using (true);
create policy "mhs_grade_change_log_insert" on mhs_grade_change_log for insert to authenticated
  with check (get_my_role() in ('admin','teacher','counselor','staff','principal'));
