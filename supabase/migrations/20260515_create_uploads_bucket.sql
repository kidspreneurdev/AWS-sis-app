-- Create a single public storage bucket for all user file uploads
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Allow anonymous users to upload (student portal uses anon key)
create policy "uploads_insert_anon"
  on storage.objects for insert to anon
  with check (bucket_id = 'uploads');

-- Allow authenticated users to upload (admin/staff portal)
create policy "uploads_insert_auth"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads');

-- Anyone can read files (public bucket — URLs are unguessable UUIDs)
create policy "uploads_select_public"
  on storage.objects for select
  using (bucket_id = 'uploads');

-- Authenticated users can overwrite/update their uploads
create policy "uploads_update_auth"
  on storage.objects for update to authenticated
  using (bucket_id = 'uploads');
