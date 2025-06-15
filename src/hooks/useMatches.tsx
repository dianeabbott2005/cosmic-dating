
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateCompatibility } from '@/utils/astroCompatibility';

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

  const calculateMatches = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get current user's profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!userProfile) return;

      // Get potential matches based on preferences
      const { data: potentialMatches } = await supabase
        .from('profiles')
        .select('*')
        .eq('gender', userProfile.looking_for)
        .neq('user_id', user.id);

      if (!potentialMatches) return;

      // Calculate compatibility for each potential match
      const matchesWithCompatibility = await Promise.all(
        potentialMatches.map(async (match) => {
          try {
            const compatibility = await calculateCompatibility(
              {
                dateOfBirth: userProfile.date_of_birth,
                timeOfBirth: userProfile.time_of_birth,
                placeOfBirth: userProfile.place_of_birth,
                latitude: userProfile.latitude,
                longitude: userProfile.longitude
              },
              {
                dateOfBirth: match.date_of_birth,
                timeOfBirth: match.time_of_birth,
                placeOfBirth: match.place_of_birth,
                latitude: match.latitude,
                longitude: match.longitude
              }
            );

            // Calculate age
            const birthDate = new Date(match.date_of_birth);
            const age = new Date().getFullYear() - birthDate.getFullYear();

            // Filter by age preferences
            if (age < userProfile.min_age || age > userProfile.max_age) {
              return null;
            }

            return {
              ...match,
              compatibility_score: compatibility,
              age
            };
          } catch (error) {
            console.error('Error calculating compatibility for match:', match.id, error);
            return null;
          }
        })
      );

      // Filter out null results and sort by compatibility
      const validMatches = matchesWithCompatibility
        .filter((match) => {
          return match !== null && 
                 typeof match.compatibility_score === 'number' && 
                 match.compatibility_score > 0.6;
        })
        .sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));

      setMatches(validMatches);

      // Store bidirectional matches in database using the new function
      if (validMatches.length > 0) {
        for (const match of validMatches) {
          try {
            const { error } = await supabase.rpc('create_bidirectional_match', {
              user1_uuid: user.id,
              user2_uuid: match.user_id,
              compatibility_score_val: match.compatibility_score || 0
            });
            
            if (error) {
              console.error('Error creating bidirectional match:', error);
            }
          } catch (error) {
            console.error('Error calling create_bidirectional_match:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error calculating matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExistingMatches = async () => {
    if (!user) return;

    try {
      // Get matches where the current user is either the matcher or the matched
      const { data: existingMatches } = await supabase
        .from('matches')
        .select(`
          *,
          profiles!matches_matched_user_id_fkey(*)
        `)
        .eq('user_id', user.id);

      if (existingMatches) {
        const formattedMatches = existingMatches.map(match => {
          const profile = match.profiles;
          if (!profile) return null;

          const birthDate = new Date(profile.date_of_birth);
          const age = new Date().getFullYear() - birthDate.getFullYear();

          return {
            ...profile,
            compatibility_score: match.compatibility_score,
            age
          };
        }).filter(Boolean);

        setMatches(formattedMatches);
      }
    } catch (error) {
      console.error('Error getting existing matches:', error);
    }
  };

  useEffect(() => {
    if (user) {
      // First try to get existing matches, then calculate new ones if needed
      getExistingMatches().then(() => {
        // Only calculate new matches if we don't have any
        if (matches.length === 0) {
          calculateMatches();
        }
      });
    }
  }, [user]);

  return {
    matches,
    loading,
    refreshMatches: calculateMatches
  };
};
