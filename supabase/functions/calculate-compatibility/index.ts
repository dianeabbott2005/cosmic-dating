import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCompatibility, BirthChartData } from 'https://esm.sh/astroreha@1.1.5';

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

    let compatibilityScore: number;

    // Ensure all necessary birth data is present for astroreha
    if (!person1.dateOfBirth || !person1.timeOfBirth || person1.latitude === null || person1.longitude === null ||
        !person2.dateOfBirth || !person2.timeOfBirth || person2.latitude === null || person2.longitude === null) {
      console.warn('calculateCompatibility (Edge): Missing complete birth data for astroreha. Falling back to basic compatibility.');
      compatibilityScore = calculateFallbackCompatibility(person1, person2);
    } else {
      try {
        const chart1: BirthChartData = {
          date: new Date(person1.dateOfBirth),
          time: person1.timeOfBirth,
          lat: person1.latitude,
          lon: person1.longitude,
        };

        const chart2: BirthChartData = {
          date: new Date(person2.dateOfBirth),
          time: person2.timeOfBirth,
          lat: person2.latitude,
          lon: person2.longitude,
        };

        const rawScore = getCompatibility(chart1, chart2);
        compatibilityScore = Math.min(0.99, Math.max(0.1, rawScore)); // Ensure score is within a reasonable range
        console.log(`calculateCompatibility (Edge): Astroreha compatibility score: ${Math.round(compatibilityScore * 100)}%`);

      } catch (astrorehaError) {
        console.error('calculateCompatibility (Edge): Error calculating astrological compatibility with astroreha:', astrorehaError);
        compatibilityScore = calculateFallbackCompatibility(person1, person2);
        console.log(`calculateCompatibility (Edge): Falling back to score: ${Math.round(compatibilityScore * 100)}% due to astroreha error.`);
      }
    }

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