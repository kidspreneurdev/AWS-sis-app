-- Student self-assessment scores for the skill graph comparison
create table if not exists hs_self_assessments (
  id         uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) on delete cascade,
  scores     jsonb not null default '{}',
  updated_at timestamptz default now(),
  unique(student_id)
);

alter table hs_self_assessments enable row level security;

-- Student portal uses anon key (no JWT role), so allow public read/write
create policy "public_select_hs_self_assessments" on hs_self_assessments
  for select using (true);

create policy "public_insert_hs_self_assessments" on hs_self_assessments
  for insert with check (true);

create policy "public_update_hs_self_assessments" on hs_self_assessments
  for update using (true);
