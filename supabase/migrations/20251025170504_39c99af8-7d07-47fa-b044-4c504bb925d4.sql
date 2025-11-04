-- Phase 1: Create Schools Table
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Schools are viewable by everyone
CREATE POLICY "Schools are viewable by everyone"
ON public.schools FOR SELECT
USING (true);

-- Only admins can insert schools
CREATE POLICY "Only admins can insert schools"
ON public.schools FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update schools
CREATE POLICY "Only admins can update schools"
ON public.schools FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Pre-populate with 4 undergraduate schools
INSERT INTO public.schools (code, name) VALUES
  ('SOH', 'School of Humanities'),
  ('SOSS', 'School of Social Sciences'),
  ('JGSOM', 'John Gokongwei School of Management'),
  ('SOSE', 'School of Science and Engineering');

-- Phase 2: Create Courses Table (Shared Repository)
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_code TEXT NOT NULL UNIQUE,
  course_title TEXT NOT NULL,
  units INTEGER NOT NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Courses are viewable by everyone
CREATE POLICY "Courses are viewable by everyone"
ON public.courses FOR SELECT
USING (true);

-- Only admins can insert courses
CREATE POLICY "Only admins can insert courses"
ON public.courses FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update courses
CREATE POLICY "Only admins can update courses"
ON public.courses FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete courses
CREATE POLICY "Only admins can delete courses"
ON public.courses FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_courses_school_id ON public.courses(school_id);
CREATE INDEX idx_courses_code ON public.courses(course_code);

-- Phase 3: Create Course Code Patterns Table
CREATE TABLE public.course_code_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  confidence INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for course code patterns
ALTER TABLE public.course_code_patterns ENABLE ROW LEVEL SECURITY;

-- Patterns are viewable by everyone
CREATE POLICY "Patterns are viewable by everyone"
ON public.course_code_patterns FOR SELECT
USING (true);

-- Only admins can manage patterns
CREATE POLICY "Only admins can insert patterns"
ON public.course_code_patterns FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update patterns"
ON public.course_code_patterns FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete patterns"
ON public.course_code_patterns FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Pre-populate with known patterns
INSERT INTO public.course_code_patterns (prefix, school_id, confidence) VALUES
  -- SOSE patterns
  ('CS', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  ('MATH', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  ('ENGIN', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  ('CHEM', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  ('BIO', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  ('PHYS', (SELECT id FROM public.schools WHERE code = 'SOSE'), 5),
  -- JGSOM patterns
  ('DECSC', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  ('ITMGT', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  ('MKTG', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  ('FAA', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  ('LAS', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  ('MGT', (SELECT id FROM public.schools WHERE code = 'JGSOM'), 5),
  -- SOH patterns
  ('ENGL', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  ('FILI', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  ('PHILO', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  ('THEO', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  ('HISTO', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  ('LIT', (SELECT id FROM public.schools WHERE code = 'SOH'), 5),
  -- SOSS patterns
  ('ECON', (SELECT id FROM public.schools WHERE code = 'SOSS'), 5),
  ('POLSC', (SELECT id FROM public.schools WHERE code = 'SOSS'), 5),
  ('PSYCH', (SELECT id FROM public.schools WHERE code = 'SOSS'), 5),
  ('SOCSC', (SELECT id FROM public.schools WHERE code = 'SOSS'), 5),
  ('COMMS', (SELECT id FROM public.schools WHERE code = 'SOSS'), 5);

-- Phase 4: Modify Programs Table
-- Add school_id column
ALTER TABLE public.programs ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE RESTRICT;

-- Migrate existing school data to school_id
UPDATE public.programs 
SET school_id = (
  CASE 
    WHEN school ILIKE '%management%' OR school ILIKE '%business%' THEN (SELECT id FROM public.schools WHERE code = 'JGSOM')
    WHEN school ILIKE '%science%' OR school ILIKE '%engineering%' THEN (SELECT id FROM public.schools WHERE code = 'SOSE')
    WHEN school ILIKE '%social%' THEN (SELECT id FROM public.schools WHERE code = 'SOSS')
    WHEN school ILIKE '%humanities%' THEN (SELECT id FROM public.schools WHERE code = 'SOH')
    ELSE (SELECT id FROM public.schools WHERE code = 'SOSE') -- default fallback
  END
);

-- Make school_id NOT NULL after migration
ALTER TABLE public.programs ALTER COLUMN school_id SET NOT NULL;

-- Drop old school column
ALTER TABLE public.programs DROP COLUMN school;

-- Create index for faster lookups
CREATE INDEX idx_programs_school_id ON public.programs(school_id);

-- Phase 5: Migrate existing program_courses data into courses table
INSERT INTO public.courses (course_code, course_title, units, school_id)
SELECT DISTINCT 
  pc.course_code,
  pc.course_title,
  pc.units,
  p.school_id
FROM public.program_courses pc
JOIN public.programs p ON pc.program_id = p.id
ON CONFLICT (course_code) DO NOTHING;

-- Add triggers for updated_at
CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
