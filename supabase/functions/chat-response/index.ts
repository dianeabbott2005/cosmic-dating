import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@";
const SUMMARY_DELIMITER = "@@@SUMMARY_UPDATE@@@";
const SENTIMENT_DELIMITER = "@@@SENTIMENT_ADJUST@@@";
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

async function getReceiverProfile(supabaseClient: SupabaseClient, receiverId: string) {
  const { data: receiverProfile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', receiverId)
    .single();
  if (error || !receiverProfile) throw new Error(`Receiver profile not found for ID: ${receiverId}`);
  return receiverProfile;
}

async function getSenderProfile(supabaseClient: SupabaseClient, senderId: string) {
  const { data: senderProfile } = await supabaseClient
    .from('profiles')
    .select('first_name')
    .eq('user_id', senderId)
    .single();
  return senderProfile;
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

function buildConversationHistory(recentMessages: any[], receiverId: string, receiverFirstName: string, senderFirstName: string | undefined) {
  if (!recentMessages || recentMessages.length === 0) return '';
  return recentMessages
    .reverse()
    .map(msg => `${msg.sender_id === receiverId ? receiverFirstName : (senderFirstName || 'User')}: ${msg.content}`)
    .join('\n');
}

function buildAiPrompt(receiverProfile: any, senderProfile: any, context: any, conversationHistory: string, message: string) {
  let prompt = receiverProfile.personality_prompt || `You are ${receiverProfile.first_name}.`;
  prompt += `\n\nYou are chatting with ${senderProfile.first_name}.`;
  if (context?.context_summary) prompt += `\n\nConversation Context: ${context.context_summary}`;
  if (conversationHistory) prompt += `\n\nRecent History:\n${conversationHistory}`;

  prompt += `\n\n**Your Task & Output Format (CRITICAL):**
Your final output MUST follow this structure exactly, with no extra text:
1.  Your text message(s) to the user. If multiple, separate with "${MESSAGE_DELIMITER}".
2.  The summary delimiter: "${SUMMARY_DELIMITER}"
3.  A new, one-sentence summary of the conversation state.
4.  The sentiment delimiter: "${SENTIMENT_DELIMITER}"
5.  A sentiment adjustment value (a number between -0.2 and 0.2).

**Sentiment Adjustment Rules:**
-   **Highly Positive (+0.1 to +0.2):** User is admiring, reassuring, good flirting, respectful.
-   **Neutral/Positive (-0.05 to +0.05):** Normal, friendly chat.
-   **Negative (-0.1 to -0.05):** User is boring, dismissive, or slightly rude.
-   **Highly Negative (-0.2 to -0.1):** User is hostile, disrespectful, threatening, bullying.

**Example Output:**
That's so sweet of you!${MESSAGE_DELIMITER}You're making me blush.${SUMMARY_DELIMITER}The user gave a nice compliment, and the mood is very positive.${SENTIMENT_DELIMITER}0.15

**Reasoning Steps (Your Internal Monologue):**
1.  **Analyze User's Message:** What is the sentiment of "${message}" in the context of the history?
2.  **Formulate Response:** Craft your message(s) reflecting your persona and the conversation's tone.
3.  **Update Memory:** Write the new one-sentence summary.
4.  **Calculate Sentiment Adjustment:** Based on the rules, determine the numeric adjustment value.

Now, generate your response to the user's message: "${message}"`;
  return prompt;
}

async function callAiApi(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: MAX_TOKEN_LIMIT + 50 } // Add buffer for delimiters
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
      getReceiverProfile(supabaseClient, receiverId),
      getSenderProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
      getRecentMessages(supabaseClient, chatId),
    ]);

    const prompt = buildAiPrompt(receiverProfile, senderProfile, context, buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name), message);
    const rawAiResponse = await callAiApi(prompt);

    // --- Defensive Parsing Logic ---
    let messagePart = null;
    let newSummary = null;
    let sentimentAdjustment = null;

    if (rawAiResponse.includes(SUMMARY_DELIMITER) && rawAiResponse.includes(SENTIMENT_DELIMITER)) {
      const summaryParts = rawAiResponse.split(SUMMARY_DELIMITER);
      const sentimentParts = (summaryParts[1] || '').split(SENTIMENT_DELIMITER);
      
      if (summaryParts.length >= 2 && sentimentParts.length >= 2) {
        messagePart = summaryParts[0].trim();
        newSummary = sentimentParts[0].trim();
        const sentimentAdjustStr = sentimentParts[1] ? sentimentParts[1].trim() : '0.0';
        const parsedSentiment = parseFloat(sentimentAdjustStr);

        if (!isNaN(parsedSentiment)) {
          sentimentAdjustment = parsedSentiment;
        } else {
          console.warn('Parsed sentiment was NaN. Defaulting to 0.0. Raw string:', sentimentParts[1]);
          sentimentAdjustment = 0.0;
        }
      }
    }

    // If parsing failed, log it and exit gracefully without sending a message.
    if (messagePart === null || newSummary === null || sentimentAdjustment === null) {
      console.error('Failed to parse AI response. The AI did not follow the required format.', { rawAiResponse });
      await markMessageProcessed(supabaseClient, messageId);
      return new Response(JSON.stringify({ success: true, status: 'parsing_failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- End of Parsing Logic ---

    const currentThreshold = receiverProfile.block_threshold || 0.0;
    const newThreshold = Math.max(0.0, Math.min(1.0, currentThreshold - sentimentAdjustment));

    await supabaseClient.from('profiles').update({ block_threshold: newThreshold }).eq('user_id', receiverId);
    await updateContext(supabaseClient, chatId, newSummary);

    if (newThreshold >= 1.0) {
      const blockMessage = "I don't think we're a good match. I'm ending this conversation.";
      await scheduleMessage(supabaseClient, chatId, receiverId, blockMessage, 1000);
      await supabaseClient.from('blocked_users').insert({ blocker_id: receiverId, blocked_id: senderId });
    } else {
      const messagesToSend = messagePart.split(MESSAGE_DELIMITER).filter(m => m.trim());
      if (messagesToSend.length > 0) {
        let cumulativeDelay = calculateResponseDelay();
        for (const msgContent of messagesToSend) {
          await scheduleMessage(supabaseClient, chatId, receiverId, msgContent.trim(), cumulativeDelay);
          cumulativeDelay += calculateTypingDelay(msgContent.length) + calculateInterMessageGap();
        }
      } else {
        console.warn('Message part was empty after parsing. Nothing to send.', { rawAiResponse });
      }
    }

    await markMessageProcessed(supabaseClient, messageId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in chat-response function:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});