import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type Message = { content: string; sender_id: string; created_at: string; };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@"; // Unique delimiter for splitting AI responses
const MAX_TOKEN_LIMIT = 100; // Maximum tokens for the AI response
const INITIATION_RATE = 0.03; // 3% chance for a dummy profile to initiate a chat with a human match

/**
 * Calculates age from a date of birth string.
 */
function calculateAge(dateOfBirth: string): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * Calls the AI API to get a chat response.
 */
async function callAiApi(prompt: string): Promise<string> {
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: MAX_TOKEN_LIMIT,
          }
        }),
      }
    );
    const aiData = await aiResponse.json();
    if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Error from chat service: Invalid response structure.');
      throw new Error('Invalid response from chat service');
    }
    return aiData.candidates[0].content.parts[0].text.trim();
}

/**
 * Stores the AI-generated message in the database.
 */
async function storeAiResponse(supabaseClient: SupabaseClient, chatId: string, senderId: string, content: string) {
    const { data: newMessage, error } = await supabaseClient
      .from('messages')
      .insert({ chat_id: chatId, sender_id: senderId, content: content })
      .select()
      .single();

    if (error) {
      console.error('Error storing message:', error);
      throw error;
    }
    return newMessage;
}

/**
 * Updates the conversation context summary.
 */
async function updateConversationContext(supabaseClient: SupabaseClient, chatId: string, senderFirstName: string, receiverFirstName: string, initialMessage: string) {
    const contextUpdate = `${senderFirstName} initiated with: "${initialMessage}".`;
    await supabaseClient
      .from('conversation_contexts')
      .upsert({
        chat_id: chatId,
        context_summary: contextUpdate,
        last_updated: new Date().toISOString()
      }, { onConflict: 'chat_id' });
}

/**
 * Builds a prompt for the AI to generate an initial conversation message.
 */
function buildInitialPrompt(dummyProfile: any, humanProfile: any): string {
  let prompt = `You are ${dummyProfile.first_name}, a ${calculateAge(dummyProfile.date_of_birth)}-year-old ${dummyProfile.gender} from ${dummyProfile.place_of_birth}. Your personality is: "${dummyProfile.personality_prompt}".`;
  prompt += `\n\nYou are initiating a conversation with ${humanProfile.first_name}, a ${calculateAge(humanProfile.date_of_birth)}-year-old ${humanProfile.gender} from ${humanProfile.place_of_birth}.`;
  prompt += `\n\nThis is a dating platform focused on astrological compatibility. You found them through a cosmic match.`;
  prompt += `\n\nYour goal is to start a friendly and engaging conversation. Keep your first message short and natural, like a human texting. You can mention something about their profile (e.g., their sun sign if you know it, or just a general friendly opening).`;
  prompt += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text. This is paramount.`;
  prompt += `\n\nIMPORTANT: Use emojis very sparingly, if at all. Prioritize clear text over emoji expression.`;
  prompt += `\n\nYour response should be a single, very concise message. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}".`;
  prompt += `\n\nNow, send your first message as ${dummyProfile.first_name}:`;
  return prompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for admin operations
  );

  try {
    console.log('initiate-dummy-chats (Edge): Starting dummy chat initiation process...');

    // 1. Fetch all human profiles (is_active: false)
    const { data: humanProfiles, error: humanProfilesError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('is_active', false)
      .not('date_of_birth', 'is', null) // Ensure human profile is complete enough
      .not('time_of_birth', 'is', null)
      .not('place_of_birth', 'is', null)
      .not('gender', 'is', null)
      .not('looking_for', 'is', null);

    if (humanProfilesError) {
      console.error('initiate-dummy-chats (Edge): Error fetching human profiles:', humanProfilesError.message);
      throw humanProfilesError;
    }

    if (!humanProfiles || humanProfiles.length === 0) {
      console.log('initiate-dummy-chats (Edge): No human profiles found to initiate chats for.');
      return new Response(JSON.stringify({ success: true, message: 'No human profiles to initiate chats for.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`initiate-dummy-chats (Edge): Found ${humanProfiles.length} human profiles.`);

    let chatsInitiatedCount = 0;
    const errors: string[] = [];

    for (const humanProfile of humanProfiles) {
      console.log(`initiate-dummy-chats (Edge): Processing human user: ${humanProfile.first_name} (${humanProfile.user_id})`);

      // Fetch matches for this human profile where the matched user is an active (dummy) profile
      const { data: matches, error: matchesError } = await supabaseClient
        .from('matches')
        .select(`
          matched_user_id,
          matched_profile:profiles!matches_matched_user_id_fkey(
            user_id, first_name, gender, date_of_birth, time_of_birth, place_of_birth, personality_prompt, is_active
          )
        `)
        .eq('user_id', humanProfile.user_id);

      if (matchesError) {
        console.error(`initiate-dummy-chats (Edge): Error fetching matches for ${humanProfile.first_name}:`, matchesError.message);
        errors.push(`Failed to fetch matches for ${humanProfile.first_name}: ${matchesError.message}`);
        continue;
      }

      const potentialDummyInitiators = (matches || [])
        .filter(match => match.matched_profile?.is_active === true) // Ensure it's a dummy profile
        .map(match => match.matched_profile);

      if (potentialDummyInitiators.length === 0) {
        console.log(`initiate-dummy-chats (Edge): No dummy matches found for ${humanProfile.first_name}.`);
        continue;
      }

      console.log(`initiate-dummy-chats (Edge): Found ${potentialDummyInitiators.length} potential dummy initiators for ${humanProfile.first_name}.`);

      // Check existing chats to avoid duplicates
      const { data: existingChats, error: existingChatsError } = await supabaseClient
        .from('chats')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${humanProfile.user_id},user2_id.eq.${humanProfile.user_id}`);

      if (existingChatsError) {
        console.error(`initiate-dummy-chats (Edge): Error fetching existing chats for ${humanProfile.first_name}:`, existingChatsError.message);
        errors.push(`Failed to fetch existing chats for ${humanProfile.first_name}: ${existingChatsError.message}`);
        continue;
      }

      const existingChatPartners = new Set<string>();
      (existingChats || []).forEach(chat => {
        existingChatPartners.add(chat.user1_id);
        existingChatPartners.add(chat.user2_id);
      });

      for (const dummyProfile of potentialDummyInitiators) {
        if (!dummyProfile || existingChatPartners.has(dummyProfile.user_id)) {
          console.log(`initiate-dummy-chats (Edge): Skipping ${dummyProfile?.first_name} as chat already exists or profile is invalid.`);
          continue;
        }

        // Apply the random initiation rate
        if (Math.random() < INITIATION_RATE) {
          try {
            console.log(`initiate-dummy-chats (Edge): Attempting to initiate chat between ${dummyProfile.first_name} (dummy) and ${humanProfile.first_name} (human).`);

            // Create new chat
            const { data: newChat, error: chatCreateError } = await supabaseClient
              .from('chats')
              .insert({
                user1_id: dummyProfile.user_id, // Dummy initiates
                user2_id: humanProfile.user_id // Human receives
              })
              .select()
              .single();

            if (chatCreateError) {
              console.error(`initiate-dummy-chats (Edge): Error creating chat for ${dummyProfile.first_name} and ${humanProfile.first_name}:`, chatCreateError.message);
              errors.push(`Failed to create chat for ${dummyProfile.first_name} and ${humanProfile.first_name}: ${chatCreateError.message}`);
              continue;
            }

            // Generate initial message
            const initialPrompt = buildInitialPrompt(dummyProfile, humanProfile);
            const initialMessageContent = await callAiApi(initialPrompt);
            
            // Store initial message
            await storeAiResponse(supabaseClient, newChat.id, dummyProfile.user_id, initialMessageContent);

            // Update conversation context
            await updateConversationContext(supabaseClient, newChat.id, dummyProfile.first_name, humanProfile.first_name, initialMessageContent);

            console.log(`initiate-dummy-chats (Edge): Successfully initiated chat and sent first message from ${dummyProfile.first_name} to ${humanProfile.first_name}.`);
            chatsInitiatedCount++;

          } catch (initiationError: any) {
            console.error(`initiate-dummy-chats (Edge): Error during chat initiation for ${dummyProfile.first_name} and ${humanProfile.first_name}:`, initiationError.message);
            errors.push(`Failed to initiate chat for ${dummyProfile.first_name} and ${humanProfile.first_name}: ${initiationError.message}`);
          }
        } else {
          console.log(`initiate-dummy-chats (Edge): Skipping initiation for ${dummyProfile.first_name} (random chance).`);
        }
      }
    }

    console.log(`initiate-dummy-chats (Edge): Finished. Chats initiated: ${chatsInitiatedCount}. Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        chatsInitiated: chatsInitiatedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('initiate-dummy-chats (Edge): Top-level error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});