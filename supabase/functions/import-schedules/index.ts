import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for auth checks
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload = await req.json();
    
    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client for background operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Compute idempotency key to prevent duplicate imports
    const idempotencyKey = await computeIdempotencyKey(payload);

    // Check for existing import with same idempotency key
    const { data: existingJob } = await serviceClient
      .from('import_jobs')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('job_type', 'schedule_import')
      .in('status', ['pending', 'processing', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingJob) {
      console.log('Duplicate import detected:', { idempotencyKey, existingJobId: existingJob.id });
      return new Response(
        JSON.stringify({
          message: 'This dataset was already imported',
          existingJob: {
            id: existingJob.id,
            status: existingJob.status,
            created_at: existingJob.created_at,
            term_code: existingJob.term_code,
            department: existingJob.department
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create import job record
    const { data: job, error: jobError } = await serviceClient
      .from('import_jobs')
      .insert({
        user_id: user.id,
        job_type: 'schedule_import',
        status: 'pending',
        idempotency_key: idempotencyKey,
        term_code: payload.term_code,
        department: payload.department,
        total_schedules: payload.schedules.length,
        schedules_processed: 0
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create import job:', jobError);
      throw new Error('Failed to create import job');
    }

    console.log('Import job created:', { jobId: job.id, term: payload.term_code, dept: payload.department });

    // Return immediately with job ID
    const response = new Response(
      JSON.stringify({
        message: 'Import job started',
        jobId: job.id,
        status: 'pending'
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Process import in background with proper error handling
    const backgroundProcess = processImportInBackground(serviceClient, job.id, payload, user.id);
    
    // Add shutdown listener to mark job as failed if function is terminated
    addEventListener('beforeunload', async () => {
      try {
        await serviceClient.from('import_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Function shutdown during processing',
          updated_at: new Date().toISOString()
        }).eq('id', job.id).eq('status', 'processing');
      } catch (err) {
        console.error(`[Job ${job.id}] Failed to update status on shutdown:`, err);
      }
    });
    
    // Wrap in try-catch to ensure errors are logged and job status is updated
    (globalThis as any).EdgeRuntime.waitUntil(
      backgroundProcess.catch(async (error: any) => {
        console.error('Background import failed:', error);
        // Ensure job is marked as failed if it hasn't been updated
        try {
          await serviceClient.from('import_jobs').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error?.message || 'Unknown error in background process',
            error_details: { error: String(error) },
            updated_at: new Date().toISOString()
          }).eq('id', job.id).eq('status', 'processing');
        } catch (updateErr) {
          console.error(`[Job ${job.id}] Failed to update error status:`, updateErr);
        }
      })
    );

    return response;

  } catch (error: any) {
    console.error('Import schedules error:', error);
    
    // Log top-level error to function_logs
    try {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await serviceClient.from('function_logs').insert({
        function_name: 'import-schedules',
        level: 'error',
        event_type: 'error',
        event_message: 'Import schedules error',
        details: { error: error.message, stack: error.stack }
      });
    } catch (_) {}
    
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function validatePayload(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload' };
  }

  if (!payload.term_code || typeof payload.term_code !== 'string') {
    return { valid: false, error: 'Missing or invalid term_code' };
  }

  if (!payload.department || typeof payload.department !== 'string') {
    return { valid: false, error: 'Missing or invalid department' };
  }

  if (!Array.isArray(payload.schedules)) {
    return { valid: false, error: 'schedules must be an array' };
  }

  // Validate each schedule has required fields (only if schedules exist)
  if (payload.schedules.length > 0) {
    for (const schedule of payload.schedules) {
      if (!schedule.subject_code || !schedule.section || !schedule.course_title) {
        return { valid: false, error: 'Each schedule must have subject_code, section, and course_title' };
      }
    }
  }

  return { valid: true };
}

async function computeIdempotencyKey(payload: any): Promise<string> {
  const normalized = {
    term: payload.term_code.trim(),
    department: payload.department.trim().toUpperCase(),
    schedules: payload.schedules
      .map((s: any) => `${s.subject_code}|${s.section}|${s.time_pattern || ''}`)
      .sort()
  };

  const data = JSON.stringify(normalized);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function processImportInBackground(
  serviceClient: any,
  jobId: string,
  payload: any,
  userId: string
) {
  let lastHeartbeat = Date.now();
  
  // Helper to record logs to function_logs
  const recordLog = async (level: 'info' | 'warn' | 'error' | 'log', event_type: string, event_message: string, details?: any) => {
    try {
      await serviceClient.from('function_logs').insert({
        function_name: 'import-schedules',
        level,
        event_type,
        event_message,
        details,
        user_id: userId
      })
    } catch (_) {}
  }
  
  // Helper to update heartbeat
  const heartbeat = async () => {
    const now = Date.now();
    if (now - lastHeartbeat > 10000) { // Every 10 seconds
      await serviceClient.from('import_jobs').update({
        updated_at: new Date().toISOString()
      }).eq('id', jobId);
      lastHeartbeat = now;
    }
  };
  
  try {
    // Update job status to processing
    await serviceClient
      .from('import_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log('Starting schedule import processing:', { jobId, term: payload.term_code, dept: payload.department });
    await recordLog('info', 'start', `[Job ${jobId}] Schedule import started`, { 
      jobId, 
      term: payload.term_code, 
      dept: payload.department,
      totalSchedules: payload.schedules.length,
      replaceMode: payload.replaceExisting || false
    });

    await heartbeat();

    // Handle replace mode if specified
    if (payload.replaceExisting) {
      console.log('Replace mode: deprecating existing schedules');
      await serviceClient
        .from('aisis_schedules')
        .update({ deprecated: true })
        .eq('term_code', payload.term_code)
        .eq('department', payload.department)
        .eq('deprecated', false);
    }

    await heartbeat();

    // Insert schedules in batches (if any)
    const batchSize = 100;
    let processed = 0;

    if (payload.schedules.length > 0) {
      for (let i = 0; i < payload.schedules.length; i += batchSize) {
        // Whitelist only valid columns from aisis_schedules table
        const batch = payload.schedules.slice(i, i + batchSize).map((schedule: any) => ({
          subject_code: schedule.subject_code,
          section: schedule.section,
          course_title: schedule.course_title,
          instructor: schedule.instructor ?? null,
          room: schedule.room ?? null,
          time_pattern: schedule.time_pattern ?? null,
          start_time: schedule.start_time ?? null,
          end_time: schedule.end_time ?? null,
          units: typeof schedule.units === 'number' ? schedule.units : null,
          max_capacity: typeof schedule.max_capacity === 'number' ? schedule.max_capacity : null,
          days_of_week: Array.isArray(schedule.days_of_week) ? schedule.days_of_week : null,
          term_code: payload.term_code,
          department: payload.department,
          deprecated: false
        }));
        
        const { error: insertError } = await serviceClient
          .from('aisis_schedules')
          .insert(batch);

        if (insertError) {
          console.error('Batch insert failed:', insertError);
          await recordLog('error', 'error', `[Job ${jobId}] Batch insert failed`, { error: insertError.message });
          throw new Error(`Failed to insert schedules: ${insertError.message}`);
        }

        processed += batch.length;
        
        // Update progress with heartbeat
        await heartbeat();
        
        // Only log every 500 schedules or at completion
        const shouldLog = processed % 500 === 0 || processed === payload.schedules.length;
        if (shouldLog) {
          await serviceClient
            .from('import_jobs')
            .update({
              schedules_processed: processed,
              progress: Math.floor((processed / payload.schedules.length) * 100)
            })
            .eq('id', jobId);

          console.log(`Progress: ${processed}/${payload.schedules.length} schedules`);
        }
      }
    }

    await heartbeat();

    // Mark job as completed
    await serviceClient
      .from('import_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        schedules_processed: payload.schedules.length
      })
      .eq('id', jobId);

    console.log('Schedule import completed successfully:', { jobId, schedulesImported: payload.schedules.length });
    await recordLog('info', 'completed', `[Job ${jobId}] Schedule import completed`, { 
      schedulesImported: payload.schedules.length,
      term: payload.term_code,
      dept: payload.department
    });

  } catch (error: any) {
    console.error('Background import failed:', error);
    await recordLog('error', 'error', `[Job ${jobId}] Schedule import failed`, { 
      error: error?.message,
      term: payload.term_code,
      dept: payload.department
    });
    
    // Provide more detailed error messages
    let errorMessage = error?.message || 'Unknown error occurred';
    if (errorMessage.includes('duplicate key')) {
      errorMessage = 'Duplicate schedule data detected during import';
    } else if (errorMessage.includes('foreign key')) {
      errorMessage = 'Invalid reference in schedule data';
    }
    
    // Mark job as failed
    await serviceClient
      .from('import_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        error_details: { 
          error: String(error),
          original_error: error?.message 
        }
      })
      .eq('id', jobId).eq('status', 'processing'); // Only update if still processing
  }
}
