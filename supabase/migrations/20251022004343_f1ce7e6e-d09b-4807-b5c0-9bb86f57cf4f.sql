-- Create user role enum
CREATE TYPE public.app_role AS ENUM ('user', 'moderator');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = (SELECT id FROM public.users WHERE student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Moderators can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role((SELECT id FROM public.users WHERE student_id = (SELECT student_id FROM public.users WHERE id = auth.uid())), 'moderator'));

-- Assign moderator role to user with student_id 254880
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator'::app_role
FROM public.users
WHERE student_id = '254880'
ON CONFLICT (user_id, role) DO NOTHING;
