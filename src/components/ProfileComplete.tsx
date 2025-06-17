import { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleMaps } from '@/hooks/useGoogleMaps'; // Import useGoogleMaps

interface ProfileCompleteProps {
  onNext: (data: any) => void;
  userData: any;
}

const ProfileComplete = ({ onNext, userData }: ProfileCompleteProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { getTimezone } = useGoogleMaps(); // Use getTimezone from useGoogleMaps

  const handleCreateProfile = async () => {
    if (!authUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a profile.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      let { latitude, longitude, timezone } = userData; // Get existing lat/lng/timezone from userData

      // If placeOfBirth is provided but lat/lng are missing, try to geocode first
      if (userData.placeOfBirth && (!latitude || !longitude)) {
        try {
          console.log(`Geocoding place of birth: ${userData.placeOfBirth}`);
          const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke('geocode', {
            body: { address: userData.placeOfBirth }
          });

          if (geocodeError) {
            console.error('Geocoding function error:', geocodeError);
          } else if (geocodeData?.results?.[0]) {
            const location = geocodeData.results[0];
            latitude = location.latitude;
            longitude = location.longitude;
            console.log('Geocoding successful:', { latitude, longitude });
          } else {
            console.warn('Geocoding returned no results for:', userData.placeOfBirth);
          }
        } catch (geocodeError) {
          console.error('Geocoding failed:', geocodeError);
        }
      }

      // Now, if we have latitude and longitude, fetch the timezone
      if (latitude && longitude) {
        try {
          const timezoneResult = await getTimezone(latitude, longitude);
          if (timezoneResult) {
            timezone = timezoneResult.timezoneId;
            console.log('Timezone fetched automatically:', timezone);
          } else {
            console.warn('Could not automatically determine timezone for coordinates:', { latitude, longitude });
          }
        } catch (timezoneError) {
          console.error('Error fetching timezone automatically:', timezoneError);
        }
      }
      
      const profileData = {
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email,
        date_of_birth: userData.dateOfBirth,
        time_of_birth: userData.timeOfBirth,
        place_of_birth: userData.placeOfBirth,
        gender: userData.gender,
        looking_for: userData.lookingFor,
        min_age: userData.minAge,
        max_age: userData.maxAge,
        latitude: latitude,
        longitude: longitude,
        timezone: timezone, // Use the automatically fetched timezone
        updated_at: new Date().toISOString(),
      };

      console.log('Updating profile with data:', profileData);

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', authUser.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      console.log('Profile updated successfully');
      
      toast({
        title: "Profile Created Successfully!",
        description: "Welcome to your cosmic dating journey.",
      });

      // Complete the registration process
      onNext({ success: true });

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error Saving Profile",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Complete Your Profile</h3>
        <p className="text-gray-400">
          Ready to find your cosmic connection? Let's create your profile!
        </p>
      </div>

      {/* Profile Summary */}
      <div className="bg-slate-800/50 rounded-xl p-6 space-y-4">
        <h4 className="text-lg font-medium text-white mb-4">Profile Summary</h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Name:</span>
            <p className="text-white">{userData.firstName} {userData.lastName}</p>
          </div>
          <div>
            <span className="text-gray-400">Email:</span>
            <p className="text-white">{userData.email}</p>
          </div>
          <div>
            <span className="text-gray-400">Gender:</span>
            <p className="text-white capitalize">{userData.gender}</p>
          </div>
          <div>
            <span className="text-gray-400">Looking for:</span>
            <p className="text-white capitalize">{userData.lookingFor}</p>
          </div>
          <div>
            <span className="text-gray-400">Birth Date:</span>
            <p className="text-white">{userData.dateOfBirth}</p>
          </div>
          <div>
            <span className="text-gray-400">Birth Time:</span>
            <p className="text-white">{userData.timeOfBirth}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Birth Place:</span>
            <p className="text-white">{userData.placeOfBirth}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Timezone:</span>
            <p className="text-white">{userData.timezone || 'Automatically determined'}</p> {/* Display timezone or placeholder */}
          </div>
          <div>
            <span className="text-gray-400">Age Range:</span>
            <p className="text-white">{userData.minAge} - {userData.maxAge} years</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateProfile}
        disabled={isCreating}
        className="btn-cosmic w-full flex items-center justify-center gap-2"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving Your Profile...
          </>
        ) : (
          'Create My Profile'
        )}
      </button>
    </div>
  );
};

export default ProfileComplete;