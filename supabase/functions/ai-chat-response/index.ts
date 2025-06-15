import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate typing delay based on message length and other human-like factors
const calculateTypingDelay = (messageLength: number): number => {
  // Average human typing speed: 40-60 WPM (words per minute)
  // Average word length: 5 characters
  // So roughly 200-300 characters per minute
  const baseDelay = 2000; // 2 seconds minimum
  const typingSpeed = 250; // characters per minute
  const typingTime = (messageLength / typingSpeed) * 60 * 1000; // convert to milliseconds
  
  let randomVariation = Math.random() * 3000; // Add 0-3 seconds random variation for unaccounted delays

  // Factor in time of day. Let's assume server time is UTC.
  const now = new Date();
  const hour = now.getUTCHours();
  
  // Slower responses late at night or early in the morning (e.g., 11pm to 7am UTC)
  if (hour >= 23 || hour < 7) {
    // Add extra random delay for "sleepy" replies
    randomVariation += Math.random() * 8000; // 0-8 seconds extra
  }

  // Add a small chance of a bigger delay to simulate distraction
  if (Math.random() < 0.15) { // 15% chance
    randomVariation += 5000 + (Math.random() * 10000); // 5-15 seconds extra
  }
  
  // The total delay is a combination of typing time and realistic variations.
  const totalDelay = baseDelay + typingTime + randomVariation;

  return Math.min(totalDelay, 45000); // cap at 45 seconds to prevent excessive waits
};

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

    // Get receiver's full profile information
    const { data: receiverProfile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', receiverId)
      .single();

    if (!receiverProfile) {
      throw new Error('Receiver profile not found.');
    }

    // Get sender's profile for context
    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, gender, date_of_birth, place_of_birth')
      .eq('user_id', senderId)
      .single();

    // Calculate receiver's age
    const birthDate = new Date(receiverProfile.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear() - 
      (today.getMonth() < birthDate.getMonth() || 
       (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);

    // Get conversation context
    const { data: context } = await supabaseClient
      .from('conversation_contexts')
      .select('context_summary')
      .eq('chat_id', chatId)
      .eq('user_id', receiverId)
      .single();

    // Get recent messages for context
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, sender_id, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build conversation history
    let conversationHistory = '';
    if (recentMessages) {
      conversationHistory = recentMessages
        .reverse()
        .map(msg => `${msg.sender_id === receiverId ? receiverProfile.first_name : (senderProfile?.first_name || 'User')}: ${msg.content}`)
        .join('\n');
    }

    // Build the prompt using the detailed personality_prompt from the database
    let enhancedPrompt = receiverProfile.personality_prompt;

    // If no pre-generated prompt, create a basic one as a fallback
    if (!enhancedPrompt) {
      console.warn(`No personality_prompt found for ${receiverProfile.first_name}. Using fallback.`);
      enhancedPrompt = `You are ${receiverProfile.first_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. Respond naturally and conversationally. Your texting style should be appropriate for your age. If you are young, use modern slang and emojis. If you are older, be more thoughtful and use emojis sparingly.`;
    }
    
    // Add context about who they're talking to
    if (senderProfile) {
      enhancedPrompt += ` You are chatting with ${senderProfile.first_name}.`;
    }
    
    if (context?.context_summary) {
      enhancedPrompt += `\n\nPrevious conversation context: ${context.context_summary}`;
    }
    
    if (conversationHistory) {
      enhancedPrompt += `\n\nRecent conversation:\n${conversationHistory}`;
    }
    
    enhancedPrompt += `\n\n${senderProfile?.first_name || 'The user'} just sent: ${message}\n\nNow, respond as ${receiverProfile.first_name}:`;

    console.log('Enhanced prompt:', enhancedPrompt);

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: enhancedPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 150, // Reduced for shorter, more natural responses
          }
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = geminiData.candidates[0].content.parts[0].text.trim();

    // Calculate typing delay based on response length
    const typingDelay = calculateTypingDelay(aiResponse.length);
    console.log(`Calculated typing delay: ${typingDelay}ms for message length: ${aiResponse.length}`);

    // Wait for the calculated typing time to simulate human typing
    await new Promise(resolve => setTimeout(resolve, typingDelay));

    // Store the AI response as a message
    const { data: newMessage, error } = await supabaseClient
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: receiverId,
        content: aiResponse
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing AI message:', error);
      throw error;
    }

    // Update conversation context with enhanced details
    const contextUpdate = `${senderProfile?.first_name || 'User'} said: "${message}". ${receiverProfile.first_name} responded: "${aiResponse}".`;
    
    await supabaseClient
      .from('conversation_contexts')
      .upsert({
        chat_id: chatId,
        user_id: receiverId,
        context_summary: context?.context_summary 
          ? `${context.context_summary} ${contextUpdate}` 
          : contextUpdate,
        last_updated: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: newMessage,
        aiResponse,
        typingDelay 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in ai-chat-response function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
