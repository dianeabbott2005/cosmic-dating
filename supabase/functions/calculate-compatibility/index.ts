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
  timezone: string;
}

interface CompatibilityRequest {
  person1: BirthChartData;
  person2: BirthChartData;
}

// --- Copied Constants for Astrological Calculations ---
const ZODIAC_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

const ELEMENTS = {
  fire: ['aries', 'leo', 'sagittarius'],
  earth: ['taurus', 'virgo', 'capricorn'],
  air: ['gemini', 'libra', 'aquarius'],
  water: ['cancer', 'scorpio', 'pisces']
};

const MODALITIES = {
  cardinal: ['aries', 'cancer', 'libra', 'capricorn'],
  fixed: ['taurus', 'leo', 'scorpio', 'aquarius'],
  mutable: ['gemini', 'virgo', 'sagittarius', 'pisces']
};

// --- Copied Zodiac Calculations ---
const getSunSign = (dateOfBirth: string): string => {
  const date = new Date(dateOfBirth);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'pisces';
  
  return 'aries'; // Default or error case
};

const getMoonSign = (dateOfBirth: string, timeOfBirth: string): string => {
  // This moon sign calculation is simplified and does not use ephemeris data.
  // It's a placeholder for a more complex calculation that would require a dedicated library.
  const date = new Date(dateOfBirth);
  const time = new Date(`${dateOfBirth}T${timeOfBirth}`);
  
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const hours = time.getHours() + (time.getMinutes() / 60);
  
  const moonCycle = ((dayOfYear + (hours / 24)) * 12 / 28) % 12;
  return ZODIAC_SIGNS[Math.floor(moonCycle)];
};

const getElement = (sign: string): string => {
  for (const [element, signs] of Object.entries(ELEMENTS)) {
    if (signs.includes(sign)) return element;
  }
  return 'fire'; // Default
};

const getModality = (sign: string): string => {
  for (const [modality, signs] of Object.entries(MODALITIES)) {
    if (signs.includes(sign)) return modality;
  }
  return 'cardinal'; // Default
};

// --- Copied Compatibility Calculations ---
const calculateElementCompatibility = (element1: string, element2: string): number => {
  const compatibleElements = {
    fire: { fire: 0.9, air: 0.8, earth: 0.4, water: 0.3 },
    earth: { earth: 0.9, water: 0.8, fire: 0.4, air: 0.3 },
    air: { air: 0.9, fire: 0.8, water: 0.4, earth: 0.3 },
    water: { water: 0.9, earth: 0.8, air: 0.4, fire: 0.3 }
  };
  
  return compatibleElements[element1 as keyof typeof compatibleElements]?.[element2 as keyof typeof compatibleElements.fire] || 0.5;
};

const calculateSunSignCompatibility = (sign1: string, sign2: string): number => {
  if (sign1 === sign2) return 0.85;
  
  const opposites = {
    aries: 'libra', taurus: 'scorpio', gemini: 'sagittarius',
    cancer: 'capricorn', leo: 'aquarius', virgo: 'pisces'
  };
  
  const reverseOpposites = Object.fromEntries(
    Object.entries(opposites).map(([k, v]) => [v, k])
  );
  
  if (opposites[sign1 as keyof typeof opposites] === sign2 || 
      reverseOpposites[sign1 as keyof typeof reverseOpposites] === sign2) {
    return 0.75;
  }
  
  const sign1Index = ZODIAC_SIGNS.indexOf(sign1);
  const sign2Index = ZODIAC_SIGNS.indexOf(sign2);
  const distance = Math.min(
    Math.abs(sign1Index - sign2Index),
    12 - Math.abs(sign1Index - sign2Index)
  );
  
  if (distance === 4) return 0.9; // Trine
  if (distance === 2) return 0.8; // Sextile
  if (distance === 3) return 0.4; // Square
  if (distance === 1 || distance === 5) return 0.6; // Conjunction/Quincunx (simplified)
  
  return 0.5; // Default
};

const calculateTimeCompatibility = (time1: string, time2: string): number => {
  const getHour = (time: string) => parseInt(time.split(':')[0]);
  
  const hour1 = getHour(time1);
  const hour2 = getHour(time2);
  
  const timeDiff = Math.abs(hour1 - hour2);
  const minDiff = Math.min(timeDiff, 24 - timeDiff);
  
  return Math.max(0.3, 1 - (minDiff / 12));
};

// --- Composite Compatibility Function ---
const calculateCompositeCompatibility = (person1: BirthChartData, person2: BirthChartData): number => {
  const sunSign1 = getSunSign(person1.dateOfBirth);
  const sunSign2 = getSunSign(person2.dateOfBirth);
  const moonSign1 = getMoonSign(person1.dateOfBirth, person1.timeOfBirth);
  const moonSign2 = getMoonSign(person2.dateOfBirth, person2.timeOfBirth);

  const element1 = getElement(sunSign1);
  const element2 = getElement(sunSign2);

  const sunComp = calculateSunSignCompatibility(sunSign1, sunSign2);
  const elementComp = calculateElementCompatibility(element1, element2);
  const timeComp = calculateTimeCompatibility(person1.timeOfBirth, person2.timeOfBirth);

  // Simple weighted average for composite score
  // Sun sign and element compatibility are generally more significant
  const compositeScore = (sunComp * 0.4) + (elementComp * 0.4) + (timeComp * 0.2);

  return compositeScore;
};


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { person1, person2 }: CompatibilityRequest = await req.json();

    console.log('calculateCompatibility (Edge): Calculating compatibility using integrated logic...');
    console.log('Person 1 data:', person1);
    console.log('Person 2 data:', person2);

    // Validate required data for astrological calculations
    // Note: Latitude, longitude, and timezone are still important for accurate astrological context,
    // even if not directly used in these simplified calculations.
    if (person1.latitude === null || person1.longitude === null || !person1.timezone ||
        person2.latitude === null || person2.longitude === null || !person2.timezone) {
      console.warn('Missing latitude, longitude, or timezone. Proceeding with simplified calculations.');
      // Optionally, throw an error or return a default score if these are strictly required.
      // For now, we'll proceed with the available data.
    }

    // Calculate compatibility score using the integrated functions
    const compatibilityScore = calculateCompositeCompatibility(person1, person2);
    
    console.log(`calculateCompatibility (Edge): Calculated composite compatibility score: ${Math.round(compatibilityScore * 100)}%`);

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