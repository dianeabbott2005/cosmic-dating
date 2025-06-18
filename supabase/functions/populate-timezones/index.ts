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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for direct profile updates
  );

  try {
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured for timezone lookup.');
    }

    console.log('Populating timezones for profiles...');

    // Fetch profiles that need timezone data and have coordinates, and are human (is_active: false)
    const { data: profilesToUpdate, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('user_id, latitude, longitude, place_of_birth')
      .is('timezone', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('is_active', false) // Only process human profiles
      .limit(100); // Process in batches to avoid timeouts

    if (fetchError) {
      console.error('Error fetching profiles to update:', fetchError);
      throw fetchError;
    }

    if (!profilesToUpdate || profilesToUpdate.length === 0) {
      console.log('No profiles found needing timezone updates.');
      return new Response(JSON.stringify({ success: true, message: 'No profiles to update.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${profilesToUpdate.length} profiles to update timezone for.`);

    let updatedCount = 0;
    for (const profile of profilesToUpdate) {
      if (profile.latitude !== null && profile.longitude !== null) {
        try {
          const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp
          const timezoneApiUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${profile.latitude},${profile.longitude}&timestamp=${timestamp}&key=${googleMapsApiKey}`;
          
          const response = await fetch(timezoneApiUrl);
          const data = await response.json();

          if (data.status === 'OK' && data.timeZoneId) {
            const { error: updateError } = await supabaseClient
              .from('profiles')
              .update({ timezone: data.timeZoneId })
              .eq('user_id', profile.user_id);

            if (updateError) {
              console.error(`Failed to update timezone for user ${profile.user_id}:`, updateError);
            } else {
              console.log(`Successfully updated timezone for user ${profile.user_id} to ${data.timeZoneId}`);
              updatedCount++;
            }
          } else {
            console.warn(`Google Time Zone API error for user ${profile.user_id} (${profile.place_of_birth}):`, data.status, data.errorMessage);
          }
        } catch (apiError) {
          console.error(`Error calling Google Time Zone API for user ${profile.user_id}:`, apiError);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, profilesUpdated: updatedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in populate-timezones function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});