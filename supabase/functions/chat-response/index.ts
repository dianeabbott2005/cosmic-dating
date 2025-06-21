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

const calculateResponseDelay = (): number => {
  const random = Math.random();
  if (random < 0.7) return Math.floor(Math.random() * 5 * 1000);
  if (random < 0.9) return 5000 + Math.floor(Math.random() * 5 * 1000);
  return 10000 + Math.floor(Math.random() * 5 * 1000);
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
    .select('context_summary, detailed_chat, current_threshold, consecutive_negative_count')
    .eq('chat_id', chatId)
    .single();
  return context;
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
Provide ONLY the new, updated, one-sentence summary of the entire conversation's state. Do not add any other text, explanation, or formatting. The summary MUST use the names "${humanFirstName}" and "${aiFirstName}" and MUST NOT use the words "AI", "bot", "user", or "automated".

**Example Output:**
${humanFirstName} is asking a thoughtful follow-up question to ${aiFirstName}, showing genuine interest.`;
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

function buildChatPrompt(aiProfile: any, humanProfile: any, conversationHistory: string, userMessage: string, analysisSummary: string, sentimentScore: number, currentCity: string, currentTime: string) {
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
    
    promptInstructions += `\n\nYou are currently located in ${currentCity}. The current time there is ${currentTime}. If asked about your location or the time, you MUST use this information. Do not mention your birth city unless it's relevant to the conversation.`;

    promptInstructions += `\n\n**Conversation Analysis:** ${analysisSummary} (Sentiment Score: ${sentimentScore.toFixed(2)})`;

    if (conversationHistory) promptInstructions += `\n\nRecent conversation:\n${conversationHistory}`;
    
    promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. You discovered it through either Reddit or X (formerly Twitter). Your goal is to get to know the user better in a romantic context, as you would on a dating app. Keep the conversation engaging, flirty or even kinky if appropriate, but always respectful.`;

    promptInstructions += `\n\n${humanProfile.first_name} just sent: ${userMessage}`;

    promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text. This is paramount.`;
    promptInstructions += `\n\nABSOLUTELY NO EMOJIS. Your responses must not contain any emojis. This is a strict rule.`;
    promptInstructions += `\n\nYour response should be very concise and natural, like a human texting including rare varying human-like typos depending on the situation. It can be a single short message, or if it needed, break it into 1 to 6 (in varying degree choose number of messages) very short, related messages. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}". ABSOLUTELY CRITICAL: If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}", ensure you do this most accurately and not make any typos as it ruin the entire logic. This delimiter is ONLY for separating messages and MUST NOT appear within the content of any message. Ensure this is done with utmost accuracy.`;

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
-   **Hostile/Abusive Tone:** Shut it down immediately and decisively. Either ghost them completely (no response) or send a single, final, dismissive message like "Bye." or "Not interested." **If you choose this path, you MUST append the special token \`@@@BLOCKUSER@@@\` to your response.** For example: \`Bye.@@@BLOCKUSER@@@\`. This is a critical instruction for the system to understand your intent to block.

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
    You have decided to block this user because the conversation has become unacceptable based on your standards. Your personality is defined as: "${aiProfile.personality_prompt}".

    **Your Task (CRITICAL):**
    Based on your personality and the final message from the user, you must decide on a final action. You have two choices:
    1.  **Send a final message:** Generate a short, final, context-appropriate message to send before blocking. This could be dismissive, direct, or cold, depending on your persona and the user's message.
    2.  **Ghost them:** If the user's message was extremely offensive or warrants no reply, you should ghost them.

    **Output Format (Follow EXACTLY):**
    - If you choose to send a message, provide ONLY the message text.
    - If you choose to ghost, respond with the single, exact word: GHOST

    **RULES:**
    - DO NOT add any explanation.
    - DO NOT use markdown or emojis.
    - Your response must be either the final message OR the word "GHOST".

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
        generationConfig: { maxOutputTokens: maxTokens }
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

async function updateContext(supabaseClient: SupabaseClient, chatId: string, newSummary: string, existingDetailedChat: string | null, latestExchange: string, newCurrentThreshold: number, newConsecutiveNegativeCount: number) {
  const updatedDetailedChat = existingDetailedChat 
    ? `${existingDetailedChat}\n${latestExchange}` 
    : latestExchange;

  await supabaseClient
    .from('conversation_contexts')
    .upsert({
      chat_id: chatId,
      context_summary: newSummary,
      detailed_chat: updatedDetailedChat,
      current_threshold: newCurrentThreshold,
      last_updated: new Date().toISOString(),
      consecutive_negative_count: newConsecutiveNegativeCount,
    }, { onConflict: 'chat_id' });
}

async function markMessageProcessed(supabaseClient: SupabaseClient, messageId: string) {
  await supabaseClient.from('messages').update({ is_processed: true }).eq('id', messageId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { chatId, senderId, message, receiverId, messageId } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: msg } = await supabaseClient.from('messages').select('is_processed').eq('id', messageId).single();
    if (msg?.is_processed) return new Response(JSON.stringify({ status: 'skipped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [receiverProfile, senderProfile, context] = await Promise.all([
      getProfile(supabaseClient, receiverId),
      getProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
    ]);

    const latestExchange = `${senderProfile.first_name}: "${message}"`;
    
    const summaryPrompt = buildSummaryPrompt(context?.context_summary, context?.detailed_chat, latestExchange, receiverProfile.first_name, senderProfile.first_name);
    const sentimentPrompt = buildSentimentPrompt(latestExchange);

    const [updatedSummary, sentimentResponse] = await Promise.all([
        callAiApi(summaryPrompt, 75),
        callAiApi(sentimentPrompt, 10)
    ]);

    console.info("Raw summary response:", updatedSummary);
    console.info("Raw sentiment response:", sentimentResponse);

    let sentimentAdjustment = 0.0;
    try {
        const parsedSentiment = parseFloat(sentimentResponse);
        if (!isNaN(parsedSentiment)) {
            sentimentAdjustment = parsedSentiment;
        } else {
            console.warn("Could not parse sentiment response as a number.", { sentimentResponse });
        }
    } catch (e) {
        console.warn("Error parsing sentiment response.", { sentimentResponse, error: e.message });
    }

    const consecutiveNegativeCount = context?.consecutive_negative_count ?? 0;
    let finalSentimentAdjustment = sentimentAdjustment;
    let newConsecutiveNegativeCount = 0;

    if (sentimentAdjustment < NEGATIVE_SENTIMENT_THRESHOLD) {
      newConsecutiveNegativeCount = consecutiveNegativeCount + 1;
      if (newConsecutiveNegativeCount > 1) {
        const multiplier = 1 + (0.1 * (newConsecutiveNegativeCount - 1));
        finalSentimentAdjustment *= Math.min(multiplier, 1.5);
        console.log(`Applying negativity penalty. Original: ${sentimentAdjustment.toFixed(3)}, Multiplier: ${multiplier.toFixed(2)}, Final: ${finalSentimentAdjustment.toFixed(3)}`);
      }
    } else {
      newConsecutiveNegativeCount = 0;
    }

    const currentThreshold = context?.current_threshold ?? 0.5;
    const newCurrentThreshold = currentThreshold + finalSentimentAdjustment;

    const aiTimezone = receiverProfile.current_timezone || receiverProfile.timezone;
    const currentTimeInAITimezone = new Date().toLocaleString('en-US', { timeZone: aiTimezone, hour: '2-digit', minute: '2-digit', hour12: true });
    const aiCurrentCity = receiverProfile.current_city || receiverProfile.place_of_birth;
    const conversationHistory = context?.detailed_chat ? `${context.detailed_chat}\n${latestExchange}` : latestExchange;
    const chatPrompt = buildChatPrompt(receiverProfile, senderProfile, conversationHistory, message, updatedSummary, newCurrentThreshold, aiCurrentCity, currentTimeInAITimezone);
    const rawChatResponse = await callAiApi(chatPrompt, MAX_TOKEN_LIMIT);

    let aiWantsToBlock = false;
    let chatResponse = rawChatResponse;

    if (rawChatResponse.includes('@@@BLOCKUSER@@@')) {
        aiWantsToBlock = true;
        chatResponse = rawChatResponse.replace('@@@BLOCKUSER@@@', '').trim();
        console.log("AI has signaled intent to block.");
    }
    chatResponse = chatResponse.replace(/[*_`#]/g, '');

    if (newCurrentThreshold <= receiverProfile.block_threshold || aiWantsToBlock) {
        console.log(`Entering blocking logic. Reason: Threshold (${newCurrentThreshold.toFixed(3)} <= ${receiverProfile.block_threshold}) OR AI intent (${aiWantsToBlock}).`);

        let finalMessageToSend = '';
        const finalThreshold = aiWantsToBlock ? receiverProfile.block_threshold : newCurrentThreshold;

        if (aiWantsToBlock) {
            finalMessageToSend = chatResponse;
        } else {
            const blockPrompt = buildBlockPrompt(receiverProfile, senderProfile, conversationHistory, message);
            const blockActionResponse = await callAiApi(blockPrompt, 50);
            finalMessageToSend = blockActionResponse.replace(/[*_`#]/g, '');
        }

        let finalExchangeForContext = latestExchange;
        if (finalMessageToSend.trim().toUpperCase() !== 'GHOST' && finalMessageToSend.trim() !== '') {
            await scheduleMessage(supabaseClient, chatId, receiverId, finalMessageToSend, 1000);
            finalExchangeForContext += `\n${receiverProfile.first_name}: "${finalMessageToSend}"`;
        }

        await updateContext(supabaseClient, chatId, updatedSummary, context?.detailed_chat, finalExchangeForContext, finalThreshold, newConsecutiveNegativeCount);
        await supabaseClient.from('blocked_users').insert({ blocker_id: receiverId, blocked_id: senderId });
        
    } else {
        const fullLatestExchange = `${latestExchange}\n${receiverProfile.first_name}: "${chatResponse.replace(new RegExp(MESSAGE_DELIMITER, 'g'), '\n')}"`;
        await updateContext(supabaseClient, chatId, updatedSummary, context?.detailed_chat, fullLatestExchange, newCurrentThreshold, newConsecutiveNegativeCount);

        const messagesToSend = chatResponse.split(MESSAGE_DELIMITER).filter(m => m.trim());
        if (messagesToSend.length > 0) {
            let cumulativeDelay = calculateResponseDelay();
            for (const msgContent of messagesToSend) {
                await scheduleMessage(supabaseClient, chatId, receiverId, msgContent.trim(), cumulativeDelay);
                cumulativeDelay += calculateTypingDelay(msgContent.length) + calculateInterMessageGap();
            }
        }
    }

    await markMessageProcessed(supabaseClient, messageId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in chat-response function:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});