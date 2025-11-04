-- ============================================
-- PHASE 1: Add Versioning Fields & Constraints
-- ============================================

-- Add structured version fields to curriculum_versions
ALTER TABLE curriculum_versions 
  ADD COLUMN IF NOT EXISTS version_year INTEGER,
  ADD COLUMN IF NOT EXISTS version_sem INTEGER,
  ADD COLUMN IF NOT EXISTS version_seq INTEGER DEFAULT 1;

-- Add unique constraint on program codes
ALTER TABLE programs 
  ADD CONSTRAINT programs_code_unique UNIQUE (code);

-- Create unique index for curriculum versions (without track_id for now)
CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_version_temp
  ON curriculum_versions(program_id, version_year, version_sem, version_seq);

-- ============================================
-- PHASE 2: Program Tracks Model
-- ============================================

-- Create program_tracks table
CREATE TABLE IF NOT EXISTS program_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  track_code TEXT NOT NULL,
  track_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT program_tracks_unique UNIQUE(program_id, track_code)
);

-- Add RLS policies for program_tracks
ALTER TABLE program_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tracks are viewable by everyone" 
  ON program_tracks FOR SELECT 
  USING (true);

CREATE POLICY "Only admins can manage tracks" 
  ON program_tracks FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for program_tracks
CREATE INDEX IF NOT EXISTS idx_program_tracks_program ON program_tracks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_tracks_code ON program_tracks(track_code);

-- Add updated_at trigger for program_tracks
CREATE TRIGGER update_program_tracks_updated_at 
  BEFORE UPDATE ON program_tracks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add track_id to curriculum_versions
ALTER TABLE curriculum_versions 
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES program_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_curriculum_versions_track ON curriculum_versions(track_id);

-- Drop old unique index and create new one with track_id
DROP INDEX IF EXISTS uq_curriculum_version_temp;
CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_version 
  ON curriculum_versions(program_id, COALESCE(track_id::text, 'null'), version_year, version_sem, version_seq);

-- Add track_id to program_enrollments
ALTER TABLE program_enrollments 
  ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES program_tracks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_track ON program_enrollments(track_id);
