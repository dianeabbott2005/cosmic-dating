import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateAge } from '@/utils/dateCalculations';
import { useWindowFocus } from '@/hooks/useWindowFocus';
import { useBlock } from '@/hooks/useBlock';

export interface MatchProfile {
  user_id: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string;
  time_of_birth: string;
  place_of_birth: string;
  gender: string;
  current_city: string | null;
  current_country: string | null;
  compatibility_score?: number;
  age?: number;
}

export const useMatches = () => {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { blockedUserIds, usersWhoBlockedMeIds } = useBlock();
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
        await supabase.functions.invoke('generate-matches', {
          body: { user_id: userId }
        });

        const allBlockedIds = [...new Set([...blockedUserIds, ...usersWhoBlockedMeIds])];

        let query = supabase
          .from('matches')
          .select(`
            id,
            user_id,
            matched_user_id,
            compatibility_score,
            user1_profile:profiles!matches_user_id_fkey(user_id, first_name, last_name, date_of_birth, time_of_birth, place_of_birth, gender, current_city, current_country),
            user2_profile:profiles!matches_matched_user_id_fkey(user_id, first_name, last_name, date_of_birth, time_of_birth, place_of_birth, gender, current_city, current_country)
          `);

        if (allBlockedIds.length > 0) {
          const blockedIdsString = `(${allBlockedIds.map(id => `'${id}'`).join(',')})`;
          query = query.or(
            `and(user_id.eq.${userId},matched_user_id.not.in.${blockedIdsString}),` +
            `and(matched_user_id.eq.${userId},user_id.not.in.${blockedIdsString})`
          );
        } else {
          query = query.or(`user_id.eq.${userId},matched_user_id.eq.${userId}`);
        }
        
        const { data: existingMatches, error } = await query;
        
        if (error) throw error;

        const uniqueMatchesMap = new Map<string, MatchProfile>();

        (existingMatches || []).forEach(match => {
          const otherUserId = match.user_id === userId ? match.matched_user_id : match.user_id;
          const otherUserProfile = match.user_id === userId ? match.user2_profile : match.user1_profile;

          if (otherUserProfile && otherUserId !== userId && !uniqueMatchesMap.has(otherUserId)) {
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

  return { matches, loading, refreshMatches };
};