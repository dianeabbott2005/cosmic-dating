import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type Message = { content: string; sender_id: string; created_at: string; };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const typingStyles = [
    'Use shorthand and abbreviations like "lol", "brb", "u", "r". Keep messages very short.',
    'Send multiple short messages back-to-back instead of one long one. Your entire response should be very short, as if it is one of several messages you are sending.',
    'Write in a well-structured paragraph, like you are writing an email. Use complete sentences.',
    'Use a lot of emojis to express yourself. Sprinkle them throughout your message.',
    'Be a bit formal and use proper grammar and punctuation. Avoid slang.',
    'Be very casual, use lowercase for everything and maybe include a typo.',
    'Ask a lot of questions to get to know the other person.',
    'Be a little mysterious and give short, intriguing answers.'
];

/**
 * Calculates a human-like typing delay.
 * @param messageLength The length of the message to be "typed".
 * @returns A delay in milliseconds.
 */
const calculateTypingDelay = (messageLength: number): number => {
  const baseDelay = 2000; // 2 seconds minimum
  const typingSpeed = 250; // characters per minute
  const typingTime = (messageLength / typingSpeed) * 60 * 1000;
  
  let randomVariation = Math.random() * 3000;

  const now = new Date();
  const hour = now.getUTCHours();
  
  if (hour >= 23 || hour < 7) {
    randomVariation += Math.random() * 8000;
  }

  if (Math.random() < 0.15) {
    randomVariation += 5000 + (Math.random() * 10000);
  }
  
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 45000); // Cap at 45 seconds
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
async function getConversationContext(supabaseClient: SupabaseClient, chatId: string, receiverId: string) {
    const { data: context } = await supabaseClient
      .from('conversation_contexts')
      .select('context_summary')
      .eq('chat_id', chatId)
      .eq('user_id', receiverId)
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
    let enhancedPrompt = receiverProfile.personality_prompt;

    if (!enhancedPrompt) {
      console.warn(`No personality_prompt found for ${receiverProfile.first_name}. Using fallback.`);
      enhancedPrompt = `You are ${receiverProfile.first_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. Respond naturally and conversationally. Your texting style should be appropriate for your age. If you are young, use modern slang and emojis. If you are older, be more thoughtful and use emojis sparingly.`;
    }
    
    const randomTypingStyle = typingStyles[Math.floor(Math.random() * typingStyles.length)];
    enhancedPrompt += `\n\nIMPORTANT: Adopt this specific texting style for your response: "${randomTypingStyle}"`;
    
    if (senderProfile) enhancedPrompt += ` You are chatting with ${senderProfile.first_name}.`;
    if (context?.context_summary) enhancedPrompt += `\n\nPrevious conversation context: ${context.context_summary}`;
    if (conversationHistory) enhancedPrompt += `\n\nRecent conversation:\n${conversationHistory}`;
    enhancedPrompt += `\n\n${senderProfile?.first_name || 'The user'} just sent: ${message}\n\nNow, respond as ${receiverProfile.first_name}:`;
    
    return enhancedPrompt;
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
            maxOutputTokens: 150,
          }
        }),
      }
    );
    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
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
 * Updates the conversation context summary.
 */
async function updateConversationContext(supabaseClient: SupabaseClient, chatId: string, receiverId: string, receiverFirstName: string, senderFirstName: string | undefined, userMessage: string, aiResponse: string, existingContext: any) {
    const contextUpdate = `${senderFirstName || 'User'} said: "${userMessage}". ${receiverFirstName} responded: "${aiResponse}".`;
    await supabaseClient
      .from('conversation_contexts')
      .upsert({
        chat_id: chatId,
        user_id: receiverId,
        context_summary: existingContext?.context_summary 
          ? `${existingContext.context_summary} ${contextUpdate}` 
          : contextUpdate,
        last_updated: new Date().toISOString()
      });
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

    const [receiverProfile, senderProfile, context, recentMessages] = await Promise.all([
        getReceiverProfile(supabaseClient, receiverId),
        getSenderProfile(supabaseClient, senderId),
        getConversationContext(supabaseClient, chatId, receiverId),
        getRecentMessages(supabaseClient, chatId),
    ]);
    
    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name);
    
    const enhancedPrompt = buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message);
    console.log('Enhanced prompt construction complete.');

    const aiResponse = await callGeminiApi(enhancedPrompt);

    const typingDelay = calculateTypingDelay(aiResponse.length);
    console.log(`Calculated typing delay: ${typingDelay}ms for message length: ${aiResponse.length}`);
    await new Promise(resolve => setTimeout(resolve, typingDelay));

    const [newMessage] = await Promise.all([
        storeAiResponse(supabaseClient, chatId, receiverId, aiResponse),
        updateConversationContext(supabaseClient, chatId, receiverId, receiverProfile.first_name, senderProfile?.first_name, message, aiResponse, context)
    ]);

    return new Response(
      JSON.stringify({ success: true, message: newMessage, aiResponse, typingDelay }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-chat-response function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});