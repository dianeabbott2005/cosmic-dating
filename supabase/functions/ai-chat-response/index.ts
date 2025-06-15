
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

    // Get receiver's personality prompt
    const { data: receiverProfile } = await supabaseClient
      .from('profiles')
      .select('personality_prompt, first_name')
      .eq('user_id', receiverId)
      .single();

    if (!receiverProfile?.personality_prompt) {
      throw new Error('Receiver profile not found or no personality prompt');
    }

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
        .map(msg => `${msg.sender_id === receiverId ? receiverProfile.first_name : 'User'}: ${msg.content}`)
        .join('\n');
    }

    // Build the prompt
    let prompt = receiverProfile.personality_prompt;
    
    if (context?.context_summary) {
      prompt += `\n\nPrevious conversation context: ${context.context_summary}`;
    }
    
    if (conversationHistory) {
      prompt += `\n\nRecent conversation:\n${conversationHistory}`;
    }
    
    prompt += `\n\nLatest message from user: ${message}\n\nRespond as ${receiverProfile.first_name} would:`;

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
              text: prompt
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

    // Update conversation context
    const contextUpdate = `User said: "${message}". ${receiverProfile.first_name} responded: "${aiResponse}".`;
    
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
