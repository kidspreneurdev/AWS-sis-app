-- Adds uploaded-document fields to a Course: a description document, a syllabus,
-- and a student orientation document, shown/edited from the "Edit Course" modal on
-- the Manage Courses page. Lives on lms_course_groups (the real "Course") and also
-- on lms_courses so a standalone, ungrouped course (no group row yet) can hold its
-- own copy.
-- Safe to run multiple times.

alter table lms_course_groups add column if not exists description_doc_url        text;
alter table lms_course_groups add column if not exists description_doc_file_name  text;
alter table lms_course_groups add column if not exists syllabus_url               text;
alter table lms_course_groups add column if not exists syllabus_file_name         text;
alter table lms_course_groups add column if not exists student_orientation_url         text;
alter table lms_course_groups add column if not exists student_orientation_file_name   text;

alter table lms_courses add column if not exists description_doc_url        text;
alter table lms_courses add column if not exists description_doc_file_name  text;
alter table lms_courses add column if not exists syllabus_url               text;
alter table lms_courses add column if not exists syllabus_file_name         text;
alter table lms_courses add column if not exists student_orientation_url         text;
alter table lms_courses add column if not exists student_orientation_file_name   text;
