-- Add PIN column to users table for authentication
ALTER TABLE public.users 
ADD COLUMN pin TEXT CHECK (pin ~ '^\d{4}$');

-- Add index for faster student_id lookups during login
CREATE INDEX IF NOT EXISTS idx_users_student_id ON public.users(student_id);

COMMENT ON COLUMN public.users.pin IS 'Four-digit PIN for authentication (AI-detected during registration)';
