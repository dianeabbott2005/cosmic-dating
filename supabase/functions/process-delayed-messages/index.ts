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
  const baseDelay = 1000; // 1 second minimum per message
  const typingSpeed = Math.floor(Math.random() * (180 - 60 + 1)) + 60; // characters per minute (random between 60-180)
  
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
    // 1. Fetch pending messages that are due
    const now = new Date().toISOString();
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
      return new Response(JSON.stringify({ success: true, message: 'No messages to send.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Send each message and update its status
    for (const msg of delayedMessages) {
      try {
        // Introduce a typing delay before sending each message
        const delay = calculateTypingDelay(msg.content.length);
        await new Promise(resolve => setTimeout(resolve, delay));

        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert({
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            content: msg.content,
            is_processed: true // Mark the AI's message as processed upon sending
          });

        if (insertError) {
          console.error(`Failed to send message ${msg.id}:`, insertError);
          // Mark as failed but continue processing others
          await supabaseClient
            .from('delayed_messages')
            .update({ status: 'failed' })
            .eq('id', msg.id);
        } else {
          // If the message was sent successfully, delete the record from the delayed_messages table.
          // The context is now updated by the function that scheduled the message.
          const { error: deleteError } = await supabaseClient
            .from('delayed_messages')
            .delete()
            .eq('id', msg.id);

          if (deleteError) {
            console.error(`Failed to delete sent message ${msg.id}:`, deleteError);
            // If deletion fails, at least mark as sent to avoid re-processing
            await supabaseClient
              .from('delayed_messages')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', msg.id);
          }
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
    console.error('Error in delayed message processing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});