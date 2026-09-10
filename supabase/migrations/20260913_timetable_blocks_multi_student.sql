-- Timetable blocks: allow an "Individual Student" assignment to target MANY students.
--
-- Until now a block assigned to individuals could only carry ONE student
-- (`student_id uuid`). The Blocks / Timetable UI (BlocksPage.tsx) now lets an
-- admin pick as many students as they like, so the single FK becomes an array.
--
--   * `student_ids uuid[]`  — the roster this block is assigned to when
--     `assignment_type = 'student'`. Empty for cohort-wide blocks.
--   * the old scalar `student_id` is backfilled into the array and dropped.
--
-- Student/parent portals use the Supabase anon key and filter client-side, so
-- read stays open. Safe to re-run.

alter table timetable_blocks
  add column if not exists student_ids uuid[] not null default '{}';

-- Backfill the array from the old scalar column, if it's still around.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'timetable_blocks' and column_name = 'student_id'
  ) then
    update timetable_blocks
       set student_ids = array[student_id]
     where student_id is not null
       and (student_ids is null or student_ids = '{}');

    drop index if exists timetable_blocks_student_id_idx;
    alter table timetable_blocks drop column student_id;
  end if;
end $$;

-- GIN index so `student_ids @> array[:id]` / PostgREST `cs.{id}` stays fast.
create index if not exists timetable_blocks_student_ids_idx
  on timetable_blocks using gin (student_ids);
