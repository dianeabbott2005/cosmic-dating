import { useState, useEffect, useCallback, createContext, useContext, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

interface ChatContextType {
  chats: Chat[];
  chatsLoading: boolean;
  loadUserChats: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const { user } = useAuth();
  const { blockedUserIds, usersWhoBlockedMeIds } = useBlock();
  const isWindowFocused = useWindowFocus();
  const userId = user?.id;

  const loadUserChats = useCallback(async () => {
    if (!userId) {
      setChats([]);
      return;
    }
    setChatsLoading(true);
    try {
      const allBlockedIds = [...new Set([...blockedUserIds, ...usersWhoBlockedMeIds])];

      let query = supabase
        .from('chats')
        .select(`*, messages (id, content, sender_id, created_at, chat_id)`);

      if (allBlockedIds.length > 0) {
        const blockedIdsString = `(${allBlockedIds.join(',')})`;
        query = query.or(
          `and(user1_id.eq.${userId},user2_id.not.in.${blockedIdsString}),` +
          `and(user2_id.eq.${userId},user1_id.not.in.${blockedIdsString})`
        );
      } else {
        query = query.or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
      }

      const { data: userChats, error } = await query;

      if (error) throw error;

      const chatPromises = (userChats || []).map(async (chat) => {
        const otherUserId = chat.user1_id === userId ? chat.user2_id : chat.user1_id;
        
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
      setChatsLoading(false);
    }
  }, [userId, blockedUserIds, usersWhoBlockedMeIds]);

  const loadUserChatsRef = useRef(loadUserChats);
  useEffect(() => {
    loadUserChatsRef.current = loadUserChats;
  });

  useEffect(() => {
    if (userId) {
      loadUserChats();
    }
  }, [userId, loadUserChats]);

  useEffect(() => {
    if (isWindowFocused) {
      loadUserChats();
    }
  }, [isWindowFocused, loadUserChats]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`public:messages:user-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        console.log('useChat (Provider): New message detected, reloading chat list.', payload);
        loadUserChatsRef.current();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const value = useMemo(() => ({
    chats,
    chatsLoading,
    loadUserChats,
  }), [chats, chatsLoading, loadUserChats]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};