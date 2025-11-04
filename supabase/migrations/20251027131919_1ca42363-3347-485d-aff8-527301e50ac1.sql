-- Create user_schedules table to store user schedules
CREATE TABLE user_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  term_code TEXT NOT NULL,
  schedule_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_user_schedules_user ON user_schedules(user_id);
CREATE INDEX idx_user_schedules_active ON user_schedules(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_schedules
CREATE POLICY "Users can view own schedules" ON user_schedules 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules" ON user_schedules 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON user_schedules 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules" ON user_schedules 
  FOR DELETE USING (auth.uid() = user_id);

-- Create schedule_blocks table to store individual course blocks
CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES user_schedules(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_title TEXT,
  section TEXT,
  instructor TEXT,
  room TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  units NUMERIC,
  color TEXT DEFAULT '#93C5FD',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for schedule_blocks
CREATE INDEX idx_schedule_blocks_schedule ON schedule_blocks(schedule_id);
CREATE INDEX idx_schedule_blocks_day_time ON schedule_blocks(schedule_id, day_of_week, start_time);

-- Enable RLS for schedule_blocks
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_blocks (inherited through schedule ownership)
CREATE POLICY "Users can view own schedule blocks" ON schedule_blocks 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_schedules 
      WHERE user_schedules.id = schedule_blocks.schedule_id 
      AND user_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own schedule blocks" ON schedule_blocks 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_schedules 
      WHERE user_schedules.id = schedule_blocks.schedule_id 
      AND user_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own schedule blocks" ON schedule_blocks 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_schedules 
      WHERE user_schedules.id = schedule_blocks.schedule_id 
      AND user_schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own schedule blocks" ON schedule_blocks 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_schedules 
      WHERE user_schedules.id = schedule_blocks.schedule_id 
      AND user_schedules.user_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to user_schedules
CREATE TRIGGER update_user_schedules_updated_at
  BEFORE UPDATE ON user_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
