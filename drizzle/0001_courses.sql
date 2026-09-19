-- CiviorAI hierarchical course data: courses → modules → content_blocks
-- Applied with `wrangler d1 migrations apply civior-db --local|--remote`.

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating',
  brain_dump TEXT NOT NULL,
  research_facts TEXT,
  generation_meta TEXT,
  generated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS courses_user_id_idx ON courses(user_id);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS modules_course_id_idx ON modules(course_id);
CREATE INDEX IF NOT EXISTS modules_course_sequence_idx ON modules(course_id, sequence_order);

CREATE TABLE IF NOT EXISTS content_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'audio', 'quiz', 'scenario')),
  content TEXT NOT NULL,
  audio_url TEXT
);

CREATE INDEX IF NOT EXISTS content_blocks_module_id_idx ON content_blocks(module_id);
CREATE INDEX IF NOT EXISTS content_blocks_module_sequence_idx ON content_blocks(module_id, sequence_order);
