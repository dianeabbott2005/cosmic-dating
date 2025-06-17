import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type Message = { content: string; sender_id: string; created_at: string; };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGE_DELIMITER = "---DYAD_MESSAGE_BREAK---"; // Unique delimiter for splitting AI responses

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

const EMOJI_STYLES: { [key: string]: { [key: string]: string } } = {
  'young': { female: 'many, trendy, cute', male: 'moderate, cool, casual', 'non-binary': 'varied, expressive' },
  'middle': { female: 'moderate, warm, friendly', male: 'few, direct, thoughtful', 'non-binary': 'moderate, balanced' },
  'older': { female: 'few, classic, gentle', male: 'very few, formal', 'non-binary': 'few, subtle' },
};

// Define a threshold for immediate vs. delayed sending
const IMMEDIATE_SEND_THRESHOLD_MS = 15 * 1000; // 15 seconds

/**
 * Calculates a human-like typing delay, capped to prevent timeouts.
 * This is for *individual messages* within a multi-message response.
 * @param messageLength The length of the message to be "typed".
 * @returns A delay in milliseconds.
 */
const calculateTypingDelay = (messageLength: number): number => {
  const baseDelay = 500; // 0.5 second minimum per message
  const typingSpeed = 250; // characters per minute
  const typingTime = (messageLength / typingSpeed) * 60 * 1000;
  
  let randomVariation = Math.random() * 500; // Up to 0.5 seconds random variation
  
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000); // Cap at 5 seconds to prevent timeouts within the function
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
  // For the purpose of this Edge Function, we cap the *internal* delay
  // If a longer delay is needed, it will be scheduled.
  return delay; // No cap here, as the scheduling logic handles long delays
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
 * Fetches the full profile of the receiver.
 */
async function getReceiverProfile(supabaseClient: SupabaseClient, receiverId: string) {
    const { data: receiverProfile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', receiverId)
      .single();

    if (error || !receiverProfile) {
      throw new Error(`Receiver profile not found for ID: ${receiverId}`);
    }
    return receiverProfile;
}

/**
 * Fetches the sender's profile for context.
 */
async function getSenderProfile(supabaseClient: SupabaseClient, senderId: string) {
    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, gender, date_of_birth, place_of_birth')
      .eq('user_id', senderId)
      .single();
    return senderProfile;
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
 * Builds a string of recent conversation history.
 */
function buildConversationHistory(recentMessages: Message[], receiverId: string, receiverFirstName: string, senderFirstName: string | undefined) {
    if (!recentMessages || recentMessages.length === 0) {
        return '';
    }
    return recentMessages
        .reverse()
        .map(msg => `${msg.sender_id === receiverId ? receiverFirstName : (senderFirstName || 'User')}: ${msg.content}`)
        .join('\n');
}

/**
 * Constructs the full prompt for the Gemini API.
 */
function buildEnhancedPrompt(receiverProfile: any, senderProfile: any, context: any, conversationHistory: string, message: string): string {
    const age = calculateAge(receiverProfile.date_of_birth);
    let ageGroup = 'middle';
    if (age < 25) ageGroup = 'young';
    else if (age > 40) ageGroup = 'older';

    let promptInstructions = receiverProfile.personality_prompt;

    if (!promptInstructions) {
      console.warn(`No personality_prompt found for ${receiverProfile.first_name}. Using fallback.`);
      promptInstructions = `You are ${receiverProfile.first_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. Respond naturally and conversationally.`;
    }
    
    // Add language issues and dialect instruction
    const region = Object.keys(NON_NATIVE_ENGLISH_REGIONS).find(key => receiverProfile.place_of_birth.includes(key));
    if (region) {
      const { languageIssue, dialect } = NON_NATIVE_ENGLISH_REGIONS[region];
      promptInstructions += `\n\nAlso, subtly induce English language issues typical of a non-native speaker from ${region} (${languageIssue}). Occasionally let local dialect flow into conversations (${dialect}).`;
    }

    if (senderProfile) promptInstructions += ` You are chatting with ${senderProfile.first_name}.`;
    if (context?.context_summary) promptInstructions += `\n\nPrevious conversation context: ${context.context_summary}`;
    if (conversationHistory) promptInstructions += `\n\nRecent conversation:\n${conversationHistory}`;
    
    // NEW: Add dating platform context
    promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. You discovered it through either Reddit or X (formerly Twitter). Your goal is to get to know the user better in a romantic context, as you would on a dating app. Keep the conversation engaging and flirty if appropriate, but always respectful.`;

    // Stronger, overriding instructions for emojis and markdown
    promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text.`;
    promptInstructions += `\n\nIMPORTANT: Use emojis very sparingly, only when highly relevant to the message's core meaning. Prioritize clear text over emoji expression.`;
    // Updated instruction for message segmentation
    promptInstructions += `\n\nYour response should be natural and conversational. It can be a single message, or if it makes sense to break it up, it can be 2 to 4 shorter, related messages. If you break it into multiple messages, separate each message with the delimiter: "${MESSAGE_DELIMITER}".`;

    promptInstructions += `\n\n${senderProfile?.first_name || 'The user'} just sent: ${message}\n\nNow, respond as ${receiverProfile.first_name}:`;
    
    return promptInstructions;
}

/**
 * Calls the Gemini API to get a chat response.
 */
async function callGeminiApi(prompt: string): Promise<string> {
    const geminiResponse = await fetch(
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
            maxOutputTokens: 300, // Increased token limit for multiple messages
          }
        }),
      }
    );
    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Gemini API response error:', JSON.stringify(geminiData, null, 2));
      throw new Error('Invalid response from Gemini API');
    }
    return geminiData.candidates[0].content.parts[0].text.trim();
}

/**
 * Stores the AI-generated message in the database.
 */
async function storeAiResponse(supabaseClient: SupabaseClient, chatId: string, receiverId: string, aiResponse: string) {
    const { data: newMessage, error } = await supabaseClient
      .from('messages')
      .insert({ chat_id: chatId, sender_id: receiverId, content: aiResponse })
      .select()
      .single();

    if (error) {
      console.error('Error storing AI message:', error);
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
    console.error('Error scheduling delayed message:', error);
    throw error;
  }
  console.log(`Message scheduled for ${scheduledTime}`);
}

/**
 * Updates the conversation context summary.
 */
async function updateConversationContext(supabaseClient: SupabaseClient, chatId: string, receiverFirstName: string, senderFirstName: string | undefined, userMessage: string, aiResponse: string, existingContext: any) {
    const contextUpdate = `${senderFirstName || 'User'} said: "${userMessage}". ${receiverFirstName} responded: "${aiResponse}".`;
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

  try {
    const { chatId, senderId, message, receiverId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate the initial response delay
    const responseDelay = calculateResponseDelay();
    console.log(`Calculated initial response delay: ${responseDelay}ms`);

    const [receiverProfile, senderProfile, context, recentMessages] = await Promise.all([
        getReceiverProfile(supabaseClient, receiverId),
        getSenderProfile(supabaseClient, senderId),
        getConversationContext(supabaseClient, chatId),
        getRecentMessages(supabaseClient, chatId),
    ]);
    
    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name);
    
    const enhancedPrompt = buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message);
    console.log('Enhanced prompt construction complete.');

    const fullAiResponse = await callGeminiApi(enhancedPrompt);
    console.log('Full AI response received:', fullAiResponse);

    const individualMessages = fullAiResponse.split(MESSAGE_DELIMITER)
                                             .map(msg => msg.trim())
                                             .filter(msg => msg.length > 0);

    // If the total delay (initial response delay + sum of typing delays) is too long, schedule it
    const totalTypingDelay = individualMessages.reduce((sum, msg) => sum + calculateTypingDelay(msg.length), 0);
    const overallDelay = responseDelay + totalTypingDelay;

    if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
      console.log(`Overall delay (${overallDelay}ms) exceeds threshold. Scheduling message.`);
      // Schedule each message with its cumulative delay
      let cumulativeDelay = responseDelay;
      for (const msgContent of individualMessages) {
        await scheduleDelayedMessage(supabaseClient, chatId, receiverId, msgContent, cumulativeDelay);
        cumulativeDelay += calculateTypingDelay(msgContent.length);
      }
      // Update context immediately for the user's message + the *intended* AI response
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);

      return new Response(
        JSON.stringify({ success: true, status: 'scheduled', aiResponse: fullAiResponse, messagesScheduled: individualMessages.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      console.log(`Overall delay (${overallDelay}ms) is within threshold. Sending immediately.`);
      // Proceed with immediate sending as before
      await new Promise(resolve => setTimeout(resolve, responseDelay)); // Initial response delay

      let lastMessageSent: Message | null = null;
      for (const msgContent of individualMessages) {
        const typingDelay = calculateTypingDelay(msgContent.length);
        console.log(`Calculated typing delay: ${typingDelay}ms for message length: ${msgContent.length}`);
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        lastMessageSent = await storeAiResponse(supabaseClient, chatId, receiverId, msgContent);
        console.log('Stored AI message:', lastMessageSent);
      }

      // Update conversation context with the full AI response (concatenated messages)
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);

      return new Response(
        JSON.stringify({ success: true, status: 'sent_immediately', message: lastMessageSent, aiResponse: fullAiResponse, messagesSent: individualMessages.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in ai-chat-response function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});