-- Add missing columns to user_aisis_credentials
ALTER TABLE user_aisis_credentials 
  ADD COLUMN IF NOT EXISTS encrypted_username TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Add missing columns to user_schedules
ALTER TABLE user_schedules 
  ADD COLUMN IF NOT EXISTS schedule_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add missing columns to requirement_rules  
ALTER TABLE requirement_rules
  ADD COLUMN IF NOT EXISTS code_prefix TEXT;

-- Add missing columns to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS category_tags TEXT[];

-- Update user_aisis_credentials to use individual encrypted fields
UPDATE user_aisis_credentials 
SET encrypted_username = encrypted_credentials,
    encrypted_password = encrypted_credentials
WHERE encrypted_username IS NULL;