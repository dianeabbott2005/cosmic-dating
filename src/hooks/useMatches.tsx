import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MatchProfile {
  id: string;
  user_id: string;
  first_name: string;
  // Removed last_name from this interface as it will no longer be fetched for matches
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

// Helper function to calculate accurate age
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const useMatches = () => {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Function to trigger the match generation Edge Function
  const triggerMatchGeneration = async () => {
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
        // Optionally, show a toast notification for the user
      } else {
        console.log('triggerMatchGeneration: generate-matches function invoked successfully:', data);
        // After triggering, refresh the local matches state from the DB
        await getExistingMatches();
      }
    } catch (error: any) {
      console.error('triggerMatchGeneration: Unexpected error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch existing matches from the database
  const getExistingMatches = async () => {
    if (!user) {
      console.log('getExistingMatches: No user, returning empty array.');
      setMatches([]);
      setLoading(false);
      return [];
    }

    setLoading(true);
    try {
      console.log('getExistingMatches: Fetching existing matches for user:', user.id);
      // Get matches where the current user is either the matcher or the matched
      const { data: existingMatches, error } = await supabase
        .from('matches')
        .select(`
          id,
          user_id,
          matched_user_id,
          compatibility_score,
          user1_profile:profiles!matches_user_id_fkey(
            user_id, first_name, date_of_birth, time_of_birth, place_of_birth, gender
          ),
          user2_profile:profiles!matches_matched_user_id_fkey(
            user_id, first_name, date_of_birth, time_of_birth, place_of_birth, gender
          )
        `)
        .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`);

      if (error) {
        console.error('getExistingMatches: Error fetching existing matches:', error.message);
        setMatches([]);
        return [];
      }

      if (!existingMatches || existingMatches.length === 0) {
        console.log('getExistingMatches: No existing matches found in DB.');
        setMatches([]);
        return [];
      }

      console.log('getExistingMatches: Found', existingMatches.length, 'existing match records from DB.');
      console.log('getExistingMatches: Current user ID:', user.id);

      const uniqueMatchesMap = new Map<string, MatchProfile>(); // Use a Map to ensure uniqueness by other_user_id

      existingMatches.forEach(match => {
        const otherUserId = match.user_id === user.id ? match.matched_user_id : match.user_id;
        const otherUserProfile = match.user_id === user.id ? match.user2_profile : match.user1_profile;

        console.log(`Processing match record: user_id=${match.user_id}, matched_user_id=${match.matched_user_id}, otherUserId=${otherUserId}`);
        console.log(`Is otherUserProfile valid? ${!!otherUserProfile}`);
        console.log(`Does uniqueMatchesMap already have otherUserId? ${uniqueMatchesMap.has(otherUserId)}`);

        // Ensure we have a valid profile and haven't already added this user
        // Also, explicitly ensure we are not adding the current user's own profile
        if (otherUserProfile && otherUserId !== user.id && !uniqueMatchesMap.has(otherUserId)) {
          const age = calculateAge(otherUserProfile.date_of_birth);
          uniqueMatchesMap.set(otherUserId, {
            ...otherUserProfile,
            compatibility_score: match.compatibility_score,
            age
          });
          console.log(`Added unique match: ${otherUserProfile.first_name} (ID: ${otherUserId})`);
        } else if (otherUserId === user.id) {
          console.log(`Skipping self-match record for user ID: ${otherUserId}`);
        } else if (uniqueMatchesMap.has(otherUserId)) {
          console.log(`Skipping duplicate match record for user ID: ${otherUserId}`);
        }
      });

      const formattedMatches = Array.from(uniqueMatchesMap.values());
      console.log('getExistingMatches: Final formatted unique matches count:', formattedMatches.length);
      setMatches(formattedMatches);
      return formattedMatches;
    } catch (error: any) {
      console.error('getExistingMatches: Error getting existing matches:', error.message);
      setMatches([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Initial load of matches when user is available
  useEffect(() => {
    if (user) {
      getExistingMatches();
    } else {
      setMatches([]);
      setLoading(false);
    }
  }, [user]);

  // Listen for profile updates to trigger match recalculation
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel('profile-updates-for-matches')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated, triggering match generation:', payload);
          triggerMatchGeneration();
        }
      )
      .subscribe();

    // Listen for new matches being inserted into the 'matches' table
    const matchesChannel = supabase
      .channel('new-matches-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          // Filter for matches where the current user is either user_id or matched_user_id
          // This ensures we react to both sides of a bidirectional insert
          filter: `or(user_id.eq.${user.id},matched_user_id.eq.${user.id})` 
        },
        (payload) => {
          console.log('New match inserted, refreshing existing matches:', payload);
          getExistingMatches(); // Refresh all matches to include the new one
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(matchesChannel);
    };
  }, [user]);

  return {
    matches,
    loading,
    refreshMatches: triggerMatchGeneration // Now calls the Edge Function
  };
};