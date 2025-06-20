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

  useEffect(() => {
    if (!userId) {
      setBlockedUserIds([]);
      setUsersWhoBlockedMeIds([]);
      return;
    }

    const fetchBlockLists = async () => {
      console.log('useBlock.useEffect.fetchBlockLists: Fetching block lists for user:', userId);
      
      const { data: myBlocks, error: myBlocksError } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (myBlocksError) console.error('useBlock.useEffect.fetchBlockLists: Error fetching my blocks:', myBlocksError);
      else setBlockedUserIds(myBlocks.map(b => b.blocked_id));

      const { data: blocksOnMe, error: blocksOnMeError } = await supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_id', userId);

      if (blocksOnMeError) console.error('useBlock.useEffect.fetchBlockLists: Error fetching blocks on me:', blocksOnMeError);
      else setUsersWhoBlockedMeIds(blocksOnMe.map(b => b.blocker_id));
      
      console.log('useBlock.useEffect.fetchBlockLists: Finished updating block lists.');
    };

    fetchBlockLists();

    const channelName = `blocked-users-changes-for-${userId}`;
    const filterString = `or(blocker_id.eq.${userId},blocked_id.eq.${userId})`;
    console.log(`useBlock.useEffect: Setting up subscription on channel "${channelName}" with filter "${filterString}"`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: filterString,
        },
        (payload) => {
          console.log('useBlock.subscription: Real-time block change RECEIVED. Payload:', payload);
          fetchBlockLists();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`useBlock.subscription: Successfully SUBSCRIBED to channel "${channelName}".`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`useBlock.subscription: CHANNEL_ERROR on "${channelName}".`, err);
        } else {
          console.warn(`useBlock.subscription: Status is "${status}" on channel "${channelName}".`, err || '');
        }
      });

    return () => {
      console.log(`useBlock.useEffect: Cleaning up and removing subscription on channel "${channelName}".`);
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
  }), [blockedUserIds, usersWhoBlockedMeIds, blockUser, unblockUser, isBlockedBy, amIBlocking]);

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};