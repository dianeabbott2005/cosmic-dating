import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

interface CompatibilityRequest {
  person1: BirthChartData;
  person2: BirthChartData;
}

// Fallback compatibility calculation (age-based)
const calculateFallbackCompatibility = (person1: BirthChartData, person2: BirthChartData): number => {
  const getAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age1 = getAge(person1.dateOfBirth);
  const age2 = getAge(person2.dateOfBirth);

  // Simple age difference compatibility
  const ageDiff = Math.abs(age1 - age2);
  let score = 1.0; // Max compatibility

  if (ageDiff <= 2) {
    score = 0.9; // Very compatible
  } else if (ageDiff <= 5) {
    score = 0.7; // Moderately compatible
  } else if (ageDiff <= 10) {
    score = 0.5; // Less compatible
  } else {
    score = 0.3; // Low compatibility
  }

  // Add some randomness for variety
  score = Math.max(0.3, Math.min(1.0, score + (Math.random() * 0.2 - 0.1))); // +/- 0.1 variation

  return score;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { person1, person2 }: CompatibilityRequest = await req.json();

    console.log('calculateCompatibility (Edge): Using fallback calculation...');
    console.log('Person 1 data:', person1);
    console.log('Person 2 data:', person2);

    const compatibilityScore = calculateFallbackCompatibility(person1, person2);
    
    console.log(`calculateCompatibility (Edge): Calculated fallback compatibility score: ${Math.round(compatibilityScore * 100)}%`);

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