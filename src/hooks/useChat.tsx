import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  chat_id: string;
}

export interface Chat {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  other_user?: {
    first_name: string;
    // Removed last_name from this interface as it will no longer be fetched for chat participants
    user_id: string;
  };
  last_message?: Message;
}

const AUTOMATED_RESPONSE_DEBOUNCE_TIME = 30000; // 30 seconds

export const useChat = (matchId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Refs for debounce logic and Realtime Channel instance
  const automatedResponseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserMessageContentRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null); // Ref to store the channel instance

  // Check if a user is an active profile (is_active: true)
  const isProfileActive = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', userId)
        .single();
      
      // If is_active is true, it's an active profile (which could be automated)
      return data?.is_active === true;
    } catch {
      return false;
    }
  };

  // Trigger automated response
  const triggerAutomatedResponse = async (chatId: string, userMessage: string, receiverId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('chat-response', {
        body: {
          chatId,
          senderId: user?.id,
          message: userMessage,
          receiverId
        }
      });

      if (error) {
        console.error('Error triggering automated response:', error);
        return;
      }

    } catch (error) {
      console.error('Error calling chat response function:', error);
    }
  };

  // Load all chats for the current user
  const loadUserChats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: userChats, error } = await supabase
        .from('chats')
        .select(`
          *,
          messages (
            id,
            content,
            sender_id,
            created_at,
            chat_id
          )
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading chats:', error);
        return;
      }

      // For each chat, get the other user's profile information
      const chatsWithProfiles = await Promise.all(
        (userChats || []).map(async (chat) => {
          const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
          
          // Select only necessary public profile fields, excluding last_name
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, user_id') 
            .eq('user_id', otherUserId)
            .single();

          // Get the last message and ensure it has all required fields
          const lastMessage = chat.messages && chat.messages.length > 0 
            ? chat.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;

          return {
            id: chat.id,
            user1_id: chat.user1_id,
            user2_id: chat.user2_id,
            created_at: chat.created_at,
            other_user: profile,
            last_message: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              sender_id: lastMessage.sender_id,
              created_at: lastMessage.created_at,
              chat_id: lastMessage.chat_id
            } : undefined
          };
        })
      );

      setChats(chatsWithProfiles);
    } catch (error) {
      console.error('Error loading user chats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create or get existing chat
  const initializeChat = async (otherUserId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if chat already exists (either direction)
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingChat) {
        setChat(existingChat);
        await loadMessages(existingChat.id);
      } else {
        // Create new chat
        const { data: newChat, error } = await supabase
          .from('chats')
          .insert({
            user1_id: user.id,
            user2_id: otherUserId
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating chat:', error);
          return;
        }
        
        setChat(newChat);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for a chat
  const loadMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }
      
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send a message
  const sendMessage = async (content: string) => {
    if (!chat || !user || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chat.id,
          sender_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      // Add the message to local state immediately for better UX
      if (data) {
        setMessages(prev => [...prev, data]);

        // Determine the other user's ID
        const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
        
        // Check if the other user is an active profile (which could be automated)
        const isOtherUserActive = await isProfileActive(otherUserId);

        if (isOtherUserActive) {
          // Store the content of the last message sent by the user
          lastUserMessageContentRef.current = content.trim();

          // Clear any existing timer
          if (automatedResponseTimerRef.current) {
            clearTimeout(automatedResponseTimerRef.current);
          }

          // Set a new timer
          automatedResponseTimerRef.current = setTimeout(() => {
            if (lastUserMessageContentRef.current) {
              triggerAutomatedResponse(chat.id, lastUserMessageContentRef.current, otherUserId);
              lastUserMessageContentRef.current = null; // Clear the ref after triggering
            }
          }, AUTOMATED_RESPONSE_DEBOUNCE_TIME);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load chats when user is available
  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  }, [user]);

  // Set up real-time subscription
  useEffect(() => {
    const currentChatId = chat?.id;
    const currentUserId = user?.id;

    // If no chat ID or user ID, or if the component is unmounting, clean up and return.
    if (!currentChatId || !currentUserId) {
      if (realtimeChannelRef.current) {
        console.log(`useChat: Cleaning up existing channel ${realtimeChannelRef.current.topic} due to missing chat/user ID or unmount.`);
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    const channelName = `chat-${currentChatId}`;

    // If we already have a channel subscribed to the correct topic, do nothing.
    if (realtimeChannelRef.current && realtimeChannelRef.current.topic === `realtime:${channelName}`) {
      console.log(`useChat: Channel ${channelName} already subscribed and correct. Skipping re-subscription.`);
      return;
    }

    // If there's an existing channel but it's for a different chat or not subscribed, remove it.
    if (realtimeChannelRef.current) {
      console.log(`useChat: Removing old channel ${realtimeChannelRef.current.topic} before subscribing to ${channelName}.`);
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    console.log(`useChat: Attempting to set up new real-time subscription for chat ID: ${currentChatId}`);
    const newChannel = supabase.channel(channelName);

    newChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${currentChatId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('useChat: Real-time message received via subscription:', newMessage);

          if (newMessage.sender_id !== currentUserId) { // Ensure it's not our own message
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log(`useChat: Message ${newMessage.id} already exists in state, skipping addition.`);
                return prev;
              }
              console.log(`useChat: Adding new message ${newMessage.id} from other user to state.`);
              return [...prev, newMessage];
            });
          } else {
            console.log(`useChat: Received own message ${newMessage.id} via real-time, skipping to avoid duplicate in state.`);
          }
        }
      )
      .subscribe((status) => {
        console.log(`useChat: Supabase Realtime Channel Status for ${channelName}: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log(`useChat: Successfully SUBSCRIBED to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`useChat: Error subscribing to ${channelName}. Check RLS policies or network.`);
        }
      });

    realtimeChannelRef.current = newChannel; // Store the new channel instance

    return () => {
      // This cleanup runs when the component unmounts or dependencies change.
      if (realtimeChannelRef.current) {
        console.log(`useChat: Cleaning up subscription for ${realtimeChannelRef.current.topic}. Removing channel.`);
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (automatedResponseTimerRef.current) {
        clearTimeout(automatedResponseTimerRef.current);
        automatedResponseTimerRef.current = null;
      }
      lastUserMessageContentRef.current = null;
    };
  }, [chat?.id, user?.id]); // Dependencies: chat.id and user.id (only re-subscribe if chat ID or user changes)

  return {
    chat,
    chats,
    messages,
    loading,
    initializeChat,
    sendMessage,
    loadUserChats
  };
};