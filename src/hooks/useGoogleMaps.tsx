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

interface ReverseGeocodeResult {
  city: string | null;
  country: string | null;
  timezoneId: string | null;
  timeZoneName: string | null;
}

export const useGoogleMaps = () => {
  const [loading, setLoading] = useState(false);

  const searchPlaces = async (query: string): Promise<PlaceResult[]> => {
    if (!query.trim()) {
      throw new Error('Search query is required');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { address: query }
      });

      if (error) throw new Error('Failed to search places');
      if (data.error) throw new Error(data.error);

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
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { latitude, longitude }
      });

      if (error) throw new Error('Failed to fetch timezone');
      if (data.error) throw new Error(data.error);

      if (data.timezoneId && data.timeZoneName) {
        return { timezoneId: data.timezoneId, timeZoneName: data.timeZoneName };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('geocode', {
        body: { latitude, longitude }
      });

      if (error) throw new Error('Failed to reverse geocode');
      if (data.error) throw new Error(data.error);

      return {
        city: data.city || null,
        country: data.country || null,
        timezoneId: data.timezoneId || null,
        timeZoneName: data.timeZoneName || null,
      };
    } catch (error) {
      console.error('Error in reverseGeocode hook:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    searchPlaces,
    getTimezone,
    reverseGeocode,
    hasApiKey: true
  };
};