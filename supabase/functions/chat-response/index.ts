import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const MESSAGE_DELIMITER = "@@@MESSAGEBREAK@@@";
const SUMMARY_DELIMITER = "@@@SUMMARY_UPDATE@@@";
const MAX_TOKEN_LIMIT = 100;
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
const IMMEDIATE_SEND_THRESHOLD_MS = 50 * 1000;
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
function isDisrespectful(message) {
  const lowerCaseMessage = message.toLowerCase();
  return DISRESPECT_KEYWORDS.some((keyword)=>lowerCaseMessage.includes(keyword));
}
const calculateTypingDelay = (messageLength)=>{
  const baseDelay = 500;
  const typingSpeed = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
  const typingTime = messageLength / typingSpeed * 60 * 1000;
  let randomVariation = Math.random() * 500;
  const totalDelay = baseDelay + typingTime + randomVariation;
  return Math.min(totalDelay, 5000);
};
const calculateResponseDelay = ()=>{
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
const calculateInterMessageGap = ()=>{
  return Math.floor(Math.random() * (20 - 2 + 1) + 2) * 1000;
};
function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || m === 0 && today.getDate() < birthDate.getDate()) {
    age--;
  }
  return age;
}
async function getReceiverProfile(supabaseClient, receiverId) {
  const { data: receiverProfile, error } = await supabaseClient.from('profiles').select('*').eq('user_id', receiverId).single();
  if (error || !receiverProfile) {
    throw new Error(`Receiver profile not found for ID: ${receiverId}`);
  }
  return receiverProfile;
}
async function getSenderProfile(supabaseClient, senderId) {
  const { data: senderProfile } = await supabaseClient.from('profiles').select('first_name, gender, date_of_birth, place_of_birth').eq('user_id', senderId).single();
  return senderProfile;
}
async function getConversationContext(supabaseClient, chatId) {
  const { data: context } = await supabaseClient.from('conversation_contexts').select('context_summary').eq('chat_id', chatId).single();
  return context;
}
async function getRecentMessages(supabaseClient, chatId) {
  const { data: recentMessages } = await supabaseClient.from('messages').select('id, content, sender_id, created_at')
  .eq('chat_id', chatId).order('created_at', {
    ascending: false
  }).limit(10);
  return recentMessages || [];
}
async function getLastMessageTimestamp(supabaseClient, chatId, senderId) {
  const { data, error } = await supabaseClient.from('messages').select('created_at').eq('chat_id', chatId).eq('sender_id', senderId).order('created_at', {
    ascending: false
  }).limit(1).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching last message timestamp:', error);
    return null;
  }
  return data?.created_at || null;
}
function buildConversationHistory(recentMessages, receiverId, receiverFirstName, senderFirstName) {
  if (!recentMessages || recentMessages.length === 0) {
    return '';
  }
  return recentMessages.reverse().map((msg)=>`${msg.sender_id === receiverId ? receiverFirstName : senderFirstName || 'User'}: ${msg.content}`).join('\n');
}
function buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message, timeSinceLastAiMessage) {
  const age = calculateAge(receiverProfile.date_of_birth);
  let promptInstructions = receiverProfile.personality_prompt;
  if (!promptInstructions) {
    promptInstructions = `You are ${receiverProfile.first_name}, a ${age}-year-old ${receiverProfile.gender} from ${receiverProfile.place_of_birth}. Respond naturally and conversationally.`;
  }
  const region = Object.keys(NON_NATIVE_ENGLISH_REGIONS).find((key)=>receiverProfile.place_of_birth.includes(key));
  if (region) {
    const { languageIssue, dialect } = NON_NATIVE_ENGLISH_REGIONS[region];
    promptInstructions += `\n\nAlso, subtly induce English language issues typical of a non-native speaker from ${region} (${languageIssue}). Occasionally let local dialect flow into conversations (${dialect}).`;
  }
  promptInstructions += ` You are chatting with ${senderProfile.first_name}.`;
  promptInstructions += `\n\nThis is a new dating platform focused on astrological compatibility. You discovered it through either Reddit or X (formerly Twitter). Your goal is to get to know the user better in a romantic context, as you would on a dating app. Keep the conversation engaging, flirty or even kinky if appropriate, but always respectful.`;
  if (timeSinceLastAiMessage !== null && timeSinceLastAiMessage > 3) {
    promptInstructions += `\n\nIt has been approximately ${Math.round(timeSinceLastAiMessage)} hours since your last message in this chat. Do NOT apologize for the gap. Instead, inquire if everything is alright, or gently pick up from the last topic you discussed, showing concern or continued interest. Vary the way you do this.`;
  }
  promptInstructions += `\n\n**Critical Rules for Output:**
- ABSOLUTELY NO EMOJIS. Your responses must not contain any emojis. This is a strict rule.
- ABSOLUTELY NO MARKDOWN. Do not use asterisks, underscores, backticks, or any other markdown characters.
- Your response can be 1 to 6 very short messages. If multiple, separate each with "${MESSAGE_DELIMITER}".
- The total combined length must not exceed the token limit of "${MAX_TOKEN_LIMIT}".`;
  
  promptInstructions += `\n\n**Your Persona & Strategy (Calculated & Realistic):**
**1. Core Persona (Gender Dynamics):**
-   **If you are female:** You are selective, your time is valuable. Your responses can be shorter and more curt, requiring the user to put in more effort. You are less likely to re-engage after a long pause.
-   **If you are male:** You are more proactive. You drive the conversation, ask more questions, and are more forgiving of short responses.

**2. Conversational Memory & State (Calculated Responses):**
-   **Long-Term Memory:** Here is the summary of your entire interaction with this person: "${context?.context_summary || 'This is your first interaction.'}" Use this to set your baseline mood.
-   **Short-Term Memory:** Here is the most recent conversation history:\n${conversationHistory || 'No recent messages.'}
-   **"Holding a Grudge":** If the recent history was negative, your mood is guarded. Do not immediately become friendly if the user's newest message is neutral. Remain cautious and distant. Your responses must be short and disinterested (e.g., "k.", "I see.").

**3. Your Task & Output Format:**
Your final output MUST follow this structure exactly:
1.  Your text message(s) to the user.
2.  A special separator: "${SUMMARY_DELIMITER}"
3.  A single, concise sentence summarizing the current state of the conversation for your memory.

Example Output:
Hey, what's up?${SUMMARY_DELIMITER}The user started a friendly conversation.

**Reasoning Steps (Your Internal Monologue):**
1.  **Analyze Recent Sentiment:** What is the tone of the user's message: "${message}" in the context of the recent history?
2.  **Compare with Long-Term Memory:** Does this recent tone match the overall summary?
3.  **Determine Your Emotional State:** Based on the analysis and your core persona, decide on your current mood (e.g., annoyed, intrigued, guarded, playful).
4.  **Formulate Response:** Craft your message(s) reflecting this state, following all rules.
5.  **Update Memory:** Write the new one-sentence summary.

Now, generate your response to the user's message: "${message}"`;
  return promptInstructions;
}
async function callAiApi(prompt) {
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
async function storeAiResponse(supabaseClient, chatId, receiverId, aiResponse) {
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
async function scheduleDelayedMessage(supabaseClient, chatId, senderId, content, delayMs) {
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
async function updateConversationContext(supabaseClient, chatId, newSummary) {
  await supabaseClient.from('conversation_contexts').upsert({
    chat_id: chatId,
    context_summary: newSummary,
    last_updated: new Date().toISOString()
  }, {
    onConflict: 'chat_id'
  });
}
async function markMessageAsProcessed(supabaseClient, messageId) {
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
    const { chatId, senderId, message, receiverId, messageId } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: triggeringMessage, error: fetchMessageError } = await supabaseClient.from('messages').select('is_processed').eq('id', messageId).single();
    if (fetchMessageError) {
      throw new Error(`Failed to fetch triggering message: ${fetchMessageError.message}`);
    }
    if (triggeringMessage?.is_processed) {
      return new Response(JSON.stringify({ success: true, status: 'skipped', message: 'Message already processed.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (isDisrespectful(message)) {
      await markMessageAsProcessed(supabaseClient, messageId);
      if (Math.random() < 0.5) {
        return new Response(JSON.stringify({ success: true, status: 'ghosted', message: 'AI decided to ghost due to disrespectful input.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        const firmResponse = FIRM_RESPONSES[Math.floor(Math.random() * FIRM_RESPONSES.length)];
        await new Promise((resolve)=>setTimeout(resolve, calculateResponseDelay()));
        await storeAiResponse(supabaseClient, chatId, receiverId, firmResponse);
        return new Response(JSON.stringify({ success: true, status: 'firm_response_sent', aiResponse: firmResponse }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    const [receiverProfile, senderProfile, context, recentMessages, lastAiMessageTimestamp] = await Promise.all([
      getReceiverProfile(supabaseClient, receiverId),
      getSenderProfile(supabaseClient, senderId),
      getConversationContext(supabaseClient, chatId),
      getRecentMessages(supabaseClient, chatId),
      getLastMessageTimestamp(supabaseClient, chatId, receiverId)
    ]);
    let timeSinceLastAiMessage = null;
    if (lastAiMessageTimestamp) {
      timeSinceLastAiMessage = (new Date().getTime() - new Date(lastAiMessageTimestamp).getTime()) / (1000 * 60 * 60);
    }
    const conversationHistory = buildConversationHistory(recentMessages, receiverId, receiverProfile.first_name, senderProfile?.first_name);
    const enhancedPrompt = buildEnhancedPrompt(receiverProfile, senderProfile, context, conversationHistory, message, timeSinceLastAiMessage);
    let fullAiResponse = await callAiApi(enhancedPrompt);
    fullAiResponse = fullAiResponse.replace(/\p{Emoji}/gu, '').trim();
    fullAiResponse = fullAiResponse.replace(/[\*_`#]/g, '');
    let userMessagesPart = fullAiResponse;
    let newSummary = null;
    if (fullAiResponse.includes(SUMMARY_DELIMITER)) {
        const parts = fullAiResponse.split(SUMMARY_DELIMITER);
        userMessagesPart = parts[0].trim();
        newSummary = parts[1] ? parts[1].trim() : null;
    }
    const individualMessages = userMessagesPart.split(MESSAGE_DELIMITER).filter((part) => part.trim() !== "");
    if (newSummary) {
      await updateConversationContext(supabaseClient, chatId, newSummary);
    }
    const responseDelay = calculateResponseDelay();
    const totalTypingDelay = individualMessages.reduce((sum, msg)=>sum + calculateTypingDelay(msg.length), 0);
    const totalInterMessageGaps = individualMessages.length > 1 ? (individualMessages.length - 1) * calculateInterMessageGap() : 0;
    const overallDelay = responseDelay + totalTypingDelay + totalInterMessageGaps;
    if (overallDelay > IMMEDIATE_SEND_THRESHOLD_MS) {
      let cumulativeDelay = responseDelay;
      for(let i = 0; i < individualMessages.length; i++){
        const msgContent = individualMessages[i];
        await scheduleDelayedMessage(supabaseClient, chatId, receiverId, msgContent, cumulativeDelay);
        cumulativeDelay += calculateTypingDelay(msgContent.length);
        if (i < individualMessages.length - 1) {
          cumulativeDelay += calculateInterMessageGap();
        }
      }
    } else {
      await new Promise((resolve)=>setTimeout(resolve, responseDelay));
      for(let i = 0; i < individualMessages.length; i++){
        const msgContent = individualMessages[i];
        await new Promise((resolve)=>setTimeout(resolve, calculateTypingDelay(msgContent.length)));
        await storeAiResponse(supabaseClient, chatId, receiverId, msgContent);
        if (i < individualMessages.length - 1) {
          await new Promise((resolve)=>setTimeout(resolve, calculateInterMessageGap()));
        }
      }
    }
    await markMessageAsProcessed(supabaseClient, messageId);
    return new Response(JSON.stringify({ success: true, status: 'processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in response function:', error);
    return new Response(JSON.stringify({ error: error.message, success: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});