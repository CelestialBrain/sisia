import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { 
      type, 
      schoolId, 
      curriculumId, 
      programId,
      termCode,
      department,
      jobId
    } = await req.json();

    // Verify user is admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      throw new Error('Unauthorized: Admin access required');
    }

// Logger helper - write to function_logs
    const recordLog = async (level: 'info' | 'warn' | 'error' | 'log', event_type: string, event_message: string, details?: any) => {
      try {
        await supabaseAdmin.from('function_logs').insert({
          function_name: 'admin-purge',
          level,
          event_type,
          event_message,
          details,
          user_id: user.id
        });
      } catch (_) {}
    };

    // Normalize type to handle case and whitespace variations
    const normalizedType = (type || '').toString().trim().toLowerCase();

    // Start log
    await recordLog('info', 'start', `Starting purge type: ${normalizedType}`, { schoolId, programId, curriculumId, termCode, department, jobId });
    
    // Execute purge based on type
    console.log(`Starting purge type: ${normalizedType}`, { schoolId, programId, curriculumId, termCode, department, jobId });
    
    switch (normalizedType) {
      case 'by_import_job': {
        console.log(`Purging by import job: ${jobId}`);
        
        // Get job details
        const { data: job } = await supabaseAdmin
          .from('import_jobs')
          .select('created_version_id, created_track_id, created_program_id')
          .eq('id', jobId)
          .single();
        
        if (!job?.created_version_id) {
          throw new Error('Import job not found or has no created version');
        }
        
        // Check if curriculum is in use by enrollments
        const { data: enrollments } = await supabaseAdmin
          .from('program_enrollments')
          .select('id')
          .eq('curriculum_version_id', job.created_version_id)
          .limit(1);
        
        if (enrollments && enrollments.length > 0) {
          return new Response(
            JSON.stringify({ 
              error: 'Cannot delete: Curriculum version is in use by student enrollments',
              in_use: true
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        // Delete in correct order
        const deletedItems: any = {};
        
        // 1. Get requirement groups
        const { data: reqGroups } = await supabaseAdmin
          .from('requirement_groups')
          .select('id')
          .eq('curriculum_id', job.created_version_id);
        const reqGroupIds = reqGroups?.map((r: any) => r.id) || [];
        
        // 2. Delete requirement rules
        if (reqGroupIds.length > 0) {
          console.log('Deleting requirement_rules');
          await supabaseAdmin
            .from('requirement_rules')
            .delete()
            .in('req_group_id', reqGroupIds);
          deletedItems.requirement_rules = reqGroupIds.length;
        }
        
        // 3. Delete requirement groups
        console.log('Deleting requirement_groups');
        await supabaseAdmin
          .from('requirement_groups')
          .delete()
          .eq('curriculum_id', job.created_version_id);
        deletedItems.requirement_groups = reqGroupIds.length;
        
        // 4. Delete curriculum version
        console.log('Deleting curriculum_version');
        await supabaseAdmin
          .from('curriculum_versions')
          .delete()
          .eq('id', job.created_version_id);
        deletedItems.curriculum_version = 1;
        
        // 5. Delete track if no other versions use it
        if (job.created_track_id) {
          const { count: trackVersions } = await supabaseAdmin
            .from('curriculum_versions')
            .select('id', { count: 'exact', head: true })
            .eq('track_id', job.created_track_id);
          
          if ((trackVersions || 0) === 0) {
            console.log('Deleting orphaned track');
            await supabaseAdmin
              .from('program_tracks')
              .delete()
              .eq('id', job.created_track_id);
            deletedItems.track = 1;
          }
        }
        
        // 6. Delete program if no other versions use it
        if (job.created_program_id) {
          const { count: programVersions } = await supabaseAdmin
            .from('curriculum_versions')
            .select('id', { count: 'exact', head: true })
            .eq('program_id', job.created_program_id);
          
          if ((programVersions || 0) === 0) {
            console.log('Deleting orphaned program');
            await supabaseAdmin
              .from('programs')
              .delete()
              .eq('id', job.created_program_id);
            deletedItems.program = 1;
          }
        }
        
        // 7. Delete import job itself
        console.log('Deleting import_job');
        await supabaseAdmin
          .from('import_jobs')
          .delete()
          .eq('id', jobId);
        deletedItems.import_job = 1;
        
        return new Response(
          JSON.stringify({ success: true, deleted: deletedItems }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'by_school': {
        console.log(`Purging by school: ${schoolId}`);
        
        // Delete import jobs for this school's programs
        const { data: schoolPrograms } = await supabaseAdmin
          .from('programs')
          .select('id')
          .eq('school_id', schoolId);
        const schoolProgramIds = schoolPrograms?.map(p => p.id) || [];
        
        if (schoolProgramIds.length > 0) {
          console.log('Deleting curriculum import_jobs for school programs');
          await supabaseAdmin.from('import_jobs').delete()
            .eq('job_type', 'curriculum_import')
            .in('program_id', schoolProgramIds);
        }
        
        // Get program IDs for this school
        const { data: programs } = await supabaseAdmin
          .from('programs')
          .select('id')
          .eq('school_id', schoolId);
        const programIds = programs?.map(p => p.id) || [];
        console.log(`Found ${programIds.length} programs for school`);

        if (programIds.length > 0) {
          // Get curriculum version IDs
          const { data: curriculums } = await supabaseAdmin
            .from('curriculum_versions')
            .select('id')
            .in('program_id', programIds);
          const curriculumIds = curriculums?.map(c => c.id) || [];
          console.log(`Found ${curriculumIds.length} curriculum versions`);

          if (curriculumIds.length > 0) {
            // Get requirement group IDs
            const { data: reqGroups } = await supabaseAdmin
              .from('requirement_groups')
              .select('id')
              .in('curriculum_id', curriculumIds);
            const reqGroupIds = reqGroups?.map(r => r.id) || [];
            console.log(`Found ${reqGroupIds.length} requirement groups`);

            if (reqGroupIds.length > 0) {
              console.log('Deleting requirement_rules');
              await supabaseAdmin.from('requirement_rules').delete().in('req_group_id', reqGroupIds);
            }
            console.log('Deleting requirement_groups');
            await supabaseAdmin.from('requirement_groups').delete().in('curriculum_id', curriculumIds);
          }

          console.log('Deleting program_courses');
          await supabaseAdmin.from('program_courses').delete().in('program_id', programIds);
          
          console.log('Deleting program_enrollments');
          await supabaseAdmin.from('program_enrollments').delete().in('program_id', programIds);
          
          console.log('Deleting curriculum_versions');
          await supabaseAdmin.from('curriculum_versions').delete().in('program_id', programIds);
          
          console.log('Deleting program_tracks');
          await supabaseAdmin.from('program_tracks').delete().in('program_id', programIds);
          
          console.log('Deleting programs');
          await supabaseAdmin.from('programs').delete().in('id', programIds);
        }

        // Get course IDs for equivalencies
        const { data: schoolCourses } = await supabaseAdmin
          .from('courses')
          .select('id')
          .eq('school_id', schoolId);
        const courseIds = schoolCourses?.map(c => c.id) || [];
        console.log(`Found ${courseIds.length} courses for school`);

        if (courseIds.length > 0) {
          console.log('Deleting course_equivalencies');
          await supabaseAdmin.from('course_equivalencies').delete().or(`from_course_id.in.(${courseIds.join(',')}),to_course_id.in.(${courseIds.join(',')})`);
        }

        console.log('Deleting course_school_usage');
        await supabaseAdmin.from('course_school_usage').delete().eq('school_id', schoolId);
        
        console.log('Deleting courses');
        await supabaseAdmin.from('courses').delete().eq('school_id', schoolId);
        break;
      }

      case 'by_curriculum': {
        console.log(`Purging by curriculum: ${curriculumId}`);
        
        // Delete import job for this curriculum
        console.log('Deleting curriculum import_job');
        await supabaseAdmin.from('import_jobs').delete()
          .eq('job_type', 'curriculum_import')
          .eq('curriculum_id', curriculumId);
        
        // Get requirement group IDs
        const { data: reqGroups } = await supabaseAdmin
          .from('requirement_groups')
          .select('id')
          .eq('curriculum_id', curriculumId);
        const reqGroupIds = reqGroups?.map(r => r.id) || [];
        console.log(`Found ${reqGroupIds.length} requirement groups`);

        if (reqGroupIds.length > 0) {
          console.log('Deleting requirement_rules');
          await supabaseAdmin.from('requirement_rules').delete().in('req_group_id', reqGroupIds);
        }
        
        console.log('Deleting requirement_groups');
        await supabaseAdmin.from('requirement_groups').delete().eq('curriculum_id', curriculumId);

        // Get program ID to delete enrollments
        const { data: curriculum } = await supabaseAdmin
          .from('curriculum_versions')
          .select('program_id')
          .eq('id', curriculumId)
          .single();

        if (curriculum?.program_id) {
          console.log('Deleting program_enrollments');
          await supabaseAdmin.from('program_enrollments').delete().eq('program_id', curriculum.program_id);
        }

        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().eq('id', curriculumId);
        break;
      }

      case 'by_program': {
        console.log(`Purging by program: ${programId}`);
        
        // Delete import jobs for this program
        console.log('Deleting curriculum import_jobs for program');
        await supabaseAdmin.from('import_jobs').delete()
          .eq('job_type', 'curriculum_import')
          .eq('program_id', programId);
        
        // Get curriculum version IDs
        const { data: curriculums } = await supabaseAdmin
          .from('curriculum_versions')
          .select('id')
          .eq('program_id', programId);
        const curriculumIds = curriculums?.map(c => c.id) || [];
        console.log(`Found ${curriculumIds.length} curriculum versions`);

        if (curriculumIds.length > 0) {
          // Get requirement group IDs
          const { data: reqGroups } = await supabaseAdmin
            .from('requirement_groups')
            .select('id')
            .in('curriculum_id', curriculumIds);
          const reqGroupIds = reqGroups?.map(r => r.id) || [];
          console.log(`Found ${reqGroupIds.length} requirement groups`);

          if (reqGroupIds.length > 0) {
            console.log('Deleting requirement_rules');
            await supabaseAdmin.from('requirement_rules').delete().in('req_group_id', reqGroupIds);
          }
          
          console.log('Deleting requirement_groups');
          await supabaseAdmin.from('requirement_groups').delete().in('curriculum_id', curriculumIds);
        }

        console.log('Deleting program_courses');
        await supabaseAdmin.from('program_courses').delete().eq('program_id', programId);
        
        console.log('Deleting program_enrollments');
        await supabaseAdmin.from('program_enrollments').delete().eq('program_id', programId);
        
        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().eq('program_id', programId);
        
        console.log('Deleting program_tracks');
        await supabaseAdmin.from('program_tracks').delete().eq('program_id', programId);
        
        console.log('Deleting programs');
        await supabaseAdmin.from('programs').delete().eq('id', programId);
        break;
      }

      case 'by_schedule': {
        const trimmedTerm = termCode?.trim();
        const trimmedDept = department?.trim();
        
        console.log(`Purging schedules: term=${trimmedTerm}, dept=${trimmedDept}`);
        
        // Require at least one filter to prevent accidental deletion of all schedules
        if (!trimmedTerm && !trimmedDept) {
          throw new Error('Must specify at least termCode or department');
        }
        
        // Delete import jobs for these schedules
        let jobQuery = supabaseAdmin
          .from('import_jobs')
          .delete()
          .eq('job_type', 'schedule_import');
        
        if (trimmedTerm) {
          jobQuery = jobQuery.eq('term_code', trimmedTerm);
        }
        if (trimmedDept) {
          jobQuery = jobQuery.eq('department', trimmedDept);
        }
        
        console.log('Deleting schedule import_jobs');
        await jobQuery;
        
        let query = supabaseAdmin
          .from('aisis_schedules')
          .delete()
          .select();
        
        if (trimmedTerm) {
          console.log(`Filtering by term: ${trimmedTerm}`);
          query = query.eq('term_code', trimmedTerm);
        }
        
        if (trimmedDept) {
          console.log(`Filtering by department: ${trimmedDept}`);
          query = query.eq('department', trimmedDept);
        }
        
        const { data, error } = await query;
        if (error) {
          console.error('Error deleting schedules:', error);
          throw error;
        }
        
        const deletedCount = data?.length || 0;
        console.log(`Deleted ${deletedCount} schedules`);
        
        return new Response(
          JSON.stringify({ success: true, deletedCount }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'all_curricula':
        console.log('Purging all curricula');
        
        console.log('Deleting curriculum import_jobs');
        await supabaseAdmin.from('import_jobs').delete()
          .eq('job_type', 'curriculum_import')
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_rules');
        await supabaseAdmin.from('requirement_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_groups');
        await supabaseAdmin.from('requirement_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_enrollments');
        await supabaseAdmin.from('program_enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('All curricula purged successfully');
        break;

      case 'all_admin':
        console.log('Purging all programs and courses (schedules remain)');
        
        console.log('Deleting curriculum import_jobs');
        await supabaseAdmin.from('import_jobs').delete()
          .eq('job_type', 'curriculum_import')
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_rules');
        await supabaseAdmin.from('requirement_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_groups');
        await supabaseAdmin.from('requirement_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_courses');
        await supabaseAdmin.from('program_courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_tracks');
        await supabaseAdmin.from('program_tracks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_enrollments');
        await supabaseAdmin.from('program_enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_school_usage');
        await supabaseAdmin.from('course_school_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_equivalencies');
        await supabaseAdmin.from('course_equivalencies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting courses');
        await supabaseAdmin.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting programs');
        await supabaseAdmin.from('programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('All programs and courses purged successfully');
        break;

      case 'all_admin_with_schedules':
        console.log('Purging all programs, courses, and schedules');
        
        console.log('Deleting all import_jobs');
        await supabaseAdmin.from('import_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_rules');
        await supabaseAdmin.from('requirement_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_groups');
        await supabaseAdmin.from('requirement_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_courses');
        await supabaseAdmin.from('program_courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_tracks');
        await supabaseAdmin.from('program_tracks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_enrollments');
        await supabaseAdmin.from('program_enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_school_usage');
        await supabaseAdmin.from('course_school_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_equivalencies');
        await supabaseAdmin.from('course_equivalencies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting courses');
        await supabaseAdmin.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting programs');
        await supabaseAdmin.from('programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting aisis_schedules');
        await supabaseAdmin.from('aisis_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('All programs, courses, and schedules purged successfully');
        break;

      case 'nuclear':
        console.log('Nuclear purge - deleting ALL data');
        
        // Delete user data first
        console.log('Deleting schedule_blocks');
        await supabaseAdmin.from('schedule_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting schedule_palette_items');
        await supabaseAdmin.from('schedule_palette_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting schedule_share_codes');
        await supabaseAdmin.from('schedule_share_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting user_schedules');
        await supabaseAdmin.from('user_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting user_courses');
        await supabaseAdmin.from('user_courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting user_programs');
        await supabaseAdmin.from('user_programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting custom_program_courses');
        await supabaseAdmin.from('custom_program_courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting custom_programs');
        await supabaseAdmin.from('custom_programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting admin_audit_log');
        await supabaseAdmin.from('admin_audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Delete admin data
        console.log('Deleting import_jobs');
        await supabaseAdmin.from('import_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_rules');
        await supabaseAdmin.from('requirement_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting requirement_groups');
        await supabaseAdmin.from('requirement_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting curriculum_versions');
        await supabaseAdmin.from('curriculum_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_courses');
        await supabaseAdmin.from('program_courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_tracks');
        await supabaseAdmin.from('program_tracks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting program_enrollments');
        await supabaseAdmin.from('program_enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_school_usage');
        await supabaseAdmin.from('course_school_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting course_equivalencies');
        await supabaseAdmin.from('course_equivalencies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting courses');
        await supabaseAdmin.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting programs');
        await supabaseAdmin.from('programs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Deleting aisis_schedules');
        await supabaseAdmin.from('aisis_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('Nuclear purge completed successfully');
        break;

      default:
        throw new Error('Invalid purge type');
    }
    
    console.log(`Purge completed successfully for type: ${type}`);
    await recordLog('info', 'complete', `Purge completed successfully for type: ${type}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    try {
      const supabaseAdmin2 = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await supabaseAdmin2.from('function_logs').insert({
        function_name: 'admin-purge',
        level: 'error',
        event_type: 'error',
        event_message: message
      });
    } catch (_) {}
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
