import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Removed: import { getCompatibility, BirthChartData } from 'https://esm.sh/astroreha@1.1.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BirthData {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude: number | null;
  longitude: number | null;
}

interface CompatibilityRequest {
  person1: BirthData;
  person2: BirthData;
}

const calculateFallbackCompatibility = (person1: BirthData, person2: BirthData): number => {
  try {
    const date1 = new Date(person1.dateOfBirth);
    const date2 = new Date(person2.dateOfBirth);

    const ageDiff = Math.abs(date1.getFullYear() - date2.getFullYear());
    const ageCompatibility = Math.max(0.3, 1 - (ageDiff * 0.02));
    const randomFactor = 0.4 + (Math.random() * 0.5);

    return Math.min(ageCompatibility * randomFactor, 0.95);
  } catch (error) {
    console.error('calculateFallbackCompatibility (Edge): Error in fallback compatibility calculation:', error);
    return 0.5;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { person1, person2 }: CompatibilityRequest = await req.json();

    // Always use the fallback compatibility calculation due to astroreha incompatibility
    const compatibilityScore = calculateFallbackCompatibility(person1, person2);
    console.log(`calculateCompatibility (Edge): Using fallback compatibility score: ${Math.round(compatibilityScore * 100)}%`);

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