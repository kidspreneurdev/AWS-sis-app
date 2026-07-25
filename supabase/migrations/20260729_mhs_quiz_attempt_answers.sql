-- MS/HS gated grading — store the student's actual per-question answers on
-- each quiz attempt, not just the resulting score. Previously the answers
-- array was used to compute score_pct and then discarded, so a teacher had
-- no way to review what a student actually chose.

alter table mhs_quiz_attempts add column answers jsonb; -- array of selected choice indices, same order as mhs_lessons.quiz_questions
