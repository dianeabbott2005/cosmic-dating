
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    last_name: string;
    user_id: string;
  };
  last_message?: Message;
}

export const useChat = (matchId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Check if a user is an AI (dummy profile)
  const isAIUser = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('personality_prompt')
        .eq('user_id', userId)
        .single();
      
      return !!(data?.personality_prompt);
    } catch {
      return false;
    }
  };

  // Trigger AI response
  const triggerAIResponse = async (chatId: string, userMessage: string, receiverId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat-response', {
        body: {
          chatId,
          senderId: user?.id,
          message: userMessage,
          receiverId
        }
      });

      if (error) {
        console.error('Error triggering AI response:', error);
        return;
      }

      console.log('AI response triggered successfully:', data);
    } catch (error) {
      console.error('Error calling AI function:', error);
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
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, user_id')
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

        // Check if the other user is AI and trigger response
        const otherUserId = chat.user1_id === user.id ? chat.user2_id : chat.user1_id;
        const isAI = await isAIUser(otherUserId);
        
        if (isAI) {
          // Add a small delay to make it feel more natural
          setTimeout(() => {
            triggerAIResponse(chat.id, content.trim(), otherUserId);
          }, 2000 + Math.random() * 3000); // 2-5 seconds delay
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!chat) return;

    const channel = supabase
      .channel(`chat-${chat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chat.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Only add if it's not from the current user (to avoid duplicates)
          if (newMessage.sender_id !== user?.id) {
            setMessages(prev => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat, user?.id]);

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
