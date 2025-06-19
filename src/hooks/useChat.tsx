import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel type
import { calculateAge } from '@/utils/dateCalculations';
import { useWindowFocus } from '@/hooks/useWindowFocus'; // Import the new hook

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
    user_id: string;
    date_of_birth?: string; // Add date_of_birth to other_user
    place_of_birth?: string; // Add place_of_birth to other_user
    age?: number; // Add age to other_user
  };
  last_message?: Message;
}

// Removed AUTOMATED_RESPONSE_DEBOUNCE_TIME as it's no longer needed client-side

export const useChat = (matchId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isWindowFocused = useWindowFocus(); // Use the new hook

  // Refs for Realtime Channel instance (responseTimerRef and lastUserMessageContentRef are no longer needed)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null); // Ref to store the channel instance

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
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
        // Removed .order('created_at', { ascending: false }) from here

      if (error) {
        console.error('Error loading chats:', error);
        return;
      }

      // For each chat, get the other user's profile information and the last message
      const chatsWithProfiles = await Promise.all(
        (userChats || []).map(async (chat) => {
          const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
          
          // Select necessary public profile fields, including date_of_birth and place_of_birth
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, user_id, date_of_birth, place_of_birth') 
            .eq('user_id', otherUserId)
            .single();

          let otherUserAge: number | undefined;
          if (profile?.date_of_birth) {
            otherUserAge = calculateAge(profile.date_of_birth);
          }

          // Get the last message by sorting the messages array
          const lastMessage = chat.messages && chat.messages.length > 0 
            ? chat.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;

          return {
            id: chat.id,
            user1_id: chat.user1_id,
            user2_id: chat.user2_id,
            created_at: chat.created_at,
            other_user: profile ? {
              first_name: profile.first_name,
              user_id: profile.user_id,
              date_of_birth: profile.date_of_birth,
              place_of_birth: profile.place_of_birth,
              age: otherUserAge,
            } : undefined,
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

      // Sort chats by the latest message's created_at timestamp (descending)
      const sortedChats = chatsWithProfiles.sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA; // Descending order
      });

      setChats(sortedChats);
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
    console.log('sendMessage called with content:', content); // Added log
    if (!chat || !user || !content.trim()) {
      console.error('Cannot send message: chat, user, or content is missing.', { chat, user, content }); // Added error log
      return;
    }

    try {
      console.log('Attempting to insert message into Supabase...'); // Added log
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
        console.error('Error sending message to Supabase:', error); // Added error log
        // Optionally, show a toast notification here
        return; // Return to prevent further execution on error
      }

      console.log('Message sent successfully to Supabase:', data); // Added log
      // Add the message to local state immediately for better UX
      if (data) {
        setMessages(prev => [...prev, data]);
        console.log('Message added to local state:', data); // Added log
      }
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error); // Added error log
      // Optionally, show a toast notification here
    }
  };

  // Load chats when user is available
  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  }, [user]);

  // Refresh chats and messages when window regains focus
  useEffect(() => {
    if (isWindowFocused && user) {
      console.log('useChat: Window gained focus, refreshing chats and current messages.');
      loadUserChats(); // Refresh the list of chats
      if (chat?.id) {
        loadMessages(chat.id); // Refresh messages for the active chat
      }
    }
  }, [isWindowFocused, user, chat?.id]); // Depend on chat.id to refresh messages for the current chat

  // Set up real-time subscription for messages
  useEffect(() => {
    const currentChatId = chat?.id;
    const currentUserId = user?.id;

    if (!currentChatId || !currentUserId) {
      console.log('useChat: No chat ID or user ID, skipping real-time subscription setup.');
      return;
    }

    console.log(`useChat: Setting up real-time subscription for chat ID: ${currentChatId}`);
    const channelName = `chat-${currentChatId}`;
    const channel = supabase.channel(channelName);

    // Corrected subscription: directly assign the result of subscribe()
    const subscription = channel
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

          // Only add messages from the other user to avoid duplicates (own messages are added immediately on send)
          if (newMessage.sender_id !== currentUserId) {
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

    // Store the subscription object in the ref for cleanup
    realtimeChannelRef.current = channel; 

    // Cleanup function: unsubscribe from the channel when the component unmounts or dependencies change
    return () => {
      console.log(`useChat: Cleaning up subscription for chat ID: ${currentChatId}. Unsubscribing.`);
      // Use the stored channel instance to unsubscribe
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null; // Clear the ref
      }
      // Removed responseTimerRef and lastUserMessageContentRef cleanup as they are no longer used
    };
  }, [chat?.id, user?.id]); // Dependencies: chat.id and user.id

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