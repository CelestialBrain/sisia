import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { jobIds } = await req.json();
    
    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Job IDs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DELETE] Deleting ${jobIds.length} job(s) for user ${user.id}`);

    // Verify all jobs belong to the user
    const { data: jobs, error: verifyError } = await supabase
      .from('import_jobs')
      .select('id, user_id')
      .in('id', jobIds);

    if (verifyError) throw verifyError;

    const unauthorizedJobs = jobs?.filter(job => job.user_id !== user.id);
    if (unauthorizedJobs && unauthorizedJobs.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to delete some of these jobs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cascade delete from all scraped data tables
    const deletionResults = await Promise.allSettled([
      supabase.from('scraped_curriculum').delete().in('import_job_id', jobIds),
      supabase.from('scraped_my_schedule').delete().in('import_job_id', jobIds),
      supabase.from('scraped_my_grades').delete().in('import_job_id', jobIds),
      supabase.from('scraped_my_program').delete().in('import_job_id', jobIds),
      supabase.from('scraped_account_info').delete().in('import_job_id', jobIds),
      supabase.from('scraped_hold_orders').delete().in('import_job_id', jobIds),
      supabase.from('function_logs').delete().in('import_job_id', jobIds),
    ]);

    // Log any errors but continue
    deletionResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[DELETE] Failed to delete from table ${index}:`, result.reason);
      }
    });

    // Finally, delete the job records themselves
    const { error: jobDeleteError } = await supabase
      .from('import_jobs')
      .delete()
      .in('id', jobIds);

    if (jobDeleteError) throw jobDeleteError;

    console.log(`[DELETE] Successfully deleted ${jobIds.length} job(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully deleted ${jobIds.length} job(s) and all associated data` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DELETE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
