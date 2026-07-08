-- Remove the "required/mandatory courses" concept: graduation requirements are now
-- tracked purely by credit totals per subject area, not specific named courses.

drop table if exists graduation_requirement_courses;

alter table graduation_requirements drop column if exists mandatory_note;
