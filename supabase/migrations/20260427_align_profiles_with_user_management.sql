do $$
begin
  alter type user_role add value if not exists 'staff';
  alter type user_role add value if not exists 'principal';
  alter type user_role add value if not exists 'partner';
  alter type user_role add value if not exists 'coach';
  alter type user_role add value if not exists 'viewer';
exception
  when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists active boolean not null default true;

update profiles
set role = 'viewer'
where role::text = 'readonly';
