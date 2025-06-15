
-- Update the function to generate random profiles with geocoded coordinates
CREATE OR REPLACE FUNCTION generate_random_profiles()
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
    new_user_id UUID;
    geocode_result JSONB;
    
    -- Arrays for random data
    first_names_male TEXT[] := ARRAY['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth'];
    first_names_female TEXT[] := ARRAY['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Dorothy', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Margaret'];
    last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris'];
    places TEXT[] := ARRAY['New York, NY, USA', 'Los Angeles, CA, USA', 'Chicago, IL, USA', 'Houston, TX, USA', 'Phoenix, AZ, USA', 'Philadelphia, PA, USA', 'San Antonio, TX, USA', 'San Diego, CA, USA', 'Dallas, TX, USA', 'San Jose, CA, USA', 'Austin, TX, USA', 'Jacksonville, FL, USA', 'Fort Worth, TX, USA', 'Columbus, OH, USA', 'Charlotte, NC, USA', 'San Francisco, CA, USA', 'Indianapolis, IN, USA', 'Seattle, WA, USA', 'Denver, CO, USA', 'Washington, DC, USA', 'Boston, MA, USA', 'Miami, FL, USA', 'Atlanta, GA, USA', 'Portland, OR, USA', 'Las Vegas, NV, USA'];
    genders TEXT[] := ARRAY['male', 'female'];
BEGIN
    FOR i IN 1..100 LOOP
        -- Generate random data
        random_gender := genders[1 + floor(random() * 2)::int];
        
        IF random_gender = 'male' THEN
            random_first_name := first_names_male[1 + floor(random() * array_length(first_names_male, 1))::int];
            random_looking_for := CASE 
                WHEN random() < 0.9 THEN 'female' 
                ELSE 'male' 
            END;
        ELSE
            random_first_name := first_names_female[1 + floor(random() * array_length(first_names_female, 1))::int];
            random_looking_for := CASE 
                WHEN random() < 0.9 THEN 'male' 
                ELSE 'female' 
            END;
        END IF;
        
        random_last_name := last_names[1 + floor(random() * array_length(last_names, 1))::int];
        random_email := lower(random_first_name || '.' || random_last_name || i || '@example.com');
        
        -- Random date of birth (age 21-50)
        random_date_of_birth := CURRENT_DATE - INTERVAL '1 day' * (365 * (21 + floor(random() * 30)::int) + floor(random() * 365)::int);
        
        -- Random time of birth
        random_time_of_birth := TIME '00:00:00' + INTERVAL '1 minute' * floor(random() * 1440)::int;
        
        -- Random place
        random_place := places[1 + floor(random() * array_length(places, 1))::int];
        
        -- Try to geocode the place using the edge function
        BEGIN
            SELECT INTO geocode_result
                net.http_post(
                    url := 'https://cqbsiclssabafdozvbzc.supabase.co/functions/v1/geocode',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'apikey', current_setting('app.settings.service_role_key')
                    ),
                    body := jsonb_build_object('address', random_place)
                )::jsonb;
            
            -- Extract coordinates from the response
            IF geocode_result ? 'results' AND jsonb_array_length(geocode_result->'results') > 0 THEN
                random_lat := (geocode_result->'results'->0->>'latitude')::DECIMAL(10,8);
                random_lng := (geocode_result->'results'->0->>'longitude')::DECIMAL(11,8);
            ELSE
                -- Fallback to approximate coordinates if geocoding fails
                random_lat := 40.7128 + (random() - 0.5) * 20; -- Rough US latitude range
                random_lng := -74.0060 + (random() - 0.5) * 50; -- Rough US longitude range
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Fallback coordinates if HTTP request fails
            RAISE NOTICE 'Geocoding failed for %, using fallback coordinates', random_place;
            random_lat := 40.7128 + (random() - 0.5) * 20;
            random_lng := -74.0060 + (random() - 0.5) * 50;
        END;
        
        -- Random age preferences
        random_min_age := 18 + floor(random() * 15)::int; -- 18-32
        random_max_age := random_min_age + 5 + floor(random() * 20)::int; -- min_age + 5 to min_age + 25
        
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
        
        -- Insert profile with geocoded coordinates
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
            max_age
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
            random_max_age
        ) ON CONFLICT (user_id) DO NOTHING;
        
        -- Add a small delay to avoid overwhelming the geocoding service
        PERFORM pg_sleep(0.1);
        
    END LOOP;
    
    RAISE NOTICE 'Generated 100 random profiles with geocoded coordinates successfully!';
END;
$$;

-- Execute the function to generate the profiles
SELECT generate_random_profiles();

-- Clean up the function
DROP FUNCTION generate_random_profiles();
