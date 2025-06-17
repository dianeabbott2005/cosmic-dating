import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCompatibility, BirthChartData } from 'https://esm.sh/astroreha@1.1.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use astroreha's getCompatibility function
    const compatibilityScore = getCompatibility(person1, person2);
    
    console.log(`calculateCompatibility (Edge): Calculated compatibility score: ${Math.round(compatibilityScore * 100)}%`);

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