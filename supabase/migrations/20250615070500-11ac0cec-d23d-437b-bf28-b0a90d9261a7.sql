
-- Add personality_prompt column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN personality_prompt TEXT;

-- Create conversation_contexts table to maintain chat history and context
CREATE TABLE public.conversation_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) NOT NULL,
  context_summary TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Enable RLS for conversation_contexts
ALTER TABLE public.conversation_contexts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_contexts
CREATE POLICY "Users can view conversation contexts for their chats" 
ON public.conversation_contexts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = conversation_contexts.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can create conversation contexts for their chats" 
ON public.conversation_contexts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = conversation_contexts.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update conversation contexts for their chats" 
ON public.conversation_contexts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = conversation_contexts.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

-- Function to generate personality prompts for existing profiles
CREATE OR REPLACE FUNCTION generate_personality_prompts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    profile_record RECORD;
    age INTEGER;
    personality_text TEXT;
    professions TEXT[] := ARRAY[
        'Software Engineer', 'Teacher', 'Doctor', 'Artist', 'Chef', 'Musician', 
        'Writer', 'Photographer', 'Architect', 'Designer', 'Lawyer', 'Nurse',
        'Marketing Manager', 'Sales Representative', 'Accountant', 'Therapist',
        'Personal Trainer', 'Social Worker', 'Data Scientist', 'Entrepreneur'
    ];
    personality_traits TEXT[] := ARRAY[
        'adventurous and loves trying new things',
        'calm and thoughtful in conversations',
        'enthusiastic about their hobbies',
        'family-oriented and values relationships',
        'career-focused but enjoys work-life balance',
        'creative and artistic in nature',
        'athletic and health-conscious',
        'intellectual and enjoys deep conversations',
        'humorous and loves making people laugh',
        'compassionate and empathetic'
    ];
    random_profession TEXT;
    random_trait TEXT;
BEGIN
    FOR profile_record IN 
        SELECT * FROM public.profiles 
        WHERE personality_prompt IS NULL
    LOOP
        -- Calculate age
        age := EXTRACT(YEAR FROM AGE(profile_record.date_of_birth));
        
        -- Get random profession and trait
        random_profession := professions[1 + floor(random() * array_length(professions, 1))::int];
        random_trait := personality_traits[1 + floor(random() * array_length(personality_traits, 1))::int];
        
        -- Generate personality prompt
        personality_text := format(
            'You are %s %s, a %s-year-old %s living in %s. You are %s. ' ||
            'You were born on %s at %s in %s. You work as a %s. ' ||
            'You are looking for someone who shares your values and interests. ' ||
            'Respond naturally as this person would, keeping your personality consistent. ' ||
            'Be conversational, engaging, and show genuine interest in getting to know the person you''re chatting with. ' ||
            'Remember details from previous conversations and reference them naturally. ' ||
            'Keep responses relatively short and natural, like real text messages.',
            profile_record.first_name,
            profile_record.last_name,
            age,
            profile_record.gender,
            profile_record.place_of_birth,
            random_trait,
            profile_record.date_of_birth,
            profile_record.time_of_birth,
            profile_record.place_of_birth,
            random_profession
        );
        
        -- Update the profile with personality prompt
        UPDATE public.profiles 
        SET personality_prompt = personality_text
        WHERE id = profile_record.id;
        
    END LOOP;
    
    RAISE NOTICE 'Generated personality prompts for all profiles!';
END;
$$;

-- Execute the function to generate personality prompts
SELECT generate_personality_prompts();

-- Clean up the function
DROP FUNCTION generate_personality_prompts();
