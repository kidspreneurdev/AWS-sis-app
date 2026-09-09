-- Add the 'assessment_instructions' record type (SIS-generated document). Safe to re-run.

alter table student_records drop constraint if exists student_records_record_type_check;

alter table student_records add constraint student_records_record_type_check
  check (record_type in (
    'course_confirmation', 'weekly_schedule', 'edmentum_credentials', 'assessment_instructions',
    'math_diagnostic', 'ela_diagnostic', 'reading_diagnostic', 'psychometric'
  ));
