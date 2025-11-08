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

    const { user_id, term_code } = await req.json();

    if (!user_id || !term_code) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or term_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only user can migrate their own schedules
    if (user.id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to migrate this user\'s data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch scraped schedules
    const { data: scrapedSchedules, error: fetchError } = await serviceClient
      .from('scraped_my_schedule')
      .select('*')
      .eq('user_id', user_id)
      .eq('term', term_code)
      .eq('migration_status', 'pending');

    if (fetchError || !scrapedSchedules || scrapedSchedules.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No schedules found to migrate' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user schedule
    const { data: userSchedule, error: scheduleError } = await serviceClient
      .from('user_schedules')
      .insert({
        user_id: user_id,
        name: `Imported ${term_code}`,
        term_code: term_code,
        is_active: true
      })
      .select('id')
      .single();

    if (scheduleError || !userSchedule) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user schedule' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and create schedule blocks
    const blocks = [];
    for (const scraped of scrapedSchedules) {
      // Parse schedule string (e.g., "MW 1:00-2:30PM")
      const scheduleMatch = scraped.schedule?.match(/([MTWTHFS]+)\s+(\d+):(\d+)\s*-\s*(\d+):(\d+)\s*(AM|PM)?/i);
      
      if (scheduleMatch) {
        const [_, days, startHour, startMin, endHour, endMin, period] = scheduleMatch;
        
        // Convert days to day numbers
        const dayMap: { [key: string]: number } = { 'M': 1, 'T': 2, 'W': 3, 'TH': 4, 'F': 5, 'S': 6 };
        const dayLetters = days.match(/TH|[MTWFS]/g) || [];
        
        for (const dayLetter of dayLetters) {
          const dayNum = dayMap[dayLetter];
          if (dayNum) {
            blocks.push({
              schedule_id: userSchedule.id,
              course_code: scraped.course_code,
              section: scraped.section,
              day_of_week: dayNum,
              start_time: `${startHour.padStart(2, '0')}:${startMin.padStart(2, '0')}:00`,
              end_time: `${endHour.padStart(2, '0')}:${endMin.padStart(2, '0')}:00`
            });
          }
        }
      }
    }

    if (blocks.length > 0) {
      const { error: blocksError } = await serviceClient
        .from('schedule_blocks')
        .insert(blocks);

      if (blocksError) {
        console.error('Failed to create schedule blocks:', blocksError);
      }
    }

    // Mark scraped schedules as migrated
    const scrapedIds = scrapedSchedules.map(s => s.id);
    await serviceClient
      .from('scraped_my_schedule')
      .update({
        migration_status: 'migrated',
        migrated_to_schedule_id: userSchedule.id
      })
      .in('id', scrapedIds);

    return new Response(
      JSON.stringify({ 
        message: 'Schedules migrated successfully', 
        schedule_id: userSchedule.id,
        blocks_created: blocks.length
      }),
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
