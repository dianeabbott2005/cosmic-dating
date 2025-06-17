import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getNatalChart, getCompatibility } from 'https://esm.sh/astroreha';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BirthChartData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

interface CompatibilityRequest {
  person1: BirthChartData;
  person2: BirthChartData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { person1, person2 }: CompatibilityRequest = await req.json();

    console.log('calculateCompatibility (Edge): Calculating compatibility using astroreha...');
    console.log('Person 1 data:', person1);
    console.log('Person 2 data:', person2);

    // Validate required data for astrological calculations
    if (person1.latitude === null || person1.longitude === null || !person1.timezone ||
        person2.latitude === null || person2.longitude === null || !person2.timezone) {
      throw new Error('Missing latitude, longitude, or timezone for accurate astrological calculations.');
    }

    // Create Date objects. It's crucial to interpret these in the context of their birth timezone.
    // astroreha's getNatalChart should handle the timezone string correctly.
    // We create a Date object from the date and time strings.
    const birthDateTime1 = new Date(`${person1.dateOfBirth}T${person1.timeOfBirth}:00`);
    const birthDateTime2 = new Date(`${person2.dateOfBirth}T${person2.timeOfBirth}:00`);

    // Create natal charts using astroreha
    const chart1 = getNatalChart({
      date: birthDateTime1,
      latitude: person1.latitude,
      longitude: person1.longitude,
      timezone: person1.timezone,
      place: person1.placeOfBirth
    });

    const chart2 = getNatalChart({
      date: birthDateTime2,
      latitude: person2.latitude,
      longitude: person2.longitude,
      timezone: person2.timezone,
      place: person2.placeOfBirth
    });

    // Calculate compatibility score using astroreha
    const compatibilityResult = getCompatibility(chart1, chart2);

    // astroreha's getCompatibility returns an object with a 'score' property (0-100)
    // We need to normalize it to 0-1 range for consistency with previous logic.
    const compatibilityScore = (compatibilityResult.score || 0) / 100;
    
    console.log(`calculateCompatibility (Edge): Calculated astroreha compatibility score: ${Math.round(compatibilityScore * 100)}%`);

    return new Response(JSON.stringify({ score: compatibilityScore }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-compatibility function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});