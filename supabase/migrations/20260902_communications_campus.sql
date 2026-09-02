-- Communications are now campus-scoped: every row belongs to one campus, and
-- staff only see communications logged for their own campus (admins see all).
alter table communications add column if not exists campus text;

-- Backfill: all pre-existing communications belong to the Chennai campus.
update communications set campus = 'Chennai' where campus is null;

create index if not exists communications_campus_idx on communications(campus);
