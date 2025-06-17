import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
// Removed: import { calculateCompatibility } from '@/utils/astroCompatibility'; // This import is no longer needed

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
    if (!user) {
      console.log('calculateMatches: No user, returning.');
      return;
    }

    setLoading(true);
    try {
      console.log('calculateMatches: Starting match calculation for user:', user.id);
      
      // Get current user's profile
      const { data: userProfile, error: userProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (userProfileError || !userProfile) {
        console.error('calculateMatches: Error fetching user profile or profile not found:', userProfileError);
        setLoading(false);
        return;
      }

      console.log('calculateMatches: User profile:', userProfile);
      const userAge = calculateAge(userProfile.date_of_birth);
      console.log('calculateMatches: User age:', userAge);

      // Get potential matches based on mutual preferences
      const { data: potentialProfiles, error: potentialProfilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('gender', userProfile.looking_for) // Match has the gender current user is looking for
        .eq('looking_for', userProfile.gender) // Match is looking for current user's gender
        .neq('user_id', user.id);

      if (potentialProfilesError) {
        console.error('calculateMatches: Error fetching potential profiles:', potentialProfilesError);
        setLoading(false);
        return;
      }

      if (!potentialProfiles || potentialProfiles.length === 0) {
        console.log('calculateMatches: No potential profiles found matching initial criteria.');
        setMatches([]); // Clear matches if none found
        setLoading(false);
        return;
      }

      console.log('calculateMatches: Found', potentialProfiles.length, 'potential profiles for detailed check.');

      // Prepare user's birth data for the Edge Function
      const userBirthData = {
        dateOfBirth: userProfile.date_of_birth,
        timeOfBirth: userProfile.time_of_birth,
        placeOfBirth: userProfile.place_of_birth,
        latitude: userProfile.latitude,
        longitude: userProfile.longitude
      };

      // Calculate compatibility and filter by mutual age preferences
      const matchesWithCompatibility = await Promise.all(
        potentialProfiles.map(async (matchProfile) => {
          try {
            const matchAge = calculateAge(matchProfile.date_of_birth);
            console.log(`calculateMatches: Processing match ${matchProfile.first_name} (ID: ${matchProfile.user_id}), age: ${matchAge}`);

            // Check mutual age preferences
            const userFitsMatchAgeRange = userAge >= matchProfile.min_age && userAge <= userProfile.max_age;
            const matchFitsUserAgeRange = matchAge >= userProfile.min_age && matchAge <= userProfile.max_age;

            console.log(`calculateMatches: Age compatibility for ${matchProfile.first_name} - User fits match range: ${userFitsMatchAgeRange}, Match fits user range: ${matchFitsUserAgeRange}`);

            if (!userFitsMatchAgeRange || !matchFitsUserAgeRange) {
              console.log(`calculateMatches: Age mismatch for ${matchProfile.first_name}. Skipping.`);
              return null;
            }

            // Prepare match's birth data for the Edge Function
            const matchBirthData = {
              dateOfBirth: matchProfile.date_of_birth,
              timeOfBirth: matchProfile.time_of_birth,
              placeOfBirth: matchProfile.place_of_birth,
              latitude: matchProfile.latitude,
              longitude: matchProfile.longitude
            };

            // Call the Supabase Edge Function for compatibility calculation
            const { data: compatibilityData, error: compatibilityError } = await supabase.functions.invoke('calculate-compatibility', {
                body: { person1: userBirthData, person2: matchBirthData }
            });

            if (compatibilityError) {
                console.error('calculateMatches: Error invoking compatibility function:', compatibilityError);
                // Fallback to a default score or handle as an error
                return { ...matchProfile, compatibility_score: 0.5, age: matchAge };
            }
            
            const compatibility = compatibilityData.score;
            console.log(`calculateMatches: Compatibility score for ${matchProfile.first_name}: ${compatibility}`);

            return {
              ...matchProfile,
              compatibility_score: compatibility,
              age: matchAge
            };
          } catch (error) {
            console.error('calculateMatches: Error calculating compatibility for match:', matchProfile.user_id, error);
            return null;
          }
        })
      );

      // Filter out null results and apply compatibility score threshold
      const validMatches = matchesWithCompatibility
        .filter((match): match is MatchProfile => { // Type assertion for filter
          const isValid = match !== null && 
                          typeof match.compatibility_score === 'number' && 
                          match.compatibility_score > 0.6;
          if (!isValid) {
            console.log(`calculateMatches: Filtering out match (ID: ${match?.user_id}) due to null/invalid score or score <= 0.6. Score: ${match?.compatibility_score}`);
          }
          return isValid;
        });

      console.log('calculateMatches: Valid matches after all filtering:', validMatches.length, validMatches);
      setMatches(validMatches);

      // Store bidirectional matches in database using the new function
      if (validMatches.length > 0) {
        console.log('calculateMatches: Storing valid matches in database...');
        for (const match of validMatches) {
          try {
            const { error } = await supabase.rpc('create_bidirectional_match', {
              user1_uuid: user.id,
              user2_uuid: match.user_id,
              compatibility_score_val: match.compatibility_score || 0
            });
            
            if (error) {
              console.error('calculateMatches: Error creating bidirectional match for:', match.user_id, error);
            } else {
              console.log('calculateMatches: Successfully created bidirectional match for:', match.user_id);
            }
          } catch (error) {
            console.error('calculateMatches: Error calling create_bidirectional_match RPC for:', match.user_id, error);
          }
        }
      } else {
        console.log('calculateMatches: No valid matches to store in database.');
      }
    } catch (error) {
      console.error('calculateMatches: Top-level error calculating matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getExistingMatches = async () => {
    if (!user) {
      console.log('getExistingMatches: No user, returning.');
      return []; // Return empty array if no user
    }

    try {
      console.log('getExistingMatches: Fetching existing matches for user:', user.id);
      // Get matches where the current user is either the matcher or the matched
      const { data: existingMatches, error } = await supabase
        .from('matches')
        .select(`
          *,
          profiles!matches_matched_user_id_fkey(*)
        `)
        .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`); // Fetch matches where current user is either user1 or user2

      if (error) {
        console.error('getExistingMatches: Error fetching existing matches:', error);
        return [];
      }

      if (!existingMatches || existingMatches.length === 0) {
        console.log('getExistingMatches: No existing matches found.');
        return [];
      }

      console.log('getExistingMatches: Found', existingMatches.length, 'existing match records.');

      const formattedMatches = existingMatches.map(match => {
        // Determine which profile is the 'other' user
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
      }).filter(Boolean) as MatchProfile[]; // Filter out any nulls and assert type

      console.log('getExistingMatches: Formatted existing matches:', formattedMatches.length, formattedMatches);
      return formattedMatches;
    } catch (error) {
      console.error('getExistingMatches: Error getting existing matches:', error);
      return [];
    }
  };

  // Main effect for loading matches
  useEffect(() => {
    const loadMatches = async () => {
      if (!user) {
        setMatches([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const existing = await getExistingMatches();
      if (existing.length > 0) {
        console.log('Main useEffect: Found existing matches, setting state.');
        setMatches(existing);
        setLoading(false);
      } else {
        console.log('Main useEffect: No existing matches, calculating new ones.');
        await calculateMatches(); // This will set matches and loading state
      }
    };

    loadMatches();
  }, [user]); // Rerun when user changes

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
          // When profile updates, we should re-evaluate matches.
          // Calling calculateMatches directly is more explicit for this event.
          calculateMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    matches,
    loading,
    refreshMatches: calculateMatches // Allow manual refresh
  };
};