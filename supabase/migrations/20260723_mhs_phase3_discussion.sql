-- MS/HS gated grading — Phase 3: Discussion Board + Integrity Controls
-- (see plan: MS/HS Gated Grading System, Phase 3).

alter table mhs_lessons add column discussion_due_at    timestamptz;
alter table mhs_lessons add column min_discussion_words integer not null default 150;

alter table mhs_config add column discussion_similarity_threshold_pct numeric(5,2) not null default 60;

create table mhs_discussion_posts (
  id                      uuid primary key default uuid_generate_v4(),
  lesson_component_id     uuid not null references mhs_lesson_components(id) on delete cascade,
  student_id              uuid not null references students(id) on delete cascade,
  parent_post_id          uuid references mhs_discussion_posts(id) on delete set null,
  body                    text not null,
  word_count              integer not null default 0,
  references_student_id   uuid references students(id), -- a reply must cite a specific classmate's point
  paste_event_detected    boolean not null default false,
  similarity_score        numeric(5,2),
  similarity_flag         boolean not null default false,
  edited_after_submission boolean not null default false,
  edit_history            jsonb not null default '[]',
  submitted_at            timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table mhs_discussion_posts enable row level security;
create policy "mhs_discussion_posts_read"  on mhs_discussion_posts for select to authenticated using (true);
create policy "mhs_discussion_posts_write" on mhs_discussion_posts for all to authenticated
  using (get_my_role() in ('admin','teacher','counselor','staff','principal'));
-- Student post/reply/edit goes through api/student-portal/submit-discussion-post.js
-- (service-role insert, token-verified) — same rationale as Phase 1's quiz path:
-- a public RLS policy would let anyone write an arbitrary post/similarity bypass.
