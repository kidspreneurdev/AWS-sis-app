-- Create graduation requirements tables and seed with school policy

create table if not exists graduation_requirements (
  id               uuid primary key default uuid_generate_v4(),
  key              text unique not null,
  label            text not null,
  area             text not null,
  required_credits numeric(4,2) not null,
  icon             text,
  mandatory_note   text,
  sort_order       integer not null default 0
);

create table if not exists graduation_requirement_courses (
  id             uuid primary key default uuid_generate_v4(),
  requirement_id uuid not null references graduation_requirements(id) on delete cascade,
  course_title   text not null,
  sort_order     integer not null default 0
);

alter table graduation_requirements enable row level security;
alter table graduation_requirement_courses enable row level security;

create policy "public_read_graduation_requirements" on graduation_requirements
  for select using (true);

create policy "public_read_graduation_requirement_courses" on graduation_requirement_courses
  for select using (true);

-- Seed school graduation policy
insert into graduation_requirements (key, label, area, required_credits, icon, mandatory_note, sort_order) values
  ('ELA',  'Language Arts',  'Language Arts',  4, '📖', 'LA 9, 10, 11, 12 all required',                           1),
  ('MATH', 'Mathematics',    'Mathematics',    4, '🔢', 'Algebra 1 & Geometry required',                           2),
  ('SCI',  'Science',        'Science',        3, '🔬', 'Biology required',                                        3),
  ('SS',   'Social Studies', 'Social Studies', 3, '🌍', 'World History, US History & American Government required', 4),
  ('ARTS', 'Fine Arts',      'Fine Arts',      1, '🎨', 'Art, Music, Theatre or equivalent',                       5),
  ('PE',   'PE or Health',   'PE or Health',   1, '🏃', 'PE or Health',                                            6),
  ('ELEC', 'Free Electives', 'Electives',      8, '⭐', 'Any discipline',                                          7)
on conflict (key) do nothing;
