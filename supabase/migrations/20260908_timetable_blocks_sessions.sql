-- Time-table blocks: session type, Google Meet link, individual student assignment.
--
-- The Blocks / Timetable UI (BlocksPage.tsx) now:
--   * distinguishes a "Live Session" (which carries a Google Meet link) from a
--     "Self-Paced Mastery" block (no link needed),
--   * lets a block be assigned to a whole cohort OR to a single student picked
--     from the roster,
--   * no longer collects a room capacity — `max_students` is retired.

alter table timetable_blocks
  add column if not exists session_type text not null default 'Live Session',
  add column if not exists meet_link text,
  add column if not exists assignment_type text not null default 'cohort',
  add column if not exists student_id uuid references students(id) on delete cascade;

alter table timetable_blocks drop column if exists max_students;

create index if not exists timetable_blocks_student_id_idx on timetable_blocks(student_id);
