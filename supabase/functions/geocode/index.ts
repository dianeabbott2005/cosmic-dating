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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    let { address, latitude, longitude }: GeocodeRequest = await req.json();
    
    let results: PlaceResult[] = [];
    let timezoneId: string | null = null;
    let timeZoneName: string | null = null;
    let reverseGeocodedCity: string | null = null;
    let reverseGeocodedCountry: string | null = null;

    if (address && address.trim().length > 0) {
      console.log('Geocoding address:', address);
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      if (!geocodeResponse.ok) throw new Error(`Google Maps Geocoding API error: ${geocodeResponse.status}`);
      const geocodeData = await geocodeResponse.json();
      if (geocodeData.status !== 'OK') throw new Error(geocodeData.error_message || `Geocoding failed: ${geocodeData.status}`);

      results = geocodeData.results.map((result: any) => ({
        name: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address
      }));

      if (results.length > 0) {
        latitude = results[0].latitude;
        longitude = results[0].longitude;
      }
    } else if (latitude !== undefined && longitude !== undefined) {
      console.log(`Reverse geocoding coordinates: ${latitude}, ${longitude}`);
      const reverseGeocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );

      if (!reverseGeocodeResponse.ok) throw new Error(`Google Maps Reverse Geocoding API error: ${reverseGeocodeResponse.status}`);
      const reverseGeocodeData = await reverseGeocodeResponse.json();

      if (reverseGeocodeData.status === 'OK' && reverseGeocodeData.results?.[0]) {
        const firstResult = reverseGeocodeData.results[0];
        const cityComponent = firstResult.address_components.find((c: any) => c.types.includes('locality'));
        const countryComponent = firstResult.address_components.find((c: any) => c.types.includes('country'));
        
        reverseGeocodedCity = cityComponent?.long_name || null;
        reverseGeocodedCountry = countryComponent?.long_name || null;
        console.log(`Successfully reverse geocoded: ${reverseGeocodedCity}, ${reverseGeocodedCountry}`);
      } else {
        console.warn('Reverse geocoding error:', reverseGeocodeData);
      }
    }

    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      const timestamp = Math.floor(Date.now() / 1000);
      const timezoneApiUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${apiKey}`;
      
      const timezoneResponse = await fetch(timezoneApiUrl);
      const timezoneData = await timezoneResponse.json();

      if (timezoneData.status === 'OK' && timezoneData.timeZoneId) {
        timezoneId = timezoneData.timeZoneId;
        timeZoneName = timezoneData.timeZoneName;
      } else {
        console.warn(`Google Time Zone API error for coordinates ${latitude}, ${longitude}:`, timezoneData.status, timezoneData.errorMessage);
      }
    }

    return new Response(JSON.stringify({ 
      results, 
      timezoneId, 
      timeZoneName,
      city: reverseGeocodedCity,
      country: reverseGeocodedCountry
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in geocode function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});