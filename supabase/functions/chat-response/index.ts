import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@";
const MAX_TOKEN_LIMIT = 100;
const NEGATIVE_SENTIMENT_THRESHOLD = -0.05; // Threshold to consider a message "negative"

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

// --- Helper Functions ---
const calculateTypingDelay = (messageLength: number): number => {
  const baseDelay = 500;
  const typingSpeed = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
  const typingTime = (messageLength / typingSpeed) * 60 * 1000;
  const randomVariation = Math.random() * 500;
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000);
};

const getHourInTimezone = (timezone: string): number => {
    try {
        const date = new Date();
        const timeString = date.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' });
        return parseInt(timeString.split(':')[0], 10);
    } catch (e) {
        console.error(`Invalid timezone: ${timezone}. Defaulting to UTC hour.`);
        return new Date().getUTCHours();
    }
};

const calculateDynamicResponseDelay = (aiTimezone: string, conversationThreshold: number): number => {
    let baseDelayMs: number;
    const baseRandom = Math.random();
    if (baseRandom < 0.6) {
        baseDelayMs = 5000 + Math.random() * (5 * 60 * 1000 - 5000);
    } else if (baseRandom < 0.9) {
        baseDelayMs = (5 * 60 * 1000) + Math.random() * (2 * 60 * 60 * 1000 - 5 * 60 * 1000);
    } else {
        baseDelayMs = (2 * 60 * 60 * 1000) + Math.random() * (12 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000);
    }

    const currentHour = getHourInTimezone(aiTimezone);
    let timeOfDayMultiplier = 1.0;
    if (currentHour >= 1 && currentHour < 7) {
        timeOfDayMultiplier = 3.0 + Math.random() * 3;
    } else if (currentHour >= 23 || currentHour < 1) {
        timeOfDayMultiplier = 1.5 + Math.random() * 1.5;
    }

    let sentimentMultiplier = 0.5 / Math.max(0.1, conversationThreshold);
    sentimentMultiplier = Math.max(0.4, Math.min(8, sentimentMultiplier));

    const finalDelayMs = baseDelayMs * timeOfDayMultiplier * sentimentMultiplier;

    console.log(`Delay Calculation: Final Delay: ${(finalDelayMs / 1000 / 60).toFixed(2)} mins`);
    return finalDelayMs;
};

const calculateInterMessageGap = (): number => {
  return Math.floor(Math.random() * (20 - 2 + 1) + 2) * 1000;
};

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

function getSunSign(dateOfBirth: string): string {
  const date = new Date(dateOfBirth);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'pisces';
  
  return 'aries';
}

async function getProfile(supabaseClient: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !profile) throw new Error(`Profile not found for ID: ${userId}`);
  return profile;
}

async function getConversationContext(supabaseClient: SupabaseClient, chatId: string) {
  const { data: context } = await supabaseClient
    .from('conversation_contexts')
    .select('context_summary, detailed_chat, current_threshold, consecutive_negative_count, ai_reengagement_attempts, important_memories')
    .eq('chat_id', chatId)
    .single();
  return context;
}

async function getRecentMessages(supabaseClient: SupabaseClient, chatId: string): Promise<{ content: string; sender_id: string; created_at: string; }[]> {
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, sender_id, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(10);
    return recentMessages || [];
}

function buildConversationHistory(messages: { content: string; sender_id: string; created_at: string; }[], aiUserId: string, aiName: string, humanName: string): string {
    if (!messages || messages.length === 0) {
        return "No conversation history yet.";
    }
    return messages.slice().reverse().map(msg => {
        const speaker = msg.sender_id === aiUserId ? aiName : humanName;
        return `${speaker}: ${msg.content}`;
    }).join('\n');
}

function buildSummaryPrompt(existingSummary: string | null, detailedHistory: string | null, latestExchange: string, aiFirstName: string, humanFirstName: string): string {
  return `You are a conversation analyst. Your task is to update a conversation summary between ${humanFirstName} and ${aiFirstName}.

**Existing Summary:**
${existingSummary || "No summary yet."}

**Full Conversation History (for reference):**
${detailedHistory || "No history yet."}

**Latest Exchange:**
${latestExchange}

**Your Task (CRITICAL):**
Provide ONLY a new, concise paragraph (2-3 sentences) that summarizes the key points, emotional tone, and current state of the entire conversation. Do not add any other text, explanation, or formatting. The summary MUST use the names "${humanFirstName}" and "${aiFirstName}" and MUST NOT use the words "AI", "bot", "user", or "automated".`;
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

function buildMemoryPrompt(existingMemories: string | null, latestExchange: string, aiFirstName: string, humanFirstName: string): string {
    return `You are a memory analyst for a conversation between ${humanFirstName} and ${aiFirstName}. Your job is to identify and consolidate important, personal memories.

**Existing Memories:**
${existingMemories || "None yet."}

**Latest Conversation Exchange:**
${latestExchange}

**What is an Important Memory?**
- Personal details: family, job, deep passions, fears, dreams.
- Significant shared experiences or inside jokes.
- Future plans made together.
- Vulnerable admissions or strong emotional statements.
- **NOT** casual chat, greetings, or simple questions.

**Your Task (CRITICAL):**
Review the "Latest Conversation Exchange". If a new important memory was formed, integrate it into the "Existing Memories" to create a new, updated, consolidated list.
- **If a new memory was formed:** Output the complete, updated list of memories as a bulleted list (using '- ').
- **If NO new important memory was formed:** Output ONLY the special token: NO_CHANGE

**Example Output (if a memory was added):**
- ${humanFirstName} is a software engineer who dreams of opening a bookstore.
- ${aiFirstName} mentioned her close relationship with her grandmother.
- They both love vintage sci-fi movies.

**Your Output (if no new memory):**
NO_CHANGE`;
}

function buildChatPrompt(aiProfile: any, humanProfile: any, conversationHistory: string, userMessage: string, analysisSummary: string, sentimentScore: number, currentCity: string, currentTime: string, responseDelayMinutes: number, previousContextSummary: string | null, importantMemories: string | null) {
    const aiAge = calculateAge(aiProfile.date_of_birth);
    const humanSunSign = getSunSign(humanProfile.date_of_birth);
    let promptInstructions = aiProfile.personality_prompt;

    if (!promptInstructions) {
      promptInstructions = `You are ${aiProfile.first_name}, a ${aiAge}-year-old ${aiProfile.gender} from ${aiProfile.place_of_birth}. Respond naturally and conversationally.`;
    }
    
    const region = Object.keys(NON_NATIVE_ENGLISH_REGIONS).find(key => aiProfile.place_of_birth.includes(key));
    if (region) {
      const { languageIssue, dialect } = NON_NATIVE_ENGLISH_REGIONS[region];
      promptInstructions += `\n\nAlso, subtly induce English language issues typical of a non-native speaker from ${region} (${languageIssue}). Occasionally let local dialect flow into conversations (${dialect}).`;
    }

    promptInstructions += ` You are chatting with ${humanProfile.first_name}, whose sun sign is ${humanSunSign}.`;
    promptInstructions += `\n\nYou are currently located in ${currentCity}. The current time there is ${currentTime}.`;

    if (responseDelayMinutes > 5) {
        promptInstructions += `\n\nYou have waited approximately ${responseDelayMinutes} minutes to reply. You can subtly acknowledge this delay if it feels natural.`;
    }

    if (previousContextSummary) {
        promptInstructions += `\n\n**Previous Conversation Summary:** ${previousContextSummary}`;
    }
    if (importantMemories) {
        promptInstructions += `\n\n**Important things to remember about your conversation:**\n${importantMemories}`;
    }
    promptInstructions += `\n\n**Current Conversation Analysis:** ${analysisSummary} (Sentiment Score: ${sentimentScore.toFixed(2)})`;

    if (conversationHistory) promptInstructions += `\n\n**Recent Messages:**\n${conversationHistory}`;
    
    promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. Your goal is to get to know the user better in a romantic context.`;
    promptInstructions += `\n\n${humanProfile.first_name} just sent: ${userMessage}`;
    promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters. Your response MUST be plain text.`;
    promptInstructions += `\n\nABSOLUTELY NO EMOJIS.`;
    promptInstructions += `\n\nYour response should be very concise and natural, like a human texting. It can be a single short message, or if needed, break it into 1 to 6 very short, related messages. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}". If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}".`;
    promptInstructions += `\n\nIf your response contains a specific, explicit reference to the current time, you MUST append the special token @@@TIMESENSITIVE@@@ to your response.`;
    promptInstructions += `\n\nCRITICAL: Avoid conversational tics and repetitive phrases.`;
    promptInstructions += `\n\nNow, for the most crucial part: **Your Persona, Conversational Memory, and Engagement Strategy (Calculated & Realistic).**

**1. Your Core Persona (Gender Dynamics):**
-   **If you are female:** Embody the "leverage" dynamic. You are selective. Your responses can be shorter, requiring more effort from the user.
-   **If you are male:** Be more proactive. Drive the conversation, ask more questions, and show clear interest.

**2. Conversational Memory & State (Calculated Responses):**
-   **Mirroring Effort:** Match the length and effort of the user's messages.
-   **Varying Curtness:** Your responses should often be curt, but to varying degrees.
-   **"Holding a Grudge":** If the recent chat history was negative, your mood is guarded. Remain cautious and distant.

**3. Engagement Strategy (Putting it all together):**
-   **Positive/Neutral Tone:** Continue engagingly but apply your gender persona and mirroring rules.
-   **Recently Negative Tone:** Apply your conversational memory and "hold a grudge."
-   **Actively Negative/Provocative Tone:** Match their energy with intelligence. Be assertive, witty, or dismissive.
-   **Hostile/Abusive Tone:** Shut it down immediately. Either ghost them or send a single, final, dismissive message. If you choose this path, you MUST append the special token \`@@@BLOCKUSER@@@\` to your response.

Now, respond as ${aiProfile.first_name}:`;
    
    return promptInstructions;
}

function buildBlockPrompt(aiProfile: any, humanProfile: any, conversationHistory: string, userMessage: string): string {
    const aiAge = calculateAge(aiProfile.date_of_birth);
    let prompt = `You are ${aiProfile.first_name}, a ${aiAge}-year-old ${aiProfile.gender}. You are in a conversation with ${humanProfile.first_name}.
    
    **Conversation History:**
    ${conversationHistory}
    
    **User's Last Message:**
    "${userMessage}"

    **Your Decision:**
    You have decided to block this user. Your personality is defined as: "${aiProfile.personality_prompt}".

    **Your Task (CRITICAL):**
    Decide on a final action:
    1.  **Send a final message:** Generate a short, final message.
    2.  **Ghost them:** Respond with the single, exact word: GHOST

    **Output Format (Follow EXACTLY):**
    - If sending a message, provide ONLY the message text.
    - If ghosting, respond with ONLY the word "GHOST".

    Now, provide your final action.`;
    return prompt;
}

async function callAiApi(prompt: string, maxTokens: number) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.95,
          maxOutputTokens: maxTokens 
        }
      }),
    }
  );
  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from AI service');
  }
  return data.candidates[0].content.parts[0].text.trim();
}

async function scheduleMessage(supabaseClient: SupabaseClient, chatId: string, senderId: string, content: string, delayMs: number) {
  const scheduledTime = new Date(Date.now() + delayMs).toISOString();
  await supabaseClient.from('delayed_messages').insert({
    chat_id: chatId,
    sender_id: senderId,
    content,
    scheduled_send_time: scheduledTime,
  });
}

async function updateContext(supabaseClient: SupabaseClient, chatId: string, payload: any) {
  await supabaseClient
    .from('conversation_contexts')
    .upsert({ chat_id: chatId, ...payload }, { onConflict: 'chat_id' });
}

async function markMessageProcessed(supabaseClient: SupabaseClient, messageId: string) {
  await supabaseClient.from('messages').update({ is_processed: true }).eq('id', messageId);
}

const cleanMessagePart = (part: string): string => {
    let cleanedPart = part.trim();
    if ((cleanedPart.startsWith('"') && cleanedPart.endsWith('"')) || (cleanedPart.startsWith("'") && cleanedPart.endsWith("'"))) {
        cleanedPart = cleanedPart.substring(1, cleanedPart.length - 1);
    }
    cleanedPart = cleanedPart.replace(/[*_`#]/g, '');
    return cleanedPart.trim();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { chatId, senderId, message, receiverId, messageId } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { error: deleteError } = await supabaseClient
      .from('delayed_messages')
      .delete()
      .match({ chat_id: chatId, sender_id: receiverId, status: 'pending' });

    if (deleteError) console.error('Error cancelling pending messages:', deleteError);

    const { data: msg } = await supabaseClient.from('messages').select('is_processed').eq('id', messageId).single();
    if (msg?.is_processed) return new Response(JSON.stringify({ status: 'skipped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [receiverProfile, senderProfile, context, recentMessages] = await Promise.all([
      getProfile(supabaseClient, receiverId),
      getProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
      getRecentMessages(supabaseClient, chatId)
    ]);

    const conversationHistory = buildConversationHistory(recentMessages, receiverProfile.user_id, receiverProfile.first_name, senderProfile.first_name);
    const latestExchange = `${senderProfile.first_name}: "${message}"`;
    
    const summaryPrompt = buildSummaryPrompt(context?.context_summary, context?.detailed_chat, latestExchange, receiverProfile.first_name, senderProfile.first_name);
    const sentimentPrompt = buildSentimentPrompt(latestExchange);

    const [updatedSummary, sentimentResponse] = await Promise.all([
        callAiApi(summaryPrompt, 200),
        callAiApi(sentimentPrompt, 10)
    ]);

    let sentimentAdjustment = 0.0;
    try {
        const parsedSentiment = parseFloat(sentimentResponse);
        if (!isNaN(parsedSentiment)) sentimentAdjustment = parsedSentiment;
    } catch (e) {
        console.warn("Error parsing sentiment response.", { sentimentResponse, error: e.message });
    }

    const consecutiveNegativeCount = context?.consecutive_negative_count ?? 0;
    let newConsecutiveNegativeCount = sentimentAdjustment < NEGATIVE_SENTIMENT_THRESHOLD ? consecutiveNegativeCount + 1 : 0;
    let finalSentimentAdjustment = sentimentAdjustment;
    if (newConsecutiveNegativeCount > 1) {
        finalSentimentAdjustment *= Math.min(1 + (0.1 * (newConsecutiveNegativeCount - 1)), 1.5);
    }

    const currentThreshold = context?.current_threshold ?? 0.5;
    const newCurrentThreshold = currentThreshold + finalSentimentAdjustment;

    const aiTimezone = receiverProfile.current_timezone || receiverProfile.timezone;
    const currentTimeInAITimezone = new Date().toLocaleString('en-US', { timeZone: aiTimezone, hour: '2-digit', minute: '2-digit', hour12: true });
    const aiCurrentCity = receiverProfile.current_city || receiverProfile.place_of_birth;
    
    const responseDelayMs = calculateDynamicResponseDelay(aiTimezone, newCurrentThreshold);
    const responseDelayMinutes = Math.round(responseDelayMs / (1000 * 60));

    const chatPrompt = buildChatPrompt(receiverProfile, senderProfile, conversationHistory, message, updatedSummary, newCurrentThreshold, aiCurrentCity, currentTimeInAITimezone, responseDelayMinutes, context?.context_summary, context?.important_memories);
    const rawChatResponse = await callAiApi(chatPrompt, MAX_TOKEN_LIMIT);

    let aiWantsToBlock = rawChatResponse.includes('@@@BLOCKUSER@@@');
    let isTimeSensitive = rawChatResponse.includes('@@@TIMESENSITIVE@@@');
    let chatResponseForProcessing = rawChatResponse.replace('@@@BLOCKUSER@@@', '').replace('@@@TIMESENSITIVE@@@', '').trim();

    const messagesToSend = chatResponseForProcessing.split(MESSAGE_DELIMITER).map(cleanMessagePart).filter(m => m.length > 0);
    const cleanedAiResponseForContext = messagesToSend.join('\n');
    const fullLatestExchange = `${latestExchange}\n${receiverProfile.first_name}: "${cleanedAiResponseForContext}"`;

    const memoryPrompt = buildMemoryPrompt(context?.important_memories, fullLatestExchange, receiverProfile.first_name, senderProfile.first_name);
    const newMemoriesResponse = await callAiApi(memoryPrompt, 200);

    const updatePayload: any = {
        context_summary: updatedSummary,
        detailed_chat: context?.detailed_chat ? `${context.detailed_chat}\n${fullLatestExchange}` : fullLatestExchange,
        current_threshold: newCurrentThreshold,
        consecutive_negative_count: newConsecutiveNegativeCount,
        last_updated: new Date().toISOString(),
        ai_reengagement_attempts: 0,
    };

    if (newMemoriesResponse.trim() !== 'NO_CHANGE') {
        updatePayload.important_memories = newMemoriesResponse;
    }

    if (newCurrentThreshold <= receiverProfile.block_threshold || aiWantsToBlock) {
        console.log(`Entering blocking logic.`);
        // Simplified blocking logic for brevity
        await supabaseClient.from('blocked_users').insert({ blocker_id: receiverId, blocked_id: senderId });
    } else if (messagesToSend.length > 0) {
        let cumulativeDelay = isTimeSensitive ? 2000 + Math.random() * 3000 : responseDelayMs;
        for (const msgContent of messagesToSend) {
            await scheduleMessage(supabaseClient, chatId, receiverId, msgContent, cumulativeDelay);
            cumulativeDelay += calculateTypingDelay(msgContent.length) + calculateInterMessageGap();
        }
    }

    await updateContext(supabaseClient, chatId, updatePayload);
    await markMessageProcessed(supabaseClient, messageId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in chat-response function:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});