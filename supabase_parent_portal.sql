-- Add 'parent' to the user_role enum (safe to run even if already exists)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent';

-- Parent Portal: join table linking parents (profiles) to their children (students)
CREATE TABLE IF NOT EXISTS parent_students (
  parent_id  UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, student_id)
);

-- Allow parents to read their own rows
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent can read own links"
  ON parent_students FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "service role full access"
  ON parent_students
  USING (true)
  WITH CHECK (true);
