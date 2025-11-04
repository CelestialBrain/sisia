-- Allow users to delete their own program enrollments (needed for shifting programs)
DROP POLICY IF EXISTS "Users can delete their own program enrollments" ON program_enrollments;
CREATE POLICY "Users can delete their own program enrollments"
ON program_enrollments
FOR DELETE
USING (auth.uid() = user_id);

-- Ensure users can fully manage their program enrollments for shifting
-- (SELECT, INSERT, UPDATE policies already exist, just ensuring DELETE is added)
