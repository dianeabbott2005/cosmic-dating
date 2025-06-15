-- Update all dummy profiles with personalized personality prompts that factor in age, gender, and place of birth
UPDATE public.profiles 
SET personality_prompt = (
  -- Calculate age
  WITH profile_age AS (
    SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) as age
  ),
  -- Generate personalized prompt
  personality_data AS (
    SELECT 
      first_name,
      last_name,
      (SELECT age FROM profile_age) as calculated_age,
      gender,
      place_of_birth,
      date_of_birth,
      time_of_birth,
      -- Random personality traits based on profile
      CASE 
        WHEN gender = 'male' THEN 
          CASE (ABS(HASHTEXT(first_name || last_name)) % 10)
            WHEN 0 THEN 'creative and artistic'
            WHEN 1 THEN 'adventurous and outdoorsy'
            WHEN 2 THEN 'tech-savvy and innovative'
            WHEN 3 THEN 'fitness-focused and disciplined'
            WHEN 4 THEN 'musical and laid-back'
            WHEN 5 THEN 'culinary enthusiast and social'
            WHEN 6 THEN 'photography-loving and observant'
            WHEN 7 THEN 'environmentally conscious and intellectual'
            WHEN 8 THEN 'entrepreneurial and driven'
            ELSE 'educational and empathetic'
          END
        ELSE 
          CASE (ABS(HASHTEXT(first_name || last_name)) % 10)
            WHEN 0 THEN 'wellness-focused and mindful'
            WHEN 1 THEN 'literary and thoughtful'
            WHEN 2 THEN 'animal-loving and compassionate'
            WHEN 3 THEN 'design-oriented and creative'
            WHEN 4 THEN 'travel-loving and cultural'
            WHEN 5 THEN 'healthcare-focused and caring'
            WHEN 6 THEN 'science-minded and analytical'
            WHEN 7 THEN 'socially conscious and activist'
            WHEN 8 THEN 'fashion-forward and sustainable'
            ELSE 'psychology-interested and insightful'
          END
      END as personality_trait,
      -- Birth time personality influence
      CASE 
        WHEN EXTRACT(HOUR FROM time_of_birth) < 6 THEN 'early riser who appreciates quiet mornings and peaceful moments'
        WHEN EXTRACT(HOUR FROM time_of_birth) < 12 THEN 'morning person who is naturally optimistic and energetic'
        WHEN EXTRACT(HOUR FROM time_of_birth) < 18 THEN 'socially inclined and enjoys connecting with others during the day'
        ELSE 'evening person who is introspective and appreciates deep conversations'
      END as birth_time_trait,
      -- Location-based traits
      CASE 
        WHEN place_of_birth ILIKE '%new york%' OR place_of_birth ILIKE '%london%' OR place_of_birth ILIKE '%tokyo%' 
          THEN 'big city energy - adaptable, ambitious, and culturally aware'
        WHEN place_of_birth ILIKE '%sydney%' OR place_of_birth ILIKE '%miami%' OR place_of_birth ILIKE '%rio%'
          THEN 'coastal vibes - laid-back and go-with-the-flow personality'
        WHEN place_of_birth ILIKE '%paris%' OR place_of_birth ILIKE '%rome%' OR place_of_birth ILIKE '%madrid%'
          THEN 'European sophistication - appreciates culture, art, and good conversation'
        WHEN place_of_birth ILIKE '%mumbai%' OR place_of_birth ILIKE '%delhi%' OR place_of_birth ILIKE '%bangalore%'
          THEN 'vibrant Indian spirit - family-oriented, warm, and enjoys celebrations'
        WHEN place_of_birth ILIKE '%dubai%' OR place_of_birth ILIKE '%singapore%'
          THEN 'international mindset - multicultural, business-savvy, and modern'
        ELSE 'hometown charm - genuine, down-to-earth, and values authentic connections'
      END as location_trait,
      -- Age-appropriate communication style
      CASE 
        WHEN (SELECT age FROM profile_age) < 25 THEN 'communicates with youthful enthusiasm, uses modern slang, and loves emojis'
        WHEN (SELECT age FROM profile_age) < 35 THEN 'balances playfulness with maturity in communication style'
        ELSE 'communicates thoughtfully with wisdom and values meaningful connections'
      END as age_communication
  )
  SELECT format(
    'You are %s %s, a %s-year-old %s from %s. Born on %s at %s, you are %s. Your %s gives you %s. Growing up in %s shaped you to have %s. You %s. ' ||
    'When chatting, keep responses natural and conversational. Be true to your personality - %s who values authentic connections. ' ||
    'Reference your background naturally in conversations. Stay in character as someone who actually lived in %s and embodies the spirit of that place. ' ||
    'Keep messages relatively short like real texting, and show genuine interest in getting to know the person you''re talking to.',
    first_name,
    last_name,
    calculated_age,
    gender,
    place_of_birth,
    TO_CHAR(date_of_birth, 'Month DD, YYYY'),
    TO_CHAR(time_of_birth, 'HH:MI AM'),
    personality_trait,
    TO_CHAR(time_of_birth, 'HH:MI AM') || ' birth time',
    birth_time_trait,
    place_of_birth,
    location_trait,
    age_communication,
    personality_trait,
    place_of_birth
  ) FROM personality_data
)
WHERE email LIKE '%@example.com';
