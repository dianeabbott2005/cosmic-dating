import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useGoogleMaps } from './useGoogleMaps';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useUserLocation = () => {
  const { user } = useAuth();
  const { reverseGeocode } = useGoogleMaps();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const updateUserLocation = async () => {
      if (!user || isUpdating) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('current_city, is_active')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error("useUserLocation: Error fetching profile", profileError);
        return;
      }
      
      if (profile.is_active === false && !profile.current_city) {
        console.log("useUserLocation: Human user profile missing current location. Attempting to fetch.");
        setIsUpdating(true);

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              const locationData = await reverseGeocode(latitude, longitude);
              if (locationData && locationData.city) {
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({
                    current_city: locationData.city,
                    current_country: locationData.country,
                    current_timezone: locationData.timezoneId,
                  })
                  .eq('user_id', user.id);

                if (updateError) throw updateError;
                console.log("useUserLocation: Successfully updated user location to", locationData.city);
              }
            } catch (error: any) {
              console.error("useUserLocation: Failed to update user location:", error.message);
              toast({
                title: "Location Update Failed",
                description: "Could not automatically update your location.",
                variant: "destructive",
              });
            } finally {
              setIsUpdating(false);
            }
          },
          (error) => {
            console.warn("useUserLocation: Geolocation permission denied or failed.", error.message);
            setIsUpdating(false);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
        );
      }
    };

    // Delay the execution slightly to ensure the main app flow has initialized
    const timer = setTimeout(updateUserLocation, 2000);
    return () => clearTimeout(timer);

  }, [user, reverseGeocode, toast, isUpdating]);
};