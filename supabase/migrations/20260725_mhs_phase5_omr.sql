-- MS/HS gated grading — Phase 5: Open-Book OMR Test (manual entry) + full
-- Mastery GPA assembly (see plan: MS/HS Gated Grading System, Phase 5).
-- Explicitly Phase 1 of the spec's own two-phase OMR plan (manual bubble-grid
-- entry now; image-scan entry is out of scope here).

alter table mhs_lessons add column omr_due_at     timestamptz;
alter table mhs_lessons add column omr_answer_key text; -- e.g. "ABCAD..." — one letter per question

-- No new mhs_lesson_components columns needed: OMR reuses raw_score_pct/
-- score_pct/late_penalty_pct exactly like Notes/Discussion (subject to the
-- same late-penalty table, unlike Debate).
