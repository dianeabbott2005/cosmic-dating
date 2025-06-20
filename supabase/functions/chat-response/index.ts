import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@";
const ANALYSIS_DELIMITER = "@@@ANALYSIS_BREAK@@@";
const MAX_TOKEN_LIMIT = 100;

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
    .select('context_summary')
    .eq('chat_id', chatId)
    .single();
  return context;
}

async function getRecentMessages(supabaseClient: SupabaseClient, chatId: string) {
  const { data: recentMessages } = await supabaseClient
    .from('messages')
    .select('content, sender_id')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(10);
  return recentMessages || [];
}

function buildConversationHistory(recentMessages: any[], aiUserId: string, aiFirstName: string, humanFirstName: string) {
  if (!recentMessages || recentMessages.length === 0) return '';
  return recentMessages
    .reverse()
    .map(msg => `${msg.sender_id === aiUserId ? aiFirstName : humanFirstName}: ${msg.content}`)
    .join('\n');
}

function buildChatPrompt(aiProfile: any, humanFirstName: string, context: any, conversationHistory: string, userMessage: string) {
  let prompt = aiProfile.personality_prompt || `You are ${aiProfile.first_name}.`;
  prompt += `\n\nYou are chatting with ${humanFirstName}.`;
  if (context?.context_summary) prompt += `\n\nConversation Context: ${context.context_summary}`;
  if (conversationHistory) prompt += `\n\nRecent History:\n${conversationHistory}`;
  
  prompt += `\n\n**Your Task:**
Respond to the user's message naturally, as your character would. Your response should be concise and human-like.
- If your response has multiple parts, separate them with the delimiter: "${MESSAGE_DELIMITER}".
- **CRITICAL:** Do NOT include any other delimiters or analysis in your response. Only the chat message.

The user's message is: "${userMessage}"`;
  return prompt;
}

function buildAnalysisPrompt(conversationHistory: string, userMessage: string, aiResponse: string) {
  let prompt = `You are a conversation analyst. Analyze the following exchange and provide a summary and a sentiment score.

**Conversation History:**
${conversationHistory}

**Recent Exchange:**
- User: "${userMessage}"
- AI: "${aiResponse}"

**Your Task & Output Format (CRITICAL):**
Your final output MUST follow this structure exactly, with no extra text:
1.  A new, one-sentence summary of the conversation state.
2.  The analysis delimiter: "${ANALYSIS_DELIMITER}"
3.  A sentiment adjustment value (a number between -0.2 and 0.2).

**Sentiment Adjustment Rules:**
- **Highly Positive (+0.1 to +0.2):** User is admiring, reassuring, good flirting, respectful.
- **Neutral/Positive (-0.05 to +0.05):** Normal, friendly chat.
- **Negative (-0.1 to -0.05):** User is boring, dismissive, or slightly rude.
- **Highly Negative (-0.2 to -0.1):** User is hostile, disrespectful, threatening, bullying.

**Example Output:**
The user gave a nice compliment, and the mood is very positive.${ANALYSIS_DELIMITER}0.15`;
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

async function updateContext(supabaseClient: SupabaseClient, chatId: string, summary: string) {
  await supabaseClient.from('conversation_contexts').upsert({
    chat_id: chatId,
    context_summary: summary,
    last_updated: new Date().toISOString(),
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

    const [receiverProfile, senderProfile, context, recentMessages] = await Promise.all([
      getProfile(supabaseClient, receiverId),
      getProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
      getRecentMessages(supabaseClient, chatId),
    ]);

    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile.first_name);

    // --- First AI Call: Get Chat Response ---
    const chatPrompt = buildChatPrompt(receiverProfile, senderProfile.first_name, context, conversationHistory, message);
    const chatResponse = await callAiApi(chatPrompt, MAX_TOKEN_LIMIT);

    // --- Second AI Call: Get Analysis ---
    const analysisPrompt = buildAnalysisPrompt(conversationHistory, message, chatResponse);
    const analysisResponse = await callAiApi(analysisPrompt, 50); // Smaller token limit for analysis

    // --- Parse Analysis Response ---
    let newSummary = null;
    let sentimentAdjustment = 0.0;
    if (analysisResponse.includes(ANALYSIS_DELIMITER)) {
      const parts = analysisResponse.split(ANALYSIS_DELIMITER);
      newSummary = parts[0].trim();
      const parsedSentiment = parseFloat(parts[1].trim());
      if (!isNaN(parsedSentiment)) {
        sentimentAdjustment = parsedSentiment;
      }
    } else {
      console.warn("Failed to parse analysis response, using defaults.", { analysisResponse });
      newSummary = "Context updated."; // Default summary
    }

    // --- Update Database and Schedule Messages ---
    const currentThreshold = receiverProfile.block_threshold || 0.0;
    const newThreshold = Math.max(0.0, Math.min(1.0, currentThreshold - sentimentAdjustment));

    await supabaseClient.from('profiles').update({ block_threshold: newThreshold }).eq('user_id', receiverId);
    if (newSummary) await updateContext(supabaseClient, chatId, newSummary);

    if (newThreshold >= 1.0) {
      const blockMessage = "I don't think we're a good match. I'm ending this conversation.";
      await scheduleMessage(supabaseClient, chatId, receiverId, blockMessage, 1000);
      await supabaseClient.from('blocked_users').insert({ blocker_id: receiverId, blocked_id: senderId });
    } else {
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