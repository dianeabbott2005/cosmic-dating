import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CITIES_AND_TIMEZONES = [
  { city: 'New York', country: 'US', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York' },
  { city: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles' },
  { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { city: 'Manchester', country: 'UK', lat: 53.4808, lng: -2.2426, timezone: 'Europe/London' },
  { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata' },
  { city: 'Delhi', country: 'India', lat: 28.7041, lng: 77.1025, timezone: 'Asia/Kolkata' },
  { city: 'Tokyo', country: 'Japan', lat: 35.6895, lng: 139.6917, timezone: 'Asia/Tokyo' },
  { city: 'Osaka', country: 'Japan', lat: 34.6937, lng: 135.5022, timezone: 'Asia/Tokyo' },
  { city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729, timezone: 'America/Sao_Paulo' },
  { city: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333, timezone: 'America/Sao_Paulo' },
  { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, timezone: 'Africa/Lagos' },
  { city: 'Abuja', country: 'Nigeria', lat: 9.0765, lng: 7.3986, timezone: 'Africa/Lagos' },
  { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin' },
  { city: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820, timezone: 'Europe/Berlin' },
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, timezone: 'Europe/Paris' },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332, timezone: 'America/Mexico_City' },
  { city: 'Guadalajara', country: 'Mexico', lat: 20.6597, lng: -103.3496, timezone: 'America/Mexico_City' },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, timezone: 'Africa/Cairo' },
  { city: 'Alexandria', country: 'Egypt', lat: 31.2001, lng: 29.9187, timezone: 'Africa/Cairo' },
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: profilesToUpdate, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('user_id, place_of_birth')
      .eq('is_active', true)
      .is('current_city', null);

    if (fetchError) {
      console.error('Error fetching profiles to update:', fetchError);
      throw fetchError;
    }

    if (!profilesToUpdate || profilesToUpdate.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No profiles to update.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let updatedCount = 0;
    for (const profile of profilesToUpdate) {
      const birthCityData = CITIES_AND_TIMEZONES.find(c => c.city === profile.place_of_birth) || getRandomElement(CITIES_AND_TIMEZONES);
      
      let currentCityData = birthCityData;
      if (Math.random() < 0.3) { // 30% chance to be in a different city
          currentCityData = getRandomElement(CITIES_AND_TIMEZONES);
      }

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
            current_city: currentCityData.city,
            current_country: currentCityData.country,
            current_timezone: currentCityData.timezone,
        })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error(`Failed to update current location for user ${profile.user_id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, profilesUpdated: updatedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in populate-current-location function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});