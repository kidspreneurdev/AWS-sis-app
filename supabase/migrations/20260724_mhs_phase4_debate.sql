-- MS/HS gated grading — Phase 4: Socratic Live Debate + Accommodation + Makeup
-- (see plan: MS/HS Gated Grading System, Phase 4).

alter table mhs_lesson_components add column recording_url        text;
alter table mhs_lesson_components add column recording_type       text check (recording_type in ('audio','video'));
alter table mhs_lesson_components add column accommodated         boolean not null default false;
alter table mhs_lesson_components add column debate_absence_flag  boolean not null default false;
alter table mhs_lesson_components add column makeup_scheduled_for date;
alter table mhs_lesson_components add column makeup_deadline      date;

alter table mhs_lessons add column debate_due_at timestamptz;

-- DB-level safety net mirroring the spec's recordDebateScore requirement
-- (recordingUrl OR accommodated) — defense-in-depth beyond client validation,
-- same rationale as Phase 1's quiz attempt-cap trigger.
create or replace function mhs_enforce_debate_recording() returns trigger
language plpgsql as $$
begin
  if new.component_type = 'debate' and new.status = 'scored'
     and new.accommodated = false and new.recording_url is null then
    raise exception 'Debate score requires a recording_url or accommodated=true';
  end if;
  return new;
end;
$$;
create trigger mhs_debate_recording_check before insert or update on mhs_lesson_components
  for each row execute function mhs_enforce_debate_recording();
