-- Diagnostics expanded to 3 semesters (Math / Reading / ELA / Summary per semester)
-- + 'stock_market_game' upload. Semester is encoded in record_type; no schema shape
-- change. The full list is duplicated in the earlier add_edmentum / add_assessment
-- migrations' comments — this file is authoritative. Safe to re-run.

alter table student_records drop constraint if exists student_records_record_type_check;

alter table student_records add constraint student_records_record_type_check
  check (record_type in (
    'course_confirmation', 'weekly_schedule', 'edmentum_credentials', 'assessment_instructions',
    'psychometric', 'stock_market_game',
    'math_diagnostic', 'reading_diagnostic', 'ela_diagnostic', 'diagnostic_summary_s1',
    'math_diagnostic_s2', 'reading_diagnostic_s2', 'ela_diagnostic_s2', 'diagnostic_summary_s2',
    'math_diagnostic_s3', 'reading_diagnostic_s3', 'ela_diagnostic_s3', 'diagnostic_summary_s3'
  ));
