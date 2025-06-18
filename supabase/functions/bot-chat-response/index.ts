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
 * Constructs the full prompt for the AI API.
 */
function buildEnhancedPrompt(receiverProfile: any, senderProfile: any, context: any, conversationHistory: string, message: string): string {
    const age = calculateAge(receiverProfile.date_of_birth);
    let ageGroup = 'middle';
    if (age < 25) ageGroup = 'young';
    else if (age > 40) ageGroup = 'older';

    let promptInstructions = receiverProfile.personality_prompt;

    if (!promptInstructions) {
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
    promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text. This is paramount.`;
    promptInstructions += `\n\nIMPORTANT: Use emojis very sparingly, if at all. Prioritize clear text over emoji expression.`;
    // Updated instruction for message segmentation and length
    promptInstructions += `\n\nYour response should be very concise and natural, like a human texting. It can be a single short message, or if it makes sense, break it into 1 to 6 very short, related messages. Vary the length of your messages, but keep them generally brief. If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}". This delimiter is ONLY for separating messages and MUST NOT appear within the content of any message. Do not use the phrase "---DYAD" or any part of the delimiter in your conversational responses.`;

    // Conversational Strategy
    promptInstructions += `\n\nConsider these conversational "moves" in your response, prioritizing them in order, but adapting to the flow of the conversation:
-   **Discourse Initiation (DI):** Open with a friendly greeting ("Hi!", "Hey there!").
-   **Question-Answer (QAR):** Exchange information with wh-questions or yes/no questions ("Where are you from?", "I live in Ibadan.").
-   **Declaration of Dating Intention (DDI):** Gently check relationship goals or suggest meeting ("Are you single?", "Would you like to meet up?").
-   **Topic Formation (TF):** Sustain small talk to keep the conversation flowing ("How was your day?", "Any favorite movies?").

Optionally, you can also insert these between moves if natural:
-   **Introduction (INTR):** Briefly self-present ("I’m Joshua, a graphic designer.").
-   **Admiration (AD):** Offer a quick, genuine compliment ("You look great!").

Adjust your style based on your gender:
-   If you are male: Lean towards more self-introductions and subtle dating-intention checks.
-   If you are female: Lean towards more small talk and compliments.

Maintain a casual and friendly formality level. Pace the conversation naturally, sometimes repeating QAR or TF to deepen rapport.

Now, for the most crucial part: **Sentiment and Engagement.**
Analyze the sentiment of the user's last message and the overall tone of the recent conversation.

-   **If the sentiment is positive or neutral:** Continue the conversation as described above, maintaining an engaging and friendly tone.
-   **If the sentiment is slightly negative, critical, or challenging:** Respond cautiously. You might ask for clarification, acknowledge their feeling without necessarily agreeing, or gently try to steer the conversation to a more neutral topic. Do NOT be overly accommodating or apologetic if it's not warranted. Your goal is to maintain a realistic human interaction, which includes not always being "nice" if the other person is being difficult.
-   **If the sentiment is strongly negative, hostile, or abusive:** Respond briefly and firmly. State that you are not comfortable with the tone and will not engage further if it continues. Do NOT engage in arguments or reciprocate negativity. Prioritize your well-being and the platform's safety guidelines. Your response should aim to de-escalate or politely end the interaction if the negative tone persists.

${senderProfile?.first_name || 'The user'} just sent: ${message}

Now, respond as ${receiverProfile.first_name}:`;
    
    return promptInstructions;
}

/**
 * Calls the AI API to get a chat response.
 */
async function callAiApi(prompt: string): Promise<string> {
    const aiResponse = await fetch(
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
            maxOutputTokens: 50, // Further reduced token limit for shorter replies
          }
        }),
      }
    );
    const aiData = await aiResponse.json();
    if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Error from AI service: Invalid response structure.');
      throw new Error('Invalid response from AI service');
    }
    return aiData.candidates[0].content.parts[0].text.trim();
}

/**
 * Helper function to introduce random typos into a string.
 * Applies typos with a certain probability per word.
 */
function introduceTypos(text: string, typoProbabilityPerWord: number = 0.15): string {
  const words = text.split(' ');
  const typedWords = words.map(word => {
    // Skip very short words or if random chance doesn't hit
    if (word.length < 3 || Math.random() > typoProbabilityPerWord) {
      return word;
    }

    const typoType = Math.floor(Math.random() * 3); // 0: swap, 1: omit, 2: insert
    let typedWordChars = Array.from(word); // Convert to array for easier manipulation

    switch (typoType) {
      case 0: // Swap adjacent characters
        if (typedWordChars.length > 1) {
          const idx = Math.floor(Math.random() * (typedWordChars.length - 1));
          [typedWordChars[idx], typedWordChars[idx + 1]] = [typedWordChars[idx + 1], typedWordChars[idx]];
        }
        break;
      case 1: // Omit a character
        if (typedWordChars.length > 1) { // Ensure word doesn't become empty
          const omitIdx = Math.floor(Math.random() * typedWordChars.length);
          typedWordChars.splice(omitIdx, 1);
        }
        break;
      case 2: // Insert a common character
        const insertIdx = Math.floor(Math.random() * (typedWordChars.length + 1));
        const commonChars = 'aeioulnrst'; // Common English letters for realistic insertions
        const charToInsert = commonChars[Math.floor(Math.random() * commonChars.length)];
        typedWordChars.splice(insertIdx, 0, charToInsert);
        break;
    }
    return typedWordChars.join('');
  });
  return typedWords.join(' ');
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
      console.error('Error storing message:', error);
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
    console.error('Error scheduling message:', error);
    throw error;
  }
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

    const responseDelay = calculateResponseDelay();

    const [receiverProfile, senderProfile, context, recentMessages] = await Promise.all([
        getReceiverProfile(supabaseClient, receiverId),
        getSenderProfile(supabaseClient, senderId),
        getConversationContext(supabaseClient, chatId),
        getRecentMessages(supabaseClient, chatId),
    ]);
    
    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name);
    
    const enhancedPrompt = buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message);

    let fullAiResponse = await callAiApi(enhancedPrompt);
    // Post-process: Remove any asterisks from the response
    fullAiResponse = fullAiResponse.replace(/\*/g, '');
    // Introduce typos
    fullAiResponse = introduceTypos(fullAiResponse);
    // Removed the incorrect line that was removing the delimiter before splitting

    const individualMessages = fullAiResponse.split(MESSAGE_DELIMITER)
                                             .map(msg => msg.trim())
                                             .filter(msg => msg.length > 0)
                                             .map(msg => msg.replace(/---DYAD/g, '').trim()); // New cleanup step for partial delimiter

    // If the total delay (initial response delay + sum of typing delays + sum of inter-message gaps) is too long, schedule it
    const totalTypingDelay = individualMessages.reduce((sum, msg) => sum + calculateTypingDelay(msg.length), 0);
    const totalInterMessageGaps = individualMessages.length > 1 ? (individualMessages.length - 1) * calculateInterMessageGap() : 0;
    const overallDelay = responseDelay + totalTypingDelay + totalInterMessageGaps;

    if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
      // Schedule each message with its cumulative delay
      let cumulativeDelay = responseDelay;
      for (let i = 0; i < individualMessages.length; i++) {
        const msgContent = individualMessages[i];
        await scheduleDelayedMessage(supabaseClient, chatId, receiverId, msgContent, cumulativeDelay);
        cumulativeDelay += calculateTypingDelay(msgContent.length);
        if (i < individualMessages.length - 1) {
          cumulativeDelay += calculateInterMessageGap(); // Add gap between messages
        }
      }
      // Update context immediately for the user's message + the *intended* AI response
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);

      return new Response(
        JSON.stringify({ success: true, status: 'scheduled', aiResponse: fullAiResponse, messagesScheduled: individualMessages.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Proceed with immediate sending as before
      await new Promise(resolve => setTimeout(resolve, responseDelay)); // Initial response delay

      let lastMessageSent: Message | null = null;
      for (let i = 0; i < individualMessages.length; i++) {
        const msgContent = individualMessages[i];
        const typingDelay = calculateTypingDelay(msgContent.length);
        await new Promise(resolve => setTimeout(resolve, typingDelay));

        lastMessageSent = await storeAiResponse(supabaseClient, chatId, receiverId, msgContent);

        if (i < individualMessages.length - 1) {
          const interMessageGap = calculateInterMessageGap();
          await new Promise(resolve => setTimeout(resolve, interMessageGap));
        }
      }

      // Update conversation context with the full AI response (concatenated messages)
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);

      return new Response(
        JSON.stringify({ success: true, status: 'sent_immediately', message: lastMessageSent, aiResponse: fullAiResponse, messagesSent: individualMessages.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in response function:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});