
import { useState } from 'react';

interface PlaceResult {
  name: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
}

export const useGoogleMaps = () => {
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('google_maps_api_key') || '');

  const saveApiKey = (key: string) => {
    localStorage.setItem('google_maps_api_key', key);
    setApiKey(key);
  };

  const searchPlaces = async (query: string): Promise<PlaceResult[]> => {
    if (!apiKey) {
      throw new Error('Google Maps API key not provided');
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search places');
      }

      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(data.error_message || 'Geocoding failed');
      }

      return data.results.map((result: any) => ({
        name: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address
      }));
    } catch (error) {
      console.error('Error searching places:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    apiKey,
    loading,
    saveApiKey,
    searchPlaces,
    hasApiKey: !!apiKey
  };
};
