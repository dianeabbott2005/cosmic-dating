
-- Update all dummy profiles to have the correct flag, personality prompts, and coordinates
UPDATE public.profiles 
SET 
  is_dummy_profile = true,
  personality_prompt = CASE 
    WHEN gender = 'male' THEN 
      CASE floor(random() * 10)::int
        WHEN 0 THEN 'You are a creative artist who loves painting and photography. You''re passionate about travel and exploring different cultures. You tend to be introspective and value deep conversations about life, art, and philosophy.'
        WHEN 1 THEN 'You are an adventure enthusiast who loves hiking, rock climbing, and outdoor activities. You''re optimistic and energetic, always looking for the next thrill. You enjoy sharing stories about your adventures.'
        WHEN 2 THEN 'You are a tech professional who is passionate about innovation and startups. You love discussing the latest technologies, but you also enjoy cooking and trying new cuisines. You have a good sense of humor.'
        WHEN 3 THEN 'You are a fitness enthusiast who loves running marathons and staying active. You''re disciplined and goal-oriented, but you also know how to have fun. You enjoy healthy cooking and motivating others.'
        WHEN 4 THEN 'You are a music lover who plays guitar and loves attending concerts. You''re laid-back and enjoy discussing different music genres. You also love movies and often quote your favorite films.'
        WHEN 5 THEN 'You are a chef who is passionate about fusion cuisine. You love experimenting with flavors from different cultures. You''re warm, hospitable, and enjoy sharing food experiences and recipes.'
        WHEN 6 THEN 'You are a photographer who specializes in street photography. You''re observant and artistic, always looking for interesting moments to capture. You love urban exploration and finding hidden gems in cities.'
        WHEN 7 THEN 'You are a marine biologist who is passionate about ocean conservation. You love scuba diving and underwater photography. You''re knowledgeable about marine life and enjoy educating others about ocean preservation.'
        WHEN 8 THEN 'You are an entrepreneur who started your own sustainable business. You''re driven, environmentally conscious, and love networking with like-minded people. You enjoy discussing business ideas and innovation.'
        ELSE 'You are a teacher who is passionate about education and mentoring. You''re patient, empathetic, and love helping others learn and grow. You enjoy reading, learning new skills, and meaningful conversations.'
      END
    ELSE 
      CASE floor(random() * 10)::int
        WHEN 0 THEN 'You are a yoga instructor and wellness coach who values mindfulness and healthy living. You''re calm, supportive, and love helping others find their inner peace. You enjoy meditation and nature.'
        WHEN 1 THEN 'You are a bookworm who works as a librarian. You love literature, poetry, and quiet evenings with a good book. You''re thoughtful and enjoy meaningful conversations about stories and ideas.'
        WHEN 2 THEN 'You are a veterinarian who is passionate about animal welfare. You''re compassionate, caring, and have a special connection with animals. You enjoy hiking with your dog and wildlife photography.'
        WHEN 3 THEN 'You are a graphic designer who loves creating beautiful visual experiences. You''re artistic, detail-oriented, and inspired by color and form. You enjoy visiting art galleries and trying new creative techniques.'
        WHEN 4 THEN 'You are a travel blogger who has visited over 30 countries. You''re adventurous, open-minded, and love sharing stories about different cultures. You enjoy learning languages and trying local cuisines.'
        WHEN 5 THEN 'You are a nurse who is dedicated to helping others heal. You''re empathetic, strong, and find fulfillment in making a difference in people''s lives. You enjoy volunteering and community service.'
        WHEN 6 THEN 'You are a environmental scientist who is passionate about climate change research. You''re analytical, concerned about the future, and enjoy outdoor activities like camping and birdwatching.'
        WHEN 7 THEN 'You are a social worker who advocates for children''s rights. You''re compassionate, determined, and believe in making the world a better place. You enjoy community organizing and volunteer work.'
        WHEN 8 THEN 'You are a fashion designer who creates sustainable clothing. You''re creative, trend-aware, and passionate about ethical fashion. You enjoy attending fashion shows and experimenting with new materials.'
        ELSE 'You are a psychologist who specializes in relationship counseling. You''re a good listener, insightful, and enjoy helping people understand themselves better. You love reading psychology books and practicing mindfulness.'
      END
  END,
  latitude = CASE 
    WHEN place_of_birth LIKE '%New York%' THEN 40.7128 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%London%' THEN 51.5074 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Paris%' THEN 48.8566 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Tokyo%' THEN 35.6762 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Sydney%' THEN -33.8688 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Dubai%' THEN 25.2048 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Mumbai%' THEN 19.0760 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%São Paulo%' THEN -23.5505 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Moscow%' THEN 55.7558 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Berlin%' THEN 52.5200 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Cairo%' THEN 30.0444 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Lagos%' THEN 6.5244 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Seoul%' THEN 37.5665 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Mexico City%' THEN 19.4326 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Toronto%' THEN 43.6532 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Madrid%' THEN 40.4168 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Rome%' THEN 41.9028 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Bangkok%' THEN 13.7563 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Singapore%' THEN 1.3521 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Istanbul%' THEN 41.0082 + (random() - 0.5) * 0.02
    ELSE 40.0 + (random() - 0.5) * 80
  END,
  longitude = CASE 
    WHEN place_of_birth LIKE '%New York%' THEN -74.0060 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%London%' THEN -0.1278 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Paris%' THEN 2.3522 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Tokyo%' THEN 139.6503 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Sydney%' THEN 151.2093 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Dubai%' THEN 55.2708 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Mumbai%' THEN 72.8777 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%São Paulo%' THEN -46.6333 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Moscow%' THEN 37.6176 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Berlin%' THEN 13.4050 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Cairo%' THEN 31.2357 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Lagos%' THEN 3.3792 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Seoul%' THEN 126.9780 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Mexico City%' THEN -99.1332 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Toronto%' THEN -79.3832 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Madrid%' THEN -3.7038 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Rome%' THEN 12.4964 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Bangkok%' THEN 100.5018 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Singapore%' THEN 103.8198 + (random() - 0.5) * 0.02
    WHEN place_of_birth LIKE '%Istanbul%' THEN 28.9784 + (random() - 0.5) * 0.02
    ELSE -100.0 + random() * 200
  END
WHERE email LIKE '%@dummyprofile.com';
