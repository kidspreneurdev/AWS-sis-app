-- Align timetable_blocks with the Blocks/Timetable UI (BlocksPage.tsx).
-- The table existed independently of the frontend and had drifted from it:
-- `period` was numeric while the UI works in "Block 1".."Block 8" labels,
-- and the UI's block name, time slot, duration, coach/manager assignment,
-- capacity and notes fields had no backing columns at all — every
-- create/edit in the admin UI failed with PGRST204, and the student
-- portal's schedule widgets (SPDashboardPage, K5DashboardPage) 400'd on
-- the missing `time` column.

-- period: integer (1, 2, 3...) -> text label ("Block 1", "Block 2", ...)
-- to match the TPMS `PERIODS` constant used by the block picker.
alter table timetable_blocks
  alter column period type text using ('Block ' || period::text);

alter table timetable_blocks
  add column if not exists name text,
  add column if not exists time text,
  add column if not exists duration integer not null default 90,
  add column if not exists coach_id uuid references profiles(id) on delete set null,
  add column if not exists manager_id uuid references profiles(id) on delete set null,
  add column if not exists max_students integer not null default 25,
  add column if not exists notes text;
