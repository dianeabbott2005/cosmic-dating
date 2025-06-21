import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BlockContextType {
  blockedUserIds: string[];
  usersWhoBlockedMeIds: string[];
  blockUser: (userIdToBlock: string) => Promise<void>;
  unblockUser: (userIdToUnblock: string) => Promise<void>;
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
      const ids = myBlocks.map(b => b.blocked_id);
      setBlockedUserIds(ids);
      console.log('useBlock.fetchBlockLists: Set my blocked users:', ids);
    }

    const { data: blocksOnMe, error: blocksOnMeError } = await supabase
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', userId);

    if (blocksOnMeError) {
      console.error('useBlock.fetchBlockLists: Error fetching blocks on me:', blocksOnMeError);
    } else {
      const ids = blocksOnMe.map(b => b.blocker_id);
      setUsersWhoBlockedMeIds(ids);
      console.log('useBlock.fetchBlockLists: Set users who blocked me:', ids);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      console.log('useBlock (Provider): No user ID, skipping subscription setup.');
      return;
    }

    fetchBlockLists();

    const handleRealtimeChange = (payload: any) => {
      console.log('useBlock (Provider): Real-time block change received!', {
        eventType: payload.eventType,
        payload: payload,
      });

      if (payload.eventType === 'INSERT') {
        const newRecord = payload.new;
        console.log('useBlock (Provider): Handling INSERT.', newRecord);
        if (newRecord.blocker_id === userId) {
          console.log(`useBlock (Provider): User ${userId} blocked ${newRecord.blocked_id}. Updating state.`);
          setBlockedUserIds(prev => [...new Set([...prev, newRecord.blocked_id])]);
        } else if (newRecord.blocked_id === userId) {
          console.log(`useBlock (Provider): User ${newRecord.blocker_id} blocked ${userId}. Updating state.`);
          setUsersWhoBlockedMeIds(prev => [...new Set([...prev, newRecord.blocker_id])]);
        }
      } else if (payload.eventType === 'DELETE') {
        const oldRecord = payload.old;
        console.log('useBlock (Provider): Handling DELETE.', oldRecord);
        if (oldRecord.blocker_id && oldRecord.blocked_id) {
          if (oldRecord.blocker_id === userId) {
            console.log(`useBlock (Provider): User ${userId} unblocked ${oldRecord.blocked_id}. Updating state.`);
            setBlockedUserIds(prev => prev.filter(id => id !== oldRecord.blocked_id));
          } else if (oldRecord.blocked_id === userId) {
            console.log(`useBlock (Provider): User ${oldRecord.blocker_id} unblocked ${userId}. Updating state.`);
            setUsersWhoBlockedMeIds(prev => prev.filter(id => id !== oldRecord.blocker_id));
          }
        } else {
          console.warn('useBlock (Provider): Incomplete DELETE payload, refetching block lists for safety.');
          fetchBlockLists();
        }
      }
    };

    // Use a unique channel name to prevent any potential caching issues on the real-time server.
    const channelName = `block-changes-for-${userId}-${Math.random()}`;
    const blockChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: `or(blocker_id.eq.${userId},blocked_id.eq.${userId})`,
        },
        handleRealtimeChange
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`useBlock (Provider): Successfully subscribed to ${channelName}`);
        } else {
          console.error(`useBlock (Provider): Subscription status for ${channelName}: ${status}`, err);
        }
      });

    return () => {
      console.log(`useBlock (Provider): Cleaning up subscription for channel: ${channelName}`);
      if (blockChannel) {
        supabase.removeChannel(blockChannel);
      }
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

  const value = useMemo(() => ({
    blockedUserIds,
    usersWhoBlockedMeIds,
    blockUser,
    unblockUser,
    fetchBlockLists,
  }), [blockedUserIds, usersWhoBlockedMeIds, blockUser, unblockUser, fetchBlockLists]);

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};