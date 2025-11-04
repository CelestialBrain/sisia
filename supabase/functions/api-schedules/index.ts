import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';
import { parsePaginationParams, buildPaginationMeta } from '../_shared/api-pagination.ts';
import { validateTermCode, validateLimit, validateOffset, validateDays } from '../_shared/api-validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const termCode = url.searchParams.get('term');
    const department = url.searchParams.get('department');
    const courseCode = url.searchParams.get('course');
    const instructor = url.searchParams.get('instructor');
    const days = url.searchParams.get('days');
    const room = url.searchParams.get('room');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    // Validate term code
    if (termCode) {
      const termValidation = validateTermCode(termCode);
      if (!termValidation.valid) {
        return errorResponse(400, 'INVALID_TERM', termValidation.error!);
      }
    }

    // Validate days
    if (days) {
      const daysValidation = validateDays(days);
      if (!daysValidation.valid) {
        return errorResponse(400, 'INVALID_DAYS', daysValidation.error!);
      }
    }

    // Validate pagination
    const limitValidation = validateLimit(limitParam || undefined, 200);
    if (!limitValidation.valid) {
      return errorResponse(400, 'INVALID_LIMIT', limitValidation.error!);
    }

    const offsetValidation = validateOffset(offsetParam || undefined);
    if (!offsetValidation.valid) {
      return errorResponse(400, 'INVALID_OFFSET', offsetValidation.error!);
    }

    const { limit, offset } = parsePaginationParams(limitParam || undefined, offsetParam || undefined, 50, 200);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    let query = supabase
      .from('aisis_schedules')
      .select('*', { count: 'exact' })
      .eq('deprecated', false);

    // Apply filters
    if (termCode) {
      query = query.eq('term_code', termCode);
    }

    if (department) {
      query = query.eq('department', department);
    }

    if (courseCode) {
      query = query.ilike('subject_code', `${courseCode}%`);
    }

    if (instructor) {
      query = query.ilike('instructor', `%${instructor}%`);
    }

    if (room) {
      query = query.ilike('room', `%${room}%`);
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('subject_code')
      .order('section');

    if (error) {
      console.error('Database error:', error);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch schedules');
    }

    // Post-filter by days if specified
    let filteredData = data;
    if (days && data) {
      const requestedDays = days.split(',').map(d => parseInt(d.trim(), 10));
      filteredData = data.filter(schedule => {
        if (!schedule.days_of_week || !Array.isArray(schedule.days_of_week)) {
          return false;
        }
        // Check if schedule days overlap with requested days
        return schedule.days_of_week.some((day: number) => requestedDays.includes(day));
      });
    }

    return successResponse(filteredData, buildPaginationMeta(count, limit, offset));
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
