import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface PlaceResult {
  name: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const { address, latitude, longitude }: GeocodeRequest = await req.json();
    
    let results: PlaceResult[] = [];
    let timezoneId: string | null = null;
    let timeZoneName: string | null = null;

    // --- Step 1: Handle Geocoding (if address is provided) ---
    if (address && address.trim().length > 0) {
      console.log('Geocoding address:', address);
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      if (!geocodeResponse.ok) {
        throw new Error(`Google Maps Geocoding API error: ${geocodeResponse.status}`);
      }

      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status !== 'OK') {
        console.error('Geocoding error:', geocodeData);
        throw new Error(geocodeData.error_message || `Geocoding failed: ${geocodeData.status}`);
      }

      results = geocodeData.results.map((result: any) => ({
        name: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address
      }));

      console.log(`Successfully geocoded ${results.length} results`);

      // Use the first result's coordinates for timezone lookup if available
      if (results.length > 0) {
        latitude = results[0].latitude;
        longitude = results[0].longitude;
      }
    }

    // --- Step 2: Handle Timezone Lookup (if coordinates are available) ---
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      console.log(`Fetching timezone for coordinates: ${latitude}, ${longitude}`);
      const timestamp = Math.floor(Date.now() / 1000); // Current Unix timestamp
      const timezoneApiUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${apiKey}`;
      
      const timezoneResponse = await fetch(timezoneApiUrl);
      const timezoneData = await timezoneResponse.json();

      if (timezoneData.status === 'OK' && timezoneData.timeZoneId) {
        timezoneId = timezoneData.timeZoneId;
        timeZoneName = timezoneData.timeZoneName;
        console.log(`Successfully fetched timezone: ${timezoneId}`);
      } else {
        console.warn(`Google Time Zone API error for coordinates ${latitude}, ${longitude}:`, timezoneData.status, timezoneData.errorMessage);
      }
    }

    return new Response(JSON.stringify({ results, timezoneId, timeZoneName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in geocode function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});