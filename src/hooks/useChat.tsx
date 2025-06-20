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

export const useChat = (matchId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isWindowFocused = useWindowFocus();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const otherUserIdRef = useRef<string | null>(null); // To hold the other user's ID before a chat is created

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

      if (error) {
        console.error('Error loading chats:', error);
        return;
      }

      const chatsWithProfiles = await Promise.all(
        (userChats || []).map(async (chat) => {
          const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, user_id, date_of_birth, place_of_birth') 
            .eq('user_id', otherUserId)
            .single();

          let otherUserAge: number | undefined;
          if (profile?.date_of_birth) {
            otherUserAge = calculateAge(profile.date_of_birth);
          }

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

      const sortedChats = chatsWithProfiles.sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setChats(sortedChats);
    } catch (error) {
      console.error('Error loading user chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeChat = async (otherUserId: string) => {
    if (!user) return;

    setLoading(true);
    otherUserIdRef.current = otherUserId; // Store the ID for sendMessage
    try {
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existingChat) {
        console.log('useChat: Existing chat found, loading messages.');
        setChat(existingChat);
        await loadMessages(existingChat.id);
      } else {
        console.log('useChat: No existing chat found. Waiting for first message to create one.');
        setChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) {
      console.error('Cannot send message: user or content is missing.');
      return;
    }

    try {
      let currentChat = chat;

      if (!currentChat) {
        const otherUserId = otherUserIdRef.current;
        if (!otherUserId) {
          console.error('Cannot create chat: other user ID is missing.');
          return;
        }
        console.log('useChat: First message. Creating new chat record...');
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert({ user1_id: user.id, user2_id: otherUserId })
          .select()
          .single();

        if (createError) {
          console.error('Error creating chat:', createError);
          return;
        }
        
        console.log('useChat: New chat created with ID:', newChat.id);
        setChat(newChat);
        currentChat = newChat;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: currentChat.id,
          sender_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message to Supabase:', error);
        return;
      }

      if (data) {
        setMessages(prev => [...prev, data]);
      }
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  }, [user]);

  useEffect(() => {
    if (isWindowFocused && user) {
      console.log('useChat: Window gained focus, refreshing chats and current messages.');
      loadUserChats();
      if (chat?.id) {
        loadMessages(chat.id);
      }
    }
  }, [isWindowFocused, user, chat?.id]);

  useEffect(() => {
    const currentChatId = chat?.id;
    const currentUserId = user?.id;

    if (!currentChatId || !currentUserId) {
      return;
    }

    const channelName = `chat-${currentChatId}`;
    const channel = supabase.channel(channelName);

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
          if (newMessage.sender_id !== currentUserId) {
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (!exists) {
                return [...prev, newMessage];
              }
              return prev;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`useChat: Successfully SUBSCRIBED to ${channelName}`);
        }
      });

    realtimeChannelRef.current = channel; 

    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
      }
    };
  }, [chat?.id, user?.id]);

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