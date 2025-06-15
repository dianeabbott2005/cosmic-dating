
-- Fix the RLS policies to ensure proper access to matches, chats, and messages

-- Update matches RLS policies to ensure bidirectional visibility
DROP POLICY IF EXISTS "Users can view their matches" ON public.matches;
DROP POLICY IF EXISTS "System can create matches" ON public.matches;

CREATE POLICY "Users can view matches where they are involved" 
ON public.matches 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() = matched_user_id OR
  EXISTS (
    SELECT 1 FROM public.matches m2 
    WHERE m2.user_id = auth.uid() 
    AND m2.matched_user_id = matches.user_id
  )
);

CREATE POLICY "Users can create matches" 
ON public.matches 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update chats RLS policies
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can create chats with matches" ON public.chats;

CREATE POLICY "Users can view chats they are part of" 
ON public.chats 
FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create chats they are part of" 
ON public.chats 
FOR INSERT 
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Update messages RLS policies  
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON public.messages;

CREATE POLICY "Users can view messages in their chats" 
ON public.messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages in their chats" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.chats 
    WHERE chats.id = messages.chat_id 
    AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
  )
);

-- Create a function to ensure bidirectional matches
CREATE OR REPLACE FUNCTION create_bidirectional_match(user1_uuid uuid, user2_uuid uuid, compatibility_score_val decimal)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert match from user1 to user2
  INSERT INTO public.matches (user_id, matched_user_id, compatibility_score)
  VALUES (user1_uuid, user2_uuid, compatibility_score_val)
  ON CONFLICT (user_id, matched_user_id) DO NOTHING;
  
  -- Insert match from user2 to user1 (bidirectional)
  INSERT INTO public.matches (user_id, matched_user_id, compatibility_score)
  VALUES (user2_uuid, user1_uuid, compatibility_score_val)
  ON CONFLICT (user_id, matched_user_id) DO NOTHING;
END;
$$;
