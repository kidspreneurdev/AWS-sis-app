-- MS/HS gated grading — Phase 2: Physical Notes (teacher-verified, on-time scored)
-- + Redemption Reflections (see plan: MS/HS Gated Grading System, Phase 2).

alter table mhs_lesson_components add column teacher_verified boolean not null default false;
alter table mhs_lesson_components add column spotcheck_flag   boolean not null default false; -- handwriting-consistency spot-check, spec section 7
alter table mhs_lesson_components add column excused          boolean not null default false;
alter table mhs_lesson_components add column days_late        integer;
-- Percent of HOW-relevant credit retained (100 = on time, 90/75 = late, null = 4+ days late,
-- flagged for teacher review rather than auto-zeroed). Never applied to raw_score_pct/Mastery.
alter table mhs_lesson_components add column late_penalty_pct numeric(5,2) default 100;

alter table mhs_lessons add column notes_due_at timestamptz;

create table mhs_reflections (
  id                  uuid primary key default uuid_generate_v4(),
  lesson_component_id uuid not null references mhs_lesson_components(id) on delete cascade,
  student_id          uuid not null references students(id) on delete cascade,
  reflection_text     text not null,
  points_requested    numeric(5,2),
  points_awarded      numeric(5,2),
  status              text not null default 'Pending' check (status in ('Pending','Approved','Denied')),
  submitted_at        timestamptz default now(),
  reviewed_by         uuid references profiles(id),
  reviewed_at         timestamptz,
  review_note         text
);

alter table mhs_reflections enable row level security;
create policy "mhs_reflections_read"  on mhs_reflections for select to authenticated using (true);
create policy "mhs_reflections_write" on mhs_reflections for all to authenticated
  using (get_my_role() in ('admin','teacher','counselor','staff','principal'));
-- Student-submitted rows come via api/student-portal/submit-reflection.js (service-role
-- insert, token-verified), not a public RLS policy — same rationale as Phase 1's quiz path.
