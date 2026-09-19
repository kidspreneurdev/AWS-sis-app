-- Allow an assignment to target specific students instead of (or in addition to) division/cohort.
-- When student_ids is set and non-empty, the assignment applies only to those students;
-- when null/empty, targeting falls back to the existing division/cohort columns.
alter table at_assignments
  add column if not exists student_ids uuid[];
