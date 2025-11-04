import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/api-response.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 1000);

    // Build query with safe public columns only
    let query = supabase
      .from('programs')
      .select('id, code, name, total_units, school_id, schools(id, code, name)')
      .order('name');

    // Apply search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    // Apply limit
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return errorResponse(500, 'DATABASE_ERROR', 'Failed to fetch programs', error);
    }

    // Transform data to flatten school object
    const programs = (data || []).map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      total_units: p.total_units,
      school_id: p.school_id,
      school: p.schools || null,
    }));

    return successResponse(programs, {
      total: programs.length,
      limit,
    });
  } catch (err) {
    console.error('Server error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', err);
  }
});
