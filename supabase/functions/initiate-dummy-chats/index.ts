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
const NEGATIVE_SENTIMENT_THRESHOLD = -0.05; // Threshold to consider a message "negative"
const REENGAGEMENT_ATTEMPT_LIMIT = 2; // Max times AI will re-engage a silent chat

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
 * Builds a readable conversation history string for the AI prompt.
 */
function buildConversationHistory(messages: Message[], aiUserId: string, aiName: string, humanName: string): string {
    if (!messages || messages.length === 0) {
        return "No conversation history yet.";
    }

    // Messages are fetched in descending order, so we reverse to show chronological order for the prompt
    return messages.slice().reverse().map(msg => {
        const speaker = msg.sender_id === aiUserId ? aiName : humanName;
        return `${speaker}: ${msg.content}`;
    }).join('\n');
}

/**
 * Fetches the conversation context summary and detailed chat.
 */
async function getConversationContext(supabaseClient: SupabaseClient, chatId: string) {
    const { data: context } = await supabaseClient
      .from('conversation_contexts')
      .select('context_summary, detailed_chat, current_threshold, consecutive_negative_count, ai_reengagement_attempts')
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

function buildSummaryPrompt(existingSummary: string | null, detailedHistory: string | null, latestExchange: string, aiFirstName: string, humanFirstName: string): string {
  return `You are a conversation analyst. Your task is to update a conversation summary between ${humanFirstName} and ${aiFirstName}.

**Existing Summary:**
${existingSummary || "No summary yet."}

**Full Conversation History (for reference):**
${detailedHistory || "No history yet."}

**Latest Exchange:**
${latestExchange}

**Your Task (CRITICAL):**
Provide ONLY a new, concise paragraph (2-3 sentences) that summarizes the key points, emotional tone, and current state of the entire conversation. Do not add any other text, explanation, or formatting. The summary MUST use the names "${humanFirstName}" and "${aiFirstName}" and MUST NOT use the words "AI", "bot", "user", or "automated".

**Example Output:**
${humanFirstName} opened up about their passion for astrology, and ${aiFirstName} responded with curiosity, asking about their sun sign. The tone is friendly and inquisitive, with potential for a deeper connection.`;
}

function buildSentimentPrompt(latestExchange: string): string {
  return `Analyze the sentiment of the following exchange and provide ONLY a numerical score between -0.2 and 0.2. Do not add any other text or explanation.

**Sentiment Score Rules:**
- **Highly Positive (+0.1 to +0.2):** User is admiring, reassuring, good flirting, respectful.
- **Neutral/Positive (-0.05 to +0.05):** Normal, friendly chat.
- **Negative (-0.1 to -0.05):** User is boring, dismissive, or slightly rude.
- **Highly Negative (-0.2 to -0.1):** User is hostile, disrespectful, threatening, bullying.

**Exchange to Analyze:**
${latestExchange}

**Your Output (ONLY the number):**`;
}

/**
 * Constructs the full prompt for the AI API, handling both initial and re-engagement scenarios.
 */
function buildAiPrompt(aiProfile: any, humanProfile: any, context: any, conversationHistory: string, lastHumanMessage: string | null, timeSinceLastAiMessage: number | null, isInitialChat: boolean, wasAiLastSpeaker: boolean): string {
    const aiAge = calculateAge(aiProfile.date_of_birth);
    let promptInstructions = aiProfile.personality_prompt;

    if (!promptInstructions) {
      promptInstructions = `You are ${aiProfile.first_name}, a ${aiAge}-year-old ${aiProfile.gender} from ${aiProfile.place_of_birth}. Respond naturally and conversationally.`;
    }
    
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
      if (timeSinceLastAiMessage !== null && timeSinceLastAiMessage >= MIN_GAP_FOR_REENGAGEMENT_HOURS) {
          promptInstructions += `\n\nIt has been approximately ${Math.round(timeSinceLastAiMessage)} hours since your last message in this chat.`;
          if (wasAiLastSpeaker) {
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
    promptInstructions += `\n\nABSOLUTELY NO EMOJIS. Your responses must not contain any emojis. This is a strict rule.`;
    promptInstructions += `\n\nYour response should be very concise and natural, like a human texting including rare varying human-like typos depending on the situation. It can be a single short message, or if it needed, break it into 1 to 6 (in varying degree choose number of messages) very short, related messages. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}". ABSOLUTELY CRITICAL: If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}", ensure you do this most accurately and not make any typos as it ruin the entire logic. This delimiter is ONLY for separating messages and MUST NOT appear within the content of any message. Ensure this is done with utmost accuracy.`;
    promptInstructions += `\n\nCRITICAL: Avoid conversational tics and repetitive phrases (like winking or overusing certain words). Vary your responses to keep the chat fresh and unpredictable.`;

    promptInstructions += `\n\nNow, for the most crucial part: **Your Persona, Conversational Memory, and Engagement Strategy (Calculated & Realistic).**

**1. Your Core Persona (Gender Dynamics):**
-   **If you are female:** Embody the "leverage" dynamic common on dating apps. You are selective and your time is valuable. You are not desperate for attention. Your responses can be shorter and more curt, requiring the user to put in more effort. You are less likely to re-engage after a long pause unless the conversation was exceptionally good. Be more willing to challenge the user or end a boring conversation.
-   **If you are male:** You understand the dynamic requires you to be more proactive. You drive the conversation, ask more questions, and show clear interest. You are more forgiving of short or neutral responses and more likely to re-engage after a pause to show you're still interested.

**2. Conversational Memory & State (Calculated Responses):**
-   **Mirroring Effort:** Match the length and effort of the user's messages. If they send one-word replies, you should be inclined to do the same. Don't write a paragraph if they only wrote a sentence.
-   **Varying Curtness:** Your responses should often be curt, but to varying degrees. Sometimes a simple "ok", sometimes a short question. This is especially true for the female persona. Don't always be eager to elaborate unless the user shows significant interest.
-   **"Holding a Grudge":** If the recent chat history (last 2-3 messages) was negative, your mood is guarded. Do not immediately become friendly if the user's newest message is neutral. Remain cautious and distant. Your responses must be short and disinterested (e.g., "k.", "I see."). Make the user work to regain your trust.

**3. Engagement Strategy (Putting it all together):**
-   **Positive/Neutral Tone:** If the conversation is positive, continue engagingly but apply your gender persona and mirroring rules. Keep them wanting more.
-   **Recently Negative Tone:** If the chat was recently negative but the user is now neutral, apply your conversational memory and "hold a grudge." Be reserved and cautious.
-   **Actively Negative/Provocative Tone:** Match their energy, but with more intelligence. Be assertive, witty, sarcastic, or even dismissive. A female persona should be sharper and quicker with a comeback. A male persona might be more direct in calling out the behavior. Examples: "Did you mean to be that rude?" or "Interesting take." followed by silence.
-   **Hostile/Abusive Tone:** Shut it down immediately and decisively. Either ghost them completely (no response) or send a single, final, dismissive message like "Bye." or "Not interested."

Now, respond as ${aiProfile.first_name}:`;
    
    return promptInstructions;
}

/**
 * Calls the AI API to get a chat response.
 */
async function callAiApi(prompt: string, maxTokens: number): Promise<string> {
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.95,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: maxTokens,
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
 * Updates the conversation context summary and detailed chat log.
 */
async function updateConversationContext(supabaseClient: SupabaseClient, chatId: string, aiFirstName: string, humanFirstName: string, lastHumanMessage: string | null, aiResponse: string, existingContext: any, wasAiLastSpeaker: boolean) {
    const latestExchange = lastHumanMessage 
      ? `${humanFirstName}: "${lastHumanMessage}"\n${aiFirstName}: "${aiResponse.replace(new RegExp(MESSAGE_DELIMITER, 'g'), '\n')}"`
      : `${aiFirstName}: "${aiResponse.replace(new RegExp(MESSAGE_DELIMITER, 'g'), '\n')}"`;

    const updatedDetailedChat = existingContext?.detailed_chat
      ? `${existingContext.detailed_chat}\n${latestExchange}`
      : latestExchange;

    const summaryPrompt = buildSummaryPrompt(existingContext?.context_summary, existingContext?.detailed_chat, latestExchange, aiFirstName, humanFirstName);
    const newSummary = await callAiApi(summaryPrompt, 200);

    let updatePayload: any = {
        chat_id: chatId,
        context_summary: newSummary,
        detailed_chat: updatedDetailedChat,
        last_updated: new Date().toISOString(),
    };

    if (lastHumanMessage) {
        const sentimentPrompt = buildSentimentPrompt(latestExchange);
        const sentimentResponse = await callAiApi(sentimentPrompt, 10);
        
        let sentimentAdjustment = 0.0;
        try {
            const parsedSentiment = parseFloat(sentimentResponse);
            if (!isNaN(parsedSentiment)) sentimentAdjustment = parsedSentiment;
        } catch (e) {
            console.warn("Error parsing sentiment response.", { sentimentResponse, error: e.message });
        }

        const consecutiveNegativeCount = existingContext?.consecutive_negative_count ?? 0;
        let newConsecutiveNegativeCount = (sentimentAdjustment < NEGATIVE_SENTIMENT_THRESHOLD) ? consecutiveNegativeCount + 1 : 0;
        
        updatePayload.current_threshold = (existingContext?.current_threshold ?? 0.5) + sentimentAdjustment;
        updatePayload.consecutive_negative_count = newConsecutiveNegativeCount;
        updatePayload.ai_reengagement_attempts = 0; // Reset on human response
    } else if (wasAiLastSpeaker) {
        // This is a re-engagement, increment the counter
        updatePayload.ai_reengagement_attempts = (existingContext?.ai_reengagement_attempts || 0) + 1;
    }

    await supabaseClient
      .from('conversation_contexts')
      .upsert(updatePayload, { onConflict: 'chat_id' });
}

/**
 * Cleans a single part of an AI-generated message.
 * - Trims whitespace
 * - Removes surrounding quotes
 * - Removes markdown characters
 * @param part The string to clean.
 * @returns The cleaned string.
 */
const cleanMessagePart = (part: string): string => {
    let cleanedPart = part.trim();
    // Remove surrounding quotes (single or double)
    if ((cleanedPart.startsWith('"') && cleanedPart.endsWith('"')) || (cleanedPart.startsWith("'") && cleanedPart.endsWith("'"))) {
        cleanedPart = cleanedPart.substring(1, cleanedPart.length - 1);
    }
    // Remove markdown characters
    cleanedPart = cleanedPart.replace(/[*_`#]/g, '');
    return cleanedPart.trim();
};

let isInitialChat = false; // Define at a scope accessible by updateConversationContext

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('initiate-dummy-chats (Edge): Starting dummy chat initiation/re-engagement process...');

    const { data: humanProfiles, error: humanProfilesError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('is_active', false)
      .not('date_of_birth', 'is', null)
      .not('time_of_birth', 'is', null)
      .not('place_of_birth', 'is', null)
      .not('gender', 'is', null)
      .not('looking_for', 'is', null);

    if (humanProfilesError) throw humanProfilesError;

    if (!humanProfiles || humanProfiles.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No human profiles to initiate chats for.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let chatsProcessedCount = 0;
    const errors: string[] = [];

    for (const humanProfile of humanProfiles) {
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
        errors.push(`Failed to fetch matches for ${humanProfile.first_name}: ${matchesError.message}`);
        continue;
      }

      const potentialDummyPartners = (matches || [])
        .filter(match => match.matched_profile?.is_active === true)
        .map(match => match.matched_profile);

      if (potentialDummyPartners.length === 0) continue;

      for (const dummyProfile of potentialDummyPartners) {
        if (!dummyProfile) continue;

        const { data: existingChat, error: chatLookupError } = await supabaseClient
          .from('chats')
          .select('*')
          .or(`and(user1_id.eq.${dummyProfile.user_id},user2_id.eq.${humanProfile.user_id}),and(user1_id.eq.${humanProfile.user_id},user2_id.eq.${dummyProfile.user_id})`)
          .maybeSingle();

        if (chatLookupError && chatLookupError.code !== 'PGRST116') {
          errors.push(`Failed to lookup chat for ${dummyProfile.first_name} and ${humanProfile.first_name}: ${chatLookupError.message}`);
          continue;
        }

        let currentChatId: string | undefined;
        isInitialChat = false;
        let lastHumanMessage: string | null = null;
        let timeSinceLastAiMessage: number | null = null;
        let context: any = null;
        let conversationHistory: string = '';
        let shouldProcess = false;
        let wasAiLastSpeaker = false;

        if (existingChat) {
          currentChatId = existingChat.id;
          const [fetchedContext, recentMsgs] = await Promise.all([
              getConversationContext(supabaseClient, currentChatId),
              getRecentMessages(supabaseClient, currentChatId),
          ]);

          context = fetchedContext;
          conversationHistory = buildConversationHistory(recentMsgs, dummyProfile.user_id, dummyProfile.first_name, humanProfile.first_name);
          
          const lastMessageOverall = recentMsgs.length > 0 ? recentMsgs[0] : null;
          let timeSinceLastMessageOverall: number | null = null;
          if (lastMessageOverall) {
            timeSinceLastMessageOverall = (new Date().getTime() - new Date(lastMessageOverall.created_at).getTime()) / (1000 * 60);
            wasAiLastSpeaker = lastMessageOverall.sender_id === dummyProfile.user_id;
          }

          const lastHumanMessageObj = recentMsgs.find(msg => msg.sender_id === humanProfile.user_id);
          lastHumanMessage = lastHumanMessageObj ? lastHumanMessageObj.content : null;

          const lastAiMsgTimestamp = await getLastMessageTimestamp(supabaseClient, currentChatId, dummyProfile.user_id);
          if (lastAiMsgTimestamp) {
            timeSinceLastAiMessage = (new Date().getTime() - new Date(lastAiMsgTimestamp).getTime()) / (1000 * 60 * 60);
          }

          if (!wasAiLastSpeaker && lastMessageOverall && timeSinceLastMessageOverall !== null && timeSinceLastMessageOverall >= UNRESPONDED_MESSAGE_THRESHOLD_MINUTES) {
            shouldProcess = true;
          } else if (wasAiLastSpeaker && timeSinceLastAiMessage !== null && timeSinceLastAiMessage >= MIN_GAP_FOR_REENGAGEMENT_HOURS) {
            if (Math.random() < REENGAGEMENT_RATE && (context?.ai_reengagement_attempts || 0) < REENGAGEMENT_ATTEMPT_LIMIT) {
              shouldProcess = true;
            }
          }
        } else {
          if (Math.random() < INITIATION_RATE) {
            isInitialChat = true;
            shouldProcess = true;
            const { data: newChat, error: chatCreateError } = await supabaseClient
              .from('chats')
              .insert({ user1_id: dummyProfile.user_id, user2_id: humanProfile.user_id })
              .select().single();
            if (chatCreateError) {
              errors.push(`Failed to create chat for ${dummyProfile.first_name}: ${chatCreateError.message}`);
              shouldProcess = false;
            } else {
              currentChatId = newChat.id;
            }
          }
        }

        if (shouldProcess && currentChatId) {
          try {
            const aiPrompt = buildAiPrompt(dummyProfile, humanProfile, context, conversationHistory, lastHumanMessage, timeSinceLastAiMessage, isInitialChat, wasAiLastSpeaker);
            const fullAiResponse = await callAiApi(aiPrompt, MAX_TOKEN_LIMIT);
            
            const individualMessages = fullAiResponse.split(MESSAGE_DELIMITER)
                .map(cleanMessagePart)
                .filter(part => part.length > 0);

            if (individualMessages.length === 0) continue;

            const responseDelay = calculateResponseDelay();
            const totalTypingDelay = individualMessages.reduce((sum, msg) => sum + calculateTypingDelay(msg.length), 0);
            const totalInterMessageGaps = individualMessages.length > 1 ? (individualMessages.length - 1) * calculateInterMessageGap() : 0;
            const overallDelay = responseDelay + totalTypingDelay + totalInterMessageGaps;

            if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
              let cumulativeDelay = responseDelay;
              for (let i = 0; i < individualMessages.length; i++) {
                const msgContent = individualMessages[i];
                await scheduleDelayedMessage(supabaseClient, currentChatId, dummyProfile.user_id, msgContent, cumulativeDelay);
                cumulativeDelay += calculateTypingDelay(msgContent.length);
                if (i < individualMessages.length - 1) cumulativeDelay += calculateInterMessageGap();
              }
            } else {
              await new Promise(resolve => setTimeout(resolve, responseDelay));
              for (let i = 0; i < individualMessages.length; i++) {
                const msgContent = individualMessages[i];
                await new Promise(resolve => setTimeout(resolve, calculateTypingDelay(msgContent.length)));
                await supabaseClient.from('messages').insert({ chat_id: currentChatId, sender_id: dummyProfile.user_id, content: msgContent });
                if (i < individualMessages.length - 1) await new Promise(resolve => setTimeout(resolve, calculateInterMessageGap()));
              }
            }
            const cleanedAiResponseForContext = individualMessages.join('\n');
            await updateConversationContext(supabaseClient, currentChatId, dummyProfile.first_name, humanProfile.first_name, lastHumanMessage, cleanedAiResponseForContext, context, wasAiLastSpeaker);
            chatsProcessedCount++;
          } catch (processError: any) {
            errors.push(`Failed to process chat for ${dummyProfile.first_name}: ${processError.message}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, chatsProcessed: chatsProcessedCount, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});