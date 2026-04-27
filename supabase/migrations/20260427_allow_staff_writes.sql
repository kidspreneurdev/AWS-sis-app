drop policy if exists "students_write" on students;
create policy "students_write" on students for all to authenticated
  using (get_my_role() in ('admin', 'counselor', 'staff', 'principal'))
  with check (get_my_role() in ('admin', 'counselor', 'staff', 'principal'));

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'courses','attendance','interviews','fees','communications',
    'staff','calendar','health_records','behaviour_log','remarks',
    'transfer_credits','ec_de_credits','tpms','at_assignments','pt_projects'
  ] loop
    execute format('drop policy if exists "%s_write" on %s', tbl, tbl);
    execute format(
      'create policy "%s_write" on %s for all to authenticated using (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal'')) with check (get_my_role() in (''admin'', ''teacher'', ''counselor'', ''staff'', ''principal''))',
      tbl,
      tbl
    );
  end loop;
end $$;
