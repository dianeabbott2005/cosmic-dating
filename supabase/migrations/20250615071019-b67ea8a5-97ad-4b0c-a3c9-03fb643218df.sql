
-- Create a one-time function to geocode all existing profiles
CREATE OR REPLACE FUNCTION geocode_existing_profiles()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    profile_record RECORD;
    geocode_result JSONB;
    response_data JSONB;
    updated_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    -- Loop through all profiles that don't have coordinates yet
    FOR profile_record IN 
        SELECT id, user_id, place_of_birth, first_name, last_name
        FROM public.profiles 
        WHERE (latitude IS NULL OR longitude IS NULL) 
        AND place_of_birth IS NOT NULL 
        AND place_of_birth != ''
    LOOP
        BEGIN
            -- Call the geocode edge function
            SELECT INTO geocode_result
                net.http_post(
                    url := 'https://cqbsiclssabafdozvbzc.supabase.co/functions/v1/geocode',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
                    ),
                    body := jsonb_build_object('address', profile_record.place_of_birth)
                );
            
            -- Parse the response
            response_data := geocode_result->'body'::jsonb;
            
            -- Check if we got valid results
            IF response_data ? 'results' AND jsonb_array_length(response_data->'results') > 0 THEN
                -- Update the profile with coordinates
                UPDATE public.profiles 
                SET 
                    latitude = (response_data->'results'->0->>'latitude')::DECIMAL(10,8),
                    longitude = (response_data->'results'->0->>'longitude')::DECIMAL(11,8)
                WHERE id = profile_record.id;
                
                updated_count := updated_count + 1;
                
                RAISE NOTICE 'Updated coordinates for % % (%, %): %', 
                    profile_record.first_name, 
                    profile_record.last_name,
                    profile_record.place_of_birth,
                    updated_count,
                    response_data->'results'->0;
            ELSE
                failed_count := failed_count + 1;
                RAISE NOTICE 'Failed to geocode % % (%): No results returned', 
                    profile_record.first_name, 
                    profile_record.last_name,
                    profile_record.place_of_birth;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            RAISE NOTICE 'Error geocoding % % (%): %', 
                profile_record.first_name, 
                profile_record.last_name,
                profile_record.place_of_birth,
                SQLERRM;
        END;
        
        -- Add a small delay to avoid overwhelming the geocoding service
        PERFORM pg_sleep(0.2);
        
    END LOOP;
    
    RAISE NOTICE 'Geocoding complete! Updated: %, Failed: %', updated_count, failed_count;
END;
$$;

-- Execute the function to geocode all existing profiles
SELECT geocode_existing_profiles();

-- Clean up the function
DROP FUNCTION geocode_existing_profiles();
