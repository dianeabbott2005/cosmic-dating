import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Data for Profile Generation ---
const FIRST_NAMES_MALE = {
  'US': ['Ethan', 'Liam', 'Noah', 'Mason', 'Lucas', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin'],
  'UK': ['Harry', 'George', 'Jack', 'Leo', 'Oscar', 'Charlie', 'Freddie', 'Arthur', 'Noah', 'Archie'],
  'India': ['Aryan', 'Rohan', 'Vivaan', 'Shaurya', 'Kabir', 'Arjun', 'Reyansh', 'Aarav', 'Dhruv', 'Ishaan'],
  'Japan': ['Ren', 'Haruto', 'Sota', 'Yuto', 'Hinata', 'Aoi', 'Riku', 'Minato', 'Asahi', 'Kaito'],
  'Brazil': ['Miguel', 'Arthur', 'Heitor', 'Théo', 'Davi', 'Bernardo', 'Gael', 'Gabriel', 'Samuel', 'João'],
  'Nigeria': ['Chinedu', 'Emeka', 'Obi', 'Tunde', 'Segun', 'Kunle', 'Femi', 'Ade', 'Nnamdi', 'Kelechi'],
  'Germany': ['Leon', 'Noah', 'Finn', 'Paul', 'Ben', 'Jonas', 'Emil', 'Felix', 'Louis', 'Henry'],
  'France': ['Gabriel', 'Louis', 'Raphaël', 'Arthur', 'Maël', 'Léo', 'Jules', 'Adam', 'Lucas', 'Hugo'],
  'Mexico': ['Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Matías', 'Emiliano', 'Diego', 'Daniel', 'Alexander', 'Nicolás'],
  'Egypt': ['Mohamed', 'Ahmed', 'Youssef', 'Omar', 'Mostafa', 'Ali', 'Khaled', 'Mahmoud', 'Ziad', 'Karim'],
};

const FIRST_NAMES_FEMALE = {
  'US': ['Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Charlotte', 'Amelia', 'Mia', 'Harper', 'Evelyn'],
  'UK': ['Olivia', 'Amelia', 'Isla', 'Ava', 'Lily', 'Sophia', 'Grace', 'Mia', 'Freya', 'Willow'],
  'India': ['Aditi', 'Diya', 'Kiara', 'Myra', 'Siya', 'Anaya', 'Aaradhya', 'Fatima', 'Pari', 'Sara'],
  'Japan': ['Yui', 'Sakura', 'Hana', 'Mio', 'Riko', 'Aoi', 'Mei', 'Saki', 'Nana', 'Akari'],
  'Brazil': ['Alice', 'Sophia', 'Helena', 'Valentina', 'Laura', 'Isabella', 'Manuela', 'Júlia', 'Luísa', 'Lorena'],
  'Nigeria': ['Fatima', 'Aisha', 'Zainab', 'Blessing', 'Grace', 'Chiamaka', 'Ngozi', 'Ada', 'Chioma', 'Amara'],
  'Germany': ['Mia', 'Hannah', 'Emilia', 'Sofia', 'Lina', 'Ella', 'Mila', 'Lea', 'Lena', 'Clara'],
  'France': ['Louise', 'Jade', 'Emma', 'Alice', 'Chloé', 'Léa', 'Manon', 'Rose', 'Anna', 'Inès'],
  'Mexico': ['Sofía', 'Valentina', 'Regina', 'Camila', 'María José', 'Ximena', 'Valeria', 'Renata', 'Victoria', 'Mariana'],
  'Egypt': ['Nour', 'Sara', 'Hana', 'Malak', 'Farah', 'Jana', 'Laila', 'Salma', 'Mariam', 'Yara'],
};

const LAST_NAMES = {
  'US': ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'],
  'UK': ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Jackson'],
  'India': ['Sharma', 'Singh', 'Kumar', 'Yadav', 'Patel', 'Gupta', 'Reddy', 'Khan', 'Das', 'Choudhury'],
  'Japan': ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato'],
  'Brazil': ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Rodrigues', 'Alves', 'Costa'],
  'Nigeria': ['Okoro', 'Adeyemi', 'Okafor', 'Abdullahi', 'Duru', 'Eze', 'Mohammed', 'Nwachukwu', 'Oladipo', 'Umar'],
  'Germany': ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'],
  'France': ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau'],
  'Mexico': ['Hernández', 'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez', 'Ramírez', 'Cruz'],
  'Egypt': ['Mohamed', 'Ahmed', 'Ali', 'Ibrahim', 'Hassan', 'Mahmoud', 'Hussein', 'Sayed', 'Amin', 'Khalil'],
};

const REGIONS = ['US', 'UK', 'India', 'Japan', 'Brazil', 'Nigeria', 'Germany', 'France', 'Mexico', 'Egypt'];

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

const GENDERS = ['male', 'female', 'non-binary'];
const LOOKING_FOR_OPTIONS = ['male', 'female', 'non-binary'];

const PERSONALITY_TRAITS = [
  { type: 'disposition', values: ['friendly', 'reserved', 'outgoing', 'calm', 'energetic', 'mysterious', 'witty', 'thoughtful', 'playful', 'serious', 'optimistic', 'cynical', 'curious', 'practical', 'dreamy'] },
  { type: 'patience', values: ['very patient', 'a bit impatient', 'has a short fuse', 'generally calm', 'can be easily annoyed', 'takes things in stride', 'gets frustrated quickly'] },
  { type: 'flaws', values: ['prone to sarcasm', 'a bit shy at first', 'can be overly direct', 'sometimes overthinks things', 'occasionally forgets details', 'can be stubborn', 'a bit messy', 'tends to procrastinate', 'can be a know-it-all'] },
  { type: 'interests', values: ['loves travel and outdoor activities', 'enjoys quiet evenings and reading', 'passionate about art and philosophy', 'always looking for fun and lighthearted banter', 'interested in deep conversations', 'enjoys cooking and trying new foods', 'a big fan of movies and TV shows', 'loves exploring new cultures', 'into fitness and healthy living', 'enjoys gaming and tech', 'fascinated by history', 'loves animals', 'enjoys volunteering'] },
  { type: 'dating_approach', values: ['looking for a deep connection', 'enjoys lighthearted banter and getting to know people slowly', 'seeking a serious relationship', 'open to new experiences and seeing where things go', 'values intellectual compatibility', 'prefers emotional connection over superficiality', 'likes to take things slow', 'prefers direct communication', 'enjoys playful teasing'] },
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

const ZODIAC_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

// --- Helper Functions ---
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomDateOfBirth(minAge: number, maxAge: number): string {
  const today = new Date();
  const maxBirthDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const minBirthDate = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());

  const randomTime = minBirthDate.getTime() + Math.random() * (maxBirthDate.getTime() - minBirthDate.getTime());
  return new Date(randomTime).toISOString().split('T')[0];
}

function generateRandomTimeOfBirth(): string {
  const hour = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function generateRandomEmail(firstName: string, lastName: string): string {
  const domain = getRandomElement(['example.com', 'mail.com', 'web.net', 'inbox.org']);
  const uniqueId = Math.random().toString(36).substring(2, 8);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${uniqueId}@${domain}`;
}

function generateRandomPassword(): string {
  return Math.random().toString(36).substring(2, 15); // Simple random string for dummy users
}

function getSunSign(dateOfBirth: string): string {
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
}

function generatePersonalityPrompt(profile: any): string {
  const disposition = getRandomElement(PERSONALITY_TRAITS.find(t => t.type === 'disposition')!.values);
  const patience = getRandomElement(PERSONALITY_TRAITS.find(t => t.type === 'patience')!.values);
  const flaw = getRandomElement(PERSONALITY_TRAITS.find(t => t.type === 'flaws')!.values);
  const interest = getRandomElement(PERSONALITY_TRAITS.find(t => t.type === 'interests')!.values);
  const datingApproach = getRandomElement(PERSONALITY_TRAITS.find(t => t.type === 'dating_approach')!.values);
  const appDiscovery = getRandomElement(APP_DISCOVERY_METHODS);
  const sunSign = getSunSign(profile.date_of_birth);

  let prompt = `You are ${profile.first_name}, a ${profile.gender} from ${profile.place_of_birth} who works as a ${profile.profession}. Your sun sign is ${sunSign}.`;
  
  prompt += ` You are generally ${disposition} and ${patience}. You can sometimes be ${flaw}. In your free time, you ${interest}. On dating apps, you ${datingApproach}.`;
  prompt += ` You found this dating platform on ${appDiscovery} and are excited about its promise to find matches based on birth chart compatibility.`;
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for admin operations
  );

  try {
    const NUM_PROFILES_TO_CREATE = 70;
    let createdCount = 0;
    const errors: string[] = [];

    console.log(`Attempting to create ${NUM_PROFILES_TO_CREATE} dummy profiles...`);

    for (let i = 0; i < NUM_PROFILES_TO_CREATE; i++) {
      try {
        const region = getRandomElement(REGIONS);
        const gender = getRandomElement(GENDERS);
        const lookingFor = getRandomElement(LOOKING_FOR_OPTIONS);
        const cityData = getRandomElement(CITIES_AND_TIMEZONES.filter(c => c.country === region));
        
        const firstNamePool = gender === 'male' ? FIRST_NAMES_MALE[region as keyof typeof FIRST_NAMES_MALE] : FIRST_NAMES_FEMALE[region as keyof typeof FIRST_NAMES_FEMALE];
        const firstName = getRandomElement(firstNamePool);
        const lastName = getRandomElement(LAST_NAMES[region as keyof typeof LAST_NAMES]);
        
        const email = generateRandomEmail(firstName, lastName);
        const password = generateRandomPassword(); // Dummy password for auth.users
        
        const dateOfBirth = generateRandomDateOfBirth(18, 60); // Age between 18 and 60
        const timeOfBirth = generateRandomTimeOfBirth();
        const profession = getRandomElement(PROFESSIONS);
        
        const minAge = Math.max(18, Math.floor(Math.random() * 20) + 20); // 20-40
        const maxAge = Math.min(99, minAge + Math.floor(Math.random() * 15) + 5); // minAge + 5-20

        // 1. Create user in auth.users
        const { data: authUserData, error: authError } = await supabaseClient.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm for dummy users
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            place_of_birth: cityData.city,
            date_of_birth: dateOfBirth,
            time_of_birth: timeOfBirth,
            latitude: cityData.lat,
            longitude: cityData.lng,
            timezone: cityData.timezone,
            looking_for: lookingFor,
            min_age: minAge,
            max_age: maxAge,
            profession: profession,
          }
        });

        if (authError) {
          console.error(`Error creating auth user ${email}:`, authError.message);
          errors.push(`Auth user creation failed for ${email}: ${authError.message}`);
          continue; // Skip to next profile
        }

        const userId = authUserData.user.id;
        console.log(`Created auth user: ${userId} (${email})`);

        // 2. Prepare profile data
        const profileData = {
          id: userId, // Link to auth.users.id
          user_id: userId, // Also set user_id to the same UUID
          first_name: firstName,
          last_name: lastName,
          email: email,
          date_of_birth: dateOfBirth,
          time_of_birth: timeOfBirth,
          place_of_birth: cityData.city,
          latitude: cityData.lat,
          longitude: cityData.lng,
          timezone: cityData.timezone,
          gender: gender,
          looking_for: lookingFor,
          min_age: minAge,
          max_age: maxAge,
          is_active: true, // Mark as automated profile
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Temporarily add profession here for prompt generation, will be removed from final insert if not in schema
          profession: profession,
        };

        // 3. Generate personality prompt
        const personalityPrompt = generatePersonalityPrompt(profileData);
        
        // Remove profession from profileData if it's not a direct column in your profiles table
        const { profession: _, ...insertableProfileData } = profileData;

        // 4. Insert into public.profiles
        const { error: profileInsertError } = await supabaseClient
          .from('profiles')
          .insert({ ...insertableProfileData, personality_prompt: personalityPrompt });

        if (profileInsertError) {
          console.error(`Error inserting profile for user ${userId}:`, profileInsertError.message);
          errors.push(`Profile insertion failed for ${userId}: ${profileInsertError.message}`);
          // Optionally, delete the auth user if profile insertion fails
          await supabaseClient.auth.admin.deleteUser(userId);
          continue;
        }

        console.log(`Successfully created profile for user: ${userId} (${firstName} ${lastName})`);
        createdCount++;

      } catch (profileError: any) {
        console.error('Error creating single dummy profile:', profileError.message);
        errors.push(`Failed to create profile: ${profileError.message}`);
      }
    }

    console.log(`Finished creating dummy profiles. Successfully created: ${createdCount}. Failed: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        profilesCreated: createdCount,
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