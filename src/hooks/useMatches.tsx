
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

  const calculateMatches = async () => {
    if (!user) return;

    setLoading(true);
    try {
      console.log('Starting match calculation for user:', user.id);
      
      // Get current user's profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!userProfile) {
        console.log('No user profile found');
        return;
      }

      console.log('User profile:', userProfile);
      const userAge = calculateAge(userProfile.date_of_birth);
      console.log('User age:', userAge);

      // Get potential matches based on mutual preferences
      const { data: potentialMatches } = await supabase
        .from('profiles')
        .select('*')
        .eq('gender', userProfile.looking_for) // Match has the gender current user is looking for
        .eq('looking_for', userProfile.gender) // Match is looking for current user's gender
        .neq('user_id', user.id);

      if (!potentialMatches) {
        console.log('No potential matches found');
        return;
      }

      console.log('Found', potentialMatches.length, 'potential matches');

      // Calculate compatibility and filter by mutual age preferences
      const matchesWithCompatibility = await Promise.all(
        potentialMatches.map(async (match) => {
          try {
            const matchAge = calculateAge(match.date_of_birth);
            console.log(`Processing match ${match.first_name}, age: ${matchAge}`);

            // Check mutual age preferences
            const userFitsMatchAgeRange = userAge >= match.min_age && userAge <= match.max_age;
            const matchFitsUserAgeRange = matchAge >= userProfile.min_age && matchAge <= userProfile.max_age;

            console.log(`Age compatibility - User fits match range: ${userFitsMatchAgeRange}, Match fits user range: ${matchFitsUserAgeRange}`);

            if (!userFitsMatchAgeRange || !matchFitsUserAgeRange) {
              console.log(`Age mismatch for ${match.first_name}`);
              return null;
            }

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

            console.log(`Compatibility for ${match.first_name}: ${compatibility}`);

            return {
              ...match,
              compatibility_score: compatibility,
              age: matchAge
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

      console.log('Valid matches after filtering:', validMatches.length);
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

          const age = calculateAge(profile.date_of_birth);

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

  // Listen for profile updates to trigger match recalculation
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated, recalculating matches:', payload);
          calculateMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
