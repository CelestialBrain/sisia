import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';
import { validateTermCode } from '../_shared/api-validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const statType = pathParts[pathParts.length - 1];
    const termCode = url.searchParams.get('term');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    if (termCode) {
      const termValidation = validateTermCode(termCode);
      if (!termValidation.valid) {
        return errorResponse(400, 'INVALID_TERM', termValidation.error!);
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Overview stats
    if (statType === 'overview' || statType === 'api-stats') {
      const [coursesCount, schedulesCount, programsCount, schoolsCount] = await Promise.all([
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('aisis_schedules').select('*', { count: 'exact', head: true }).eq('deprecated', false),
        supabase.from('programs').select('*', { count: 'exact', head: true }),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
      ]);

      const stats = {
        total_courses: coursesCount.count || 0,
        total_schedules: schedulesCount.count || 0,
        total_programs: programsCount.count || 0,
        total_schools: schoolsCount.count || 0,
      };

      return successResponse(stats);
    }

    // Top instructors
    if (statType === 'instructors') {
      let query = supabase
        .from('aisis_schedules')
        .select('instructor')
        .eq('deprecated', false)
        .not('instructor', 'is', null);

      if (termCode) {
        query = query.eq('term_code', termCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error:', error);
        return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch instructor stats');
      }

      // Count occurrences
      const instructorCounts: Record<string, number> = {};
      data?.forEach(row => {
        const instructor = row.instructor?.trim();
        if (instructor) {
          instructorCounts[instructor] = (instructorCounts[instructor] || 0) + 1;
        }
      });

      // Sort and limit
      const topInstructors = Object.entries(instructorCounts)
        .map(([name, count]) => ({ name, section_count: count }))
        .sort((a, b) => b.section_count - a.section_count)
        .slice(0, Math.min(limit, 100));

      return successResponse(topInstructors);
    }

    // Department offerings
    if (statType === 'departments') {
      let query = supabase
        .from('aisis_schedules')
        .select('department')
        .eq('deprecated', false);

      if (termCode) {
        query = query.eq('term_code', termCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error:', error);
        return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch department stats');
      }

      // Count by department
      const deptCounts: Record<string, number> = {};
      data?.forEach(row => {
        const dept = row.department?.trim();
        if (dept) {
          deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        }
      });

      const departments = Object.entries(deptCounts)
        .map(([name, count]) => ({ department: name, section_count: count }))
        .sort((a, b) => b.section_count - a.section_count)
        .slice(0, Math.min(limit, 100));

      return successResponse(departments);
    }

    return errorResponse(400, 'INVALID_STAT_TYPE', 'Valid stat types: overview, instructors, departments');
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
