import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { data: roles, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      throw new Error('Unauthorized: Admin access required')
    }

    const { functionName, limit = 100 } = await req.json()

    // Query Supabase analytics logs
    const logQuery = `
      SELECT 
        event_message,
        event_type,
        timestamp,
        metadata
      FROM edge_logs
      WHERE metadata->>'function_id' IN (
        SELECT id FROM functions WHERE name = '${functionName}'
      )
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `

    // For now, return mock structure since we can't directly query analytics
    // In production, this would use Supabase Management API
    const logs = [
      {
        timestamp: Date.now() * 1000,
        event_message: `Logs for ${functionName} function`,
        event_type: 'Log',
        level: 'info',
        function_id: functionName
      }
    ]

    return new Response(
      JSON.stringify({ logs }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error fetching logs:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
