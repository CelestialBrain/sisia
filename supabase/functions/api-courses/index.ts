import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';
import { parsePaginationParams, buildPaginationMeta } from '../_shared/api-pagination.ts';
import { validateLimit, validateOffset } from '../_shared/api-validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const school = url.searchParams.get('school');
    const units = url.searchParams.get('units');
    const category = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    // Validate pagination
    const limitValidation = validateLimit(limitParam || undefined);
    if (!limitValidation.valid) {
      return errorResponse(400, 'INVALID_LIMIT', limitValidation.error!);
    }

    const offsetValidation = validateOffset(offsetParam || undefined);
    if (!offsetValidation.valid) {
      return errorResponse(400, 'INVALID_OFFSET', offsetValidation.error!);
    }

    const { limit, offset } = parsePaginationParams(limitParam || undefined, offsetParam || undefined);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    let query = supabase
      .from('courses')
      .select('id, course_code, course_title, units, category_tags, prereq_expr, school_id, is_university_wide, schools(name, code)', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`course_code.ilike.%${search}%,course_title.ilike.%${search}%`);
    }

    if (school) {
      query = query.eq('schools.code', school);
    }

    if (units) {
      const unitsNum = parseInt(units, 10);
      if (!isNaN(unitsNum)) {
        query = query.eq('units', unitsNum);
      }
    }

    if (category) {
      query = query.contains('category_tags', [category]);
    }

    // Apply pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('course_code');

    if (error) {
      console.error('Database error:', error);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch courses');
    }

    return successResponse(data, buildPaginationMeta(count, limit, offset));
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
