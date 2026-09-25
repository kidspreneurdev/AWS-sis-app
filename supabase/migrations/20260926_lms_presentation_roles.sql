-- Master It — per-student role/question assignments. An admin assigns each student in a
-- course one role from that module's fixed question bank (src/lib/lms/presentationRoles.ts);
-- the assignment shows on the student's Master It page, just below the instructions.
-- Safe to run multiple times.

create table if not exists lms_presentation_roles (
  id           uuid primary key default uuid_generate_v4(),
  content_id   text not null references lms_content(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  role_number  int,
  role_label   text not null,
  role_text    text,
  assigned_at  timestamptz default now(),
  unique (content_id, student_id)
);

create index if not exists lms_presentation_roles_content_idx on lms_presentation_roles(content_id);
create index if not exists lms_presentation_roles_student_idx on lms_presentation_roles(student_id);

alter table lms_presentation_roles enable row level security;

drop policy if exists "lms_presentation_roles_read" on lms_presentation_roles;
create policy "lms_presentation_roles_read" on lms_presentation_roles for select to authenticated using (true);

drop policy if exists "lms_presentation_roles_write" on lms_presentation_roles;
create policy "lms_presentation_roles_write" on lms_presentation_roles for all to authenticated
  using (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'))
  with check (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'));
