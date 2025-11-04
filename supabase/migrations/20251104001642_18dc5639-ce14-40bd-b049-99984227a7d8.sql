-- Fix RLS policies for function_logs table to allow edge functions to insert logs

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Service role can insert logs" ON function_logs;
DROP POLICY IF EXISTS "Service role can read logs" ON function_logs;

-- Allow service role (edge functions) to insert logs
CREATE POLICY "Service role can insert logs" ON function_logs
  FOR INSERT
  WITH CHECK (true);

-- Allow service role to read all logs
CREATE POLICY "Service role can read logs" ON function_logs
  FOR SELECT
  USING (true);

-- Allow authenticated users to read logs for their own import jobs
CREATE POLICY "Users can read own job logs" ON function_logs
  FOR SELECT
  TO authenticated
  USING (
    import_job_id IN (
      SELECT id FROM import_jobs WHERE user_id = auth.uid()
    )
  );

-- Allow admins to read all logs (keep existing policy)
-- Already exists: "Admins can read function logs"
