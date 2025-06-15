
-- First, clear existing data from related tables
DELETE FROM public.conversation_contexts;
DELETE FROM public.messages;
DELETE FROM public.chats;
DELETE FROM public.matches;
DELETE FROM public.profiles;

-- Add a flag to identify dummy/AI profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_dummy_profile BOOLEAN DEFAULT FALSE;

-- Create a function to generate 200 diverse random profiles from around the world
CREATE OR REPLACE FUNCTION generate_diverse_profiles()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    i INTEGER;
    random_email TEXT;
    random_first_name TEXT;
    random_last_name TEXT;
    random_date_of_birth DATE;
    random_time_of_birth TIME;
    random_place TEXT;
    random_lat DECIMAL(10,8);
    random_lng DECIMAL(11,8);
    random_gender TEXT;
    random_looking_for TEXT;
    random_min_age INTEGER;
    random_max_age INTEGER;
    random_personality TEXT;
    new_user_id UUID;
    
    -- Diverse names from around the world
    first_names_male TEXT[] := ARRAY['James', 'Mohammed', 'Wei', 'Raj', 'Carlos', 'Dmitri', 'Hiroshi', 'Ahmed', 'Giovanni', 'Pierre', 'Olaf', 'Kwame', 'Chen', 'Miguel', 'Aleksandr', 'Farid', 'Yuki', 'Sebastian', 'Matteo', 'Ivan', 'Hans', 'Jose', 'Paulo', 'Omar', 'Kenji', 'Antonio', 'François', 'Klaus', 'Diego', 'Nikolai'];
    
    first_names_female TEXT[] := ARRAY['Mary', 'Fatima', 'Li', 'Priya', 'Sofia', 'Natasha', 'Yuki', 'Amira', 'Isabella', 'Marie', 'Ingrid', 'Ama', 'Mei', 'Carmen', 'Svetlana', 'Yasmin', 'Sakura', 'Valentina', 'Giulia', 'Anastasia', 'Astrid', 'Maria', 'Lucia', 'Layla', 'Akiko', 'Claudia', 'Céline', 'Petra', 'Esperanza', 'Elena'];
    
    last_names TEXT[] := ARRAY['Smith', 'Al-Rashid', 'Wang', 'Sharma', 'García', 'Petrov', 'Tanaka', 'Hassan', 'Rossi', 'Dubois', 'Larsen', 'Osei', 'Liu', 'Rodriguez', 'Volkov', 'Al-Zahra', 'Sato', 'Silva', 'Ferrari', 'Ivanov', 'Mueller', 'Martinez', 'Santos', 'Al-Mansouri', 'Yamamoto', 'Romano', 'Bernard', 'Weber', 'Morales', 'Kozlov'];
    
    -- Global cities with coordinates
    places TEXT[] := ARRAY[
        'New York, NY, USA', 'London, UK', 'Paris, France', 'Tokyo, Japan', 'Sydney, Australia',
        'Dubai, UAE', 'Mumbai, India', 'São Paulo, Brazil', 'Moscow, Russia', 'Berlin, Germany',
        'Cairo, Egypt', 'Lagos, Nigeria', 'Seoul, South Korea', 'Mexico City, Mexico', 'Toronto, Canada',
        'Madrid, Spain', 'Rome, Italy', 'Bangkok, Thailand', 'Singapore', 'Istanbul, Turkey',
        'Buenos Aires, Argentina', 'Stockholm, Sweden', 'Oslo, Norway', 'Amsterdam, Netherlands', 'Vienna, Austria',
        'Zurich, Switzerland', 'Barcelona, Spain', 'Milan, Italy', 'Copenhagen, Denmark', 'Helsinki, Finland',
        'Prague, Czech Republic', 'Warsaw, Poland', 'Budapest, Hungary', 'Athens, Greece', 'Lisbon, Portugal',
        'Johannesburg, South Africa', 'Cape Town, South Africa', 'Nairobi, Kenya', 'Casablanca, Morocco', 'Tel Aviv, Israel',
        'Shanghai, China', 'Beijing, China', 'Hong Kong', 'Bangalore, India', 'Delhi, India',
        'Riyadh, Saudi Arabia', 'Doha, Qatar', 'Kuwait City, Kuwait', 'Jakarta, Indonesia', 'Manila, Philippines'
    ];
    
    coordinates DECIMAL[][] := ARRAY[
        ARRAY[40.7128, -74.0060], ARRAY[51.5074, -0.1278], ARRAY[48.8566, 2.3522], ARRAY[35.6762, 139.6503], ARRAY[-33.8688, 151.2093],
        ARRAY[25.2048, 55.2708], ARRAY[19.0760, 72.8777], ARRAY[-23.5505, -46.6333], ARRAY[55.7558, 37.6176], ARRAY[52.5200, 13.4050],
        ARRAY[30.0444, 31.2357], ARRAY[6.5244, 3.3792], ARRAY[37.5665, 126.9780], ARRAY[19.4326, -99.1332], ARRAY[43.6532, -79.3832],
        ARRAY[40.4168, -3.7038], ARRAY[41.9028, 12.4964], ARRAY[13.7563, 100.5018], ARRAY[1.3521, 103.8198], ARRAY[41.0082, 28.9784],
        ARRAY[-34.6118, -58.3960], ARRAY[59.3293, 18.0686], ARRAY[59.9139, 10.7522], ARRAY[52.3676, 4.9041], ARRAY[48.2082, 16.3738],
        ARRAY[47.3769, 8.5417], ARRAY[41.3851, 2.1734], ARRAY[45.4642, 9.1900], ARRAY[55.6761, 12.5683], ARRAY[60.1699, 24.9384],
        ARRAY[50.0755, 14.4378], ARRAY[52.2297, 21.0122], ARRAY[47.4979, 19.0402], ARRAY[37.9755, 23.7348], ARRAY[38.7223, -9.1393],
        ARRAY[-26.2041, 28.0473], ARRAY[-33.9249, 18.4241], ARRAY[-1.2921, 36.8219], ARRAY[33.5731, -7.5898], ARRAY[32.0853, 34.7818],
        ARRAY[31.2304, 121.4737], ARRAY[39.9042, 116.4074], ARRAY[22.3193, 114.1694], ARRAY[12.9716, 77.5946], ARRAY[28.7041, 77.1025],
        ARRAY[24.7136, 46.6753], ARRAY[25.2854, 51.5310], ARRAY[29.3759, 47.9774], ARRAY[-6.2088, 106.8456], ARRAY[14.5995, 120.9842]
    ];
    
    -- AI personality prompts for dummy profiles
    personality_prompts TEXT[] := ARRAY[
        'You are a creative artist who loves painting and photography. You''re passionate about travel and exploring different cultures. You tend to be introspective and value deep conversations about life, art, and philosophy.',
        'You are an adventure enthusiast who loves hiking, rock climbing, and outdoor activities. You''re optimistic and energetic, always looking for the next thrill. You enjoy sharing stories about your adventures.',
        'You are a tech professional who is passionate about innovation and startups. You love discussing the latest technologies, but you also enjoy cooking and trying new cuisines. You have a good sense of humor.',
        'You are a yoga instructor and wellness coach who values mindfulness and healthy living. You''re calm, supportive, and love helping others find their inner peace. You enjoy meditation and nature.',
        'You are a music lover who plays guitar and loves attending concerts. You''re laid-back and enjoy discussing different music genres. You also love movies and often quote your favorite films.',
        'You are a bookworm who works as a librarian. You love literature, poetry, and quiet evenings with a good book. You''re thoughtful and enjoy meaningful conversations about stories and ideas.',
        'You are a fitness enthusiast who loves running marathons and staying active. You''re disciplined and goal-oriented, but you also know how to have fun. You enjoy healthy cooking and motivating others.',
        'You are a chef who is passionate about fusion cuisine. You love experimenting with flavors from different cultures. You''re warm, hospitable, and enjoy sharing food experiences and recipes.',
        'You are a photographer who specializes in street photography. You''re observant and artistic, always looking for interesting moments to capture. You love urban exploration and finding hidden gems in cities.',
        'You are a marine biologist who is passionate about ocean conservation. You love scuba diving and underwater photography. You''re knowledgeable about marine life and enjoy educating others about ocean preservation.'
    ];
    
    genders TEXT[] := ARRAY['male', 'female'];
BEGIN
    FOR i IN 1..200 LOOP
        -- Generate random data
        random_gender := genders[1 + floor(random() * 2)::int];
        
        IF random_gender = 'male' THEN
            random_first_name := first_names_male[1 + floor(random() * array_length(first_names_male, 1))::int];
            random_looking_for := CASE 
                WHEN random() < 0.85 THEN 'female' 
                ELSE 'male' 
            END;
        ELSE
            random_first_name := first_names_female[1 + floor(random() * array_length(first_names_female, 1))::int];
            random_looking_for := CASE 
                WHEN random() < 0.85 THEN 'male' 
                ELSE 'female' 
            END;
        END IF;
        
        random_last_name := last_names[1 + floor(random() * array_length(last_names, 1))::int];
        random_email := lower(random_first_name || '.' || random_last_name || i || '@dummyprofile.com');
        
        -- Random date of birth (age 18-45)
        random_date_of_birth := CURRENT_DATE - INTERVAL '1 day' * (365 * (18 + floor(random() * 28)::int) + floor(random() * 365)::int);
        
        -- Random time of birth
        random_time_of_birth := TIME '00:00:00' + INTERVAL '1 minute' * floor(random() * 1440)::int;
        
        -- Random place and coordinates from global cities
        random_place := places[1 + floor(random() * array_length(places, 1))::int];
        random_lat := coordinates[1 + floor(random() * array_length(coordinates, 1))::int][1] + (random() - 0.5) * 0.02;
        random_lng := coordinates[1 + floor(random() * array_length(coordinates, 1))::int][2] + (random() - 0.5) * 0.02;
        
        -- Random age preferences
        random_min_age := 18 + floor(random() * 10)::int; -- 18-27
        random_max_age := random_min_age + 8 + floor(random() * 15)::int; -- min_age + 8 to min_age + 23
        
        -- Random personality for AI
        random_personality := personality_prompts[1 + floor(random() * array_length(personality_prompts, 1))::int];
        
        -- Generate a UUID for the new user
        new_user_id := gen_random_uuid();
        
        -- Create auth user with password "passwOrd"
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            random_email,
            crypt('passwOrd', gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object(
                'first_name', random_first_name,
                'last_name', random_last_name,
                'date_of_birth', random_date_of_birth::text,
                'time_of_birth', random_time_of_birth::text,
                'place_of_birth', random_place,
                'gender', random_gender,
                'looking_for', random_looking_for,
                'min_age', random_min_age,
                'max_age', random_max_age
            ),
            false,
            '',
            '',
            '',
            ''
        );
        
        -- Insert profile with dummy flag and personality prompt
        INSERT INTO public.profiles (
            user_id,
            first_name,
            last_name,
            email,
            date_of_birth,
            time_of_birth,
            place_of_birth,
            latitude,
            longitude,
            gender,
            looking_for,
            min_age,
            max_age,
            is_dummy_profile,
            personality_prompt
        ) VALUES (
            new_user_id,
            random_first_name,
            random_last_name,
            random_email,
            random_date_of_birth,
            random_time_of_birth,
            random_place,
            random_lat,
            random_lng,
            random_gender,
            random_looking_for,
            random_min_age,
            random_max_age,
            true,  -- Mark as dummy profile
            random_personality  -- Add AI personality
        ) ON CONFLICT (user_id) DO NOTHING;
        
    END LOOP;
    
    RAISE NOTICE 'Generated 200 diverse dummy profiles successfully!';
END;
$$;

-- Execute the function to generate the profiles
SELECT generate_diverse_profiles();

-- Clean up the function
DROP FUNCTION generate_diverse_profiles();
