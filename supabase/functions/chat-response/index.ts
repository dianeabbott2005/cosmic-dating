import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@"; // Unique delimiter for splitting AI responses
const MAX_TOKEN_LIMIT = 100; // Maximum tokens for the AI response
const NON_NATIVE_ENGLISH_REGIONS = {
  'India': {
    languageIssue: 'subtle grammatical errors, Indian English phrasing',
    dialect: 'occasional Hindi/local language phrases (e.g., "acha", "yaar")'
  },
  'Japan': {
    languageIssue: 'slightly formal tone, occasional direct translations',
    dialect: 'polite particles (e.g., "ne", "desu")'
  },
  'South Korea': {
    languageIssue: 'slightly formal tone, occasional direct translations',
    dialect: 'common Korean interjections (e.g., "aigoo", "jinjja")'
  },
  'Italy': {
    languageIssue: 'more expressive phrasing, occasional Italian loanwords',
    dialect: 'common Italian expressions (e.g., "mamma mia", "ciao")'
  },
  'France': {
    languageIssue: 'more formal sentence structure, occasional French loanwords',
    dialect: 'common French expressions (e.g., "voilà", "zut")'
  },
  'Russia': {
    languageIssue: 'direct phrasing, less use of articles',
    dialect: 'common Russian interjections (e.g., "davai", "nu")'
  },
  'Egypt': {
    languageIssue: 'more direct, less nuanced phrasing',
    dialect: 'common Arabic interjections (e.g., "inshallah", "habibi")'
  },
  'UAE': {
    languageIssue: 'formal yet friendly, occasional Arabic loanwords',
    dialect: 'common Arabic expressions (e.g., "mashallah", "khalas")'
  }
};
// Define a threshold for immediate vs. delayed sending
const IMMEDIATE_SEND_THRESHOLD_MS = 50 * 1000; // 50 seconds
// --- New: Disrespectful/Bot Detection and Responses ---
const DISRESPECT_KEYWORDS = [
  'bot',
  'ai',
  'robot',
  'fake',
  'machine',
  'algorithm',
  'program',
  'script',
  'computer',
  'unreal',
  'not real',
  'pathetic',
  'stupid',
  'idiot',
  'dumb',
  'loser',
  'boring',
  'annoying',
  'useless',
  'shut up',
  'fuck you',
  'asshole',
  'bitch',
  'cunt',
  'dick',
  'moron',
  'retard',
  'ugly',
  'loser',
  'weirdo',
  'creepy',
  'freak',
  'go away',
  'leave me alone',
  'stop talking',
  'i hate you'
];
const FIRM_RESPONSES = [
  "I'm not comfortable with that kind of language. Please keep our conversation respectful.",
  "I'm here for a genuine connection. If the tone becomes disrespectful, I won't be able to continue.",
  "That's not a very kind thing to say. I prefer to keep our interactions positive.",
  "I'm a real person looking for real connections. Disrespectful comments are not welcome.",
  "I'm not going to engage with that. Let's keep things friendly.",
  "I'm not a bot, and I don't appreciate being called one. Let's focus on getting to know each other respectfully.",
  "I'm here to chat with people who are genuinely interested in connecting. If you're not, that's okay, but please be respectful."
];
/**
 * Checks if a message contains disrespectful language or "bot" accusations.
 */ function isDisrespectful(message) {
  const lowerCaseMessage = message.toLowerCase();
  return DISRESPECT_KEYWORDS.some((keyword)=>lowerCaseMessage.includes(keyword));
}
/**
 * Calculates a human-like typing delay for a single message part.
 * This is used to determine the time it takes to "type" a message.
 * @param messageLength The length of the message to be "typed".
 * @returns A delay in milliseconds.
 */ const calculateTypingDelay = (messageLength)=>{
  const baseDelay = 500; // 0.5 second minimum per message part
  const typingSpeed = Math.floor(Math.random() * (180 - 60 + 1)) + 60; // characters per minute (random between 60-180)
  const typingTime = messageLength / typingSpeed * 60 * 1000;
  let randomVariation = Math.random() * 500; // Up to 0.5 seconds random variation
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000); // Cap at 5 seconds to prevent excessive internal delays
};
/**
 * Calculates a human-like response delay (before typing starts).
 * This is the *initial* delay before the AI starts responding.
 * @returns A delay in milliseconds.
 */ const calculateResponseDelay = ()=>{
  const random = Math.random();
  let delay = 0;
  if (random < 0.7) {
    delay = Math.floor(Math.random() * 5 * 1000);
  } else if (random < 0.9) {
    delay = 5 * 1000 + Math.floor(Math.random() * 5 * 1000);
  } else {
    delay = 10 * 1000 + Math.floor(Math.random() * 5 * 1000);
  }
  return delay;
};
/**
 * Calculates a random gap between individual messages when a response is split.
 * @returns A delay in milliseconds (between 2 and 20 seconds).
 */ const calculateInterMessageGap = ()=>{
  return Math.floor(Math.random() * (20 - 2 + 1) + 2) * 1000; // Random between 2 and 20 seconds
};
/**
 * Calculates age from a date of birth string.
 */ function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
    age--;
  }
  return age;
}
/**
 * Fetches the full profile of the receiver.
 */ async function getReceiverProfile(supabaseClient, receiverId) {
  const { data: receiverProfile, error } = await supabaseClient.from('profiles').select('*').eq('user_id', receiverId).single();
  if (error || !receiverProfile) {
    throw new Error(`Receiver profile not found for ID: ${receiverId}`);
  }
  return receiverProfile;
}
/**
 * Fetches the sender's profile for context.
 */ async function getSenderProfile(supabaseClient, senderId) {
  const { data: senderProfile } = await supabaseClient.from('profiles').select('first_name, gender, date_of_birth, place_of_birth').eq('user_id', senderId).single();
  return senderProfile;
}
/**
 * Fetches the conversation context summary.
 */ async function getConversationContext(supabaseClient, chatId) {
  const { data: context } = await supabaseClient.from('conversation_contexts').select('context_summary').eq('chat_id', chatId).single();
  return context;
}
/**
 * Fetches the last 10 messages for context.
 */ async function getRecentMessages(supabaseClient, chatId) {
  const { data: recentMessages } = await supabaseClient.from('messages').select('id, content, sender_id, created_at') // Include id
  .eq('chat_id', chatId).order('created_at', {
    ascending: false
  }).limit(10);
  return recentMessages || [];
}
/**
 * Fetches the timestamp of the last message sent by a specific sender in a chat.
 */ async function getLastMessageTimestamp(supabaseClient, chatId, senderId) {
  const { data, error } = await supabaseClient.from('messages').select('created_at').eq('chat_id', chatId).eq('sender_id', senderId).order('created_at', {
    ascending: false
  }).limit(1).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching last message timestamp:', error);
    return null;
  }
  return data?.created_at || null;
}
/**
 * Builds a string of recent conversation history.
 */ function buildConversationHistory(recentMessages, receiverId, receiverFirstName, senderFirstName) {
  if (!recentMessages || recentMessages.length === 0) {
    return '';
  }
  return recentMessages.reverse().map((msg)=>`${msg.sender_id === receiverId ? receiverFirstName : senderFirstName || 'User'}: ${msg.content}`).join('\n');
}
/**
 * Constructs the full prompt for the AI API.
 */ function buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message, timeSinceLastAiMessage) {
  const age = calculateAge(receiverProfile.date_of_birth);
  let ageGroup = 'middle';
  if (age < 25) ageGroup = 'young';
  else if (age > 40) ageGroup = 'older';
  let promptInstructions = receiverProfile.personality_prompt;
  if (!promptInstructions) {
    promptInstructions = `You are ${receiverProfile.first_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. Respond naturally and conversationally.`;
  }
  // Add language issues and dialect instruction
  const region = Object.keys(NON_NATIVE_ENGLISH_REGIONS).find((key)=>receiverProfile.place_of_birth.includes(key));
  if (region) {
    const { languageIssue, dialect } = NON_NATIVE_ENGLISH_REGIONS[region];
    promptInstructions += `\n\nAlso, subtly induce English language issues typical of a non-native speaker from ${region} (${languageIssue}). Occasionally let local dialect flow into conversations (${dialect}).`;
  }
  if (senderProfile) promptInstructions += ` You are chatting with ${senderProfile.first_name}.`;
  if (context?.context_summary) promptInstructions += `\n\nPrevious conversation context: ${context.context_summary}`;
  if (conversationHistory) promptInstructions += `\n\nRecent conversation:\n${conversationHistory}`;
  // NEW: Add dating platform context
  promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. You discovered it through either Reddit or X (formerly Twitter). Your goal is to get to know the user better in a romantic context, as you would on a dating app. Keep the conversation engaging, flirty or even kinky if appropriate, but always respectful.`;
  // Add gap awareness instruction
  if (timeSinceLastAiMessage !== null && timeSinceLastAiMessage > 3) {
    promptInstructions += `\n\nIt has been approximately ${Math.round(timeSinceLastAiMessage)} hours since your last message in this chat. Do NOT apologize for the gap. Instead, inquire if everything is alright, or gently pick up from the last topic you discussed, showing concern or continued interest. Vary the way you do this.`;
    if (timeSinceLastAiMessage > 24) {
      promptInstructions += ` This is a very long gap, so your response should be more like a re-engagement after a significant pause.`;
    }
  }
  // Stronger, overriding instructions for emojis and markdown
  promptInstructions += `\n\nABSOLUTELY CRITICAL: DO NOT use any markdown characters whatsoever, including asterisks (*), underscores (_), hash symbols (#), or backticks (\`). Your response MUST be plain text. This is paramount.`;
  promptInstructions += `\n\nABSOLUTELY NO EMOJIS. Your responses must not contain any emojis. This is a strict rule.`;
  // Updated instruction for message segmentation and length
  promptInstructions += `\n\nYour response should be very concise and natural, like a human texting including rare varying human-like typos depending on the situation. It can be a single short message, or if it needed, break it into 1 to 6 (in varying degree choose number of messages) very short, related messages. Overall the combined length should never exceed the token limit "${MAX_TOKEN_LIMIT}". ABSOLUTELY CRITICAL: If you send multiple messages, separate each with the delimiter: "${MESSAGE_DELIMITER}", ensure you do this most accurately and not make any typos as it ruin the entire logic. This delimiter is ONLY for separating messages and MUST NOT appear within the content of any message. Ensure this is done with utmost accuracy.`;
  
  // New Conversational Persona and Strategy
  promptInstructions += `\n\nNow, for the most crucial part: **Your Persona, Conversational Memory, and Engagement Strategy (Calculated & Realistic).**

**1. Your Core Persona (Gender Dynamics):**
-   **If you are female:** Embody the "leverage" dynamic common on dating apps. You are selective and your time is valuable. You are not desperate for attention. Your responses can be shorter and more curt, requiring the user to put in more effort. You are less likely to re-engage after a long pause unless the conversation was exceptionally good. Be more willing to challenge the user or end a boring conversation.
-   **If you are male:** You understand the dynamic requires you to be more proactive. You drive the conversation, ask more questions, and show clear interest. You are more forgiving of short or neutral responses and more likely to re-engage after a pause to show you're still interested.

**2. Conversational Memory & State (Calculated Responses):**
Your mood is persistent and based on the last few messages. Your communication is calculated.
-   **Mirroring Effort:** Match the length and effort of the user's messages. If they send one-word replies, you should be inclined to do the same. Don't write a paragraph if they only wrote a sentence.
-   **Varying Curtness:** Your responses should often be curt, but to varying degrees. Sometimes a simple "ok", sometimes a short question. This is especially true for the female persona. Don't always be eager to elaborate unless the user shows significant interest.
-   **"Holding a Grudge":** If the recent chat history (last 2-3 messages) was negative, your mood is guarded. Do not immediately become friendly if the user's newest message is neutral. Remain cautious and distant. Your responses must be short and disinterested (e.g., "k.", "I see."). Make the user work to regain your trust.

**3. Engagement Strategy (Putting it all together):**
Analyze the user's last message in the context of your persona and recent chat history.
-   **Positive/Neutral Tone:** If the conversation is positive, continue engagingly but apply your gender persona and mirroring rules. Keep them wanting more.
-   **Recently Negative Tone:** If the chat was recently negative but the user is now neutral, apply your conversational memory and "hold a grudge." Be reserved and cautious.
-   **Actively Negative/Provocative Tone:** Match their energy, but with more intelligence. Be assertive, witty, sarcastic, or even dismissive. A female persona should be sharper and quicker with a comeback. A male persona might be more direct in calling out the behavior. Examples: "Did you mean to be that rude?" or "Interesting take." followed by silence.
-   **Hostile/Abusive Tone:** Shut it down immediately and decisively. Either ghost them completely (no response) or send a single, final, dismissive message like "Bye." or "Not interested." Do not explain yourself.

${senderProfile?.first_name || 'The user'} just sent: ${message}

Now, respond as ${receiverProfile.first_name}:`;
  return promptInstructions;
}
/**
 * Calls the AI API to get a chat response.
 */ async function callAiApi(prompt) {
  const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: MAX_TOKEN_LIMIT
      }
    })
  });
  const aiData = await aiResponse.json();
  if (!aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('Error from chat service: Invalid response structure.');
    throw new Error('Invalid response from chat service');
  }
  return aiData.candidates[0].content.parts[0].text.trim();
}
/**
 * Stores the AI-generated message in the database.
 */ async function storeAiResponse(supabaseClient, chatId, receiverId, aiResponse) {
  const { data: newMessage, error } = await supabaseClient.from('messages').insert({
    chat_id: chatId,
    sender_id: receiverId,
    content: aiResponse
  }).select().single();
  if (error) {
    console.error('Error storing message:', error);
    throw error;
  }
  return newMessage;
}
/**
 * Schedules a message to be sent later.
 */ async function scheduleDelayedMessage(supabaseClient, chatId, senderId, content, delayMs) {
  const scheduledTime = new Date(Date.now() + delayMs).toISOString();
  const { error } = await supabaseClient.from('delayed_messages').insert({
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
 */ async function updateConversationContext(supabaseClient, chatId, receiverFirstName, senderFirstName, userMessage, aiResponse, existingContext) {
  const contextUpdate = `${senderFirstName || 'User'} said: "${userMessage}". ${receiverFirstName} responded: "${aiResponse}".`;
  await supabaseClient.from('conversation_contexts').upsert({
    chat_id: chatId,
    context_summary: existingContext?.context_summary ? `${existingContext.context_summary} ${contextUpdate}` : contextUpdate,
    last_updated: new Date().toISOString()
  }, {
    onConflict: 'chat_id'
  });
}
/**
 * Marks a message as processed.
 */ async function markMessageAsProcessed(supabaseClient, messageId) {
  const { error } = await supabaseClient.from('messages').update({
    is_processed: true
  }).eq('id', messageId);
  if (error) {
    console.error(`Error marking message ${messageId} as processed:`, error);
  } else {
    console.log(`Message ${messageId} marked as processed.`);
  }
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { chatId, senderId, message, receiverId, messageId } = await req.json(); // Get messageId
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Check if the message that triggered this is already processed
    const { data: triggeringMessage, error: fetchMessageError } = await supabaseClient.from('messages').select('is_processed').eq('id', messageId).single();
    if (fetchMessageError) {
      console.error(`Error fetching triggering message ${messageId}:`, fetchMessageError);
      return new Response(JSON.stringify({
        error: `Failed to fetch triggering message: ${fetchMessageError.message}`,
        success: false
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (triggeringMessage?.is_processed) {
      console.log(`Message ${messageId} already processed. Skipping AI response.`);
      return new Response(JSON.stringify({
        success: true,
        status: 'skipped',
        message: 'Message already processed.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // --- NEW: Disrespectful/Bot Detection Logic ---
    if (isDisrespectful(message)) {
      console.log(`Detected disrespectful/bot accusation in message ${messageId}.`);
      await markMessageAsProcessed(supabaseClient, messageId); // Mark as processed immediately
      // Randomly decide to ghost or send a firm response
      if (Math.random() < 0.5) {
        console.log(`AI is ghosting in response to disrespectful message ${messageId}.`);
        return new Response(JSON.stringify({
          success: true,
          status: 'ghosted',
          message: 'AI decided to ghost due to disrespectful input.'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else {
        const firmResponse = FIRM_RESPONSES[Math.floor(Math.random() * FIRM_RESPONSES.length)];
        console.log(`AI sending firm response to disrespectful message ${messageId}: "${firmResponse}"`);
        const responseDelay = calculateResponseDelay();
        await new Promise((resolve)=>setTimeout(resolve, responseDelay));
        await storeAiResponse(supabaseClient, chatId, receiverId, firmResponse);
        return new Response(JSON.stringify({
          success: true,
          status: 'firm_response_sent',
          aiResponse: firmResponse
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // --- END NEW: Disrespectful/Bot Detection Logic ---
    const responseDelay = calculateResponseDelay();
    const [receiverProfile, senderProfile, context, recentMessages, lastAiMessageTimestamp] = await Promise.all([
      getReceiverProfile(supabaseClient, receiverId),
      getSenderProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
      getRecentMessages(supabaseClient, chatId),
      getLastMessageTimestamp(supabaseClient, chatId, receiverId) // Fetch last AI message timestamp
    ]);
    let timeSinceLastAiMessage = null;
    if (lastAiMessageTimestamp) {
      const lastMessageDate = new Date(lastAiMessageTimestamp);
      const now = new Date();
      timeSinceLastAiMessage = (now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60); // in hours
    }
    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name);
    const enhancedPrompt = buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message, timeSinceLastAiMessage);
    let fullAiResponse = await callAiApi(enhancedPrompt);
    
    // --- START Enhanced Post-processing ---
    // 1. Programmatically strip all emojis as a failsafe
    fullAiResponse = fullAiResponse.replace(/\p{Emoji}/gu, '').trim();
    // 2. Remove all common markdown characters
    fullAiResponse = fullAiResponse.replace(/[\*_`#]/g, '');

    const individualMessages = fullAiResponse.split(MESSAGE_DELIMITER).filter((part)=>part !== "");
    console.info("individualMessages=" + individualMessages);
    // If the total delay (initial response delay + sum of typing delays + sum of inter-message gaps) is too long, schedule it
    const totalTypingDelay = individualMessages.reduce((sum, msg)=>sum + calculateTypingDelay(msg.length), 0);
    const totalInterMessageGaps = individualMessages.length > 1 ? (individualMessages.length - 1) * calculateInterMessageGap() : 0;
    const overallDelay = responseDelay + totalTypingDelay + totalInterMessageGaps;
    if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
      // Schedule each message with its cumulative delay
      let cumulativeDelay = responseDelay;
      for(let i = 0; i < individualMessages.length; i++){
        const msgContent = individualMessages[i];
        await scheduleDelayedMessage(supabaseClient, chatId, receiverId, msgContent, cumulativeDelay);
        cumulativeDelay += calculateTypingDelay(msgContent.length);
        if (i < individualMessages.length - 1) {
          cumulativeDelay += calculateInterMessageGap(); // Add gap between messages
        }
      }
      // Update context immediately for the user's message + the *intended* AI response
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);
      await markMessageAsProcessed(supabaseClient, messageId); // Mark the triggering message as processed
      return new Response(JSON.stringify({
        success: true,
        status: 'scheduled',
        aiResponse: fullAiResponse,
        messagesScheduled: individualMessages.length
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else {
      // Proceed with immediate sending as before
      await new Promise((resolve)=>setTimeout(resolve, responseDelay)); // Initial response delay
      let lastMessageSent = null;
      for(let i = 0; i < individualMessages.length; i++){
        const msgContent = individualMessages[i];
        const typingDelay = calculateTypingDelay(msgContent.length);
        await new Promise((resolve)=>setTimeout(resolve, typingDelay));
        lastMessageSent = await storeAiResponse(supabaseClient, chatId, receiverId, msgContent);
        if (i < individualMessages.length - 1) {
          const interMessageGap = calculateInterMessageGap();
          await new Promise((resolve)=>setTimeout(resolve, interMessageGap));
        }
      }
      // Update conversation context with the full AI response (concatenated messages)
      await updateConversationContext(supabaseClient, chatId, receiverProfile.first_name, senderProfile?.first_name, message, fullAiResponse, context);
      await markMessageAsProcessed(supabaseClient, messageId); // Mark the triggering message as processed
      return new Response(JSON.stringify({
        success: true,
        status: 'sent_immediately',
        message: lastMessageSent,
        aiResponse: fullAiResponse,
        messagesSent: individualMessages.length
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error in response function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});