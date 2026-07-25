-- MS/HS gated grading — Phase 7: Appeals / Dispute workflow
-- (see plan: MS/HS Gated Grading System, Phase 7).

create table mhs_grade_disputes (
  id                  uuid primary key default uuid_generate_v4(),
  student_id          uuid not null references students(id) on delete cascade,
  subject_type        text not null check (subject_type in ('debate','discussion','how','capstone')),
  lesson_component_id uuid references mhs_lesson_components(id),
  how_score_id        uuid references mhs_how_scores(id),
  filed_by            text not null, -- student/parent identifying info (no Supabase Auth identity for parents)
  reason              text not null,
  filed_at            timestamptz not null default now(),
  window_deadline     date not null, -- filed_at + mhs_config.dispute_window_school_days at filing time
  status              text not null default 'Open' check (status in ('Open','Under Review','Resolved')),
  second_reviewer_id  uuid references profiles(id),
  resolution_notes    text,
  score_changed       boolean,
  old_score           numeric(5,2),
  new_score           numeric(5,2),
  resolved_at         timestamptz,
  check ((subject_type = 'how' and how_score_id is not null and lesson_component_id is null)
      or (subject_type <> 'how' and lesson_component_id is not null and how_score_id is null))
);

alter table mhs_grade_disputes enable row level security;
create policy "mhs_grade_disputes_read"  on mhs_grade_disputes for select to authenticated using (true);
create policy "mhs_grade_disputes_write" on mhs_grade_disputes for all to authenticated
  using (get_my_role() in ('admin','teacher','counselor','staff','principal'));
-- Student/parent filing goes through api/student-portal/file-grade-dispute.js
-- (service-role insert, token-verified) — same rationale as every other
-- student-writable mhs_* path: a public policy would let anyone file (or
-- forge) a dispute for any student.
