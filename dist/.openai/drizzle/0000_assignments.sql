CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('甘熙故居', '老门东（秦淮非遗传习馆）')),
  platform TEXT NOT NULL,
  other_platform TEXT NOT NULL DEFAULT '',
  display_platform TEXT NOT NULL,
  work_title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size INTEGER NOT NULL DEFAULT 0,
  file_key TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_student_location
ON assignments(student_id, location);

CREATE INDEX IF NOT EXISTS idx_assignments_submitted_at
ON assignments(submitted_at DESC);
