import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { blockedUserIds, usersWhoBlockedMeIds, fetchBlockLists } = useBlock();
  const isWindowFocused = useWindowFocus();

  const getExistingMatches = useCallback(async () => {
    if (!user) {
      setMatches([]);
      return;
    }

    setLoading(true);
    try {
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
        .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`);

      if (error) throw error;

      const uniqueMatchesMap = new Map<string, MatchProfile>();
      const allBlockedIds = new Set([...blockedUserIds, ...usersWhoBlockedMeIds]);

      (existingMatches || []).forEach(match => {
        const otherUserId = match.user_id === user.id ? match.matched_user_id : match.user_id;
        const otherUserProfile = match.user_id === user.id ? match.user2_profile : match.user1_profile;

        if (otherUserProfile && otherUserId !== user.id && !uniqueMatchesMap.has(otherUserId) && !allBlockedIds.has(otherUserId)) {
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
      console.error('getExistingMatches: Error getting existing matches:', error.message);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [user, blockedUserIds, usersWhoBlockedMeIds]);

  const triggerMatchGeneration = useCallback(async () => {
    if (!user) {
      console.log('triggerMatchGeneration: No user, cannot generate matches.');
      return;
    }
    setLoading(true);
    console.log('triggerMatchGeneration: Invoking generate-matches Edge Function for user:', user.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-matches', {
        body: { user_id: user.id }
      });

      if (error) {
        console.error('triggerMatchGeneration: Error invoking generate-matches function:', error.message);
      } else {
        console.log('triggerMatchGeneration: generate-matches function invoked successfully:', data);
        await getExistingMatches();
      }
    } catch (error: any) {
      console.error('triggerMatchGeneration: Unexpected error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [user, getExistingMatches]);

  // Use refs to hold the latest callbacks to prevent re-subscribing on every render
  const savedGetExistingMatches = useRef(getExistingMatches);
  const savedTriggerMatchGeneration = useRef(triggerMatchGeneration);
  const savedFetchBlockLists = useRef(fetchBlockLists);

  useEffect(() => {
    savedGetExistingMatches.current = getExistingMatches;
    savedTriggerMatchGeneration.current = triggerMatchGeneration;
    savedFetchBlockLists.current = fetchBlockLists;
  });

  useEffect(() => {
    if (user) {
      triggerMatchGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (isWindowFocused && user) {
      getExistingMatches();
    }
  }, [isWindowFocused, user, getExistingMatches]);

  useEffect(() => {
    if (!user) return;

    const handleBlockUpdate = () => {
      console.log('Block update detected, fetching new block lists and then matches.');
      savedFetchBlockLists.current().then(() => {
        savedGetExistingMatches.current();
      });
    };

    const profileChannel = supabase.channel('profile-updates-for-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, () => savedTriggerMatchGeneration.current())
      .subscribe();

    const matchesChannel = supabase.channel('new-matches-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches', filter: `or(user_id.eq.${user.id},matched_user_id.eq.${user.id})` }, () => savedGetExistingMatches.current())
      .subscribe();
      
    const blocksChannel = supabase.channel('block-updates-listener')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `or(blocker_id.eq.${user.id},blocked_id.eq.${user.id})` }, handleBlockUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(blocksChannel);
    };
  }, [user]); // This effect now only depends on `user`, making it stable.

  return {
    matches,
    loading,
    refreshMatches: triggerMatchGeneration
  };
};