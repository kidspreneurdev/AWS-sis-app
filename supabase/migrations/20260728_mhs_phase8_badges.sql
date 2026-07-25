-- MS/HS gated grading — Phase 8: Reporting/Transcript polish
-- (see plan: MS/HS Gated Grading System, Phase 8). Reuses mhs_gpa_strands
-- (diploma thresholds) and mhs_period_snapshots (Honor Roll/trend) from
-- earlier phases — this migration only adds Badges.

create table mhs_badges (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  badge_key   text not null,
  label       text not null,
  icon        text,
  source_type text, -- 'auto' | 'teacher'
  source_note text,
  awarded_at  timestamptz default now()
);

alter table mhs_badges enable row level security;
create policy "mhs_badges_read"  on mhs_badges for select to authenticated using (true);
create policy "mhs_badges_write" on mhs_badges for all to authenticated
  using (get_my_role() in ('admin','teacher','counselor','staff','principal'));
