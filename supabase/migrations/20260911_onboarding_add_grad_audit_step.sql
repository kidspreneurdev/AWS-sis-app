-- Onboarding: add step key 'A18' (Graduation Audit is issued), shown after
-- "Offer accepted & fees paid". Drop + re-add the full step_key check so this is
-- order-independent with the create migration. Safe to re-run.

alter table student_onboarding drop constraint if exists student_onboarding_step_key_check;

alter table student_onboarding add constraint student_onboarding_step_key_check
  check (step_key in (
    'A1','A2','A3','A4','A5','A6','A7','A8','A9','A10',
    'A11','A12','A13','A14','A15','A16','A17','A18',
    'B1','B2','B3','B4','B5'
  ));
