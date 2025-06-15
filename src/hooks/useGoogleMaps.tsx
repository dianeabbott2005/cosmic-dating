
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlaceResult {
  name: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
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

  return {
    loading,
    searchPlaces,
    hasApiKey: true // Always true since API key is managed server-side
  };
};
