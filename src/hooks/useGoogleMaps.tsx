import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlaceResult {
  name: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
}

interface TimezoneResult {
  timezoneId: string;
  timeZoneName: string;
}

export const useGoogleMaps = () => {
  const [loading, setLoading] = useState(false);

  const searchPlaces = async (query: string): Promise<PlaceResult[]> => {
    if (!query.trim()) {
      throw new Error('Search query is required');
    }

    setLoading(true);
    try {
      console.log('Searching places with query:', query);
      
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { address: query }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error('Failed to search places');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('Places search results:', data.results);
      return data.results || [];
    } catch (error) {
      console.error('Error searching places:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getTimezone = async (latitude: number, longitude: number): Promise<TimezoneResult | null> => {
    setLoading(true);
    try {
      console.log(`Fetching timezone for lat: ${latitude}, lng: ${longitude}`);
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { latitude, longitude }
      });

      if (error) {
        console.error('Supabase function error fetching timezone:', error);
        throw new Error('Failed to fetch timezone');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.timezoneId && data.timeZoneName) {
        console.log('Timezone fetched successfully:', data.timezoneId);
        return { timezoneId: data.timezoneId, timeZoneName: data.timeZoneName };
      } else {
        console.warn('No timezone data returned for coordinates:', { latitude, longitude });
        return null;
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    searchPlaces,
    getTimezone, // Added new function
    hasApiKey: true // Always true since API key is managed server-side
  };
};