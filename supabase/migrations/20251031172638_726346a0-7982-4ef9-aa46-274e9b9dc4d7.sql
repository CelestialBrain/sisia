-- Function to clean up stale import jobs
CREATE OR REPLACE FUNCTION cleanup_stale_import_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Mark jobs as failed if they've been processing for more than 10 minutes
  UPDATE import_jobs
  SET 
    status = 'failed',
    completed_at = now(),
    error_message = 'Job timed out - processing exceeded 10 minutes',
    updated_at = now()
  WHERE 
    status = 'processing'
    AND (started_at < now() - interval '10 minutes' OR updated_at < now() - interval '10 minutes')
    AND completed_at IS NULL;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_stale_import_jobs() TO authenticated;

COMMENT ON FUNCTION cleanup_stale_import_jobs() IS 'Marks import jobs as failed if they have been stuck in processing state for more than 10 minutes';
