import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MatchProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
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
          *,
          profiles!matches_matched_user_id_fkey(*)
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

      console.log('getExistingMatches: Found', existingMatches.length, 'existing match records.');

      const formattedMatches = existingMatches.map(match => {
        const profile = match.profiles;
        
        if (!profile) {
          console.warn('getExistingMatches: Profile data missing for match record:', match.id);
          return null;
        }

        const age = calculateAge(profile.date_of_birth);

        return {
          ...profile,
          compatibility_score: match.compatibility_score,
          age
        };
      }).filter(Boolean) as MatchProfile[];

      console.log('getExistingMatches: Formatted existing matches:', formattedMatches.length, formattedMatches);
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
          filter: `user_id=eq.${user.id}` // Only listen for matches where current user is user_id
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