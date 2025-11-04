-- Remove pin column from users table since we're using password authentication now
ALTER TABLE public.users DROP COLUMN IF EXISTS pin;
