-- Add the 'edmentum_credentials' (and 'assessment_instructions') record types.
-- The full list is repeated in 20260909_student_records_add_assessment.sql so the
-- constraint is correct whichever migration runs last. Safe to re-run.

alter table student_records drop constraint if exists student_records_record_type_check;

alter table student_records add constraint student_records_record_type_check
  check (record_type in (
    'course_confirmation', 'weekly_schedule', 'edmentum_credentials', 'assessment_instructions',
    'math_diagnostic', 'ela_diagnostic', 'reading_diagnostic', 'psychometric'
  ));
