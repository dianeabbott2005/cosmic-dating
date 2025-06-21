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

    console.log(`useBlock (Provider): Setting up real-time subscriptions for user: ${userId}`);
    fetchBlockLists();

    const handleInsert = (payload: any) => {
      console.log('useBlock (Provider): Real-time block INSERT received!', payload);
      const newRecord = payload.new;
      if (newRecord.blocker_id === userId) {
        setBlockedUserIds(prev => prev.includes(newRecord.blocked_id) ? prev : [...prev, newRecord.blocked_id]);
      } else if (newRecord.blocked_id === userId) {
        setUsersWhoBlockedMeIds(prev => prev.includes(newRecord.blocker_id) ? prev : [...prev, newRecord.blocker_id]);
      }
    };

    const handleDelete = (payload: any) => {
      console.log('useBlock (Provider): Real-time block DELETE received!', payload);
      const oldRecord = payload.old;
      // The 'old' record might not contain all columns, but it will have the primary key.
      // We need to check both parts of the composite key.
      if (oldRecord.blocker_id && oldRecord.blocked_id) {
        if (oldRecord.blocker_id === userId) {
          setBlockedUserIds(prev => prev.filter(id => id !== oldRecord.blocked_id));
        } else if (oldRecord.blocked_id === userId) {
          setUsersWhoBlockedMeIds(prev => prev.filter(id => id !== oldRecord.blocker_id));
        }
      } else {
        // If payload.old is incomplete, we must refetch to ensure consistency.
        console.warn('useBlock (Provider): Incomplete DELETE payload, refetching block lists.');
        fetchBlockLists();
      }
    };

    const myBlocksChannel = supabase
      .channel(`my-blocks-changes-for-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${userId}` }, handleInsert)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${userId}` }, handleDelete)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`useBlock (Provider): Successfully subscribed to my-blocks-changes-for-${userId}`);
        } else {
          console.error(`useBlock (Provider): Subscription status for my-blocks: ${status}`, err);
        }
      });

    const blocksOnMeChannel = supabase
      .channel(`blocks-on-me-changes-for-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blocked_users', filter: `blocked_id=eq.${userId}` }, handleInsert)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'blocked_users', filter: `blocked_id=eq.${userId}` }, handleDelete)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`useBlock (Provider): Successfully subscribed to blocks-on-me-changes-for-${userId}`);
        } else {
          console.error(`useBlock (Provider): Subscription status for blocks-on-me: ${status}`, err);
        }
      });

    return () => {
      console.log(`useBlock (Provider): Cleaning up subscriptions for user: ${userId}`);
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