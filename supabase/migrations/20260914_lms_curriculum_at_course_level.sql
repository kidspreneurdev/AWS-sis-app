-- Move the LMS curriculum from Section level to Course level.
--
-- Before: lms_content.course_id -> lms_courses(id) ("Section"), so every section
--         carried its own copy of the modules/lessons. lms_course_groups was a
--         display-only label.
-- After:  lms_content / lms_progress / lms_submissions .course_id -> lms_course_groups(id)
--         ("Course"). All sections under a Course share one curriculum. lms_enrolments
--         stays pointed at lms_courses(id) — enrollment is into a specific section.
--
-- Assumes one section per course today (per product decision): content is repointed
-- straight to the section's group with no merge/dedup. If a course genuinely has 2+
-- sections with content, their lessons are unioned under the shared Course.
--
-- ORDER MATTERS. Run this migration BEFORE deploying the matching app code.
-- Safe to run multiple times.

create extension if not exists "uuid-ossp";

-- ─── 1. Backfill a Course (group) for every ungrouped section ──────────────────
do $$
declare
  sect record;
  gid  uuid;
begin
  for sect in select id from lms_courses where group_id is null loop
    insert into lms_course_groups (id, title)
      select uuid_generate_v4(), coalesce(nullif(title, ''), 'Untitled Course')
      from lms_courses where id = sect.id
      returning id into gid;
    update lms_courses set group_id = gid where id = sect.id;
  end loop;
end
$$;

-- ─── 2. Course-level metadata on lms_course_groups ────────────────────────────
alter table lms_course_groups add column if not exists subject        text;
alter table lms_course_groups add column if not exists grade_level    text;
alter table lms_course_groups add column if not exists description    text;
alter table lms_course_groups add column if not exists credit_hours   numeric(4,2) default 1.0;
alter table lms_course_groups add column if not exists required_hours integer;
alter table lms_course_groups add column if not exists pass_mark      integer default 80;

update lms_course_groups g set
  subject        = rep.subject,
  grade_level    = rep.grade_level,
  description    = rep.description,
  credit_hours   = coalesce(rep.credit_hours, 1.0),
  required_hours = rep.required_hours,
  pass_mark      = coalesce(rep.pass_mark, 80)
from (
  select distinct on (group_id)
    group_id, subject, grade_level, description, credit_hours, required_hours, pass_mark
  from lms_courses
  where group_id is not null
  order by group_id, created_at asc
) rep
where rep.group_id = g.id
  and g.subject is null;

-- ─── 3. Repoint lms_content.course_id: section -> course group ────────────────
-- Drop the old FK (-> lms_courses) FIRST — it would otherwise reject the UPDATE
-- below the moment course_id is set to a group id instead of a section id.
delete from lms_content where course_id not in (select id from lms_courses);
alter table lms_content drop constraint if exists lms_content_course_id_fkey;

update lms_content ct
  set course_id = c.group_id::text
  from lms_courses c
  where ct.course_id = c.id
    and c.group_id is not null;

alter table lms_content
  alter column course_id type uuid using course_id::uuid;
alter table lms_content
  add constraint lms_content_course_id_fkey
  foreign key (course_id) references lms_course_groups(id) on delete cascade;
create index if not exists lms_content_course_idx on lms_content(course_id);

-- ─── 4. Repoint lms_progress.course_id: section -> course group ───────────────
delete from lms_progress where course_id not in (select id from lms_courses);
alter table lms_progress drop constraint if exists lms_progress_course_id_fkey;

update lms_progress p
  set course_id = c.group_id::text
  from lms_courses c
  where p.course_id = c.id
    and c.group_id is not null;

alter table lms_progress
  alter column course_id type uuid using course_id::uuid;
alter table lms_progress
  add constraint lms_progress_course_id_fkey
  foreign key (course_id) references lms_course_groups(id) on delete cascade;
create index if not exists lms_progress_course_idx on lms_progress(course_id);

-- ─── 5. Repoint lms_submissions.course_id: section -> course group ────────────
delete from lms_submissions where course_id not in (select id from lms_courses);
alter table lms_submissions drop constraint if exists lms_submissions_course_id_fkey;

update lms_submissions s
  set course_id = c.group_id::text
  from lms_courses c
  where s.course_id = c.id
    and c.group_id is not null;

alter table lms_submissions
  alter column course_id type uuid using course_id::uuid;
alter table lms_submissions
  add constraint lms_submissions_course_id_fkey
  foreign key (course_id) references lms_course_groups(id) on delete cascade;
create index if not exists lms_submissions_course_idx on lms_submissions(course_id);

-- Redundant metadata columns on lms_courses (subject, pass_mark, …) are intentionally
-- left in place: they still feed per-section defaults and the app's missing-column
-- retry path in lmsStore.ts.
