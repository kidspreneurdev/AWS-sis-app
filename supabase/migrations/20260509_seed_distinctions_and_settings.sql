-- Create graduation_distinctions table if missing and seed data
create table if not exists graduation_distinctions (
  id                    uuid primary key default uuid_generate_v4(),
  label                 text not null,
  icon                  text,
  color                 text,
  weighted_gpa_required numeric(4,2) not null,
  sort_order            integer not null default 0
);

alter table graduation_distinctions enable row level security;

create policy "public_read_graduation_distinctions" on graduation_distinctions
  for select using (true);

-- Seed distinctions (highest GPA first so portal find() matches correctly)
insert into graduation_distinctions (label, icon, color, weighted_gpa_required, sort_order) values
  ('Summa Cum Laude', '🥇', '#D4AF37', 4.00, 1),
  ('Magna Cum Laude', '🥈', '#A8A9AD', 3.75, 2),
  ('Cum Laude',       '🥉', '#CD7F32', 3.50, 3)
on conflict do nothing;

-- Ensure settings table exists and has the required columns
create table if not exists settings (
  id                              uuid primary key default uuid_generate_v4(),
  academic_year                   text,
  graduation_credits              integer default 24,
  associate_degree_credits_required integer default 60
);

-- Insert a default row if none exists
insert into settings (academic_year, graduation_credits, associate_degree_credits_required)
  select '2025-2026', 24, 60
  where not exists (select 1 from settings);

-- If a row exists but values are null, fill them in
update settings
set
  graduation_credits = coalesce(graduation_credits, 24),
  associate_degree_credits_required = coalesce(associate_degree_credits_required, 60)
where graduation_credits is null or associate_degree_credits_required is null;
