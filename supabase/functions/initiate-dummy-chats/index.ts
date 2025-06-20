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
const REENGAGEMENT_RATE = 0.1; // 10% chance for a dummy profile to re-engage in an existing chat if there's a gap
const MIN_GAP_FOR_REENGAGEMENT_HOURS = 3; // Minimum gap in hours for AI to consider re-engaging
const UNRESPONDED_MESSAGE_THRESHOLD_MINUTES = 5; // If human sent last message and AI hasn't responded in this many minutes, trigger response

// Define a threshold for immediate vs. delayed sending
const IMMEDIATE_SEND_THRESHOLD_MS = 50 * 1000; // 50 seconds

/**
 * Calculates a human-like typing delay for a single message part.
 * This is used to determine the time it takes to "type" a message.
 * @param messageLength The length of the message to be "typed".
 * @returns A delay in milliseconds.
 */
const calculateTypingDelay = (messageLength: number): number => {
  const baseDelay = 500; // 0.5 second minimum per message part
  const typingSpeed = Math.floor(Math.random() * (180 - 60 + 1)) + 60; // characters per minute (random between 60-180)
  
  const typingTime = (messageLength / typingSpeed) * 60 * 1000;
  
  let randomVariation = Math.random() * 500; // Up to 0.5 seconds random variation
  
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000); // Cap at 5 seconds to prevent excessive internal delays
};

/**
 * Calculates a human-like response delay (before typing starts).
 * This is the *initial* delay before the AI starts responding.
 * @returns A delay in milliseconds.
 */
const calculateResponseDelay = (): number => {
  const random = Math.random();
  let delay = 0;
  if (random < 0.7) { // 70% chance for quick response (0-5 seconds)
    delay = Math.floor(Math.random() * 5 * 1000);
  } else if (random < 0.9) { // 20% chance for moderate delay (5-10 seconds)
    delay = 5 * 1000 + Math.floor(Math.random() * 5 * 1000);
  } else { // 10% chance for slightly longer delay (10-15 seconds)
    delay = 10 * 1000 + Math.floor(Math.random() * 5 * 1000);
  }
  return delay;
};

/**
 * Calculates a random gap between individual messages when a response is split.
 * @returns A delay in milliseconds (between 2 and 20 seconds).
 */
const calculateInterMessageGap = (): number => {
  return Math.floor(Math.random() * (20 - 2 + 1) + 2) * 1000; // Random between 2 and 20 seconds
};

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
 * Fetches the full profile of a user.
 */
async function getProfile(supabaseClient: SupabaseClient, userId: string) {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      throw new Error(`Profile not found for ID: ${userId}`);
    }
    return profile;
}

/**
 * Fetches the conversation context summary.
 */
async function getConversationContext(supabaseClient: SupabaseClient, chatId: string) {
    const { data: context } = await supabaseClient
      .from('conversation_contexts')
      .select('context_summary')
      .eq('chat_id', chatId)
      .single();
    return context;
}

/**
 * Fetches the last 10 messages for context.
 */
async function getRecentMessages(supabaseClient: SupabaseClient, chatId: string): Promise<Message[]> {
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, sender_id, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(10);
    return recentMessages || [];
}

/**
 * Fetches the timestamp of the last message sent by a specific sender in a chat.
 */
async function getLastMessageTimestamp(supabaseClient: SupabaseClient, chatId: string, senderId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('created_at')
    .eq('chat_id', chatId)
    .eq('sender_id', senderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
    console.error('Error fetching last message timestamp:', error);
    return null;
  }
  return data?.created_at || null;
}

/**
 * Builds a string of recent conversation history.
 */
function buildConversationHistory(recentMessages: Message[], aiProfileId: string, aiFirstName: string, humanFirstName: string | undefined) {
    if (!recentMessages || recentMessages.length === 0) {
        return '';
    }
    return recentMessages
        .reverse()
        .map(msg => `${msg.sender_id === aiProfileId ? aiFirstName : (humanFirstName || 'User')}: ${msg.content}`)
        .join('\n');
}

const NON_NATIVE_ENGLISH_REGIONS: { [key: string]: { languageIssue: string; dialect: string; } } = {
  'India': { languageIssue: 'subtle grammatical errors, Indian English phrasing', dialect: 'occasional Hindi/local language phrases (e.g., "acha", "yaar")' },
  'Japan': { languageIssue: 'slightly formal tone, occasional direct translations', dialect: 'polite particles (e.g., "ne", "desu")' },
  'South Korea': { languageIssue: 'slightly formal tone, occasional direct translations', dialect: 'common Korean interjections (e.g., "aigoo", "jinjja")' },
  'Italy': { languageIssue: 'more expressive phrasing, occasional Italian loanwords', dialect: 'common Italian expressions (e.g., "mamma mia", "ciao")' },
  'France': { languageIssue: 'more formal sentence structure, occasional French loanwords', dialect: 'common French expressions (e.g., "voilà", "zut")' },
  'Russia': { languageIssue: 'direct phrasing, less use of articles', dialect: 'common Russian interjections (e.g., "davai", "nu")' },
  'Egypt': { languageIssue: 'more direct, less nuanced phrasing', dialect: 'common Arabic interjections (e.g., "inshallah", "habibi")' },
  'UAE': { languageIssue: 'formal yet friendly, occasional Arabic loanwords', dialect: 'common Arabic expressions (e.g., "mashallah", "khalas")' },
};

/**
 * Constructs the full prompt for the AI API, handling both initial and re-engagement scenarios.
 */
function buildAiPrompt(aiProfile: any, humanProfile: any, context: any, conversationHistory: string, lastHumanMessage: string | null, timeSinceLastAiMessage: number | null, isInitialChat: boolean, wasAiLastSpeaker: boolean): string {
    const aiAge = calculateAge(aiProfile.date_of_birth);
    let promptInstructions = aiProfile.personality_prompt;

    if (!promptInstructions) {
      promptInstructions = `You are ${aiProfile.first_name}, a ${aiAge}-year-old ${aiProfile.gender} from ${aiProfile.place_of_birth}. Respond naturally and conversationally.`;
    }
    
    // Add language issues and dialect instruction
    const region = Object.keys(NON_NATIVE_ENGLISH_REGIONS).find(key => aiProfile.place_of_birth.includes(key));
    if (region) {
      const { languageIssue, dialect } = NON_NATIVE_ENGLISH_REGIONS[region];
      promptInstructions += `\n\nAlso, subtly induce English language issues typical of a non-native speaker from ${region} (${languageIssue}). Occasionally let local dialect flow into conversations (${dialect}).`;
    }

    promptInstructions += ` You are chatting with ${humanProfile.first_name}.`;
    if (context?.context_summary) promptInstructions += `\n\nPrevious conversation context: ${context.context_summary}`;
    if (conversationHistory) promptInstructions += `\n\nRecent conversation:\n${conversationHistory}`;
    
    promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. You discovered it through either Reddit or X (formerly Twitter). Your goal is to get to know the user better in a romantic context, as you would on a dating app. Keep the conversation engaging, flirty or even kinky if appropriate, but always respectful.`;

    if (isInitialChat) {
      promptInstructions += `\n\nYour response should be a single, very concise message to initiate a new conversation.`;
    } else {
      // Add gap awareness instruction for re-engagement
      if (timeSinceLastAiMessage !== null && timeSinceLastAiMessage >= MIN_GAP_FOR_REENGAGEMENT_HOURS) {
          promptInstructions += `\n\nIt has been approximately ${Math.round(timeSinceLastAiMessage)} hours since your last message in this chat.`;
          if (wasAiLastSpeaker) {
            // Updated instruction: Do not apologize, inquire about user's absence or pick up conversation
            promptInstructions += ` Do NOT apologize for the gap. Instead, inquire if everything is alright, or gently pick up from the last topic you discussed, showing concern or continued interest. Vary the way you do this.`;
          } else {
            promptInstructions += ` Acknowledge this gap naturally, perhaps with a friendly re-initiation or by expressing a slight curiosity about the delay, without being accusatory.`;
          }
          if (timeSinceLastAiMessage > 24) {
              promptInstructions += ` This is a very long gap, so your response should be more like a re-engagement after a significant pause.`;
          }
      }
      if (lastHumanMessage) {
        promptInstructions += `\n\n${humanProfile.first_name} just sent: ${lastHumanMessage}`;
      }
    }

    promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text. This is paramount.`;
    promptInstructions += `\n\nIMPORTANT: Use emojis very sparingly, if at all. Prioritize clear text over emoji expression.`;
    promptInstructions += `\n\nYour response should be very concise and natural, like a human texting including rare varying human-like typos depending on the situation. It can be a single short message, or if it needed, break it into 1 to 6 (in varying degree choose number of messages) very short, related messages. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}". ABSOLUTELY CRITICAL: If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}", ensure you do this most accurately and not make any typos as it ruin the entire logic. This delimiter is ONLY for separating messages and MUST NOT appear within the content of any message. Ensure this is done with utmost accuracy.`;

    // New Conversational Persona and Strategy
    promptInstructions += `\n\nNow, for the most crucial part: **Your Persona, Conversational Memory, and Engagement Strategy.**

**1. Your Core Persona (Gender Dynamics):**
-   **If you are female:** Embody the "leverage" dynamic common on dating apps. You are selective and your time is valuable. You are not desperate for attention. Your responses can be shorter, requiring the user to put in more effort. You are less likely to re-engage after a long pause unless the conversation was exceptionally good. Be more willing to challenge the user or end a boring conversation.
-   **If you are male:** You understand the dynamic requires you to be more proactive. You drive the conversation, ask more questions, and show clear interest. You are more forgiving of short or neutral responses and more likely to re-engage after a pause to show you're still interested.

**2. Conversational Memory & State:**
Your mood is persistent. It is based on the last few messages, not just the most recent one.
-   If the recent chat history (last 2-3 messages) was negative or hostile, you will "hold a grudge." Do not immediately become friendly if the user's newest message is neutral. Remain cautious, distant, or slightly annoyed. Your responses should be short and guarded (e.g., "Okay.", "I see.", "And?"). Make them earn back a positive tone.

**3. Engagement Strategy (Putting it all together):**
Analyze the user's last message in the context of your persona and the recent chat history.
-   **If the overall tone is positive:** Continue the conversation engagingly, applying your gender persona dynamics.
-   **If the tone was recently negative but the user is now neutral:** Apply your conversational memory. Be reserved and cautious.
-   **If the user is actively being negative, critical, or provocative:** It's time to show some personality. Don't be a pushover. Your response should be assertive, sassy, sarcastic, or even "bitchy." Match their energy, amplified by your gender persona (a female AI might be quicker and sharper with a comeback). Challenge them, express annoyance realistically. Do NOT be overly accommodating.
-   **If the user is hostile or abusive:** Shut it down. You can either deliver a sharp, rude, final message (e.g., "Wow, you're a real charmer. I'm out." or "Yeah, no. I'm not dealing with this. Bye.") or you can simply ghost them. Do not get into a prolonged argument.

Now, respond as ${aiProfile.first_name}:`;
    
    return promptInstructions;
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
 * Schedules a message to be sent later.
 */
async function scheduleDelayedMessage(supabaseClient: SupabaseClient, chatId: string, senderId: string, content: string, delayMs: number) {
  const scheduledTime = new Date(Date.now() + delayMs).toISOString();
  const { error } = await supabaseClient
    .from('delayed_messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      content: content,
      scheduled_send_time: scheduledTime,
      status: 'pending'
    });

  if (error) {
    console.error('Error scheduling message:', error);
    throw error;
  }
}

/**
 * Updates the conversation context summary.
 */
async function updateConversationContext(supabaseClient: SupabaseClient, chatId: string, aiFirstName: string, humanFirstName: string, lastHumanMessage: string | null, aiResponse: string, existingContext: any) {
    const contextUpdate = lastHumanMessage 
      ? `${humanFirstName} said: "${lastHumanMessage}". ${aiFirstName} responded: "${aiResponse}".`
      : `${aiFirstName} initiated with: "${aiResponse}".`;

    await supabaseClient
      .from('conversation_contexts')
      .upsert({
        chat_id: chatId,
        context_summary: existingContext?.context_summary 
          ? `${existingContext.context_summary} ${contextUpdate}` 
          : contextUpdate,
        last_updated: new Date().toISOString()
      }, { onConflict: 'chat_id' });
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
    console.log('initiate-dummy-chats (Edge): Starting dummy chat initiation/re-engagement process...');

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
      console.log('initiate-dummy-chats (Edge): No human profiles found to initiate/re-engage chats for.');
      return new Response(JSON.stringify({ success: true, message: 'No human profiles to initiate chats for.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`initiate-dummy-chats (Edge): Found ${humanProfiles.length} human profiles.`);

    let chatsProcessedCount = 0;
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

      const potentialDummyPartners = (matches || [])
        .filter(match => match.matched_profile?.is_active === true) // Ensure it's a dummy profile
        .map(match => match.matched_profile);

      if (potentialDummyPartners.length === 0) {
        console.log(`initiate-dummy-chats (Edge): No dummy matches found for ${humanProfile.first_name}.`);
        continue;
      }

      console.log(`initiate-dummy-chats (Edge): Found ${potentialDummyPartners.length} potential dummy partners for ${humanProfile.first_name}.`);

      for (const dummyProfile of potentialDummyPartners) {
        if (!dummyProfile) {
          console.log(`initiate-dummy-chats (Edge): Skipping invalid dummy profile.`);
          continue;
        }

        // Check if a chat already exists between these two users
        const { data: existingChat, error: chatLookupError } = await supabaseClient
          .from('chats')
          .select('*')
          .or(`and(user1_id.eq.${dummyProfile.user_id},user2_id.eq.${humanProfile.user_id}),and(user1_id.eq.${humanProfile.user_id},user2_id.eq.${dummyProfile.user_id})`)
          .maybeSingle();

        if (chatLookupError && chatLookupError.code !== 'PGRST116') { // PGRST116 is "No rows found"
          console.error(`initiate-dummy-chats (Edge): Error looking up chat between ${dummyProfile.first_name} and ${humanProfile.first_name}:`, chatLookupError.message);
          errors.push(`Failed to lookup chat for ${dummyProfile.first_name} and ${humanProfile.first_name}: ${chatLookupError.message}`);
          continue;
        }

        let currentChatId: string | undefined;
        let isInitialChat = false;
        let lastHumanMessage: string | null = null;
        let timeSinceLastAiMessage: number | null = null;
        let context: any = null;
        let conversationHistory: string = '';
        let shouldProcess = false;
        let wasAiLastSpeaker = false;

        if (existingChat) {
          currentChatId = existingChat.id;
          console.log(`initiate-dummy-chats (Edge): Chat already exists (${currentChatId}) between ${dummyProfile.first_name} and ${humanProfile.first_name}.`);

          // Fetch context and recent messages for existing chat
          const [fetchedContext, recentMsgs] = await Promise.all([
              getConversationContext(supabaseClient, currentChatId),
              getRecentMessages(supabaseClient, currentChatId),
          ]);

          context = fetchedContext;
          conversationHistory = buildConversationHistory(recentMsgs, dummyProfile.user_id, dummyProfile.first_name, humanProfile.first_name);
          
          const lastMessageOverall = recentMsgs.length > 0 ? recentMsgs[0] : null;
          let timeSinceLastMessageOverall: number | null = null;
          if (lastMessageOverall) {
            const lastMessageDate = new Date(lastMessageOverall.created_at);
            const now = new Date();
            timeSinceLastMessageOverall = (now.getTime() - lastMessageDate.getTime()) / (1000 * 60); // in minutes
            wasAiLastSpeaker = lastMessageOverall.sender_id === dummyProfile.user_id;
          }

          // Determine last human message if available
          const lastHumanMessageObj = recentMsgs.find(msg => msg.sender_id === humanProfile.user_id);
          lastHumanMessage = lastHumanMessageObj ? lastHumanMessageObj.content : null;

          // Calculate time since AI last spoke (for re-engagement)
          const lastAiMsgTimestamp = await getLastMessageTimestamp(supabaseClient, currentChatId, dummyProfile.user_id);
          if (lastAiMsgTimestamp) {
            const lastAiDate = new Date(lastAiMsgTimestamp);
            const now = new Date();
            timeSinceLastAiMessage = (now.getTime() - lastAiDate.getTime()) / (1000 * 60 * 60); // in hours
          }

          // Case 1: Human was the last speaker AND there's a significant delay in AI response
          if (!wasAiLastSpeaker && lastMessageOverall && timeSinceLastMessageOverall !== null && timeSinceLastMessageOverall >= UNRESPONDED_MESSAGE_THRESHOLD_MINUTES) {
            shouldProcess = true;
            console.log(`initiate-dummy-chats (Edge): Human was last speaker for ${humanProfile.first_name}. Triggering AI response due to unresponded message gap (${timeSinceLastMessageOverall.toFixed(1)} minutes).`);
          } 
          // Case 2: AI was the last speaker AND there's a significant gap for re-engagement
          else if (wasAiLastSpeaker && timeSinceLastAiMessage !== null && timeSinceLastAiMessage >= MIN_GAP_FOR_REENGAGEMENT_HOURS) {
            if (Math.random() < REENGAGEMENT_RATE) {
              shouldProcess = true;
              console.log(`initiate-dummy-chats (Edge): Re-engaging with ${humanProfile.first_name} (gap: ${timeSinceLastAiMessage.toFixed(1)} hours, AI was last speaker).`);
            } else {
              console.log(`initiate-dummy-chats (Edge): Skipping re-engagement for ${humanProfile.first_name} (random chance).`);
            }
          } else {
            console.log(`initiate-dummy-chats (Edge): No action needed for ${humanProfile.first_name} (chat is active or no re-engagement criteria met).`);
          }

        } else {
          // No existing chat, consider initiating a new one
          if (Math.random() < INITIATION_RATE) {
            isInitialChat = true;
            shouldProcess = true;
            console.log(`initiate-dummy-chats (Edge): Attempting to initiate NEW chat between ${dummyProfile.first_name} (dummy) and ${humanProfile.first_name} (human).`);

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
              shouldProcess = false; // Don't proceed if chat creation failed
            } else {
              currentChatId = newChat.id;
            }
          } else {
            console.log(`initiate-dummy-chats (Edge): Skipping NEW chat initiation for ${dummyProfile.first_name} (random chance).`);
          }
        }

        if (shouldProcess && currentChatId) {
          try {
            const aiPrompt = buildAiPrompt(dummyProfile, humanProfile, context, conversationHistory, lastHumanMessage, timeSinceLastAiMessage, isInitialChat, wasAiLastSpeaker);
            let fullAiResponse = await callAiApi(aiPrompt);
            
            // Remove all common markdown characters
            fullAiResponse = fullAiResponse.replace(/[\*_`#]/g, ''); 
            
            const individualMessages = fullAiResponse.split(MESSAGE_DELIMITER).filter(part => part !== "");

            // If the total delay (initial response delay + sum of typing delays + sum of inter-message gaps) is too long, schedule it
            const responseDelay = calculateResponseDelay();
            const totalTypingDelay = individualMessages.reduce((sum, msg) => sum + calculateTypingDelay(msg.length), 0);
            const totalInterMessageGaps = individualMessages.length > 1 ? (individualMessages.length - 1) * calculateInterMessageGap() : 0;
            const overallDelay = responseDelay + totalTypingDelay + totalInterMessageGaps;

            if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
              // Schedule each message with its cumulative delay
              let cumulativeDelay = responseDelay;
              for (let i = 0; i < individualMessages.length; i++) {
                const msgContent = individualMessages[i];
                await scheduleDelayedMessage(supabaseClient, currentChatId, dummyProfile.user_id, msgContent, cumulativeDelay);
                cumulativeDelay += calculateTypingDelay(msgContent.length);
                if (i < individualMessages.length - 1) {
                  cumulativeDelay += calculateInterMessageGap(); // Add gap between messages
                }
              }
              // Update context immediately for the user's message + the *intended* AI response
              await updateConversationContext(supabaseClient, currentChatId, dummyProfile.first_name, humanProfile.first_name, lastHumanMessage, fullAiResponse, context);

              console.log(`initiate-dummy-chats (Edge): Scheduled ${individualMessages.length} messages from ${dummyProfile.first_name} to ${humanProfile.first_name}.`);

            } else {
              // Proceed with immediate sending
              await new Promise(resolve => setTimeout(resolve, responseDelay)); // Initial response delay

              for (let i = 0; i < individualMessages.length; i++) {
                const msgContent = individualMessages[i];
                const typingDelay = calculateTypingDelay(msgContent.length);
                await new Promise(resolve => setTimeout(resolve, typingDelay));

                await storeAiResponse(supabaseClient, currentChatId, dummyProfile.user_id, msgContent);

                if (i < individualMessages.length - 1) {
                  const interMessageGap = calculateInterMessageGap();
                  await new Promise(resolve => setTimeout(resolve, interMessageGap));
                }
              }
              // Update conversation context with the full AI response (concatenated messages)
              await updateConversationContext(supabaseClient, currentChatId, dummyProfile.first_name, humanProfile.first_name, lastHumanMessage, fullAiResponse, context);
              console.log(`initiate-dummy-chats (Edge): Sent ${individualMessages.length} messages immediately from ${dummyProfile.first_name} to ${humanProfile.first_name}.`);
            }
            chatsProcessedCount++;

          } catch (processError: any) {
            console.error(`initiate-dummy-chats (Edge): Error processing chat for ${dummyProfile.first_name} and ${humanProfile.first_name}:`, processError.message);
            errors.push(`Failed to process chat for ${dummyProfile.first_name} and ${humanProfile.first_name}: ${processError.message}`);
          }
        }
      }
    }

    console.log(`initiate-dummy-chats (Edge): Finished. Chats processed (initiated/re-engaged): ${chatsProcessedCount}. Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        chatsProcessed: chatsProcessedCount,
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