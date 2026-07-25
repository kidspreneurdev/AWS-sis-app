-- MS/HS gated grading — Phase 6: Module Capstone + Honor Roll per-grading-
-- period tracking (see plan: MS/HS Gated Grading System, Phase 6).
-- Capstone reuses the existing polymorphic mhs_lesson_components shape
-- (module_id branch, already supported since Phase 1) — no schema change
-- needed there; mhs_modules.capstone_weight_pct already exists.

create table mhs_period_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  student_id        uuid not null references students(id) on delete cascade,
  academic_year     text not null,
  grading_period    text not null,        -- e.g. 'Quarter 1'
  mastery_pct       numeric(5,2),         -- avg across the student's mhs-tracked courses this year
  how_pct           numeric(5,2),
  how_threshold_pct numeric(5,2) not null, -- snapshot of mhs_config.honor_roll_how_threshold_pct AT COMPUTE TIME
                                            -- (immutable even if the school later changes the policy)
  honor_roll_met    boolean not null,
  computed_at       timestamptz default now(),
  unique(student_id, academic_year, grading_period)
);

alter table mhs_period_snapshots enable row level security;
create policy "mhs_period_snapshots_read"  on mhs_period_snapshots for select to authenticated using (true);
create policy "mhs_period_snapshots_write" on mhs_period_snapshots for all to authenticated
  using (get_my_role() in ('admin','teacher','counselor','staff','principal'));
