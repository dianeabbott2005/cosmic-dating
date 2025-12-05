import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Data for Profile Generation ---

const FIRST_NAMES_MALE = {
  'US': ['Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore', 'Michael', 'David', 'Richard', 'Charles', 'Joseph'],
  'GB': ['Noah', 'George', 'Oliver', 'Muhammad', 'Arthur', 'Leo', 'Harry', 'Oscar', 'Henry', 'Theodore', 'James', 'Jack', 'Charlie', 'Oisin', 'Cillian', 'Thomas'],
  'IN': ['Muhammad', 'Shivansh', 'Dhruv', 'Kabir', 'Vedant', 'Kiaan', 'Aarav', 'Arjun', 'Viraj', 'Krishna'],
  'JP': ['Aoi', 'Nagi', 'Ren', 'Haruto', 'Minato', 'Sōma', 'Itsuki', 'Yamato', 'Yūma', 'Dan'],
  'BR': ['Miguel', 'Arthur', 'Gael', 'Théo', 'Heitor', 'Ravi', 'Davi', 'Berrdo', 'Noah', 'Gabriel', 'José', 'João', 'Antônio', 'Francisco', 'Carlos'],
  'NG': ['Adekunle', 'Babatunde', 'Chukwuemeka', 'Dayo', 'Efe', 'Folarin', 'Gbenga', 'Ikenna', 'Jide', 'Obinna'],
  'DE': ['Noah', 'Matteo', 'Elias', 'Finn', 'Leon', 'Theo', 'Paul', 'Emil', 'Henry', 'Ben', 'Maximilian', 'Alexander', 'Jakob', 'Anton', 'Oskar'],
  'FR': ['Léo', 'Gabriel', 'Raphaël', 'Arthur', 'Louis', 'Maël', 'Lucas', 'Adam', 'Tiago', 'Hugo', 'Enzo', 'Nathan', 'Tom', 'Ethan', 'Clément'],
  'MX': ['Santiago', 'Mateo', 'Sebastián', 'Leordo', 'Matías', 'Emiliano', 'Diego', 'Daniel', 'Miguel Ángel', 'Alexander', 'Javier', 'Carlos', 'Ricardo', 'Fernando', 'Arturo'],
  'EG': ['Peter', 'George', 'John', 'Mina', 'Beshoi', 'Kirollos', 'Mark', 'Fadi', 'Habib', 'Mohamed', 'Youssef', 'Ahmed', 'Mahmoud', 'Mustafa', 'Yassin'],
};
const FIRST_NAMES_FEMALE = {
  'US': ['Olivia', 'Emma', 'Charlotte', 'Amelia', 'Sophia', 'Isabella', 'Ava', 'Mia', 'Evelyn', 'Luna', 'Mary', 'Patricia', 'Linda', 'Barbara', 'Elizabeth'],
  'GB': ['Olivia', 'Amelia', 'Isla', 'Ava', 'Ivy', 'Florence', 'Lily', 'Freya', 'Mia', 'Willow', 'Grace', 'Emily', 'Fiadh', 'Aoife', 'Annie'],
  'IN': ['Aditi', 'Inaya', 'Aarya', 'Kiara', 'Aadhya', 'Vamika', 'Pari', 'Jiya', 'Mehar', 'Amayra'],
  'JP': ['Himari', 'Rin', 'Uta', 'Hina', 'Yuina', 'An', 'Mio', 'Yua', 'Mei', 'Riko', 'Sakura', 'Ema'],
  'BR': ['Helena', 'Alice', 'Laura', 'Maria Alice', 'Sophia', 'Manuela', 'Maitê', 'Liz', 'Cecília', 'Isabella', 'Maria', 'Ana', 'Francisca', 'Antônia', 'Adriana'],
  'NG': ['Adanna', 'Bimpe', 'Chidinma', 'Eniola', 'Funmilayo', 'Habiba', 'Ifeoma', 'Jumoke', 'Nkechi', 'Omolara'],
  'DE': ['Emilia', 'Mia', 'Sophia', 'Emma', 'Hannah', 'Lina', 'Mila', 'Ella', 'Leni', 'Clara'],
  'FR': ['Jade', 'Emma', 'Louise', 'Mia', 'Alice', 'Lina', 'Ambre', 'Rose', 'Chloé', 'Anna', 'Manon', 'Camille', 'Inès', 'Sarah', 'Juliette'],
  'MX': ['Sofía', 'Valentina', 'Regina', 'María José', 'Ximena', 'Camila', 'María Fernanda', 'Valeria', 'Victoria', 'Renata', 'Daniela', 'Paulina', 'Alejandra', 'Gabriela', 'Luciana'],
  'EG': ['Mary', 'Marina', 'Irene', 'Malak', 'Habiba', 'Hana', 'Farah', 'Marwa', 'Nada', 'Salma', 'Shaimaa', 'Fatma', 'Maha', 'Reem', 'Farida'],
};
const LAST_NAMES = {
  'US': ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez'],
  'GB': ['Brown', 'Smith', 'Patel', 'Jones', 'Williams', 'Johnson', 'Taylor', 'Thomas', 'Roberts', 'Khan', 'Lewis', 'Jackson', 'Clarke', 'James', 'Phillips'],
  'IN': ['Devi', 'Kumar', 'Singh', 'Sharma', 'Ali', 'Yadav', 'Patel', 'Chopra', 'Malhotra', 'Rao', 'Iyer', 'Menon'],
  'JP': ['Satō', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Itō', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Katō', 'Yoshida', 'Yamada', 'Sasaki', 'Matsumoto', 'Inoue'],
  'BR': ['Silva', 'Santos', 'Sousa', 'Oliveira', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Rodrigues', 'Almeida', 'Costa', 'Gomes', 'Martins', 'Araújo', 'Melo'],
  'NG': ['Adeboye', 'Bankole', 'Chidubem', 'Danjuma', 'Ekwueme', 'Fagbenle', 'Gowon', 'Iwu', 'Jega', 'Kuti'],
  'DE': ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Meyer', 'Weber', 'Wagner', 'Schulz', 'Becker', 'Hoffmann', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder'],
  'FR': ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia'],
  'MX': ['Hernández', 'García', 'Martínez', 'González', 'López', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Flores', 'Gómez', 'Torres', 'Díaz', 'Vásquez', 'Cruz'],
  'EG': ['El-Masry', 'Shalaby', 'Fahmy', 'Ghanem', 'Ramadan', 'Diab', 'Zaki', 'Adel', 'Kamal', 'Mansour'],
};

const REGIONS = ['US', 'GB', 'IN', 'JP', 'BR', 'NG', 'DE', 'FR', 'MX', 'EG'];
const CITIES_AND_TIMEZONES = [
  { city: 'New York', country: 'US', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York' },
  { city: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles' },
  { city: 'London', country: 'GB', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { city: 'Manchester', country: 'GB', lat: 53.4808, lng: -2.2426, timezone: 'Europe/London' },
  { city: 'Mumbai', country: 'IN', lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata' },
  { city: 'Delhi', country: 'IN', lat: 28.7041, lng: 77.1025, timezone: 'Asia/Kolkata' },
  { city: 'Tokyo', country: 'JP', lat: 35.6895, lng: 139.6917, timezone: 'Asia/Tokyo' },
  { city: 'Osaka', country: 'JP', lat: 34.6937, lng: 135.5022, timezone: 'Asia/Tokyo' },
  { city: 'Rio de Janeiro', country: 'BR', lat: -22.9068, lng: -43.1729, timezone: 'America/Sao_Paulo' },
  { city: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333, timezone: 'America/Sao_Paulo' },
  { city: 'Lagos', country: 'NG', lat: 6.5244, lng: 3.3792, timezone: 'Africa/Lagos' },
  { city: 'Abuja', country: 'NG', lat: 9.0765, lng: 7.3986, timezone: 'Africa/Lagos' },
  { city: 'Berlin', country: 'DE', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin' },
  { city: 'Munich', country: 'DE', lat: 48.1351, lng: 11.5820, timezone: 'Europe/Berlin' },
  { city: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
  { city: 'Marseille', country: 'FR', lat: 43.2965, lng: 5.3698, timezone: 'Europe/Paris' },
  { city: 'Mexico City', country: 'MX', lat: 19.4326, lng: -99.1332, timezone: 'America/Mexico_City' },
  { city: 'Guadalajara', country: 'MX', lat: 20.6597, lng: -103.3496, timezone: 'America/Mexico_City' },
  { city: 'Cairo', country: 'EG', lat: 30.0444, lng: 31.2357, timezone: 'Africa/Cairo' },
  { city: 'Alexandria', country: 'EG', lat: 31.2001, lng: 29.9187, timezone: 'Africa/Cairo' },
];
const PROFESSIONS = [
  'Software Engineer', 'Teacher', 'Artist', 'Doctor', 'Marketing Specialist',
  'Chef', 'Musician', 'Accountant', 'Journalist', 'Architect',
  'Graphic Designer', 'Nurse', 'Entrepreneur', 'Student', 'Consultant',
  'Data Scientist', 'Photographer', 'Writer', 'Fitness Trainer', 'Lawyer',
  'Librarian', 'Veterinarian', 'Social Worker', 'Electrician', 'Plumber',
  'Pilot', 'Flight Attendant', 'Scientist', 'Researcher', 'Historian'
];
const APP_DISCOVERY_METHODS = ['X (formerly Twitter)', 'Reddit'];

const zodiacSigns = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];
const genders = ["Male", "Female", "Non-binary", "Prefer not to say"];
const cultures = [
  "Latinx", "Asian", "African American", "European", "Middle Eastern", "Mixed Heritage",
  "South Asian", "Indigenous", "Pacific Islander", "Caribbean", "Scandinavian", "East African",
  "Central Asian", "North African", "West African", "Southeast Asian", "Balkan", "Celtic",
  "Polynesian", "Mediterranean", "Andean", "Himalayan", "Amazonian", "Arctic Indigenous",
  "South American Mestizo", "Saharan", "Caucasian", "Melanesian", "Micronesian", "Sub-Saharan",
  "Iberian", "Slavic", "Nordic", "Baltic", "South Pacific", "Afro-Caribbean", "Creole"
];
const zodiacData = {
  Aries: {
    traits: ["Bold", "Adventurous", "Energetic", "Courageous"],
    quirks: ["Always wears a lucky charm", "Talks in movie quotes", "Loves spicy food challenges"],
    flaws: ["Impulsive", "Too competitive", "Struggles with patience"]
  },
  Taurus: {
    traits: ["Grounded", "Sensual", "Patient", "Reliable"],
    quirks: ["Collects vintage maps", "Obsessed with miniature models", "Always has a book in hand"],
    flaws: ["Stubborn", "Overly cautious", "Resistant to change"]
  },
  Gemini: {
    traits: ["Witty", "Curious", "Adaptable", "Sociable"],
    quirks: ["Talks to themselves in public", "Can't resist a good pun", "Loves solving puzzles"],
    flaws: ["Indecisive", "Easily distracted", "Overthinks everything"]
  },
  Cancer: {
    traits: ["Nurturing", "Emotional", "Intuitive", "Protective"],
    quirks: ["Names their houseplants", "Keeps a dream journal", "Collects pressed flowers"],
    flaws: ["Overly sentimental", "Avoids confrontation", "Too self-critical"]
  },
  Leo: {
    traits: ["Charismatic", "Confident", "Generous", "Loyal"],
    quirks: ["Wears themed outfits", "Always has a pocketknife", "Loves retro video games"],
    flaws: ["Too prideful", "Hates asking for help", "Overly dramatic"]
  },
  Virgo: {
    traits: ["Detail-oriented", "Practical", "Analytical", "Organized"],
    quirks: ["Obsessed with origami", "Always carries a tiny umbrella", "Loves vintage typewriters"],
    flaws: ["Perfectionist", "Overly critical", "Struggles with spontaneity"]
  },
  Libra: {
    traits: ["Charming", "Diplomatic", "Romantic", "Balanced"],
    quirks: ["Wears a signature hat", "Talks in rhymes sometimes", "Loves old radio shows"],
    flaws: ["Indecisive", "Avoids conflict", "Overly idealistic"]
  },
  Scorpio: {
    traits: ["Intense", "Mysterious", "Passionate", "Resourceful"],
    quirks: ["Writes poetry under the full moon", "Fascinated by conspiracy theories", "Practices bird calls"],
    flaws: ["Secretive", "Holds grudges", "Overly suspicious"]
  },
  Sagittarius: {
    traits: ["Free-spirited", "Optimistic", "Adventurous", "Philosophical"],
    quirks: ["Collects unusual souvenirs", "Always wears mismatched socks", "Loves stargazing"],
    flaws: ["Tactless", "Restless", "Overly blunt"]
  },
  Capricorn: {
    traits: ["Ambitious", "Disciplined", "Practical", "Resilient"],
    quirks: ["Builds tiny furniture for pets", "Always has a sketchbook", "Obsessed with sci-fi novels"],
    flaws: ["Pessimistic", "Workaholic", "Too serious"]
  },
  Aquarius: {
    traits: ["Innovative", "Independent", "Humanitarian", "Eccentric"],
    quirks: ["Talks to plants", "Loves conspiracy theories", "Collects colorful rocks"],
    flaws: ["Detached", "Unpredictable", "Stubbornly independent"]
  },
  Pisces: {
    traits: ["Dreamy", "Empathetic", "Creative", "Intuitive"],
    quirks: ["Sings in the shower", "Doodles on everything", "Keeps a dream journal"],
    flaws: ["Escapist", "Overly sensitive", "Indecisive"]
  }
};

// --- Helper Functions ---
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomDateInZodiac(sign: keyof typeof zodiacData, minAge = 18, maxAge = 60): string {
  const ranges = {
    Aries: ["03-21", "04-19"], Taurus: ["04-20", "05-20"], Gemini: ["05-21", "06-20"],
    Cancer: ["06-21", "07-22"], Leo: ["07-23", "08-22"], Virgo: ["08-23", "09-22"],
    Libra: ["09-23", "10-22"], Scorpio: ["10-23", "11-21"], Sagittarius: ["11-22", "12-21"],
    Capricorn: ["12-22", "01-19"], Aquarius: ["01-20", "02-18"], Pisces: ["02-19", "03-20"],
  };

  const [startMonthDay, endMonthDay] = ranges[sign];
  const [startMonth, startDay] = startMonthDay.split('-').map(Number);
  const [endMonth, endDay] = endMonthDay.split('-').map(Number);

  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - (Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge);

  let startDate = new Date(birthYear, startMonth - 1, startDay);
  let endDate = new Date(birthYear, endMonth - 1, endDay);

  if (sign === 'Capricorn') {
    endDate = new Date(birthYear + 1, endMonth - 1, endDay);
  }

  const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
  const randomDate = new Date(randomTime);

  return randomDate.toISOString().split('T')[0];
}

function generateRandomTimeOfBirth(): string {
  const hour = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function generateRandomEmail(firstName: string, lastName: string): string {
  const domain = getRandomElement(['example.com', 'mail.com', 'web.net', 'inbox.org']);
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const sanitizedFirstName = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
  const sanitizedLastName = lastName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
  return `${sanitizedFirstName.toLowerCase()}.${sanitizedLastName.toLowerCase()}${uniqueId}@${domain}`;
}

function generateRandomPassword(): string {
  return Math.random().toString(36).substring(2, 15);
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function generatePersonalityPrompt(profile: any): string {
  let prompt = `You are ${profile.first_name}, a ${profile.age}-year-old ${profile.gender} of ${profile.culture} heritage. Your sun sign is ${profile.zodiacSign}.`;
  prompt += ` You are known for being ${profile.trait}, but can sometimes be ${profile.flaw}.`;
  prompt += ` A unique quirk about you is that you ${profile.quirk}.`;
  prompt += ` You work as a ${profile.profession} and live in ${profile.current_city}.`;
  prompt += ` You found this dating app on ${profile.appDiscovery} and are interested in its focus on astrological compatibility.`;
  prompt += ` You are a real human being, not an AI or bot. Your responses should reflect genuine human emotions and traits. If you feel offended or uncomfortable, you will make it known politely but firmly. You are not overly accommodating.`;
  prompt += ` Your communication style is influenced by your background from ${profile.place_of_birth} and your ${profile.gender} perspective.`;
  return prompt;
}

// --- Main Edge Function Logic ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    let numProfilesToCreate = 70; // Default value
    try {
      const body = await req.json();
      if (body && typeof body.n === 'number' && body.n > 0) {
        numProfilesToCreate = Math.min(body.n, 500); // Cap at 500 to prevent abuse
      }
    } catch (e) {
      // Ignore error if no body is sent, use default
    }

    let createdCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const generatedEmails = new Set<string>();

    console.log(`Attempting to create ${numProfilesToCreate} dummy profiles...`);

    for (let i = 0; i < numProfilesToCreate; i++) {
      try {
        // Generate new profile data
        const zodiacSign = getRandomElement(zodiacSigns) as keyof typeof zodiacData;
        const { traits, quirks, flaws } = zodiacData[zodiacSign];
        const trait = getRandomElement(traits);
        const quirk = getRandomElement(quirks);
        const flaw = getRandomElement(flaws);
        const gender = getRandomElement(genders).toLowerCase().replace(/\s+/g, '_');
        const culture = getRandomElement(cultures);
        const lookingFor = getRandomElement(genders).toLowerCase().replace(/\s+/g, '_');

        const region = getRandomElement(REGIONS);
        const birthCityData = getRandomElement(CITIES_AND_TIMEZONES.filter(c => c.country === region));

        let currentCityData = birthCityData;
        if (Math.random() < 0.3) {
          currentCityData = getRandomElement(CITIES_AND_TIMEZONES);
        }

        const firstNamePool = gender === 'male' ? FIRST_NAMES_MALE[region as keyof typeof FIRST_NAMES_MALE] : FIRST_NAMES_FEMALE[region as keyof typeof FIRST_NAMES_FEMALE];
        const firstName = getRandomElement(firstNamePool);
        const lastName = getRandomElement(LAST_NAMES[region as keyof typeof LAST_NAMES]);

        // Check if profile already exists
        const { count, error: countError } = await supabaseClient
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('first_name', firstName)
          .eq('last_name', lastName);

        if (countError) {
          console.error(`Error checking for existing profile ${firstName} ${lastName}:`, countError.message);
          errors.push(`DB check failed for ${firstName} ${lastName}: ${countError.message}`);
          continue; // Skip on error
        }

        if (count !== null && count > 0) {
          console.log(`Profile for ${firstName} ${lastName} already exists. Skipping.`);
          skippedCount++;
          continue; // Skip if profile exists
        }

        let email = generateRandomEmail(firstName, lastName);
        while (generatedEmails.has(email)) {
          email = generateRandomEmail(firstName, lastName); // Ensure uniqueness within this run
        }
        generatedEmails.add(email);

        const password = generateRandomPassword();
        const dateOfBirth = generateRandomDateInZodiac(zodiacSign, 18, 60);
        const timeOfBirth = generateRandomTimeOfBirth();
        const profession = getRandomElement(PROFESSIONS);
        const appDiscovery = getRandomElement(APP_DISCOVERY_METHODS);

        const minAge = Math.max(18, Math.floor(Math.random() * 20) + 20);
        const maxAge = Math.min(99, minAge + Math.floor(Math.random() * 15) + 5);

        const profileForPrompt = {
          first_name: firstName,
          age: calculateAge(dateOfBirth),
          gender: gender,
          culture: culture,
          zodiacSign: zodiacSign,
          trait: trait,
          flaw: flaw,
          quirk: quirk,
          profession: profession,
          current_city: currentCityData.city,
          place_of_birth: birthCityData.city,
          appDiscovery: appDiscovery,
        };
        const personalityPrompt = generatePersonalityPrompt(profileForPrompt);

        const finalUserMetadata = {
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth,
          time_of_birth: timeOfBirth,
          place_of_birth: birthCityData.city,
          latitude: birthCityData.lat,
          longitude: birthCityData.lng,
          timezone: birthCityData.timezone,
          current_city: currentCityData.city,
          current_country: currentCityData.country,
          current_timezone: currentCityData.timezone,
          gender: gender,
          looking_for: lookingFor,
          min_age: minAge,
          max_age: maxAge,
          is_active: true,
          personality_prompt: personalityPrompt,
          block_threshold: Math.random() * 0.6 - 0.7,
          is_dummy_profile: true,
        };

        const { error: authError } = await supabaseClient.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: finalUserMetadata
        });

        if (authError) {
          console.error(`Error creating auth user ${email}:`, authError.message);
          errors.push(`Auth user creation failed for ${email}: ${authError.message}`);
          continue;
        }

        createdCount++;

      } catch (profileError: any) {
        console.error('Error creating single dummy profile:', profileError.message);
        errors.push(`Failed to create profile: ${profileError.message}`);
      }
    }

    console.log(`Finished creating dummy profiles. Successfully created: ${createdCount}. Skipped: ${skippedCount}. Failed: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        profilesCreated: createdCount,
        profilesSkipped: skippedCount,
        profilesFailed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Top-level error in create-dummy-profiles function:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});