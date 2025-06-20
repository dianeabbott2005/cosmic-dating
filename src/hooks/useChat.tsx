import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { calculateAge } from '@/utils/dateCalculations';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { useBlock } from '@/hooks/useBlock';

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
    date_of_birth?: string;
    place_of_birth?: string;
    age?: number;
  };
  last_message?: Message;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { blockedUserIds, usersWhoBlockedMeIds } = useBlock();
  const isWindowFocused = useWindowFocus();
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const otherUserIdRef = useRef<string | null>(null);

  const loadUserChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: userChats, error } = await supabase
        .from('chats')
        .select(`*, messages (id, content, sender_id, created_at, chat_id)`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      const allBlockedIds = new Set([...blockedUserIds, ...usersWhoBlockedMeIds]);

      const chatPromises = (userChats || []).map(async (chat) => {
        const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
        if (allBlockedIds.has(otherUserId)) return null;

        const { data: profile } = await supabase.from('profiles').select('first_name, user_id, date_of_birth, place_of_birth').eq('user_id', otherUserId).single();
        const lastMessage = chat.messages?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
        
        if (!lastMessage) return null;

        return {
          ...chat,
          other_user: profile ? { ...profile, age: profile.date_of_birth ? calculateAge(profile.date_of_birth) : undefined } : undefined,
          last_message: lastMessage ? { ...lastMessage } : undefined
        };
      });

      const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean) as Chat[];
      
      const sortedChats = resolvedChats.sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setChats(sortedChats);
    } catch (error) {
      console.error('Error loading user chats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, blockedUserIds, usersWhoBlockedMeIds]);

  const initializeChat = useCallback(async (otherUserId: string) => {
    if (!user) return;
    setLoading(true);
    otherUserIdRef.current = otherUserId;
    try {
      const { data: existingChat } = await supabase.from('chats').select('*').or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`).maybeSingle();
      if (existingChat) {
        setChat(existingChat);
        await loadMessages(existingChat.id);
      } else {
        setChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMessages = async (chatId: string) => {
    const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (error) console.error('Error loading messages:', error);
    else setMessages(data || []);
  };

  const sendMessage = async (content: string) => {
    if (!user || !content.trim()) return;
    try {
      let currentChat = chat;
      if (!currentChat) {
        const otherUserId = otherUserIdRef.current;
        if (!otherUserId) throw new Error('Cannot create chat: other user ID is missing.');
        const { data: newChat, error: createError } = await supabase.from('chats').insert({ user1_id: user.id, user2_id: otherUserId }).select().single();
        if (createError) throw createError;
        setChat(newChat);
        currentChat = newChat;
      }
      const { data, error } = await supabase.from('messages').insert({ chat_id: currentChat.id, sender_id: user.id, content: content.trim() }).select().single();
      if (error) throw error;
      if (data) setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error('Unexpected error in sendMessage:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (isWindowFocused && user) {
      loadUserChats();
      if (chat?.id) {
        loadMessages(chat.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWindowFocused, user, chat?.id]);

  useEffect(() => {
    if (!chat?.id || !user?.id) {
      return;
    }

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase.channel(`chat-${chat.id}`);
    
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, (payload) => {
      const newMessage = payload.new as Message;
      if (newMessage.sender_id !== user.id) {
        setMessages(prevMessages => {
          if (prevMessages.some(msg => msg.id === newMessage.id)) {
            return prevMessages;
          }
          return [...prevMessages, newMessage];
        });
      }
    }).subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [chat?.id, user?.id]);

  return { chat, chats, messages, loading, initializeChat, sendMessage, loadUserChats };
};