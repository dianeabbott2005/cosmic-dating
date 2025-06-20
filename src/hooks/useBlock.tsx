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
      console.log('useBlock.fetchBlockLists: Setting my blocks to:', newBlockedIds);
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
      console.log('useBlock.fetchBlockLists: Setting users who have blocked me to:', newBlockedByMeIds);
      setUsersWhoBlockedMeIds(newBlockedByMeIds);
    }
    
    console.log('useBlock.fetchBlockLists: Finished updating block lists.');
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchBlockLists();

    // Channel 1: Listens for when I block or unblock someone
    const myBlocksChannel = supabase
      .channel(`my-blocks-changes-for-${userId}`)
      .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: `blocker_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Real-time [My Blocks]: Event received. Refetching lists. Payload:', payload);
          fetchBlockLists();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`Real-time [My Blocks]: Successfully subscribed for user ${userId}.`);
        else console.error(`Real-time [My Blocks]: Subscription status: ${status}`, err);
      });

    // Channel 2: Listens for when someone else blocks or unblocks me
    const blocksOnMeChannel = supabase
      .channel(`blocks-on-me-changes-for-${userId}`)
      .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'blocked_users',
          filter: `blocked_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Real-time [Blocks On Me]: Event received. Refetching lists. Payload:', payload);
          fetchBlockLists();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log(`Real-time [Blocks On Me]: Successfully subscribed for user ${userId}.`);
        else console.error(`Real-time [Blocks On Me]: Subscription status: ${status}`, err);
      });

    return () => {
      console.log('useBlock.subscription: Cleaning up and removing channel subscriptions.');
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