import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BlockContextType {
  blockedUserIds: string[];
  usersWhoBlockedMeIds: string[];
  blockUser: (userIdToBlock: string) => Promise<void>;
  unblockUser: (userIdToUnblock: string) => Promise<void>;
  isBlockedBy: (userId: string) => boolean;
  amIBlocking: (userId: string) => boolean;
  fetchBlockLists: () => Promise<void>;
}

const BlockContext = createContext<BlockContextType | undefined>(undefined);

export const useBlock = () => {
  const context = useContext(BlockContext);
  if (!context) {
    throw new Error('useBlock must be used within a BlockProvider');
  }
  return context;
};

export const BlockProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [usersWhoBlockedMeIds, setUsersWhoBlockedMeIds] = useState<string[]>([]);
  const userId = user?.id;

  const fetchBlockLists = useCallback(async () => {
    if (!userId) {
      setBlockedUserIds([]);
      setUsersWhoBlockedMeIds([]);
      return;
    }
    console.log('useBlock.fetchBlockLists: Fetching block lists for user:', userId);

    const { data: myBlocks, error: myBlocksError } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (myBlocksError) {
      console.error('useBlock.fetchBlockLists: Error fetching my blocks:', myBlocksError);
    } else {
      const newBlockedIds = myBlocks.map(b => b.blocked_id);
      setBlockedUserIds(newBlockedIds);
    }

    const { data: blocksOnMe, error: blocksOnMeError } = await supabase
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', userId);

    if (blocksOnMeError) {
      console.error('useBlock.fetchBlockLists: Error fetching blocks on me:', blocksOnMeError);
    } else {
      const newBlockedByMeIds = blocksOnMe.map(b => b.blocker_id);
      setUsersWhoBlockedMeIds(newBlockedByMeIds);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchBlockLists();

    const handleBlockChange = (payload: any) => {
      console.log('Real-time block event received:', payload);
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT':
          if (newRecord.blocker_id === userId) {
            console.log(`Real-time: I blocked ${newRecord.blocked_id}`);
            setBlockedUserIds(prev => [...prev, newRecord.blocked_id]);
          } else if (newRecord.blocked_id === userId) {
            console.log(`Real-time: I was blocked by ${newRecord.blocker_id}`);
            setUsersWhoBlockedMeIds(prev => [...prev, newRecord.blocker_id]);
          }
          break;
        case 'DELETE':
          if (oldRecord.blocker_id === userId) {
            console.log(`Real-time: I unblocked ${oldRecord.blocked_id}`);
            setBlockedUserIds(prev => prev.filter(id => id !== oldRecord.blocked_id));
          } else if (oldRecord.blocked_id === userId) {
            console.log(`Real-time: I was unblocked by ${oldRecord.blocker_id}`);
            setUsersWhoBlockedMeIds(prev => prev.filter(id => id !== oldRecord.blocker_id));
          }
          break;
        default:
          console.log('Real-time: Unhandled event type, re-fetching lists as a fallback:', eventType);
          fetchBlockLists();
          break;
      }
    };

    const myBlocksChannel = supabase
      .channel(`my-blocks-changes-for-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${userId}` }, handleBlockChange)
      .subscribe();

    const blocksOnMeChannel = supabase
      .channel(`blocks-on-me-changes-for-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocked_id=eq.${userId}` }, handleBlockChange)
      .subscribe();

    return () => {
      supabase.removeChannel(myBlocksChannel);
      supabase.removeChannel(blocksOnMeChannel);
    };
  }, [userId, fetchBlockLists]);

  const blockUser = useCallback(async (userIdToBlock: string) => {
    if (!userId) throw new Error('User must be logged in to block.');
    if (usersWhoBlockedMeIds.includes(userIdToBlock)) {
      throw new Error("Cannot block a user who has already blocked you.");
    }
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: userId, blocked_id: userIdToBlock });
    if (error) throw error;
  }, [userId, usersWhoBlockedMeIds]);

  const unblockUser = useCallback(async (userIdToUnblock: string) => {
    if (!userId) throw new Error('User must be logged in to unblock.');
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', userIdToUnblock);
    if (error) throw error;
  }, [userId]);

  const isBlockedBy = useCallback((userIdToCheck: string) => usersWhoBlockedMeIds.includes(userIdToCheck), [usersWhoBlockedMeIds]);
  const amIBlocking = useCallback((userIdToCheck: string) => blockedUserIds.includes(userIdToCheck), [blockedUserIds]);

  const value = useMemo(() => ({
    blockedUserIds,
    usersWhoBlockedMeIds,
    blockUser,
    unblockUser,
    isBlockedBy,
    amIBlocking,
    fetchBlockLists,
  }), [blockedUserIds, usersWhoBlockedMeIds, blockUser, unblockUser, isBlockedBy, amIBlocking, fetchBlockLists]);

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};