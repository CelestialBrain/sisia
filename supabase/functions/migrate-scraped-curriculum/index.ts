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

    // Verify admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { scraped_curriculum_ids } = await req.json();

    if (!Array.isArray(scraped_curriculum_ids) || scraped_curriculum_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid scraped_curriculum_ids array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const scrapedId of scraped_curriculum_ids) {
      try {
        // Fetch scraped curriculum data
        const { data: scrapedData, error: fetchError } = await serviceClient
          .from('scraped_curriculum')
          .select('*')
          .eq('id', scrapedId)
          .single();

        if (fetchError || !scrapedData) {
          results.push({ id: scrapedId, success: false, error: 'Scraped data not found' });
          continue;
        }

        // Check if already migrated
        if (scrapedData.migration_status === 'migrated') {
          results.push({ id: scrapedId, success: false, error: 'Already migrated' });
          continue;
        }

        // Find or create program
        let programId;
        const { data: existingProgram } = await serviceClient
          .from('programs')
          .select('id')
          .eq('code', scrapedData.program_code)
          .single();

        if (existingProgram) {
          programId = existingProgram.id;
        } else {
          const { data: newProgram, error: programError } = await serviceClient
            .from('programs')
            .insert({
              code: scrapedData.program_code,
              name: scrapedData.program_name || scrapedData.program_code,
              description: `Imported from scraped curriculum`
            })
            .select('id')
            .single();

          if (programError) {
            results.push({ id: scrapedId, success: false, error: `Failed to create program: ${programError.message}` });
            continue;
          }
          programId = newProgram.id;
        }

        // Create curriculum version
        const { data: curriculumVersion, error: cvError } = await serviceClient
          .from('curriculum_versions')
          .insert({
            program_id: programId,
            version_label: scrapedData.version_label || `${scrapedData.version_year}-${scrapedData.version_sem}`,
            version_year: scrapedData.version_year,
            version_sem: scrapedData.version_sem,
            is_active: true
          })
          .select('id')
          .single();

        if (cvError) {
          results.push({ id: scrapedId, success: false, error: `Failed to create curriculum version: ${cvError.message}` });
          continue;
        }

        // Parse and create courses from scraped courses JSON
        if (scrapedData.courses && Array.isArray(scrapedData.courses)) {
          for (const course of scrapedData.courses) {
            // Check if course exists
            let courseId;
            const { data: existingCourse } = await serviceClient
              .from('courses')
              .select('id')
              .eq('course_code', course.course_code)
              .single();

            if (existingCourse) {
              courseId = existingCourse.id;
            } else {
              const { data: newCourse } = await serviceClient
                .from('courses')
                .insert({
                  course_code: course.course_code,
                  course_title: course.course_title,
                  units: course.units,
                  prereq_expr: course.prerequisites
                })
                .select('id')
                .single();
              courseId = newCourse?.id;
            }

            // Create requirement group for this course
            if (courseId) {
              const { data: reqGroup } = await serviceClient
                .from('requirement_groups')
                .insert({
                  curriculum_id: curriculumVersion.id,
                  name: course.category || 'Core',
                  group_type: 'core',
                  min_units: course.units,
                  priority: course.year_level * 10 + course.semester
                })
                .select('id')
                .single();

              if (reqGroup) {
                await serviceClient
                  .from('requirement_rules')
                  .insert({
                    req_group_id: reqGroup.id,
                    rule_type: 'by_course',
                    course_ids: [courseId]
                  });
              }
            }
          }
        }

        // Mark as migrated
        await serviceClient
          .from('scraped_curriculum')
          .update({
            migration_status: 'migrated',
            approved_by_admin: user.id,
            approved_at: new Date().toISOString(),
            migrated_to_curriculum_id: curriculumVersion.id
          })
          .eq('id', scrapedId);

        // Create migration record
        await serviceClient
          .from('scrape_migrations')
          .insert({
            source_table: 'scraped_curriculum',
            source_id: scrapedId,
            target_table: 'curriculum_versions',
            target_id: curriculumVersion.id,
            status: 'migrated',
            admin_user_id: user.id,
            migrated_at: new Date().toISOString()
          });

        results.push({ id: scrapedId, success: true, curriculum_version_id: curriculumVersion.id });

      } catch (error: any) {
        console.error(`Error migrating ${scrapedId}:`, error);
        results.push({ id: scrapedId, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ message: 'Migration complete', results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
