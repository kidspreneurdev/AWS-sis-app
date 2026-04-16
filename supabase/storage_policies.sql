-- ============================================================
-- AWS SIS — Supabase Storage Policies (Documents Upload)
-- Bucket: student-documents
-- Run once in Supabase SQL Editor
-- ============================================================

-- Make sure the bucket exists (optional; comment out if already created)
insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files to this bucket
drop policy if exists "docs_upload_authenticated" on storage.objects;
create policy "docs_upload_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'student-documents');

-- Allow authenticated users to update/replace files in this bucket
drop policy if exists "docs_update_authenticated" on storage.objects;
create policy "docs_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'student-documents')
with check (bucket_id = 'student-documents');

-- Allow authenticated users to delete files in this bucket
drop policy if exists "docs_delete_authenticated" on storage.objects;
create policy "docs_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'student-documents');

-- Allow public read from this bucket (needed for getPublicUrl links)
drop policy if exists "docs_read_public" on storage.objects;
create policy "docs_read_public"
on storage.objects
for select
to public
using (bucket_id = 'student-documents');
