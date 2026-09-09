-- Private storage bucket for Student Records PDFs (diagnostic + psychometric reports,
-- and later the generated course-confirmation / weekly-schedule documents).
-- Objects are never public: staff + parents read via short-lived signed URLs,
-- students via a signed URL minted server-side (api/student-portal). Safe to re-run.

insert into storage.buckets (id, name, public)
values ('student-records', 'student-records', false)
on conflict (id) do nothing;

do $$
begin
  -- Staff: full access to objects in the bucket.
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_records_obj_staff_select') then
    create policy "student_records_obj_staff_select"
      on storage.objects for select to authenticated
      using (bucket_id = 'student-records' and get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_records_obj_staff_insert') then
    create policy "student_records_obj_staff_insert"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'student-records' and get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_records_obj_staff_update') then
    create policy "student_records_obj_staff_update"
      on storage.objects for update to authenticated
      using (bucket_id = 'student-records' and get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_records_obj_staff_delete') then
    create policy "student_records_obj_staff_delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'student-records' and get_my_role() in ('admin', 'counselor', 'staff', 'principal'));
  end if;

  -- Parents: read objects for their own children only. Object key convention is
  -- students/<studentId>/<recordType>/<file>, so split_part(name, '/', 2) is the studentId.
  if to_regclass('public.parent_students') is not null
     and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'student_records_obj_parent_select') then
    create policy "student_records_obj_parent_select"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'student-records'
        and exists (
          select 1 from parent_students ps
          where ps.parent_id = auth.uid()
            and split_part(name, '/', 2) = ps.student_id::text
        )
      );
  end if;
end
$$;
