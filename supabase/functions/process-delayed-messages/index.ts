import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculates a human-like typing delay for a message.
 * @param messageLength The length of the message to be "typed".
 * @returns A delay in milliseconds.
 */
const calculateTypingDelay = (messageLength: number): number => {
  const baseDelay = 500; // 0.5 second minimum per message
  const typingSpeed = 250; // characters per minute
  const typingTime = (messageLength / typingSpeed) * 60 * 1000;
  
  let randomVariation = Math.random() * 500; // Up to 0.5 seconds random variation
  
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000); // Cap at 5 seconds to prevent excessive delays within the cron job
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for background tasks
  );

  try {
    console.log('Processing delayed messages...');
    const now = new Date().toISOString();

    // 1. Fetch pending messages that are due
    const { data: delayedMessages, error: fetchError } = await supabaseClient
      .from('delayed_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_send_time', now)
      .order('scheduled_send_time', { ascending: true }) // Process in order
      .limit(100); // Process in batches

    if (fetchError) {
      console.error('Error fetching delayed messages:', fetchError);
      throw fetchError;
    }

    if (!delayedMessages || delayedMessages.length === 0) {
      console.log('No delayed messages due for sending.');
      return new Response(JSON.stringify({ success: true, message: 'No messages to send.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${delayedMessages.length} messages to send.`);

    // 2. Send each message with a delay and update its status
    for (const msg of delayedMessages) {
      try {
        // Introduce a typing delay before sending each message
        const delay = calculateTypingDelay(msg.content.length);
        console.log(`Delaying message ${msg.id} by ${delay}ms for typing simulation.`);
        await new Promise(resolve => setTimeout(resolve, delay));

        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert({
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            content: msg.content
          });

        if (insertError) {
          console.error(`Failed to send delayed message ${msg.id}:`, insertError);
          // Mark as failed but continue processing others
          await supabaseClient
            .from('delayed_messages')
            .update({ status: 'failed' })
            .eq('id', msg.id);
        } else {
          console.log(`Successfully sent delayed message ${msg.id}`);
          await supabaseClient
            .from('delayed_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msg.id);
        }
      } catch (processError) {
        console.error(`Unexpected error processing message ${msg.id}:`, processError);
        await supabaseClient
          .from('delayed_messages')
          .update({ status: 'failed' })
          .eq('id', msg.id);
      }
    }

    return new Response(JSON.stringify({ success: true, messagesProcessed: delayedMessages.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-delayed-messages function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});