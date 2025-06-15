
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateCompatibility } from '@/utils/astroCompatibility';

export interface MatchProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  time_of_birth: string;
  place_of_birth: string;
  latitude: number;
  longitude: number;
  gender: string;
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
        .filter((match): match is MatchProfile => match !== null && (match.compatibility_score || 0) > 0.6)
        .sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));

      setMatches(validMatches);

      // Store matches in database
      if (validMatches.length > 0) {
        const matchRecords = validMatches.map(match => ({
          user_id: user.id,
          matched_user_id: match.user_id,
          compatibility_score: match.compatibility_score || 0
        }));

        await supabase
          .from('matches')
          .upsert(matchRecords, { onConflict: 'user_id,matched_user_id' });
      }
    } catch (error) {
      console.error('Error calculating matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      calculateMatches();
    }
  }, [user]);

  return {
    matches,
    loading,
    refreshMatches: calculateMatches
  };
};
