-- Allow service role to manage function logs
CREATE POLICY "Service role can insert logs"
  ON function_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read logs"
  ON function_logs FOR SELECT
  TO service_role
  USING (true);

-- Ensure import_jobs can be updated by service role
CREATE POLICY "Service role can update import jobs"
  ON import_jobs FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can read import jobs"
  ON import_jobs FOR SELECT
  TO service_role
  USING (true);
