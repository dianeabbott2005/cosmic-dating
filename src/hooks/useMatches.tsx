import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateAge } from '@/utils/dateCalculations';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { useBlock } from '@/hooks/useBlock';

export interface MatchProfile {
  id: string;
  user_id: string;
  first_name: string;
  email: string;
  date_of_birth: string;
  time_of_birth: string;
  place_of_birth: string;
  latitude: number;
  longitude: number;
  timezone: string;
  gender: string;
  looking_for: string;
  min_age: number;
  max_age: number;
  created_at: string;
  updated_at: string;
  compatibility_score?: number;
  age?: number;
}

export const useMatches = () => {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { blockedUserIds, usersWhoBlockedMeIds, fetchBlockLists } = useBlock();
  const isWindowFocused = useWindowFocus();
  const userId = user?.id;
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshMatches = useCallback(() => {
    setRefreshTrigger(count => count + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const fetchAndGenerateMatches = async () => {
      setLoading(true);
      try {
        // First, invoke generation to ensure backend has the latest.
        await supabase.functions.invoke('generate-matches', {
          body: { user_id: userId }
        });

        // Now, fetch the current state of matches.
        const { data: existingMatches, error } = await supabase
          .from('matches')
          .select(`
            id,
            user_id,
            matched_user_id,
            compatibility_score,
            user1_profile:profiles!matches_user_id_fkey(user_id, first_name, date_of_birth, time_of_birth, place_of_birth, gender),
            user2_profile:profiles!matches_matched_user_id_fkey(user_id, first_name, date_of_birth, time_of_birth, place_of_birth, gender)
          `)
          .or(`user_id.eq.${userId},matched_user_id.eq.${userId}`);
        
        if (error) throw error;

        const uniqueMatchesMap = new Map<string, MatchProfile>();
        const allBlockedIds = new Set([...blockedUserIds, ...usersWhoBlockedMeIds]);

        (existingMatches || []).forEach(match => {
          const otherUserId = match.user_id === userId ? match.matched_user_id : match.user_id;
          const otherUserProfile = match.user_id === userId ? match.user2_profile : match.user1_profile;

          if (otherUserProfile && otherUserId !== userId && !uniqueMatchesMap.has(otherUserId) && !allBlockedIds.has(otherUserId)) {
            const age = calculateAge(otherUserProfile.date_of_birth);
            uniqueMatchesMap.set(otherUserId, {
              ...otherUserProfile,
              compatibility_score: match.compatibility_score,
              age
            });
          }
        });

        setMatches(Array.from(uniqueMatchesMap.values()));

      } catch (error: any) {
        console.error('useMatches: Error fetching matches:', error.message);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAndGenerateMatches();
  }, [userId, blockedUserIds, usersWhoBlockedMeIds, refreshTrigger]);

  useEffect(() => {
    if (isWindowFocused) {
      refreshMatches();
    }
  }, [isWindowFocused, refreshMatches]);

  useEffect(() => {
    if (!userId) return;

    const handleBlockUpdate = () => {
      fetchBlockLists().then(() => {
        refreshMatches();
      });
    };

    const profileChannel = supabase.channel('profile-updates-for-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, refreshMatches)
      .subscribe();

    const matchesChannel = supabase.channel('matches-listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `or(user_id.eq.${userId},matched_user_id.eq.${userId})` }, refreshMatches)
      .subscribe();
      
    const blocksChannel = supabase.channel('block-updates-listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `or(blocker_id.eq.${userId},blocked_id.eq.${userId})` }, handleBlockUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(blocksChannel);
    };
  }, [userId, refreshMatches, fetchBlockLists]);

  return { matches, loading, refreshMatches };
};