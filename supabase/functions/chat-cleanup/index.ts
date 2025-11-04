import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting chat cleanup at 8 AM PHT...');

    // Delete all files from storage
    const { data: files } = await supabaseAdmin.storage
      .from('chat-files')
      .list();
    
    if (files && files.length > 0) {
      const filePaths = files.map(f => f.name);
      await supabaseAdmin.storage
        .from('chat-files')
        .remove(filePaths);
      console.log(`Deleted ${filePaths.length} files from storage`);
    }

    // Delete all messages (cascades to read_receipts)
    const { error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (messagesError) throw messagesError;
    
    // Delete typing indicators
    const { error: typingError } = await supabaseAdmin
      .from('chat_typing_indicators')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000');
    
    if (typingError) throw typingError;

    console.log('Chat cleanup completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Chat cleared at 8 AM PHT' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
