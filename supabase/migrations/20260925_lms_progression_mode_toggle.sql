-- Course Progression Settings collapses from 4 options to a single on/off toggle.
-- 'open' and 'mastery' (no sequential lock) collapse to 'off'; 'sequential' and
-- 'mastery_sequential' (sequential lock) collapse to 'on'.

update lms_courses set progression_mode = 'off' where progression_mode in ('open', 'mastery') or progression_mode is null;
update lms_courses set progression_mode = 'on' where progression_mode in ('sequential', 'mastery_sequential');
alter table lms_courses alter column progression_mode set default 'off';
