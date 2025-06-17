import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

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

interface GenerateMatchesRequest {
  user_id: string;
}

// --- Astrological Constants (copied for self-containment) ---
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

// --- Zodiac Calculations (copied for self-containment) ---
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

// --- Compatibility Calculations (copied for self-containment) ---
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
  const compositeScore = (sunComp * 0.4) + (elementComp * 0.4) + (timeComp * 0.2);

  return compositeScore;
};

// Helper function to calculate accurate age
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
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
    const { user_id }: GenerateMatchesRequest = await req.json();

    console.log('generate-matches (Edge): Starting match generation for user:', user_id);

    // Get current user's profile
    const { data: userProfile, error: userProfileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (userProfileError || !userProfile) {
      console.error('generate-matches (Edge): Error fetching user profile or profile not found:', userProfileError?.message || 'Profile not found');
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('generate-matches (Edge): User profile fetched:', userProfile.first_name);
    console.log(`generate-matches (Edge): User's gender: '${userProfile.gender}', looking_for: '${userProfile.looking_for}'`);
    console.log(`generate-matches (Edge): User's min_age: ${userProfile.min_age}, max_age: ${userProfile.max_age}`);
    const userAge = calculateAge(userProfile.date_of_birth);
    console.log('generate-matches (Edge): User age:', userAge);


    // Log the filters being applied for potential profiles
    console.log(`generate-matches (Edge): Querying for profiles where gender is '${userProfile.looking_for}' AND looking_for is '${userProfile.gender}' AND user_id is NOT '${user_id}' AND is_dummy_profile is FALSE.`);

    // Get potential matches based on mutual preferences
    const { data: potentialProfiles, error: potentialProfilesError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('gender', userProfile.looking_for) // Match has the gender current user is looking for
      .eq('looking_for', userProfile.gender) // Match is looking for current user's gender
      .neq('user_id', user_id)
      .eq('is_dummy_profile', false); // Exclude dummy profiles from being matched with real users

    if (potentialProfilesError) {
      console.error('generate-matches (Edge): Error fetching potential profiles:', potentialProfilesError.message);
      throw potentialProfilesError;
    }

    if (!potentialProfiles || potentialProfiles.length === 0) {
      console.log('generate-matches (Edge): No potential profiles found matching initial criteria.');
      console.log(`generate-matches (Edge): User's preferences: gender='${userProfile.gender}', looking_for='${userProfile.looking_for}'`);
      
      // --- DEBUGGING: Fetch all non-dummy profiles to see if any exist at all ---
      const { data: allNonDummyProfiles, error: allProfilesError } = await supabaseClient
        .from('profiles')
        .select('user_id, first_name, gender, looking_for, date_of_birth, min_age, max_age')
        .neq('user_id', user_id)
        .eq('is_dummy_profile', false);

      if (allProfilesError) {
        console.error('generate-matches (Edge): Error fetching all non-dummy profiles for debug:', allProfilesError.message);
      } else {
        console.log(`generate-matches (Edge): Total non-dummy profiles (excluding self): ${allNonDummyProfiles?.length || 0}`);
        if (allNonDummyProfiles && allNonDummyProfiles.length > 0) {
          console.log('generate-matches (Edge): Details of all non-dummy profiles:');
          allNonDummyProfiles.forEach(p => {
            const pAge = calculateAge(p.date_of_birth);
            console.log(`  - ID: ${p.user_id}, Name: ${p.first_name}, Gender: '${p.gender}', Looking For: '${p.looking_for}', Age: ${pAge}, Min Age: ${p.min_age}, Max Age: ${p.max_age}`);
          });
        } else {
          console.log('generate-matches (Edge): No other non-dummy profiles found in the database at all.');
        }
      }
      // --- END DEBUGGING ---

      return new Response(JSON.stringify({ success: true, message: 'No potential matches found.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('generate-matches (Edge): Found', potentialProfiles.length, 'potential profiles for detailed check after initial gender/looking_for filter.');

    // Prepare user's birth data for compatibility calculation
    const userBirthData: BirthChartData = {
      dateOfBirth: userProfile.date_of_birth,
      timeOfBirth: userProfile.time_of_birth,
      placeOfBirth: userProfile.place_of_birth,
      latitude: userProfile.latitude,
      longitude: userProfile.longitude,
      timezone: userProfile.timezone
    };

    const COMPATIBILITY_THRESHOLD = 0.65; // This threshold can be adjusted
    let matchesGeneratedCount = 0;

    // Calculate compatibility and filter by mutual age preferences
    for (const matchProfile of potentialProfiles) {
      try {
        const matchAge = calculateAge(matchProfile.date_of_birth);
        console.log(`generate-matches (Edge): Processing match ${matchProfile.first_name} (ID: ${matchProfile.user_id}), age: ${matchAge}`);
        console.log(`generate-matches (Edge): Match's gender: '${matchProfile.gender}', looking_for: '${matchProfile.looking_for}'`);


        // Check mutual age preferences
        const userFitsMatchAgeRange = userAge >= matchProfile.min_age && userAge <= matchProfile.max_age;
        const matchFitsUserAgeRange = matchAge >= userProfile.min_age && matchAge <= userProfile.max_age;

        console.log(`generate-matches (Edge): Age compatibility for ${matchProfile.first_name} - User fits match range: ${userFitsMatchAgeRange}, Match fits user range: ${matchFitsUserAgeRange}`);

        if (!userFitsMatchAgeRange || !matchFitsUserAgeRange) {
          console.log(`generate-matches (Edge): Age mismatch for ${matchProfile.first_name}. Skipping.`);
          continue;
        }

        // Prepare match's birth data for compatibility calculation
        const matchBirthData: BirthChartData = {
          dateOfBirth: matchProfile.date_of_birth,
          timeOfBirth: matchProfile.time_of_birth,
          placeOfBirth: matchProfile.place_of_birth,
          latitude: matchProfile.latitude,
          longitude: matchProfile.longitude,
          timezone: matchProfile.timezone
        };

        const compatibilityScore = calculateCompositeCompatibility(userBirthData, matchBirthData);
        console.log(`generate-matches (Edge): Compatibility score for ${matchProfile.first_name}: ${compatibilityScore}`);

        if (compatibilityScore >= COMPATIBILITY_THRESHOLD) {
          // Store bidirectional matches in database using the RPC function
          const { error: rpcError } = await supabaseClient.rpc('create_bidirectional_match', {
            user1_uuid: user_id,
            user2_uuid: matchProfile.user_id,
            compatibility_score_val: compatibilityScore
          });
          
          if (rpcError) {
            console.error('generate-matches (Edge): Error creating bidirectional match for:', matchProfile.user_id, rpcError.message);
          } else {
            console.log('generate-matches (Edge): Successfully created bidirectional match for:', matchProfile.user_id);
            matchesGeneratedCount++;
          }
        } else {
          console.log(`generate-matches (Edge): Match ${matchProfile.first_name} (ID: ${matchProfile.user_id}) below compatibility threshold (${compatibilityScore}). Skipping.`);
        }
      } catch (error: any) {
        console.error('generate-matches (Edge): Error processing match:', matchProfile.user_id, error.message);
      }
    }

    console.log(`generate-matches (Edge): Finished. Generated/updated ${matchesGeneratedCount} matches.`);

    return new Response(JSON.stringify({ success: true, matchesGenerated: matchesGeneratedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('generate-matches (Edge): Top-level error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});