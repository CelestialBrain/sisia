import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';
import { validateUUID } from '../_shared/api-validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const versionId = pathParts[pathParts.length - 1];

    if (!versionId || versionId === 'api-curriculum') {
      return errorResponse(400, 'MISSING_ID', 'Curriculum version ID is required');
    }

    const uuidValidation = validateUUID(versionId, 'version_id');
    if (!uuidValidation.valid) {
      return errorResponse(400, 'INVALID_ID', uuidValidation.error!);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Fetch curriculum version
    const { data: version, error: versionError } = await supabase
      .from('curriculum_versions')
      .select(`
        *,
        programs(id, name, code, total_units, schools(name, code)),
        program_tracks(id, track_code, track_name, description)
      `)
      .eq('id', versionId)
      .single();

    if (versionError) {
      if (versionError.code === 'PGRST116') {
        return errorResponse(404, 'NOT_FOUND', 'Curriculum version not found');
      }
      console.error('Database error:', versionError);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch curriculum version');
    }

    // Fetch requirement groups and rules
    const { data: groups, error: groupsError } = await supabase
      .from('requirement_groups')
      .select(`
        *,
        requirement_rules(*)
      `)
      .eq('curriculum_id', versionId)
      .order('display_order');

    if (groupsError) {
      console.error('Database error:', groupsError);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch requirement groups');
    }

    // Fetch course IDs from rules to get course details
    const courseIds: string[] = [];
    groups?.forEach(group => {
      group.requirement_rules?.forEach((rule: any) => {
        if (rule.course_ids && Array.isArray(rule.course_ids)) {
          courseIds.push(...rule.course_ids);
        }
      });
    });

    let courses: any[] = [];
    if (courseIds.length > 0) {
      const { data: courseData, error: coursesError } = await supabase
        .from('courses')
        .select('id, course_code, course_title, units, prereq_expr')
        .in('id', courseIds);

      if (!coursesError && courseData) {
        courses = courseData;
      }
    }

    // Build response with enriched data
    const enrichedGroups = groups?.map(group => ({
      ...group,
      requirement_rules: group.requirement_rules?.map((rule: any) => {
        const ruleCourses = rule.course_ids
          ? courses.filter(c => rule.course_ids.includes(c.id))
          : [];
        
        return {
          ...rule,
          courses: ruleCourses,
        };
      }),
    }));

    const response = {
      version,
      requirement_groups: enrichedGroups,
    };

    return successResponse(response);
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
