import { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const blockChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchBlockLists = useCallback(async () => {
    if (!userId) {
      setBlockedUserIds([]);
      setUsersWhoBlockedMeIds([]);
      return;
    }

    const { data: myBlocks, error: myBlocksError } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (myBlocksError) {
      console.error('useBlock.fetchBlockLists: Error fetching my blocks:', myBlocksError);
    } else {
      setBlockedUserIds(myBlocks.map(b => b.blocked_id));
    }

    const { data: blocksOnMe, error: blocksOnMeError } = await supabase
      .from('blocked_users')
      .select('blocker_id')
      .eq('blocked_id', userId);

    if (blocksOnMeError) {
      console.error('useBlock.fetchBlockLists: Error fetching blocks on me:', blocksOnMeError);
    } else {
      setUsersWhoBlockedMeIds(blocksOnMe.map(b => b.blocker_id));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      if (blockChannelRef.current) {
        supabase.removeChannel(blockChannelRef.current);
        blockChannelRef.current = null;
      }
      return;
    }

    fetchBlockLists();

    if (!blockChannelRef.current) {
      const handleRealtimeChange = (payload: any) => {
        console.log('useBlock (Provider): Real-time block change received, refetching lists.');
        fetchBlockLists();
      };

      const channel = supabase
        .channel(`block-changes-for-${userId}`)
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
            console.log(`useBlock.subscribe: Successfully subscribed to block changes.`);
          } else {
            console.error(`useBlock.subscribe: Subscription status: ${status}`, err);
          }
        });
      blockChannelRef.current = channel;
    }

    return () => {
      if (blockChannelRef.current) {
        supabase.removeChannel(blockChannelRef.current);
        blockChannelRef.current = null;
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