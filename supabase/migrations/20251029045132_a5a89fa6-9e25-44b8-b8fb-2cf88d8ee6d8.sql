-- Create enum for app roles if not exists (for admin checks)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create aisis_schedules table for storing official course schedules
CREATE TABLE public.aisis_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Term identification
  term_code TEXT NOT NULL,
  
  -- Course information
  subject_code TEXT NOT NULL,
  section TEXT NOT NULL,
  course_title TEXT NOT NULL,
  units NUMERIC NOT NULL,
  
  -- Schedule details (for matching)
  time_pattern TEXT NOT NULL,
  room TEXT NOT NULL,
  
  -- Additional metadata
  instructor TEXT,
  max_capacity INTEGER,
  language TEXT,
  level TEXT,
  delivery_mode TEXT,
  remarks TEXT,
  
  -- Parsed time components (for efficient querying)
  days_of_week INTEGER[],
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Department categorization
  department TEXT NOT NULL,
  
  -- Deprecation flag for soft deletes
  deprecated BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_aisis_schedules_term ON public.aisis_schedules(term_code);
CREATE INDEX idx_aisis_schedules_room_time ON public.aisis_schedules(room, start_time, end_time);
CREATE INDEX idx_aisis_schedules_department ON public.aisis_schedules(department, term_code);
CREATE INDEX idx_aisis_schedules_composite ON public.aisis_schedules(term_code, department, room, start_time);
CREATE INDEX idx_aisis_schedules_deprecated ON public.aisis_schedules(deprecated) WHERE deprecated = false;

-- Enable RLS
ALTER TABLE public.aisis_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aisis_schedules
CREATE POLICY "AISIS schedules are viewable by everyone"
  ON public.aisis_schedules FOR SELECT
  USING (deprecated = false);

CREATE POLICY "Only admins can insert AISIS schedules"
  ON public.aisis_schedules FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update AISIS schedules"
  ON public.aisis_schedules FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete AISIS schedules"
  ON public.aisis_schedules FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add columns to schedule_blocks table
ALTER TABLE public.schedule_blocks 
  ADD COLUMN IF NOT EXISTS aisis_schedule_id UUID REFERENCES public.aisis_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_auto_filled BOOLEAN DEFAULT false;

-- Create index for schedule_blocks lookup
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_aisis_id ON public.schedule_blocks(aisis_schedule_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to aisis_schedules
CREATE TRIGGER update_aisis_schedules_updated_at
  BEFORE UPDATE ON public.aisis_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
