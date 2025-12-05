CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
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
    personality_prompt,
    is_dummy_profile
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'date_of_birth')::DATE, '1990-01-01'::DATE),
    COALESCE((NEW.raw_user_meta_data ->> 'time_of_birth')::TIME, '12:00:00'::TIME),
    COALESCE(NEW.raw_user_meta_data ->> 'place_of_birth', ''),
    (NEW.raw_user_meta_data ->> 'latitude')::DECIMAL(10,8),
    (NEW.raw_user_meta_data ->> 'longitude')::DECIMAL(11,8),
    COALESCE(NEW.raw_user_meta_data ->> 'gender', 'male'),
    COALESCE(NEW.raw_user_meta_data ->> 'looking_for', 'female'),
    COALESCE((NEW.raw_user_meta_data ->> 'min_age')::INTEGER, 18),
    COALESCE((NEW.raw_user_meta_data ->> 'max_age')::INTEGER, 35),
    NEW.raw_user_meta_data ->> 'personality_prompt',
    COALESCE((NEW.raw_user_meta_data ->> 'is_dummy_profile')::BOOLEAN, false)
  );
  RETURN NEW;
END;
$$;
