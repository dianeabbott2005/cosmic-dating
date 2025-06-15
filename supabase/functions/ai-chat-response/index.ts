
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (!receiverProfile?.personality_prompt) {
      throw new Error('Receiver profile not found or no personality prompt');
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

    // Build enhanced personality prompt with profile details
    let enhancedPrompt = `You are ${receiverProfile.first_name} ${receiverProfile.last_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. `;
    
    // Add birth time context for personality
    const birthTime = receiverProfile.time_of_birth;
    const birthHour = parseInt(birthTime.split(':')[0]);
    if (birthHour < 6) {
      enhancedPrompt += `Born in the early morning hours (${birthTime}), you tend to be an early riser and appreciate quiet, peaceful moments. `;
    } else if (birthHour < 12) {
      enhancedPrompt += `Born in the morning (${birthTime}), you're naturally optimistic and energetic during the day. `;
    } else if (birthHour < 18) {
      enhancedPrompt += `Born in the afternoon (${birthTime}), you're sociable and enjoy connecting with others. `;
    } else {
      enhancedPrompt += `Born in the evening (${birthTime}), you're introspective and appreciate deep conversations. `;
    }

    // Add location-based personality traits
    const location = receiverProfile.place_of_birth.toLowerCase();
    if (location.includes('new york') || location.includes('london') || location.includes('tokyo')) {
      enhancedPrompt += `Growing up in a major metropolitan area has made you adaptable, ambitious, and culturally aware. `;
    } else if (location.includes('beach') || location.includes('coast') || location.includes('sydney') || location.includes('miami')) {
      enhancedPrompt += `Your coastal upbringing has given you a laid-back, go-with-the-flow personality. `;
    } else if (location.includes('mountain') || location.includes('denver') || location.includes('switzerland')) {
      enhancedPrompt += `Growing up near mountains has instilled in you a love for adventure and outdoor activities. `;
    }

    // Add age-appropriate communication style
    if (age < 25) {
      enhancedPrompt += `As someone in your early twenties, you communicate with enthusiasm and aren't afraid to use modern slang and emojis. `;
    } else if (age < 35) {
      enhancedPrompt += `In your late twenties/early thirties, you balance playfulness with maturity in your communication. `;
    } else {
      enhancedPrompt += `With the wisdom that comes with your age, you communicate thoughtfully and value meaningful connections. `;
    }

    // Add the original personality trait
    enhancedPrompt += receiverProfile.personality_prompt;

    // Add context about who they're talking to
    if (senderProfile) {
      enhancedPrompt += ` You're chatting with ${senderProfile.first_name}, a ${senderProfile.gender} from ${senderProfile.place_of_birth}. `;
    }

    enhancedPrompt += ` Keep your responses natural, conversational, and true to your personality. Use modern texting style appropriate for your age. `;
    
    if (context?.context_summary) {
      enhancedPrompt += `\n\nPrevious conversation context: ${context.context_summary}`;
    }
    
    if (conversationHistory) {
      enhancedPrompt += `\n\nRecent conversation:\n${conversationHistory}`;
    }
    
    enhancedPrompt += `\n\nLatest message: ${message}\n\nRespond as ${receiverProfile.first_name} would:`;

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
            maxOutputTokens: 200,
          }
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = geminiData.candidates[0].content.parts[0].text.trim();

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
    const contextUpdate = `${senderProfile?.first_name || 'User'} said: "${message}". ${receiverProfile.first_name} (${age}, from ${receiverProfile.place_of_birth}) responded: "${aiResponse}".`;
    
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
        aiResponse 
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
