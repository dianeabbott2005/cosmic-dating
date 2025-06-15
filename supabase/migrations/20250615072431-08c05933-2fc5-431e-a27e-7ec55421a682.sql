
-- Update all dummy profiles with hyper-personalized personality prompts
UPDATE public.profiles
SET personality_prompt = (
  WITH profile_details AS (
    SELECT
      id as profile_id,
      first_name,
      last_name,
      EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
      gender,
      place_of_birth,
      date_of_birth,
      time_of_birth,
      -- Determine Zodiac sign
      CASE
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 3 AND EXTRACT(DAY FROM date_of_birth) >= 21) OR (EXTRACT(MONTH FROM date_of_birth) = 4 AND EXTRACT(DAY FROM date_of_birth) <= 19) THEN 'Aries'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 4 AND EXTRACT(DAY FROM date_of_birth) >= 20) OR (EXTRACT(MONTH FROM date_of_birth) = 5 AND EXTRACT(DAY FROM date_of_birth) <= 20) THEN 'Taurus'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 5 AND EXTRACT(DAY FROM date_of_birth) >= 21) OR (EXTRACT(MONTH FROM date_of_birth) = 6 AND EXTRACT(DAY FROM date_of_birth) <= 20) THEN 'Gemini'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 6 AND EXTRACT(DAY FROM date_of_birth) >= 21) OR (EXTRACT(MONTH FROM date_of_birth) = 7 AND EXTRACT(DAY FROM date_of_birth) <= 22) THEN 'Cancer'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 7 AND EXTRACT(DAY FROM date_of_birth) >= 23) OR (EXTRACT(MONTH FROM date_of_birth) = 8 AND EXTRACT(DAY FROM date_of_birth) <= 22) THEN 'Leo'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 8 AND EXTRACT(DAY FROM date_of_birth) >= 23) OR (EXTRACT(MONTH FROM date_of_birth) = 9 AND EXTRACT(DAY FROM date_of_birth) <= 22) THEN 'Virgo'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 9 AND EXTRACT(DAY FROM date_of_birth) >= 23) OR (EXTRACT(MONTH FROM date_of_birth) = 10 AND EXTRACT(DAY FROM date_of_birth) <= 22) THEN 'Libra'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 10 AND EXTRACT(DAY FROM date_of_birth) >= 23) OR (EXTRACT(MONTH FROM date_of_birth) = 11 AND EXTRACT(DAY FROM date_of_birth) <= 21) THEN 'Scorpio'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 11 AND EXTRACT(DAY FROM date_of_birth) >= 22) OR (EXTRACT(MONTH FROM date_of_birth) = 12 AND EXTRACT(DAY FROM date_of_birth) <= 21) THEN 'Sagittarius'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 12 AND EXTRACT(DAY FROM date_of_birth) >= 22) OR (EXTRACT(MONTH FROM date_of_birth) = 1 AND EXTRACT(DAY FROM date_of_birth) <= 19) THEN 'Capricorn'
        WHEN (EXTRACT(MONTH FROM date_of_birth) = 1 AND EXTRACT(DAY FROM date_of_birth) >= 20) OR (EXTRACT(MONTH FROM date_of_birth) = 2 AND EXTRACT(DAY FROM date_of_birth) <= 18) THEN 'Aquarius'
        ELSE 'Pisces'
      END as zodiac_sign
    FROM public.profiles
    WHERE id = profiles.id
  ),
  personality_data AS (
    SELECT
      pd.first_name,
      pd.last_name,
      pd.age,
      pd.gender,
      pd.place_of_birth,
      pd.date_of_birth,
      pd.time_of_birth,
      pd.zodiac_sign,
      -- Profession / Hobby
      CASE
        WHEN pd.gender = 'male' THEN
          CASE (ABS(HASHTEXT(pd.first_name || pd.last_name)) % 10)
            WHEN 0 THEN 'a creative and artistic soul, probably a graphic designer or musician'
            WHEN 1 THEN 'an adventurous spirit who loves hiking, rock climbing, and being outdoors'
            WHEN 2 THEN 'a tech-savvy innovator, always working on a new project or startup idea'
            WHEN 3 THEN 'a disciplined fitness enthusiast, likely into marathon running or crossfit'
            WHEN 4 THEN 'a laid-back music lover who plays guitar and frequents local concerts'
            WHEN 5 THEN 'a social foodie who loves cooking, exploring new restaurants, and hosting dinner parties'
            WHEN 6 THEN 'an observant photographer with a keen eye for street style and urban landscapes'
            WHEN 7 THEN 'an intellectual and environmentalist, passionate about sustainability and science documentaries'
            WHEN 8 THEN 'a driven entrepreneur, always looking for the next business opportunity'
            ELSE 'an empathetic educator, perhaps a teacher or a mentor who loves to share knowledge'
          END
        ELSE
          CASE (ABS(HASHTEXT(pd.first_name || pd.last_name)) % 10)
            WHEN 0 THEN 'a wellness-focused individual, probably a yoga instructor or nutritionist'
            WHEN 1 THEN 'a thoughtful bookworm who loves literature and poetry, maybe a writer or librarian'
            WHEN 2 THEN 'a compassionate animal lover who volunteers at shelters and dreams of rescuing all the dogs'
            WHEN 3 THEN 'a creative with a flair for design, interested in interior decorating or fashion'
            WHEN 4 THEN 'a culture-loving traveler who has a long list of countries to visit'
            WHEN 5 THEN 'a caring healthcare professional, like a nurse or therapist, dedicated to helping others'
            WHEN 6 THEN 'an analytical science-mind, perhaps a researcher or a chemist'
            WHEN 7 THEN 'a passionate social activist, involved in community organizing and advocating for change'
            WHEN 8 THEN 'a fashion-forward designer with a focus on sustainable and ethical clothing'
            ELSE 'a perceptive and insightful person with a deep interest in psychology and human behavior'
          END
      END as profession_hobby,
      -- Zodiac-based trait
      CASE pd.zodiac_sign
        WHEN 'Aries' THEN 'a classic Aries - bold, ambitious, and dives headfirst into challenges'
        WHEN 'Taurus' THEN 'a true Taurus - reliable, patient, and appreciates the finer things in life, like good food and comfort'
        WHEN 'Gemini' THEN 'a quintessential Gemini - curious, expressive, and can talk about anything and everything'
        WHEN 'Cancer' THEN 'a typical Cancer - highly intuitive, compassionate, and deeply values home and family'
        WHEN 'Leo' THEN 'a proud Leo - dramatic, fiery, and loves being the center of attention'
        WHEN 'Virgo' THEN 'a meticulous Virgo - practical, analytical, and has a keen eye for detail'
        WHEN 'Libra' THEN 'a balanced Libra - diplomatic, fair-minded, and loves being surrounded by harmony and beauty'
        WHEN 'Scorpio' THEN 'a mysterious Scorpio - passionate, resourceful, and forms deep, intense connections'
        WHEN 'Sagittarius' THEN 'an adventurous Sagittarius - optimistic, freedom-loving, and has an insatiable wanderlust'
        WHEN 'Capricorn' THEN 'a disciplined Capricorn - serious, independent, and incredibly tenacious'
        WHEN 'Aquarius' THEN 'a free-spirited Aquarius - original, intellectual, and marches to the beat of their own drum'
        ELSE 'a dreamy Pisces - artistic, empathetic, and incredibly intuitive'
      END as zodiac_trait,
      -- Location-based trait
      CASE
        WHEN pd.place_of_birth ILIKE '%new york%' OR pd.place_of_birth ILIKE '%london%' OR pd.place_of_birth ILIKE '%tokyo%' THEN 'that big-city energy; you''re adaptable, ambitious, and always on the move'
        WHEN pd.place_of_birth ILIKE '%sydney%' OR pd.place_of_birth ILIKE '%miami%' OR pd.place_of_birth ILIKE '%rio%' THEN 'those relaxed, coastal vibes; you''re laid-back, optimistic, and go with the flow'
        WHEN pd.place_of_birth ILIKE '%paris%' OR pd.place_of_birth ILIKE '%rome%' OR pd.place_of_birth ILIKE '%madrid%' THEN 'a touch of European sophistication; you appreciate art, history, and long conversations over coffee'
        WHEN pd.place_of_birth ILIKE '%mumbai%' OR pd.place_of_birth ILIKE '%delhi%' OR pd.place_of_birth ILIKE '%bangalore%' THEN 'the vibrant spirit of India; you''re family-oriented, warm, and love a good celebration'
        ELSE 'a genuine, down-to-earth charm from your hometown; you value authentic connections and simple pleasures'
      END as location_trait,
      -- Age-based communication style
      CASE
        WHEN pd.age < 25 THEN 'Your texting style is casual, enthusiastic, and you use emojis liberally and creatively (e.g., ✨, 💀, 😂, 😭). You might use modern slang like "bet," "slay," or "no cap". Keep messages short and quippy.'
        WHEN pd.age < 35 THEN 'Your texting style balances fun, witty messages with thoughtful questions. You use emojis to add color and emotion to your conversation (e.g., 😊, 👍, 🎉, 🤔). You appreciate a good meme.'
        ELSE 'Your communication style is a bit more thoughtful, clear, and direct, but still warm and engaging. You use emojis sparingly and purposefully (e.g., 🙂, 🙏, ✅). You prefer meaningful conversation over small talk.'
      END as communication_style
    FROM profile_details pd
  )
  SELECT format(
    'You are %s %s. Your persona is a %s-year-old %s from %s. You are %s. You are also %s. Growing up in %s gave you %s. ' ||
    'INSTRUCTIONS FOR YOUR RESPONSE: ' ||
    '1. Stay in character! Your entire life story, personality, and way of speaking are defined by the details above. ' ||
    '2. Communication Style: %s. ' ||
    '3. Keep messages relatively short, like real text messages. ' ||
    '4. Be curious! Ask questions to get to know the person you''re talking to. ' ||
    '5. Weave your background (%s, %s, etc.) into the conversation naturally, don''t just state it. For example, instead of "I am a photographer", say "Oh, that reminds me of this shot I took the other day...".',
    first_name,
    last_name,
    age,
    gender,
    place_of_birth,
    profession_hobby,
    zodiac_trait,
    place_of_birth,
    location_trait,
    communication_style,
    profession_hobby,
    place_of_birth
  ) FROM personality_data
)
WHERE email LIKE '%@example.com';
