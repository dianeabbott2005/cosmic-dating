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
    if (!userId) return;

    console.log('useBlock: Fetching block lists...');
    // Fetch users I have blocked
    const { data: myBlocks, error: myBlocksError } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (myBlocksError) console.error('Error fetching my blocks:', myBlocksError);
    else setBlockedUserIds(myBlocks.map(b => b.blocked_id));

    // Fetch users who have blocked me
    const { data: blocksOnMe, error: blocksOnMeError } = await supabase
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', userId);

    if (blocksOnMeError) console.error('Error fetching blocks on me:', blocksOnMeError);
    else setUsersWhoBlockedMeIds(blocksOnMe.map(b => b.blocker_id));
    console.log('useBlock: Block lists updated.');
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchBlockLists();
    } else {
      // Clear lists on sign out
      setBlockedUserIds([]);
      setUsersWhoBlockedMeIds([]);
    }
  }, [userId, fetchBlockLists]);

  // Real-time subscription for block changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`blocked-users-changes-for-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT and DELETE
          schema: 'public',
          table: 'blocked_users',
          filter: `or(blocker_id.eq.${userId},blocked_id.eq.${userId})`,
        },
        (payload) => {
          console.log('useBlock: Real-time block change received, refetching lists.', payload);
          fetchBlockLists();
        }
      )
      .subscribe();

    // Cleanup function to remove the channel subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchBlockLists]);

  const blockUser = useCallback(async (userIdToBlock: string) => {
    if (!userId) throw new Error('User must be logged in to block.');
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: userId, blocked_id: userIdToBlock });
    if (error) throw error;
    // No need to call fetchBlockLists here, the real-time listener will handle it.
  }, [userId]);

  const unblockUser = useCallback(async (userIdToUnblock: string) => {
    if (!userId) throw new Error('User must be logged in to unblock.');
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', userIdToUnblock);
    if (error) throw error;
    // No need to call fetchBlockLists here, the real-time listener will handle it.
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
    fetchBlockLists
  }), [blockedUserIds, usersWhoBlockedMeIds, blockUser, unblockUser, isBlockedBy, amIBlocking, fetchBlockLists]);

  return (
    <BlockContext.Provider value={value}>
      {children}
    </BlockContext.Provider>
  );
};