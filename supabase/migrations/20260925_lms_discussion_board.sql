-- Master It — Discussion Board. lms_discussion_posts already existed (added by
-- 20260808_lms_case_study_assignment.sql) but was never wired to any UI — no edit/delete/
-- pin/lock, no title, and no way for staff to post (student_id was NOT NULL). This turns
-- it into a real per-phase board, scoped to Master It today via `phase` so a future Show
-- It/Prove It board can share the same table without colliding threads.
-- Safe to run multiple times.

alter table lms_discussion_posts alter column student_id drop not null;

alter table lms_discussion_posts add column if not exists phase text not null default 'master';
alter table lms_discussion_posts add column if not exists title text;
alter table lms_discussion_posts add column if not exists author_staff_name text;
alter table lms_discussion_posts add column if not exists is_announcement boolean not null default false;
alter table lms_discussion_posts add column if not exists is_pinned boolean not null default false;
alter table lms_discussion_posts add column if not exists is_locked boolean not null default false;
alter table lms_discussion_posts add column if not exists deleted_at timestamptz;
alter table lms_discussion_posts add column if not exists attachment_url text;
alter table lms_discussion_posts add column if not exists attachment_file_name text;

do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'lms_discussion_posts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%phase%'
  loop
    execute format('alter table lms_discussion_posts drop constraint %I', con.conname);
  end loop;
end
$$;
alter table lms_discussion_posts add constraint lms_discussion_posts_phase_check
  check (phase in ('learn', 'do', 'show', 'prove', 'master'));

do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'lms_discussion_posts'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%author%'
  loop
    execute format('alter table lms_discussion_posts drop constraint %I', con.conname);
  end loop;
end
$$;
alter table lms_discussion_posts add constraint lms_discussion_posts_author_check
  check (student_id is not null or author_staff_name is not null);

create index if not exists lms_discussion_posts_content_phase_idx on lms_discussion_posts(content_id, phase);

-- Lightweight "like" reaction — students only (staff moderate, they don't react).
create table if not exists lms_discussion_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references lms_discussion_posts(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, student_id)
);
create index if not exists lms_discussion_reactions_post_idx on lms_discussion_reactions(post_id);

alter table lms_discussion_reactions enable row level security;

drop policy if exists "lms_discussion_reactions_read" on lms_discussion_reactions;
create policy "lms_discussion_reactions_read" on lms_discussion_reactions for select to authenticated using (true);

drop policy if exists "lms_discussion_reactions_write" on lms_discussion_reactions;
create policy "lms_discussion_reactions_write" on lms_discussion_reactions for all to authenticated
  using (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'))
  with check (get_my_role() in ('admin', 'teacher', 'counselor', 'staff', 'principal'));
