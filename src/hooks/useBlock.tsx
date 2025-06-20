import { useState, useEffect, createContext, useContext, useCallback } from 'react';
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

  const blockUser = async (userIdToBlock: string) => {
    if (!userId) throw new Error('User must be logged in to block.');
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: userId, blocked_id: userIdToBlock });
    if (error) throw error;
    // Refresh lists
    await fetchBlockLists();
  };

  const unblockUser = async (userIdToUnblock: string) => {
    if (!userId) throw new Error('User must be logged in to unblock.');
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', userIdToUnblock);
    if (error) throw error;
    // Refresh lists
    await fetchBlockLists();
  };

  const isBlockedBy = (userId: string) => usersWhoBlockedMeIds.includes(userId);
  const amIBlocking = (userId: string) => blockedUserIds.includes(userId);

  return (
    <BlockContext.Provider value={{ blockedUserIds, usersWhoBlockedMeIds, blockUser, unblockUser, isBlockedBy, amIBlocking, fetchBlockLists }}>
      {children}
    </BlockContext.Provider>
  );
};