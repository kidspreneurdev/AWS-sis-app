-- Notifications module: admin composes a message (subject/content/attachments) targeted
-- at specific students, a grade, a cohort, or all enrolled students. Recipients are
-- resolved and snapshotted at send time into notification_recipients, one row per
-- targeted student, which also carries that student's own read state. Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists notifications (
  id             uuid primary key default uuid_generate_v4(),
  subject        text not null,
  content        text not null,
  attachments    jsonb not null default '[]'::jsonb,  -- [{url, name}]
  audience_type  text not null check (audience_type in ('students','grade','cohort','all')),
  audience_label text not null,
  sent_by        uuid references profiles(id) default auth.uid(),
  sent_at        timestamptz default now(),
  created_at     timestamptz default now()
);

create table if not exists notification_recipients (
  id              uuid primary key default uuid_generate_v4(),
  notification_id uuid not null references notifications(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  read            boolean not null default false,
  read_at         timestamptz,
  created_at      timestamptz default now(),
  unique (notification_id, student_id)
);

create index if not exists notification_recipients_student_idx on notification_recipients(student_id);
create index if not exists notification_recipients_notification_idx on notification_recipients(notification_id);

alter table notifications enable row level security;
alter table notification_recipients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_staff_all'
  ) then
    create policy "notifications_staff_all"
      on notifications
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_recipients' and policyname = 'notification_recipients_staff_all'
  ) then
    create policy "notification_recipients_staff_all"
      on notification_recipients
      for all
      to authenticated
      using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
      with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;
end $$;
