-- Create user_grade_plans table for grade planning/sandbox
CREATE TABLE public.user_grade_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum_version_id UUID NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'My Grade Plan',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_grade_plan_courses table for individual course grades in plans
CREATE TABLE public.user_grade_plan_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.user_grade_plans(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  units INTEGER NOT NULL,
  semester_label TEXT,
  year_level INTEGER,
  grade TEXT,
  is_from_actual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_grade_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_grade_plan_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_grade_plans
CREATE POLICY "Users can view their own grade plans"
  ON public.user_grade_plans
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grade plans"
  ON public.user_grade_plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grade plans"
  ON public.user_grade_plans
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grade plans"
  ON public.user_grade_plans
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_grade_plan_courses
CREATE POLICY "Users can view their own grade plan courses"
  ON public.user_grade_plan_courses
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_grade_plans
    WHERE user_grade_plans.id = user_grade_plan_courses.plan_id
    AND user_grade_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own grade plan courses"
  ON public.user_grade_plan_courses
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_grade_plans
    WHERE user_grade_plans.id = user_grade_plan_courses.plan_id
    AND user_grade_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own grade plan courses"
  ON public.user_grade_plan_courses
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_grade_plans
    WHERE user_grade_plans.id = user_grade_plan_courses.plan_id
    AND user_grade_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own grade plan courses"
  ON public.user_grade_plan_courses
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_grade_plans
    WHERE user_grade_plans.id = user_grade_plan_courses.plan_id
    AND user_grade_plans.user_id = auth.uid()
  ));

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_user_grade_plans_updated_at
  BEFORE UPDATE ON public.user_grade_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_grade_plan_courses_updated_at
  BEFORE UPDATE ON public.user_grade_plan_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
