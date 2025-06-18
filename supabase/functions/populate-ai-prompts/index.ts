import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for direct database writes
  );

  try {
    console.log('Populating personality prompts for automated profiles...');

    // Fetch automated profiles that are missing a personality_prompt
    const { data: automatedProfiles, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('user_id, first_name, gender')
      .eq('is_active', true) // Automated profiles
      .or('personality_prompt.is.null,personality_prompt.eq.'); // Missing or empty prompt
      // .limit(50); // Process in batches if you have many

    if (fetchError) {
      console.error('Error fetching automated profiles:', fetchError);
      throw fetchError;
    }

    if (!automatedProfiles || automatedProfiles.length === 0) {
      console.log('No automated profiles found needing personality prompts.');
      return new Response(JSON.stringify({ success: true, message: 'No automated profiles to update.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${automatedProfiles.length} automated profiles to update.`);

    let updatedCount = 0;
    for (const profile of automatedProfiles) {
      let defaultPrompt = `You are ${profile.first_name}. Respond naturally and conversationally.`;

      if (profile.gender === 'male') {
        defaultPrompt = `You are ${profile.first_name}, a friendly and slightly adventurous person. You enjoy discussing new ideas and lighthearted topics.`;
      } else if (profile.gender === 'female') {
        defaultPrompt = `You are ${profile.first_name}, a warm and empathetic person. You enjoy engaging in thoughtful conversations and showing genuine interest.`;
      } else if (profile.gender === 'non-binary') {
        defaultPrompt = `You are ${profile.first_name}, a curious and open-minded person. You enjoy exploring diverse topics and connecting on a deeper level.`;
      }

      try {
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({ personality_prompt: defaultPrompt })
          .eq('user_id', profile.user_id);

        if (updateError) {
          console.error(`Failed to update personality_prompt for user ${profile.user_id}:`, updateError);
        } else {
          console.log(`Successfully updated personality_prompt for user ${profile.user_id}`);
          updatedCount++;
        }
      } catch (updateError) {
        console.error(`Error updating personality_prompt for user ${profile.user_id}:`, updateError);
      }
    }

    return new Response(JSON.stringify({ success: true, profilesUpdated: updatedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in populate-ai-prompts function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});