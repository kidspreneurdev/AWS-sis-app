-- Teacher-provided files attached to an assignment (worksheets, reading packets, etc.).
-- Stored as a JSON array of { name, url } objects; files live in the `uploads` storage bucket
-- under at-assignments/<timestamp>_<filename>.
alter table at_assignments
  add column if not exists attachments jsonb not null default '[]'::jsonb;
