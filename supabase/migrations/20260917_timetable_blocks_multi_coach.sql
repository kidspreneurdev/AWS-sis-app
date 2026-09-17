-- Timetable blocks: allow a block to have TWO OR MORE success coaches.
--
-- Until now a block could only carry ONE success coach (`coach_id uuid`).
-- The Blocks / Timetable UI (BlocksPage.tsx) now lets an admin pick as many
-- coaches as they like, so the single FK becomes an array — mirroring the
-- `student_ids` treatment in 20260913_timetable_blocks_multi_student.sql.
--
--   * `coach_ids uuid[]`  — the success coaches assigned to this block.
--   * the old scalar `coach_id` is backfilled into the array and dropped.
--
-- Student/parent portals use the Supabase anon key and filter client-side, so
-- read stays open. Safe to re-run.

alter table timetable_blocks
  add column if not exists coach_ids uuid[] not null default '{}';

-- Backfill the array from the old scalar column, if it's still around.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'timetable_blocks' and column_name = 'coach_id'
  ) then
    update timetable_blocks
       set coach_ids = array[coach_id]
     where coach_id is not null
       and (coach_ids is null or coach_ids = '{}');

    drop index if exists timetable_blocks_coach_id_idx;
    alter table timetable_blocks drop column coach_id;
  end if;
end $$;

-- GIN index so `coach_ids @> array[:id]` / PostgREST `cs.{id}` stays fast.
create index if not exists timetable_blocks_coach_ids_idx
  on timetable_blocks using gin (coach_ids);
