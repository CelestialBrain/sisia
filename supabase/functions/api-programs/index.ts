import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';
import { parsePaginationParams, buildPaginationMeta } from '../_shared/api-pagination.ts';
import { validateUUID, validateLimit, validateOffset } from '../_shared/api-validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const programId = pathParts[pathParts.length - 1];
    const school = url.searchParams.get('school');
    const search = url.searchParams.get('search');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Check if requesting single program
    if (programId && programId !== 'api-programs') {
      const uuidValidation = validateUUID(programId, 'program_id');
      if (!uuidValidation.valid) {
        return errorResponse(400, 'INVALID_ID', uuidValidation.error!);
      }

      const { data, error } = await supabase
        .from('programs')
        .select(`
          *,
          schools(id, name, code),
          program_tracks(id, track_code, track_name, description),
          curriculum_versions(id, version_label, effective_start, effective_end, is_active)
        `)
        .eq('id', programId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return errorResponse(404, 'NOT_FOUND', 'Program not found');
        }
        console.error('Database error:', error);
        return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch program');
      }

      return successResponse(data);
    }

    // List programs with filters
    const limitValidation = validateLimit(limitParam || undefined);
    if (!limitValidation.valid) {
      return errorResponse(400, 'INVALID_LIMIT', limitValidation.error!);
    }

    const offsetValidation = validateOffset(offsetParam || undefined);
    if (!offsetValidation.valid) {
      return errorResponse(400, 'INVALID_OFFSET', offsetValidation.error!);
    }

    const { limit, offset } = parsePaginationParams(limitParam || undefined, offsetParam || undefined);

    let query = supabase
      .from('programs')
      .select(`
        *,
        schools(id, name, code),
        program_tracks(id, track_code, track_name)
      `, { count: 'exact' });

    if (school) {
      query = query.eq('schools.code', school);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('name');

    if (error) {
      console.error('Database error:', error);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch programs');
    }

    return successResponse(data, buildPaginationMeta(count, limit, offset));
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
