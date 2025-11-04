-- Fix admin access for current user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email IN ('mar.revelo@student.ateneo.edu', 'marangelonrevelo@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
