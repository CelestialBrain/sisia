-- Phase 1: Create New Curriculum Architecture Tables

-- 1.1 Create curriculum_versions table
CREATE TABLE IF NOT EXISTS public.curriculum_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  effective_start date,
  effective_end date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.2 Create requirement_groups table
CREATE TABLE IF NOT EXISTS public.requirement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('term', 'category', 'series')),
  display_order int DEFAULT 0,
  min_units int,
  min_courses int,
  max_units int,
  double_counting_rule text DEFAULT 'no_double_counting',
  description text,
  created_at timestamptz DEFAULT now()
);

-- 1.3 Create requirement_rules table
CREATE TABLE IF NOT EXISTS public.requirement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_group_id uuid NOT NULL REFERENCES public.requirement_groups(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('by_course', 'by_tag', 'by_prefix', 'by_pattern')),
  course_ids uuid[],
  tag_pattern text,
  code_prefix text,
  course_pattern text,
  units_override int,
  choices_count int,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 1.4 Update courses table with missing columns
ALTER TABLE public.courses 
  ADD COLUMN IF NOT EXISTS catalog_no text,
  ADD COLUMN IF NOT EXISTS category_tags text[],
  ADD COLUMN IF NOT EXISTS prereq_expr text,
  ADD COLUMN IF NOT EXISTS grade_mode text DEFAULT 'letter',
  ADD COLUMN IF NOT EXISTS repeatable boolean DEFAULT false;

-- Populate catalog_no from course_code if not set
UPDATE public.courses SET catalog_no = course_code WHERE catalog_no IS NULL;

-- 1.5 Update user_programs table
ALTER TABLE public.user_programs
  ADD COLUMN IF NOT EXISTS curriculum_version_id uuid REFERENCES public.curriculum_versions(id);

-- 1.6 Enable RLS on new tables
ALTER TABLE public.curriculum_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_rules ENABLE ROW LEVEL SECURITY;

-- 1.7 Create RLS policies for curriculum_versions
CREATE POLICY "Curriculum versions are viewable by everyone"
  ON public.curriculum_versions FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert curriculum versions"
  ON public.curriculum_versions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update curriculum versions"
  ON public.curriculum_versions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete curriculum versions"
  ON public.curriculum_versions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 1.8 Create RLS policies for requirement_groups
CREATE POLICY "Requirement groups are viewable by everyone"
  ON public.requirement_groups FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert requirement groups"
  ON public.requirement_groups FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update requirement groups"
  ON public.requirement_groups FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete requirement groups"
  ON public.requirement_groups FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 1.9 Create RLS policies for requirement_rules
CREATE POLICY "Requirement rules are viewable by everyone"
  ON public.requirement_rules FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert requirement rules"
  ON public.requirement_rules FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update requirement rules"
  ON public.requirement_rules FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete requirement rules"
  ON public.requirement_rules FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 1.10 Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_curriculum_versions_program ON public.curriculum_versions(program_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_versions_active ON public.curriculum_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_requirement_groups_curriculum ON public.requirement_groups(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_requirement_groups_type ON public.requirement_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_requirement_rules_group ON public.requirement_rules(req_group_id);
CREATE INDEX IF NOT EXISTS idx_requirement_rules_type ON public.requirement_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_courses_catalog_no ON public.courses(catalog_no);
CREATE INDEX IF NOT EXISTS idx_courses_school ON public.courses(school_id);

-- 1.11 Drop obsolete tables (elective_pools and course_code_patterns are replaced by new architecture)
DROP TABLE IF EXISTS public.elective_pools CASCADE;
DROP TABLE IF EXISTS public.course_code_patterns CASCADE;

-- 1.12 Add trigger for updated_at on curriculum_versions
CREATE TRIGGER update_curriculum_versions_updated_at
  BEFORE UPDATE ON public.curriculum_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
